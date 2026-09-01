---
phase: scope
skill: deliver-engagement
status: gate
gate: proposal
signed: pending
reviewed: 2026-09-01
run: 
attempt: 1
mode: interactive
started: 2026-09-01T14:43:58Z
finished: 
credential_ref: 
delivers: P1
---

> Fresh-eyes review passed 2026-09-01 (VERDICT: PASS; artifact `.delivery/reviews/proposal-2026-09-01.md`); recorded in `reviewed:`. The proposal gate awaits its signer (REF-Delivery.md section 1). Prose below predates the review.
# Proposal: Crate — Personal Music Library & Car Sync Manager

## Estimation project

- **Instance / Workspace**: `http://estimatekit.chaos-architect.dev/projects/crate`
- **Slide Deck**: `http://estimatekit.chaos-architect.dev/projects/crate/slides/`
- **BRD Workbook**: `http://estimatekit.chaos-architect.dev/api/projects/crate/outputs/output/excel/Customer_Requirements_Matrix.xlsx`
- **Estimation Workbook**: `http://estimatekit.chaos-architect.dev/api/projects/crate/outputs/output/excel/P1_Estimation.xlsx`
- **Assumptions Register**: `http://estimatekit.chaos-architect.dev/api/projects/crate/outputs/output/excel/Assumptions_Register.xlsx`
- **Architecture Guidelines**: `http://estimatekit.chaos-architect.dev/api/projects/crate/outputs/output/excel/Architecture_Guidelines.xlsx`

## Requirement spine

This line delivers **Phase 1 (P1: Core Application & Car Sync)**.

| Req ID | Category | Description | Phase |
|---|---|---|---|
| `REQ-APP-001` | Application | Windows desktop application architecture with local filesystem and removable drive access | P1 |
| `REQ-LIB-001` | Library | Music library ingestion and management supporting MP3 and FLAC formats creating managed library location | P1 |
| `REQ-LIB-002` | Library | Library browsing, sorting, and multi-field search across artist, album, album artist, year, genre, track number, and duration | P1 |
| `REQ-TAG-001` | Metadata | Direct audio metadata tag viewing and writeback (ID3 for MP3, Vorbis comments for FLAC) to local files | P1 |
| `REQ-TAG-002` | Metadata | Single-track and multi-selection batch metadata editing with embedded cover art management | P1 |
| `REQ-TAG-003` | Metadata | Strictly local and offline metadata operations without online lookups or telemetry | P1 |
| `REQ-ORG-001` | Organization | Canonical folder layout and file naming pattern matching car head unit expectations applied consistently across library | P1 |
| `REQ-ORG-002` | Organization | Verification and alignment with existing reference structure on local storage | P1 |
| `REQ-PLY-001` | Playback | Audio playback engine with queue, controls, play/pause/skip/seek, shuffle, repeat, and output device routing | P1 |
| `REQ-PLY-002` | Playback | Embedded mini-player, dedicated media player view, and undockable secondary window support | P1 |
| `REQ-PLST-001` | Playlists | Playlist creation with car-compatible .m3u export with relative paths and firmware line endings | P1 |
| `REQ-SYNC-001` | Car Sync | Removable USB/SD drive synchronization for entire library or selected playlists and albums | P1 |
| `REQ-SYNC-002` | Car Sync | Incremental delta sync copying changed files and reporting stale target files for removal | P1 |
| `REQ-DIST-001` | Distribution | Hosted web application build on Foundry hostname showing honest desktop app prerequisite state and install guidance | P1 |
| `REQ-DIST-002` | Distribution | Portable Windows desktop release with SHA-256 checksums, unrecognised-app installation guide, and no auto-updater | P1 |
| `REQ-UI-001` | Visual Design | Modern rounded visual design with pale and nude palette and emerald brand accent | P1 |

## Headline Numbers & Plan

- **Phase**: Single comprehensive phase (P1: Core Application & Car Sync)
- **Total Build Effort**: 135 MD
- **Total Project Effort**: 175 MD (15 MD Design + 125 MD Dev + 10 MD Dev Infra + 25 MD QA)
- **Delivery Timeline**: 3 Months
- **Audit Status**: Clean audit (39 passed, 0 failed, 0 suggestions)

## Key Decisions & Assumptions

- **Platform Runtime**: Standalone Electron desktop shell with secure ContextBridge preload IPC; zero elevation required (`ASM-DSK-001`).
- **Filesystem Access**: Native access to local music directory and connected removable drives (`ASM-FS-001`).
- **Tag Writeback**: Strict local parsing/writing into ID3v2 for MP3 and Vorbis comments for FLAC with zero telemetry/cloud calls (`ASM-TAG-001`, `REQ-TAG-003`).
- **Car Head Unit Compatibility**: Folder hierarchy and track naming formatted for car firmware compatibility with M3U relative playlists (`ASM-CAR-001`).
- **Playback & Output Routing**: HTML5/Web Audio engine supporting output sink device selection and detached window undocking (`ASM-AUDIO-001`).
- **Distribution Model**: Static web build served on Foundry hostname describing desktop app download, and portable Windows release with SHA-256 checksums and SmartScreen installation guidance (`ASM-DIST-001`, `REQ-DIST-001`, `REQ-DIST-002`).
- **Visual Design**: Emerald brand accent with modern nude/pale palette and rounded components (`REQ-UI-001`).
