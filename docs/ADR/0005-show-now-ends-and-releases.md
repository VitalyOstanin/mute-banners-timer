# 0005 - "Unmute now" ends the mute and releases the burst

Status: Accepted

## Context

During a mute there is a panel indicator for feedback and early termination. Two
behaviors are possible for ending early: release the accumulated burst, or stop
muting without showing the missed banners.

## Decision

Provide a single early action, "Unmute now", that ends the mute and immediately
releases the accumulated burst — identical to natural timer expiry, only earlier.
No separate "stop without releasing" action.

## Consequences

- One predictable early-exit path consistent with the chosen burst-on-end
  behavior.
- A user who only wants to stop muting still gets the burst; this is documented.
