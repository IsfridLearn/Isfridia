import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Create account</h1>
        <p className="mt-1 text-muted">Save bookmarks and pick up where you left off on any device.</p>
      </div>
      <RegisterForm />
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent-fg underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
