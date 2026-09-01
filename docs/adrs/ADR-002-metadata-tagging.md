# ADR-002: Direct In-File Audio Metadata Tagging

## Status
Accepted

## Context
Users demand tag edits that reflect immediately inside their audio files on disk (ID3v2.3/ID3v2.4 for MP3 and Vorbis comment blocks for FLAC) rather than being trapped in an isolated database cache. Furthermore, privacy and air-gap requirements (`REQ-TAG-003`) forbid automatic online metadata scrapers or cloud telemetry.

## Decision
1. Perform in-place binary tag parsing and updates directly on local audio files.
2. For MP3 files, read and write standard ID3v2.3/ID3v2.4 frames (`TIT2`, `TPE1`, `TALB`, `TRCK`, `TYER`, `TCON`, `APIC`).
3. For FLAC files, parse and update native Vorbis comments and METADATA_BLOCK_PICTURE blocks without touching audio stream frames.
4. Support embedded artwork extraction (returning data URI strings) and replacement (writing JPEG/PNG buffers).
5. All operations run strictly local and offline.

## Consequences
- **Positive**: Direct file portability to car stereos, home DACs, and other media players. Complete data privacy.
- **Negative**: File writing must be handled carefully to avoid file truncation on unexpected power loss or disk full conditions.
