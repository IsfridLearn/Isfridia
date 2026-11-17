import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ComicGrid, ComicGridSkeleton } from "@/components/comics/comic-card";
import { EmptyState, PageTitle } from "@/components/ui/section-heading";
import { getRankedComics, type RankPeriod } from "@/lib/catalog/queries";

export const metadata: Metadata = {
  title: "Popular",
  description: "The most-read series on IsfridVerse this week, this month and of all time.",
};

const PERIODS: { id: RankPeriod; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

export default function PopularPage({ searchParams }: PageProps<"/popular">) {
  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-8 sm:px-6">
      <PageTitle subtitle="Ranked by how many chapters readers opened.">Popular</PageTitle>
      <Suspense fallback={<ComicGridSkeleton />}>
        <Ranking searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Ranking({ searchParams }: { searchParams: PageProps<"/popular">["searchParams"] }) {
  const raw = (await searchParams).period;
  const period: RankPeriod = raw === "week" || raw === "all" ? raw : "month";
  const comics = await getRankedComics(period);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Time period" className="flex w-fit gap-0.5 rounded-xl border border-line bg-surface p-1">
        {PERIODS.map((p) => (
          <Link
            key={p.id}
            href={p.id === "month" ? "/popular" : `/popular?period=${p.id}`}
            aria-current={p.id === period ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              p.id === period ? "bg-line-strong text-fg" : "text-muted hover:text-fg"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      {comics.length ? <ComicGrid comics={comics} ranked /> : <EmptyState title="Nothing ranked yet" />}
    </div>
  );
}
