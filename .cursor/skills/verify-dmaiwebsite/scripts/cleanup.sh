#!/usr/bin/env bash
# Stop only the verification server this skill started. Keep evidence.
set -euo pipefail

root=$(cd "$(dirname "$0")/../../../.." && pwd)
scratch=/tmp/verify-dmaiwebsite
pidfile="$scratch/pid"
evidence="$root/artifacts/verify-dmaiwebsite"
port5173_before=$(lsof -nP -iTCP:5173 -sTCP:LISTEN -t 2>/dev/null || true)

collect() {
  local pid=$1
  echo "$pid"
  local kids
  kids=$(ps -o pid= --ppid "$pid" 2>/dev/null || true)
  for kid in $kids; do
    collect "$kid"
  done
}

if [[ -f "$pidfile" ]]; then
  recorded=$(cat "$pidfile" || true)
  if [[ -n "${recorded}" ]] && [[ -d "/proc/${recorded}" ]]; then
    cmd=$(tr '\0' ' ' <"/proc/${recorded}/cmdline")
    if [[ "$cmd" != *5199* ]]; then
      echo "pid $recorded is not the verification server; not killing it" >&2
      echo "cmdline: $cmd" >&2
      exit 1
    fi
    mapfile -t pids < <(collect "$recorded")
    for ((i = ${#pids[@]} - 1; i >= 0; i--)); do
      kill "${pids[i]}" 2>/dev/null || true
    done
    for _ in $(seq 1 20); do
      if ! kill -0 "$recorded" 2>/dev/null; then
        break
      fi
      sleep 0.25
    done
    if kill -0 "$recorded" 2>/dev/null; then
      for ((i = ${#pids[@]} - 1; i >= 0; i--)); do
        if [[ -d "/proc/${pids[i]}" ]]; then
          kill -9 "${pids[i]}" 2>/dev/null || true
        fi
      done
    fi
    echo "stopped pid $recorded"
  else
    echo "recorded pid is not running"
  fi
else
  echo "no recorded pid"
fi

for _ in $(seq 1 20); do
  if ! lsof -nP -iTCP:5199 -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if lsof -nP -iTCP:5199 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port 5199 is still listening; left it alone because it is not a live recorded pid" >&2
  lsof -nP -iTCP:5199 -sTCP:LISTEN >&2
  exit 1
fi

port5173_after=$(lsof -nP -iTCP:5173 -sTCP:LISTEN -t 2>/dev/null || true)
if [[ "$port5173_before" != "$port5173_after" ]]; then
  echo "port 5173 changed during cleanup; that server must be left alone" >&2
  exit 1
fi

rm -rf "$scratch"
echo "port 5199 closed"
echo "scratch removed"
echo "evidence kept at $evidence"
