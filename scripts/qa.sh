#!/usr/bin/env bash
# Runs every quality gate in order and reports PASS/FAIL per section.
# Passing output goes only to the log file; failing output is printed.
# Exits non-zero if any section fails. See tech-docs/testing.md.

set -u
cd "$(dirname "$0")/.."

export NO_COLOR=1 FORCE_COLOR=0 NEXT_TELEMETRY_DISABLED=1

LOG="${QA_LOG:-qa.log}"
: >"$LOG"

# A free port per run, so two checkouts (or worktrees) can run QA at the same time.
if [ -z "${E2E_PORT:-}" ]; then
  E2E_PORT=$(node -e 'const s=require("net").createServer();s.listen(0,()=>{console.log(s.address().port);s.close()})')
  export E2E_PORT
fi

failed=()
passed=()

section() {
  local name="$1"
  shift
  local out
  out=$(mktemp)
  echo "== $name: $*"
  local start=$SECONDS
  "$@" >"$out" 2>&1
  local code=$?
  local secs=$((SECONDS - start))
  { echo "===== $name: $* (exit $code, ${secs}s)"; cat "$out"; echo; } >>"$LOG"
  if [ "$code" -eq 0 ]; then
    echo "PASS $name (${secs}s)"
    passed+=("$name")
  else
    cat "$out"
    echo "FAIL $name (exit $code, ${secs}s)"
    failed+=("$name")
  fi
  rm -f "$out"
}

section biome npx biome check --error-on-warnings --colors=off
section typecheck npm run typecheck
section build npm run build
section cli-build npm run build -w todo-cat-cli
section vitest npx vitest run
section playwright npx playwright test

echo
echo "== summary"
echo "passed: ${passed[*]:-none}"
echo "failed: ${failed[*]:-none}"
echo "log: $LOG"
if [ "${#failed[@]}" -gt 0 ]; then
  echo "QA FAILED"
  exit 1
fi
echo "QA PASSED"
