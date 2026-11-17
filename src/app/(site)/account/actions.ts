"use server";

// The logged-in reader's own profile and password. RLS only lets a reader
// change their own profile (and only username / display name).

import { refresh } from "next/cache";
import { z } from "zod";
import { userForAction } from "@/lib/auth/require-user";

export type AccountFormState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string>; submission?: number };

const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, { error: "3–24 characters: lowercase letters, numbers or _." }),
  displayName: z.string().trim().max(50, { error: "50 characters at most." }),
});

export async function updateProfile(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const done = (s: AccountFormState): AccountFormState => ({ ...s, submission: Date.now() });
  const user = await userForAction();
  if (!user) return done({ message: "Your login expired. Log in again." });

  const parsed = profileSchema.safeParse({ username: formData.get("username") ?? "", displayName: formData.get("displayName") ?? "" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return done({ fieldErrors });
  }

  const { error } = await user.supabase
    .from("profiles")
    .update({ username: parsed.data.username, display_name: parsed.data.displayName || null })
    .eq("id", user.userId);
  if (error?.code === "23505") return done({ fieldErrors: { username: "That username is taken." } });
  if (error) return done({ message: "Couldn't save your profile. Try again." });

  refresh();
  return done({ ok: true, message: "Profile saved." });
}

const passwordSchema = z
  .object({
    password: z.string().min(8, { error: "Use at least 8 characters." }).max(72, { error: "Use 72 characters or fewer." }),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { error: "Passwords don't match.", path: ["confirm"] });

export async function changePassword(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const done = (s: AccountFormState): AccountFormState => ({ ...s, submission: Date.now() });
  const user = await userForAction();
  if (!user) return done({ message: "Your login expired. Log in again." });

  const parsed = passwordSchema.safeParse({ password: formData.get("password") ?? "", confirm: formData.get("confirm") ?? "" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return done({ fieldErrors });
  }

  const { error } = await user.supabase.auth.updateUser({ password: parsed.data.password });
  if (error?.code === "same_password") return done({ fieldErrors: { password: "That's your current password. Choose a new one." } });
  if (error?.code === "weak_password") return done({ fieldErrors: { password: error.message } });
  if (error) return done({ message: "Couldn't change your password. Try again." });
  return done({ ok: true, message: "Password changed." });
}
