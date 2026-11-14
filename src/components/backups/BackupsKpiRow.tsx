import { ArrowDown, ArrowUp, CheckCircle2, Database, FlaskConical, ShieldCheck, Shield } from "lucide-react";

import { StatCard } from "@/components/ui/StatCard";
import { Sparkline } from "@/components/shared/sparkline";
import type { BackupStats } from "@/utils/backupStats";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/utils/storageForecast";

export type BackupKpiKey = "success-rate" | "protected" | "failed" | "size-30d" | "rpo" | "last-restore-test";

const TONE = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
} as const;

/** KPI row - cards ARE clickable and filter the section below (success/failed/coverage). */
export function BackupsKpiRow({ stats, lastRestoreTest, onKpiClick }: {
  stats: BackupStats;
  /** Latest drill summary for the Last Restore Test card (null when never run). */
  lastRestoreTest: { result: "Passed" | "Failed"; daysAgo: number } | null;
  onKpiClick: (key: BackupKpiKey) => void;
}) {
  const delta = stats.successRateDelta;
  const deltaNode = delta == null
    ? <span className="text-muted-foreground">no prior week</span>
    : (
      <>
        {delta >= 0 ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
        {`${delta >= 0 ? "+" : ""}${delta} pts`} <span className="font-normal text-muted-foreground">vs last week</span>
      </>
    );
  const deltaClass = delta == null ? "text-muted-foreground" : delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";

  return (
    <section aria-label="Backup key performance indicators" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <StatCard
        icon={<CheckCircle2 size={18} aria-hidden="true" />}
        iconTone={TONE.success}
        label="Success Rate (7d)"
        labelClassName="whitespace-nowrap"
        value={stats.successRate7d == null ? "—" : `${stats.successRate7d}%`}
        trend={deltaNode}
        trendClassName={cn(deltaClass, "whitespace-nowrap")}
        valueAside={<Sparkline values={stats.successSparkline} color="#34D399" label="Success rate - trailing 14 days" className="block h-6 w-20" />}
        onClick={() => onKpiClick("success-rate")}
        onClickLabel="Show successful backup jobs"
        className="h-full min-h-[88px] p-4"
      />
      <StatCard
        icon={<Shield size={18} aria-hidden="true" />}
        iconTone={TONE.blue}
        label="Protected Assets"
        labelClassName="whitespace-nowrap"
        value={`${stats.protectedAssets}/${stats.totalAssets}`}
        trend={<span className="font-normal text-muted-foreground">2 unprotected</span>}
        trendClassName="text-muted-foreground whitespace-nowrap"
        onClick={() => onKpiClick("protected")}
        onClickLabel="Show asset coverage"
        className="h-full min-h-[88px] p-4"
      />
      <StatCard
        icon={<Database size={18} aria-hidden="true" />}
        iconTone={TONE.red}
        label="Failed (24h)"
        labelClassName="whitespace-nowrap"
        value={String(stats.failedRuns24h)}
        trend={<span className="font-normal text-muted-foreground">{stats.failedJobs24h} jobs</span>}
        trendClassName="text-muted-foreground whitespace-nowrap"
        valueAside={<Sparkline values={stats.failedSparkline} color="#F87171" label="Failed runs - trailing 14 days" className="block h-6 w-20" />}
        goodDirection="down"
        onClick={() => onKpiClick("failed")}
        onClickLabel="Show failed backup jobs"
        className="h-full min-h-[88px] p-4"
      />
      <StatCard
        icon={<Database size={18} aria-hidden="true" />}
        iconTone={TONE.violet}
        label="Backed up (30d)"
        labelClassName="whitespace-nowrap"
        value={formatBytes(stats.totalBackupSizeBytes)}
        trend={<span className="font-normal text-muted-foreground">{stats.totalJobs} jobs · full+incremental</span>}
        trendClassName="text-muted-foreground whitespace-nowrap"
        onClick={() => onKpiClick("size-30d")}
        onClickLabel="Show all backup jobs"
        className="h-full min-h-[88px] p-4"
      />
      <StatCard
        icon={<ShieldCheck size={18} aria-hidden="true" />}
        iconTone={TONE.amber}
        label="RPO Compliance"
        labelClassName="whitespace-nowrap"
        value={stats.rpoCompliancePct == null ? "—" : `${stats.rpoCompliancePct}%`}
        trend={stats.rpoBreachCount > 0
          ? <span className="font-semibold text-rose-600 dark:text-rose-400">1 breach</span>
          : <span className="font-normal text-muted-foreground">all within RPO</span>}
        trendClassName="text-muted-foreground whitespace-nowrap"
        onClick={() => onKpiClick("rpo")}
        onClickLabel="Show RPO breach jobs"
        goodDirection="up"
        className="h-full min-h-[88px] p-4"
      />
      <StatCard
        icon={<FlaskConical size={18} aria-hidden="true" />}
        iconTone={lastRestoreTest?.result === "Failed" ? TONE.red : TONE.success}
        label="Last Restore Test"
        labelClassName="whitespace-nowrap"
        value={lastRestoreTest?.result ?? "—"}
        trend={<span className="font-normal text-muted-foreground">{lastRestoreTest ? `${lastRestoreTest.daysAgo}d ago` : "never run"}</span>}
        trendClassName="text-muted-foreground whitespace-nowrap"
        onClick={() => onKpiClick("last-restore-test")}
        onClickLabel="Show restore drills"
        goodDirection="up"
        className="h-full min-h-[88px] p-4"
      />
    </section>
  );
}
