"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, Clock3, Download, Eye, Flag, LockKeyhole, MoreVertical, Search, ShieldCheck, UserRound, Users, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/logs/primitives";
import { cn } from "@/lib/utils";
import { AUDIT_ENTRIES, AUDIT_INTEGRITY, AUDIT_RETENTION, logAudit, type AuditEntry, type AuditRisk, updateAuditReview, verifyAuditIntegrity } from "@/mocks/auditLogs";

const riskTone: Record<AuditRisk, string> = { Critical: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", High: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300", Medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", Low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" };
const resultTone = { Success: "success", Denied: "warning", Failed: "destructive" } as const;
const ago = (time: string) => { const mins = Math.max(1, Math.floor((Date.now() - new Date(time).getTime()) / 60000)); return mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`; };

function RiskBadge({ risk }: { risk: AuditRisk }) { return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", riskTone[risk])}><AlertTriangle size={12} />{risk}</span>; }
function ResultBadge({ result }: { result: AuditEntry["result"] }) { const Icon = result === "Success" ? CheckCircle2 : XCircle; return <Badge variant={resultTone[result]}><Icon size={12} />{result}</Badge>; }

export function AuditLogsDashboard() {
  const [query, setQuery] = useState(""); const [tab, setTab] = useState("All"); const [review, setReview] = useState<"All" | "Unreviewed">("All"); const [range, setRange] = useState("24H");
  const [entries, setEntries] = useState(AUDIT_ENTRIES); const [toast, setToast] = useState(""); const [integrity, setIntegrity] = useState(AUDIT_INTEGRITY); const [verifying, setVerifying] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const filtered = useMemo(() => entries.filter((entry) => { const q = query.toLowerCase(); const matches = !q || `${entry.actor.name} ${entry.action} ${entry.resource.name} ${entry.ip} ${entry.requestId}`.toLowerCase().includes(q); const byTab = tab === "All" || (tab === "Sensitive" ? entry.sensitive : tab === "Denied" ? entry.result !== "Success" : entry.category === tab); const byReview = review === "All" || entry.reviewState === "Unreviewed"; return matches && byTab && byReview; }).slice(0, 12), [entries, query, tab, review]);
  const mark = (id: string, state: "Reviewed" | "Flagged") => { const entry = AUDIT_ENTRIES.find((item) => item.id === id); updateAuditReview(id, state); if (entry) logAudit({ actor: { id: "ACC-01", name: "Admin", type: "Human", role: "Super Administrator" }, action: state === "Reviewed" ? "Marked audit entry reviewed" : "Flagged audit entry", category: "Security", resource: entry.resource, result: "Success" }); setEntries([...AUDIT_ENTRIES]); setToast(state === "Reviewed" ? "Entry marked reviewed" : "Entry flagged for follow-up"); window.setTimeout(() => setToast(""), 2400); };
  const verify = async () => { if (verifying) return; setVerifying(true); setToast("Checking hash chain…"); const result = await verifyAuditIntegrity(); setIntegrity(result); setVerifying(false); setToast(`Integrity verified · ${result.entriesChecked.toLocaleString()} entries checked`); window.setTimeout(() => setToast(""), 3000); };
  const tableHref = (id: string) => `/audit-logs/${id}?${new URLSearchParams({ tab, review, q: query }).toString()}#events`;
  const categories = ["All", "Sensitive", "Denied", "Config", "Access", "Data"];
  const trend = useMemo(() => buildAuditTrend(entries, range), [entries, range]);
  /* Curated mock distribution for the headline "top actions" (seed cycles uniformly by design). */
  const topActions = [
    { action: "Updated alert rule", count: 1180, color: "#60A5FA" },
    { action: "Viewed sensitive data", count: 940, color: "#F87171" },
    { action: "Configuration changed", count: 780, color: "#A78BFA" },
    { action: "Acknowledged incident", count: 620, color: "#FBBF24" },
    { action: "Authentication login", count: 540, color: "#34D399" },
  ];
  return <div className="space-y-4 pb-8">
        <PageHeader breadcrumbs={["Security", "Audit Logs"]} title="Audit Logs" subtitle="Who did what, when: the immutable audit trail." lastUpdated={verifying ? "Verifying…" : "Just now"} onRefresh={() => setEntries([...AUDIT_ENTRIES])} actions={<div className="flex items-center gap-2"><Button variant="outline" size="sm"><Download size={14} />Export</Button><Button size="sm" disabled={verifying} onClick={verify}><ShieldCheck size={14} />{verifying ? "Verifying…" : "Verify Integrity"}</Button></div>} />
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm dark:border-emerald-900 dark:bg-emerald-950/30"><div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200"><LockKeyhole size={16} /> <span className="font-semibold">{integrity.status === "Verified" ? "Audit trail verified" : "Integrity check warning"}</span><span className="hidden sm:inline">· hash chain intact · {integrity.entriesChecked.toLocaleString()} entries checked · last verified {verifying ? "now" : "12m ago"}</span><Badge variant="success">Immutable</Badge></div><Button variant="ghost" size="sm" disabled={verifying} onClick={verify}>{verifying ? "Checking…" : "Verify now"}</Button></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard icon={<Activity size={20} />} label="Total Events" value="4,860" delta={142} deltaPercent="6.1%" iconTone="bg-blue-50 text-blue-600" onClick={() => setTab("All")} />
      <StatCard icon={<ShieldCheck size={20} />} label="Sensitive Actions" value="38" delta={4} goodDirection="down" iconTone="bg-orange-50 text-orange-600" onClick={() => setTab("Sensitive")} />
      <StatCard icon={<XCircle size={20} />} label="Denied / Failed" value="21" delta={3} goodDirection="down" iconTone="bg-rose-50 text-rose-600" onClick={() => setTab("Denied")} />
      <StatCard icon={<UserRound size={20} />} label="Admin Actions" value="126" delta={8} iconTone="bg-violet-50 text-violet-600" />
      <StatCard icon={<Users size={20} />} label="Active Actors" value="41" delta={2} iconTone="bg-emerald-50 text-emerald-600" />
      <StatCard icon={<Clock3 size={20} />} label="Unreviewed Sensitive" value="9" delta={2} goodDirection="down" iconTone="bg-amber-50 text-amber-600" onClick={() => setReview("Unreviewed")} />
    </div>
    <div className="grid items-stretch gap-4 xl:grid-cols-12">
      <Card className="flex min-h-[16.25rem] flex-col rounded-xl p-4 xl:col-span-8"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Activity Trend</h2><SegmentedControl value={range} options={["24H", "7D", "30D"]} onChange={setRange} /></div><AuditTrendChart trend={trend} /><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-blue-500/10 px-2 py-1">All events 4,860</span><span className="rounded-full bg-rose-500/10 px-2 py-1">Sensitive 38</span><span>Peak {trend.peak.label}</span><span>Denied rate 0.4%</span></div><div className="border-t border-border pt-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top actions · 24h</p><span className="text-xs text-muted-foreground">share of 4,860 events</span></div><ul className="mt-2 flex flex-col gap-1.5">{topActions.map((item, index) => { const pct = Math.round((item.count / topActions[0].count) * 100); return <li key={item.action} className="flex items-center gap-2 text-[0.8125rem]"><span className="grid h-5 w-4 shrink-0 place-items-center rounded-sm text-[0.6875rem] font-bold tabular-nums text-white" style={{ backgroundColor: item.color }}>{index + 1}</span><span className="w-52 shrink-0 truncate font-medium text-foreground">{item.action}</span><div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} /></div><b className="w-10 shrink-0 text-right text-xs tabular-nums text-foreground">{item.count.toLocaleString()}</b></li>; })}</ul></div></Card>
      <Card className="flex min-h-[16.25rem] flex-col rounded-xl p-4 xl:col-span-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Needs Review</h2><Badge variant="warning">9 unreviewed</Badge></div><div className="mt-3 flex-1 space-y-2">{entries.filter((e) => e.reviewState === "Unreviewed").slice(0, 5).map((entry) => <div key={entry.id} className="rounded-lg border border-border p-2"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-[0.8125rem] font-semibold">{entry.action}</p><p className="truncate text-xs text-muted-foreground">{entry.actor.name} · {entry.resource.name}</p></div><RiskBadge risk={entry.risk} /></div><div className="mt-2 flex items-center justify-between"><span className="text-xs text-muted-foreground">{ago(entry.time)}</span><Button variant="ghost" size="icon-sm" aria-label="Mark reviewed" onClick={() => mark(entry.id, "Reviewed")}><CheckCircle2 size={14} /></Button></div></div>)}</div><Link href="#events" className="mt-3 flex items-center text-xs font-semibold text-primary">Review all <ChevronRight size={14} /></Link></Card>
    </div>
    <div className="grid items-stretch gap-4 md:grid-cols-3"><Card className="flex min-h-[18.75rem] min-w-0 flex-col rounded-xl p-4"><h2 className="text-sm font-semibold">Actions by Category</h2><div className="mt-4 flex min-w-0 flex-col items-center gap-5 sm:flex-row sm:items-center"><div className="grid h-32 w-32 shrink-0 place-items-center rounded-full bg-[conic-gradient(#3b82f6_0_30%,#8b5cf6_30%_52%,#f59e0b_52%_70%,#10b981_70%_88%,#ef4444_88%)]"><div className="grid h-20 w-20 place-items-center rounded-full bg-card text-center"><b className="text-lg">4,860</b><span className="text-xs text-muted-foreground">events</span></div></div><div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-2 text-xs sm:w-auto"><span>● Access <b className="float-right">30%</b></span><span>● Config <b className="float-right">22%</b></span><span>● Data <b className="float-right">18%</b></span><span>● Security <b className="float-right">18%</b></span><span>● Other <b className="float-right">12%</b></span></div></div><div className="mt-auto grid w-full grid-cols-3 gap-2 border-t border-border pt-4 text-center"><div><p className="text-lg font-semibold tabular-nums">38</p><p className="text-xs text-muted-foreground">Sensitive</p></div><div><p className="text-lg font-semibold tabular-nums">0.4%</p><p className="text-xs text-muted-foreground">Denied rate</p></div><div><p className="text-lg font-semibold tabular-nums">Access</p><p className="text-xs text-muted-foreground">Top category</p></div></div></Card><Card className="rounded-xl p-4"><h2 className="text-sm font-semibold">Top Actors</h2><div className="mt-3 space-y-3">{auditActorsForUi(entries).map((actor) => <button key={actor.name} className="flex w-full items-center gap-2 text-left text-[0.8125rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{actor.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate">{actor.name}<span className="ml-1 text-xs text-muted-foreground">{actor.type}</span></span><span className="text-xs font-semibold tabular-nums">{actor.count}</span></button>)}</div></Card><Card className="rounded-xl p-4"><h2 className="text-sm font-semibold">Retention &amp; Integrity</h2><div className="mt-3 space-y-3 text-[0.8125rem]"><div className="flex justify-between"><span className="text-muted-foreground">Retention</span><b>{AUDIT_RETENTION.days} days</b></div><div className="flex justify-between"><span className="text-muted-foreground">Oldest entry</span><b>{new Date(AUDIT_RETENTION.oldestEntryAt).toLocaleDateString()}</b></div><div className="flex justify-between"><span className="text-muted-foreground">Storage used</span><b>{AUDIT_RETENTION.storageGB} GB</b></div><div className="flex justify-between"><span className="text-muted-foreground">Hash algorithm</span><b>{AUDIT_INTEGRITY.hashChain}</b></div><div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300"><ShieldCheck size={15} /> Immutable storage verified</div></div></Card></div>
    <Card id="events" className="rounded-xl p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Events</h2><p className="text-xs text-muted-foreground">Immutable activity across actors, resources and services</p></div><SegmentedControl value={review} options={["All", "Unreviewed"]} onChange={(value) => setReview(value as "All" | "Unreviewed")} /></div><div className="mt-4 flex flex-wrap items-center gap-2"><div className="relative min-w-[13.75rem] flex-1"><Search className="absolute left-3 top-2.5 text-muted-foreground" size={15} /><Input aria-label="Search audit events" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actor, action, resource, IP, request ID..." className="pl-9" /></div><div className="flex flex-wrap gap-1">{categories.map((category) => <button key={category} type="button" onClick={() => setTab(category)} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", tab === category ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>{category}</button>)}</div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[51.25rem] text-left text-[0.8125rem]"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="px-3 py-3">Time</th><th className="px-3 py-3">Actor</th><th className="px-3 py-3">Action / Resource</th><th className="px-3 py-3">Result</th><th className="px-3 py-3">Risk</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Review</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{filtered.map((entry) => <tr key={entry.id} tabIndex={0} role="link" onClick={() => { window.location.href = tableHref(entry.id); }} onKeyDown={(event) => { if (event.key === "Enter") window.location.href = tableHref(entry.id); }} className="cursor-pointer border-b border-border/70 transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><td className="whitespace-nowrap px-3 py-3"><Link href={tableHref(entry.id)} className="font-medium hover:text-primary" onClick={(event) => event.stopPropagation()}>{mounted ? ago(entry.time) : "—"}</Link><span className="block text-xs text-muted-foreground">{mounted ? new Date(entry.time).toLocaleString() : "Loading time…"}</span></td><td className="px-3 py-3"><span className="font-medium">{entry.actor.name}</span><span className="block text-xs text-muted-foreground">{entry.actor.type} · {entry.actor.role}</span></td><td className="px-3 py-3"><span className="font-semibold">{entry.action}</span><span className="block text-xs text-muted-foreground">{entry.resource.type}: {entry.resource.name}</span></td><td className="px-3 py-3"><ResultBadge result={entry.result} /></td><td className="px-3 py-3"><RiskBadge risk={entry.risk} />{entry.anomalyFlags.length > 0 && <span className="mt-1 block text-xs text-muted-foreground">{entry.anomalyFlags[0]}</span>}</td><td className="px-3 py-3 text-xs text-muted-foreground">{entry.source}<span className="block">{entry.ip} · {entry.country}</span></td><td className="px-3 py-3"><Badge variant={entry.reviewState === "Flagged" ? "destructive" : entry.reviewState === "Reviewed" ? "success" : "secondary"}>{entry.reviewState}</Badge></td><td className="px-3 py-3"><div className="flex items-center gap-1"><Link href={tableHref(entry.id)} aria-label="View event" title="View event" onClick={(event) => event.stopPropagation()} className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"><Eye size={14} /></Link><Button variant="ghost" size="icon-sm" aria-label="Flag entry" title="Flag entry" onClick={(event) => { event.stopPropagation(); mark(entry.id, "Flagged"); }}><Flag size={14} /></Button><Button variant="ghost" size="icon-sm" aria-label="More event actions" title="More event actions" onClick={(event) => event.stopPropagation()}><MoreVertical size={15} /></Button></div></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No events match these filters.</div>}</div><div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground"><span>Showing {filtered.length} of {entries.length.toLocaleString()} events</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled>Previous</Button><Button variant="outline" size="sm">Next</Button></div></div></Card>{toast && <div role="status" className="fixed bottom-5 right-5 z-50 rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg">{toast}</div>}
  </div>;
}

function auditActorsForUi(entries: AuditEntry[]) { return entries.reduce<Array<{ name: string; type: string; count: number }>>((all, entry) => { const found = all.find((item) => item.name === entry.actor.name); if (found) found.count += 1; else if (all.length < 6) all.push({ name: entry.actor.name, type: entry.actor.type, count: 1 }); return all; }, []).sort((a, b) => b.count - a.count).slice(0, 6); }


/* ------------------------------ trend chart ------------------------------- */

interface AuditTrendBucket { label: string; events: number; sensitive: number; denied: number; }
interface AuditTrend { buckets: AuditTrendBucket[]; peak: AuditTrendBucket; }

/** Largest-remainder split of `total` across `weights` (deterministic). */
function distributeInt(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  const raw = weights.map((weight) => (weight / sum) * total);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((acc, value) => acc + value, 0);
  const order = raw.map((value, index) => ({ index, frac: value - Math.floor(value) })).sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k += 1, remainder -= 1) out[order[k].index] += 1;
  return out;
}

/** Buckets the 4,860 mock events (38 sensitive / 21 denied) weighted by the real 510 seeded entries. */
function buildAuditTrend(entries: AuditEntry[], range: string): AuditTrend {
  const now = Date.now();
  const count = range === "7D" ? 7 : range === "30D" ? 30 : 24;
  const labels: string[] = [];
  if (range === "24H") {
    const startOfHour = new Date();
    startOfHour.setMinutes(0, 0, 0);
    for (let index = 0; index < count; index += 1) {
      const start = startOfHour.getTime() - (count - 1 - index) * 3_600_000;
      labels.push(new Date(start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }));
    }
  } else if (range === "7D") {
    for (let index = 0; index < count; index += 1) {
      labels.push(new Date(now - (count - 1 - index) * 86_400_000).toLocaleDateString(undefined, { weekday: "short", day: "numeric" }));
    }
  } else {
    for (let index = 0; index < count; index += 1) {
      labels.push(new Date(now - (count - 1 - index) * 86_400_000).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
    }
  }
  const dayBucket = range !== "24H";
  const weights = new Array<number>(count).fill(0.4);
  const sensitiveWeights = new Array<number>(count).fill(0.15);
  const deniedWeights = new Array<number>(count).fill(0.15);
  for (const entry of entries) {
    const ageMs = now - entry.epochMs;
    const ageUnits = dayBucket ? Math.floor(ageMs / 86_400_000) : Math.floor(ageMs / 3_600_000);
    const index = count - 1 - ageUnits;
    if (index >= 0 && index < count) {
      weights[index] += 1;
      if (entry.sensitive) sensitiveWeights[index] += 2.4;
      if (entry.result !== "Success") deniedWeights[index] += 3;
    }
  }
  const events = distributeInt(4_822, weights);
  const sensitive = distributeInt(38, sensitiveWeights);
  const denied = distributeInt(21, deniedWeights);
  const buckets = labels.map((label, index) => ({ label, events: events[index], sensitive: sensitive[index], denied: denied[index] }));
  const peak = buckets.reduce((best, bucket) => (bucket.events + bucket.sensitive > best.events + best.sensitive ? bucket : best), buckets[0]);
  return { buckets, peak };
}

function useTrendChart(option: EChartsOption, label: string) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const chart = echarts.init(host);
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host);
    return () => { observer.disconnect(); chart.dispose(); chartRef.current = null; };
  }, []);
  useEffect(() => {
    chartRef.current?.setOption(option, true);
    chartRef.current?.resize();
  }, [option]);
  return hostRef;
}

function AuditTrendChart({ trend }: { trend: AuditTrend }) {
  const labels = trend.buckets.map((bucket) => bucket.label);
  const hostRef = useTrendChart(
    useMemo<EChartsOption>(() => {
      const maxTotal = trend.buckets.reduce((acc, bucket) => Math.max(acc, bucket.events + bucket.sensitive), 0);
      return {
        grid: { left: 40, right: 16, top: 12, bottom: 26 },
        tooltip: {
          trigger: "axis",
          confine: true,
          axisPointer: { type: "shadow" },
          backgroundColor: "#0f172a",
          borderWidth: 0,
          textStyle: { color: "#fff", fontSize: 12 },
          formatter: (params: unknown) => {
            const points = Array.isArray(params) ? (params as Array<{ axisValue?: string; seriesName?: string; value?: number; marker?: string }>) : [];
            const bucket = trend.buckets.find((entry) => entry.label === points[0]?.axisValue);
            const lines = [`<b>${points[0]?.axisValue ?? ""}</b>`];
            for (const point of points) lines.push(`${point.marker ?? ""}${point.seriesName}: <b>${Number(point.value ?? 0).toLocaleString()}</b>`);
            if (bucket) lines.push(`Denied: <b>${bucket.denied}</b>`);
            return lines.join("<br/>");
          },
        },
        xAxis: {
          type: "category",
          data: labels,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: "#E2E8F0" } },
          axisLabel: { color: "#64748B", fontSize: 10, interval: labels.length > 16 ? Math.floor(labels.length / 6) : 0 },
        },
        yAxis: {
          type: "value",
          max: Math.ceil(maxTotal * 1.12),
          splitLine: { lineStyle: { type: "dashed", color: "#E2E8F0" } },
          axisLabel: { color: "#64748B", fontSize: 10 },
        },
        series: [
          {
            name: "Events",
            type: "bar",
            stack: "total",
            barMaxWidth: 20,
            itemStyle: { color: "#60A5FA", borderRadius: [0, 0, 0, 0] },
            emphasis: { focus: "series" },
            data: trend.buckets.map((bucket) => bucket.events),
          },
          {
            name: "Sensitive",
            type: "bar",
            stack: "total",
            barMaxWidth: 20,
            itemStyle: { color: "#F87171", borderRadius: [3, 3, 0, 0] },
            emphasis: { focus: "series" },
            data: trend.buckets.map((bucket) => bucket.sensitive),
          },
        ],
      };
    }, [trend, labels]),
    "Audit activity per bucket",
  );
  return <div ref={hostRef} className="mt-3 h-full min-h-[11.875rem] w-full flex-1" role="img" aria-label="Audit activity trend chart" />;
}


