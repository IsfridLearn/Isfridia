"use server";

// Owner-only: give or take away admin rights. The database's rules enforce the
// same thing (owners only, never your own row, never another owner).

import { refresh } from "next/cache";
import { z } from "zod";
import { adminForAction } from "@/lib/auth/require-admin";

const uuid = z.uuid();

export async function setAdminRole(userId: string, makeAdmin: boolean): Promise<void> {
  if (!uuid.safeParse(userId).success) return;
  const admin = await adminForAction();
  if (!admin || admin.userId === userId) return;
  const { data: isOwner } = await admin.supabase.rpc("is_owner");
  if (!isOwner) return;

  if (makeAdmin) {
    await admin.supabase.from("admin_permissions").insert({ user_id: userId, role: "admin", granted_by: admin.userId });
  } else {
    await admin.supabase.from("admin_permissions").delete().eq("user_id", userId).eq("role", "admin");
  }
  refresh();
}
