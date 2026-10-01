# Crate - Brand & Visual Identity

This document captures the locked visual identity for Crate, established in Phase 2 (Design) and approved on 2026-09-01.

## Art Direction

Crate features a warm editorial aesthetic tailored for desktop audio management and car media preparation. The interface blends soft off-white cream paper surfaces (`hsl(40, 33%, 97%)`) with rich emerald brand accents (`hsl(160, 84%, 39%)`), deep slate typography (`hsl(150, 10%, 15%)`), and comfortable rounded geometry (`0.75rem` radius). Surfaces remain calm, tactile, and legible, prioritizing album artwork presentation, metadata clarity, and rapid scanning over decorative gradients or heavy elevation.

## Design Tokens

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
    --success: 162 90% 26%;
    --success-foreground: 0 0% 100%;
    --warning: 26 90% 37%;
    --warning-foreground: 0 0% 100%;
    --info: 201 96% 32%;
    --info-foreground: 0 0% 100%;
    --font-sans: 'Nunito', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

### Token usage in components

Components use only the semantic tokens above, never raw Tailwind color scales (`emerald-*`, `amber-*`, `sky-*`, `rose-*`, ...), hex literals, or arbitrary color values. Status states map to `success` (done, saved, matched), `warning` (needs attention), `info` (neutral notice) and `destructive` (error, deletion). Plain `black`/`white` are allowed only as scrims and contrast marks over album artwork. Radii are `rounded`, `rounded-md`, `rounded-lg` and `rounded-xl`, all wired to `--radius`, plus `rounded-full` for pills and circles. The `INT-UI-001` test fails on any other color or radius in `src/components`.

## Typography

- **Primary Font**: `Nunito` (rounded humanist sans-serif)
- **Fallback Stack**: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Monospace Stack**: `ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace` (used for track times, bitrates, file sizes, and storage paths).

## Brand Logo

The brand mark is located at [`docs/logo.svg`](file:///d:/code-repos/crate/docs/logo.svg). It consists of an emerald rounded badge (`hsl(160, 84%, 39%)`) featuring a custom vinyl record crate motif (two standing vinyl discs held in a slatted storage crate) followed by the bold 'Crate' logotype in deep slate (`hsl(150, 10%, 15%)`).

## Interaction & Accessibility Principles

1. **WCAG AA Compliance**: All text elements achieve a minimum 4.5:1 contrast ratio against cream and card surfaces. Interactive elements provide high-contrast emerald focus rings (`hsl(160, 84%, 39%)`).
2. **Keyboard Navigation**: Standard media controls mapped to keyboard shortcuts (Space for Play/Pause, Arrow Left/Right for Seek, Arrow Up/Down for Volume). Full tabular keyboard navigation across the library view.
3. **Frameless Desktop Shell**: Custom window chrome with integrated draggable titlebar, subtle window controls, and seamless undocking capabilities for multi-monitor setups.
