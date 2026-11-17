import type { Metadata } from "next";
import Form from "next/form";
import { Suspense } from "react";
import { AdminHeader, Notice } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/require-admin";
import { setAdminRole } from "./actions";

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <>
      <AdminHeader title="Users" subtitle="Registered readers and their roles. Emails are kept private." />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <UserTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function UserTable({ searchParams }: { searchParams: PageProps<"/admin/users">["searchParams"] }) {
  const { supabase, userId: me } = await requireAdminPage("/admin/users");
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 24) : "";

  let query = supabase.from("profiles").select("id, username, display_name, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(100);
  if (q) query = query.ilike("username", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const [{ data: users, count }, { data: roles }, { data: isOwner }] = await Promise.all([
    query,
    supabase.from("admin_permissions").select("user_id, role"),
    supabase.rpc("is_owner"),
  ]);
  const roleOf = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

  return (
    <div className="flex flex-col gap-4">
      {!isOwner ? <Notice tone="warning">Only the site owner can give or remove admin rights.</Notice> : null}
      <Form action="/admin/users" className="flex max-w-md gap-2" key={q}>
        <label htmlFor="user-q" className="sr-only">Search by username</label>
        <input id="user-q" name="q" type="search" defaultValue={q} maxLength={24} placeholder="Search by username" className="h-10 min-w-0 flex-1 rounded-[10px] border border-line-strong bg-surface px-3 text-sm placeholder:text-faint" />
        <button type="submit" className="h-10 rounded-[10px] border border-line-strong px-4 text-sm font-semibold hover:bg-surface-2">Search</button>
      </Form>
      <p className="text-sm text-muted">{count ?? 0} {q ? "matching" : "registered"} user{count === 1 ? "" : "s"}{count && count > 100 ? " (showing the newest 100)" : ""}</p>

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface text-left text-xs text-muted">
              <th scope="col" className="px-4 py-3 font-semibold">User</th>
              <th scope="col" className="px-3 py-3 font-semibold">Joined</th>
              <th scope="col" className="px-3 py-3 font-semibold">Role</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => {
              const role = roleOf.get(u.id);
              return (
                <tr key={u.id} className="border-t border-line bg-panel">
                  <td className="px-4 py-3">
                    <span className="font-semibold">{u.username}</span>
                    {u.display_name ? <span className="ml-2 text-muted">{u.display_name}</span> : null}
                    {u.id === me ? <span className="ml-2 text-xs text-faint">(you)</span> : null}
                  </td>
                  <td className="px-3 py-3 text-muted">{new Date(u.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${role === "owner" ? "bg-completed-bg text-completed" : role === "admin" ? "bg-accent-soft text-accent-fg" : "bg-line text-fg-soft"}`}>
                      {role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Reader"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isOwner && u.id !== me && role !== "owner" ? (
                      <form action={setAdminRole.bind(null, u.id, role !== "admin")}>
                        <button type="submit" aria-label={role === "admin" ? `Remove admin from ${u.username}` : `Make ${u.username} an admin`} className={`h-9 rounded-[10px] border px-3 text-sm font-semibold ${role === "admin" ? "border-danger-strong/50 text-danger hover:bg-danger-strong/10" : "border-line-strong hover:bg-surface-2"}`}>
                          {role === "admin" ? "Remove admin" : "Make admin"}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {!users?.length ? (
              <tr className="border-t border-line bg-panel">
                <td colSpan={4} className="px-4 py-8 text-center text-muted">No users found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
