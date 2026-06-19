# 0008 - Persist the chosen duration via GSettings

Status: Superseded by ADR 0009 (duration no longer persisted)

## Why superseded

The persisted value existed only to pre-select a duration in the on-banner
dropdown. ADR 0009 replaced that dropdown with a single `mute` button whose menu
starts the mute on selection, and the panel menu lists all presets directly.
Nothing reads `last-duration` any more, so the key, its schema, the
`settings-schema` entry in `metadata.json`, and the `getSettings()` call were
removed. The original decision is kept below for the record.

## Context

The duration the user last chose should be the pre-selected value in both the
on-banner dropdown and the panel menu, and it should survive a GNOME restart or
relog. An in-memory field is lost on `disable()`/`enable()` and across sessions.
The preset set itself stays fixed in code; only the last-chosen value needs to
persist.

## Decision

Store the last chosen duration in GSettings under
`org.gnome.shell.extensions.mute-banners-timer`, key `last-duration` (integer
minutes, default 1, range 1-60). The schema ships in `schemas/`; `metadata.json`
declares `settings-schema`; the extension reads it via `getSettings()`.

## Consequences

- Persists across sessions with no custom file I/O; `gnome-extensions pack`
  compiles the schema and `glib-compile-schemas` validates it.
- Supersedes the earlier "no GSettings (YAGNI)" stance once persistence became a
  requirement.
- Adds a build/packaging step (the schema must be compiled where the extension is
  installed).
