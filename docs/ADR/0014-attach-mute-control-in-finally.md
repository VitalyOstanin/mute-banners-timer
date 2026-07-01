# 0014 - Attach the mute control in a `finally`, resilient to a co-installed wrapper

Status: Accepted

## Context

The mute control is attached from the `_showNotification` override, after
`original.apply(this, args)` builds the banner. When another extension also wraps
`_showNotification` and throws in its own post-show hook, that exception
propagates before `_addBannerControl` runs, so the banner is shown without the
mute control.

This was observed on GNOME 50 with `notification-banner` co-installed: its
decorator threw during screen unlock (a stale override reading nulled settings),
and the banner appeared without the mute control as a side effect.

## Decision

Wrap `original.apply` in `try/finally` and attach the control in the `finally`, so
it is added even when an inner wrapper throws. The neighbour's exception is not
swallowed — `finally` lets it keep propagating to be logged.

## Consequences

- The mute control is attached to every shown banner regardless of a co-installed
  `_showNotification` wrapper's failure, which is the extension's core promise.
- It does not prevent GNOME's message-tray freeze if the neighbour throws inside
  `_updateState` (the exception still propagates, and `_updateState`'s reentrancy
  guard lacks a `try/finally`); that is addressed by fixing the throwing
  extension, not here.
- The `try/finally` is a targeted measure for a known failure mode (a co-installed
  wrapper throwing after the banner is built), not a blind guard.
