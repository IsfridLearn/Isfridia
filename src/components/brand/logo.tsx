// The IsfridVerse "IV" mark. Same artwork as src/app/icon.svg.
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <rect width="30" height="30" rx="9" fill="#edeef2" />
      <rect x="7" y="8" width="3.4" height="14" rx="1" fill="#0b0c10" />
      <path
        d="M13 8.5 17.4 21.5 21.8 8.5"
        stroke="#0b0c10"
        strokeWidth="3.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      Isfrid<span className="font-semibold text-muted">Verse</span>
    </span>
  );
}
