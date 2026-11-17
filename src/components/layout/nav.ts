// Main sections of the site, shared by the header (browser code) and the
// footer (server code). Kept in a plain module so both sides can import it.
export const NAV = [
  { href: "/", label: "Home" },
  { href: "/comics", label: "Comics" },
  { href: "/genres", label: "Genres" },
  { href: "/latest", label: "Latest" },
  { href: "/popular", label: "Popular" },
] as const;
