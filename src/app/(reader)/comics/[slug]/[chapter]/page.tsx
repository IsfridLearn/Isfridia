import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getReaderData } from "@/lib/catalog/queries";
import { parseChapterSegment } from "@/lib/chapter-path";
import { ReaderView } from "./reader-view";

type Props = PageProps<"/comics/[slug]/[chapter]">;

async function load(params: Props["params"]) {
  const { slug, chapter } = await params;
  const number = parseChapterSegment(chapter);
  return number === null ? null : getReaderData(slug, number);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Chapter not found" };
  const label = `Chapter ${data.chapter.number}${data.chapter.title ? `: ${data.chapter.title}` : ""}`;
  return { title: `${label} · ${data.comic.title}`, description: `Read ${data.comic.title} ${label} on IsfridVerse.` };
}

export default function ReaderPage({ params }: Props) {
  return (
    <Suspense fallback={<ReaderSkeleton />}>
      <Reader params={params} />
    </Suspense>
  );
}

async function Reader({ params }: { params: Props["params"] }) {
  const data = await load(params);
  if (!data) notFound();
  return <ReaderView data={data} />;
}

function ReaderSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto flex w-full max-w-[760px] flex-col gap-1 pt-16">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="aspect-[2/3] w-full animate-pulse bg-surface motion-reduce:animate-none" />
      ))}
    </div>
  );
}
