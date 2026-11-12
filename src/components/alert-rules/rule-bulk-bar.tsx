"use client";

import { BellOff, CheckCircle2, ShieldOff, Trash2, X } from "lucide-react";

import { AlertMenu, type AlertMenuItem } from "@/components/alerts/alert-menu";
import { Button } from "@/components/ui/button";

interface RuleBulkBarProps {
  count: number;
  onEnable: () => void;
  onDisable: () => void;
  onMute: (hours: number) => void;
  onDelete: () => void;
  onClear: () => void;
}

const MUTE_OPTIONS = [1, 4, 24];

/** Slide-in bar above the table when rows are selected. */
export function RuleBulkBar({ count, onEnable, onDisable, onMute, onDelete, onClear }: RuleBulkBarProps) {
  const muteItems: AlertMenuItem[] = MUTE_OPTIONS.map((hours) => ({
    key: String(hours),
    label: hours === 1 ? "1 hour" : `${hours} hours`,
    onSelect: () => onMute(hours),
  }));

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="animate-fade-in flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2"
    >
      <span className="text-[13px] font-semibold text-foreground">{count} selected</span>
      <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
      <Button size="sm" variant="outline" onClick={onEnable} className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px]">
        <CheckCircle2 size={13} aria-hidden="true" />Enable
      </Button>
      <Button size="sm" variant="outline" onClick={onDisable} className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px]">
        <ShieldOff size={13} aria-hidden="true" />Disable
      </Button>
      <AlertMenu
        label="Mute selected rules"
        width={150}
        trigger={<Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px]"><BellOff size={13} aria-hidden="true" />Mute</Button>}
        items={muteItems}
      />
      <Button size="sm" variant="outline" onClick={onDelete} className="h-8 gap-1.5 rounded-lg border-[#FECACA] px-2.5 text-[12px] text-[#DC2626] hover:bg-[#FEF2F2] dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40">
        <Trash2 size={13} aria-hidden="true" />Delete
      </Button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={13} aria-hidden="true" />Clear
      </button>
    </div>
  );
}
