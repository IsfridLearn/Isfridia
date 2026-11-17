"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui/form";
import { saveChapter, type ChapterFormState } from "../actions";

type Props = {
  chapterId: string;
  number: string;
  title: string;
  state: "draft" | "scheduled" | "released";
  publishedAt: string | null;
  pageCount: number;
};

// "2026-12-01T18:30" in the admin's own time zone, for <input type="datetime-local">.
function toLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ChapterDetailsForm({ chapterId, number, title, state, publishedAt, pageCount }: Props) {
  const [result, action] = useActionState<ChapterFormState, FormData>(saveChapter.bind(null, chapterId), {});
  const [visibility, setVisibility] = useState<"draft" | "now" | "schedule">(
    state === "draft" ? "draft" : state === "scheduled" ? "schedule" : "now",
  );
  const [localTime, setLocalTime] = useState(() => toLocalInput(state === "scheduled" ? publishedAt : null));
  // The browser knows the admin's time zone; send the exact moment as UTC.
  const publishAtIso = (() => {
    const d = new Date(localTime);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  })();
  const errors = result.fieldErrors ?? {};

  const option = (value: typeof visibility, label: string, hint: string) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-strong bg-surface p-3 has-checked:border-accent has-checked:bg-accent-soft">
      <input type="radio" name="visibility" value={value} checked={visibility === value} onChange={() => setVisibility(value)} className="mt-1 accent-accent" />
      <span>
        <span className="font-semibold">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ch-number" className="text-sm font-semibold text-fg-soft">Chapter number</label>
          <input id="ch-number" name="number" defaultValue={number} inputMode="decimal" maxLength={8} aria-invalid={errors.number ? true : undefined} className={`h-11 rounded-[10px] border bg-surface px-3 ${errors.number ? "border-danger-strong" : "border-line-strong"}`} />
          {errors.number ? <p className="text-sm text-danger">{errors.number}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ch-title" className="text-sm font-semibold text-fg-soft">Title (optional)</label>
          <input id="ch-title" name="title" defaultValue={title} maxLength={200} className="h-11 rounded-[10px] border border-line-strong bg-surface px-3" />
          {errors.title ? <p className="text-sm text-danger">{errors.title}</p> : null}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-fg-soft">Publishing</legend>
        {option("draft", "Draft", "Hidden from readers. Only admins can see it.")}
        {option(
          "now",
          state === "released" ? "Published" : "Publish now",
          state === "released" ? "Visible to readers. Its release date stays the same when you save." : "Readers can see it immediately.",
        )}
        {option("schedule", "Schedule", "Goes live automatically at the chosen time.")}
        {visibility === "schedule" ? (
          <div className="ml-7 flex flex-col gap-1.5">
            <label htmlFor="ch-when" className="text-sm font-semibold text-fg-soft">Release time (your time zone)</label>
            <input id="ch-when" type="datetime-local" value={localTime} onChange={(e) => setLocalTime(e.target.value)} className="h-11 w-fit rounded-[10px] border border-line-strong bg-surface px-3" />
            <input type="hidden" name="publishAt" value={publishAtIso} />
            {errors.publishAt ? <p className="text-sm text-danger">{errors.publishAt}</p> : null}
          </div>
        ) : null}
        {visibility !== "draft" && pageCount === 0 ? <p className="text-sm text-hiatus">Upload pages before publishing.</p> : null}
      </fieldset>

      {result.message ? (
        <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-ongoing" : "text-danger"}`}>
          {result.message}
        </p>
      ) : null}
      <div>
        <SubmitButton pendingText="Saving…">Save chapter</SubmitButton>
      </div>
    </form>
  );
}
