import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LocalTime } from "@/components/admin/local-time";
import { AdminHeader, Notice } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { chapterNumber, timeAgo } from "@/lib/format";
import { restoreChapter } from "./actions";
import { DeleteChapterForeverButton, NewChapterForm } from "./chapter-forms";

export const metadata: Metadata = { title: "Chapters" };

export default function ChaptersPage(props: PageProps<"/admin/comics/[id]/chapters">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Chapters {...props} />
    </Suspense>
  );
}

async function Chapters({ params, searchParams }: PageProps<"/admin/comics/[id]/chapters">) {
  const { id } = await params;
  const { supabase, now } = await requireAdminPage(`/admin/comics/${id}/chapters`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [{ data: comic }, { data: chapters }, { removed }, { data: isOwner }] = await Promise.all([
    supabase.from("comics").select("id, title, slug, is_published, deleted_at").eq("id", id).maybeSingle(),
    supabase
      .from("chapters")
      .select("id, number, title, status, published_at, deleted_at, chapter_images(count)")
      .eq("comic_id", id)
      .order("number", { ascending: false }),
    searchParams,
    supabase.rpc("is_owner"),
  ]);
  if (!comic) notFound();

  const active = (chapters ?? []).filter((c) => !c.deleted_at);
  const gone = (chapters ?? []).filter((c) => c.deleted_at);
  const highest = active.length ? Number(active[0].number) : 0;
  const suggested = String(Math.floor(highest) + 1);
  const nowIso = new Date(now).toISOString();

  return (
    <>
      <Link href={`/admin/comics/${comic.id}`} className="text-sm text-fg-soft hover:text-accent-fg">← {comic.title}</Link>
      <div className="mt-3">
        <AdminHeader
          title="Chapters"
          subtitle={
            <>
              {comic.title}
              {comic.is_published ? "" : " (the comic itself is still a draft, so readers can't see any chapters yet)"}
            </>
          }
        />
      </div>
      {removed === "1" ? <Notice>Chapter removed. You can restore it below.</Notice> : null}
      {comic.deleted_at ? <Notice tone="warning">This comic is in the trash.</Notice> : null}

      <NewChapterForm comicId={comic.id} suggestedNumber={suggested} />

      <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface text-left text-xs text-muted">
              <th scope="col" className="px-4 py-3 font-semibold">Chapter</th>
              <th scope="col" className="px-3 py-3 font-semibold">Status</th>
              <th scope="col" className="px-3 py-3 font-semibold">Pages</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {active.map((ch) => {
              const scheduled = ch.status === "published" && ch.published_at !== null && ch.published_at > nowIso;
              const pages = ch.chapter_images[0]?.count ?? 0;
              return (
                <tr key={ch.id} className="border-t border-line bg-panel">
                  <td className="px-4 py-3">
                    <Link href={`/admin/comics/${comic.id}/chapters/${ch.id}`} className="font-semibold hover:text-accent-fg">
                      Chapter {chapterNumber(ch.number)}
                    </Link>
                    {ch.title ? <span className="ml-2 text-muted">{ch.title}</span> : null}
                  </td>
                  <td className="px-3 py-3">
                    {ch.status === "draft" ? (
                      <span className="rounded-md bg-line px-2 py-0.5 text-[11px] font-semibold text-fg-soft">Draft</span>
                    ) : scheduled && ch.published_at ? (
                      <span className="rounded-md bg-hiatus-bg px-2 py-0.5 text-[11px] font-semibold text-hiatus">
                        Scheduled · <LocalTime iso={ch.published_at} />
                      </span>
                    ) : (
                      <span className="rounded-md bg-ongoing-bg px-2 py-0.5 text-[11px] font-semibold text-ongoing">
                        Released {timeAgo(ch.published_at, now)}
                      </span>
                    )}
                  </td>
                  <td className={`px-3 py-3 ${pages ? "text-fg-soft" : "text-hiatus"}`}>{pages || "None yet"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/comics/${comic.id}/chapters/${ch.id}`} className="font-semibold text-fg-soft hover:text-accent-fg">Edit</Link>
                  </td>
                </tr>
              );
            })}
            {!active.length ? (
              <tr className="border-t border-line bg-panel">
                <td colSpan={4} className="px-4 py-8 text-center text-muted">No chapters yet. Create the first one above.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {gone.length ? (
        <section aria-labelledby="removed-heading" className="mt-8">
          <h2 id="removed-heading" className="mb-2 font-display text-lg font-bold">Removed chapters</h2>
          <p className="mb-3 text-sm text-muted">Hidden from readers. Restore them, or {isOwner ? "delete them permanently" : "ask the owner to delete them permanently"}.</p>
          <ul className="flex flex-col gap-2">
            {gone.map((ch) => (
              <li key={ch.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                <span className="flex-1 font-semibold">Chapter {chapterNumber(ch.number)}{ch.title ? ` · ${ch.title}` : ""}</span>
                <span className="text-muted">removed {timeAgo(ch.deleted_at, now)}</span>
                <form action={restoreChapter.bind(null, ch.id)}>
                  <button type="submit" className="h-9 rounded-[10px] border border-line-strong px-3 font-semibold hover:bg-surface-2">Restore</button>
                </form>
                {isOwner ? <DeleteChapterForeverButton chapterId={ch.id} label={`Chapter ${chapterNumber(ch.number)}`} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
