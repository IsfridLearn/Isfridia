"use client";

import { useActionState, useTransition, useState } from "react";
import { createChapter, deleteChapterForever, type NewChapterState } from "./actions";

export function NewChapterForm({ comicId, suggestedNumber }: { comicId: string; suggestedNumber: string }) {
  const [state, action, pending] = useActionState<NewChapterState, FormData>(createChapter.bind(null, comicId), {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-number" className="text-sm font-semibold text-fg-soft">Number</label>
        <input id="new-number" name="number" defaultValue={suggestedNumber} inputMode="decimal" maxLength={8} className="h-10 w-28 rounded-[10px] border border-line-strong bg-canvas px-3" />
      </div>
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
        <label htmlFor="new-title" className="text-sm font-semibold text-fg-soft">Title (optional)</label>
        <input id="new-title" name="title" maxLength={200} className="h-10 rounded-[10px] border border-line-strong bg-canvas px-3" />
      </div>
      <button type="submit" disabled={pending} className="h-10 rounded-[10px] bg-accent px-4 text-sm font-bold text-on-accent hover:brightness-110 disabled:opacity-60">
        {pending ? "Creating…" : "+ New chapter"}
      </button>
      {state.error ? <p role="alert" className="w-full text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

export function DeleteChapterForeverButton({ chapterId, label }: { chapterId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Permanently delete ${label} and all its pages? This can't be undone.`)) return;
          startTransition(async () => {
            const res = await deleteChapterForever(chapterId);
            if (res.error) setError(res.error);
          });
        }}
        className="h-9 rounded-[10px] px-3 text-sm font-semibold text-danger hover:bg-danger-strong/10 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete forever"}
      </button>
      {error ? <span role="alert" className="text-sm text-danger">{error}</span> : null}
    </span>
  );
}
