import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminHeader, Notice } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { timeAgo } from "@/lib/format";
import { restoreFromTrash } from "../comics/actions";
import { DeleteForeverForm } from "./delete-forever-form";

export const metadata: Metadata = { title: "Trash" };

export default function TrashPage({ searchParams }: PageProps<"/admin/trash">) {
  return (
    <>
      <AdminHeader title="Trash" subtitle="Comics moved to the trash are hidden everywhere until restored." />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <TrashList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function TrashList({ searchParams }: { searchParams: PageProps<"/admin/trash">["searchParams"] }) {
  const { supabase, now } = await requireAdminPage("/admin/trash");
  const [{ trashed }, { data: comics }, { data: isOwner }] = await Promise.all([
    searchParams,
    supabase.from("comics").select("id, title, deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    supabase.rpc("is_owner"),
  ]);

  return (
    <>
      {trashed === "1" ? <Notice>Moved to the trash.</Notice> : null}
      {!isOwner ? <Notice tone="warning">Only the site owner can delete comics permanently. You can restore them.</Notice> : null}
      {comics?.length ? (
        <ul className="flex flex-col gap-2">
          {comics.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start gap-3 rounded-2xl border border-line bg-surface p-4">
              <div className="min-w-0 flex-[1_1_240px]">
                <p className="font-semibold">{c.title}</p>
                <p className="text-sm text-muted">Trashed {timeAgo(c.deleted_at, now)}</p>
              </div>
              <form action={restoreFromTrash.bind(null, c.id)}>
                <button type="submit" className="h-9 rounded-[10px] border border-line-strong px-3 text-sm font-semibold hover:bg-surface-2">
                  Restore
                </button>
              </form>
              {isOwner ? <DeleteForeverForm comicId={c.id} title={c.title} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-muted">The trash is empty.</p>
      )}
    </>
  );
}
