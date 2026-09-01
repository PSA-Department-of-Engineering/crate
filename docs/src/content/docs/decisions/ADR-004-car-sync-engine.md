---
title: "ADR-004: Incremental Delta Car Synchronization Engine"
type: Reference
summary: "ADR-004: Incremental Delta Car Synchronization Engine"
---

## Status
Accepted

## Context
Full library recopies to USB flash drives or SD cards can take hours over USB 2.0/3.0 interfaces. Users require fast, incremental updates when adding new albums or editing existing tags. Furthermore, deleted or deselected tracks left behind on the car drive cause confusing ghost albums and fragmented playlists.

## Decision
1. Implement a delta synchronization engine comparing source file attributes (relative target path, file size, modification time `mtime`) against destination disk contents.
2. Only copy files that are missing or have different size/mtime attributes.
3. Scan destination USB drive to detect stale files (audio files present on the drive that are not part of the active sync scope).
4. Present a clear sync plan diff (items to add, items to update, items to delete) and allow one-click stale file pruning.

## Consequences
- **Positive**: Reduces repeat sync times from 30+ minutes to under 5 seconds for typical incremental updates. Prevents disk bloat on removable media.
- **Negative**: Requires scanning the destination directory structure prior to file copying.

