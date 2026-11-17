import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CoverArt } from "@/components/comics/cover-art";
import { EmptyState, PageTitle } from "@/components/ui/section-heading";
import { requireUserPage } from "@/lib/auth/require-user";
import { chapterPath } from "@/lib/chapter-path";
import { getRecentlyRead } from "@/lib/user/library";
import { clearHistory, removeFromHistory } from "../library-actions";
import { ClearHistoryButton } from "./clear-history-button";

export const metadata: Metadata = { title: "Reading history", robots: { index: false } };

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-[960px] px-4 pt-8 sm:px-6">
      <PageTitle subtitle="Comics you've read recently, where you left off.">Reading history</PageTitle>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <HistoryList />
      </Suspense>
    </div>
  );
}

async function HistoryList() {
  const { supabase, now } = await requireUserPage("/history");
  const entries = await getRecentlyRead(supabase, 100, now);

  if (!entries.length) {
    return (
      <EmptyState title="Nothing read yet">
        Chapters you open while logged in show up here. <Link href="/comics" className="font-semibold text-accent-fg hover:underline">Find something to read</Link>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <ClearHistoryButton action={clearHistory} />
      </div>
      <ul className="overflow-hidden rounded-[14px] border border-line">
        {entries.map((e) => {
          const finished = e.progress >= 0.95;
          return (
            <li key={e.comicId} className="flex items-center gap-4 border-t border-line bg-panel px-4 py-3 first:border-t-0">
              <Link href={`/comics/${e.slug}`} tabIndex={-1} aria-hidden="true" className="w-12 shrink-0">
                <CoverArt title={e.title} slug={e.slug} coverKey={e.coverKey} sizes="48px" decorative showTitle={false} className="rounded-md" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link href={`/comics/${e.slug}`} className="truncate font-semibold hover:text-accent-fg">{e.title}</Link>
                <span className="text-sm text-muted">
                  Chapter {e.chapterNumber} · {finished ? "finished" : `${Math.round(e.progress * 100)}%`} · {e.readAgo}
                </span>
                <span aria-hidden="true" className="block h-1 max-w-[220px] overflow-hidden rounded-full bg-line-strong">
                  <span className="block h-full bg-accent" style={{ width: `${Math.round(e.progress * 100)}%` }} />
                </span>
              </div>
              <Link href={chapterPath(e.slug, e.chapterNumber)} className="flex h-10 shrink-0 items-center rounded-[10px] bg-accent px-4 text-sm font-bold text-on-accent hover:brightness-110">
                {finished ? "Read again" : "Continue"}
              </Link>
              <form action={removeFromHistory.bind(null, e.comicId)}>
                <button type="submit" aria-label={`Remove ${e.title} from history`} title="Remove from history" className="flex size-10 items-center justify-center rounded-[10px] text-muted hover:bg-surface-2 hover:text-danger">
                  ✕
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
