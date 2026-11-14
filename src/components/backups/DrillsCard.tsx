import { useState } from "react";
import { CalendarClock, FlaskConical, MoreVertical } from "lucide-react";

import { ChartCard } from "@/components/logs/primitives";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { ResultBadge } from "@/components/backups/backup-badges";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DrDrill } from "@/mocks/restoreHistory";
import { cn } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

/** Six most recent DR/restore drills. Next-drill-due strip on top, success ratio in the footer. Row click opens drill details. */
export function DrillsCard({ drills, onScheduleDrill, onExport }: { drills: DrDrill[]; onScheduleDrill: () => void; onExport: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = [...drills].sort((a, b) => b.epochMs - a.epochMs).slice(0, 6);
  const selected = selectedId ? drills.find((drill) => drill.id === selectedId) ?? null : null;
  const passed = drills.filter((drill) => drill.result === "Passed").length;
  const total = drills.length;
  const successPct = total > 0 ? Math.round((passed / total) * 100) : 0;
  // Compact 90d mini-stats for the space between the list and the footer.
  const avgDuration = total > 0 ? Math.round(drills.reduce((sum, drill) => sum + drill.durationMin, 0) / total) : 0;
  const withinRto = drills.filter((drill) => drill.durationMin <= drill.rtoTargetMin).length;
  const slowest = total > 0 ? drills.reduce((acc, drill) => (drill.durationMin > (acc?.durationMin ?? -1) ? drill : acc), null as (typeof drills)[number] | null) : null;
  // Next scheduled drill: 11 days from now (deterministic mock entry).
  const nextDrillDue = new Date(Date.now() + 11 * DAY);

  return (
    <ChartCard
      title="Recent Restore & DR Drills"
      className="h-full min-h-[17.5rem] p-4"
      actions={
        <AlertMenu
          label="Drill actions"
          align="end"
          width={210}
          trigger={
            <button type="button" aria-label="Drill actions" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MoreVertical size={16} aria-hidden="true" />
            </button>
          }
          items={[
            { key: "schedule", label: "Schedule drill", onSelect: onScheduleDrill },
            { key: "export", label: "Export drill report (CSV)", onSelect: onExport },
          ]}
        />
      }
    >
      <button
        type="button"
        onClick={onScheduleDrill}
        className="mb-2 flex w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Schedule the next full disaster-recovery drill"
      >
        <CalendarClock size={15} aria-hidden="true" className="shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block text-[0.8125rem] font-semibold text-foreground">Next drill: Full DR failover</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {nextDrillDue.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · app-server-01 · in 11d
          </span>
        </span>
        <span className="ml-auto shrink-0 text-xs font-semibold text-primary hover:underline">Schedule</span>
      </button>
      <ul className="flex min-h-0 flex-1 flex-col divide-y divide-border/70">
        {rows.map((drill) => {
          const daysAgo = Math.floor((Date.now() - drill.epochMs) / DAY);
          const withinRto = drill.durationMin <= drill.rtoTargetMin;
          return (
            <li key={drill.id}>
              <button
                type="button"
                onClick={() => setSelectedId(drill.id)}
                className="flex w-full items-center gap-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary rounded"
                aria-label={`View drill details for ${drill.name}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-[0.8125rem] font-medium text-foreground" title={drill.name}>{drill.name}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {new Date(drill.epochMs).toLocaleDateString(undefined, { month: "short", day: "numeric" })} &middot; {drill.durationMin}m vs {drill.rtoTargetMin}m RTO &middot; {drill.tier}
                    {!withinRto && <span className="ml-1 font-semibold text-rose-600 dark:text-rose-400">(over by {drill.durationMin - drill.rtoTargetMin}m)</span>}
                    <span aria-hidden="true"> &middot; {daysAgo}d ago</span>
                  </p>
                </div>
                <span className="ml-auto shrink-0"><ResultBadge result={drill.result} /></span>
              </button>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="py-6 text-center text-[0.75rem] text-muted-foreground">No drills recorded yet. Schedule the first recovery test to build readiness confidence.</li>
        )}
      </ul>
      <div className="grid grid-cols-3 gap-2 border-t border-border/70 pt-3">
        {[
          { label: "Avg duration", value: `${avgDuration}m`, sub: "across last 6" },
          { label: "Within RTO", value: `${withinRto}/${total}`, sub: `${total > 0 ? Math.round((withinRto / total) * 100) : 0}% on target` },
          { label: "Longest drill", value: slowest ? `${slowest.durationMin}m` : "—", sub: slowest?.name.split(" - ").pop() ?? "" },
        ].map((tile) => (
          <div key={tile.label} className="min-w-0 rounded-lg bg-muted/50 p-2.5">
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">{tile.label}</p>
            <p className="mt-1 font-display text-[0.9375rem] font-bold leading-snug tabular-nums text-foreground">{tile.value}</p>
            <p className="mt-0.5 truncate text-[0.625rem] text-muted-foreground" title={tile.sub}>{tile.sub}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-xs tabular-nums text-muted-foreground">Drill success <b className="text-foreground">{passed}/{total} ({successPct}%)</b> · 90d</span>
        <button
          type="button"
          onClick={onScheduleDrill}
          className="inline-flex items-center gap-1.5 rounded text-[0.8125rem] font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CalendarClock size={13} aria-hidden="true" />
          Schedule drill
        </button>
      </div>

      {/* Drill details */}
      <Dialog open={selected != null} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <DialogContent className="w-[min(28.75rem,calc(100vw-2rem))]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <FlaskConical size={15} aria-hidden="true" className="text-primary" />
              <DialogTitle className="text-sm font-bold">{selected?.name}</DialogTitle>
            </div>
            <DialogDescription className="text-[0.75rem]">Recovery readiness rehearsal carried out by {selected?.executedBy}.</DialogDescription>
          </DialogHeader>
          {selected && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border p-3 text-[0.75rem]">
              <dt className="text-muted-foreground">Drill ID</dt><dd className="text-right font-mono text-xs text-foreground">{selected.id}</dd>
              <dt className="text-muted-foreground">Date</dt><dd className="text-right text-foreground">{new Date(selected.epochMs).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</dd>
              <dt className="text-muted-foreground">Duration</dt><dd className="text-right tabular-nums text-foreground">{selected.durationMin}m (RTO {selected.rtoTargetMin}m)</dd>
              <dt className="text-muted-foreground">Tier</dt><dd className="text-right text-foreground">{selected.tier}</dd>
              <dt className="text-muted-foreground">Result</dt><dd className="flex justify-end"><ResultBadge result={selected.result} /></dd>
              <dt className="text-muted-foreground">Executed by</dt><dd className="text-right text-foreground">{selected.executedBy}</dd>
              <dt className="text-muted-foreground">Outcome</dt><dd className="text-right text-foreground">{selected.result === "Passed" ? "RTO met" : "RTO breached"}</dd>
            </dl>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-9 rounded-lg px-4 text-[0.8125rem]" onClick={() => setSelectedId(null)}>Close</Button>
            <Button className="h-9 rounded-lg px-4 text-[0.8125rem] font-semibold" onClick={() => { setSelectedId(null); onScheduleDrill(); }}>Schedule again</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ChartCard>
  );
}
