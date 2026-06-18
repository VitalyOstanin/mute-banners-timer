#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-2.0-or-later
#
# Run the unit tests under gjs. Every *.test.js in this directory is executed as
# an ESM module; a non-zero exit from any file fails the whole run.

set -euo pipefail

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v gjs >/dev/null 2>&1; then
  echo "gjs not found in PATH; install gjs to run the tests" >&2
  exit 127
fi

status=0
for t in "$dir"/*.test.js; do
  echo "=== ${t##*/} ==="
  if ! gjs -m "$t"; then
    status=1
  fi
  echo
done

exit "$status"
