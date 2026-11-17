import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center">
      <LogoMark size={48} />
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Page not found</h1>
      <p className="max-w-sm text-muted">This page doesn&apos;t exist, or the comic isn&apos;t published.</p>
      <div className="flex gap-3">
        <Link href="/" className="flex h-11 items-center rounded-xl bg-accent px-5 font-bold text-on-accent hover:brightness-110">
          Go home
        </Link>
        <Link href="/comics" className="flex h-11 items-center rounded-xl border border-line-strong bg-surface px-5 font-semibold hover:bg-surface-2">
          Browse comics
        </Link>
      </div>
    </main>
  );
}
