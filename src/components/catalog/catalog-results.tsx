import Link from "next/link";
import { ComicGrid } from "@/components/comics/comic-card";
import { EmptyState } from "@/components/ui/section-heading";
import { Pagination } from "@/components/ui/pagination";
import { filtersToQuery, parseFilters, type CatalogFilters } from "@/lib/catalog/filters";
import { browseComics, getGenres } from "@/lib/catalog/queries";
import { CatalogFiltersBar } from "./catalog-filters";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Shared by /comics, /search and /genres/[slug]: filter bar, results grid,
// empty state and pagination. Reads the URL, so it renders inside <Suspense>.
export async function CatalogResults({
  searchParams,
  basePath,
  fixed = {},
}: {
  searchParams: SearchParams;
  basePath: string;
  fixed?: Partial<CatalogFilters>;
}) {
  const filters = parseFilters(await searchParams, fixed);
  const [genres, result] = await Promise.all([getGenres(), browseComics(filters)]);
  const isFiltered = Boolean(filters.q || filters.status || filters.type || (!fixed.genre && filters.genre));
  // Pagination links must not repeat a genre that is already part of the path.
  const hrefFor = (page: number) =>
    `${basePath}${filtersToQuery({ ...filters, genre: fixed.genre ? "" : filters.genre, page })}`;

  return (
    <div className="flex flex-col gap-6">
      <CatalogFiltersBar action={basePath} filters={filters} genres={genres} hideGenre={Boolean(fixed.genre)} />
      <p className="text-sm text-muted" aria-live="polite">
        {result.total === 1 ? "1 comic" : `${result.total} comics`}
        {filters.q ? (
          <>
            {" "}
            matching <span className="font-semibold text-fg">“{filters.q}”</span>
          </>
        ) : null}
      </p>
      {result.items.length ? (
        <ComicGrid comics={result.items} />
      ) : (
        <EmptyState title={isFiltered ? "No comics match these filters" : "No comics here yet"}>
          {isFiltered ? (
            <Link href={basePath} className="font-semibold text-accent-fg hover:underline">
              Clear the filters
            </Link>
          ) : (
            "New series will show up here as soon as they're published."
          )}
        </EmptyState>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
    </div>
  );
}
