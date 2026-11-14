"use client";

import { CheckCircle2, BellOff, UserPlus, ShieldCheck, X } from "lucide-react";

import { AlertMenu, type AlertMenuItem } from "@/components/alerts/alert-menu";
import { Button } from "@/components/ui/button";
import { ALERT_ASSIGNEES } from "@/mocks/alerts";

interface AlertBulkBarProps {
  count: number;
  onAcknowledge: () => void;
  onAssign: (user: string) => void;
  onSilence: (hours: number) => void;
  onResolve: () => void;
  onClear: () => void;
}

const SILENCE_OPTIONS = [1, 4, 24];

/** Slide-in bar above the table when rows are selected. */
export function AlertBulkBar({ count, onAcknowledge, onAssign, onSilence, onResolve, onClear }: AlertBulkBarProps) {
  const assignItems: AlertMenuItem[] = [
    ...ALERT_ASSIGNEES.map((user) => ({ key: user, label: user, onSelect: () => onAssign(user) })),
    { key: "unassign", label: "Unassign", onSelect: () => onAssign("") },
  ];
  const silenceItems: AlertMenuItem[] = SILENCE_OPTIONS.map((hours) => ({
    key: String(hours),
    label: hours === 1 ? "1 hour" : `${hours} hours`,
    onSelect: () => onSilence(hours),
  }));

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="animate-fade-in flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2"
    >
      <span className="text-[0.8125rem] font-semibold text-foreground">
        {count} selected
      </span>
      <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
      <Button variant="outline" onClick={onAcknowledge} >
        <CheckCircle2 size={13} aria-hidden="true" />Acknowledge
      </Button>
      <AlertMenu
        label="Assign selected alerts"
        submenuAlign="left"
        width={180}
        trigger={<Button variant="outline" ><UserPlus size={13} aria-hidden="true" />Assign</Button>}
        items={assignItems}
      />
      <AlertMenu
        label="Silence selected alerts"
        submenuAlign="left"
        width={150}
        trigger={<Button variant="outline" ><BellOff size={13} aria-hidden="true" />Silence</Button>}
        items={silenceItems}
      />
      <Button variant="outline" onClick={onResolve} >
        <ShieldCheck size={13} aria-hidden="true" />Resolve
      </Button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[0.75rem] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={13} aria-hidden="true" />Clear
      </button>
    </div>
  );
}
