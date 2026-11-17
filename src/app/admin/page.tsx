import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminHeader, Panel, PrimaryLink } from "@/components/admin/ui";
import { StatusBadge } from "@/components/comics/status-badge";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { chapterNumber, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

export default function AdminOverviewPage() {
  return (
    <>
      <AdminHeader title="Overview" action={<PrimaryLink href="/admin/comics/new">+ New comic</PrimaryLink>} />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  const { supabase, now } = await requireAdminPage("/admin");
  const nowIso = new Date(now).toISOString();
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString().slice(0, 10);
  const count = { count: "exact", head: true } as const;

  const [published, drafts, released, scheduled, users, views, recentComics, chapters, activity, pageSizes] = await Promise.all([
    supabase.from("comics").select("id", count).eq("is_published", true).is("deleted_at", null),
    supabase.from("comics").select("id", count).eq("is_published", false).is("deleted_at", null),
    supabase.from("chapters").select("id", count).eq("status", "published").lte("published_at", nowIso).is("deleted_at", null),
    supabase.from("chapters").select("id", count).eq("status", "published").gt("published_at", nowIso).is("deleted_at", null),
    supabase.from("profiles").select("id", count),
    supabase.from("comic_views_daily").select("views").gt("day", weekAgo).limit(10_000),
    supabase.from("comics").select("id, title, slug, status, is_published, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
    supabase
      .from("chapters")
      .select("id, number, status, published_at, comics!inner(title, id)")
      .is("deleted_at", null)
      .order("published_at", { ascending: false, nullsFirst: true })
      .limit(6),
    supabase.from("audit_log").select("id, actor_id, action, table_name, old_data, new_data, created_at").neq("table_name", "comic_genres").order("created_at", { ascending: false }).limit(8),
    supabase.from("chapter_images").select("bytes").limit(100_000),
  ]);

  const views7d = (views.data ?? []).reduce((sum, row) => sum + row.views, 0);
  // Free Supabase plan: 1 GB of file storage. Covers are tiny; chapter pages
  // are what fills it.
  const storedMb = (pageSizes.data ?? []).reduce((sum, row) => sum + row.bytes, 0) / 1024 / 1024;
  const storedShare = Math.min(100, (storedMb / 1024) * 100);
  const actorIds = [...new Set((activity.data ?? []).map((a) => a.actor_id).filter((x): x is string => Boolean(x)))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, username").in("id", actorIds)
    : { data: [] as { id: string; username: string }[] };
  const nameOf = new Map((actors ?? []).map((a) => [a.id, a.username]));

  const stats = [
    { label: "Published comics", value: published.count ?? 0, sub: `${drafts.count ?? 0} draft${drafts.count === 1 ? "" : "s"}` },
    { label: "Released chapters", value: released.count ?? 0, sub: `${scheduled.count ?? 0} scheduled` },
    { label: "Registered users", value: users.count ?? 0, sub: "accounts" },
    { label: "Chapter views, 7 days", value: views7d, sub: "includes demo numbers" },
  ];
  const storageTone = storedShare >= 85 ? "bg-danger-strong" : storedShare >= 60 ? "bg-hiatus" : "bg-accent";

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="storage-heading" className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="storage-heading" className="text-sm font-semibold text-muted">Image storage (free plan: 1 GB)</h2>
          <span className="text-sm font-semibold">
            {storedMb.toFixed(1)} MB used · {storedShare.toFixed(1)}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-labelledby="storage-heading"
          aria-valuenow={Math.round(storedShare)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 overflow-hidden rounded-full bg-line-strong"
        >
          <div className={`h-full ${storageTone}`} style={{ width: `${Math.max(storedShare, storedMb > 0 ? 1 : 0)}%` }} />
        </div>
        {storedShare >= 60 ? (
          <p className="text-xs text-hiatus">Getting full. Plan the move to Cloudflare R2 (10 GB free) or the Supabase Pro plan.</p>
        ) : null}
      </section>

      <section aria-label="Statistics" className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
            <span className="text-sm font-semibold text-muted">{s.label}</span>
            <span className="font-display text-3xl font-bold">{s.value.toLocaleString("en-US")}</span>
            <span className="text-xs text-muted">{s.sub}</span>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Recently added comics" action={<Link href="/admin/comics" className="text-sm font-semibold text-muted hover:text-accent-fg">All comics →</Link>}>
          <ul>
            {(recentComics.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-t border-line px-4 py-3 sm:px-5">
                <Link href={`/admin/comics/${c.id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-accent-fg">
                  {c.title}
                </Link>
                <StatusBadge status={c.status} />
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${c.is_published ? "bg-ongoing-bg text-ongoing" : "bg-line text-fg-soft"}`}>
                  {c.is_published ? "Published" : "Draft"}
                </span>
              </li>
            ))}
            {!recentComics.data?.length ? <li className="border-t border-line px-5 py-4 text-muted">No comics yet.</li> : null}
          </ul>
        </Panel>

        <Panel title="Latest and scheduled chapters">
          <ul>
            {(chapters.data ?? []).map((ch) => {
              const state = ch.status === "draft" ? "Draft" : ch.published_at && ch.published_at > nowIso ? "Scheduled" : "Released";
              const tone = state === "Released" ? "bg-ongoing-bg text-ongoing" : state === "Scheduled" ? "bg-hiatus-bg text-hiatus" : "bg-line text-fg-soft";
              return (
                <li key={ch.id} className="flex items-center gap-3 border-t border-line px-4 py-3 text-sm sm:px-5">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold">{ch.comics.title}</span> · Ch. {chapterNumber(ch.number)}
                  </span>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{state}</span>
                  <span className="w-24 text-right text-muted">
                    {ch.published_at ? (state === "Scheduled" ? new Date(ch.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : timeAgo(ch.published_at, now)) : "-"}
                  </span>
                </li>
              );
            })}
            {!chapters.data?.length ? <li className="border-t border-line px-5 py-4 text-muted">No chapters yet. Chapter uploads arrive in the next phase.</li> : null}
          </ul>
        </Panel>
      </div>

      <Panel title="Recent activity">
        <ul>
          {(activity.data ?? []).map((a) => {
            const data = (a.new_data ?? a.old_data) as { title?: string; name?: string; deleted_at?: string | null } | null;
            const oldData = a.old_data as { deleted_at?: string | null } | null;
            const thing = a.table_name === "genres" ? "genre" : "comic";
            const verb =
              a.action === "insert" ? "created" : a.action === "delete" ? "permanently deleted" : !oldData?.deleted_at && data?.deleted_at ? "moved to trash" : oldData?.deleted_at && !data?.deleted_at ? "restored" : "edited";
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-2 border-t border-line px-4 py-3 text-sm sm:px-5">
                <span className="font-semibold">{a.actor_id ? (nameOf.get(a.actor_id) ?? "An admin") : "A script"}</span>
                <span className="text-muted">
                  {verb} {thing}
                </span>
                <span className="font-semibold">{data?.title ?? data?.name ?? "-"}</span>
                <span className="ml-auto text-muted">{timeAgo(a.created_at, now)}</span>
              </li>
            );
          })}
          {!activity.data?.length ? <li className="border-t border-line px-5 py-4 text-muted">Nothing yet.</li> : null}
        </ul>
      </Panel>
    </div>
  );
}
