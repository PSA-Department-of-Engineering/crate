---
title: "Architecture Target"
type: Reference
summary: "Architectural overview and boundary enforcement."
---

## Process Architecture

Crate enforces strict process boundary isolation between Electron main and renderer:
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Typed IPC through `window.crateBridge`

## Library and Artwork Data

The library database in Electron's user-data directory stores track metadata,
file sizes, and modification times. Audio scans keep artwork extraction
disabled so cached-library startup stays fast.

Artwork is resolved through the main-process metadata service only for visible
mosaic cards, then cached in memory and in a bounded user-data artwork cache.
The renderer receives one representative image per album rather than a full
base64 image on every track row. Audio and sidecar-image signatures invalidate
stale artwork automatically.

The artist and album cover editor accepts local PNG, JPG/JPEG, SVG, WebP, GIF,
and BMP files or HTTP(S) image URLs. URLs are downloaded by the main process;
the renderer provides drag-to-crop and zoom controls, then rasterizes the
result to a 500x500 JPEG below the 500 KB automotive artwork limit. Saving an
artist cover embeds that image into every track by the artist; saving an album
cover does the same for that album. This keeps the cover durable in the audio
files themselves and makes it available to car sync without a dependency on
the original image or URL. Batch tag responses omit repeated artwork payloads
to avoid multiplying image memory for large artists.
