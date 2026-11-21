import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AnchorMind — pause the spiral",
  description:
    "A supportive CBT/ACT-informed reflection tool for anxious thought spirals. Not a diagnostic tool or a substitute for professional or emergency care.",
};

export const viewport: Viewport = {
  themeColor: "#020617",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-slate-950">
      <body className="bg-slate-950 font-sans text-slate-100 antialiased">{children}</body>
    </html>
  );
}
