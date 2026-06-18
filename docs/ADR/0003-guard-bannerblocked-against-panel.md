# 0003 - Guard `bannerBlocked` against panel.js

Status: Accepted

## Context

`js/ui/panel.js` writes `Main.messageTray.bannerBlocked = isOpen` when the
notification list opens/closes (`js/ui/panel.js:749`). Closing it during a mute
would write `false` and lift the block early.

## Decision

Redefine the `bannerBlocked` setter on the `MessageTray` prototype in
`install()`. The setter records the external (real) value in a shadow field and
sets the effective `_bannerBlocked` to `mute active OR real`. While mute is
active, external `false` writes cannot lift the block. `uninstall()` restores the
original descriptor and recomputes from the real value.

This is the same accessor-guard pattern used by `notification-banner` (its ADR
0002 for `bannerAlignment`). It depends only on the `bannerBlocked` accessor
existing, not on `panel.js` internals such as `_updatePanel`.

## Consequences

- The mute survives opening/closing the notification list.
- One private field (`_bannerBlocked`) and two extension-owned instance fields
  (`_muteBannersActive`, `_realBannerBlocked`) are involved; all are cleaned up
  on `uninstall()`.
