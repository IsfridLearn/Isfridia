import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminHeader, Notice } from "@/components/admin/ui";
import type { ComicFormValues } from "@/lib/admin/comic-form";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { MangaUpdatesError } from "@/lib/mangaupdates/client";
import { toImportDraft } from "@/lib/mangaupdates/map";
import { getSeries } from "@/lib/mangaupdates/service";
import { ComicForm } from "../comic-form";

export const metadata: Metadata = { title: "New comic" };

const EMPTY: ComicFormValues = {
  title: "",
  slug: "",
  altTitles: "",
  synopsis: "",
  author: "",
  artist: "",
  status: "ongoing",
  type: "manhwa",
  releaseYear: "",
  genreIds: [],
  isPublished: false,
  isFeatured: false,
  mangaupdatesId: "",
  mangaupdatesUrl: "",
};

export default function NewComicPage({ searchParams }: PageProps<"/admin/comics/new">) {
  return (
    <>
      <Link href="/admin/comics" className="text-sm text-fg-soft hover:text-accent-fg">← Comics</Link>
      <div className="mt-3">
        <AdminHeader
          title="New comic"
          subtitle={
            <>
              Fill it in by hand, or{" "}
              <Link href="/admin/mangaupdates" className="text-accent-fg hover:underline">start from MangaUpdates</Link>.
              New comics start unpublished.
            </>
          }
        />
      </div>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <NewComic searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewComic({ searchParams }: { searchParams: PageProps<"/admin/comics/new">["searchParams"] }) {
  const { supabase } = await requireAdminPage("/admin/comics/new");
  const params = await searchParams;
  const muId = typeof params.mu === "string" && /^\d{1,15}$/.test(params.mu) ? Number(params.mu) : null;

  const { data: genres } = await supabase.from("genres").select("id, name, slug").order("name");
  const prefill = muId === null ? null : await loadPrefill(supabase, muId, genres ?? []);

  return (
    <>
      {prefill?.existing ? (
        <Notice tone="warning">
          This MangaUpdates series is already linked to{" "}
          <Link href={`/admin/comics/${prefill.existing.id}`} className="font-semibold underline">{prefill.existing.title}</Link>.
        </Notice>
      ) : prefill?.message ? (
        <Notice tone={prefill.tone}>{prefill.message}</Notice>
      ) : null}
      <ComicForm initial={prefill?.initial ?? EMPTY} genres={(genres ?? []).map(({ id, name }) => ({ id, name }))} />
    </>
  );
}

type Prefill = {
  initial?: ComicFormValues;
  existing?: { id: string; title: string };
  tone?: "warning" | "error";
  message?: string;
};

// Turns a MangaUpdates series into starting values for the form. Returns
// plain data (never throws), so the page decides how to show problems.
async function loadPrefill(
  supabase: Awaited<ReturnType<typeof requireAdminPage>>["supabase"],
  muId: number,
  genres: { id: number; slug: string; name: string }[],
): Promise<Prefill> {
  const { data: existing } = await supabase.from("comics").select("id, title").eq("mangaupdates_id", muId).maybeSingle();
  if (existing) return { existing };

  let series;
  try {
    series = await getSeries(supabase, muId);
  } catch (error) {
    const reason = error instanceof MangaUpdatesError ? error.message : "Couldn't reach MangaUpdates.";
    return { tone: "error", message: `${reason} You can still fill the form in by hand.` };
  }
  if (!series) return { tone: "error", message: "MangaUpdates has no series with that ID. Fill the form in by hand." };

  const d = toImportDraft(series, genres);
  const idBySlug = new Map(genres.map((g) => [g.slug, String(g.id)]));
  return {
    tone: "warning",
    message:
      "Pre-filled from MangaUpdates. Check every field, and rewrite the synopsis in your own words." +
      (d.missing.length ? ` Not on MangaUpdates: ${d.missing.join(", ")}.` : ""),
    initial: {
      ...EMPTY,
      title: d.title,
      altTitles: d.altTitles.join("\n"),
      synopsis: d.synopsis,
      author: d.author ?? "",
      artist: d.artist ?? "",
      status: d.status,
      type: d.type ?? "manhwa",
      releaseYear: d.releaseYear ? String(d.releaseYear) : "",
      genreIds: d.genreSlugs.map((s) => idBySlug.get(s)).filter((x): x is string => Boolean(x)),
      mangaupdatesId: String(d.mangaupdatesId),
      mangaupdatesUrl: d.mangaupdatesUrl ?? "",
    },
  };
}
