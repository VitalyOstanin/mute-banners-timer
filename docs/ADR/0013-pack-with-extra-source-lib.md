# 0013 - Pack with `--extra-source=lib` so `lib/` ships to e.g.o

Status: Accepted

## Context

The extension is split into modules: `extension.js` imports `./lib/muteController.js`,
`./lib/indicator.js` and `./lib/bannerControl.js`.

`gnome-extensions pack` only bundles a fixed set of entries by default —
`metadata.json`, `extension.js`, `prefs.js`, `stylesheet.css`, and the `schemas/`
and `locale/` directories. It does not recurse into arbitrary subdirectories, so
`lib/` is omitted. A plain `gnome-extensions pack` over this repository produces
an archive of three files (`metadata.json`, `stylesheet.css`, `extension.js`);
the imported `lib/*.js` modules are missing. Installed from that archive the
extension fails at import time and never loads, which the e.g.o guideline
"Extensions must be functional" rejects.

ADR 0012 stated that packaging stays the plain `gnome-extensions pack`. That is
correct for its own subject (no comment stripping, ship sources verbatim) but
incomplete for a multi-file extension: the plain command drops `lib/`.

## Decision

Pack with `lib/` added as an extra source:

```sh
gnome-extensions pack --force --extra-source=lib .
```

This still ships the sources verbatim (ADR 0012); it only adds the `lib/`
directory the default set omits. The produced archive then contains
`extension.js`, `lib/*.js`, `metadata.json` and `stylesheet.css`.

## Consequences

- The published archive contains every module the extension imports, so it loads
  after install. Verified: the extra-source pack yields the `lib/` entries
  (7 files) where the plain pack yielded 3.
- This refines the packaging command from ADR 0012 (which keeps its decision on
  not stripping comments). Any new top-level directory that holds imported
  modules must likewise be added with `--extra-source`.
- README and CLAUDE.md document the command so it is not rediscovered by a
  broken submission.
