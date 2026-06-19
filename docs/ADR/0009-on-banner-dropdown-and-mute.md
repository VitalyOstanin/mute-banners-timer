# 0009 - On-banner mute button with a preset dropdown

Status: Accepted (supersedes the single-icon banner control and the
dropdown-plus-Mute two-button variant)

## Context

The first design put a single media-control icon on each banner that opened the
indicator menu. A second design split the interaction into a duration dropdown
plus a separate "Mute" button in the `_mediaControls` row. Both placed the
control to the right of the text, and the two-button variant needed two clicks
(pick, then commit) for a deliberately quick "silence this now" action.

## Decision

Add a single `St.Button` labelled `mute` to the banner, placed in the vertical
content column under the body text rather than in the `_mediaControls` row to the
right (`lib/bannerControl.js`):

1. Clicking the button opens a floating `PopupMenu` of presets anchored to it.
2. Selecting a preset starts the mute immediately for that duration and dismisses
   the banner — one interaction, not two.

The preset menu is hosted in `Main.uiGroup`, anchored to the button, so opening
it never changes the banner's height. The indicator keeps its own menu.

## Consequences

- The button is appended to the content column, reached as the parent of the
  body widget (`_bodyBin` on GNOME 46-50, `_bodyStack` on 45). The column is a
  vertical `St.BoxLayout` on all of them, so the button lands under the text. The
  column is feature-detected; if absent, the panel indicator remains.
- Adding the button to a banner child grows the banner height by one row — this
  is intended (the control sits under the text). The menu still floats outside
  the banner, so opening it does not add further height.
- The floating menu lives outside the banner, so `BannerControl` must destroy it
  explicitly on the banner's `destroy` signal.
- Text in a media-control-styled button needs extra CSS (`stylesheet.css`) since
  the shell styles those buttons for icons.
