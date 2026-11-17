import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { AdminHeader, PrimaryLink, SwitchForm } from "@/components/admin/ui";
import { CoverArt } from "@/components/comics/cover-art";
import { StatusBadge } from "@/components/comics/status-badge";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { timeAgo } from "@/lib/format";
import { setFeatured, setPublished } from "./actions";

export const metadata: Metadata = { title: "Comics" };

export default function AdminComicsPage({ searchParams }: PageProps<"/admin/comics">) {
  return (
    <>
      <AdminHeader
        title="Comics"
        subtitle="Create, edit, publish and feature series."
        action={<PrimaryLink href="/admin/comics/new">+ New comic</PrimaryLink>}
      />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <ComicTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const SHOW = { all: "All", published: "Published", draft: "Drafts" } as const;

async function ComicTable({ searchParams }: { searchParams: PageProps<"/admin/comics">["searchParams"] }) {
  const { supabase, now } = await requireAdminPage("/admin/comics");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const show = params.show === "published" || params.show === "draft" ? params.show : "all";

  let query = supabase
    .from("comics")
    .select("id, slug, title, status, is_published, is_featured, cover_key, updated_at, chapters(count)")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (q) query = query.ilike("search_text", `%${q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (show !== "all") query = query.eq("is_published", show === "published");
  const { data: comics, error } = await query;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Form action="/admin/comics" className="flex flex-[1_1_280px] gap-2" key={`${q}|${show}`}>
          <label htmlFor="comic-q" className="sr-only">Search comics</label>
          <input id="comic-q" name="q" type="search" defaultValue={q} placeholder="Search by title or author" maxLength={100} className="h-10 min-w-0 flex-1 rounded-[10px] border border-line-strong bg-surface px-3 text-sm placeholder:text-faint" />
          {show !== "all" ? <input type="hidden" name="show" value={show} /> : null}
          <button type="submit" className="h-10 rounded-[10px] border border-line-strong px-4 text-sm font-semibold hover:bg-surface-2">Search</button>
        </Form>
        <nav aria-label="Filter" className="flex gap-0.5 rounded-xl border border-line bg-surface p-1">
          {Object.entries(SHOW).map(([key, label]) => (
            <Link
              key={key}
              href={`/admin/comics?${new URLSearchParams({ ...(q ? { q } : {}), ...(key !== "all" ? { show: key } : {}) })}`}
              aria-current={show === key ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${show === key ? "bg-line-strong text-fg" : "text-muted hover:text-fg"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {error ? <p role="alert" className="text-danger">Could not load comics: {error.message}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface text-left text-xs text-muted">
              <th scope="col" className="px-4 py-3 font-semibold">Comic</th>
              <th scope="col" className="px-3 py-3 font-semibold">Status</th>
              <th scope="col" className="px-3 py-3 font-semibold">Published</th>
              <th scope="col" className="px-3 py-3 font-semibold">Featured</th>
              <th scope="col" className="px-3 py-3 font-semibold">Chapters</th>
              <th scope="col" className="px-3 py-3 font-semibold">Updated</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {(comics ?? []).map((c) => (
              <tr key={c.id} className="border-t border-line bg-panel">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <CoverArt title={c.title} slug={c.slug} coverKey={c.cover_key} sizes="36px" decorative showTitle={false} className="w-9 shrink-0 rounded-md" />
                    <div className="min-w-0">
                      <Link href={`/admin/comics/${c.id}`} className="block truncate font-semibold hover:text-accent-fg">{c.title}</Link>
                      <span className="block truncate text-xs text-faint">/comics/{c.slug}</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                <td className="px-3 py-2.5">
                  <SwitchForm action={setPublished.bind(null, c.id, !c.is_published)} checked={c.is_published} label={`Published: ${c.title}`} />
                </td>
                <td className="px-3 py-2.5">
                  <SwitchForm action={setFeatured.bind(null, c.id, !c.is_featured)} checked={c.is_featured} label={`Featured on the homepage: ${c.title}`} />
                </td>
                <td className="px-3 py-2.5">
                  <Link href={`/admin/comics/${c.id}/chapters`} className="font-semibold text-fg-soft hover:text-accent-fg" aria-label={`Chapters of ${c.title}`}>
                    {c.chapters[0]?.count ?? 0}
                  </Link>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted">{timeAgo(c.updated_at, now)}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/admin/comics/${c.id}`} className="font-semibold text-fg-soft hover:text-accent-fg">Edit</Link>
                </td>
              </tr>
            ))}
            {!comics?.length ? (
              <tr className="border-t border-line bg-panel">
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  {q || show !== "all" ? "No comics match." : "No comics yet. Create your first one."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Featured comics appear in the homepage banner when they are also published.</p>
    </div>
  );
}
