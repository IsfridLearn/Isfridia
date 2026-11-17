"use server";

// Server Actions for logging in, registering and resetting passwords.
// They run only on the server. Input is validated here with zod, never trusted
// from the browser. Supabase Auth also rate-limits these endpoints.

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

type Field = "email" | "password" | "confirm" | "username";

export type AuthFormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Partial<Record<Field, string>>;
  // Echoed back so the form keeps what was typed after an error.
  email?: string;
  username?: string;
};

const email = z
  .email({ error: "Enter a valid email address." })
  .max(254, { error: "That email address is too long." });
const newPassword = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  .max(72, { error: "Use 72 characters or fewer." });
const username = z
  .string()
  .regex(/^[a-z0-9_]{3,24}$/, { error: "3–24 characters: lowercase letters, numbers or _." });

function read(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function toFieldErrors(error: z.ZodError): AuthFormState["fieldErrors"] {
  const out: Partial<Record<Field, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as Field;
    out[key] ??= issue.message;
  }
  return out;
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

const TOO_MANY = "Too many attempts. Wait a minute and try again.";

// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Enter your password." }),
});

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const typedEmail = read(formData, "email").trim();
  const parsed = loginSchema.safeParse({ email: typedEmail, password: read(formData, "password") });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), email: typedEmail };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { message: "Confirm your email first. Check your inbox for the link.", email: typedEmail };
    }
    if (error.status === 429) return { message: TOO_MANY, email: typedEmail };
    // Same message whether the email exists or not, so accounts can't be probed.
    return { message: "Email or password is incorrect.", email: typedEmail };
  }

  redirect(safeNextPath(read(formData, "next")));
}

// ---------------------------------------------------------------------------

const registerSchema = z
  .object({ email, username, password: newPassword, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { error: "Passwords don't match.", path: ["confirm"] });

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const typedEmail = read(formData, "email").trim();
  const typedUsername = read(formData, "username").trim().toLowerCase();
  const parsed = registerSchema.safeParse({
    email: typedEmail,
    username: typedUsername,
    password: read(formData, "password"),
    confirm: read(formData, "confirm"),
  });
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error), email: typedEmail, username: typedUsername };
  }

  const supabase = await createClient();

  const { data: taken, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", parsed.data.username)
    .maybeSingle();
  if (lookupError) {
    return { message: "Something went wrong. Please try again.", email: typedEmail, username: typedUsername };
  }
  if (taken) {
    return { fieldErrors: { username: "That username is taken." }, email: typedEmail, username: typedUsername };
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/confirm?next=/account`,
      data: { username: parsed.data.username },
    },
  });
  if (error) {
    if (error.status === 429) return { message: TOO_MANY, email: typedEmail, username: typedUsername };
    if (error.code === "weak_password") {
      return { fieldErrors: { password: error.message }, email: typedEmail, username: typedUsername };
    }
    return { message: "Could not create the account. Please try again.", email: typedEmail, username: typedUsername };
  }

  // If email confirmation is switched off in Supabase, the user is logged in now.
  if (data.session) redirect("/account");

  return {
    ok: true,
    message: "Almost done! We sent a confirmation link to your email. Open it to activate your account.",
  };
}

// ---------------------------------------------------------------------------

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const typedEmail = read(formData, "email").trim();
  const parsed = email.safeParse(typedEmail);
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0].message }, email: typedEmail };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/reset-password`,
  });
  if (error?.status === 429) return { message: TOO_MANY, email: typedEmail };

  // Same answer whether or not the account exists.
  return {
    ok: true,
    message: "If an account uses that email, a reset link is on its way. It expires in 1 hour.",
  };
}

// ---------------------------------------------------------------------------

const newPasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { error: "Passwords don't match.", path: ["confirm"] });

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = newPasswordSchema.safeParse({
    password: read(formData, "password"),
    confirm: read(formData, "confirm"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) {
    return { message: "Your reset link has expired. Request a new one from the Forgot password page." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { fieldErrors: { password: "Choose a password you haven't used here before." } };
    }
    if (error.code === "weak_password") return { fieldErrors: { password: error.message } };
    return { message: "Could not update the password. Please try again." };
  }

  redirect("/account");
}

// ---------------------------------------------------------------------------

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
