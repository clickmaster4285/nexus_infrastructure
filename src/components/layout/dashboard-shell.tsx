"use client";

import { useEffect, useState } from "react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

const THEME_STORAGE_KEY = "nexus-theme";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    // Light is the default - dark mode is opt-in via the header toggle.
    setDark(stored ? stored === "dark" : false);
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
        <div className="min-h-screen lg:pl-[14.5rem]">
          <Header onMenu={() => setMobileOpen(true)} dark={dark} onThemeToggle={toggleTheme} />
          <main className="mx-auto flex min-h-[calc(100dvh-3.375rem)] w-full max-w-[112.5rem] flex-col px-3 pb-4 pt-3 sm:px-5">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
