"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

const THEME_STORAGE_KEY = "nexus-theme";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDataCentersPage = pathname === "/data-centers-and-locations";
  const isDiskStoragePage = pathname === "/disk-and-storage";
  const isCpuMemoryPage = pathname === "/cpu-and-memory";
  const isMetricsExplorerPage = pathname === "/metrics-explorer";
  const isNetworkMonitoringPage = pathname === "/network-monitoring";
  const isNetworkDevicesPage = pathname === "/network-devices";
  const isProcessesServicesPage = pathname === "/processes-and-services";
  const isContainersDockerPage = pathname === "/containers-and-docker";
  const isCloudAccountsPage = pathname === "/cloud-accounts-and-providers";
  const isDependenciesPage = pathname === "/dependencies";
  const isServerDetailsPage = pathname === "/server-details";
  const isServerDashboard = pathname === "/server-details" || pathname === "/server-groups";
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
          <main className={isServerDashboard
            ? "mx-auto flex min-h-[calc(100dvh-54px)] w-full max-w-[1800px] flex-col px-6 pb-0 pt-6"
            : "mx-auto w-full max-w-[1800px] px-3 pb-4 pt-3 sm:px-5"}>
            {children}
            {!isDataCentersPage && !isDiskStoragePage && !isCpuMemoryPage && !isMetricsExplorerPage && !isNetworkMonitoringPage && !isProcessesServicesPage && !isNetworkDevicesPage && !isContainersDockerPage && !isCloudAccountsPage && !isDependenciesPage && !isServerDetailsPage && <div className={isServerDashboard ? "mt-auto" : undefined}><Footer /></div>}
          </main>
        </div>
      </div>
    </div>
  );
}
