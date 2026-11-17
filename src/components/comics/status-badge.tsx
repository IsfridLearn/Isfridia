import { STATUS_LABEL, type ComicStatus } from "@/lib/format";

const STYLE: Record<ComicStatus, string> = {
  ongoing: "bg-ongoing-bg text-ongoing",
  completed: "bg-completed-bg text-completed",
  hiatus: "bg-hiatus-bg text-hiatus",
  cancelled: "bg-surface-2 text-fg-soft",
};

export function StatusBadge({ status, className = "" }: { status: ComicStatus; className?: string }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${STYLE[status]} ${className}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function NewBadge() {
  return (
    <span className="rounded-[5px] bg-accent px-1.5 py-px text-[10px] font-extrabold tracking-wider text-on-accent">
      NEW
    </span>
  );
}
