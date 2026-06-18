# 0009 - On-banner duration dropdown and Mute button

Status: Accepted (supersedes the single-icon banner control)

## Context

The first design put a single media-control icon on each banner that opened the
indicator menu. The intended interaction is: from an ill-timed banner, choose a
duration and silence banners in two distinct steps — pick the value, then commit.
`addMediaControl` only yields an icon button, which cannot show the current value
or separate "pick" from "commit".

## Decision

Add two custom `St.Button` widgets directly to the banner's `_mediaControls` row
(`lib/bannerControl.js`):

1. A duration dropdown labelled with the persisted `last-duration`. Clicking it
   opens a floating `PopupMenu` of presets anchored to the button. Selecting a
   preset only updates the label and persists the value (ADR 0008); it does not
   start the mute.
2. A "Mute" button that starts the mute for the shown duration and dismisses the
   banner.

The preset menu is hosted in `Main.uiGroup`, anchored to the dropdown, so opening
it never changes the banner's height. The indicator keeps only its own menu (no
separate Mute button there).

## Consequences

- `_mediaControls` (an `St.BoxLayout` on the `Message` base class) is used
  instead of `addMediaControl`; it exists across GNOME 45-50, and `add_child`
  works on all of them. The row is feature-detected.
- The floating menu lives outside the banner, so `BannerControl` must destroy it
  explicitly on the banner's `destroy` signal.
- Text in a media-control button needs extra CSS (`stylesheet.css`) since the
  shell styles those buttons for icons.
