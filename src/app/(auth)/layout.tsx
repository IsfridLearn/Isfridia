import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/brand/logo";

// Shared frame for login, register and password pages: logo + centred card.
// "(auth)" in the folder name groups these routes without adding to the URL.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12 sm:py-20">
      <Link href="/" className="mb-8 flex items-center gap-2.5" aria-label="Isfridia home">
        <LogoMark size={32} />
        <Wordmark className="text-2xl" />
      </Link>
      <div className="w-full max-w-[420px] rounded-2xl border border-line bg-panel p-6 sm:p-8">
        {children}
      </div>
    </main>
  );
}
