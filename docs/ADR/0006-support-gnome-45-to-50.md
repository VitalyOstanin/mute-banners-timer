# 0006 - Support GNOME 45-50

Status: Accepted

## Context

The extension targets the currently maintained GNOME Shell line. Three surfaces
must hold across the declared versions: the suppression mechanism
(`bannerBlocked` / `_bannerBlocked` / `_updateState`), the panel indicator
(`PanelMenu`, `PopupMenu`), and the on-banner control (`Message.addMediaControl`).

An earlier assumption held that the on-banner control required GNOME 46+, on the
theory that GNOME 45's on-screen banner did not inherit the `Message` class that
defines `addMediaControl`. That assumption was wrong. Verified against the
upstream branches at `/home/vyt/devel/gnome/gnome-shell`:

- `addMediaControl` is defined on `Message extends St.Button`
  (`js/ui/messageList.js`, line 446 on gnome-45) on every version 45-50.
- `MessageTray._banner` inherits `Message` on every version: via
  `NotificationBanner extends Calendar.NotificationMessage extends
  MessageList.Message` on 45, `Calendar.NotificationMessage` on 46-49, and
  `MessageList.NotificationMessage` on 50.

So the on-banner control is available on 45 as well; only the way the banner
object is constructed differs by version, not its `Message` ancestry.

## Decision

Declare `shell-version` 45-50. The mechanism, the panel indicator, and the
on-banner control work on all of them. Adapt with feature detection rather than
version-number branching: the on-banner control is added only when the banner
exposes `addMediaControl` (`typeof banner.addMediaControl === "function"`).
Record any future incompatibility in a new ADR.

## Consequences

- A single compatibility tier across 45-50; no degraded mode on any declared
  version.
- The feature-detection guard still protects against a future banner-structure
  change: if `addMediaControl` ever disappears, the extension degrades to the
  panel indicator instead of throwing.
