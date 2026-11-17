"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { slugify, type ComicField, type ComicFormValues } from "@/lib/admin/comic-form";
import { STATUSES, TYPES } from "@/lib/catalog/enums";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/format";
import { saveComic, type ComicFormState } from "./actions";

type Props = {
  comicId?: string;
  initial: ComicFormValues;
  genres: { id: number; name: string }[];
};

export function ComicForm({ comicId, initial, genres }: Props) {
  const [state, formAction] = useActionState<ComicFormState, FormData>(saveComic, {});
  // After a failed save, show exactly what was typed (re-mounts the fields).
  const values = state.values ?? initial;
  return (
    <form key={state.submission ?? "initial"} action={formAction} noValidate className="flex flex-col gap-6">
      {state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
      {comicId ? <input type="hidden" name="id" value={comicId} /> : null}
      <input type="hidden" name="mangaupdatesId" value={values.mangaupdatesId} />
      <input type="hidden" name="mangaupdatesUrl" value={values.mangaupdatesUrl} />
      <Fields values={values} errors={state.fieldErrors ?? {}} genres={genres} />
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <SubmitButton pendingText="Saving…">{comicId ? "Save changes" : "Create comic"}</SubmitButton>
      </div>
    </form>
  );
}

const input = "h-11 w-full rounded-[10px] border bg-surface px-3 text-[15px] text-fg placeholder:text-faint";
const border = (error?: string) => (error ? "border-danger-strong" : "border-line-strong");

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-fg-soft">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Fields({
  values,
  errors,
  genres,
}: {
  values: ComicFormValues;
  errors: Partial<Record<ComicField, string>>;
  genres: { id: number; name: string }[];
}) {
  const [title, setTitle] = useState(values.title);
  const autoSlug = slugify(title);
  const described = (field: ComicField) => (errors[field] ? { "aria-invalid": true, "aria-describedby": `f-${field}-error` } : {});

  return (
    <>
      <section className="grid gap-5 md:grid-cols-2">
        <Field id="f-title" label="Title" error={errors.title}>
          <input id="f-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={`${input} ${border(errors.title)}`} {...described("title")} />
        </Field>
        <Field
          id="f-slug"
          label="URL name"
          error={errors.slug}
          hint={values.slug ? "Changing this breaks old links to the comic." : <>Leave empty to use <span className="text-fg-soft">/comics/{autoSlug || "…"}</span></>}
        >
          <input id="f-slug" name="slug" defaultValue={values.slug} placeholder={autoSlug || "my-comic"} maxLength={100} className={`${input} ${border(errors.slug)}`} {...described("slug")} />
        </Field>
      </section>

      <Field id="f-altTitles" label="Alternative titles" error={errors.altTitles} hint="One per line. Searchable on the site.">
        <textarea id="f-altTitles" name="altTitles" defaultValue={values.altTitles} rows={3} className={`w-full rounded-[10px] border bg-surface px-3 py-2.5 text-[15px] ${border(errors.altTitles)}`} {...described("altTitles")} />
      </Field>

      <Field id="f-synopsis" label="Synopsis" error={errors.synopsis} hint="Up to 5000 characters. Line breaks are kept.">
        <textarea id="f-synopsis" name="synopsis" defaultValue={values.synopsis} rows={7} maxLength={5000} className={`w-full rounded-[10px] border bg-surface px-3 py-2.5 text-[15px] leading-relaxed ${border(errors.synopsis)}`} {...described("synopsis")} />
      </Field>

      <section className="grid gap-5 md:grid-cols-2">
        <Field id="f-author" label="Author" error={errors.author}>
          <input id="f-author" name="author" defaultValue={values.author} maxLength={120} className={`${input} ${border(errors.author)}`} />
        </Field>
        <Field id="f-artist" label="Artist" error={errors.artist}>
          <input id="f-artist" name="artist" defaultValue={values.artist} maxLength={120} className={`${input} ${border(errors.artist)}`} />
        </Field>
        <Field id="f-type" label="Type" error={errors.type}>
          <select id="f-type" name="type" defaultValue={values.type} className={`${input} ${border(errors.type)}`}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
        </Field>
        <Field id="f-status" label="Status" error={errors.status}>
          <select id="f-status" name="status" defaultValue={values.status} className={`${input} ${border(errors.status)}`}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </Field>
        <Field id="f-releaseYear" label="Release year" error={errors.releaseYear} hint="Optional.">
          <input id="f-releaseYear" name="releaseYear" defaultValue={values.releaseYear} inputMode="numeric" maxLength={4} placeholder="2026" className={`${input} ${border(errors.releaseYear)}`} {...described("releaseYear")} />
        </Field>
      </section>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-sm font-semibold text-fg-soft">Genres</legend>
        {genres.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
            {genres.map((g) => (
              <label key={g.id} className="flex h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border border-line-strong bg-surface px-3 text-sm has-checked:border-accent has-checked:bg-accent-soft">
                <input type="checkbox" name="genreIds" value={g.id} defaultChecked={values.genreIds.includes(String(g.id))} className="size-4 accent-accent" />
                {g.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No genres yet. Add some on the Genres page.</p>
        )}
        {errors.genreIds ? <p className="text-sm text-danger">{errors.genreIds}</p> : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm font-semibold text-fg-soft">Visibility</legend>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="isPublished" defaultChecked={values.isPublished} className="mt-1 size-4 accent-accent" />
          <span>
            <span className="font-semibold">Published</span>
            <span className="block text-sm text-muted">Visible to everyone. Unpublished comics are only visible to admins.</span>
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="isFeatured" defaultChecked={values.isFeatured} className="mt-1 size-4 accent-accent" />
          <span>
            <span className="font-semibold">Featured</span>
            <span className="block text-sm text-muted">Shown in the big homepage banner (when published).</span>
          </span>
        </label>
      </fieldset>

      {values.mangaupdatesUrl ? (
        <p className="text-sm text-muted">
          Linked to{" "}
          <a href={values.mangaupdatesUrl} target="_blank" rel="noopener noreferrer" className="text-fg-soft underline">
            this MangaUpdates series ↗
          </a>
          . A credit is shown on the comic&apos;s page.
        </p>
      ) : null}
    </>
  );
}
