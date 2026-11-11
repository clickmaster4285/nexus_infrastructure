"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

const THEME_STORAGE_KEY = "nexus-theme";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isServerDashboard = pathname === "/server-details" || pathname.startsWith("/server-details/") || pathname === "/server-groups";
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
        <div className="min-h-screen lg:pl-[232px]">
          <Header onMenu={() => setMobileOpen(true)} dark={dark} onThemeToggle={toggleTheme} />
          <main className={isServerDashboard
            ? "mx-auto flex min-h-[calc(100dvh-54px)] w-full max-w-[1800px] flex-col px-6 pb-0 pt-6"
            : "mx-auto w-full max-w-[1800px] px-3 pb-4 pt-3 sm:px-5"}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
