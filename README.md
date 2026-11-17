# Isfridia

A dark-themed reading platform for original manhwa: browse, read, bookmark,
and manage comics from an admin dashboard.

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Design and colour tokens: [docs/DESIGN.md](docs/DESIGN.md)
- What's done and what's next: [docs/PROGRESS.md](docs/PROGRESS.md)

## Requirements

- Node.js 20.9 or newer (developed on Node 24)
- The site's Supabase project (`hwkfkqzgryaplhatqxvf`; still named "IsfridVerse" in the Supabase dashboard)

## Run it locally

```bash
npm install          # first time only
npm run dev          # start the dev server
```

Open http://localhost:3000. Edits to files under `src/` reload automatically.

| Command | What it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build (also type-checks) |
| `npm run start` | serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check only |
| `npm run check:supabase` | checks `.env.local` and that Supabase accepts your keys |
| `npm run db:push` | applies `supabase/migrations/*.sql` to the database (`-- --dry-run` to preview) |
| `npm run db:types` | regenerates `src/lib/supabase/database.types.ts` after a schema change |
| `npm run test:rls` | proves the database security rules work (creates and deletes test data) |
| `npm run test:auth` | end-to-end login-link check against a running site (`BASE_URL`, default :3000) |
| `npm run test:comics` | end-to-end check of the admin comic and genre tools against a running site |
| `npm run test:chapters` | end-to-end check of chapter management (needs `npm run build` + a running site) |
| `npm run test:reader` | end-to-end check of the reader, view counting and saved progress (running site) |
| `npm run test:library` | end-to-end check of bookmarks, history, profile, data export, admin roles (running site) |
| `npm run test:unit` | unit tests (`src/**/*.test.ts`, Node's built-in runner) |
| `npm run test:admin` | end-to-end check of the admin MangaUpdates tool against a running site |
| `npm run mangadex:sync` | sync the MangaDex catalog (titles, covers, official chapters); see options in `scripts/mangadex-sync.mjs` |
| `npm run test:mangadex` | checks the MangaDex catalog on a running site (read-only) |
| `npm run demo:add` / `demo:remove` | add / delete the 12 sample comics (slugs start with `demo-`); removed 2026-11-18 |

## MangaDex catalog

`npm run mangadex:sync` imports MangaDex titles (English available,
safe/suggestive ratings), covers, and **official chapters only**: chapters
MangaDex lists as external links to the publisher. Chapters hosted on
MangaDex are fan scanlations and are never imported or shown.

MangaDex's Acceptable use policy applies while this is used:
- **No ads and no paid services** on the site.
- Credit MangaDex (footer + comic pages) and the chapter's group.
- Server-side requests only, within their rate limits (the script spaces them).

Useful runs: `-- --pages=10` (1,000 most-followed titles), `-- --order=latest
--pages=2` (recent updates), `-- --verify` (unpublish titles MangaDex removed).

## Supabase

Isfridia uses **its own** project, `hwkfkqzgryaplhatqxvf`. The **ISFRID**
project on the same account belongs to a different app. Never point any
command at it.

### Credentials

`.env.local` (git-ignored) holds the project URL, publishable key and secret
key. The Supabase CLI is logged in on this machine (`npx supabase login`), which
`db:push`, `db:types` and config commands use, so no database password is
stored. To undo the CLI login: `npx supabase logout`.

Never put the secret key in a `NEXT_PUBLIC_` variable, never paste keys into
chat, never commit them. If a key leaks, rotate it in Project Settings → API Keys.

### Changing the database

1. Add a new file in `supabase/migrations/` (never edit an applied one).
2. `npm run db:push -- --dry-run`, then `npm run db:push`.
3. `npm run db:types`, then `npm run test:rls`.

### Auth settings

Kept in `supabase/config.toml` and applied with
`npx supabase config diff --remote=hwkfkqzgryaplhatqxvf` (check) then
`npx supabase config push --remote=hwkfkqzgryaplhatqxvf` (apply). Current:
site URL `http://localhost:3000`, redirects `http://localhost:3000/**`, email
confirmation on, minimum password length 8.

Email: Supabase's built-in sender (a few emails per hour, testing only). Its
links work when opened **in the same browser** you signed up in. The branded
templates in `supabase/templates/` (links that work on any device) need a custom
SMTP provider, because the free plan rejects template changes without one.
Planned before launch.

### Make someone the owner

Owners are only ever added by hand. After the person has registered and
confirmed their email, run in the Supabase **SQL Editor**:

```sql
insert into public.admin_permissions (user_id, role)
select id, 'owner' from auth.users where email = 'you@example.com';
```

Their `/account` page then shows **Role: Admin**.

Free projects pause after about a week without activity; un-pause from the
Supabase dashboard if the check says the project can't be reached.
