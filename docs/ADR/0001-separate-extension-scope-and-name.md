# 0001 - Separate extension, scope and name

Status: Accepted

## Context

`notification-banner` covers banner position, content and appearance; its scope
is "how the banner looks and where it sits", and it leaves notification behavior
unchanged. Timed muting of all banners (including critical) is a behavioral,
stateful feature (active/inactive mode, a timer, a deferred burst), a different
axis from styling.

## Decision

Ship a separate extension `mute-banners-timer@VitalyOstanin` ("Mute Banners
Timer") rather than extending `notification-banner`. Reactive entry from a banner
control plus proactive entry from a persistent panel indicator; preset durations
1, 2, 3, 5, 10, 15, 20, 30, 60 minutes, fixed in code (no GSettings).

## Consequences

- Clear separation of responsibility; `notification-banner` keeps its narrow
  scope.
- A second repository and e.g.o submission to maintain.
