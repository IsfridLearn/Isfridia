import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminHeader, Notice } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { moveToTrash } from "../actions";
import { ComicForm } from "../comic-form";
import { CoverUploader } from "../cover-uploader";

export const metadata: Metadata = { title: "Edit comic" };

export default function EditComicPage(props: PageProps<"/admin/comics/[id]">) {
  return (
    <>
      <Link href="/admin/comics" className="text-sm text-fg-soft hover:text-accent-fg">← Comics</Link>
      <Suspense fallback={<p className="mt-4 text-muted">Loading…</p>}>
        <EditComic {...props} />
      </Suspense>
    </>
  );
}

async function EditComic({ params, searchParams }: PageProps<"/admin/comics/[id]">) {
  const { id } = await params;
  const { supabase } = await requireAdminPage(`/admin/comics/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [{ data: comic }, { data: genres }, { data: links }, { saved }] = await Promise.all([
    supabase.from("comics").select("*").eq("id", id).maybeSingle(),
    supabase.from("genres").select("id, name").order("name"),
    supabase.from("comic_genres").select("genre_id").eq("comic_id", id),
    searchParams,
  ]);
  if (!comic) notFound();

  if (comic.deleted_at) {
    return (
      <div className="mt-3">
        <AdminHeader title={comic.title} />
        <Notice tone="warning">
          This comic is in the trash. <Link href="/admin/trash" className="font-semibold underline">Restore it from the trash</Link> to edit it.
        </Notice>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <AdminHeader
        title={comic.title}
        subtitle={comic.is_published ? "Published" : "Draft: only admins can see it"}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/comics/${comic.id}/chapters`} className="flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-bold text-on-accent hover:brightness-110">
              Chapters
            </Link>
            {comic.is_published ? (
              <Link href={`/comics/${comic.slug}`} className="flex h-10 items-center rounded-[10px] border border-line-strong px-4 text-sm font-semibold hover:bg-surface-2">
                View on site ↗
              </Link>
            ) : null}
          </div>
        }
      />
      {saved === "1" ? <Notice>Saved. The public site shows the changes now.</Notice> : null}

      <div className="flex flex-wrap items-start gap-8">
        <div className="w-full max-w-[200px] shrink-0">
          <CoverUploader comicId={comic.id} title={comic.title} slug={comic.slug} coverKey={comic.cover_key} />
        </div>
        <div className="min-w-0 flex-[999_1_480px]">
          <ComicForm
            comicId={comic.id}
            genres={genres ?? []}
            initial={{
              title: comic.title,
              slug: comic.slug,
              altTitles: comic.alt_titles.join("\n"),
              synopsis: comic.synopsis,
              author: comic.author ?? "",
              artist: comic.artist ?? "",
              status: comic.status,
              type: comic.type,
              releaseYear: comic.release_year ? String(comic.release_year) : "",
              genreIds: (links ?? []).map((l) => String(l.genre_id)),
              isPublished: comic.is_published,
              isFeatured: comic.is_featured,
              mangaupdatesId: comic.mangaupdates_id ? String(comic.mangaupdates_id) : "",
              mangaupdatesUrl: comic.mangaupdates_url ?? "",
            }}
          />
        </div>
      </div>

      <section aria-labelledby="danger-heading" className="mt-10 rounded-2xl border border-danger-strong/40 p-5">
        <h2 id="danger-heading" className="font-display text-lg font-bold">Move to trash</h2>
        <p className="mt-1 text-sm text-muted">
          Hides the comic everywhere. You can restore it from the Trash; only the owner can delete it for good.
        </p>
        <form action={moveToTrash.bind(null, comic.id)} className="mt-4">
          <button type="submit" className="h-10 rounded-[10px] border border-danger-strong/60 px-4 text-sm font-semibold text-danger hover:bg-danger-strong/10">
            Move to trash
          </button>
        </form>
      </section>
    </div>
  );
}
