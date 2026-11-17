"use client";

import { useActionState, useState } from "react";
import { CoverArt } from "@/components/comics/cover-art";
import { removeCover, uploadCover, type CoverState } from "./actions";

const MAX_BYTES = 4 * 1024 * 1024;

// Cover box on the edit page: current cover, choose a file (with a preview
// before uploading), upload, or remove. The server re-checks everything.
export function CoverUploader({ comicId, title, slug, coverKey }: { comicId: string; title: string; slug: string; coverKey: string | null }) {
  const [state, action, pending] = useActionState<CoverState, FormData>(uploadCover.bind(null, comicId), {});
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setLocalError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setLocalError("This file is larger than 4 MB. Choose a smaller one.");
      event.target.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  const message = localError ?? state.message;
  const isError = Boolean(localError) || state.ok === false;

  return (
    <div className="flex flex-col gap-3">
      {preview ? (
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl ring-2 ring-accent">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview of the new cover" className="absolute inset-0 size-full object-cover" />
          <span className="absolute top-2 left-2 rounded-md bg-canvas/80 px-2 py-0.5 text-[11px] font-bold">PREVIEW</span>
        </div>
      ) : (
        <CoverArt title={title} slug={slug} coverKey={coverKey} titleClassName="text-base" sizes="180px" />
      )}

      <form key={state.ok ? state.submission : "cover"} action={action} className="flex flex-col gap-2" onSubmit={() => setPreview(null)}>
        <label className="text-sm font-semibold text-fg-soft" htmlFor="cover-file">
          {coverKey ? "Replace cover" : "Upload cover"}
        </label>
        <input
          id="cover-file"
          name="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={onPick}
          className="text-sm text-muted file:mr-3 file:h-9 file:rounded-[10px] file:border file:border-line-strong file:bg-surface file:px-3 file:text-sm file:font-semibold file:text-fg"
        />
        <p className="text-xs text-muted">JPG, PNG, WebP or AVIF, up to 4 MB. Best at 600 × 900 or larger; it is cropped to 2:3.</p>
        <button
          type="submit"
          disabled={pending || !preview}
          className="h-10 rounded-[10px] bg-accent px-4 text-sm font-bold text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>

      {message ? (
        <p role={isError ? "alert" : "status"} className={`text-sm ${isError ? "text-danger" : "text-ongoing"}`}>
          {message}
        </p>
      ) : null}

      {coverKey && !preview ? (
        <form action={removeCover.bind(null, comicId)}>
          <button type="submit" className="text-sm font-semibold text-muted underline-offset-4 hover:text-danger hover:underline">
            Remove cover
          </button>
        </form>
      ) : null}
    </div>
  );
}
