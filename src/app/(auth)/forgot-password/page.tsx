import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Forgot password</h1>
        <p className="mt-1 text-muted">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      </div>
      <ForgotPasswordForm />
      <Link href="/login" className="text-sm text-fg-soft underline-offset-4 hover:underline">
        Back to log in
      </Link>
    </div>
  );
}
