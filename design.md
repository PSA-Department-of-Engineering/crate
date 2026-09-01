---
phase: design
skill: design-session
status: complete
gate: design
signed: 2026-09-01
reviewed: 2026-09-01
run: 
attempt: 1
mode: interactive
started: 2026-09-01T18:16:45Z
finished: 2026-09-01T18:16:45Z
credential_ref: protopane (from environment)
---

> Gate closed: design signed 2026-09-01 by Carter over a passing fresh-eyes review (REF-Delivery.md section 1; artifact `.delivery/reviews/design-2026-09-01.md`). Prose below predates the closure; the frontmatter is the gate.

# Design - crate

The design phase's record: the locked visual identity, the one design artifact that survives (REF-Delivery.md section 3). The design phase locks it here in the committed delivery scratch; the build lands it into the app's `docs/` (a brand page, the committed logo asset, and these values as the frontend theme tokens); reconcile confirms it in `docs/` and closes the line, the records staying readable behind the delivered tag. `docs/` is its durable home; do not maintain this scratch copy.

## Logo

`docs/logo.svg` (committed asset; the build lands it into docs/ as the app's logo)

## Colour scheme

```css
:root {
    --accent: 160 60% 92%;
    --accent-foreground: 160 84% 25%;
    --background: 40 33% 97%;
    --border: 40 15% 88%;
    --card: 0 0% 100%;
    --card-foreground: 150 10% 15%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 98%;
    --foreground: 150 10% 15%;
    --input: 40 15% 88%;
    --muted: 40 20% 94%;
    --muted-foreground: 150 5% 45%;
    --primary: 160 84% 39%;
    --primary-foreground: 0 0% 100%;
    --radius: 0.75rem;
    --ring: 160 84% 39%;
    --secondary: 40 25% 93%;
    --secondary-foreground: 150 10% 25%;
}
```

## Typography

- `--font-sans`: Nunito, system-ui, sans-serif

The prototype renders system stacks. Any brand webfont (a curated display or body face) is pinned here and self-hosted at build, never a CDN.

## Art direction

Warm editorial aesthetic adapted for desktop audio management: soft off-white cream paper backgrounds (hsl(40, 33%, 97%)) paired with a rich emerald brand accent (hsl(160, 84%, 39%)), dark warm text (hsl(150, 10%, 15%)), and rounded geometry (0.75rem radius, Nunito typography). Surfaces remain calm, flat, and legible without decorative gradients or heavy drop-shadows, prioritizing information density and album art clarity.

## Interaction model

Desktop-native interactions with frameless custom window controls and draggable header region. Library view provides instant multi-field sorting, filtering, and inline search. Metadata editor supports single-track and batch tag edits with drag-and-drop cover art and direct local ID3/Vorbis writeback. Audio engine features persistent bottom mini-player with seek bar and volume/sink selector, expandable to a dedicated full-view player. Car sync engine performs one-click delta synchronization to connected removable media with live progress and stale file identification.

## Accessibility

WCAG AA compliance for text contrast on cream background (4.5:1 minimum for body and tabular data, 3:1 for large display elements). High-contrast focus rings (hsl(160, 84%, 39%)) on all interactive buttons, inputs, and track rows. Full keyboard navigation for track table and playback controls (Space for play/pause, Arrow keys for seek/volume, Tab order through interactive elements). Reduced-motion support respecting OS-level animation preferences.

## Design approval (the design gate, REF-Delivery.md section 1)

- Design approved: 2026-09-01 - approved by Carter in the live design session, over the phase's passing fresh-eyes review (both recorded in the frontmatter `signed:` and `reviewed:` fields above, the authoritative gate state; REF-Delivery.md section 1)
- Approved layout: Frameless Desktop (Library, Tag Editor, Player, Car Sync)
- Prototype (legacy reference, kept live): https://protopane.chaos-architect.dev/p/crate; read its screens later via the Protopane MCP (https://protopane.chaos-architect.dev/mcp) or `GET https://protopane.chaos-architect.dev/api/projects/crate`, credentials from the environment (REF-Protopane.md section 9). The MCP/deployed instance is the door, never a local clone.
