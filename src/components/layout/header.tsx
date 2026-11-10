"use client";

import { Bell, ChevronDown, Menu, Moon, RefreshCw, Search, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface HeaderProps {
  onMenu: () => void;
  dark: boolean;
  onThemeToggle: () => void;
}

export function Header({ onMenu, dark, onThemeToggle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-[54px] items-center gap-2 border-b border-border bg-card px-3 sm:gap-3 sm:px-4 lg:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu size={20} />
      </Button>

      {/* Search */}
      <label className="hidden h-9 w-[min(465px,36vw)] cursor-text items-center gap-2 rounded-full border border-input bg-card px-3 text-muted-foreground shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring sm:flex">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search servers, alerts, logs, or anything..."
          className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          aria-label="Search"
        />
        <kbd className="whitespace-nowrap rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
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
        className="hidden h-9 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-[13px] font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-accent md:flex"
      >
        <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-success" />
        Production
        <ChevronDown size={13} aria-hidden="true" />
      </button>

      {/* Period */}
      <Select defaultValue="Last 24 hours" aria-label="Dashboard period">
        <SelectTrigger aria-label="Dashboard period" className="hidden h-9 w-[140px] text-[13px] xs:flex sm:flex">
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
        <span className="absolute -right-0.5 -top-0.5 grid h-[13px] min-w-[13px] place-items-center rounded-full border-[1.5px] border-card bg-destructive px-0.5 text-[8px] font-bold leading-[11px] text-white">
          3
        </span>
      </Button>

      <span className="hidden h-9 items-center gap-1.5 rounded-full border border-border px-2.5 text-[12px] font-medium text-success lg:flex">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success" />
        Live
      </span>

      <Button variant="ghost" size="icon" onClick={onThemeToggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </Button>

      {/* Profile */}
      <button type="button" className="flex items-center gap-2 rounded-md py-0.5 pl-1 pr-1 text-left transition-colors hover:bg-accent md:pl-1.5">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#dce5ef] text-[12px] font-bold text-[#3c526c] dark:bg-[#263951] dark:text-[#e2ebf5]">
          A
        </span>
        <span className="hidden lg:block">
          <span className="block text-[9px] font-semibold leading-tight">Admin</span>
          <span className="mt-0.5 block text-[8px] leading-tight text-muted-foreground">Super Administrator</span>
        </span>
        <ChevronDown size={13} aria-hidden="true" className="hidden text-muted-foreground lg:block" />
      </button>
    </header>
  );
}
