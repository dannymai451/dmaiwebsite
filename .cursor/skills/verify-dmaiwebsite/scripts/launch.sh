#!/usr/bin/env bash
# Start the dmaiwebsite dev server for verification. Does not stop it.
set -euo pipefail

root=$(cd "$(dirname "$0")/../../../.." && pwd)
cd "$root"
scratch=/tmp/verify-dmaiwebsite
mkdir -p "$scratch"

if [[ -f "$scratch/pid" ]]; then
  old=$(cat "$scratch/pid" || true)
  if [[ -n "${old}" ]] && kill -0 "$old" 2>/dev/null; then
    echo "verification server already running as pid $old; refuse to double-drive" >&2
    exit 1
  fi
fi

if lsof -nP -iTCP:5199 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port 5199 is already in use; refuse to double-drive" >&2
  lsof -nP -iTCP:5199 -sTCP:LISTEN >&2
  exit 1
fi

npm install
npx playwright install chromium webkit

nohup npm run dev -- --host 127.0.0.1 --port 5199 --strictPort >"$scratch/dev.log" 2>&1 &
echo $! >"$scratch/pid"

ready=0
for _ in $(seq 1 80); do
  if grep -q '127.0.0.1:5199' "$scratch/dev.log" 2>/dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$(cat "$scratch/pid")" 2>/dev/null; then
    echo "dev server exited before it was ready" >&2
    cat "$scratch/dev.log" >&2
    exit 1
  fi
  sleep 0.25
done

if [[ "$ready" -ne 1 ]]; then
  echo "dev server did not print its URL; see $scratch/dev.log" >&2
  exit 1
fi

doctor="$root/.cursor/skills/verify-dmaiwebsite/scripts/doctor.mjs"
ok=0
for _ in $(seq 1 3); do
  if node "$doctor"; then
    ok=1
    break
  fi
  sleep 1
done

if [[ "$ok" -ne 1 ]]; then
  echo "page did not become ready; see $scratch/dev.log" >&2
  exit 1
fi

echo "READY pid=$(cat "$scratch/pid") url=http://127.0.0.1:5199/"
