# 0011 - Indicator state colors as fixed Adwaita literals

Status: Accepted

## Context

The panel indicator recolours its bell glyph by state: green when idle, red when
muted (`stylesheet.css`, classes `.mbt-icon-idle` / `.mbt-icon-muted`). The two
colours are written as hex literals `#2ec27e` (idle) and `#e01b24` (muted).

A review flagged this as a hardcoded value that should reference theme tokens so
it follows the active shell theme and a light/dark variant. We investigated
whether St (the shell's CSS-styled widget toolkit) can reference theme colour
tokens from an extension stylesheet on the supported range GNOME 45-50:

- St parses CSS through bundled **libcroco** (`src/st/croco/`), a CSS 2.1-era
  parser. It does not implement CSS Custom Properties, so `var(--token)` does not
  resolve in an extension stylesheet on any of 45-50.
- The shell theme's semantic colours (`$success_color`, `$error_color`) are
  **SASS** variables. They are compiled into static values inside the shipped
  `gnome-shell.css` and are not exposed as runtime-resolvable tokens an extension
  could reference.
- The only St-specific colour extension, `-st-accent-color`, was introduced with
  system accent colours in GNOME 47 (`src/st/st-theme-context.c`). It is absent
  on 45-46 and means "accent", not the idle/muted success/error semantics we need.

The chosen literals are not arbitrary: `#2ec27e` is Adwaita `$green_4`, the light
variant of `$success_color`; `#e01b24` is Adwaita `$red_3`, the light variant of
`$error_color` (`gnome-shell-sass/_palette.scss`, `_default-colors.scss`). The
dark variants (`#26a269` / `#c01c28`) are not tracked, so the colours do not
switch between light and dark.

## Decision

Keep the two state colours as fixed Adwaita literals in `stylesheet.css` and do
not introduce a token indirection or a JS-driven light/dark switch. There is no
portable theme-token mechanism available to an extension stylesheet across
45-50, and a JS color-scheme switch would still store the dark values as literals
for marginal benefit.

## Consequences

- The idle/muted colours stay the light-variant Adwaita success/error hues
  regardless of the active theme or light/dark preference. This is accepted as a
  platform limitation, not an oversight.
- The values are kept together in `stylesheet.css` so they are not scattered. If
  GNOME later exposes resolvable semantic tokens to extension CSS across the
  supported range, this decision should be revisited.
