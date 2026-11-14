"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Moon, RefreshCw, Search, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenu: () => void;
  dark: boolean;
  onThemeToggle: () => void;
}

const PROFILE = { name: "Admin", email: "admin@gmail.com", role: "Super Administrator" } as const;

function ProfileMenu() {
  const router = useRouter();
  const user = PROFILE;
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | null>(null);

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const onScroll = (event: Event) => { if (menuRef.current?.contains(event.target as Node)) return; setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", () => setOpen(false));
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const handleLogout = () => {
    notify("Logged out");
    setOpen(false);
    window.setTimeout(() => router.replace("/login"), 300);
  };

  const initials = "A";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md py-0.5 pl-1 pr-1 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:pl-1.5"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[oklch(0.918_0.0167_250.85)] text-[0.75rem] font-bold text-[oklch(0.4317_0.0512_253.07)] dark:bg-[oklch(0.3399_0.0491_254.72)] dark:text-[oklch(0.9362_0.0166_250.85)]">{initials}</span>
        <span className="hidden lg:block">
          <span className="block text-[0.5625rem] font-semibold leading-tight text-foreground">{user?.name ?? "Admin"}</span>
          <span className="mt-0.5 block text-[0.5rem] leading-tight text-muted-foreground">{user?.role ?? "Super Administrator"}</span>
        </span>
        <ChevronDown size={13} aria-hidden="true" className={cn("hidden text-muted-foreground transition-transform duration-150 lg:block", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" aria-label="Account menu" className="absolute right-0 top-10 z-40 w-60 rounded-[0.625rem] border border-gray-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] dark:border-border dark:bg-popover">
          <div className="border-b border-border/70 px-3 py-2">
            <b className="block text-[0.8125rem] text-foreground">{user?.name ?? "Admin"}</b>
            <span className="block truncate text-[0.75rem] text-muted-foreground">{user?.email ?? "admin@gmail.com"}</span>
          </div>
          <button type="button" role="menuitem" onClick={handleLogout} className="mt-1 flex h-9 w-full items-center gap-2 rounded-lg px-3 text-[0.8125rem] font-medium text-rose-600 transition-colors hover:bg-rose-50 focus-visible:bg-rose-50 focus-visible:outline-none dark:text-rose-400 dark:hover:bg-rose-950/40 dark:focus-visible:bg-rose-950/40">
            <LogOut size={15} className="shrink-0" aria-hidden="true" />
            Logout
          </button>
        </div>
      )}
      {toast && <div role="status" className="fixed bottom-4 right-4 z-[1400] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg">{toast}</div>}
    </div>
  );
}

export function Header({ onMenu, dark, onThemeToggle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-[3.375rem] items-center gap-2 border-b border-border bg-card px-3 sm:gap-3 sm:px-4 lg:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu size={20} />
      </Button>

      {/* Search */}
      <label className="hidden h-9 w-[min(29.0625rem,36vw)] cursor-text items-center gap-2 rounded-full border border-input bg-card px-3 text-muted-foreground shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring sm:flex">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search servers, alerts, logs, or anything..."
          className="w-full bg-transparent text-[0.8125rem] text-foreground outline-none placeholder:text-muted-foreground"
          aria-label="Search"
        />
        <kbd className="whitespace-nowrap rounded border border-border bg-muted px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
          Ctrl K
        </kbd>
      </label>
      <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Search">
        <Search size={20} />
      </Button>

      <div className="flex-1" />

      {/* Environment */}
      <button
        type="button"
        className="hidden h-9 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-[0.8125rem] font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-accent md:flex"
      >
        <span aria-hidden="true" className="h-[0.4375rem] w-[0.4375rem] rounded-full bg-success" />
        Production
        <ChevronDown size={13} aria-hidden="true" />
      </button>

      {/* Period */}
      <Select defaultValue="Last 24 hours" aria-label="Dashboard period">
        <SelectTrigger aria-label="Dashboard period" className="hidden h-9 w-[8.75rem] text-[0.8125rem] xs:flex sm:flex">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Last 24 hours">Last 24 hours</SelectItem>
          <SelectItem value="Last 7 days">Last 7 days</SelectItem>
          <SelectItem value="Last 30 days">Last 30 days</SelectItem>
        </SelectContent>
      </Select>

      {/* Actions */}
      <Button variant="ghost" size="icon" className="hidden text-muted-foreground sm:inline-flex" aria-label="Refresh dashboard">
        <RefreshCw size={16} />
      </Button>
      <Button variant="ghost" size="icon" className="relative" aria-label="Notifications, 3 unread">
        <Bell size={17} />
        <span className="absolute -right-0.5 -top-0.5 grid h-[0.8125rem] min-w-[0.8125rem] place-items-center rounded-full border-[0.0938rem] border-card bg-destructive px-0.5 text-[0.5rem] font-bold leading-[0.6875rem] text-white">
          3
        </span>
      </Button>

      <span className="hidden h-9 items-center gap-1.5 rounded-full border border-border px-2.5 text-[0.75rem] font-medium text-success lg:flex">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success" />
        Live
      </span>

      <Button variant="ghost" size="icon" onClick={onThemeToggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </Button>

      {/* Profile */}
      <ProfileMenu />
    </header>
  );
}
