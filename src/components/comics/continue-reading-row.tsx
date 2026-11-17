import Link from "next/link";
import { connection } from "next/server";
import { CoverArt } from "@/components/comics/cover-art";
import { SectionHeading } from "@/components/ui/section-heading";
import { chapterPath } from "@/lib/chapter-path";
import { createClient } from "@/lib/supabase/server";
import { getRecentlyRead } from "@/lib/user/library";

// Homepage row for logged-in readers: comics they're in the middle of.
// Renders nothing for visitors or readers with no unfinished comics.
export async function ContinueReadingRow() {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth) return null;

  const entries = (await getRecentlyRead(supabase, 20)).filter((e) => e.progress < 0.95).slice(0, 6);
  if (!entries.length) return null;

  return (
    <section aria-labelledby="continue-heading">
      <SectionHeading id="continue-heading" href="/history" linkLabel="History">
        Continue reading
      </SectionHeading>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {entries.map((e) => (
          <li key={e.comicId}>
            <Link href={chapterPath(e.slug, e.chapterNumber)} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface p-2.5 transition hover:bg-surface-2">
              <CoverArt title={e.title} slug={e.slug} coverKey={e.coverKey} sizes="48px" decorative showTitle={false} className="w-12 shrink-0 rounded-md" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-semibold">{e.title}</span>
                <span className="text-sm text-muted">
                  Chapter {e.chapterNumber} · {Math.round(e.progress * 100)}%
                </span>
                <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full bg-line-strong">
                  <span className="block h-full bg-accent" style={{ width: `${Math.round(e.progress * 100)}%` }} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
