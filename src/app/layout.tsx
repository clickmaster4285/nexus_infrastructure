import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nexus — Infrastructure Monitor",
    template: "%s — Nexus",
  },
  description: "Infrastructure health and performance at a glance.",
  icons: {
    icon: "/nexus-mark.svg",
    shortcut: "/nexus-mark.svg",
    apple: "/nexus-mark.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
