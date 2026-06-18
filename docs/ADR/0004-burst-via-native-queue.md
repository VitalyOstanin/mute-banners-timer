# 0004 - Release burst via the native queue

Status: Accepted

## Context

On release the accumulated notifications should pop up as a burst. GNOME's queue
caps non-critical at three (`MAX_NOTIFICATIONS_IN_QUEUE = 3`,
`js/ui/messageTray.js:24`) and exempts critical. Showing strictly every missed
notification would require an own interception queue and re-injection, tracking
withdrawn/closed notifications by hand.

## Decision

Rely on GNOME's native queue. On release at most 3 recent non-critical plus all
critical pop up; older non-critical remain in the notification list.

## Consequences

- Simpler and more robust: GNOME removes withdrawn/closed notifications from its
  own queue.
- The burst is bounded; this is documented as a limitation.
