# Delivery Journal — Crate

## Scope Phase (2026-09-01)
- **Sentiment**: Clear technical vision from operator on offline personal music library management, car head unit naming constraints, dual desktop/web architecture, and portable Windows distribution.
- **Decisions**: 
  - Single delivery phase (Phase 1 / P1) scoping all desktop application capabilities, tag mutation, car filesystem synchronization, and packaging.
  - Emerald brand accent color with nude/pale modern rounded UI tokens.
  - Local-first architecture: zero telemetry, offline ID3/Vorbis tag writeback, relative M3U playlists, delta copy with stale file pruning for USB/SD removable storage.
- **Lessons**: Audited Estimatekit project `crate` with 16 immutable requirements directly traced to verbatim customer request.

## Design Phase (2026-09-01)
- **Sentiment**: Customer selected the warm Emerald Cream palette with rounded modern surfaces (Nunito, 0.75rem radius).
- **Decisions**:
  - Approved Emerald Cream scheme (`hsl(160, 84%, 39%)` primary, `hsl(40, 33%, 97%)` cream background, Nunito font, 0.75rem radius) seeded from `warm-editorial` guidance.
  - Frameless Electron desktop window layout with custom non-draggable window controls and draggable header region across all application screens.
  - Four core desktop views prototyped and validated: Library (data table + mini player), Tag Editor (album-grouped metadata + cover art drop), Player (dedicated full-view media player with device routing), and Car Sync (USB delta sync + stale track pruning).
  - Committed deterministic brand wordmark asset at `docs/logo.svg`.
- **Lessons**: Fresh-context adversarial review identified the need for explicit frameless OS window controls, custom scrollbar tokens, and strict gradient restraint per `warm-editorial` guidance, which were all directly integrated into the prototype screens.
