import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogResults } from "@/components/catalog/catalog-results";
import { ComicGridSkeleton } from "@/components/comics/comic-card";
import { PageTitle } from "@/components/ui/section-heading";

export const metadata: Metadata = {
  title: "Search",
  // Search result pages shouldn't be indexed by search engines.
  robots: { index: false },
};

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-8 sm:px-6">
      <PageTitle subtitle="Search by title, alternative title, author or artist.">Search</PageTitle>
      <Suspense fallback={<ComicGridSkeleton />}>
        <CatalogResults searchParams={searchParams} basePath="/search" />
      </Suspense>
    </div>
  );
}
