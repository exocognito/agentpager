#!/bin/sh
# Builds the agentpager binary for this machine with Bun: built locally and symlinked on PATH, with no releases
# or install script until INSTALL (L22, blueprint/areas/7-getting-started.md).
set -e
cd "$(dirname "$0")/.."
version="$(git rev-parse --short HEAD)"
# The Claude Code plugin's and the pi extension's files go inside the binary, for setup to install (src/adapters.ts).
# They travel as one argument, which Linux caps at 128 KB.
adapters="$(bun -e 'import { fromSource } from "./src/adapters.ts"; process.stdout.write(JSON.stringify(fromSource()))')"
[ "${#adapters}" -gt 2 ] && [ "${#adapters}" -lt 120000 ] || { echo "The adapters' files are ${#adapters} characters: none, or too many to pass to bun build as one argument." >&2; exit 1; }
bun build --compile --minify src/main.ts --define "__AGENTPAGER_VERSION__=\"$version\"" --define "__AGENTPAGER_ADAPTERS__=$adapters" --outfile dist/agentpager
echo "Built $PWD/dist/agentpager ($version)."
echo "Put it on PATH: ln -sf \"$PWD/dist/agentpager\" ~/.local/bin/agentpager"
