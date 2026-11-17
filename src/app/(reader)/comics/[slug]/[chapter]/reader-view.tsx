"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReaderData } from "@/lib/catalog/queries";
import { chapterPath } from "@/lib/chapter-path";
import { createClient } from "@/lib/supabase/client";

// The vertical reader. Pages are plain <img> tags with their real width and
// height, so the browser reserves the space before each image arrives (no
// jumping), and only images near the screen load (lazy loading).
//
// Logged-in readers: progress is saved to their account (privately, by the
// database rules) every few seconds and when they leave; when they come back
// they get a "jump back" button.
// Everyone: after 5 seconds a view is counted (once per visitor per day).

const WIDTHS = { narrow: 600, standard: 760, wide: 1000 } as const;
type Width = keyof typeof WIDTHS;
const WIDTH_KEY = "isfridverse.reader-width";
const SAVE_EVERY_MS = 5000;
const VIEW_AFTER_MS = 5000;

function readSavedWidth(): Width {
  try {
    const saved = localStorage.getItem(WIDTH_KEY);
    return saved === "narrow" || saved === "wide" ? saved : "standard";
  } catch {
    return "standard";
  }
}
function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function ReaderView({ data }: { data: ReaderData }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const pageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const [progress, setProgress] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [barsHidden, setBarsHidden] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const latest = useRef({ progress: 0, pageIndex: 0 });
  const label = `Chapter ${data.chapter.number}`;

  // Remember the width choice on this device (a convenience; fine if storage
  // is blocked). The server always renders "standard"; the browser then uses
  // the saved choice.
  const savedWidth = useSyncExternalStore(subscribeToStorage, readSavedWidth, () => "standard" as Width);
  const [chosenWidth, setChosenWidth] = useState<Width | null>(null);
  const width = chosenWidth ?? savedWidth;
  const chooseWidth = (w: Width) => {
    setChosenWidth(w);
    try {
      localStorage.setItem(WIDTH_KEY, w);
    } catch {}
  };

  // Scroll: progress bar, current page, hide the bars while scrolling down.
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, y / max) : 1;
        const middle = window.innerHeight / 2;
        let index = 0;
        pageRefs.current.forEach((img, i) => {
          if (img && img.getBoundingClientRect().top < middle) index = i;
        });
        latest.current = { progress: p, pageIndex: index };
        setProgress(p);
        setPageIndex(index);
        setBarsHidden(y > lastY && y > 120 && p < 0.98);
        lastY = y;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [data.chapter.id]);

  // Count a view after a few seconds of reading.
  useEffect(() => {
    const timer = setTimeout(() => {
      const payload = JSON.stringify({ chapterId: data.chapter.id });
      if (!navigator.sendBeacon?.("/api/views", new Blob([payload], { type: "application/json" }))) {
        void fetch("/api/views", { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "application/json" } });
      }
    }, VIEW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [data.chapter.id]);

  // Saved progress (logged-in readers only).
  useEffect(() => {
    let userId: string | null = null;
    let lastSaved = -1;
    let stopped = false;

    const save = async () => {
      if (!userId) return;
      const { progress: p, pageIndex: i } = latest.current;
      const rounded = Math.round(p * 100) / 100;
      if (rounded === lastSaved) return;
      lastSaved = rounded;
      await supabase.from("reading_history").upsert(
        { user_id: userId, chapter_id: data.chapter.id, comic_id: data.comic.id, progress: rounded, last_image_index: i },
        { onConflict: "user_id,chapter_id" },
      );
    };

    (async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (stopped || !auth.session) return;
      userId = auth.session.user.id;
      const { data: row } = await supabase
        .from("reading_history")
        .select("progress, last_image_index")
        .eq("chapter_id", data.chapter.id)
        .maybeSingle();
      if (!stopped && row && row.progress > 0.05 && row.progress < 0.95 && row.last_image_index > 0) {
        setResumeAt(Math.min(row.last_image_index, data.pages.length - 1));
      }
    })();

    const interval = setInterval(save, SAVE_EVERY_MS);
    const onHide = () => document.visibilityState === "hidden" && void save();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", save);
    return () => {
      stopped = true;
      void save();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", save);
    };
  }, [supabase, data.chapter.id, data.comic.id, data.pages.length]);

  const jumpBack = () => {
    if (resumeAt !== null) pageRefs.current[resumeAt]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setResumeAt(null);
  };

  const goTo = (number: string) => router.push(chapterPath(data.comic.slug, number));
  const picker = (id: string) => (
    <>
      <label htmlFor={id} className="sr-only">Jump to chapter</label>
      <select
        id={id}
        value={data.chapter.number}
        onChange={(e) => goTo(e.target.value)}
        className="h-10 max-w-[150px] rounded-[10px] border border-line-strong bg-surface px-2 text-sm font-semibold text-fg"
      >
        {data.chapters.map((c) => (
          <option key={c.number} value={c.number}>
            Chapter {c.number}
          </option>
        ))}
      </select>
    </>
  );
  const navButton = (target: ReaderData["prev"], text: string, primary = false) =>
    target ? (
      <Link
        href={chapterPath(data.comic.slug, target.number)}
        className={`flex h-10 items-center rounded-[10px] px-3 text-sm font-semibold ${primary ? "bg-accent font-bold text-on-accent" : "border border-line-strong bg-surface"}`}
      >
        {text}
      </Link>
    ) : (
      <span aria-disabled="true" className="flex h-10 items-center rounded-[10px] border border-line px-3 text-sm text-faint">{text}</span>
    );

  return (
    <>
      <header className={`sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-md transition-transform duration-200 motion-reduce:transition-none ${barsHidden ? "-translate-y-full" : ""}`}>
        <div aria-hidden="true" className="h-[3px] bg-surface-2">
          <div className="h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 sm:px-5">
          <div className="flex min-w-0 flex-[1_1_220px] items-center gap-2.5">
            <Link href={`/comics/${data.comic.slug}`} aria-label={`Back to ${data.comic.title}`} className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-surface">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </Link>
            <div className="flex min-w-0 flex-col">
              <Link href={`/comics/${data.comic.slug}`} className="truncate text-sm font-semibold hover:text-accent-fg">{data.comic.title}</Link>
              <h1 className="truncate text-xs text-muted">
                {label}
                {data.chapter.title ? ` · ${data.chapter.title}` : ""}
              </h1>
            </div>
          </div>
          <nav aria-label="Chapter navigation" className="hidden items-center gap-2 sm:flex">
            {navButton(data.prev, "← Prev")}
            {picker("chapter-picker-top")}
            {navButton(data.next, "Next →", true)}
          </nav>
          <div role="group" aria-label="Reading width" className="hidden items-center gap-0.5 rounded-[10px] border border-line-strong bg-surface p-[3px] lg:flex">
            {(Object.keys(WIDTHS) as Width[]).map((w) => (
              <button key={w} type="button" onClick={() => chooseWidth(w)} aria-pressed={width === w} className={`h-[34px] rounded-[7px] px-2.5 text-[13px] font-semibold capitalize ${width === w ? "bg-line-strong text-fg" : "text-muted hover:text-fg"}`}>
                {w}
              </button>
            ))}
          </div>
        </div>
      </header>

      {resumeAt !== null ? (
        <div className="fixed inset-x-0 top-20 z-40 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full border border-line-strong bg-surface py-1.5 pr-1.5 pl-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
            <span className="text-sm">You stopped at page {resumeAt + 1}.</span>
            <button type="button" onClick={jumpBack} className="h-9 rounded-full bg-accent px-4 text-sm font-bold text-on-accent">Jump back</button>
            <button type="button" onClick={() => setResumeAt(null)} aria-label="Dismiss" className="size-9 rounded-full text-muted hover:text-fg">✕</button>
          </div>
        </div>
      ) : null}

      <main aria-label={`${label} pages`} className="mx-auto w-full" style={{ maxWidth: WIDTHS[width] }}>
        {data.pages.length ? (
          data.pages.map((page, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={page.url}
              ref={(el) => {
                pageRefs.current[i] = el;
              }}
              src={page.url}
              width={page.width}
              height={page.height}
              alt={`Page ${i + 1} of ${data.pages.length}`}
              loading={i < 2 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding="async"
              className="block h-auto w-full bg-surface"
            />
          ))
        ) : (
          <p className="px-4 py-24 text-center text-muted">This chapter has no pages yet.</p>
        )}
      </main>

      <section aria-labelledby="end-heading" className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-4 px-4 pt-12 pb-32 text-center sm:pb-20">
        <h2 id="end-heading" className="font-display text-3xl font-extrabold tracking-tight">End of {label}</h2>
        {data.next ? (
          <p className="text-muted">Up next: Chapter {data.next.number}{data.next.title ? ` · ${data.next.title}` : ""}</p>
        ) : (
          <p className="text-muted">You&apos;re all caught up. New chapters will appear on the comic&apos;s page.</p>
        )}
        <div className="flex flex-wrap justify-center gap-2.5">
          {data.prev ? (
            <Link href={chapterPath(data.comic.slug, data.prev.number)} className="flex h-12 items-center rounded-xl border border-line-strong bg-surface px-5 font-semibold">
              ← Chapter {data.prev.number}
            </Link>
          ) : null}
          {data.next ? (
            <Link href={chapterPath(data.comic.slug, data.next.number)} className="flex h-12 items-center rounded-xl bg-accent px-6 font-bold text-on-accent">
              Next chapter →
            </Link>
          ) : null}
        </div>
        <Link href={`/comics/${data.comic.slug}`} className="py-2 text-sm text-fg-soft hover:text-accent-fg">
          Back to {data.comic.title}
        </Link>
      </section>

      {/* Phone controls, within thumb reach. */}
      <nav aria-label="Chapter navigation" className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/95 backdrop-blur-md transition-transform duration-200 motion-reduce:transition-none sm:hidden ${barsHidden ? "translate-y-full" : ""}`}>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          {navButton(data.prev, "← Prev")}
          <span className="text-xs text-muted">{data.pages.length ? `${pageIndex + 1}/${data.pages.length}` : ""}</span>
          {picker("chapter-picker-bottom")}
          {navButton(data.next, "Next →", true)}
        </div>
      </nav>
    </>
  );
}
