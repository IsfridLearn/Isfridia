import { createClient } from "@/lib/supabase/server";

// GET /account/export: the logged-in reader's own data as a JSON file.
// Runs as that reader, so RLS returns only their rows.
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth) return new Response("Log in first.", { status: 401 });

  const [profile, bookmarks, history] = await Promise.all([
    supabase.from("profiles").select("username, display_name, created_at").eq("id", auth.claims.sub).single(),
    supabase.from("bookmarks").select("is_favorite, created_at, comics(title, slug)"),
    supabase.from("reading_history").select("progress, updated_at, chapters(number), comics(title, slug)").order("updated_at", { ascending: false }),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    account: { email: auth.claims.email ?? null, ...profile.data },
    bookmarks: (bookmarks.data ?? []).map((b) => ({ comic: b.comics?.title, slug: b.comics?.slug, favorite: b.is_favorite, added: b.created_at })),
    reading_history: (history.data ?? []).map((h) => ({
      comic: h.comics?.title,
      slug: h.comics?.slug,
      chapter: h.chapters ? Number(h.chapters.number) : null,
      progress: h.progress,
      read_at: h.updated_at,
    })),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="isfridverse-my-data.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
