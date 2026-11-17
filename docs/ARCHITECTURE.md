# Isfridia architecture

Approved in Phase 1 (2026-11-17). This is the reference for every later phase.
Change it only when we agree on a change, and note the change in `PROGRESS.md`.

## What the site is

A dark-themed reading platform for **original** manhwa owned by the site owner:
public browsing and reading, user accounts (bookmarks, favorites, history,
progress) and an admin dashboard for comics, chapters, uploads and users.

## Services

| Part | Job | Notes |
|---|---|---|
| Next.js 16 (App Router, TypeScript, Tailwind v4) on **Vercel** | Pages + server code | Hobby plan is **non-commercial only**; Pro is $20/month if the site earns money |
| **Supabase** Postgres + Auth | Data, logins, Row Level Security | Free: 500 MB DB, 5 GB egress, pauses after ~1 week idle, no restorable backups |
| **Cloudflare R2** + CDN | Images (covers, chapter pages) | Free 10 GB; downloads (egress) always free; needs a custom domain in production |
| **MangaUpdates API** | Optional metadata import in the admin form | Public endpoints only, no key; cached; credit required |

```
Browser ──pages──► Vercel (Next.js) ──► Supabase (DB + Auth)
   │                     └──► MangaUpdates (admin only, cached)
   └──images──► cdn.<domain> (Cloudflare CDN ◄─ R2 bucket)
Admin browser ──direct upload with short-lived signed URL──► R2
```

> **Change (2026-11-17, Phase 6b):** images are stored in **Supabase Storage**
> (bucket `images`) for now, because Cloudflare R2 requires a card the owner
> doesn't have yet. Free limits: 1 GB stored, ~5 GB downloads/month. Image
> links are built from `NEXT_PUBLIC_IMAGE_BASE_URL`, so moving to R2 later is
> a file copy plus one setting. Covers are converted on the server (sharp)
> and uploaded through a server action; chapter pages (Phase 7) will need
> direct-to-storage uploads because of the 4.5 MB request limit.

## Key decisions

1. **Public pages are cached; personal bits load separately.** Bookmark state,
   "continue reading" etc. stream in per user so comic pages stay cacheable.
   Next 16 has Cache Components enabled (`cacheComponents: true`): anything that
   reads cookies sits behind `<Suspense>`.
2. **Scheduled chapters need no timer.** A chapter is visible when
   `status = 'published'` and `published_at <= now()`; RLS enforces it. Pages
   revalidate every few minutes, so a release appears within about 5 minutes.
3. **Uploads bypass Vercel.** Vercel functions reject bodies over ~4.5 MB, so the
   server hands out short-lived R2 upload URLs after an admin check, the browser
   uploads directly, then the server verifies each file before saving rows.
4. **Images are optimised once, at upload,** in the admin's browser: WebP, max
   width ~1200 px, very tall strips split. Width/height are stored to prevent
   layout shift. Chapter images are plain `<img loading="lazy">`, not Vercel's
   image optimiser (small free quota).
5. **Security is checked twice.** Server code calls `requireAdmin()` and
   Postgres RLS enforces the same rule. Admin rights live in `admin_permissions`,
   never in user-editable profile data.
6. **R2 image URLs are public.** Scheduled chapters are hidden by random,
   unguessable file names. This is not DRM.

## Database (built in Phase 3)

Core: `profiles`, `admin_permissions`, `comics`, `genres`, `comic_genres`,
`chapters`, `chapter_images`, `bookmarks` (with `is_favorite`), `reading_history`
(one row per user + chapter).
Supporting: `site_settings`, `mangaupdates_cache`, `comic_views_daily`,
`audit_log`, `rate_limits`.

- Chapter numbers are decimals (10.5 works). `unique (comic_id, number)`.
- Comics and chapters soft-delete (`deleted_at`) into a 30-day trash.
- Search: Postgres full-text + `pg_trgm` over titles and alternative titles.
- RLS summary: published content is public; bookmarks/history are owner-only;
  admins write content; audit/cache/rate-limit tables have no public access.

## MangaUpdates (Phase 5)

Verified public (no auth) in the official OpenAPI spec:
`POST /v1/series/search`, `GET /v1/series/{id}`, `GET /v1/genres`,
`GET /v1/authors/{id}`, `POST /v1/authors/search`. Login is only for user lists
and editing, which we don't use.

Rules from their Acceptable Use Policy: credit MangaUpdates; space requests out.
Plan: admin-only import, server-only module, Postgres cache (search 24 h,
series 7 days), about 1 request/second, sanitise descriptions, never import
cover images. Original stories usually won't be listed there.

## Environment variables

See `.env.example`. `NEXT_PUBLIC_*` values reach the browser; everything else is
server-only. Supabase uses the new key names: publishable (`sb_publishable_`)
and secret (`sb_secret_`); legacy anon/service_role keys are being retired.

## Backups (Phase 10)

Migrations in git rebuild the schema. A nightly GitHub Action dumps the database
to a private R2 bucket (~30 days kept). Original chapter art stays on the
owner's machine plus a second copy. Trash + audit log protect against mistakes.
The restore is practised once before launch.

## Costs (approximate, recheck before paying)

| Item | Free option | Paid trigger |
|---|---|---|
| Hosting (Vercel) | Hobby $0 | $20/month Pro if commercial |
| DB + auth (Supabase) | Free $0 | $25/month Pro (no pausing, backups) |
| Images (R2) | $0 to 10 GB | $0.015/GB-month beyond |
| Domain | none | ~$10–12/year |
| Auth email | free tier of an email service | high volume only |

## Roadmap

1. Architecture: done
2. Project setup
3. Database + auth
4. Frontend design (public pages)
5. MangaUpdates integration
6. Comic management (admin)
7. Chapter management (uploads, ordering, scheduling)
8. Reader
9. User features
10. Testing + deployment

Each phase has a "done when" check in `PROGRESS.md`.
