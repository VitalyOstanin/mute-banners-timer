# 0010 - Return the triggering banner to the release burst

Status: Accepted (mechanism pending live validation)

## Context

When the user starts the mute from a banner's Mute button, that banner should
reappear in the release burst rather than be lost. While blocked, `_updateState`
early-returns, so the shown banner is only hidden and its notification survives —
but it stays the tray's `_notification` (state `SHOWN`). On release a
non-`CRITICAL` banner would close as expired and, being `acknowledged`, would not
re-enter the queue, so it would vanish from the burst.

Signals cannot drive this portably: GNOME 46+ re-emits
`notification-request-banner` when `acknowledged` is cleared, but GNOME 45's
`notify::acknowledged` only calls `countUpdated`.

## Decision

`MuteController._requeueTriggeringBanner` detaches the triggering banner into the
queue by direct state manipulation, after the block is active:

- Tear down the `_banner` widget without destroying its notification (replicating
  `_hideNotificationCompleted` minus the transient-destroy); set
  `_notification = null`, `_notificationState = State.HIDDEN` (== 0, exported and
  stable across 45-50), and cancel the banner's auto-hide timers.
- Clear `acknowledged` (both versions filter acknowledged notifications out of the
  queue) and push the notification onto `_notificationQueue`, with an
  `includes()` guard so a 46+ auto-push is not duplicated.

`State.HIDDEN` is used as a literal so `muteController.js` stays import-pure
(`gi://GLib` only) for the gjs unit tests.

## Consequences

- Version-independent and deterministic in static analysis across GNOME 45-50.
- Reaches into private `MessageTray` fields; their names are stable across the
  supported versions but are not API. Residual runtime edge cases (focus grab,
  idle-active watch, animation interplay) are confirmed in the live functional
  run, not by unit tests.
- The triggering banner is always requeued regardless of per-source banner policy,
  which is the intended behaviour (the user explicitly acted on that banner).
