"use client";

import { useState, useTransition } from "react";
import { deletePage, reorderPages } from "../actions";

export type PageItem = { id: string; url: string; width: number; height: number; bytes: number };

// The chapter's pages in reading order. Reorder by dragging or with the
// up/down buttons (keyboard friendly), then "Save order". Delete single pages.
export function PageList({ chapterId, pages }: { chapterId: string; pages: PageItem[] }) {
  const [order, setOrder] = useState(pages);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = order.some((p, i) => p.id !== pages[i]?.id);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setMessage(null);
  };

  const save = () =>
    startTransition(async () => {
      const res = await reorderPages(chapterId, order.map((p) => p.id));
      setMessage(res.error ? { tone: "error", text: res.error } : { tone: "ok", text: "Order saved." });
    });

  const remove = (page: PageItem, index: number) => {
    if (!window.confirm(`Delete page ${index + 1}? This can't be undone.`)) return;
    startTransition(async () => {
      const res = await deletePage(chapterId, page.id);
      if (res.error) setMessage({ tone: "error", text: res.error });
      else {
        setOrder((list) => list.filter((p) => p.id !== page.id));
        setMessage({ tone: "ok", text: "Page deleted." });
      }
    });
  };

  if (!order.length) return <p className="text-sm text-muted">No pages yet. Upload some above.</p>;

  const totalMb = order.reduce((s, p) => s + p.bytes, 0) / 1024 / 1024;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted">
          {order.length} page{order.length === 1 ? "" : "s"} · {totalMb.toFixed(1)} MB. Drag to reorder, or use the arrows.
        </p>
        {dirty ? (
          <>
            <button type="button" onClick={save} disabled={pending} className="h-9 rounded-[10px] bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-60">
              {pending ? "Saving…" : "Save order"}
            </button>
            <button type="button" onClick={() => setOrder(pages)} disabled={pending} className="h-9 rounded-[10px] border border-line-strong px-3 text-sm font-semibold">
              Undo changes
            </button>
          </>
        ) : null}
        {message ? (
          <span role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-danger" : "text-ongoing"}`}>
            {message.text}
          </span>
        ) : null}
      </div>

      <ol className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
        {order.map((page, i) => (
          <li
            key={page.id}
            draggable
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null) move(dragFrom, i);
              setDragFrom(null);
            }}
            className={`flex cursor-grab flex-col gap-1.5 rounded-xl border bg-panel p-1.5 ${dragFrom === i ? "border-accent opacity-60" : "border-line"}`}
          >
            <div className="relative h-36 overflow-hidden rounded-lg bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={page.url} alt={`Page ${i + 1}`} loading="lazy" className="size-full object-cover object-top" />
              <span className="absolute top-1 left-1 rounded-md bg-canvas/85 px-1.5 text-xs font-bold">{i + 1}</span>
            </div>
            <div className="flex items-center justify-between gap-1">
              <div className="flex gap-1">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0 || pending} aria-label={`Move page ${i + 1} up`} className="size-8 rounded-md border border-line-strong text-sm disabled:opacity-30">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === order.length - 1 || pending} aria-label={`Move page ${i + 1} down`} className="size-8 rounded-md border border-line-strong text-sm disabled:opacity-30">
                  ↓
                </button>
              </div>
              <button type="button" onClick={() => remove(page, i)} disabled={pending || dirty} title={dirty ? "Save or undo the new order first" : undefined} aria-label={`Delete page ${i + 1}`} className="size-8 rounded-md text-sm text-danger hover:bg-danger-strong/10 disabled:opacity-30">
                ✕
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
