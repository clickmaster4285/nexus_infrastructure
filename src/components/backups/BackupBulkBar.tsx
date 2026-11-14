import { PauseCircle, Trash2, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

interface BackupBulkBarProps {
  count: number;
  onRunNow: () => void;
  onPause: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/** Selection toolbar shown above the jobs table when rows are selected. */
export function BackupBulkBar({ count, onRunNow, onPause, onDelete, onClear }: BackupBulkBarProps) {
  if (count === 0) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/30 bg-primary/5 px-4 py-2 text-sm">
      <span className="font-semibold text-foreground">{count} selected</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline"  onClick={onRunNow}>
          <Zap size={13} aria-hidden="true" />Run now
        </Button>
        <Button variant="outline"  onClick={onPause}>
          <PauseCircle size={13} aria-hidden="true" />Pause
        </Button>
        <Button variant="outline" className="text-red-600 hover:text-red-600" onClick={onDelete}>
          <Trash2 size={13} aria-hidden="true" />Delete
        </Button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
