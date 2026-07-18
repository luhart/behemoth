import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Behemoth — Clinical Workflow Compiler",
  description: "Turn clinician-approved care workflows into governed, reusable agent skills.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
