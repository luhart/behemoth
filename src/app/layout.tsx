import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";

import "./globals.css";

const displayFont = Newsreader({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const interfaceFont = IBM_Plex_Sans({
  variable: "--font-interface",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const evidenceFont = IBM_Plex_Mono({
  variable: "--font-evidence",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cely | Every concern, clearly carried",
  description: "Cely connects patient concerns, chart context, and clinician review into a clear visit agenda.",
  icons: {
    icon: [
      { url: "/brand/cely-favicon.svg", type: "image/svg+xml" },
      { url: "/brand/cely-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/cely-favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/brand/cely-app-icon-512.png", sizes: "512x512", type: "image/png" }],
  },
  openGraph: {
    title: "Cely | Every concern, clearly carried",
    description: "Patient concerns and chart evidence, prepared for clinician review.",
    images: [{ url: "/brand/cely-social-card-1200x630.png", width: 1200, height: 630, alt: "Cely. Every concern, clearly carried." }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${interfaceFont.variable} ${evidenceFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
