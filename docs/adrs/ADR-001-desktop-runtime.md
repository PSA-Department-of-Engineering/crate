# ADR-001: Standalone Electron Desktop Runtime with ContextBridge IPC

## Status
Accepted

## Context
Crate requires direct, low-latency access to local filesystem files (MP3/FLAC decoding, binary ID3 tag writeback, directory traversal, and removable storage discovery). Web browsers restrict arbitrary filesystem writes and device volume enumeration for security reasons. We evaluated Electron vs. Tauri vs. native WPF/.NET.

## Decision
We chose Electron (Node.js main process + Chromium renderer) paired with Vite, React 18, and TypeScript.
1. **Context Isolation**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` are strictly enforced.
2. **ContextBridge API**: All native operations are exposed across the process boundary through a typed API (`window.crateBridge`).
3. **Web Fallback**: The same frontend codebase compiles to a static web build hosted on the Foundry platform (`crate.chaos-architect.dev`) that provides honest desktop download guidance.

## Consequences
- **Positive**: Cross-platform ready, mature audio decoding ecosystem, robust multi-window support for player undocking, strong security boundary.
- **Negative**: Higher memory footprint compared to native binaries, but well within modern desktop budgets (<150 MB RAM).
