import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogResults } from "@/components/catalog/catalog-results";
import { ComicGridSkeleton } from "@/components/comics/comic-card";
import { PageTitle } from "@/components/ui/section-heading";

export const metadata: Metadata = {
  title: "Browse comics",
  description: "Browse every series on IsfridVerse by genre, status and type.",
};

export default function ComicsPage({ searchParams }: PageProps<"/comics">) {
  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-8 sm:px-6">
      <PageTitle subtitle="Every series in the library. Filter by genre, status or type.">Comics</PageTitle>
      <Suspense fallback={<ComicGridSkeleton />}>
        <CatalogResults searchParams={searchParams} basePath="/comics" />
      </Suspense>
    </div>
  );
}
