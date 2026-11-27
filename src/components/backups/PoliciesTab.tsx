import { useMemo } from "react";
import { ShieldCheck, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/logs/primitives";
import { POLICIES, type BackupJob, type Policy } from "@/mocks/backups";
import type { BackupJobDerived } from "@/utils/backupStats";
import { cn } from "@/lib/utils";

function TierCard({ policy, jobs, views, onEdit }: { policy: Policy; jobs: BackupJob[]; views: Map<string, BackupJobDerived>; onEdit: (jobId: string | null) => void }) {
  const tierJobs = jobs.filter((job) => job.policyId === policy.id);
  const enabled = tierJobs.filter((job) => job.enabled);
  let met = 0;
  for (const job of enabled) {
    if (views.get(job.id)?.rpoMet) met += 1;
  }
  const assessable = enabled.length;
  const pct = assessable > 0 ? Math.round((met / assessable) * 100) : null;
  const assetCount = new Set(tierJobs.map((job) => job.host)).size;
  const complianceTone = pct == null ? "text-muted-foreground" : pct >= 90 ? "text-green-600 dark:text-emerald-400" : pct >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";

  return (
    <ChartCard
      title={`${policy.tier} tier`}
      className="h-full min-h-[16.25rem] p-4"
      actions={(
        <Badge variant="outline" className={cn("h-6 border-transparent px-2 text-xs font-semibold", policy.tier === "Critical" ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" : "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300")}>
          {policy.id === "POL-critical" ? "default · critical" : "default · standard"}
        </Badge>
      )}
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {[
          { label: "RPO target", value: `${policy.rpoHours}h` },
          { label: "RTO target", value: `${policy.rtoMinutes}m` },
          { label: "Retention", value: `${policy.retentionDays} days` },
          { label: "Copies (3-2-1-1)", value: String(policy.copies) },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-muted/50 px-3 py-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 font-display text-[0.9375rem] font-bold tabular-nums text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span><b className="tabular-nums text-foreground">{tierJobs.length}</b> jobs</span>
        <span><b className="tabular-nums text-foreground">{assetCount}</b> assets</span>
        <span><b className={cn("tabular-nums", complianceTone)}>{pct == null ? "—" : `${pct}%`}</b> in RPO</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={met} aria-valuemin={0} aria-valuemax={assessable} aria-label={`${policy.tier} tier RPO compliance`}>
        <div className={cn("h-full rounded-full", pct == null ? "bg-muted" : pct >= 90 ? "bg-green-600" : pct >= 70 ? "bg-amber-600" : "bg-red-600")} style={{ width: `${pct ?? 0}%` }} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Shield size={13} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{policy.id === "POL-critical" ? "Used by databases and cold storage" : "Used by web, app, cache, edge and tooling"}</span>
        </p>
        <Button variant="outline"  onClick={() => onEdit(tierJobs[0]?.id ?? null)}>
          <ShieldCheck size={13} aria-hidden="true" className="mr-1" />Edit
        </Button>
      </div>
    </ChartCard>
  );
}

/** Policy tier cards: Critical and Standard defaults with coverage and compliance. Edit opens the policy editor for the tier's first job. */
export function PoliciesTab({ jobs, views, onEdit }: { jobs: BackupJob[]; views: Map<string, BackupJobDerived>; onEdit: (jobId: string | null) => void }) {
  const sorted = useMemo(() => [...POLICIES].sort((a, b) => (a.tier === "Critical" ? -1 : 1) - (b.tier === "Critical" ? -1 : 1)), []);
  return (
    <div className="grid gap-4 p-4 md:grid-cols-2">
      {sorted.map((policy) => <TierCard key={policy.id} policy={policy} jobs={jobs} views={views} onEdit={onEdit} />)}
    </div>
  );
}
