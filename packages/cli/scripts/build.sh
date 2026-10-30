#!/bin/sh
# Builds the agentpager binary for this machine with Bun (docs/v2: built locally and symlinked on PATH; no releases
# or install script until Stage 4).
set -e
cd "$(dirname "$0")/.."
version="$(git rev-parse --short HEAD)"
bun build --compile --minify src/main.ts --define "__AGENTPAGER_VERSION__=\"$version\"" --outfile dist/agentpager
echo "Built $PWD/dist/agentpager ($version)."
echo "Put it on PATH: ln -sf \"$PWD/dist/agentpager\" ~/.local/bin/agentpager"
