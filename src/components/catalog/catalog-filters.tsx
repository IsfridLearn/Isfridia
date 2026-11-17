import Form from "next/form";
import Link from "next/link";
import { SORTS, STATUSES, TYPES, type CatalogFilters } from "@/lib/catalog/filters";
import type { GenreWithCount } from "@/lib/catalog/queries";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/format";

// The filter bar. A plain GET form: choosing options and pressing Apply loads
// the same page with ?genre=…&status=… in the URL, so filtered pages can be
// bookmarked and shared, and it works without JavaScript.
export function CatalogFiltersBar({
  action,
  filters,
  genres,
  hideGenre = false,
}: {
  action: string;
  filters: CatalogFilters;
  genres: GenreWithCount[];
  hideGenre?: boolean;
}) {
  const field = "flex flex-[1_1_150px] flex-col gap-1.5 text-xs font-semibold text-muted";
  const control = "h-[42px] rounded-[10px] border border-line-strong bg-sunken px-2.5 text-sm text-fg";
  return (
    <Form
      action={action}
      // A new key resets the fields when the URL changes (e.g. after Reset).
      key={JSON.stringify(filters)}
      className="flex flex-wrap items-end gap-3 rounded-[14px] border border-line bg-surface p-3.5"
    >
      <label className={`${field} flex-[2_1_220px]`}>
        Title or author
        <input name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder="e.g. Ashen Crown" className={`${control} px-3 placeholder:text-faint`} />
      </label>
      {hideGenre ? null : (
        <label className={field}>
          Genre
          <select name="genre" defaultValue={filters.genre} className={control}>
            <option value="">Any genre</option>
            {genres.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={field}>
        Status
        <select name="status" defaultValue={filters.status} className={control}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        Type
        <select name="type" defaultValue={filters.type} className={control}>
          <option value="">Any type</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        Sort by
        <select name="sort" defaultValue={filters.sort} className={control}>
          {Object.entries(SORTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button type="submit" className="h-[42px] rounded-[10px] bg-accent px-4 text-sm font-bold text-on-accent transition hover:brightness-110">
          Apply
        </button>
        <Link href={action} className="flex h-[42px] items-center rounded-[10px] border border-line-strong px-4 text-sm font-semibold text-fg-soft hover:bg-surface-2">
          Reset
        </Link>
      </div>
    </Form>
  );
}
