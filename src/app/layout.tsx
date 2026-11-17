import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

// Body text font
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Headings / display font
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "IsfridVerse",
    template: "%s · IsfridVerse",
  },
  description: "Read original manhwa and webcomics on IsfridVerse.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas font-sans text-fg">
        {children}
      </body>
    </html>
  );
}
