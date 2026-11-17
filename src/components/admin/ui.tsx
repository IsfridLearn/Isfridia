import Link from "next/link";

// Small building blocks shared by admin pages.

export function AdminHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex h-10 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-bold text-on-accent transition hover:brightness-110">
      {children}
    </Link>
  );
}

export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Notice({ tone = "success", children }: { tone?: "success" | "warning" | "error"; children: React.ReactNode }) {
  const style = {
    success: "border-ongoing/30 bg-ongoing-bg text-ongoing",
    warning: "border-hiatus/30 bg-hiatus-bg text-hiatus",
    error: "border-danger-strong/40 bg-danger-strong/10 text-danger",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`mb-5 rounded-xl border px-4 py-3 text-sm ${style}`}>
      {children}
    </p>
  );
}

// An on/off switch that submits a server action. Works without JavaScript.
export function SwitchForm({
  action,
  checked,
  label,
}: {
  action: () => Promise<void>;
  checked: boolean;
  label: string;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        title={label}
        className={`relative h-6 w-10 rounded-full transition ${checked ? "bg-accent" : "bg-line-strong"}`}
      >
        <span
          className={`absolute top-[3px] left-[3px] size-[18px] rounded-full transition ${checked ? "translate-x-4 bg-on-accent" : "bg-fg-soft"}`}
        />
      </button>
    </form>
  );
}
