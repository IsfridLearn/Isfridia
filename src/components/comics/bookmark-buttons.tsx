"use client";

import { useState, useTransition } from "react";
import { setBookmark, setFavorite, type LibraryResult } from "@/app/(site)/library-actions";

// Bookmark + Favorite on a comic page, for a logged-in reader. The buttons
// change straight away and roll back if the server says no.
export function BookmarkButtons({ comicId, initial }: { comicId: string; initial: { bookmarked: boolean; favorite: boolean } }) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (next: typeof state, action: () => Promise<LibraryResult>) => {
    const before = state;
    setState(next);
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) {
        setState(before);
        setError(res.error === "login" ? "Your login expired. Log in again." : "Couldn't save that. Try again.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2.5">
        <button
          type="button"
          aria-pressed={state.bookmarked}
          disabled={pending}
          onClick={() =>
            run(state.bookmarked ? { bookmarked: false, favorite: false } : { ...state, bookmarked: true }, () => setBookmark(comicId, !state.bookmarked))
          }
          className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${
            state.bookmarked ? "border-accent/50 bg-accent-soft text-accent-fg" : "border-line-strong bg-surface hover:bg-surface-2"
          }`}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill={state.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          {state.bookmarked ? "Bookmarked" : "Bookmark"}
        </button>
        <button
          type="button"
          aria-pressed={state.favorite}
          aria-label="Favorite"
          title={state.favorite ? "Remove from favorites" : "Add to favorites"}
          disabled={pending}
          onClick={() => run({ bookmarked: true, favorite: !state.favorite }, () => setFavorite(comicId, !state.favorite))}
          className={`flex size-11 items-center justify-center rounded-xl border transition ${
            state.favorite ? "border-accent/50 bg-accent-soft text-accent-fg" : "border-line-strong bg-surface text-fg-soft hover:bg-surface-2"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={state.favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </button>
      </div>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
