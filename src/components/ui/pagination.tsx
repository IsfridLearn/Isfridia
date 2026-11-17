import Link from "next/link";

// "← Previous   Page 2 of 5   Next →". hrefFor builds the URL for a page.
export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const linkClass =
    "flex h-11 items-center rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold transition hover:bg-surface-2";
  return (
    <nav aria-label="Pages" className="mt-10 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass} rel="prev">
          ← Previous
        </Link>
      ) : null}
      <span className="px-2 text-sm text-muted">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={linkClass} rel="next">
          Next →
        </Link>
      ) : null}
    </nav>
  );
}
