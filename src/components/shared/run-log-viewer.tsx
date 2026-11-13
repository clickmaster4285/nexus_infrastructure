"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, X } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface RunLogViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Run identifier shown as the dialog eyebrow, e.g. "BKR-0231". */
  title: string;
  /** Context line under the title, e.g. the task/job name. */
  subtitle: string;
  /** Status badge node rendered under the subtitle (e.g. <RunStatusBadge />). */
  badge?: ReactNode;
  /** Small meta facts: started time, duration, trigger source. */
  meta?: ReactNode[];
  /** Raw log body. */
  content: string;
}

/** Monospace log viewer with a copy-to-clipboard action. Generic across tasks and backups. */
export function RunLogViewer({ open, onOpenChange, title, subtitle, badge, meta, content }: RunLogViewerProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => { setCopied(false); }, [title, open]);

  const lines = content.split("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(680px,calc(100vw-2rem))] max-w-none gap-0 overflow-hidden p-0" aria-describedby="run-log-description">
        <DialogHeader className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="font-display text-sm font-bold tracking-tight">Run log</DialogTitle>
              <DialogDescription id="run-log-description" className="mt-0.5 truncate text-[12px]">
                {subtitle} · {title}
              </DialogDescription>
              {(badge || (meta && meta.length > 0)) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {badge}
                  {meta?.map((item, index) => (
                    <span key={index} className="tabular-nums">{index > 0 || badge ? "· " : ""}{item}</span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={copy}
              aria-label="Copy log to clipboard"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied ? <Check size={15} aria-hidden="true" className="text-[#16A34A]" /> : <Copy size={15} aria-hidden="true" />}
            </button>
          </div>
        </DialogHeader>
        <div className="max-h-[420px] overflow-auto bg-[#0B1220] p-0">
          <pre className="min-w-max px-0 py-3 font-mono text-[11px] leading-[1.7] text-slate-200">
            {lines.map((line, index) => (
              <div key={index} className="flex hover:bg-white/5">
                <span aria-hidden="true" className="w-10 shrink-0 select-none pr-3 text-right text-slate-600">{index + 1}</span>
                <code className={cn("pr-5", /error|failed/i.test(line) && "text-[#fca5a5]", /exit code 0/.test(line) && "text-[#86efac]")}>{line}</code>
              </div>
            ))}
          </pre>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-2.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{lines.length} lines</span>
          <button type="button" onClick={() => onOpenChange(false)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X size={13} aria-hidden="true" />Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
