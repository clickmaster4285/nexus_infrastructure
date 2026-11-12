"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Optional dot color for the option row. */
  dot?: string;
}

interface MultiSelectProps {
  /** Accessible name; doubles as the label shown in the trigger. */
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
  /** Trigger width; defaults to auto. */
  width?: number;
}

/**
 * Custom checkbox dropdown with a selected-count badge ("Severity 2").
 * Closes on outside click, Escape and scroll. Not a native <select>.
 */
export function MultiSelect({ label, options, selected, onChange, className, width }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const active = selected.length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active > 0 ? "border-primary/50 bg-primary/5 text-foreground" : "border-input bg-card text-muted-foreground hover:bg-accent",
        )}
        style={width ? { width } : undefined}
      >
        <span className="truncate">{label}</span>
        {active > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{active}</span>
        )}
        <ChevronDown size={14} aria-hidden="true" className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="group" aria-label={label} className="motion-menu-in absolute left-0 top-10 z-40 w-56 rounded-[10px] border border-[#E5E7EB] bg-white p-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] outline-none dark:border-border dark:bg-popover">
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
            {active > 0 && (
              <button type="button" onClick={() => onChange([])} className="inline-flex items-center gap-0.5 rounded text-[11px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X size={11} aria-hidden="true" />Clear
              </button>
            )}
          </div>
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label key={option.value} className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] text-foreground transition-colors hover:bg-[#F3F4F6] dark:hover:bg-accent">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(option.value)}
                  className="h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-[#1479e8]"
                />
                {option.dot && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: option.dot }} />}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
