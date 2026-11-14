import { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

import { AssetTypeBadge } from "@/components/backups/backup-badges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationCell } from "@/components/backups/location-meta";
import { STORAGE_POOLS, type StoragePool } from "@/mocks/storageLocations";
import { POLICIES, type AssetView, type PolicyTier } from "@/mocks/backups";
import { cn } from "@/lib/utils";

const GROUP_LABELS: Record<string, string> = {
  "database-cluster": "Database cluster",
  "production-web": "Production web",
  "api-services": "API services",
  "cache-servers": "Cache servers",
  "backup-group": "Backup group",
  "monitoring-stack": "Monitoring stack",
  "edge-locations": "Edge locations",
};

function tierTone(tier: PolicyTier): string {
  return tier === "Critical" ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" : "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300";
}

export interface ProtectAssetPayload {
  policyId: "POL-critical" | "POL-standard";
  poolId: string;
  schedule: { kind: "daily"; hour: number; minute: number; timeZone: string };
}

/** Coverage: per-asset protection table with the Protect now flow for unprotected assets. */
export function CoverageTab({ assetViews, onProtect }: { assetViews: AssetView[]; onProtect: (host: string, payload: ProtectAssetPayload) => void }) {
  const [protectHost, setProtectHost] = useState<string | null>(null);
  const [policyId, setPolicyId] = useState<"POL-critical" | "POL-standard">("POL-standard");
  const [poolId, setPoolId] = useState<string>("pool-vault");
  const [scheduleTime, setScheduleTime] = useState("02:00");
  const [timeZone, setTimeZone] = useState("Asia/Karachi");

  // Unprotected rows first, then alphabetical.
  const rows = [...assetViews].sort((a, b) => Number(a.protected) - Number(b.protected) || a.host.localeCompare(b.host));

  const protectTarget = protectHost ? assetViews.find((asset) => asset.host === protectHost) ?? null : null;

  const submitProtect = () => {
    if (!protectTarget) return;
    const [hourRaw, minuteRaw] = scheduleTime.split(":");
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    onProtect(protectTarget.host, {
      policyId,
      poolId,
      schedule: { kind: "daily", hour: Number.isFinite(hour) ? hour : 2, minute: Number.isFinite(minute) ? minute : 0, timeZone },
    });
    setProtectHost(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Assets table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: "26%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-card text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2">Asset</th>
              <th scope="col" className="px-3 py-2">Group</th>
              <th scope="col" className="px-3 py-2">Type</th>
              <th scope="col" className="px-3 py-2">Policy</th>
              <th scope="col" className="px-3 py-2">RPO</th>
              <th scope="col" className="px-3 py-2 text-right">Status / Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((asset) => (
              <tr key={asset.host} className={cn("border-b border-border/60 align-middle transition-colors hover:bg-[#F8FAFC] dark:hover:bg-muted/40", !asset.protected && "bg-red-50/40 dark:bg-red-500/5")}>
                <td className="px-3 py-2 align-middle">
                  <span className="block font-mono text-xs text-foreground">{asset.host}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{asset.owner}</span>
                </td>
                <td className="px-3 py-2 align-middle text-xs text-muted-foreground">{asset.group ? (GROUP_LABELS[asset.group] ?? asset.group) : "Ungrouped"}</td>
                <td className="px-3 py-2 align-middle"><AssetTypeBadge label={asset.assetType} /></td>
                <td className="px-3 py-2 align-middle">
                  {asset.policyId
                    ? <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold", tierTone(asset.tier))}>{asset.tier}</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 align-middle text-xs tabular-nums text-muted-foreground">{asset.protected ? "meets policy" : "—"}</td>
                <td className="px-3 py-2 text-right align-middle">
                  {asset.protected ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A] dark:text-emerald-400"><ShieldCheck size={13} aria-hidden="true" />Protected</span>
                  ) : (
                    <Button variant="outline" className="h-8 rounded-lg border-red-200 px-2.5 text-xs font-semibold text-[#DC2626] hover:bg-red-50 dark:border-red-500/30 dark:text-red-400" onClick={() => setProtectHost(asset.host)}>
                      <AlertTriangle size={12} aria-hidden="true" className="mr-1" />Protect now
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Protect now dialog */}
      <Dialog open={protectHost != null} onOpenChange={(open) => { if (!open) setProtectHost(null); }}>
        <DialogContent className="w-[min(520px,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>Protect {protectTarget?.host}</DialogTitle>
            <DialogDescription>Enable a backup policy for this asset. Choose tier, schedule and destination pool.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div role="radiogroup" aria-label="Policy tier" className="grid grid-cols-2 gap-2">
              {POLICIES.map((policy) => {
                const active = policyId === policy.id;
                return (
                  <button
                    key={policy.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPolicyId(policy.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-primary ring-1 ring-primary" : "border-border hover:bg-accent",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <b className="text-[13px] text-foreground">{policy.tier}</b>
                      {policy.tier === "Critical" ? <span className="rounded bg-orange-50 px-1.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">recommended</span> : null}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">RPO {policy.rpoHours}h · RTO {policy.rtoMinutes}m</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Keep {policy.retentionDays} days · {policy.copies} copies</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-muted-foreground">Every day</span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                At
                <Input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} className="h-9 w-[120px] text-sm" aria-label="Backup time" />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Timezone
                <Select value={timeZone} onValueChange={setTimeZone}>
                  <SelectTrigger className="h-9 w-[160px] text-xs" aria-label="Timezone"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Asia/Karachi", "UTC", "Europe/London", "Europe/Berlin"].map((zone) => <SelectItem key={zone} value={zone}>{zone}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
            </div>
            <div role="radiogroup" aria-label="Destination pool" className="flex flex-col gap-1.5">
              {STORAGE_POOLS.map((pool: StoragePool) => {
                const active = poolId === pool.id;
                return (
                  <button
                    key={pool.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPoolId(pool.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-primary ring-1 ring-primary" : "border-border hover:bg-accent",
                    )}
                  >
                    <LocationCell poolId={pool.id} className="min-w-0 flex-1" />
                    {pool.immutable && <span className="shrink-0 rounded bg-emerald-50 px-1.5 text-[10px] font-semibold uppercase text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">WORM</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-9 rounded-lg px-4 text-[13px]" onClick={() => setProtectHost(null)}>Cancel</Button>
            <Button className="h-9 gap-1.5 rounded-lg px-4 text-[13px] font-semibold" onClick={submitProtect}>
              <CheckCircle2 size={15} aria-hidden="true" />Enable backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
