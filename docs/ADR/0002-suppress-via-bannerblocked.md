# 0002 - Suppress banners via `bannerBlocked`

Status: Accepted

## Context

GNOME's built-in "Do Not Disturb" does not suppress `CRITICAL`: the message tray
has an explicit exception (`notification.urgency !== Urgency.CRITICAL` in
`_onNotificationRequestBanner`, `js/ui/messageTray.js`). A timed mute must cover
critical too.

`MessageTray` already has a lower-level block: `_updateState` returns early when
`_bannerBlocked` is true, which suppresses all banners including critical and
keeps the queue intact.

## Decision

Drive suppression through `_bannerBlocked` rather than overriding `_updateState`
or rewriting method bodies. Engaging mute sets the effective block; releasing it
clears the block and runs `_updateState`, which flushes the accumulated queue.

## Consequences

- Reuses GNOME's intended suppression path; no method-body patching.
- Depends on the `bannerBlocked` accessor / `_bannerBlocked` field and
  `_updateState`, verified present 45-50.
- Requires a guard against external writers (see ADR 0003).
