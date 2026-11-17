import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the link in the password-reset email. That link logs the user
// in briefly (via /auth/confirm) so they can set a new password here.
export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Choose a new password</h1>
        <p className="mt-1 text-muted">You&apos;ll stay logged in after saving it.</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
