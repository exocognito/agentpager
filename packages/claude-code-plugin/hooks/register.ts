import type { EngineInterface, Register } from 'claude-code'
import { COMMAND, LINE, LINE_ID, Mod, homeOf, isCommand, wakesHere, type Host } from './wake'

// AgentPager's Claude Code mod (B33.2, blueprint/areas/2-agents.md): Claude Code's side of wake.ts, which holds the
// logic. Every call on `$` is here, written out, as `claude plugin validate` follows them.

// This process's mod, while the session can start turns; a reload of the module starts it again from session.start.
let mod: Mod | null = null
// Whether the agentpager command runs here, for the session-start line; decided at session start.
let available = false

function hostOf($: EngineInterface): Host {
  return {
    now: () => $.clock.now(),
    after: (ms, fn) => $.clock.after(ms, fn),
    every: (ms, fn) => $.clock.every(ms, fn),
    sessionId: async () => String(await $.session.id()),
    setWake: async value => !(await $.env.set('AGENTPAGER_WAKE', value)).deny,
    // Looked for first, so a folder not made yet isn't a failure in Claude Code's debug log every second.
    list: async dir => await $.fs.exists(dir) ? (await $.fs.list(dir)).map(e => ({ name: e.name, kind: e.kind, size: e.size, mtimeMs: e.mtimeMs })) : null,
    read: file => $.fs.read(file),
    exists: file => $.fs.exists(file),
    run: async argv => {
      const r = await $.process.run(argv, { timeoutMs: 10_000 })
      return { exitCode: r.exitCode, stdout: r.stdout }
    },
    spawn: argv => {
      const child = $.process.spawn({ argv })
      const done = (async () => {
        let stdout = ''
        for await (const piece of child) if (piece.stream === 'stdout') stdout += piece.text
        const end = await child.result
        return { code: end.code, stdout }
      })().catch(() => ({ code: null, stdout: '' }))
      return { done, stop: () => { void child.return({ code: null, signal: 'SIGTERM' }).catch(() => undefined) } }
    },
    submit: async text => {
      const r = await $.prompt.submit({ text })
      return typeof r.drop === 'string' ? { entered: false, why: r.drop } : { entered: true }
    },
    debug: line => $.ui.log(`agentpager: ${line}`, { to: 'debug' }),
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    mod?.sessionEnded('reload')
    mod = null
    available = isCommand(await $.process.run([COMMAND, 'version'], { timeoutMs: 10_000 }).catch(() => ({ exitCode: 1, stdout: '' })))
    const home = homeOf(await $.env.get('AGENTPAGER_HOME'), await $.env.get('HOME'))
    const hasShell = await $.fs.exists('/bin/sh').catch(() => false)
    if (!wakesHere({ isInteractive: e.isInteractive, hasShell, command: available, home }) || home === null) {
      // A variable a session this one was started from set doesn't speak for this one.
      await $.env.set('AGENTPAGER_WAKE', undefined)
      return started
    }
    mod = new Mod(hostOf($), home)
    await mod.start()
    return started
  })

  // The main loop's turns; a subagent's are its own.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await mod?.turnStarted()
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) void mod?.turnEnded()
    return done
  })

  on('session.end', async ($, e, next) => {
    mod?.sessionEnded(e.reason)
    if (e.reason !== 'clear' && e.reason !== 'resume') mod = null
    return next(e)
  })

  // The session-start line, last in the system prompt and the same every time.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    return available ? { sections: [...composed.sections, { id: LINE_ID, text: LINE, scope: 'session' as const }] } : composed
  })
}
