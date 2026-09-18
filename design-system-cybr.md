# CYBR_ Design System
### Cyber Brutalism — Visual Language for the Machine Age
**Version 1.0 · 2024**

---

## Philosophy

> "The future isn't minimal. It's systematic."

Cyber Brutalism is raw, digital, and unapologetically functional. Every design decision serves the machine — not the market. No fluff. No polish. No compromise. Structure is visible, grids are exposed, and contrast is a weapon.

---

## Color Palette

| Token | Hex | Role |
|---|---|---|
| `--color-acid` | `#C8FF00` | Primary accent — CTAs, highlights, active states |
| `--color-black` | `#0A0A0A` | Page background, primary surface |
| `--color-dark` | `#111111` | Card backgrounds, secondary surfaces |
| `--color-mid` | `#1A1A1A` | Borders, dividers, grid lines |
| `--color-muted` | `#3D3D3D` | Inactive UI elements, progress track backgrounds |
| `--color-white` | `#F0F0F0` | Body text, labels |
| `--color-dim` | `#888888` | Secondary text, captions, metadata |
| `--color-danger` | `#FF2A2A` | Alerts, errors, system warnings |

### Usage Rules

- **Acid on black only.** Never use `--color-acid` on white or light surfaces — the voltage dies.
- **No gradients.** Color is applied in hard blocks. No blends, no transitions between hues.
- **Contrast is non-negotiable.** All text must meet WCAG AA minimum (4.5:1). Acid on black achieves ~8:1 — that's the floor, not a target.
- **Glitch accents** may use acid at reduced opacity (`rgba(200, 255, 0, 0.15)`) for scanline overlays and ghost effects only.

---

## Typography

### Typefaces

| Role | Family | Style | Use |
|---|---|---|---|
| **Display** | `Space Grotesk` | 700–800, uppercase | Headlines, hero text, section identifiers |
| **Body** | `IBM Plex Mono` | 400, 500 | Paragraphs, descriptions, UI copy |
| **Data / Label** | `IBM Plex Mono` | 400, uppercase | Coordinates, status readouts, metadata |
| **UI Chrome** | `Space Grotesk` | 500, uppercase, tracked | Nav items, button labels, tags |

> Both faces are free via Google Fonts. Monospace body copy reinforces the terminal/machine aesthetic without sacrificing readability.

### Type Scale

```
--text-display-xl:  clamp(4rem, 10vw, 8rem)   / font-weight: 800 / line-height: 0.9
--text-display-lg:  clamp(2.5rem, 6vw, 5rem)  / font-weight: 700 / line-height: 0.95
--text-heading:     clamp(1.5rem, 3vw, 2.5rem) / font-weight: 700 / line-height: 1.1
--text-subhead:     1.125rem                   / font-weight: 500 / line-height: 1.3
--text-body:        0.9375rem (15px)           / font-weight: 400 / line-height: 1.6
--text-small:       0.75rem (12px)             / font-weight: 400 / line-height: 1.5
--text-micro:       0.625rem (10px)            / font-weight: 400 / line-height: 1.4 / letter-spacing: 0.15em
```

### Typography Rules

- **Display text is uppercase.** Always. It reads as system output, not editorial voice.
- **Body text is sentence case.** The contrast between all-caps headers and normal-case body creates hierarchy without size alone.
- **Letter spacing on micro labels:** `0.1–0.2em` tracked wide — coordinates, system IDs, timestamps.
- **No web-safe fallbacks in the spirit of this system.** If Space Grotesk fails to load, the page should feel broken — because it is.
- **Line length:** 60–70 characters max for body copy. Readability is functional.

---

## Spacing & Layout

### Base Grid

- **8px base unit.** All spacing is a multiple of 8.
- **12-column grid** with 24px gutters at desktop; collapses to 4-column at mobile.
- **Exposed grid lines** are encouraged — thin `1px` lines in `--color-mid` that make the structure visible.

### Spacing Scale

```
--space-1:   4px
--space-2:   8px
--space-3:   16px
--space-4:   24px
--space-5:   32px
--space-6:   48px
--space-7:   64px
--space-8:   96px
--space-9:   128px
--space-10:  192px
```

### Section Anatomy

Sections are prefixed with a `/NN` identifier (e.g. `/01`, `/02`) **only when the content is a true sequence** — a real process or ordered narrative where position carries meaning. Decorative numbering is explicitly disallowed.

```
Section structure:
┌─────────────────────────────────────┐
│ /NN  SECTION LABEL            [ + ] │  ← eyebrow row: 1px border-bottom
├─────────────────────────────────────┤
│                                     │
│   Content area                      │
│   padding: var(--space-8) 0         │
│                                     │
└─────────────────────────────────────┘
```

---

## Components

### Buttons

**Primary CTA**
- Background: `--color-acid`
- Text: `--color-black`, `Space Grotesk`, 500, uppercase, tracked
- Padding: `12px 24px`
- Border: none
- Radius: `0` — no rounding ever
- Arrow icon (`↗`) appended after label text
- Hover: invert — black background, acid text, acid border `1px solid`

**Ghost / Secondary**
- Background: transparent
- Text: `--color-white`
- Border: `1px solid --color-mid`
- Hover: border becomes `--color-acid`, text becomes `--color-acid`
- Same sizing as primary

**Disabled state:** Opacity `0.3`, cursor `not-allowed`, no hover effect.

---

### Cards (Work / Project)

```
┌─────────────────────────┐
│  [IMAGE / THUMBNAIL]    │  ← aspect-ratio: 4/3, overflow hidden
│                         │
│  grayscale by default   │
│  color on hover         │
├─────────────────────────┤
│  PROJECT_NAME      [ ↗ ]│  ← monospace uppercase, acid arrow
│  Category label         │  ← --color-dim, --text-small
└─────────────────────────┘
border: 1px solid --color-mid
```

- Images are **grayscale by default**, reveal color on hover (`filter: grayscale(0)`)
- Arrow icon flips to acid on hover
- No box shadows — borders only

---

### System Status / Data Readouts

Inspired by terminal dashboards and hardware monitors.

```
LABEL _________________ VALUE
```

- Label: `--text-micro`, `--color-dim`, uppercase, tracked
- Progress bar: `4px` height, `--color-mid` track, `--color-acid` fill
- Value: `--text-small`, `--color-white`, monospace, right-aligned
- Divider: `1px solid --color-mid`

---

### Form Inputs

- Background: `--color-dark`
- Border: `1px solid --color-mid`
- Border-radius: `0`
- Text: `--color-white`, monospace
- Placeholder: `--color-dim`
- Focus: `border-color: --color-acid`, no glow/shadow
- Padding: `12px 16px`

---

### Navigation

- Background: `--color-black`
- Border-bottom: `1px solid --color-mid`
- Logo: wordmark with `⊕` glyph prefix
- Nav links: uppercase, tracked, `--color-dim` default, `--color-white` hover
- Separator: `+` character between nav items (literal typographic device)
- System clock / UTC timestamp displayed top-right (if applicable)
- CTA button top-right: primary style

---

## Iconography & Symbols

This system uses **typographic and ASCII-derived symbols** — not icon libraries.

| Symbol | Use |
|---|---|
| `↗` | External link, CTA directional arrow |
| `+` | Nav separator, section markers, crosshair detail |
| `[ ]` | Bracket framing for interactive hints, targeting reticles |
| `//` | Code-comment prefix for section IDs (`//SCN_01`) |
| `>` | Terminal prompt prefix for system messages |
| `×` or `X` | Close, dismiss, decorative grid node |
| `⊕` | Logo / brand mark prefix |
| `_` | Trailing cursor blink in headings and brand name |

**Rule:** Never import an icon font or SVG icon set. If a concept cannot be expressed with these glyphs or a simple geometric SVG drawn in-file, question whether the icon is needed at all.

---

## Motion & Animation

Motion serves system feedback, not decoration.

| Interaction | Behavior |
|---|---|
| Page load | Staggered fade-in from bottom: `translateY(12px) → 0`, `opacity 0 → 1`, `duration: 400ms`, `easing: ease-out` |
| Hover on cards | `filter: grayscale(1) → grayscale(0)`, `duration: 200ms` |
| Button hover | Color swap, `duration: 100ms` — instant feel |
| Glitch / render effect | Optional: `clip-path` slice animation on hero image, 2–3 frames, triggered on load only |
| Scroll reveal | `IntersectionObserver`, threshold `0.15`, single upward translate — not repeated |

**Rules:**
- `prefers-reduced-motion` must be respected. Wrap all animations in a media query check.
- No looping ambient animations on informational content.
- No parallax. It reads as dated.
- One orchestrated moment per page — hero only.

---

## Texture & Visual Artifacts

These elements establish the machine-age materiality of the system.

- **Scanlines:** `repeating-linear-gradient` at `rgba(0,0,0,0.03)` 2px intervals — subtle, applied to hero image overlays only
- **Grid overlay:** Exposed structural lines using `--color-mid` at `1px` — use as actual layout borders, not decorative pseudo-elements
- **Coordinate readouts:** Small data labels (`X_ Y_ Z_`) placed near hero imagery as measurement indicators — always monospace, always acid
- **Hazard stripes:** `repeating-linear-gradient` at 45° alternating black and acid — used **only** at page footer or critical alert banners. Maximum `12px` band height.
- **Noise / grain:** Not used. The system's texture comes from structure, not filter effects.

---

## Content Voice

| ✅ Do | ❌ Don't |
|---|---|
| Short, declarative statements | Marketing speak or adjective stacking |
| System metaphors: "SIGNAL", "NODE", "RENDER", "UPTIME" | Warm, human metaphors that undercut the machine tone |
| Uppercase section labels | Title Case section labels |
| `ENTER EMAIL` as placeholder | "Your email address" |
| "LET'S BUILD" | "Get started today" |
| Project names in `SNAKE_CASE` | Project names in Title Case |

**Voice:** Terse. Technical. Direct. The system doesn't persuade — it informs and instructs.

---

## Accessibility Baseline

Even brutalist systems must be usable.

- **Color contrast:** All text combinations verified at WCAG AA minimum
- **Focus indicators:** `outline: 2px solid --color-acid` — never removed, never hidden
- **Reduced motion:** All CSS animations wrapped in `@media (prefers-reduced-motion: no-preference)`
- **Semantic HTML:** Structural elements (`<nav>`, `<main>`, `<section>`, `<header>`) always used correctly — visual brutalism does not mean structural chaos
- **Alt text:** All images receive descriptive alt text; decorative textures use `aria-hidden="true"`
- **Keyboard navigation:** Full tab-order navigability required

---

## Anti-Patterns

Things that break the system:

- `border-radius` on any interactive element
- Drop shadows (`box-shadow`, `filter: drop-shadow`)
- Gradient backgrounds or gradient text fills
- Bright background colors (no white, cream, or light-mode surfaces)
- Rounded icons or rounded avatar images
- Any sans-serif typeface that isn't Space Grotesk or IBM Plex
- Decorative sequential numbering when content isn't actually a sequence
- Looping hero animations
- More than one acid-green element competing for attention per viewport

---

*CYBR_ DESIGN SYSTEM · ALL SYSTEMS OPERATIONAL · //END*
