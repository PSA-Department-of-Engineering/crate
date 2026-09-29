---
title: "Technical Reference"
type: Reference
summary: "Crate architecture, components, and design parameters."
---

## Shipped artifacts

- **Desktop application**: Standalone Electron app packaged as portable and installer Windows binaries. The installer build updates itself from Crate's public GitHub releases; the portable build does not.
- **Web distribution portal**: Static distribution portal served by Nginx displaying honest download guidance.
- **Documentation site**: This Starlight documentation site served at /apps/crate.

## Component overview

- src/ - React frontend UI components, SAM viewmodels, and Tailwind styling.
- lectron/ - Electron main process, IPC ContextBridge handlers, metadata engines, and USB volume scanner.
- 	ests/ - Vitest suites verifying CSD-INTENT-01 claims.
- docs/ - Starlight documentation and architectural decision records.
