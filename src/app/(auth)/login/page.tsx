import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Log in</h1>
        <p className="mt-1 text-muted">Welcome back. Your bookmarks are waiting.</p>
      </div>
      {/* The form reads the URL (?next=, ?error=), which is only known per request. */}
      <Suspense>
        <LoginForm />
      </Suspense>
      <div className="flex flex-col gap-2 text-sm text-muted">
        <Link href="/forgot-password" className="text-fg-soft underline-offset-4 hover:underline">
          Forgot your password?
        </Link>
        <p>
          New here?{" "}
          <Link href="/register" className="font-semibold text-accent-fg underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
