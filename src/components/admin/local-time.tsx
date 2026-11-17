"use client";

// Shows a moment in the viewer's own time zone ("Dec 1, 6:30 PM"). The server
// doesn't know the admin's time zone, so it renders UTC first and the browser
// replaces it (suppressHydrationWarning tells React that's expected).
export function LocalTime({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
    </time>
  );
}
