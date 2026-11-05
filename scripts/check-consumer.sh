#!/bin/sh
# Installs the packed package into a scratch project the way MONEI/dashboards consumes it (Vitest
# with happy-dom, no alias), then checks that it shares one Apollo Client instance with direct
# `@apollo/client` imports and that its declarations compile with skipLibCheck off.
# Usage: scripts/check-consumer.sh <@apollo/client version> <graphql version>
set -eu
repo=$(cd "$(dirname "$0")/.." && pwd)
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT

cp "$repo"/scripts/consumer/* "$dir"
(cd "$repo" && pnpm pack --pack-destination "$dir" >/dev/null)
cd "$dir"
pnpm add "@apollo/client@$1" "graphql@$2" ./*.tgz
pnpm exec vitest run
"$repo/node_modules/.bin/tsc" -p .
