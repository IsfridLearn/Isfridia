// The reader gets a clean frame: no site header or footer, just the comic.
// "(reader)" groups the route without changing its URL.
export default function ReaderLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col bg-reader">{children}</div>;
}
