import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Grenze_Gotisch } from "next/font/google";
import "./globals.css";

// Everything people read and type: the list, forms and the chat.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
});

// Lissie's decrees: page headlines only (see tech-docs/ui.md).
const grenze = Grenze_Gotisch({
  variable: "--font-grenze",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "todo-cat",
  description: "A to-do list kept by Lissie, a cat with opinions.",
};

// Both schemes are designed (globals.css), so browsers must not darken the page themselves.
export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${grenze.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
