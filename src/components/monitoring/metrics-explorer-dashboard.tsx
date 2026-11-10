"use client";

import { useMemo, useState } from "react";
import {
  Area, AreaChart, Brush, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Download, MoreVertical, Plus, Save, Search, X,
} from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MetricStat } from "@/data/mock/dashboard";

type ChartMode = "Line" | "Area" | "Stacked";
type MetricRecord = {
  name: string;
  type: string;
  resource: string;
  value: number;
  unit: string;
  change: number;
  color: string;
};

const stats: MetricStat[] = [
  { label: "Total Metrics", value: "2,458", change: "142 (6.1%)", trend: "up", tone: "blue", icon: "pulse" },
  { label: "Active Metrics", value: "1,856", change: "98 (5.6%)", trend: "up", tone: "green", icon: "activity" },
  { label: "Alerts Triggered", value: "24", change: "8 (33.3%)", trend: "up", tone: "amber", icon: "warning" },
  { label: "Anomalies Detected", value: "7", change: "2 (40.0%)", trend: "down", tone: "red", icon: "offline" },
  { label: "Data Points", value: "12.8M", change: "1.2M (10.3%)", trend: "up", tone: "purple", icon: "database" },
  { label: "Avg. Ingestion Rate", value: "15,230 /min", change: "820 (5.7%)", trend: "up", tone: "blue", icon: "online" },
];

const series = [
  { key: "cpu", name: "CPU Usage (%)", color: "#2878ed" },
  { key: "memory", name: "Memory Usage (%)", color: "#35b879" },
  { key: "disk", name: "Disk I/O (MB/s)", color: "#f39a12" },
  { key: "networkIn", name: "Network In (Mbps)", color: "#8a45df" },
  { key: "networkOut", name: "Network Out (Mbps)", color: "#20b9d1" },
];

const metricSeries = [
  { time: "12:00", cpu: 82, memory: 66, disk: 28, networkIn: 12, networkOut: 54 },
  { time: "13:00", cpu: 77, memory: 63, disk: 22, networkIn: 18, networkOut: 47 },
  { time: "14:00", cpu: 72, memory: 61, disk: 26, networkIn: 12, networkOut: 52 },
  { time: "15:00", cpu: 79, memory: 68, disk: 29, networkIn: 18, networkOut: 49 },
  { time: "16:00", cpu: 70, memory: 65, disk: 24, networkIn: 10, networkOut: 58 },
  { time: "18:00", cpu: 84, memory: 70, disk: 32, networkIn: 15, networkOut: 57 },
  { time: "20:00", cpu: 73, memory: 65, disk: 24, networkIn: 11, networkOut: 50 },
  { time: "22:00", cpu: 81, memory: 68, disk: 39, networkIn: 20, networkOut: 63 },
  { time: "00:00", cpu: 78, memory: 62, disk: 25, networkIn: 13, networkOut: 56 },
  { time: "02:00", cpu: 72, memory: 67, disk: 27, networkIn: 17, networkOut: 49 },
  { time: "04:00", cpu: 86, memory: 72, disk: 35, networkIn: 12, networkOut: 61 },
  { time: "06:00", cpu: 77, memory: 69, disk: 29, networkIn: 19, networkOut: 53 },
  { time: "08:00", cpu: 82, memory: 70, disk: 30, networkIn: 14, networkOut: 58 },
  { time: "10:00", cpu: 74, memory: 65, disk: 24, networkIn: 10, networkOut: 54 },
  { time: "12:00", cpu: 91, memory: 73, disk: 34, networkIn: 17, networkOut: 64 },
];

const metrics: MetricRecord[] = [
  { name: "CPU Usage", type: "System", resource: "web-01", value: 92.3, unit: "%", change: 6.2, color: "#2878ed" },
  { name: "Memory Usage", type: "System", resource: "db-01", value: 78.6, unit: "%", change: 3.8, color: "#35b879" },
  { name: "Disk I/O", type: "Storage", resource: "storage-01", value: 245.7, unit: "MB/s", change: 12.4, color: "#f39a12" },
  { name: "Network In", type: "Network", resource: "edge-router-01", value: 312.5, unit: "Mbps", change: 8.7, color: "#8a45df" },
  { name: "Network Out", type: "Network", resource: "edge-router-01", value: 198.3, unit: "Mbps", change: 5.5, color: "#20b9d1" },
  { name: "Request Rate", type: "Application", resource: "api-gateway", value: 1542, unit: "req/s", change: 7.1, color: "#ed6b83" },
  { name: "Database Connections", type: "Database", resource: "db-01", value: 83, unit: "connections", change: 2.4, color: "#7952dc" },
  { name: "CPU Usage", type: "System", resource: "app-02", value: 64.8, unit: "%", change: 4.1, color: "#2878ed" },
  { name: "Memory Usage", type: "System", resource: "cache-01", value: 72.1, unit: "%", change: 1.8, color: "#35b879" },
  { name: "Disk I/O", type: "Storage", resource: "storage-02", value: 198.6, unit: "MB/s", change: 9.2, color: "#f39a12" },
];

const recentAlerts = [
  { text: "High CPU usage on web-01", ago: "2m ago", severity: "critical" },
  { text: "Disk I/O high on storage-01", ago: "7m ago", severity: "warning" },
  { text: "Memory usage high on db-01", ago: "12m ago", severity: "critical" },
  { text: "High latency on api-gateway", ago: "18m ago", severity: "warning" },
  { text: "Anomaly detected in network traffic", ago: "25m ago", severity: "info" },
];

const typeBreakdown = [
  { name: "System", value: 1024, color: "#2878ed", percent: "41.7%" },
  { name: "Network", value: 612, color: "#35b879", percent: "24.9%" },
  { name: "Storage", value: 410, color: "#f39a12", percent: "16.7%" },
  { name: "Application", value: 282, color: "#8a45df", percent: "11.5%" },
  { name: "Database", value: 130, color: "#20b9d1", percent: "5.3%" },
];

const resources = ["All", "web-01", "db-01", "storage-01", "edge-router-01", "api-gateway"];
const metricTypes = ["All", "System", "Network", "Storage", "Application", "Database"];

function Sparkline({ color, seed }: { color: string; seed: number }) {
  const points = Array.from({ length: 10 }, (_, index) => {
    const value = 10 + ((index * 17 + seed * 13 + index * seed) % 25);
    return `${index * 10},${34 - value}`;
  }).join(" ");
  return <svg viewBox="0 0 90 36" className="h-9 w-[72px]" aria-label="Recent metric trend"><polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

function MetricTypeDonut() {
  return (
    <div className="flex h-[190px] w-full max-w-full items-center gap-3">
      <div className="relative h-[164px] w-[54%] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={typeBreakdown} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={1} stroke="none">
              {typeBreakdown.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className="font-display text-[22px] font-extrabold leading-tight text-foreground">2,458</b>
          <span className="text-[12px] text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {typeBreakdown.map((item) => (
          <div key={item.name} className="grid grid-cols-[7px_minmax(0,1fr)_auto] items-center gap-1.5 text-[12px]">
            <i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate text-foreground">{item.name}</span>
            <span className="whitespace-nowrap text-foreground">{item.value.toLocaleString()} ({item.percent})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricsExplorerDashboard() {
  const [notice, setNotice] = useState("");
  const [metricSearch, setMetricSearch] = useState("");
  const [metricType, setMetricType] = useState("All");
  const [resource, setResource] = useState("All");
  const [group, setGroup] = useState("All");
  const [tag, setTag] = useState("All");
  const [aggregation, setAggregation] = useState("Auto");
  const [interval, setInterval] = useState("Auto (1m)");
  const [appliedFilters, setAppliedFilters] = useState({ search: "", type: "All", resource: "All" });
  const [mode, setMode] = useState<ChartMode>("Line");
  const [activeSeries, setActiveSeries] = useState<string[]>(series.map((item) => item.key));
  const [page, setPage] = useState(1);

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const visibleMetrics = useMemo(() => metrics.filter((metric) => {
    const matchesText = `${metric.name} ${metric.type} ${metric.resource}`.toLowerCase().includes(appliedFilters.search.toLowerCase());
    const matchesType = appliedFilters.type === "All" || metric.type === appliedFilters.type;
    const matchesResource = appliedFilters.resource === "All" || metric.resource === appliedFilters.resource;
    return matchesText && matchesType && matchesResource;
  }), [appliedFilters]);

  const exportCsv = () => {
    const header = ["Metric Name", "Type", "Resource", "Value", "Unit", "Change"];
    const rows = visibleMetrics.map((item) => [item.name, item.type, item.resource, String(item.value), item.unit, `${item.change}%`]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "metrics.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast("Metrics exported.");
  };
  const applyFilters = () => {
    setAppliedFilters({ search: metricSearch, type: metricType, resource });
    setPage(1);
    toast("Metric filters applied.");
  };
  const clearFilters = () => {
    setMetricSearch("");
    setMetricType("All");
    setResource("All");
    setGroup("All");
    setTag("All");
    setAggregation("Auto");
    setInterval("Auto (1m)");
    setAppliedFilters({ search: "", type: "All", resource: "All" });
    setPage(1);
  };
  const toggleSeries = (key: string) => {
    setActiveSeries((current) => current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]);
  };

  return (
    <div className="space-y-2.5 pb-3">
      <PageMeta breadcrumbs={["Monitoring", "Metrics Explorer"]} showRefresh={false} variant="detail" />
      <PageHeading title="Metrics Explorer" description="Explore, visualize, and analyze metrics from across your infrastructure in real-time." actionsAlign="top" variant="detail">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast("View saved.")} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Save size={15} />Save View</Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Download size={15} />Export CSV</Button>
          <Button size="sm" onClick={() => toast("Create Metric is a mockup action.")} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Plus size={15} />Create Metric</Button>
        </div>
      </PageHeading>

      <section aria-label="Metric summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[82px]" labelClassName="text-[12px]" valueClassName={item.label === "Avg. Ingestion Rate" ? "text-[18px]" : "text-[24px]"} trendClassName="text-[11px]" />)}
      </section>

      <section aria-label="Metric filters" className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-2.5 shadow-card sm:grid-cols-3 lg:grid-cols-[minmax(130px,1.3fr)_repeat(6,minmax(90px,1fr))_auto_auto]">
        <div className="relative min-w-0">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={metricSearch} onChange={(event) => setMetricSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }} placeholder="Search metrics..." className="h-9 pl-8 text-[12px]" />
        </div>
        <Select value={metricType} onValueChange={setMetricType}><SelectTrigger aria-label="Metric type" className="h-9 min-w-0 text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{metricTypes.map((item) => <SelectItem key={item} value={item}>Type: {item}</SelectItem>)}</SelectContent></Select>
        <Select value={resource} onValueChange={setResource}><SelectTrigger aria-label="Resource" className="h-9 min-w-0 text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{resources.map((item) => <SelectItem key={item} value={item}>Resource: {item}</SelectItem>)}</SelectContent></Select>
        <Select value={group} onValueChange={setGroup}><SelectTrigger aria-label="Group" className="h-9 min-w-0 text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{["All", "Production", "Staging", "Development"].map((item) => <SelectItem key={item} value={item}>Group: {item}</SelectItem>)}</SelectContent></Select>
        <Select value={tag} onValueChange={setTag}><SelectTrigger aria-label="Tag" className="h-9 min-w-0 text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{["All", "Environment", "Team", "Region"].map((item) => <SelectItem key={item} value={item}>Tag: {item}</SelectItem>)}</SelectContent></Select>
        <Select value={aggregation} onValueChange={setAggregation}><SelectTrigger aria-label="Aggregation" className="h-9 min-w-0 text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{["Auto", "Average", "Sum", "Min", "Max", "Count"].map((item) => <SelectItem key={item} value={item}>Agg: {item}</SelectItem>)}</SelectContent></Select>
        <Select value={interval} onValueChange={setInterval}><SelectTrigger aria-label="Interval" className="h-9 min-w-0 text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{["Auto (1m)", "10 seconds", "1 minute", "5 minutes", "15 minutes", "1 hour"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" size="sm" onClick={clearFilters} className="h-9 whitespace-nowrap px-2 text-[12px]"><X size={11} />Clear</Button>
        <Button size="sm" onClick={applyFilters} className="h-9 px-3 text-[12px]">Apply</Button>
      </section>

      <section aria-label="Metric visualization" className="grid gap-2.5 lg:grid-cols-[1.85fr_1fr]">
        <Panel title="Metric Explorer" className="min-w-0" action={<div className="flex items-center gap-0.5">{(["Line", "Area", "Stacked"] as const).map((chartMode) => <button key={chartMode} onClick={() => setMode(chartMode)} className={`rounded px-2 py-1 text-[12px] font-semibold ${mode === chartMode ? "border border-primary/30 bg-primary/5 text-primary" : "text-muted-foreground hover:bg-accent"}`}>{chartMode}</button>)}</div>}>
          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1.5">
            {series.map((item) => <button key={item.key} onClick={() => toggleSeries(item.key)} className={`flex items-center gap-1 text-[12px] ${activeSeries.includes(item.key) ? "text-foreground" : "text-muted-foreground opacity-50"}`}><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</button>)}
            <button aria-label="Chart options" onClick={() => toast("Chart options are a mockup action.")} className="ml-auto rounded px-1 text-muted-foreground hover:bg-accent"><MoreVertical size={13} /></button>
          </div>
          <div className="h-[210px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              {mode === "Line" ? (
                <LineChart data={metricSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
                  {series.filter((item) => activeSeries.includes(item.key)).map((item) => <Line key={item.key} dataKey={item.key} name={item.name} type="monotone" stroke={item.color} strokeWidth={1.4} dot={{ r: 1.5 }} />)}
                </LineChart>
              ) : (
                <AreaChart data={metricSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, mode === "Stacked" ? 300 : 100]} ticks={mode === "Stacked" ? [0, 75, 150, 225, 300] : [0, 25, 50, 75, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
                  {series.filter((item) => activeSeries.includes(item.key)).map((item) => <Area key={item.key} dataKey={item.key} name={item.name} type="monotone" stroke={item.color} strokeWidth={1.2} fill={item.color} fillOpacity={mode === "Stacked" ? 0.6 : 0.1} stackId={mode === "Stacked" ? "metrics" : undefined} />)}
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="h-[42px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metricSeries} margin={{ top: 2, right: 5, left: 5, bottom: 0 }}>
                <Area dataKey="cpu" type="monotone" stroke="#64a5f2" fill="#64a5f2" fillOpacity={0.12} strokeWidth={1} />
                <Brush dataKey="time" height={20} travellerWidth={5} stroke="#7ab3f3" fill="var(--card)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Top Metrics by Value" className="min-w-0" action={<button onClick={() => toast("Showing all metrics by value.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[360px] text-left text-[12px]">
              <thead><tr className="border-b border-border text-muted-foreground"><th className="pb-1.5">Metric</th><th className="pb-1.5">Resource</th><th className="pb-1.5 text-right">Value</th><th className="pb-1.5 text-right">Change</th></tr></thead>
              <tbody>{metrics.slice(0, 5).map((metric) => <tr key={`${metric.name}-${metric.resource}`} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap py-[9px] font-semibold text-foreground"><i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: metric.color }} />{metric.name} {metric.unit === "%" ? "(%)" : `(${metric.unit})`}</td><td className="whitespace-nowrap py-[9px] text-foreground">{metric.resource}</td><td className="whitespace-nowrap py-[9px] text-right text-foreground">{metric.value} {metric.unit}</td><td className="whitespace-nowrap py-[9px] text-right font-semibold text-success">↑ {metric.change}%</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section aria-label="Metric details" className="grid gap-2.5 lg:grid-cols-[1.65fr_1fr_1.05fr]">
        <Panel title="Recent Metrics" className="min-w-0" action={<span className="text-[12px] text-muted-foreground">{visibleMetrics.length} shown</span>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[720px] table-fixed text-left text-[12px]">
              <colgroup>{[23, 12, 19, 12, 9, 13, 12].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
              <thead><tr className="border-b border-border text-muted-foreground">{["Metric Name", "Type", "Resource", "Last Value", "Unit", "Trend", "Updated"].map((heading) => <th key={heading} className="overflow-hidden text-ellipsis whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{visibleMetrics.slice((page - 1) * 5, page * 5).map((metric, index) => <tr key={`${metric.name}-${metric.resource}-${index}`} className="border-b border-border/70 last:border-0"><td title={metric.name} className="overflow-hidden text-ellipsis whitespace-nowrap px-1 py-[5px] font-semibold text-foreground"><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: metric.color }} />{metric.name}</td><td className="overflow-hidden text-ellipsis whitespace-nowrap px-1 py-[5px] text-foreground">{metric.type}</td><td title={metric.resource} className="overflow-hidden text-ellipsis whitespace-nowrap px-1 py-[5px] text-foreground">{metric.resource}</td><td className="overflow-hidden text-ellipsis whitespace-nowrap px-1 py-[5px] text-foreground">{metric.value}</td><td className="overflow-hidden text-ellipsis whitespace-nowrap px-1 py-[5px] text-foreground">{metric.unit}</td><td className="overflow-hidden px-1 py-[5px]"><Sparkline color={metric.color} seed={index + page} /></td><td className="overflow-hidden text-ellipsis whitespace-nowrap px-1 py-[5px] text-foreground">10:24:30</td></tr>)}</tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 text-[12px] text-muted-foreground">
            <span>Showing {visibleMetrics.length ? (page - 1) * 5 + 1 : 0}-{Math.min(page * 5, visibleMetrics.length)} of {appliedFilters.search || appliedFilters.type !== "All" || appliedFilters.resource !== "All" ? visibleMetrics.length : "2,458"} metrics</span>
            <div className="flex items-center gap-1">
              <label className="mr-1 flex items-center gap-1">Rows per page: <select aria-label="Rows per page" className="rounded border border-border bg-card px-1 py-0.5 text-foreground"><option>5</option><option>10</option></select></label>
              {Array.from({ length: Math.min(5, Math.max(1, Math.ceil(visibleMetrics.length / 5))) }, (_, index) => index + 1).map((value) => <button key={value} onClick={() => setPage(value)} className={`rounded px-1.5 py-1 ${page === value ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{value}</button>)}
              <span>…</span><button onClick={() => setPage(Math.max(1, Math.ceil(visibleMetrics.length / 5)))} className="rounded px-1.5 py-1 hover:bg-accent">492</button>
            </div>
          </div>
        </Panel>

        <Panel title="Metrics by Type" className="min-w-0"><div className="flex min-h-[200px] flex-1 items-center justify-center"><MetricTypeDonut /></div></Panel>

        <Panel title="Recent Metric Alerts" className="min-w-0" action={<button onClick={() => toast("Showing all metric alerts.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="space-y-3 pt-1.5">
            {recentAlerts.map((alert) => <div key={alert.text} className="grid grid-cols-[10px_minmax(0,1fr)_38px] items-center gap-1.5 text-[12px]"><i className={`grid h-2.5 w-2.5 place-items-center rounded-full text-white ${alert.severity === "critical" ? "bg-rose-500" : alert.severity === "warning" ? "bg-amber-500" : "bg-blue-500"}`}>{alert.severity === "warning" ? "!" : alert.severity === "info" ? "i" : "×"}</i><span className="truncate font-semibold text-foreground">{alert.text}</span><span className="text-right text-muted-foreground">{alert.ago}</span></div>)}
          </div>
        </Panel>
      </section>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
