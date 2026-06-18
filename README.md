# Mute Banners Timer

A GNOME Shell extension that temporarily mutes all notification banners,
including `CRITICAL` ones, for a chosen number of minutes. Missed notifications
accumulate in GNOME's queue and pop up as a burst when the timer ends.

## Table of Contents

- [What it does](#what-it-does)
- [How to use](#how-to-use)
- [Why it also mutes critical](#why-it-also-mutes-critical)
- [Compatibility](#compatibility)
- [Installation](#installation)
- [How it works](#how-it-works)
- [Limitations](#limitations)
- [License](#license)

## What it does

- Mutes every notification banner (including `CRITICAL`) for a preset number of
  minutes: 1, 2, 3, 5, 10, 15, 20, 30, 60.
- During the mute window no banner pops up; notifications still go to the
  notification list (the calendar drop-down).
- When the window ends — by timer or early via "Show now" — the accumulated
  notifications pop up as a burst.

## How to use

- Reactively, from an ill-timed banner: its header carries a duration dropdown
  (showing the last chosen duration) and a **Mute** button. Pick a preset in the
  dropdown to change the duration, then click **Mute** to silence banners for that
  duration. The banner closes and rejoins the release burst.
- Proactively, from the panel indicator: open its menu and pick a duration to
  start muting straight away.
- The chosen duration persists across GNOME sessions (GSettings), so the dropdown
  and the indicator menu reopen on the value you used last.
- While muting, the panel indicator shows the remaining time and a "Show now"
  action that ends the mute and releases the burst immediately.

## Why it also mutes critical

GNOME's built-in "Do Not Disturb" does not suppress `CRITICAL` notifications: the
message tray has an explicit exception for them. This extension blocks banners at
a lower level (`MessageTray.bannerBlocked`), which covers `CRITICAL` too.

## Compatibility

GNOME Shell 45–50. The suppression mechanism, the panel indicator, and the
on-banner control all work across these versions.

The extension does not patch the bodies of GNOME methods; it redefines the
`bannerBlocked` setter accessor and decorates each banner after GNOME creates it.
The on-banner controls are still feature-detected (they are added only if the
banner exposes the `_mediaControls` row), so a future shell that changes the
banner structure degrades to the panel indicator instead of breaking.

## Installation

### From source

```sh
git clone https://github.com/VitalyOstanin/mute-banners-timer.git
ln -s "$(pwd)/mute-banners-timer" \
  ~/.local/share/gnome-shell/extensions/mute-banners-timer@VitalyOstanin
# Compile the GSettings schema for the symlinked install:
glib-compile-schemas "$(pwd)/mute-banners-timer/schemas/"
```

Restart GNOME Shell (X11: `Alt+F2`, `r`, Enter; Wayland: re-login), then:

```sh
gnome-extensions enable mute-banners-timer@VitalyOstanin
```

## How it works

- `enable()` locates `Main.messageTray`, installs the mute controller (which
  redefines the `bannerBlocked` setter on the `MessageTray` prototype), and adds
  a panel indicator. It also overrides `_showNotification` to add the on-banner
  controls (a duration dropdown and a Mute button) to each banner.
- Engaging mute sets the tray's block and starts a GLib timer. GNOME's queue
  accumulates the missed notifications.
- When mute is started from a banner's Mute button, that banner is detached back
  into the queue (without destroying its notification) so it returns in the
  release burst rather than being lost.
- The `bannerBlocked` guard keeps the block while `panel.js` toggles
  `bannerBlocked` on opening/closing the notification list.
- Ending the mute (timer or "Show now") clears the block and lets GNOME flush the
  queue.

## Limitations

- The release burst uses GNOME's queue, which holds at most 3 non-critical
  notifications (plus all critical). Older non-critical notifications stay only in
  the notification list.
- No early cancel without releasing the burst: "Show now" both ends the mute and
  releases the accumulated notifications.

## License

[GPL-2.0-or-later](LICENSE). GNOME Shell is GPL-2.0-or-later, and extensions are
derived works that must use compatible terms.
