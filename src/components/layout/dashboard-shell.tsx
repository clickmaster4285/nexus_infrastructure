"use client";

import { useEffect, useState } from "react";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

const THEME_STORAGE_KEY = "nexus-theme";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    setDark(stored ? stored === "dark" : prefersDark);
  }, []);

  function toggleTheme() {
    setDark((current) => {
      window.localStorage.setItem(THEME_STORAGE_KEY, current ? "light" : "dark");
      return !current;
    });
  }

  return (
    <div className={dark ? "dark" : undefined}>
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="min-h-screen lg:pl-[232px]">
          <Header onMenu={() => setMobileOpen(true)} dark={dark} onThemeToggle={toggleTheme} />
          <main className="mx-auto w-full max-w-[1800px] px-3 pb-4 pt-3 sm:px-5">
            {children}
            <Footer />
          </main>
        </div>
      </div>
    </div>
  );
}
