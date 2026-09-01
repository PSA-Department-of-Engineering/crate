---
title: "ADR-003: Deterministic Car-Compatible Filesystem Layout and Sanitization"
type: Reference
summary: "ADR-003: Deterministic Car-Compatible Filesystem Layout and Sanitization"
---

## Status
Accepted

## Context
Automotive head units and infotainment systems frequently run embedded Linux or QNX kernels with strict FAT32/exFAT filesystem expectations. They fail or misbehave when encountering special punctuation (`: * ? " < > | \ /`), long paths (>260 chars), or Windows/Unix incompatible line endings in playlist files.

## Decision
1. Format all organized files according to the standard pattern:
   - Single disc: `<Artist>/<Album>/<Track#> <Title>.<ext>`
   - Multi disc: `<Artist>/<Album>/Disc <N>/<Track#> <Title>.<ext>` (or `<Artist>/<Album>/<Disc>-<Track#> <Title>.<ext>` per user preference).
2. Apply strict path sanitization: replace forbidden characters (`:`, `*`, `?`, `"`, `<`, `>`, `|`, `\`, `/`) with underscores or dashes, and strip trailing spaces and periods.
3. Export playlists as relative `.m3u` files using Windows CRLF (`\r\n`) line endings with UTF-8 encoding.

## Consequences
- **Positive**: 100% plug-and-play compatibility across BMW iDrive, Audi MMI, Ford SYNC, Mercedes MBUX, and aftermarket head units.
- **Negative**: File and folder names may have minor character substitutions (e.g. `AC/DC` -> `AC_DC`).

