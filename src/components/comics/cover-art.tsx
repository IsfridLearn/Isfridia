import { coverUrls } from "@/lib/images/urls";

// Comic cover. Shows the uploaded cover when there is one (300 px and 600 px
// WebP; the browser picks the right size). Otherwise a placeholder: a muted
// colour picked from the slug (so it never changes), a diagonal pattern and
// the title. The placeholder colours are artwork, not theme colours, which is
// why they live here instead of globals.css.

const PALETTE = [
  "#24405f", "#5a2e2e", "#3b2f5c", "#2e3b34", "#4a3b1f", "#5b2840",
  "#1f4b57", "#26324f", "#3d3a2a", "#2f4440", "#4b2a3a", "#2a2f3f",
];

function colourFor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

const PATTERN = "repeating-linear-gradient(135deg, rgba(255,255,255,0.045) 0 2px, transparent 2px 12px)";

type CoverArtProps = {
  title: string;
  slug: string;
  coverKey?: string | null;
  className?: string;
  titleClassName?: string;
  showTitle?: boolean;
  // true when the title is already shown next to the cover (cards), so screen
  // readers don't hear it twice.
  decorative?: boolean;
  // How wide the cover is on screen, so the browser downloads the right size.
  sizes?: string;
  // true for the main cover of a page: load it first instead of lazily.
  priority?: boolean;
};

export function CoverArt({
  title,
  slug,
  coverKey,
  className = "",
  titleClassName = "text-lg",
  showTitle = true,
  decorative = false,
  sizes = "(max-width: 640px) 45vw, 200px",
  priority = false,
}: CoverArtProps) {
  const urls = coverUrls(coverKey);
  const label = decorative ? { "aria-hidden": true as const } : { role: "img", "aria-label": `Cover of ${title}` };

  if (urls) {
    return (
      <div className={`relative aspect-[2/3] overflow-hidden rounded-xl bg-surface ${className}`} {...label}>
        {/* A plain <img>: covers are already resized WebP files, so Next's
            image optimiser (limited on the free hosting plan) isn't needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls.large}
          srcSet={`${urls.small} 300w, ${urls.large} 600w`}
          sizes={sizes}
          alt=""
          width={600}
          height={900}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-xl ${className}`}
      style={{ backgroundColor: colourFor(slug) }}
      {...label}
    >
      <div aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: PATTERN }} />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-b from-transparent to-black/60" />
      {showTitle ? (
        <span
          aria-hidden="true"
          className={`absolute inset-x-3 bottom-3 font-display leading-[1.05] font-extrabold tracking-tight text-[#f6f2ea] ${titleClassName}`}
        >
          {title}
        </span>
      ) : null}
    </div>
  );
}

export function coverColour(slug: string): string {
  return colourFor(slug);
}
