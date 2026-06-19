#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-2.0-or-later
#
# Run the unit tests under gjs. Every *.test.js in this directory is executed as
# an ESM module; a non-zero exit from any file fails the whole run.

set -euo pipefail

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Per-file wall-clock limit: a runaway loop in a synchronous gjs test never
# returns on its own (no main loop), so cap each file and treat the hit as a
# failure (GNU timeout exits 124 on expiry).
TEST_TIMEOUT="${TEST_TIMEOUT:-30}"

if ! command -v gjs >/dev/null 2>&1; then
  echo "gjs not found in PATH; install gjs to run the tests" >&2
  exit 127
fi

if command -v timeout >/dev/null 2>&1; then
  run_test() { timeout "$TEST_TIMEOUT" gjs -m "$1"; }
else
  echo "timeout not found in PATH; running without a per-test time limit" >&2
  run_test() { gjs -m "$1"; }
fi

status=0
for t in "$dir"/*.test.js; do
  echo "=== ${t##*/} ==="
  rc=0
  run_test "$t" || rc=$?
  if [ "$rc" -eq 124 ]; then
    echo "TIMED OUT after ${TEST_TIMEOUT}s" >&2
    status=1
  elif [ "$rc" -ne 0 ]; then
    status=1
  fi
  echo
done

exit "$status"
