"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeft, ArrowRight, Bell, Check, ChevronLeft, ChevronRight, Copy, Database,
  FileText, Flame, Gauge, GitBranch, HardDrive, KeyRound, LifeBuoy, LineChart, ListChecks,
  RefreshCw, ShieldAlert, ShieldCheck, Trash2, TrendingUp, Wrench, Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/shared/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TechLogo } from "@/components/shared/icon";
import { cn } from "@/lib/utils";
import {
  CAPACITY_EXCLUDED_DAYS, capacityResources, resourceForecast,
  type ForecastMethod, type RiskLevel,
} from "@/mocks/capacityPlanning";
import { ALERT_RULE_LIST } from "@/mocks/alertRules";
import { ForecastChart, ConfidenceBadge } from "@/components/capacity-planning/forecast-chart";
import { ScenarioBuilderDialog, type ScenarioBuilderResult } from "@/components/capacity-planning/scenario-builder-dialog";
import { NewCapacityPlanDialog, ForecastAlertDialog, type PlanPrefill } from "@/components/capacity-planning/plan-dialog";
import { readCapacityPlans, readScenarios, type CapacityPlan, type Scenario } from "@/mocks/capacityPlanning";

const fmtDay = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const riskBadge: Record<RiskLevel, string> = {
  at_risk: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  watch: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  stable: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
};
const methodName: Record<ForecastMethod, string> = { auto: "Auto", linear: "Linear", seasonal: "Seasonal" };

export function ResourceDetail({ resourceId }: { resourceId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const setParam = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value == null) next.delete(key); else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [params, pathname, router]);

  const resource = useMemo(() => capacityResources.find((item) => item.id === resourceId) ?? null, [resourceId]);
  const [method, setMethod] = useState<ForecastMethod>("auto");
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertRuleId, setAlertRuleId] = useState<string | null>(null);
  const [planPrefill, setPlanPrefill] = useState<PlanPrefill | null>(null);
  const [notice, setNotice] = useState("");
  const toast = useCallback((message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2500); }, []);

  const tab = params.get("tab") ?? "overview";
  const index = resource ? capacityResources.findIndex((item) => item.id === resource.id) : -1;
  const prevResource = index > 0 ? capacityResources[index - 1] : null;
  const nextResource = index >= 0 && index < capacityResources.length - 1 ? capacityResources[index + 1] : null;

  const forecast = resource ? resourceForecast(resource, method) : null;
  const linearFit = resource ? resourceForecast(resource, "linear") : null;
  const seasonalFit = resource ? resourceForecast(resource, "seasonal") : null;
  const linkedPlan = useMemo(() => readCapacityPlans().find((plan) => plan.resourceId === resourceId) ?? null, [resourceId, notice]);
  const linkedScenario = useMemo(() => readScenarios().filter((scenario) => scenario.resourceId === resourceId), [resourceId, notice]);

  const openPlanPrefill = useCallback(() => {
    if (!resource || !forecast) return;
    setPlanPrefill({
      resourceId: resource.id,
      action: resource.recommendedAction === "Add capacity" ? "Add server" : resource.recommendedAction === "Expand storage" ? "Expand storage" : resource.recommendedAction === "Migrate" ? "Migrate" : resource.recommendedAction === "Right-size" ? "Right-size" : "Cleanup",
      title: resource.recommendedDetail,
      estimatedCost: resource.estimatedCost ?? 0,
      targetDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
      orderByDate: forecast.orderByDate ? new Date(forecast.orderByDate).toISOString().slice(0, 10) : new Date(Date.now() + 28 * 86_400_000).toISOString().slice(0, 10),
    });
    setPlanOpen(true);
  }, [resource, forecast]);

  const toggleForecastAlert = () => {
    if (!alertRuleId) return;
    const rule = ALERT_RULE_LIST.find((item) => item.id === alertRuleId);
    if (!rule) return;
    rule.status = rule.status === "Enabled" ? "Disabled" : "Enabled";
    toast(rule.status === "Enabled" ? "Forecast alert enabled" : "Forecast alert disabled");
    setNotice(notice === "tick" ? "" : "tick");
  };

  if (!resource) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Monitoring", "Capacity Planning", "Not found"]} title="Resource not found" subtitle="This capacity resource doesn't exist or was removed from the demo set." showRefresh={false} />
        <Card className="grid min-h-64 place-items-center rounded-xl p-8 text-center text-sm text-muted-foreground">
          <div className="max-w-sm space-y-3">
            <ShieldAlert size={28} className="mx-auto text-amber-600" aria-hidden="true" />
            <p><b className="text-foreground">Resource not found</b></p>
            <Link href="/monitoring/capacity-planning" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"><ArrowLeft size={15} />Back to Capacity Planning</Link>
          </div>
        </Card>
      </div>
    );
  }

  const riskLabel = forecast?.risk === "at_risk" ? "At risk" : forecast?.risk === "watch" ? "Watch" : forecast?.risk === "stable" ? "Stable" : "Healthy";

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Monitoring", "Capacity Planning", resource.name]}
        title={resource.name}
        subtitle={`${resource.type} · ${resource.group} · ${resource.site}`}
        statusBadge={
          <span className="flex flex-wrap items-center gap-2">
            <Badge className={cn("border", riskBadge[forecast?.risk ?? "healthy"])}>{riskLabel}</Badge>
            <ConfidenceBadge level={forecast?.confidence ?? "medium"} />
            <Badge variant="outline">{resource.type}</Badge>
          </span>
        }
        showRefresh={false}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push("/monitoring/capacity-planning")}><ArrowLeft size={15} />Back</Button>
            <Button variant="outline" onClick={() => setAlertOpen(true)}><Bell size={15} />Forecast alert</Button>
            <Button variant="outline" onClick={() => setScenarioOpen(true)}><GitBranch size={15} />What-if</Button>
            <Button onClick={openPlanPrefill}><FileText size={15} />Create plan</Button>
          </>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Resource detail sections">
        {[
          { value: "overview", label: "Overview", icon: Gauge },
          { value: "forecast", label: "Forecast", icon: TrendingUp },
          { value: "scenarios", label: "Scenarios", icon: GitBranch },
          { value: "plans", label: "Plans", icon: ListChecks },
          { value: "quality", label: "Data quality", icon: ShieldCheck },
        ].map((entry) => (
          <button key={entry.value} role="tab" aria-selected={tab === entry.value} onClick={() => setParam("tab", entry.value === "overview" ? null : entry.value)} className={cn("flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === entry.value ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <entry.icon size={15} aria-hidden="true" />{entry.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        {/* LEFT */}
        <div className="space-y-4 xl:col-span-8">
          {tab === "overview" && (
            <>
              <Card className="rounded-xl p-4">
                <h2 className="text-sm font-bold text-foreground">Current state</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Current", value: `${resource.current.toFixed(resource.current >= 100 ? 0 : 1)}${resource.metric.includes("%") ? "%" : resource.metric === "Storage TB" ? " TB" : resource.metric === "Storage GB" ? " GB" : ""}` },
                    { label: "Capacity", value: `${resource.capacity}${resource.metric.includes("%") ? "%" : resource.metric === "Storage TB" ? " TB" : resource.metric === "Storage GB" ? " GB" : ""}` },
                    { label: "Headroom", value: `${Math.max(0, Math.round(100 - resource.current))}%` },
                    { label: "P95 peak", value: `${resource.p95.toFixed(resource.p95 >= 100 ? 0 : 1)}${resource.metric.includes("%") ? "%" : ""}` },
                    { label: "Growth", value: `${resource.growthPerWeek >= 0 ? "+" : ""}${resource.growthPerWeek.toFixed(resource.growthPerWeek >= 1 ? 1 : 2)}/wk` },
                    { label: "Days to threshold", value: forecast && Number.isFinite(forecast.daysToCrit) ? `${Math.round(forecast.daysToCrit)}d (est.)` : "No exhaustion" },
                    { label: "Exhaustion date", value: forecast?.exhaustionDate ? fmtDay(Date.parse(forecast.exhaustionDate)) : "—" },
                    { label: "Order-by date", value: forecast?.orderByDate ? fmtDay(Date.parse(forecast.orderByDate)) : "—" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-muted/50 p-2.5">
                      <dt className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                      <dd className="mt-0.5 text-[0.9375rem] font-bold tabular-nums text-foreground">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <Card className="rounded-xl p-4">
                <h2 className="text-sm font-bold text-foreground">Why it matters</h2>
                <p className="mt-2 text-[0.8125rem] leading-6 text-muted-foreground">
                  {forecast?.risk === "at_risk"
                    ? `${resource.name} is projected to cross its critical threshold within 30 days if the current trend holds. Order or expand before ${forecast?.orderByDate ? fmtDay(Date.parse(forecast.orderByDate)) : "the lead time elapses"} — after that, provisioning can&apos;t land in time (est.).`
                    : forecast?.risk === "watch"
                      ? `${resource.name} is in the watch band. The trend is manageable today, but growth accelerating now would push it into the critical band — review monthly.`
                      : "This resource is comfortably inside capacity. Keep the normal review cadence."}
                </p>
              </Card>
            </>
          )}

          {tab === "forecast" && forecast && linearFit && seasonalFit && (
            <>
              <Panel title={<span className="text-[1rem] font-semibold text-foreground">Forecast · {methodName[method]} fit</span>} className="p-4" headerClassName="h-10" showOptions={false} action={<div className="flex items-center gap-1">{(["linear", "seasonal", "auto"] as const).map((value) => <button key={value} onClick={() => setMethod(value)} aria-pressed={method === value} className={cn("h-8 rounded-lg px-2.5 text-[0.75rem] font-medium capitalize text-muted-foreground hover:bg-accent", method === value && "bg-primary/10 text-primary")}>{value}</button>)}</div>}>
                <ForecastChart resource={resource} horizonDays={90} method={method} historyDays={90} heightClassName="min-h-[280px]" />
                <p className="mt-1 text-[0.75rem] text-muted-foreground">Excluded {CAPACITY_EXCLUDED_DAYS} day(s) — maintenance windows + resolved incidents are dropped from the fit. Confidence band ±1.96σ. Not a guarantee.</p>
              </Panel>
              <Card className="overflow-hidden rounded-xl">
                <div className="border-b border-border px-4 py-3 text-[0.8125rem] font-semibold text-foreground">Method comparison (backtest hold-out)</div>
                <table className="w-full min-w-[420px] text-left text-[0.8125rem]">
                  <thead className="bg-muted text-xs text-muted-foreground"><tr>{["Method", "MAPE", "Accuracy", "R²", "Fit"].map((head) => <th key={head} className="px-4 py-2 font-semibold">{head}</th>)}</tr></thead>
                  <tbody>
                    {[{ label: "Linear", entry: linearFit }, { label: "Seasonal (weekly)", entry: seasonalFit }].map(({ label, entry }) => {
                      const accuracy = Math.max(0, Math.round(100 - entry.mape));
                      const best = entry.mape <= Math.min(linearFit.mape, seasonalFit.mape);
                      return (
                        <tr key={label} className="border-t border-border">
                          <td className="px-4 py-2 font-medium text-foreground">{label}{best && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">best</span>}</td>
                          <td className="px-4 py-2 tabular-nums">{entry.mape.toFixed(1)}%</td>
                          <td className="px-4 py-2 tabular-nums">{accuracy}%</td>
                          <td className="px-4 py-2 tabular-nums">{entry.r2.toFixed(2)}</td>
                          <td className="px-4 py-2 tabular-nums">{entry.slopePerDay >= 0 ? "+" : ""}{(entry.slopePerDay * 7).toFixed(2)}/wk</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </>
          )}

          {tab === "scenarios" && (
            <Panel title={<span className="text-[1rem] font-semibold text-foreground">Saved scenarios</span>} className="p-4" headerClassName="h-10" showOptions={false} action={<Button variant="outline" className="h-8 gap-1 px-2.5 text-[0.75rem]" onClick={() => setScenarioOpen(true)}><GitBranch size={13} />New scenario</Button>}>
              <ul className="mt-1 divide-y divide-border/60">
                {linkedScenario.length === 0 && <li className="py-6 text-center text-[0.8125rem] text-muted-foreground">No scenarios for this resource yet.</li>}
                {linkedScenario.map((scenario) => (
                  <li key={scenario.id} className="flex items-center gap-3 py-3">
                    <GitBranch size={15} className="shrink-0 text-violet-600" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[0.8125rem] text-foreground">{scenario.name}</b>
                      <span className="text-[0.75rem] text-muted-foreground">{scenario.adjustment.growthPct !== 0 ? `${scenario.adjustment.growthPct > 0 ? "+" : ""}${scenario.adjustment.growthPct}% growth · ` : ""}{scenario.resultSummary}</span>
                    </div>
                    <span className="shrink-0 text-[0.75rem] tabular-nums text-muted-foreground">${scenario.estimatedCost}/mo</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {tab === "plans" && (
            <Panel title={<span className="text-[1rem] font-semibold text-foreground">Plans for this resource</span>} className="p-4" headerClassName="h-10" showOptions={false} action={<Button variant="outline" className="h-8 gap-1 px-2.5 text-[0.75rem]" onClick={openPlanPrefill}><FileText size={13} />Create plan</Button>}>
              <ul className="mt-1 divide-y divide-border/60">
                {!linkedPlan && <li className="py-6 text-center text-[0.8125rem] text-muted-foreground">No plan yet. Create one to convert this forecast into tracked work.</li>}
                {linkedPlan && (
                  <li className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <b className="truncate text-[0.8125rem] text-foreground">{linkedPlan.title}</b>
                      <Badge variant="outline">{linkedPlan.status}</Badge>
                    </div>
                    <p className="mt-1 text-[0.75rem] text-muted-foreground">{linkedPlan.action} · {linkedPlan.owner} · ${linkedPlan.estimatedCost}/mo · {linkedPlan.changeTicket ?? "no ticket"}</p>
                    <ol className="mt-2 space-y-1 text-[0.75rem] text-muted-foreground">
                      {linkedPlan.timeline.map((entry) => <li key={entry.id}>· {entry.text}</li>)}
                    </ol>
                  </li>
                )}
              </ul>
            </Panel>
          )}

          {tab === "quality" && (
            <Panel title={<span className="text-[1rem] font-semibold text-foreground">Data quality</span>} className="p-4" headerClassName="h-10" showOptions={false}>
              <dl className="mt-1 grid grid-cols-2 gap-3 text-[0.8125rem] sm:grid-cols-4">
                {[
                  { label: "History points", value: String(resource.history.length) },
                  { label: "Missing points", value: "0" },
                  { label: "Excluded days", value: String(CAPACITY_EXCLUDED_DAYS) },
                  { label: "Outliers", value: "1" },
                ].map((item) => <div key={item.label} className="rounded-lg bg-muted/50 p-2.5"><dt className="text-[0.625rem] uppercase text-muted-foreground">{item.label}</dt><dd className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{item.value}</dd></div>)}
              </dl>
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[0.75rem] leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <b>Why {forecast?.confidence === "high" ? "high" : forecast?.confidence === "medium" ? "medium" : "low"} confidence:</b>{" "}
                {forecast?.confidence === "high"
                  ? `${resource.history.length} days of history, weekly seasonality detected, R² ${forecast.r2.toFixed(2)} — the fit explains most variance.`
                  : forecast?.confidence === "medium"
                    ? `${resource.history.length} days of history with a decent trend (R² ${forecast.r2.toFixed(2)}), but residuals are noisy — treat projections as ranges, not dates.`
                    : "Thin history or a weak fit — this is indicative only, not a commitment."}
              </div>
              <p className="mt-2 text-[0.75rem] text-muted-foreground">Excluded: {CAPACITY_EXCLUDED_DAYS} day(s) — maintenance windows + resolved incidents (see Maintenance Windows and Incidents).</p>
            </Panel>
          )}
        </div>

        {/* RIGHT rail */}
        <div className="space-y-4 xl:col-span-4 xl:sticky xl:top-4">
          <Card className="rounded-xl p-4">
            <h2 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Status</h2>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.8125rem] font-semibold", riskBadge[forecast?.risk ?? "healthy"])}><Flame size={13} />{riskLabel}</span>
              <ConfidenceBadge level={forecast?.confidence ?? "medium"} />
            </div>
            <dl className="mt-3 space-y-1.5 text-[0.8125rem] text-muted-foreground">
              <div className="flex justify-between gap-2"><dt>Days to threshold</dt><dd className="tabular-nums text-foreground">{forecast && Number.isFinite(forecast.daysToCrit) ? `${Math.round(forecast.daysToCrit)}d (est.)` : "No exhaustion"}</dd></div>
              <div className="flex justify-between gap-2"><dt>Estimator</dt><dd>{forecast?.method} fit</dd></div>
              <div className="flex justify-between gap-2"><dt>Lead time</dt><dd>{resource.leadTimeDays}d</dd></div>
              <div className="flex justify-between gap-2"><dt>Order by</dt><dd className="tabular-nums">{forecast?.orderByDate ? fmtDay(Date.parse(forecast.orderByDate)) : "—"}</dd></div>
            </dl>
          </Card>

          <Card className="rounded-xl p-4">
            <h2 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Recommendation</h2>
            <p className="mt-2 text-[0.8125rem] font-medium leading-6 text-foreground">{resource.recommendedDetail}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[0.625rem] font-medium text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5">Effort {resource.effort}</span>
              <span className="rounded bg-muted px-1.5 py-0.5">{resource.estimatedCost == null ? "—" : resource.estimatedCost < 0 ? `saves $${Math.abs(resource.estimatedCost)}/mo` : `$${resource.estimatedCost}/mo`}</span>
              <span className="rounded bg-muted px-1.5 py-0.5">Lead {resource.leadTimeDays}d</span>
            </div>
            <Button className="mt-3 w-full" onClick={openPlanPrefill}><FileText size={15} />Create plan</Button>
          </Card>

          <Card className="rounded-xl p-4">
            <h2 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Linked</h2>
            <ul className="mt-2 space-y-1.5 text-[0.8125rem]">
              {resource.linkedAssetId && <li><Link href="/infrastructure/all-servers" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-foreground hover:bg-muted"><ServerGlyph />{resource.linkedAssetId}<span className="ml-auto text-[0.6875rem] text-muted-foreground">Server details →</span></Link></li>}
              {resource.linkedPoolId && <li><Link href="/operations/backups-and-recovery" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-foreground hover:bg-muted"><HardDrive size={15} className="text-muted-foreground" aria-hidden="true" />{resource.linkedPoolId === "pool-s3" ? "AWS S3 pool" : resource.linkedPoolId === "pool-nas" ? "Local NAS" : "Offsite Vault"}<span className="ml-auto text-[0.6875rem] text-muted-foreground">Backups →</span></Link></li>}
              <li><Link href="/monitoring/disk-and-storage" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-foreground hover:bg-muted"><HardDrive size={15} className="text-muted-foreground" aria-hidden="true" />Disk &amp; Storage<span className="ml-auto text-[0.6875rem] text-muted-foreground">→</span></Link></li>
              {resource.metric === "Connections" && <li><Link href="/monitoring/database-monitoring" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-foreground hover:bg-muted"><Database size={15} className="text-muted-foreground" aria-hidden="true" />Database Monitoring<span className="ml-auto text-[0.6875rem] text-muted-foreground">→</span></Link></li>}
              <li><Link href="/operations/alert-rules" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-foreground hover:bg-muted"><KeyRound size={15} className="text-muted-foreground" aria-hidden="true" />Alert Rules<span className="ml-auto text-[0.6875rem] text-muted-foreground">→</span></Link></li>
              <li><Link href="/operations/maintenance-windows" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-foreground hover:bg-muted"><Wrench size={15} className="text-muted-foreground" aria-hidden="true" />Maintenance windows<span className="ml-auto text-[0.6875rem] text-muted-foreground">→</span></Link></li>
            </ul>
          </Card>

          <Card className="rounded-xl p-4">
            <h2 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Forecast alert</h2>
            {alertRuleId ? (
              <div className="mt-2 text-[0.8125rem]">
                <p className="flex items-center gap-2 text-foreground"><ShieldCheck size={15} className="text-emerald-600" aria-hidden="true" /><b>Alert rule active</b></p>
                <p className="mt-1 text-[0.75rem] text-muted-foreground">Fires when forecast reaches {resource.critThreshold}% within 14d (est.). Channels: Email, Slack.</p>
                <Button variant="outline" className="mt-2 w-full" onClick={toggleForecastAlert}>{ALERT_RULE_LIST.find((rule) => rule.id === alertRuleId)?.status === "Enabled" ? "Disable rule" : "Enable rule"}</Button>
              </div>
            ) : (
              <div className="mt-2">
                <p className="text-[0.8125rem] text-muted-foreground">Predicted to reach {resource.critThreshold}% within 14 days — get paged before it happens.</p>
                <Button variant="outline" className="mt-2 w-full" onClick={() => setAlertOpen(true)}><Bell size={15} />Create forecast alert</Button>
              </div>
            )}
          </Card>

          <div className="flex items-center justify-between gap-2">
            {prevResource ? <Button variant="outline" className="h-9 gap-1.5 text-[0.8125rem]" onClick={() => router.push(`/monitoring/capacity-planning/${prevResource.id}`)}><ChevronLeft size={14} />Prev</Button> : <span />}
            <Link href="/monitoring/capacity-planning" className="text-[0.8125rem] font-medium text-primary hover:underline">All resources →</Link>
            {nextResource ? <Button variant="outline" className="h-9 gap-1.5 text-[0.8125rem]" onClick={() => router.push(`/monitoring/capacity-planning/${nextResource.id}`)}>Next<ChevronRight size={14} /></Button> : <span />}
          </div>
        </div>
      </div>

      <ScenarioBuilderDialog open={scenarioOpen} onOpenChange={setScenarioOpen} resource={resource} onApply={() => toast("Scenario applied — see chart in Forecast tab")} onCreatePlan={() => openPlanPrefill()} onSaved={toast} />
      <NewCapacityPlanDialog open={planOpen} onOpenChange={setPlanOpen} prefill={planPrefill} onCreated={() => { /* detail refreshes on next load */ }} onSaved={toast} />
      <ForecastAlertDialog open={alertOpen} onOpenChange={setAlertOpen} resourceName={resource.name} metric={resource.metric} onCreated={(message) => { setAlertRuleId(message.match(/RUL-[A-Z0-9]+/)?.[0] ?? null); toast(message); }} />

      {notice && (
        <div role="status" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-lg">
          <Check size={16} className="text-emerald-600" aria-hidden="true" />{notice}
        </div>
      )}
    </div>
  );
}

function ServerGlyph() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground" aria-hidden="true"><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></svg>;
}
