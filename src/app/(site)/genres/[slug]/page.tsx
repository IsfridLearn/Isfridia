import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CatalogResults } from "@/components/catalog/catalog-results";
import { ComicGridSkeleton } from "@/components/comics/comic-card";
import { PageTitle } from "@/components/ui/section-heading";
import { getGenres } from "@/lib/catalog/queries";

export async function generateMetadata({ params }: PageProps<"/genres/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const genre = (await getGenres()).find((g) => g.slug === slug);
  return genre
    ? { title: `${genre.name} comics`, description: `Every ${genre.name} series on IsfridVerse.` }
    : { title: "Genre not found" };
}

export default function GenrePage(props: PageProps<"/genres/[slug]">) {
  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-8 sm:px-6">
      <Suspense fallback={<ComicGridSkeleton />}>
        <GenreContent {...props} />
      </Suspense>
    </div>
  );
}

async function GenreContent({ params, searchParams }: PageProps<"/genres/[slug]">) {
  const { slug } = await params;
  const genre = (await getGenres()).find((g) => g.slug === slug);
  if (!genre) notFound();

  return (
    <>
      <Link href="/genres" className="text-sm text-fg-soft hover:text-accent-fg">
        ← All genres
      </Link>
      <div className="mt-3">
        <PageTitle>{genre.name}</PageTitle>
      </div>
      <CatalogResults searchParams={searchParams} basePath={`/genres/${genre.slug}`} fixed={{ genre: genre.slug }} />
    </>
  );
}
