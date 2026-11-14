"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ChipItem {
  label: string;
  /** Small trailing tag rendered in the popover, e.g. "host" / "group". */
  kind?: string;
}

interface ChipsPopoverProps {
  chips: ChipItem[];
  /** Max chips rendered inline before collapsing into "+N". Defaults to 2. */
  max?: number;
  /** Classes applied to every inline chip (font, colours). */
  chipClassName?: string;
  /** Accessible label for the "+N" toggle. */
  expandLabel?: string;
}

/**
 * Inline chip list with an overflow popover: renders up to `max` chips
 * (each truncated with a tooltip), collapses the rest behind a "+N" button
 * that opens an absolute-positioned popover listing every chip. Never wraps.
 */
export function ChipsPopover({ chips, max = 2, chipClassName, expandLabel = "Show all" }: ChipsPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  if (chips.length === 0) {
    return <span className="text-[12px] text-muted-foreground">—</span>;
  }

  const inline = chips.slice(0, max);
  const overflow = chips.slice(max);
  const base = "max-w-[110px] truncate rounded-md border border-border bg-muted px-1.5 py-0.5 text-[12px]";

  return (
    <span ref={containerRef} className="relative inline-flex max-w-full items-center gap-1 whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
      {inline.map((chip) => (
        <span key={`${chip.kind ?? ""}:${chip.label}`} title={chip.label} className={cn(base, chipClassName)}>
          {chip.label}
        </span>
      ))}
      {overflow.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={expandLabel}
            className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            +{overflow.length}
          </button>
          {open && (
            <span role="dialog" aria-label="All items" className="motion-menu-in absolute left-0 top-7 z-30 w-56 rounded-[10px] border border-[#E5E7EB] bg-white p-1.5 text-left shadow-[0_8px_24px_rgba(16,24,40,0.12)] dark:border-border dark:bg-popover">
              {chips.map((chip) => (
                <span key={`popover:${chip.kind ?? ""}:${chip.label}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[12px]">
                  <span className={cn("min-w-0 truncate", chip.kind === "host" ? "font-mono text-foreground" : "text-muted-foreground")} title={chip.label}>
                    {chip.label}
                  </span>
                  {chip.kind && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">{chip.kind}</Badge>
                  )}
                </span>
              ))}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-1 flex h-7 w-full items-center justify-center rounded-md text-[12px] font-medium text-muted-foreground hover:bg-accent"
              >
                Close
              </button>
            </span>
          )}
        </>
      )}
    </span>
  );
}
