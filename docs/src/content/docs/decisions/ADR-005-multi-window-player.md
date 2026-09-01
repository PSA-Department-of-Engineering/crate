---
title: "ADR-005: Multi-Window Audio Player Undocking via IPC State Broadcasting"
type: Reference
summary: "ADR-005: Multi-Window Audio Player Undocking via IPC State Broadcasting"
---

## Status
Accepted

## Context
When organizing large music libraries or editing tags, users frequently want to position the playback controls and now-playing album art on a secondary monitor or compact floating widget without losing their position in the library management table.

## Decision
1. Support undocking the mini-player into a lightweight, frameless secondary Electron `BrowserWindow`.
2. Maintain the primary audio playback pipeline in the main window (HTML5 Audio / Web Audio API) while transmitting state updates (track, duration, current time, isPlaying, volume, shuffle, repeat) over IPC to the secondary window.
3. IPC commands from the secondary window (`play`, `pause`, `seek`, `next`, `prev`, `volume`) are routed back to the main window controller.
4. If the secondary window is closed, the main window immediately restores its docked bottom mini-player seamlessly.

## Consequences
- **Positive**: Clean separation of playback presentation from audio decoding. Zero audio interruption during undocking/docking.
- **Negative**: Requires event synchronization across two Electron windows.

