# CLAUDE.md

Guidance for AI agents and contributors working on this extension.

## Table of Contents

- [Project overview](#project-overview)
- [Hard constraint: GNOME 45-50](#hard-constraint-gnome-45-50)
- [API surface used](#api-surface-used)
- [Suppression model](#suppression-model)
- [Signal handling](#signal-handling)
- [Procedure: verify against a GNOME version](#procedure-verify-against-a-gnome-version)
- [Syntax check](#syntax-check)
- [Unit tests](#unit-tests)
- [Packaging](#packaging)
- [Manual testing](#manual-testing)
- [Files](#files)

## Project overview

`mute-banners-timer` temporarily mutes all notification banners (including
`CRITICAL`) for a chosen number of minutes. The rationale for each approach is
recorded in [docs/ADR](docs/ADR). Read the ADRs before changing how suppression
works.

## Hard constraint: GNOME 45-50

`metadata.json` declares `shell-version` 45 through 50. The suppression
mechanism, the panel indicator, and the on-banner control all work on every
declared version (verified against the upstream branches; see the procedure
below).

Verify any Meta/Shell/Clutter/St symbol against each declared version; do not
assume it exists because it works on the installed version.

## API surface used

| Symbol                                              | Source      | Versions | Notes                                              |
| --------------------------------------------------- | ----------- | -------- | -------------------------------------------------- |
| `Extension`, `InjectionManager`                     | gnome-shell | 45-50    | `js/extensions/extension.js`; lifecycle + override |
| `Main.messageTray`, `Main.panel.addToStatusArea`    | gnome-shell | 45-50    | singletons, `js/ui/main.js`                        |
| `Main.uiGroup`                                       | gnome-shell | 45-50    | host for the floating banner preset menu           |
| `MessageTray.prototype` `bannerBlocked` accessor    | gnome-shell | 45-50    | setter redefined to guard the block                |
| `MessageTray._bannerBlocked` / `_updateState`       | gnome-shell | 45-50    | private block field and state machine entry        |
| `MessageTray._notification` / `_notificationQueue`  | gnome-shell | 45-50    | current banner + queue; used by the requeue path   |
| `MessageTray._banner` / `_bannerBin`, `_notificationState` | gnome-shell | 45-50 | torn down in the requeue path (`State.HIDDEN`)    |
| `Notification.acknowledged`                          | gnome-shell | 45-50    | cleared so a requeued notification is not filtered |
| `Message._bodyBin` / `_bodyStack`                   | gnome-shell | 45-50    | body widget; its parent is the content column      |
| `MessageTray.prototype._showNotification`           | gnome-shell | 45-50    | overridden to add the banner button                |
| `PanelMenu.Button`, `PopupMenu.PopupMenuItem`       | gnome-shell | 45-50    | indicator and menu                                 |
| `PopupMenu.PopupMenu`, `PopupMenuManager`, `St.Side` | gnome-shell | 45-50   | floating preset menu anchored to the mute button   |
| `GLib.timeout_add_seconds`, `get_monotonic_time`    | glib        | 45-50    | mute timer and countdown                           |

The on-screen banner (`MessageTray._banner`) is a `Message` subclass on every
version (`NotificationBanner -> Calendar.NotificationMessage -> Message` on
45-49, `MessageList.NotificationMessage -> Message` on 50). `lib/bannerControl.js`
adds one `mute` `St.Button` to the banner's vertical content column (the
`message-content` box), reached as the parent of the body widget — `_bodyBin` on
46-50, `_bodyStack` on 45 — so the button lands under the text rather than in the
`_mediaControls` row to the right. The button is added with `add_child` (a
`Clutter.Actor` method on all versions — gnome-45's own banner code uses the
legacy `add_actor` alias). The content column is feature-detected in
`BannerControl` as a guard against future banner-structure changes. The
triggering `Notification` is read from `MessageTray._notification` (set on all
versions) rather than a banner widget field.

## Suppression model

Verified against `js/ui/messageTray.js` (gnome-50):

- `_updateState` returns early when `_bannerBlocked` is true, so setting it
  suppresses all banners, including `CRITICAL`. The notification queue is not
  cleared; items accumulate.
- `panel.js` writes `Main.messageTray.bannerBlocked = isOpen` when the
  notification list opens/closes (`js/ui/panel.js:749`). The controller redefines
  the `bannerBlocked` setter so external writes are remembered but do not lift the
  mute while it is active (effective = mute OR real). This is the same guard
  pattern as `notification-banner`'s `bannerAlignment` guard.
- Releasing the mute clears the block and runs `_updateState`, which flushes the
  queue. The queue holds at most 3 non-critical (`MAX_NOTIFICATIONS_IN_QUEUE`,
  `js/ui/messageTray.js:24`) plus all critical.

### Returning the triggering banner to the burst

When mute starts from a banner's mute button, `MuteController._requeueTriggeringBanner`
puts that banner's notification back into the burst. It is version-independent:

- While blocked, `_updateState` early-returns, so the shown banner is only hidden
  (`visible = false`) and its notification survives the whole mute — even if
  transient (it never reaches `_hideNotificationCompleted`).
- But it stays the tray's `_notification` (state `SHOWN`); on release a
  non-`CRITICAL` banner would close as expired and, being `acknowledged`, would
  not re-enter the queue. So the controller detaches it: tears down the `_banner`
  widget (replicating `_hideNotificationCompleted` minus the transient-destroy),
  sets `_notification = null` / `_notificationState = State.HIDDEN`, clears
  `acknowledged`, and pushes the notification onto `_notificationQueue`.
- Signals are not used for this: GNOME 46+ re-emits `notification-request-banner`
  on clearing `acknowledged`, but GNOME 45 does not (`notify::acknowledged` only
  calls `countUpdated`). Direct queue manipulation is the common path; the
  `includes()` guard avoids a duplicate when 46+ also pushes.
- `State.HIDDEN === 0` is exported as `State` from `js/ui/messageTray.js` and is
  stable across 45-50; `muteController.js` uses the literal to stay import-pure
  for the gjs unit tests.

## Signal handling

Signals on objects the extension owns use a plain `.connect()`: `PopupMenuItem`s
and the mute `St.Button`. Their handlers are released when the owner is destroyed
(`menu.removeAll()` / `menu.destroy()`; `BannerControl.destroy()` destroys the
button), the same as `wayland-paste`'s indicator.

The one signal on a foreign object — the banner's `destroy` — follows the
`connectObject(signal, handler, this)` / `disconnectObject(this)` convention used
across the other extensions (e.g. `notification-banner` connects a notification
source's `destroy` the same way). `BannerControl` keys it on itself so
`destroy()` drops it with a single `this._banner?.disconnectObject(this)`, which
is a no-op if the banner is already being torn down. The floating menu lives in
`Main.uiGroup` (not under the banner), so it is destroyed explicitly.

The mute mechanism itself uses no signals — it redefines a property descriptor,
drives GLib timers, and manipulates the tray's notification queue directly, all
undone in `disable()`/`uninstall()`.

## Procedure: verify against a GNOME version

Upstream sources are checked out locally with `gnome-45` … `gnome-50` branches at
`/home/vyt/devel/gnome/gnome-shell`. Use `git grep <ref>` without switching trees:

```sh
cd /home/vyt/devel/gnome/gnome-shell
for v in 45 46 47 48 49 50; do
  echo "=== gnome-$v ==="
  git grep -nE 'set bannerBlocked|_bannerBlocked|_updateState' origin/gnome-$v -- js/ui/messageTray.js | head
done
# panel reset of bannerBlocked
git grep -n 'bannerBlocked = ' origin/gnome-50 -- js/ui/panel.js
# banner media-control API
for v in 45 46 47 48 49 50; do
  echo "=== gnome-$v ==="
  git grep -nE 'addMediaControl' origin/gnome-$v -- js/ui/messageList.js | head
done
```

## Syntax check

```sh
node --check extension.js
node --check lib/muteController.js
node --check lib/indicator.js
node --check lib/bannerControl.js
```

## Unit tests

`muteController.js` is pure logic (imports only `gi://GLib`) and is unit-tested
under `gjs`, the interpreter that runs the extension (see ADR 0007). Run:

```sh
tests/run.sh
```

`tests/run.sh` executes every `tests/*.test.js` with `gjs -m` and fails if any
file exits non-zero. The tests use a fake tray and a small in-file `check()`
helper, with no Node toolchain and no GNOME platform mocking.

## Packaging

```sh
gnome-extensions pack --force --extra-source=lib .
```

`--extra-source=lib` is required: `gnome-extensions pack` bundles only a fixed
default set and does not recurse into `lib/`, so without it the archive omits the
imported `lib/*.js` and the installed extension fails to load (see ADR 0013). Any
new top-level directory holding imported modules must be added the same way.

## Manual testing

1. Symlink the repo into `~/.local/share/gnome-shell/extensions/`.
2. Restart GNOME Shell and `gnome-extensions enable mute-banners-timer@VitalyOstanin`.
3. From the indicator pick "1 min"; `notify-send` normal and critical — neither
   pops up.
4. Open/close the notification list during the mute — the block is kept.
5. Confirm the countdown and "Unmute now"; confirm the release burst.
6. With a banner on screen, click its "mute" button (under the text), pick a
   preset, and confirm the mute starts immediately and the banner closes.
7. Confirm the muted banner returns in the release burst — test both a
   non-`CRITICAL` and a `CRITICAL` triggering notification, and a transient one.
8. Disable during an active mute; confirm clean restore and no journal errors.
9. Check `journalctl -b /usr/bin/gnome-shell -p warning`.

## Files

- `extension.js` — lifecycle, indicator wiring, `_showNotification` override for
  the banner button.
- `lib/muteController.js` — the suppression mechanism (bannerBlocked guard,
  timer, triggering-banner requeue).
- `lib/indicator.js` — the panel indicator and its menu.
- `lib/bannerControl.js` — the on-banner "mute" button and its preset menu.
- `stylesheet.css` — styling for the on-banner text button and indicator colours.
- `tests/` — gjs unit tests for `muteController.js`.
- `docs/ADR/` — architecture decision records.
