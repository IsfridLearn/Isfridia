"use client";

import { useActionState } from "react";
import { deleteForever, type DeleteState } from "../comics/actions";

// Permanent delete: the owner must type the comic's exact title.
export function DeleteForeverForm({ comicId, title }: { comicId: string; title: string }) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteForever, {});
  return (
    <details className="group">
      <summary className="flex h-9 cursor-pointer list-none items-center rounded-[10px] px-3 text-sm font-semibold text-danger hover:bg-danger-strong/10">
        Delete forever…
      </summary>
      <form action={action} className="mt-2 flex flex-col gap-2 rounded-xl border border-danger-strong/40 p-3">
        <input type="hidden" name="id" value={comicId} />
        <label className="text-sm text-fg-soft">
          This cannot be undone. Type <span className="font-semibold text-fg">{title}</span> to confirm:
          <input name="confirmTitle" autoComplete="off" className="mt-1.5 h-10 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-sm" />
        </label>
        {state.message ? <p role="alert" className="text-sm text-danger">{state.message}</p> : null}
        <button type="submit" disabled={pending} className="h-10 rounded-[10px] bg-danger-strong px-4 text-sm font-bold text-white disabled:opacity-60">
          {pending ? "Deleting…" : "Delete permanently"}
        </button>
      </form>
    </details>
  );
}
