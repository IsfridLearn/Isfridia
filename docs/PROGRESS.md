# Progress

## Phase 1: Architecture: DONE (2026-11-17)

Approved architecture (`ARCHITECTURE.md`) and designs (`DESIGN.md`).
Brand: IsfridVerse. Accent: glacier blue (no orange).

## Phase 2: Project setup: DONE (2026-11-17)

- [x] Next.js 16.4.6 + React 19.3 + TypeScript (strict) + Tailwind 4.3 + ESLint, `src/` layout
- [x] Theme tokens and fonts from the design (`globals.css`, `layout.tsx`)
- [x] Temporary home page, IV icon, starter assets removed
- [x] `.env.example`, `.gitignore` keeps real env files out of git
- [x] `npm run check:supabase` connection checker: prints OK
- [x] git repository initialised (no commits yet)
- [x] Project moved from `Manwha/isfridverse` up to `Manwha` (one folder)
- [x] Supabase project created: IsfridVerse `hwkfkqzgryaplhatqxvf` (Tokyo,
      ap-northeast-1). The ISFRID project is a different app: never touch it.

## Phase 3: Database + auth: DONE except two owner checks (2026-11-17)

Built:
- [x] `supabase/migrations/`: core schema (9 tables, triggers), RLS, 14 genres
- [x] Session refresh `src/proxy.ts`; typed server client `src/lib/supabase/server.ts`
- [x] Pages: `/login`, `/register`, `/forgot-password`, `/reset-password`,
      `/account` (minimal); `/auth/confirm` handles email links
- [x] Scripts: `db:push`, `db:types`, `test:rls`, `test:auth`
- [x] Auth config pushed: redirect `http://localhost:3000/**`, min password 8

Verified against the live project:
- [x] 3 migrations applied (dry run showed target IsfridVerse first)
- [x] `npm run test:rls`: 32/32 PASS; test data fully cleaned up
- [x] `npm run test:auth`: 7/7 PASS (real login link → session cookie →
      /account shows user; fake link rejected; open redirect blocked;
      logged-out visitor sent to /login)
- [x] Secret key absent from the browser bundle
- [x] lint, typecheck, build pass

- [x] Owner registered (andrei) and granted the `owner` role
- [ ] By hand when convenient: forgot password → email → new password
      (owner currently has no phone; email works in the same browser)

Notes:
- Free plan rejects custom email templates without custom SMTP. Default
  Supabase emails are used; their links work in the same browser that signed
  up. Branded templates are ready in `supabase/templates/` (commented out in
  `config.toml`) for when SMTP is added.
- Scope: supporting tables arrive with the phase that uses them; admin roles
  are `owner` and `admin`.

## Phase 4: Frontend (public pages): DONE, mobile look not yet checked by eye (2026-11-17)

Built:
- [x] Migration `catalog_listing`: search text + trigram index,
      `comic_views_daily`, read-only `comic_cards` view (RLS-respecting)
- [x] Cached data layer `src/lib/catalog/queries.ts` (1-minute lifetime,
      tag `catalog`); URL filters validated in `src/lib/catalog/filters.ts`
- [x] Site frame: sticky header (nav, search, account menu), footer
- [x] Pages: `/` (featured carousel, genres, latest updates, trending tabs,
      popular, recently added), `/comics` (filters + pagination), `/search`,
      `/genres`, `/genres/[slug]`, `/latest`, `/popular`, `/comics/[slug]`,
      404 page
- [x] Demo data: `npm run demo:add` / `npm run demo:remove` (12 comics, slugs
      start with `demo-`). **Remove before launch.**

Verified:
- [x] lint, typecheck, build pass; `test:rls` 34/34 (2 new checks on `comic_cards`)
- [x] 20 page checks against the running build: all sections render;
      filters, search, alt-title search, wildcard escaping, invalid URL
      values, page past the end, missing comic/genre → not-found + noindex;
      scheduled chapters never appear
- [ ] UNTESTED: phone-width layout viewed in a real browser (no browser tool
      available here); owner to check with the browser's device mode

Not in this phase (on purpose, no dead buttons):
- "Start reading" and chapter links: Phase 8 (reader)
- Bookmark / favorite buttons: Phase 9
- Real cover images: Phase 6 (R2). Covers are pattern placeholders until then.
- Popular/Trending use demo view counts; real counting starts in Phase 8.
- MangaUpdates attribution in the footer: Phase 5, when its data is used.

## Open questions

- Will the site earn money? (Vercel Hobby vs Pro) Needed before Phase 10.
- Domain name? Needed before Phase 10.
- Image storage: Supabase Storage for now (no card available). Switch to
  Cloudflare R2 once a debit/credit card is available, before real traffic.
- Email provider (custom SMTP, free tier) before launch: enables branded,
  any-device email links and higher sending limits.

## Phase 5: MangaUpdates integration: DONE (2026-11-17)

Built:
- [x] `src/lib/mangaupdates/`: `client.ts` (official public API, no key; ≥1 s
      between requests, 10 s timeout, one retry on 429/5xx honouring
      Retry-After), `schemas.ts` (zod; missing fields default safely),
      `map.ts` (series → comic fields; Markdown → plain text; status/type/
      genre mapping; lists missing fields), `service.ts` (search + series with
      a database cache: search 24 h, series 7 days)
- [x] Migration `mangaupdates`: `mangaupdates_cache` (admins only),
      `comics.mangaupdates_url`, `comic_cards` exposes it
- [x] `requireAdmin()` guard; admin page `/admin/mangaupdates` (search →
      preview of what would be imported, already-imported warning)
- [x] Attribution: footer credit on every page; "Some details from
      MangaUpdates ↗" on imported comics
- [x] Cover images are never imported; synopsis flagged "rewrite in your own words"

Verified:
- [x] `test:unit` 8/8 (mapping), `test:rls` 38/38 (+4 cache checks),
      `test:admin` 7/7 against the running build (logged-out → login,
      non-admin → not found, real search, cache hit, preview, bad id),
      `test:auth` 7/7; lint, typecheck, build; server log clean

Notes:
- Only 3 public endpoints are used (series search, series by id); no account.
- The "Create comic from this" button belongs to the comic editor (Phase 6).
- No separate rate-limit table: only admins can trigger requests, every
  request is cached and spaced out.

## Phase 6a: Admin dashboard + comic management: DONE (2026-11-17)

Built:
- [x] Migration `admin_comics`: `audit_log` (written by a trigger on comics,
      genres, comic_genres; admins read, nobody writes by hand),
      `set_comic_genres()` (all-or-nothing), permanent delete limited to the
      owner and to trashed comics
- [x] Admin frame with sidebar (`/admin` layout); guards `requireAdminPage()`
      (pages: login redirect / 404) and `adminForAction()` (actions: quietly
      refuse non-admins)
- [x] `/admin` overview: stats, recent comics, latest + scheduled chapters,
      recent activity from the audit log
- [x] `/admin/comics`: search, filter, publish and feature switches
- [x] `/admin/comics/new` (optionally pre-filled from MangaUpdates via `?mu=`)
      and `/admin/comics/[id]` (edit, move to trash); shared validated form
      (`src/lib/admin/comic-form.ts`), auto URL name from the title
- [x] `/admin/trash`: restore; owner-only "delete forever" (type the title)
- [x] `/admin/genres`: add, rename (URL kept), delete
- [x] Every change clears the public cache (`updateTag("catalog")`), so the
      site updates immediately

Verified:
- [x] `test:unit` 13/13, `test:rls` 47/47 (+9 Phase 6 checks), lint,
      typecheck, build
- [x] `test:comics` 17/17 against the running build (create → public at once,
      validation keeps input, duplicate URL refused, unpublish hides it, a
      reader replaying an admin button changes nothing, edit, trash, restore,
      genre add/delete, reader gets 404); `test:admin` 7/7; `test:auth` 7/7
- [x] Server log: 0 errors, 0 warnings
- [ ] UNTESTED: admin pages viewed in a real browser by the owner

## Phase 6b: Cover uploads: DONE on Supabase Storage (2026-11-17)

Decision: the owner has no card or PayPal, which Cloudflare R2 requires, so
images use **Supabase Storage** (free: 1 GB stored, ~5 GB downloads/month).
Move to R2 before real traffic: copy the files and set
`NEXT_PUBLIC_IMAGE_BASE_URL`; every image link follows that one setting.

Built:
- [x] Migration `image_storage`: public bucket `images` (WebP only, 2 MB per
      file); only admins upload, replace, list or delete
- [x] `src/lib/images/cover.ts`: checks type (JPG/PNG/WebP/AVIF), size (≤ 4 MB),
      dimensions (≥ 300 px); crops to 2:3; outputs 600×900 and 300×450 WebP;
      strips metadata (sharp 0.35.5, now a direct dependency)
- [x] Upload / replace / remove on the edit page, with a preview before
      uploading; old files deleted on replace, remove and permanent delete
- [x] Real covers everywhere (cards, banner, trending, latest, comic page,
      admin list) with responsive sizes; placeholder when there's none
- [x] Server action body limit raised to 4.5 MB (`next.config.ts`)

Verified:
- [x] `test:unit` 18/18 (+5 cover tests), `test:rls` 54/54 (+7 storage
      checks), `test:comics` 23/23 (+6: upload, two WebP files public, shown
      on the comic page, fake image refused, replace deletes old files, remove
      deletes files), `test:admin` 7/7, `test:auth` 7/7; lint, typecheck,
      build; server log clean; no leftover test files in storage
- [ ] UNTESTED: uploading a cover from a real browser (owner)

## Phase 7: Chapter management: DONE (2026-11-17)

Built:
- [x] Migration `chapter_management`: chapters in the audit log;
      `append_chapter_images()` (adds a batch at the end, in order, locked per
      chapter); `reorder_chapter_images()` (all-or-nothing, refuses stale
      lists); permanent chapter delete limited to the owner and to removed chapters
- [x] `/admin/comics/[id]/chapters`: list with Draft / Scheduled (your local
      time) / Released, page counts, new-chapter form (next number
      suggested), removed chapters with restore and owner-only delete forever
- [x] `/admin/comics/[id]/chapters/[chapterId]`: details + publishing (Draft /
      Publish now / Schedule in your time zone; editing a released chapter
      keeps its release date; publishing needs at least one page), page
      uploader, page list (drag or ↑/↓ to reorder, Save order, delete page),
      remove chapter
- [x] Uploader (browser): natural file-name order; resize to ≤ 1200 px wide;
      tall strips split into ≤ 3000 px pieces; WebP ≤ 2 MB (quality steps
      down if needed); straight to Supabase Storage with a progress bar per
      file, 3 at a time; retry failed files
- [x] Server check of every uploaded file before it becomes a page: right
      folder, real WebP (header read from the file), size ≤ 2 MB; rejected
      files are deleted. Width/height come from the file, not the browser
- [x] Files cleaned up on page delete and permanent chapter delete
- [x] Overview: image storage meter (1 GB free plan), warns at 60%

Verified:
- [x] `test:unit` 26/26 (+8: chapter form, WebP header reader on real lossy/
      lossless/alpha files, page planning, natural sort)
- [x] `test:rls` 59/59 (+5), `test:chapters` 22/22 against the running build
      (does what the browser does: storage upload + the uploader's server
      actions), `test:comics` 23/23, `test:admin` 7/7, `test:auth` 7/7;
      lint, typecheck, build; server log clean; no leftover test files
- [ ] UNTESTED: the uploader's in-browser part (image decode, canvas resize,
      WebP encode, progress bars, drag and drop) in a real browser. Needs
      Chrome, Edge, Opera or Firefox (Safari can't encode WebP).

Notes:
- Demo comics have chapters but no pages; their chapters can't be published
  through the editor until pages are uploaded (or the demo data is removed).

## Phase 8: Reader: DONE (2026-11-18)

Built:
- [x] Reader at `/comics/<slug>/chapter-<n>` (10.5 → `chapter-10-5`;
      `src/lib/chapter-path.ts`), own minimal frame (no site header)
- [x] Cached `getReaderData()`: only publicly released chapters; scheduled,
      draft, removed, unpublished or malformed → not found
- [x] Pages as plain `<img>` with real width/height (no layout shift), first
      two eager (first high priority), rest lazy; Narrow/Standard/Wide on
      desktop (remembered per device); bars hide while scrolling down;
      progress line; prev/next + chapter picker; phone bottom bar;
      end-of-chapter card ("all caught up" on the latest)
- [x] Saved progress for logged-in readers (browser → own `reading_history`
      row, RLS-protected) every 5 s and on leaving; "Jump back" on return
- [x] Comic page: Start reading, Latest chapter, clickable chapter rows,
      per-reader "Continue Chapter N · x%" card
- [x] Latest updates (homepage) and `/latest` link straight to chapters
- [x] View counting: `/api/views` after 5 s of reading → server-only
      `record_chapter_view()`: one view per visitor per chapter per day;
      visitor = daily-changing SHA-256 of IP + server secret + date (never
      stored readably); only released chapters; other sites refused

Verified:
- [x] `test:unit` 30/30 (+4 chapter-address tests), `test:rls` 63/63 (+4:
      nobody calls the counter directly or reads visitor codes or writes view
      counts), `test:reader` 24/24 against the running build; all earlier
      e2e suites still pass; lint, typecheck, build; server log clean
- [ ] UNTESTED in a real browser: scrolling feel, bars hiding, width
      switch, jump-back button, phone bottom bar

Notes:
- Demo comics' chapters have no pages, so their reader shows "no pages yet".

## Phase 9: User features: DONE (2026-11-18)

Built:
- [x] Guards `requireUserPage()` / `userForAction()`; reader library queries
      (`src/lib/user/library.ts`), always run as the reader (RLS = own rows)
- [x] Comic page: Bookmark + Favorite buttons (instant, roll back on error;
      favorite implies bookmark), "Log in to bookmark" for visitors
- [x] `/bookmarks` (All / Favorites, newest updates first, Remove);
      `/history` (one row per comic: chapter, progress, Continue, remove,
      clear all); homepage "Continue reading" row for logged-in readers
- [x] `/account`: overview, links, edit username + display name, change
      password, "Download my data" (`/account/export`, JSON, own data only)
- [x] Header bookmarks shortcut when logged in; footer links
- [x] `/admin/users`: list + search (emails hidden); owner-only Make admin /
      Remove admin (DB rules enforce the same)

Verified:
- [x] `test:library` 29/29 against the running build; all earlier suites
      still pass (unit 30, rls 63, auth 7, admin 7, comics 23, chapters 22,
      reader 24); lint, typecheck, build; server log clean; no leftover test
      users, comics or files
- [ ] UNTESTED in a real browser: button feel, layouts on a phone

Not built (not requested): account deletion, avatar uploads.

## Paused here (2026-11-18): decisions waiting on the owner

1. **"Discover" catalog?** Owner wants MangaUpdates manhwa on the site.
   Explained: MangaUpdates has metadata only (no chapter pages). Offered: a
   bulk-imported, credited, read-elsewhere catalog (facts only: titles,
   authors, genres, year, status; no covers or descriptions; links to
   MangaUpdates; ~20k manhwa fits the free DB). Owner hasn't decided.
2. **Phase 10 needs:** free GitHub + Vercel accounts, and whether the site
   will earn money (Vercel Hobby is non-commercial only).
3. **Nothing is committed to git yet.** Offer a first commit when resuming.

## Next: Phase 10: Testing + deployment (or the Discover catalog first)
