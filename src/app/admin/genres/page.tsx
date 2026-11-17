import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { deleteGenre } from "./actions";
import { AddGenreForm, RenameGenreForm } from "./genre-forms";

export const metadata: Metadata = { title: "Genres" };

export default function AdminGenresPage() {
  return (
    <>
      <AdminHeader title="Genres" subtitle="Add, rename or remove genres. Renaming keeps the genre's web address." />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <GenreList />
      </Suspense>
    </>
  );
}

async function GenreList() {
  const { supabase } = await requireAdminPage("/admin/genres");
  const { data: genres } = await supabase.from("genres").select("id, name, slug, comic_genres(count)").order("name");

  return (
    <div className="flex flex-col gap-5">
      <AddGenreForm />
      <ul className="overflow-hidden rounded-2xl border border-line">
        {(genres ?? []).map((g) => {
          const count = g.comic_genres[0]?.count ?? 0;
          return (
            <li key={g.id} className="flex flex-wrap items-center gap-3 border-t border-line bg-panel px-4 py-3 first:border-t-0">
              <RenameGenreForm id={g.id} name={g.name} />
              <Link href={`/genres/${g.slug}`} className="text-sm text-muted hover:text-accent-fg">
                /genres/{g.slug}
              </Link>
              <span className="w-24 text-sm text-muted">{count === 1 ? "1 comic" : `${count} comics`}</span>
              <details>
                <summary className="flex h-9 cursor-pointer list-none items-center rounded-[10px] px-3 text-sm font-semibold text-danger hover:bg-danger-strong/10">
                  Delete…
                </summary>
                <form action={deleteGenre.bind(null, g.id)} className="mt-2 flex flex-col gap-2 rounded-xl border border-danger-strong/40 p-3 text-sm">
                  <p className="text-fg-soft">
                    Remove <span className="font-semibold">{g.name}</span>
                    {count ? ` from ${count} comic${count === 1 ? "" : "s"}` : ""}? The comics themselves stay.
                  </p>
                  <button type="submit" className="h-9 rounded-[10px] bg-danger-strong px-3 font-bold text-white">Delete genre</button>
                </form>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
