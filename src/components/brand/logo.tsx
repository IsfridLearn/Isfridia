// The Isfridia "I" mark. Same artwork as src/app/icon.svg.
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <rect width="30" height="30" rx="9" fill="#edeef2" />
      <rect x="13.3" y="8" width="3.4" height="14" rx="1" fill="#0b0c10" />
      <rect x="10" y="7" width="10" height="3.2" rx="1.2" fill="#0b0c10" />
      <rect x="10" y="19.8" width="10" height="3.2" rx="1.2" fill="#0b0c10" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-display font-extrabold tracking-tight ${className}`}>Isfridia</span>;
}
