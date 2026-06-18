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
| `Extension`, `InjectionManager`, `getSettings()`    | gnome-shell | 45-50    | `js/extensions/extension.js`; GSettings access     |
| `Main.messageTray`, `Main.panel.addToStatusArea`    | gnome-shell | 45-50    | singletons, `js/ui/main.js`                        |
| `Main.uiGroup`                                       | gnome-shell | 45-50    | host for the floating banner dropdown menu         |
| `MessageTray.prototype` `bannerBlocked` accessor    | gnome-shell | 45-50    | setter redefined to guard the block                |
| `MessageTray._bannerBlocked` / `_updateState`       | gnome-shell | 45-50    | private block field and state machine entry        |
| `MessageTray._notification` / `_notificationQueue`  | gnome-shell | 45-50    | current banner + queue; used by the requeue path   |
| `MessageTray._banner` / `_bannerBin`, `_notificationState` | gnome-shell | 45-50 | torn down in the requeue path (`State.HIDDEN`)    |
| `Notification.acknowledged`                          | gnome-shell | 45-50    | cleared so a requeued notification is not filtered |
| `Message._mediaControls` (St.BoxLayout)             | gnome-shell | 45-50    | row for custom controls (`js/ui/messageList.js`)   |
| `MessageTray.prototype._showNotification`           | gnome-shell | 45-50    | overridden to add the banner controls              |
| `PanelMenu.Button`, `PopupMenu.PopupMenuItem`       | gnome-shell | 45-50    | indicator and menu                                 |
| `PopupMenu.PopupMenu`, `PopupMenuManager`, `St.Side` | gnome-shell | 45-50   | floating preset menu anchored to the dropdown      |
| `GLib.timeout_add_seconds`, `get_monotonic_time`    | glib        | 45-50    | mute timer and countdown                           |

The on-screen banner (`MessageTray._banner`) is a `Message` subclass on every
version (`NotificationBanner -> Calendar.NotificationMessage -> Message` on
45-49, `MessageList.NotificationMessage -> Message` on 50), so its
`_mediaControls` row exists throughout; `lib/bannerControl.js` adds two custom
`St.Button` widgets to it with `add_child` (a `Clutter.Actor` method on all
versions — gnome-45's own banner code uses the legacy `add_actor` alias). The row
is feature-detected in `_addBannerControl` as a guard against future
banner-structure changes. The triggering `Notification` is read from
`MessageTray._notification` (set on all versions) rather than a banner widget
field.

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

When mute starts from a banner's Mute button, `MuteController._requeueTriggeringBanner`
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

The extension connects signals only to objects it creates and owns —
`PopupMenuItem`s, the dropdown/Mute `St.Button`s, and each banner's `destroy`
signal (so `BannerControl` tears down its floating menu, which lives in
`Main.uiGroup` rather than under the banner). The menus destroy their items on
`removeAll()` / `destroy()`, so handlers are released with their emitters. There
is no connection to a long-lived object from a short-lived owner, so
`connectObject`/`disconnectObject` brings no benefit here (same situation as
`wayland-paste`). The mute mechanism itself uses no signals — it redefines a
property descriptor, drives GLib timers, and manipulates the tray's notification
queue directly, all undone in `disable()`/`uninstall()`.

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

## Manual testing

1. Symlink the repo into `~/.local/share/gnome-shell/extensions/`.
2. Restart GNOME Shell and `gnome-extensions enable mute-banners-timer@VitalyOstanin`.
3. From the indicator pick "1 min"; `notify-send` normal and critical — neither
   pops up.
4. Open/close the notification list during the mute — the block is kept.
5. Confirm the countdown and "Unmute now"; confirm the release burst.
6. With a banner on screen, change the duration in its dropdown (confirm it does
   NOT start muting and persists across a relog) and then click Mute (confirm the
   banner closes immediately).
7. Confirm the muted banner returns in the release burst — test both a
   non-`CRITICAL` and a `CRITICAL` triggering notification, and a transient one.
8. Disable during an active mute; confirm clean restore and no journal errors.
9. Check `journalctl -b /usr/bin/gnome-shell -p warning`.

## Files

- `extension.js` — lifecycle, indicator wiring, `_showNotification` override for
  the banner controls.
- `lib/muteController.js` — the suppression mechanism (bannerBlocked guard,
  timer, triggering-banner requeue).
- `lib/indicator.js` — the panel indicator and its menu.
- `lib/bannerControl.js` — the on-banner duration dropdown and Mute button.
- `schemas/` — GSettings schema for the persisted `last-duration`.
- `stylesheet.css` — styling for the on-banner text controls.
- `tests/` — gjs unit tests for `muteController.js`.
- `docs/ADR/` — architecture decision records.
