"use client";

import { useActionState } from "react";
import { createGenre, renameGenre, type GenreFormState } from "./actions";

export function AddGenreForm() {
  const [state, action, pending] = useActionState<GenreFormState, FormData>(createGenre, {});
  return (
    <form key={state.ok ? state.submission : "add"} action={action} className="flex flex-wrap items-start gap-2">
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
        <label htmlFor="new-genre" className="sr-only">New genre name</label>
        <input id="new-genre" name="name" maxLength={40} placeholder="New genre, e.g. Isekai" className="h-10 rounded-[10px] border border-line-strong bg-surface px-3 text-sm placeholder:text-faint" />
        {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      </div>
      <button type="submit" disabled={pending} className="h-10 rounded-[10px] bg-accent px-4 text-sm font-bold text-on-accent hover:brightness-110 disabled:opacity-60">
        {pending ? "Adding…" : "Add genre"}
      </button>
    </form>
  );
}

export function RenameGenreForm({ id, name }: { id: number; name: string }) {
  const [state, action, pending] = useActionState<GenreFormState, FormData>(renameGenre, {});
  return (
    <form action={action} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`genre-${id}`} className="sr-only">Name for {name}</label>
      <input id={`genre-${id}`} name="name" defaultValue={name} maxLength={40} className="h-9 min-w-0 flex-[1_1_160px] rounded-[10px] border border-line-strong bg-surface px-3 text-sm" />
      <button type="submit" disabled={pending} className="h-9 rounded-[10px] border border-line-strong px-3 text-sm font-semibold hover:bg-surface-2 disabled:opacity-60">
        {pending ? "Saving…" : "Rename"}
      </button>
      {state.error ? <p role="alert" className="w-full text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
