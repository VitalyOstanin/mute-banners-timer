# 0007 - Run unit tests under gjs, without a node test framework

Status: Accepted

## Context

`muteController.js` carries the logic worth testing in isolation: the
`bannerBlocked` accessor guard (effective = mute OR real), engage/release timer
state, the panel-write guard (an external `false` write must not lift an active
mute), `remainingSeconds` math, re-engage, and descriptor restoration on
`uninstall()`.

The module is not plain Node JavaScript: it imports `gi://GLib` at the top level
and calls `GLib.get_monotonic_time()` / `GLib.timeout_add_seconds(...)` in the
code paths under test. These `gi://` specifiers are resolved by `gjs`, the GNOME
JavaScript interpreter; they do not resolve under Node.js. A Node-based runner
such as vitest or jest cannot import the module without mocking the GNOME
platform layer, and the project has no `package.json` — it is a GNOME Shell
extension, not a Node package, so adding a Node toolchain would introduce a
dependency and build step that nothing else here needs.

## Decision

Test under `gjs`, the same interpreter that runs the extension. Tests live in
`tests/*.test.js` as ESM modules that import the real module and a fake tray, and
assert with a small in-file `check()` helper (no test framework). `tests/run.sh`
executes every test file with `gjs -m` and fails the run if any file exits
non-zero.

The fake tray is a fresh class per test, so the prototype-level `bannerBlocked`
guard installed by one test cannot leak into another.

## Consequences

- The code is exercised in the environment it actually runs in; no GNOME platform
  mocking and no node/npm toolchain.
- No assertion library, fixtures, watch mode, or coverage reporting — the helper
  is deliberately minimal.
- Unit coverage is limited to the pure logic in `muteController.js`. The UI
  modules `indicator.js` and `bannerControl.js`, and the `_showNotification`
  override, import live-shell resource modules (`resource:///org/gnome/shell/...`)
  that do not exist outside a running GNOME session, so they cannot run under the
  same synchronous gjs runner and are not unit-tested. They are covered by the
  manual functional run before publishing. Pure helpers that creep into a UI
  module (for example time formatting) should move into `muteController.js` so
  they fall under unit coverage; the rest stays manual by necessity.
- Running the tests requires `gjs` on `PATH` (already present wherever GNOME
  Shell runs); `tests/run.sh` reports a clear error if it is missing.
