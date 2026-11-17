@AGENTS.md

# Isfridia

Read `docs/PROGRESS.md` first (current phase, open questions), then
`docs/ARCHITECTURE.md` and `docs/DESIGN.md` before changing anything.

- Work phase by phase; update `docs/PROGRESS.md` when a phase item is done.
- Before a phase is called done: `npm run lint`, `npm run typecheck`,
  `npm run build` pass, and the phase's own "done when" check is run.
- Use the theme tokens in `src/app/globals.css`; no hard-coded colours in components.
- Secrets never get a `NEXT_PUBLIC_` prefix. Ask before adding paid services.
