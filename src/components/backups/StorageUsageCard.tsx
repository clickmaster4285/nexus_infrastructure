import { useMemo, useState } from "react";
import { Archive, Cloud, HardDrive, Lock, MoreVertical, Eraser } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/components/logs/primitives";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { StorageView } from "@/hooks/useStorage";
import { cn } from "@/lib/utils";

const POOL_ICON = { "pool-nas": HardDrive, "pool-s3": Cloud, "pool-vault": Archive } as const;
const TIER_LABEL = { "on-prem": "on-prem · NAS", cloud: "cloud · S3", offsite: "offsite · cold vault" } as const;

function barClass(pct: number): string {
  if (pct > 85) return "bg-red-600";
  if (pct >= 70) return "bg-amber-600";
  return "bg-blue-500";
}
function pctTextClass(pct: number): string {
  if (pct > 85) return "text-red-600 dark:text-red-400";
  if (pct >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

const TB = 1024 ** 4;
/** Projected 30-day usage curve for AWS S3 (the fastest-filling pool). */
const FORECAST_DAYS = Array.from({ length: 31 }, (_, index) => {
  const used = 22.6 + (500 / 7) * index / 1024; // GB/day → TB
  return { day: `D${index}`, used: Math.round(used * 100) / 100, capacity: 25 };
});

/** Pool capacity bars (3-2-1-1) with threshold colour, 30d forecast and 3-2-1-1 tiles. Informational only. */
export function StorageUsageCard({ locations, totals, onExport }: { locations: StorageView[]; totals: { capacityBytes: number; usedBytes: number; availableBytes: number; utilizationPct: number }; onExport: () => void }) {
  const [confirmClean, setConfirmClean] = useState(false);
  const [reclaimedTb, setReclaimedTb] = useState(0);
  const soonestFull = locations
    .map((pool) => ({ pool, days: pool.daysToFull }))
    .filter((entry): entry is { pool: StorageView; days: number } => entry.days != null)
    .sort((a, b) => a.days - b.days)[0] ?? null;
  const usedTb = totals.usedBytes / TB;
  const s3 = locations.find((pool) => pool.id === "pool-s3");

  // Forecast series annotates the projected fill date for AWS S3.
  const forecastEnd = useMemo(() => {
    const day = Math.ceil((25 - 22.6) * 1024 / (500 / 7));
    const target = new Date(Date.now() + day * 24 * 60 * 60 * 1000);
    return target.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }, []);

  return (
    <ChartCard
      title="Storage Usage"
      className="h-full min-h-[17.5rem] p-4"
      actions={
        <AlertMenu
          label="Storage actions"
          align="end"
          width={200}
          trigger={
            <button type="button" aria-label="Storage actions" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MoreVertical size={16} aria-hidden="true" />
            </button>
          }
          items={[{ key: "export", label: "Export pool report (CSV)", onSelect: onExport }]}
        />
      }
    >
      <div className="flex flex-col gap-3">
        {locations.map((pool) => {
          const Icon = POOL_ICON[pool.id as keyof typeof POOL_ICON] ?? HardDrive;
          const isSoonest = soonestFull?.pool.id === pool.id;
          return (
            <div key={pool.id} className="min-w-0">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.8125rem] font-semibold leading-tight text-foreground">{pool.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {TIER_LABEL[pool.tier]} · +{pool.growthGBPerWeek} GB/wk{isSoonest && <span className="ml-1 font-semibold text-amber-700 dark:text-amber-400">Full in ~{soonestFull?.days}d</span>}
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
                  <p className="text-xs tabular-nums text-muted-foreground">
                    <span className="font-semibold text-foreground">{pool.usedTB.toFixed(1)}</span> TB used
                    <span className="hidden sm:inline"> · {(pool.capacityTB - pool.usedTB).toFixed(1)} TB free</span>
                  </p>
                  <p className="flex items-center gap-1">
                    <Badge variant="outline" className={cn("h-5 gap-1 border-transparent px-1.5 text-[0.625rem] font-semibold", pool.immutable ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-300")}>
                      <Lock size={9} aria-hidden="true" />{pool.immutable ? "Immutable" : "Not immutable"}
                    </Badge>
                    <Badge variant="outline" className="h-5 gap-1 border-transparent bg-blue-50 px-1.5 text-[0.625rem] font-semibold text-blue-800 dark:bg-blue-500/10 dark:text-blue-300"><Lock size={9} aria-hidden="true" />AES-256</Badge>
                  </p>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={Math.round(pool.pctUsed)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${pool.name} capacity used`}
                >
                  <div className={cn("h-full rounded-full", barClass(pool.pctUsed))} style={{ width: `${Math.min(100, pool.pctUsed)}%` }} />
                </div>
                <span className={cn("w-10 shrink-0 text-right text-xs font-semibold tabular-nums", pctTextClass(pool.pctUsed))}>{pool.pctUsed}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Forecast (30d) */}
      {s3 && (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">Forecast (30d) · AWS S3</p>
            <span className="text-[0.625rem] font-semibold text-amber-700 dark:text-amber-400">Full in ~34d ({forecastEnd})</span>
          </div>
          <div className="mt-1 h-[5rem] w-full" role="img" aria-label="Projected AWS S3 usage over 30 days against capacity">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={FORECAST_DAYS} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="day" hide />
                <YAxis domain={[20, 25]} hide />
                <Area type="monotone" dataKey="used" stroke="#3B82F6" strokeWidth={1.6} fill="#3B82F6" fillOpacity={0.15} isAnimationActive={false} />
                <Area type="monotone" dataKey="capacity" stroke="#94A3B8" strokeWidth={1} strokeDasharray="4 3" fill="none" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3-2-1-1 tiles */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Dedup ratio", value: "3.2:1", sub: "post-compression" },
          { label: "Est. cost / mo", value: "$3,240", sub: "from provider invoices" },
          { label: "Reclaimable", value: `${reclaimedTb > 0 ? "0.0" : "1.8"} TB`, sub: "expired restore points" },
        ].map((tile) => (
          <div key={tile.label} className="min-w-0 rounded-lg bg-muted/50 p-2.5">
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">{tile.label}</p>
            <p className="mt-1 font-display text-[0.9375rem] font-bold leading-snug tabular-nums text-foreground">{tile.value}</p>
            <p className="mt-0.5 truncate text-[0.625rem] text-muted-foreground" title={tile.sub}>{tile.sub}</p>
          </div>
        ))}
      </div>
      {reclaimedTb > 0 ? (
        <p role="status" className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
          <span>Reclaimed 1.8 TB of expired restore points</span>
          <button type="button" onClick={() => setReclaimedTb(0)} className="shrink-0 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Undo</button>
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.6875rem] text-muted-foreground">Expired points &gt; 90d are safe to prune.</p>
          <Button variant="outline" className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-semibold" onClick={() => setConfirmClean(true)}>
            <Eraser size={13} aria-hidden="true" />Clean up
          </Button>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>Used <b className="tabular-nums text-foreground">{usedTb.toFixed(1)} TB</b> of {(totals.capacityBytes / TB).toFixed(0)} TB · ≤{(totals.utilizationPct).toFixed(0)}% full</span>
        <span>Growth <b className="tabular-nums text-foreground">+626 GB/wk</b></span>
      </div>

      {/* Confirm cleanup */}
      <Dialog open={confirmClean} onOpenChange={setConfirmClean}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reclaim 1.8 TB of expired restore points?</DialogTitle>
            <DialogDescription>Restore points older than 90 days (verified successful) will be pruned from Local NAS and AWS S3. Active backup sets are not affected. You can undo this for 30 days.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-9 rounded-lg px-4 text-[0.8125rem]" onClick={() => setConfirmClean(false)}>Keep points</Button>
            <Button className="h-9 rounded-lg px-4 text-[0.8125rem] font-semibold" onClick={() => { setReclaimedTb(1.8); setConfirmClean(false); }}>Reclaim 1.8 TB</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ChartCard>
  );
}
