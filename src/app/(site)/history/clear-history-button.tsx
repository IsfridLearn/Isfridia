"use client";

import { useTransition } from "react";

// Asks before wiping the whole reading history.
export function ClearHistoryButton({ action }: { action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Clear your whole reading history? Your bookmarks stay.")) startTransition(() => action());
      }}
      className="h-9 rounded-[10px] border border-line-strong px-3 text-sm font-semibold text-fg-soft hover:bg-surface-2 hover:text-danger disabled:opacity-60"
    >
      {pending ? "Clearing…" : "Clear history"}
    </button>
  );
}
