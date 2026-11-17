"use client";

import { useRef, useState } from "react";
import { naturalCompare, planPage } from "@/lib/images/page-plan";
import { createClient } from "@/lib/supabase/client";
import { addChapterPages } from "../actions";

// Bulk page upload. Everything heavy happens in the admin's browser:
//   decode -> resize/split (page-plan.ts) -> WebP -> upload straight to storage
// with a progress bar per file. Then the server checks the files and adds
// them as pages, in file-name order (page2 before page10).

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_PIECE_BYTES = 2 * 1024 * 1024;
const PARALLEL = 3;

type Piece = { path: string };
type Item = {
  key: string;
  file: File;
  status: "waiting" | "converting" | "uploading" | "done" | "error";
  progress: number; // 0..1
  pieces: Piece[];
  error?: string;
};

async function toWebpPieces(file: File): Promise<Blob[]> {
  if (file.size > MAX_INPUT_BYTES) throw new Error("Larger than 25 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Not an image this browser can read.");
  }
  try {
    const plan = planPage(bitmap.width, bitmap.height);
    const blobs: Blob[] = [];
    for (const seg of plan.segments) {
      const canvas = new OffscreenCanvas(plan.width, seg.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser can't process images.");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, seg.sourceY, bitmap.width, seg.sourceHeight, 0, 0, plan.width, seg.height);
      let blob: Blob | null = null;
      for (const quality of [0.86, 0.76, 0.62]) {
        blob = await canvas.convertToBlob({ type: "image/webp", quality });
        if (blob.type !== "image/webp") throw new Error("This browser can't create WebP images. Use Chrome, Edge, Opera or Firefox.");
        if (blob.size <= MAX_PIECE_BYTES) break;
      }
      if (!blob || blob.size > MAX_PIECE_BYTES) throw new Error("Too detailed to fit in 2 MB, even compressed.");
      blobs.push(blob);
    }
    return blobs;
  } finally {
    bitmap.close();
  }
}

function uploadWithProgress(url: string, token: string, apiKey: string, blob: Blob, onProgress: (f: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", apiKey);
    xhr.setRequestHeader("Content-Type", "image/webp");
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload refused (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(blob);
  });
}

export function PageUploader({ chapterId }: { chapterId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  async function processItem(item: Item, token: string): Promise<Item> {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;
    try {
      update(item.key, { status: "converting", progress: 0, error: undefined });
      const blobs = await toWebpPieces(item.file);
      update(item.key, { status: "uploading" });
      const total = blobs.reduce((s, b) => s + b.size, 0);
      let sent = 0;
      const pieces: Piece[] = [];
      for (const blob of blobs) {
        const path = `chapters/${chapterId}/${crypto.randomUUID()}.webp`;
        await uploadWithProgress(`${base}/storage/v1/object/images/${path}`, token, apiKey, blob, (f) =>
          update(item.key, { progress: (sent + f * blob.size) / total }),
        );
        sent += blob.size;
        pieces.push({ path });
      }
      const done = { ...item, status: "done" as const, progress: 1, pieces };
      update(item.key, done);
      return done;
    } catch (error) {
      const failed = { ...item, status: "error" as const, error: error instanceof Error ? error.message : "Failed." };
      update(item.key, failed);
      return failed;
    }
  }

  async function run(queue: Item[]) {
    setBusy(true);
    setSummary(null);
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setSummary({ tone: "error", text: "Your login expired. Reload the page and log in again." });
      setBusy(false);
      return;
    }

    // Convert + upload PARALLEL files at a time, keep results in file order.
    const results: Item[] = new Array(queue.length);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
        while (next < queue.length) {
          const i = next++;
          results[i] = await processItem(queue[i], token);
        }
      }),
    );

    const uploaded = results.filter((r) => r.status === "done").flatMap((r) => r.pieces);
    const failedCount = results.filter((r) => r.status === "error").length;
    if (uploaded.length) {
      const res = await addChapterPages(chapterId, uploaded);
      const rejected = res.rejected.length;
      const text = [
        res.added ? `${res.added} page${res.added === 1 ? "" : "s"} added.` : "",
        rejected ? `${rejected} file${rejected === 1 ? " was" : "s were"} rejected by the server check.` : "",
        failedCount ? `${failedCount} file${failedCount === 1 ? "" : "s"} failed. Use Retry below (retried pages go at the end).` : "",
        res.error ?? "",
      ]
        .filter(Boolean)
        .join(" ");
      setSummary({ tone: res.error || rejected || failedCount ? "error" : "ok", text });
      // Clear finished rows; keep the failed ones for retrying.
      setItems((list) => list.filter((it) => it.status === "error"));
    } else if (failedCount) {
      setSummary({ tone: "error", text: "Nothing was uploaded. Check the errors below." });
    }
    setBusy(false);
  }

  function addFiles(files: FileList | File[]) {
    const picked = [...files].filter((f) => f.type.startsWith("image/")).sort((a, b) => naturalCompare(a.name, b.name));
    if (!picked.length) return;
    const queue: Item[] = picked.map((file) => ({
      key: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
      status: "waiting",
      progress: 0,
      pieces: [],
    }));
    setItems(queue);
    void run(queue);
  }

  const failed = items.filter((it) => it.status === "error");

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!busy) addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${
          dragOver ? "border-accent bg-accent-soft" : "border-line-strong"
        }`}
      >
        <p className="font-semibold">Drop page images here</p>
        <p className="text-sm text-muted">
          JPG, PNG, WebP or AVIF. Sorted by file name (page2 before page10). Wide pages are resized, tall strips are split.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="mt-1 h-10 rounded-[10px] bg-accent px-4 text-sm font-bold text-on-accent hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Choose files"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          aria-label="Choose page images"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {summary ? (
        <p role={summary.tone === "error" ? "alert" : "status"} className={`text-sm ${summary.tone === "error" ? "text-danger" : "text-ongoing"}`}>
          {summary.text}
        </p>
      ) : null}

      {items.length ? (
        <ul className="flex flex-col gap-1.5" aria-label="Upload progress">
          {items.map((it) => (
            <li key={it.key} className="flex items-center gap-3 rounded-[10px] border border-line bg-panel px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{it.file.name}</span>
              {it.status === "error" ? (
                <span className="text-danger">{it.error}</span>
              ) : (
                <span className="w-24 text-right text-muted">
                  {it.status === "waiting" ? "Waiting" : it.status === "converting" ? "Converting…" : it.status === "done" ? "Uploaded" : `${Math.round(it.progress * 100)}%`}
                </span>
              )}
              <span aria-hidden="true" className="h-1.5 w-24 overflow-hidden rounded-full bg-line-strong">
                <span
                  className={`block h-full ${it.status === "error" ? "bg-danger-strong" : it.status === "done" ? "bg-ongoing" : "bg-accent"}`}
                  style={{ width: `${Math.round((it.status === "error" ? 1 : it.progress) * 100)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {failed.length && !busy ? (
        <button
          type="button"
          onClick={() => run(failed.map((f) => ({ ...f, status: "waiting", progress: 0, pieces: [] })))}
          className="self-start rounded-[10px] border border-line-strong px-4 py-2 text-sm font-semibold hover:bg-surface-2"
        >
          Retry {failed.length} failed file{failed.length === 1 ? "" : "s"}
        </button>
      ) : null}
    </div>
  );
}
