import Link from "next/link";

export function SectionHeading({
  id,
  children,
  href,
  linkLabel = "View all",
}: {
  id?: string;
  children: React.ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2.5 font-display text-[22px] font-bold tracking-tight">
        {children}
      </h2>
      {href ? (
        <Link href={href} className="shrink-0 text-sm font-semibold text-muted hover:text-accent-fg">
          {linkLabel} →
        </Link>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {children ? <div className="mt-2 text-muted">{children}</div> : null}
    </div>
  );
}

export function PageTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{children}</h1>
      {subtitle ? <p className="mt-1.5 text-muted">{subtitle}</p> : null}
    </div>
  );
}
