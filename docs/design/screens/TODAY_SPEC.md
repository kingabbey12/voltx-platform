# Today — Production Design Specification
## Desktop · Light Theme · v1

**Status:** Canonical build spec for the Today screen. Derives from [TODAY.md](TODAY.md) (design rationale) and the five governing documents. This file contains values, not philosophy. Reference frame: **1440 × 900**. All values in px; every dimension is a multiple of 4 (Visual DNA §3–4). Dark theme is a separately designed composition (Visual DNA §8) and is not covered here.

---

## 1. Tokens

### Color

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F7F6F3` | Page ground, sidebar ground |
| `surface` | `#FCFBF9` | Held rows, reply field |
| `raised` | `#FFFFFF` | Focused field bg, hover row bg (small areas only) |
| `hairline` | `#E7E4DE` | All resting borders |
| `hairline-strong` | `#D6D2C9` | Hover borders |
| `wash` | `#F0EEE9` | Neutral hover fill (nav, secondary actions) |
| `wash-active` | `#ECE9E3` | Active nav item fill |
| `ink` | `#211F1C` | Primary text |
| `ink-2` | `#6E6A62` | Secondary text |
| `ink-3` | `#A29C92` | Tertiary text, placeholders |
| `volt` | `#2F5CE0` | Intent only: verbs, recommended answers, focus |
| `volt-wash` | `#EDF1FC` | Hover fill behind volt text actions |
| `focus-ring` | `rgba(47,92,224,0.25)` | 3px outer ring on focus |
| `green / amber / red / info` | `#217A4B` / `#A8701F` / `#BF3B30` / `#52708C` | Semantic quartet — none appear on Today in normal states |

Accent budget on this screen: held-row verbs + one recommended answer + focus states. Nothing else. Ever.

### Type

Stack: `-apple-system, "SF Pro Text", "Inter", "Segoe UI", sans-serif`. `font-variant-numeric: tabular-nums` on any numeric run.

| Role | Size/Line | Weight | Color |
|---|---|---|---|
| Dateline | 13/16 | 400 | ink-2 |
| Brief prose | 16/24 | 400 | ink |
| Door (entity link) | 16/24 | 500 | ink; hover/focus: underline, 1px, offset 3 |
| Question answers | 13/16 | 500 | volt (recommended) · ink-2 (alternatives) |
| Held sentence | 14/20 | 400 | ink |
| Held verb | 13/16 | 500 | volt |
| Reply input | 16/24 | 400 | ink; placeholder ink-3 |
| ⌘K chip | 11/12 | 500 | ink-3 |
| Sidebar workspace | 13/16 | 600 | ink |
| Sidebar item | 13/16 | 500 | ink-2; active: ink |
| Sidebar you-row | 13/16 | 500 | ink-2 |

### Radius & elevation

Radius: 6 (text-action hover fill), 8 (held rows, reply field, nav items), full (avatar initial). Elevation on this screen: **zero** — every element rests; borders only (Visual DNA §7). The summoned Ask surface (not specced here) is the page's only Elevation-2 visitor.

---

## 2. Layout Geometry (1440 × 900)

```
x: 0                240                500                1180               1440
   ┌────────────────┬──────────────────┬──────────────────┬──────────────────┐
   │  SIDEBAR 240   │     margin       │   COLUMN 680     │      margin      │
   │  canvas bg     │   (fluid 260)    │                  │   (fluid 260)    │
   │  1px hairline→ │                  │                  │                  │
   └────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

- **Sidebar:** fixed 240 wide, full height, `canvas` bg, 1px `hairline` right border. Padding 16. Contents top→bottom: workspace name row (h 32, 13/600), 24 gap, three nav items (h 32, radius 8, padding-x 12, icon 16 @ 1.5px stroke + 8 gap + label), spacer, you-row at bottom (24px round initial avatar, bg `#E3E0D9`, 11/600 ink-2 + 8 gap + name). Item hover: `wash`, 100ms. Active: `wash-active`, label ink. Active is tone, never volt (accent = intent, not location).
- **Content column:** 680 wide, horizontally centered in the area right of the sidebar. Top padding 64. Bottom padding ≥ 96.

Vertical rhythm inside the column: dateline → 16 → brief paragraphs (16 gap) → 12 → answer row (when question present) → 48 → held rows (8 gap) → 64 → reply line.

---

## 3. Components

### 3.1 Dateline
One line, e.g. weekday + date, no year. 13/400 ink-2. Not interactive. Never animates.

### 3.2 Brief
Paragraphs of set prose, 16/24/400 ink, max-width 680 (~68ch). No heading, no container, no background — it is the page. **Doors:** entity mentions at weight 500, no underline at rest; hover/focus: underline + cursor pointer; click opens the record in Company. **Receipt affordance:** hovering a sentence containing an AI claim reveals a 16px tertiary glyph at the sentence end (hidden at rest, 100ms fade); click opens the drawer. **Question:** final paragraph, same prose style; answer row 12 below: text buttons 13/500, padding 6×10, radius 6; recommended first in volt (hover `volt-wash`), alternatives ink-2 (hover `wash`). On answer: paragraph + row crossfade (200ms) to a one-line acknowledgment, 13/400 ink-2.

### 3.3 Held rows
Width 680. Per row: min-height 44, padding 12×16, `surface` bg, 1px `hairline`, radius 8, flex row, sentence left (14/20/400 ink, truncates at 2 lines max), verb right (13/500 volt, padding 5×10, radius 6, hover `volt-wash`, min tap 44×24 hit area). Row gap 8. Row hover: border `hairline-strong`, bg `raised`, 100ms; whole row is the door (opens held work for inspection) except the verb. Focus: 3px `focus-ring`, ring offset 1. **Verb click:** label swaps to confirmation glyph 120ms → row collapses (height+opacity, 200ms ease-in) → rows below settle up (200ms ease-out) → a single quiet line remains for 8s: "Sent — Undo" (13 ink-2; Undo 13/500 volt), then fades (200ms). No shadow, no pulse, no glow, ever.

### 3.4 Reply line
Width 680, height 44, radius 8, 1px `hairline`, `surface` bg, padding-x 16. Placeholder 16/400 ink-3, ≤3 words ("Ask anything"). Right-aligned inside: ⌘K chip — 11/500 ink-3, padding 2×6, 1px `hairline`, radius 4. Focus (click or ⌘K): border `volt` 1px, 3px `focus-ring`, bg `raised`, 120ms; chip fades out; caret uses the breathing-cursor treatment only once engaged. Accepts text, paste, and file drop anywhere on the page (page-level drop targets the field).

---

## 4. States

| State | Sidebar | Dateline | Brief | Held | Reply |
|---|---|---|---|---|---|
| **Default morning** | ✓ | ✓ | 2–3 paragraphs + question | 1–4 rows | ✓ |
| **Quiet day** | ✓ | ✓ | One sentence ("Nothing needs you…") | absent (not rendered) | ✓ |
| **First day** | **absent** (places not yet materialized — Architecture §6) | absent | One greeting line + one question, 16/24, ink; column vertically positioned at 38% viewport height | absent | ✓, pre-focused |
| **One year** | ✓ | ✓ | Shorter, denser with doors; question rare | 0–1 rows, higher consequence | ✓ |

Identical geometry in all states — states differ by content and presence, never by layout rules.

## 5. Motion

| Event | Spec |
|---|---|
| Brief first render of the day | Streams in at reading rhythm, per-line opacity 0→1 over 120ms, sequential; later visits: none — fully set on arrival |
| Hover (nav, rows, verbs, doors) | 100ms ease-out |
| Focus transitions | 120ms ease-out |
| Verb confirm / row resolve / settle | 120 / 200 / 200ms (ease-out entrance, ease-in exit) |
| Question → acknowledgment | 200ms crossfade |
| New held work arriving intraday | **No animation.** Present on next glance. |
| Numbers | Appear at final value. Never count. |
| `prefers-reduced-motion` | All of the above become ≤120ms opacity crossfades; stream-in renders whole |

Ceiling 400ms (never approached here). Everything interruptible: acting through an animation completes it instantly.

## 6. Responsive

| Range | Behavior |
|---|---|
| ≥ 1280 | As specced. Column 680 centered in content area. |
| 1024–1279 | Sidebar 200. Column 680, margins ≥ 72. |
| 768–1023 | Sidebar replaced by 48px top bar: three text tabs (13/500) left, you-initial right, 1px hairline below. Column ≤ 680, margins ≥ 32. |
| < 768 (mobile) | Per Visual DNA §24: three-place bottom tab bar (labels + icons); reply line pinned above it, full-width minus 16 margins; column margins 16; brief 16/24 unchanged (reading floor); held rows full-width, verb min tap 44pt. |

Type sizes never shrink below spec at any width.

## 7. Refinement Pass (attention-drawers removed)

Applied after the first build, before sign-off — each item was built, judged to draw attention to itself, and removed:

1. Verb buttons were filled volt pills → **text-only verbs.** A filled button row-after-row made the page about buttons.
2. Workspace logo mark in sidebar → **plain text name.** A mark is brand in-product; the product is not chrome for a logo.
3. Sidebar "Ask ⌘K" hint row → **chip inside the reply field.** One affordance, one home.
4. You-corner photo avatar → **neutral initial.** A photograph is the loudest pixel-for-pixel element on any screen.
5. Doors in volt color → **weight 500 ink.** Accent = intent, not navigation; five blue phrases made the brief read as a menu.
6. Receipt glyphs visible at rest → **hover/focus only.** Provenance is a right, not a decoration.
7. Dateline weight 500 → **400.** It was competing with the brief's first line.

A further pass found nothing left whose removal survived the check against [TODAY.md](TODAY.md)'s reduction proof. The screen is four elements and their spacing.
