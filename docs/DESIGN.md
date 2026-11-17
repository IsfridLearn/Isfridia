# IsfridVerse design

Approved 2026-11-17, with more experimentation planned later.
Design canvas (private to the owner): https://claude.ai/artifact/NHXM4ZCmtwAzijbCBjV856
It holds Home, Comic details, Reader (desktop + phone) and Admin dashboard.

## Look

- Dark only. Near-black blue-grey backgrounds, one accent: **glacier blue**
  (a nod to "Isfrid": *is* = ice). No orange anywhere (owner's call).
- Headings: **Bricolage Grotesque** (800/700). Body: **Inter**.
- Logo: monochrome **IV** monogram on an off-white rounded tile; wordmark
  "Isfrid" in `fg` + "Verse" in `muted`. Source: `src/app/icon.svg`.

## Tokens

Defined once in `src/app/globals.css` (`@theme`) and used as Tailwind classes.

| Token | Value | Use |
|---|---|---|
| `reader` | #07080B | behind reader images |
| `canvas` | #0B0C10 | page background |
| `panel` | #111318 | table rows, inset panels |
| `surface` / `surface-2` | #14161C / #1B1E26 | cards, inputs / hover, selected |
| `line` / `line-strong` | #1F222B / #262A35 | borders |
| `fg` / `fg-soft` / `muted` / `faint` | #EDEEF2 / #C9CDD6 / #A0A6B4 / #858B9B | text |
| `accent` / `accent-fg` / `on-accent` / `accent-soft` | #6CC6FF / #9AD8FF / #04121F / #0F2333 | buttons, accent text, text on accent, soft badge |
| `ongoing` (+`-bg`) | #7BE3A4 on #102A1B | status |
| `completed` (+`-bg`) | #C3B5FF on #221C3A | status |
| `hiatus` (+`-bg`) | #F2C14E on #2E2612 | status, "scheduled" |
| `danger` / `danger-strong` | #FF9EA1 / #E5484D | errors |

## Rules

- Accent buttons use dark text (`text-on-accent`); white on blue fails contrast.
- Touch targets at least 44 px. Visible focus ring (`accent-fg`).
- Covers are 2:3. Cards lift 4 px on hover; respect `prefers-reduced-motion`.
- Reader: width options Narrow 600 / Standard 760 / Wide 1000 px; reserved
  image space (no layout shift); phone controls at the bottom.
