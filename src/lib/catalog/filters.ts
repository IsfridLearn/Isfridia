// Turns URL query parameters (?genre=action&status=ongoing&sort=popular&page=2)
// into a safe, typed filter object. Anything invalid falls back to a default,
// so a hand-edited URL can never break a page or reach the database raw.

import { z } from "zod";

export const SORTS = {
  latest: "Latest update",
  popular: "Most popular",
  new: "Newest added",
  title: "Title A–Z",
} as const;
export type Sort = keyof typeof SORTS;

export { STATUSES, TYPES } from "./enums";
import { STATUSES, TYPES } from "./enums";

export type CatalogFilters = {
  q: string;
  genre: string;
  status: (typeof STATUSES)[number] | "";
  type: (typeof TYPES)[number] | "";
  sort: Sort;
  page: number;
};

const schema = z.object({
  q: z.string().trim().max(100).catch(""),
  genre: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(40).catch(""),
  status: z.enum(STATUSES).catch("" as never),
  type: z.enum(TYPES).catch("" as never),
  sort: z.enum(Object.keys(SORTS) as [Sort, ...Sort[]]).catch("latest"),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

type RawParams = Record<string, string | string[] | undefined>;

export function parseFilters(raw: RawParams, overrides: Partial<CatalogFilters> = {}): CatalogFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const parsed = schema.parse({
    q: first(raw.q) ?? "",
    genre: first(raw.genre) ?? "",
    status: first(raw.status) ?? "",
    type: first(raw.type) ?? "",
    sort: first(raw.sort) ?? "latest",
    page: first(raw.page) ?? 1,
  });
  return { ...parsed, ...overrides } as CatalogFilters;
}

// Builds a URL for the same page with some filters changed (used by
// pagination). Empty values and defaults are left out to keep URLs clean.
export function filtersToQuery(filters: Partial<CatalogFilters>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.status) params.set("status", filters.status);
  if (filters.type) params.set("type", filters.type);
  if (filters.sort && filters.sort !== "latest") params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const s = params.toString();
  return s ? `?${s}` : "";
}
