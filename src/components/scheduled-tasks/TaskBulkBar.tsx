"use client";

import { Pause, Play, Trash2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TaskBulkBarProps {
  count: number;
  onRunNow: () => void;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/** MW-style selection bar shown above the table when rows are selected. */
export function TaskBulkBar({ count, onRunNow, onPause, onResume, onDelete, onClear }: TaskBulkBarProps) {
  if (count === 0) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/30 bg-primary/5 px-4 py-2 text-sm">
      <span className="font-semibold tabular-nums text-foreground">{count} selected</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="h-8 gap-1.5 rounded-lg px-3 text-[0.8125rem]" onClick={onRunNow}>
          <Zap size={13} aria-hidden="true" />Run now
        </Button>
        <Button variant="outline" className="h-8 gap-1.5 rounded-lg px-3 text-[0.8125rem]" onClick={onPause}>
          <Pause size={13} aria-hidden="true" />Pause
        </Button>
        <Button variant="outline" className="h-8 gap-1.5 rounded-lg px-3 text-[0.8125rem]" onClick={onResume}>
          <Play size={13} aria-hidden="true" />Resume
        </Button>
        <Button variant="outline" className="h-8 gap-1.5 rounded-lg px-3 text-[0.8125rem] text-red-600 hover:text-red-600" onClick={onDelete}>
          <Trash2 size={13} aria-hidden="true" />Delete
        </Button>
        <button type="button" onClick={onClear} className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Clear selection">
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
