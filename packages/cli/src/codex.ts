import { execFile, execFileSync } from 'node:child_process';
import { closeSync, constants, accessSync, lstatSync, openSync, readdirSync, readSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// Codex's wake (B33.4, blueprint/areas/2-agents.md; docs/research/2026-11-08-clients-wake-lab.md). When the owner
// answers a decision a Codex thread asked, the command's watcher rings that thread once with
// `codex queue --thread=<id> --message=<note>` (Codex CLI 0.149 or later), and Codex runs the note as the thread's next
// turn: at once when it is idle, after the running turn when it is busy, and when it is resumed if Codex was closed.
// The note is an argument, which the process list shows while the call runs (50 to 100 ms in the lab), so it names only
// the agent and the decision and says to call wait. It never holds the answer: nothing here sees one.

// Codex's MCP client names itself so (verified 8 Nov 2026, Codex 0.163.0).
export const CODEX_CLIENT = 'codex-mcp-client';
// Every tool call from Codex carries its turn's details under this key of `_meta`, beside `threadId`.
const TURN = 'x-codex-turn-metadata';
// A Codex thread id is a UUID; nothing else is ever handed to `codex queue`, which would take another word for a
// thread's name.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isThreadId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const fields = (v: unknown): { [k: string]: unknown } | null => typeof v === 'object' && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;

// The thread an MCP tool call from Codex came from, as the call names it: `_meta.threadId`, which the turn's own
// metadata must not contradict. How its turn started (`turn_trigger`: user for a typed turn, queue for a queued one,
// exec in `codex exec`) and whose thread it is (`thread_source`: user for the owner's own, subagent or guardian_review
// for a thread Codex started itself) come with it, when the call says. Null when the call names no thread.
export type CallThread = { thread: string; trigger: string | null; source: string | null };
export function threadOfCall(meta: unknown): CallThread | null {
  const m = fields(meta);
  if (!m || !isThreadId(m.threadId)) return null;
  const turn = fields(m[TURN]);
  if (turn && turn.thread_id !== undefined && turn.thread_id !== m.threadId) return null;
  const said = (k: string) => turn && typeof turn[k] === 'string' ? String(turn[k]) : null;
  return { thread: m.threadId, trigger: said('turn_trigger'), source: said('thread_source') };
}

// What a thread's rollout says of it: 'stays' for a thread of the terminal's or the ChatGPT app's own, which takes a
// queued note as a turn, 'ends' for any other (`codex exec`'s, which ends with its turn, or one Codex started as a
// helper), null when no rollout is found. A rollout is `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-<time>-<thread>.jsonl`,
// filed under the day its thread began in local time, which a v7 thread id carries: that day and the days either side
// are looked in. Its first line, `session_meta`, names its `source` (cli for the terminal, vscode for the terminal on
// Codex's shared background server and for the ChatGPT app, exec, or an object for a helper), its `originator`
// (`codex_exec` for `codex exec`) and, since about 0.16x, its `thread_source` (checked on pro, 8 Nov 2026). Read only.
const META_MAX_BYTES = 4 * 1024 * 1024, DAY_MS = 86_400_000;
export function rolloutOf(thread: string, codexHome = process.env.CODEX_HOME || path.join(homedir(), '.codex')): 'stays' | 'ends' | null {
  if (!isThreadId(thread) || thread[14] !== '7') return null;
  const born = Number.parseInt(thread.replace(/-/g, '').slice(0, 12), 16), pad = (n: number) => String(n).padStart(2, '0');
  for (const shift of [0, -DAY_MS, DAY_MS]) {
    const day = new Date(born + shift), dir = path.join(codexHome, 'sessions', String(day.getFullYear()), pad(day.getMonth() + 1), pad(day.getDate()));
    let names: string[];
    try { names = readdirSync(dir); } catch { continue; }
    for (const name of names) {
      if (!name.startsWith('rollout-') || !name.toLowerCase().endsWith(`-${thread.toLowerCase()}.jsonl`)) continue;
      const said = sessionMeta(firstLine(path.join(dir, name)), thread);
      if (said) return said;
    }
  }
  return null;
}
function sessionMeta(line: string | null, thread: string): 'stays' | 'ends' | null {
  let record: unknown;
  try { record = line === null ? null : JSON.parse(line); } catch { return null; }
  const r = fields(record), p = fields(r?.payload);
  if (r?.type !== 'session_meta' || !p || typeof p.id !== 'string' || p.id.toLowerCase() !== thread.toLowerCase()) return null;
  const stays = (p.source === 'cli' || p.source === 'vscode') && p.originator !== 'codex_exec' && (p.thread_source === undefined || p.thread_source === 'user');
  return stays ? 'stays' : 'ends';
}
// A regular file's first line, up to META_MAX_BYTES; null for anything else. A FIFO named like a rollout would block.
function firstLine(file: string): string | null {
  let fd: number;
  try { if (!lstatSync(file).isFile()) return null; fd = openSync(file, 'r'); } catch { return null; }
  try {
    const chunk = Buffer.alloc(64 * 1024), parts: Buffer[] = [];
    for (let at = 0; at < META_MAX_BYTES;) {
      const n = readSync(fd, chunk, 0, chunk.length, at);
      if (n === 0) return at > 0 ? Buffer.concat(parts).toString('utf8') : null;
      const end = chunk.subarray(0, n).indexOf(0x0a);
      parts.push(Buffer.from(chunk.subarray(0, end >= 0 ? end : n)));
      if (end >= 0) return Buffer.concat(parts).toString('utf8');
      at += n;
    }
    return null;
  } catch { return null; } finally { closeSync(fd); }
}

// The thread a note can wake, for a call from Codex; null when none can. Over MCP, the call names the thread and how its
// turn started: never a `codex exec` turn, nor a thread Codex started as a helper, and when its rollout is found it has
// to say the thread stays. From Codex's shell, CODEX_THREAD_ID names the thread but nothing says how its turn started, so
// only a thread whose rollout is found and says it stays is woken.
export function wakeableThread(from: { meta: unknown } | { env: NodeJS.ProcessEnv }): string | null {
  if ('meta' in from) {
    const call = threadOfCall(from.meta);
    if (!call || call.trigger === 'exec' || (call.source !== null && call.source !== 'user')) return null;
    return rolloutOf(call.thread) === 'ends' ? null : call.thread;
  }
  const thread = from.env.CODEX_THREAD_ID;
  return isThreadId(thread) && rolloutOf(thread) === 'stays' ? thread : null;
}

// The Codex CLI that rings, or null when there is none that can: AGENTPAGER_CODEX when it is set, and then only it; else
// the `codex` on PATH; else the ChatGPT app's own (macOS). Each has to say it is 0.149 or later, the first with
// `codex queue`; the app's said 0.167.0-alpha.3.2 on pro, 8 Nov 2026.
export const MIN_QUEUE: readonly [number, number, number] = [0, 149, 0];
const APP_CLI = ['Applications', 'ChatGPT.app', 'Contents', 'Resources', 'codex-cli', 'CodexCLI.app', 'Contents', 'MacOS', 'codex'];
export function codexCli(env: NodeJS.ProcessEnv = process.env): string | null {
  const named = env.AGENTPAGER_CODEX;
  const onPath = (env.PATH ?? '').split(path.delimiter).filter(dir => path.isAbsolute(dir)).map(dir => path.join(dir, 'codex'));
  const candidates = named !== undefined ? [named] : [...onPath, path.join('/', ...APP_CLI), path.join(homedir(), ...APP_CLI)];
  for (const cli of candidates) {
    if (!path.isAbsolute(cli)) continue;
    try { accessSync(cli, constants.X_OK); } catch { continue; }
    if (queues(cli, env)) return cli;
  }
  return null;
}
function queues(cli: string, env: NodeJS.ProcessEnv): boolean {
  let out: string;
  try { out = execFileSync(cli, ['--version'], { encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'ignore'], env: ringEnv(env) }); } catch { return false; }
  const v = /^codex-cli (\d+)\.(\d+)\.(\d+)\b/m.exec(out.trim());
  if (!v) return false;
  for (let i = 0; i < 3; i++) if (Number(v[i + 1]) !== MIN_QUEUE[i]) return Number(v[i + 1]) > MIN_QUEUE[i];
  return true;
}
// What `codex queue` runs with: this process's environment, without what describes the turn that asked (its thread and
// sandbox) or the pager's number.
function ringEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = { ...env };
  for (const k of ['CODEX_THREAD_ID', 'CODEX_SANDBOX', 'CODEX_SANDBOX_NETWORK_DISABLED', 'AGENTPAGER_PAGER']) delete out[k];
  return out;
}

// The note: the decision and the agent, and how to read the answer, in the words of how the agent asked.
export const note = (agent: string, short: string, via: 'mcp' | 'shell') => `AgentPager: your owner answered decision ${short}. ${via === 'mcp'
  ? `Call the agentpager wait tool (agent ${agent}, decision ${short})` : `Run agentpager wait --agent ${agent} ${short}`} to read the answer, then acknowledge it.`;

// One `codex queue`. 'queued' when it exits 0; 'timed-out' when it ran past its time, when it may or may not have
// queued; 'unknown-thread' when Codex has no such thread (exit 1, "no rollout found" in 0.163.0); 'failed' otherwise.
export type Rang = 'queued' | 'timed-out' | 'unknown-thread' | 'failed';
export const QUEUE_TIMEOUT_MS = 30_000;
export function ring(cli: string, thread: string, text: string, timeoutMs = QUEUE_TIMEOUT_MS, env: NodeJS.ProcessEnv = process.env): Promise<Rang> {
  if (!isThreadId(thread)) return Promise.resolve('failed');
  return new Promise(done => {
    // `--name=value`, so neither value is ever read as a flag.
    execFile(cli, ['queue', `--thread=${thread}`, `--message=${text}`], { timeout: timeoutMs, killSignal: 'SIGKILL', env: ringEnv(env), maxBuffer: 64 * 1024 }, (e, stdout, stderr) => {
      if (!e) return done('queued');
      if ('killed' in e && e.killed) return done('timed-out');
      done(e.code === 1 && /no rollout found|no active session|thread not found/i.test(`${stdout}\n${stderr}`) ? 'unknown-thread' : 'failed');
    });
  });
}
