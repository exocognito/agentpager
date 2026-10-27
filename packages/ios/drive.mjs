#!/usr/bin/env node
// Sends one command to DriverTests (running in the Simulator) and prints its reply.
// Usage: node drive.mjs <op> [key=value ...]   e.g. node drive.mjs tap id=pair-button
// Ops: tree, tap, type, wait, gone, get, swipe, tapxy, keys, shot, open, home, activate, relaunch, sleep, quit.
// Find elements with id=, label= or contains=, narrowed by type= and index=. Add app=springboard (Home Screen,
// system alerts), app=safari or app=<bundle id> to act on another app. Open links with `xcrun simctl openurl`.
import { readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const dir = process.env.AGENTPAGER_DRIVE_DIR ?? "/tmp/agentpager-drive"
const [op, ...pairs] = process.argv.slice(2)
if (!op) {
  console.error("usage: node drive.mjs <op> [key=value ...]")
  process.exit(2)
}

const read = (file) => {
  try {
    return JSON.parse(readFileSync(join(dir, file), "utf8"))
  } catch {
    return undefined
  }
}

const cmd = { op }
for (const pair of pairs) {
  const at = pair.indexOf("=")
  const [k, v] = [pair.slice(0, at), pair.slice(at + 1)]
  cmd[k] = v === "true" ? true : v === "false" ? false : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v
}
cmd.seq = Math.max(read("cmd.json")?.seq ?? 0, read("out.json")?.seq ?? 0) + 1

writeFileSync(join(dir, "cmd.tmp"), JSON.stringify(cmd))
renameSync(join(dir, "cmd.tmp"), join(dir, "cmd.json"))

const deadline = Date.now() + ((cmd.timeout ?? 5) + (cmd.seconds ?? 0) + 30) * 1000
while (Date.now() < deadline) {
  const out = read("out.json")
  if (out?.seq === cmd.seq) {
    const { tree, seq, ...rest } = out
    if (tree !== undefined) console.log(tree)
    else console.log(JSON.stringify(rest))
    process.exit(out.ok ? 0 : 1)
  }
  await new Promise((r) => setTimeout(r, 100))
}
console.error("no reply: is DriverTests running?")
process.exit(1)
