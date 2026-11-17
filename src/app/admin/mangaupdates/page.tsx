import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageTitle } from "@/components/ui/section-heading";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/format";
import { MangaUpdatesError } from "@/lib/mangaupdates/client";
import { toImportDraft } from "@/lib/mangaupdates/map";
import { getSeries, searchSeries } from "@/lib/mangaupdates/service";

export const metadata: Metadata = { title: "Import from MangaUpdates" };

type SearchParams = PageProps<"/admin/mangaupdates">["searchParams"];
type Db = Awaited<ReturnType<typeof requireAdminPage>>["supabase"];

export default function MangaUpdatesImportPage({ searchParams }: PageProps<"/admin/mangaupdates">) {
  return (
    <>
      <PageTitle subtitle="Search MangaUpdates and preview which details it can fill in for a comic.">
        Import from MangaUpdates
      </PageTitle>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <ImportTool searchParams={searchParams} />
      </Suspense>
      <p className="mt-10 border-t border-line pt-4 text-sm text-muted">
        Series data provided by{" "}
        <a href="https://www.mangaupdates.com" target="_blank" rel="noopener noreferrer" className="text-fg-soft underline">
          MangaUpdates
        </a>
        . Metadata only: never import cover art or chapters you don&apos;t have the rights to.
      </p>
    </>
  );
}

async function ImportTool({ searchParams }: { searchParams: SearchParams }) {
  // Renders per request (it reads the clock for cache expiry and talks to
  // MangaUpdates), then checks admin rights.
  const { supabase } = await requireAdminPage("/admin/mangaupdates");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const id = typeof params.id === "string" && /^\d{1,15}$/.test(params.id) ? Number(params.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <Form action="/admin/mangaupdates" className="flex flex-wrap gap-2" key={q}>
        <label htmlFor="mu-q" className="sr-only">
          Series title
        </label>
        <input
          id="mu-q"
          name="q"
          type="search"
          defaultValue={q}
          required
          maxLength={100}
          placeholder="Series title, e.g. Solo Leveling"
          className="h-11 min-w-0 flex-[1_1_280px] rounded-[10px] border border-line-strong bg-surface px-3 text-fg placeholder:text-faint"
        />
        <button type="submit" className="h-11 rounded-[10px] bg-accent px-5 font-bold text-on-accent hover:brightness-110">
          Search
        </button>
      </Form>

      {id !== null ? <SeriesPreview db={supabase} id={id} q={q} /> : q ? <SearchResults db={supabase} q={q} /> : null}
    </div>
  );
}

function ErrorBox({ error }: { error: unknown }) {
  const message = error instanceof MangaUpdatesError ? error.message : "Something went wrong talking to MangaUpdates.";
  return (
    <p role="alert" className="rounded-xl border border-danger-strong/40 bg-danger-strong/10 px-4 py-3 text-danger">
      {message}
    </p>
  );
}

async function SearchResults({ db, q }: { db: Db; q: string }) {
  let result;
  try {
    result = await searchSeries(db, q);
  } catch (error) {
    return <ErrorBox error={error} />;
  }
  if (!result.hits.length) return <EmptyState title="No matches on MangaUpdates">Try a shorter or different title.</EmptyState>;

  return (
    <section aria-labelledby="results-heading" className="flex flex-col gap-3">
      <h2 id="results-heading" className="text-sm text-muted">
        Showing {result.hits.length} of {result.total.toLocaleString("en-US")} matches
        {result.cached ? " (from cache)" : ""}
      </h2>
      <ul className="flex flex-col gap-2">
        {result.hits.map((hit) => (
          <li key={hit.id} className="flex flex-wrap items-start gap-4 rounded-[14px] border border-line bg-surface p-4">
            <div className="min-w-0 flex-[1_1_320px]">
              <p className="font-semibold">{hit.title}</p>
              {hit.matchedTitle ? <p className="text-sm text-muted">Matched: {hit.matchedTitle}</p> : null}
              <p className="mt-0.5 text-sm text-fg-soft">
                {[hit.type, hit.year, hit.genres.slice(0, 4).join(", ")].filter(Boolean).join(" · ")}
              </p>
              {hit.snippet ? <p className="mt-2 line-clamp-2 text-sm text-muted">{hit.snippet}</p> : null}
            </div>
            <Link
              href={`/admin/mangaupdates?q=${encodeURIComponent(q)}&id=${hit.id}`}
              prefetch={false}
              className="flex h-10 items-center rounded-[10px] border border-line-strong px-4 text-sm font-semibold hover:bg-surface-2"
            >
              Preview import
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function SeriesPreview({ db, id, q }: { db: Db; id: number; q: string }) {
  let series;
  try {
    series = await getSeries(db, id);
  } catch (error) {
    return <ErrorBox error={error} />;
  }
  if (!series) return <EmptyState title="MangaUpdates has no series with that ID" />;

  const [{ data: genres }, { data: existing }] = await Promise.all([
    db.from("genres").select("slug, name").order("name"),
    db.from("comics").select("title, slug").eq("mangaupdates_id", id).maybeSingle(),
  ]);
  const draft = toImportDraft(series, genres ?? []);
  const genreName = new Map((genres ?? []).map((g) => [g.slug, g.name]));

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Title", value: draft.title },
    { label: "Alternative titles", value: draft.altTitles.length ? draft.altTitles.join(" · ") : null },
    { label: "Author", value: draft.author },
    { label: "Artist", value: draft.artist },
    { label: "Status", value: STATUS_LABEL[draft.status] },
    {
      label: "Type",
      value: draft.type ? TYPE_LABEL[draft.type] : draft.typeSource ? `${draft.typeSource} (not a type IsfridVerse uses, so choose one)` : null,
    },
    { label: "Release year", value: draft.releaseYear ? String(draft.releaseYear) : null },
    {
      label: "Genres",
      value: draft.genreSlugs.length ? draft.genreSlugs.map((s) => genreName.get(s) ?? s).join(", ") : null,
    },
  ];

  return (
    <section aria-labelledby="preview-heading" className="flex flex-col gap-5">
      <Link href={`/admin/mangaupdates?q=${encodeURIComponent(q)}`} className="text-sm text-fg-soft hover:text-accent-fg">
        ← Back to results
      </Link>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="preview-heading" className="font-display text-2xl font-bold">
          Import preview
        </h2>
        {draft.mangaupdatesUrl ? (
          <a href={draft.mangaupdatesUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent-fg hover:underline">
            View on MangaUpdates ↗
          </a>
        ) : null}
      </div>

      {existing ? (
        <p className="rounded-xl border border-hiatus/30 bg-hiatus-bg px-4 py-3 text-hiatus">
          Already imported as{" "}
          <Link href={`/comics/${existing.slug}`} className="font-semibold underline">
            {existing.title}
          </Link>
          .
        </p>
      ) : null}

      <dl className="divide-y divide-line overflow-hidden rounded-[14px] border border-line">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1 bg-panel px-4 py-3 sm:grid-cols-[180px_1fr]">
            <dt className="text-sm font-semibold text-muted">{row.label}</dt>
            <dd className={row.value ? "" : "text-faint italic"}>{row.value ?? "Not on MangaUpdates"}</dd>
          </div>
        ))}
        <div className="grid gap-1 bg-panel px-4 py-3 sm:grid-cols-[180px_1fr]">
          <dt className="text-sm font-semibold text-muted">Synopsis</dt>
          <dd>
            {draft.synopsis ? (
              <>
                <p className="whitespace-pre-line text-fg-soft">{draft.synopsis}</p>
                <p className="mt-2 text-sm text-hiatus">
                  Often a publisher&apos;s blurb. Rewrite it in your own words before publishing.
                </p>
              </>
            ) : (
              <span className="text-faint italic">Not on MangaUpdates</span>
            )}
          </dd>
        </div>
      </dl>

      {draft.unmatchedGenres.length ? (
        <p className="text-sm text-muted">
          MangaUpdates genres you don&apos;t have yet: <span className="text-fg-soft">{draft.unmatchedGenres.join(", ")}</span>
        </p>
      ) : null}
      {draft.missing.length ? (
        <p className="text-sm text-muted">
          You&apos;ll need to fill in: <span className="text-fg-soft">{draft.missing.join(", ")}</span>
        </p>
      ) : null}
      <p className="text-sm text-muted">
        Cover images are never imported; upload your own artwork.
        {series.cached ? " (Loaded from cache.)" : ""}
      </p>
      {existing ? null : (
        <div>
          <Link
            href={`/admin/comics/new?mu=${id}`}
            prefetch={false}
            className="inline-flex h-11 items-center rounded-[10px] bg-accent px-5 font-bold text-on-accent hover:brightness-110"
          >
            Create comic from this
          </Link>
        </div>
      )}
    </section>
  );
}
