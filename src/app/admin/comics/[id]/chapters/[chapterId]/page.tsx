import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminHeader, Notice, Panel } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { chapterNumber } from "@/lib/format";
import { imageUrl } from "@/lib/images/urls";
import { removeChapter } from "../actions";
import { ChapterDetailsForm } from "./chapter-details-form";
import { PageList } from "./page-list";
import { PageUploader } from "./page-uploader";

export const metadata: Metadata = { title: "Edit chapter" };

export default function ChapterEditorPage(props: PageProps<"/admin/comics/[id]/chapters/[chapterId]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <ChapterEditor {...props} />
    </Suspense>
  );
}

async function ChapterEditor({ params, searchParams }: PageProps<"/admin/comics/[id]/chapters/[chapterId]">) {
  const { id, chapterId } = await params;
  const { supabase, now } = await requireAdminPage(`/admin/comics/${id}/chapters/${chapterId}`);
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f-]{36}$/.test(chapterId)) notFound();

  const [{ data: chapter }, { data: pages }, { created }] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, comic_id, number, title, status, published_at, deleted_at, comics!inner(title, slug)")
      .eq("id", chapterId)
      .eq("comic_id", id)
      .maybeSingle(),
    supabase.from("chapter_images").select("id, storage_key, width, height, bytes").eq("chapter_id", chapterId).order("position"),
    searchParams,
  ]);
  if (!chapter) notFound();

  const label = `Chapter ${chapterNumber(chapter.number)}`;
  const state =
    chapter.status === "draft"
      ? "draft"
      : chapter.published_at && new Date(chapter.published_at).getTime() > now
        ? "scheduled"
        : "released";
  const pageItems = (pages ?? []).map((p) => ({ id: p.id, url: imageUrl(p.storage_key), width: p.width, height: p.height, bytes: p.bytes }));

  return (
    <>
      <Link href={`/admin/comics/${id}/chapters`} className="text-sm text-fg-soft hover:text-accent-fg">← {chapter.comics.title}: chapters</Link>
      <div className="mt-3">
        <AdminHeader
          title={chapter.title ? `${label}: ${chapter.title}` : label}
          subtitle={state === "draft" ? "Draft" : state === "scheduled" ? "Scheduled" : "Released"}
        />
      </div>
      {created === "1" ? <Notice>Chapter created as a draft. Upload its pages, then publish or schedule it.</Notice> : null}
      {chapter.deleted_at ? (
        <Notice tone="warning">
          This chapter was removed. <Link href={`/admin/comics/${id}/chapters`} className="font-semibold underline">Restore it</Link> to edit it.
        </Notice>
      ) : (
        <div className="flex flex-col gap-5">
          <Panel title="Pages">
            <div className="flex flex-col gap-5 border-t border-line p-4 sm:p-5">
              <PageUploader chapterId={chapter.id} />
              <PageList key={pageItems.map((p) => p.id).join(",")} chapterId={chapter.id} pages={pageItems} />
            </div>
          </Panel>

          <Panel title="Details and publishing">
            <div className="border-t border-line p-4 sm:p-5">
              <ChapterDetailsForm
                chapterId={chapter.id}
                number={chapterNumber(chapter.number) ?? ""}
                title={chapter.title ?? ""}
                state={state}
                publishedAt={chapter.published_at}
                pageCount={pageItems.length}
              />
            </div>
          </Panel>

          <section aria-labelledby="remove-heading" className="rounded-2xl border border-danger-strong/40 p-5">
            <h2 id="remove-heading" className="font-display text-lg font-bold">Remove chapter</h2>
            <p className="mt-1 text-sm text-muted">Hides it from readers. You can restore it from the chapter list.</p>
            <form action={removeChapter.bind(null, chapter.id)} className="mt-4">
              <button type="submit" className="h-10 rounded-[10px] border border-danger-strong/60 px-4 text-sm font-semibold text-danger hover:bg-danger-strong/10">
                Remove chapter
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
