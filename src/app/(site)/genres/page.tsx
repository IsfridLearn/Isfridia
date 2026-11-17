import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageTitle } from "@/components/ui/section-heading";
import { getGenres } from "@/lib/catalog/queries";

export const metadata: Metadata = {
  title: "Genres",
  description: "Find your next series by genre.",
};

export default async function GenresPage() {
  const genres = await getGenres();
  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-8 sm:px-6">
      <PageTitle subtitle="Pick a genre to see every series in it.">Genres</PageTitle>
      {genres.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {genres.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/genres/${g.slug}`}
                className="flex h-full flex-col gap-1 rounded-[14px] border border-line bg-surface p-4 transition hover:border-line-strong hover:bg-surface-2"
              >
                <span className="font-display text-lg font-bold">{g.name}</span>
                <span className="text-sm text-muted">{g.count === 1 ? "1 series" : `${g.count} series`}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No genres yet" />
      )}
    </div>
  );
}
