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
