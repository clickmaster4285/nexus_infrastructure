"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, Check, Copy, Download, FileText, MoreVertical, Plus, Search,
  Save, SlidersHorizontal, X,
} from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type LogLevel = "ERROR" | "WARNING" | "INFO" | "DEBUG";
type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  host: string;
  message: string;
  context: string[];
  environment: string;
  minutesAgo: number;
};
type LogFilters = {
  query: string;
  level: string;
  service: string;
  host: string;
  timeRange: string;
  environment: string;
  context: string;
};

const summary = [
  { label: "Total Logs", value: "48.7M", change: "12.5%", color: "#2878ed", icon: FileText, points: "0,27 8,25 16,18 24,20 32,13 40,17 48,8 56,12 64,5 72,9 80,2" },
  { label: "Parsed Logs", value: "48.1M", change: "13.1%", color: "#20b77a", icon: Check, points: "0,25 8,19 16,23 24,13 32,16 40,8 48,13 56,6 64,10 72,2 80,5" },
  { label: "Errors", value: "124.5K", change: "8.7%", color: "#f97316", icon: AlertTriangle, points: "0,21 8,20 16,13 24,17 32,10 40,14 48,4 56,8 64,3 72,6 80,0" },
  { label: "Warnings", value: "268.7K", change: "6.2%", color: "#8b5cf6", icon: AlertTriangle, points: "0,23 8,18 16,21 24,11 32,16 40,8 48,13 56,4 64,9 72,0 80,5" },
];

const trend = [
  { time: "12:00", info: 102, warning: 48, error: 21 },
  { time: "13:00", info: 118, warning: 52, error: 25 },
  { time: "14:00", info: 129, warning: 61, error: 29 },
  { time: "16:00", info: 132, warning: 68, error: 31 },
  { time: "18:00", info: 139, warning: 74, error: 34 },
  { time: "20:00", info: 134, warning: 70, error: 31 },
  { time: "22:00", info: 145, warning: 78, error: 36 },
  { time: "00:00", info: 137, warning: 73, error: 32 },
  { time: "02:00", info: 133, warning: 75, error: 29 },
  { time: "04:00", info: 149, warning: 79, error: 34 },
  { time: "06:00", info: 136, warning: 68, error: 27 },
  { time: "08:00", info: 144, warning: 73, error: 30 },
  { time: "12:00", info: 140, warning: 69, error: 27 },
];

const logs: LogEntry[] = [
  { id: "log-01", timestamp: "2025-11-04 14:28:17", level: "ERROR", service: "api-server", host: "api-01", message: "Database connection lost. Retrying...", context: ["db", "retry"], environment: "prod", minutesAgo: 3 },
  { id: "log-02", timestamp: "2025-11-04 14:28:16", level: "WARNING", service: "web-app", host: "web-02", message: "High memory usage: 89%", context: ["memory", "prod"], environment: "prod", minutesAgo: 5 },
  { id: "log-03", timestamp: "2025-11-04 14:28:15", level: "INFO", service: "auth-service", host: "auth-01", message: "User login successful", context: ["auth", "user"], environment: "prod", minutesAgo: 8 },
  { id: "log-04", timestamp: "2025-11-04 14:28:14", level: "INFO", service: "database", host: "db-01", message: "Query executed in 42ms", context: ["db", "query"], environment: "prod", minutesAgo: 12 },
  { id: "log-05", timestamp: "2025-11-04 14:28:13", level: "WARNING", service: "payment", host: "pay-01", message: "Payment API response delayed: 2.3s", context: ["payment", "api"], environment: "prod", minutesAgo: 16 },
  { id: "log-06", timestamp: "2025-11-04 14:28:12", level: "DEBUG", service: "cache", host: "cache-01", message: "Cache hit for key: product_123", context: ["cache", "debug"], environment: "prod", minutesAgo: 22 },
  { id: "log-07", timestamp: "2025-11-04 14:28:11", level: "INFO", service: "scheduler", host: "worker-01", message: "Scheduled job completed", context: ["job", "success"], environment: "staging", minutesAgo: 35 },
  { id: "log-08", timestamp: "2025-11-04 14:28:10", level: "ERROR", service: "notification", host: "noti-01", message: "Failed to send email: SMTP error", context: ["email", "error"], environment: "prod", minutesAgo: 60 },
];

const levelStyles: Record<LogLevel, { className: string; dot: string }> = {
  ERROR: { className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", dot: "bg-rose-500" },
  WARNING: { className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300", dot: "bg-orange-500" },
  INFO: { className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", dot: "bg-blue-500" },
  DEBUG: { className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", dot: "bg-emerald-500" },
};

function SummaryCard({ item }: { item: (typeof summary)[number] }) {
  const Icon = item.icon;
  return (
    <div className="flex h-[72px] min-w-0 items-center gap-2 rounded-lg border border-border bg-card p-2 shadow-card sm:gap-2.5 sm:p-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${item.color}18`, color: item.color }}><Icon size={17} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[8px] text-muted-foreground">{item.label}</p>
        <p className="font-display text-[18px] font-extrabold leading-tight text-foreground">{item.value}</p>
        <p className="text-[8px] font-semibold text-emerald-600">↑ {item.change}</p>
      </div>
      <svg viewBox="0 0 80 32" className="hidden h-8 w-[58px] shrink-0 sm:block" aria-hidden="true"><polyline points={item.points} fill="none" stroke={item.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}

function LogTrend({ range }: { range: string }) {
  return (
    <div className="h-[181px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trend} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical />
          <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 8 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 200]} ticks={[0, 50, 100, 150, 200]} tickFormatter={(value) => value === 0 ? "0" : `${value}K`} tick={{ fill: "var(--muted-foreground)", fontSize: 8 }} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={(label) => `${label} · ${range}`} contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 10, background: "var(--popover)" }} />
          <Line dataKey="info" name="Info" type="monotone" stroke="#2878ed" strokeWidth={1.7} dot={false} />
          <Line dataKey="warning" name="Warning" type="monotone" stroke="#f97316" strokeWidth={1.7} dot={false} />
          <Line dataKey="error" name="Error" type="monotone" stroke="#ef3340" strokeWidth={1.7} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LogsExplorerDashboard() {
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("All Levels");
  const [service, setService] = useState("All Services");
  const [host, setHost] = useState("All Hosts");
  const [timeRange, setTimeRange] = useState("Last 24 hours");
  const [environment, setEnvironment] = useState("All Environments");
  const [contextFilter, setContextFilter] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [applied, setApplied] = useState<LogFilters>({ query: "", level: "All Levels", service: "All Services", host: "All Hosts", timeRange: "Last 24 hours", environment: "All Environments", context: "" });
  const [range, setRange] = useState("24h");
  const [liveTail, setLiveTail] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [queryEditor, setQueryEditor] = useState(false);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const filteredLogs = useMemo(() => {
    const timeLimits: Record<string, number> = {
      "Last 15 minutes": 15,
      "Last 1 hour": 60,
      "Last 6 hours": 360,
      "Last 24 hours": 1440,
      "Last 7 days": 10080,
    };
    const timeLimit = timeLimits[applied.timeRange] ?? Number.POSITIVE_INFINITY;
    return logs.filter((log) => {
      const text = `${log.timestamp} ${log.level} ${log.service} ${log.host} ${log.message} ${log.context.join(" ")}`.toLowerCase();
      return text.includes(applied.query.toLowerCase())
        && (applied.level === "All Levels" || log.level === applied.level)
        && (applied.service === "All Services" || log.service === applied.service)
        && (applied.host === "All Hosts" || log.host === applied.host)
        && log.minutesAgo <= timeLimit
        && (applied.environment === "All Environments" || log.environment === applied.environment)
        && (!applied.context || log.context.some((tag) => tag.toLowerCase().includes(applied.context.toLowerCase())));
    });
  }, [applied]);

  const applyFilters = () => {
    setApplied({ query, level, service, host, timeRange, environment, context: contextFilter });
    setSelected([]);
    notify("Log filters applied.");
  };
  const clearFilters = () => {
    setQuery("");
    setLevel("All Levels");
    setService("All Services");
    setHost("All Hosts");
    setTimeRange("Last 24 hours");
    setEnvironment("All Environments");
    setContextFilter("");
    setApplied({ query: "", level: "All Levels", service: "All Services", host: "All Hosts", timeRange: "Last 24 hours", environment: "All Environments", context: "" });
    setSelected([]);
    notify("All log filters cleared.");
  };
  const exportCsv = (selectedOnly = false) => {
    const rowsToExport = selectedOnly ? filteredLogs.filter((log) => selected.includes(log.id)) : filteredLogs;
    if (selectedOnly && rowsToExport.length === 0) {
      notify("Select at least one log to export.");
      return;
    }
    const header = ["Timestamp", "Level", "Service", "Host", "Message", "Context", "Environment"];
    const rows = rowsToExport.map((log) => [log.timestamp, log.level, log.service, log.host, log.message, log.context.join(" "), log.environment]);
    const csv = [header, ...rows].map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "logs-explorer.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify(`${rowsToExport.length} mock log rows exported.`);
  };
  const toggleAll = () => setSelected(selected.length === filteredLogs.length ? [] : filteredLogs.map((log) => log.id));

  return (
    <div className="space-y-2.5 pb-3">
      <PageMeta breadcrumbs={["Monitoring", "Logs Explorer"]} showRefresh={false} />
      <PageHeading title="Logs Explorer" description="Search, filter and analyze logs from all your infrastructure sources." icon={<FileText size={19} />} actionsAlign="top">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => notify("Search saved to your mock saved searches.")} className="h-7 gap-1.5 whitespace-nowrap px-2.5 text-[9px]"><Save size={12} />Save Search</Button>
          <Button variant="outline" size="sm" onClick={() => exportCsv()} className="h-7 gap-1.5 whitespace-nowrap px-2.5 text-[9px]"><Download size={12} />Export Logs</Button>
          <Button size="sm" onClick={() => { setQueryEditor((value) => !value); notify("Query editor toggled."); }} className="h-7 gap-1.5 whitespace-nowrap px-2.5 text-[9px]"><Plus size={12} />New Query</Button>
        </div>
      </PageHeading>

      <section aria-label="Log summary" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summary.map((item) => <SummaryCard key={item.label} item={item} />)}
      </section>

      <section aria-label="Log trend and filters" className="grid gap-2.5 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Logs Trend" className="min-w-0" action={<div className="flex items-center gap-0.5">{["1h", "6h", "22h", "24h"].map((item) => <button key={item} onClick={() => setRange(item)} className={`rounded px-1.5 py-1 text-[7px] font-semibold ${range === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{item}</button>)}</div>}>
          <div className="flex justify-center gap-4 pt-1 text-[8px] text-muted-foreground">{[["Info", "#2878ed"], ["Warning", "#f97316"], ["Error", "#ef3340"]].map(([label, color]) => <span key={label} className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>
          <LogTrend range={range} />
        </Panel>

        <Panel title="Filter Logs" className="min-w-0" action={<button onClick={clearFilters} className="text-[8px] font-semibold text-primary">Clear All →</button>}>
          <div className="grid grid-cols-2 gap-x-2 gap-y-2 pt-1 sm:grid-cols-3">
            <label className="min-w-0 space-y-1 text-[8px] font-semibold text-foreground">Search Query
              <span className="relative block"><Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }} placeholder="Search in logs..." className="h-7 pr-7 text-[8px] font-normal" /><Search size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" /></span>
            </label>
            <label className="min-w-0 space-y-1 text-[8px] font-semibold text-foreground">Log Level
              <Select value={level} onValueChange={setLevel}><SelectTrigger aria-label="Log Level" className="h-7 w-full min-w-0 text-[8px]"><SelectValue /></SelectTrigger><SelectContent>{["All Levels", "ERROR", "WARNING", "INFO", "DEBUG"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
            </label>
            <label className="min-w-0 space-y-1 text-[8px] font-semibold text-foreground">Service
              <Select value={service} onValueChange={setService}><SelectTrigger aria-label="Service" className="h-7 w-full min-w-0 text-[8px]"><SelectValue /></SelectTrigger><SelectContent>{["All Services", ...new Set(logs.map((log) => log.service))].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
            </label>
            <label className="min-w-0 space-y-1 text-[8px] font-semibold text-foreground">Host / Instance
              <Select value={host} onValueChange={setHost}><SelectTrigger aria-label="Host / Instance" className="h-7 w-full min-w-0 text-[8px]"><SelectValue /></SelectTrigger><SelectContent>{["All Hosts", ...new Set(logs.map((log) => log.host))].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
            </label>
            <label className="min-w-0 space-y-1 text-[8px] font-semibold text-foreground">Time Range
              <Select value={timeRange} onValueChange={setTimeRange}><SelectTrigger aria-label="Time Range" className="h-7 w-full min-w-0 text-[8px]"><SelectValue /></SelectTrigger><SelectContent>{["Last 15 minutes", "Last 1 hour", "Last 6 hours", "Last 24 hours", "Last 7 days"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
            </label>
            <label className="min-w-0 space-y-1 text-[8px] font-semibold text-foreground">Environment
              <Select value={environment} onValueChange={setEnvironment}><SelectTrigger aria-label="Environment" className="h-7 w-full min-w-0 text-[8px]"><SelectValue /></SelectTrigger><SelectContent>{["All Environments", "prod", "staging"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
            </label>
          </div>
          {advanced && <div className="mt-2 border-t border-border pt-2"><label className="block space-y-1 text-[8px] font-semibold text-foreground">Context tag<Input value={contextFilter} onChange={(event) => setContextFilter(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }} placeholder="Filter by context tag..." className="h-7 text-[8px] font-normal" /></label></div>}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdvanced((value) => !value)} className="h-7 gap-1.5 px-2 text-[8px]"><SlidersHorizontal size={11} />{advanced ? "Hide Advanced" : "Advanced Filters"}</Button>
            <Button size="sm" onClick={applyFilters} className="h-7 gap-1.5 px-3 text-[8px]"><Search size={11} />Search Logs</Button>
          </div>
          {queryEditor && <div className="mt-2 rounded-md border border-border bg-muted/40 p-2"><label className="mb-1 block text-[8px] font-semibold text-foreground">Query editor</label><textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder='service="api-server" level="ERROR"' className="min-h-12 w-full resize-y rounded-md border border-input bg-card p-2 font-mono text-[9px] text-foreground outline-none focus:ring-2 focus:ring-ring" /><div className="mt-1 flex justify-end"><Button size="sm" onClick={applyFilters} className="h-6 px-2 text-[8px]">Run Query</Button></div></div>}
        </Panel>
      </section>

      <Panel title={`Logs Results (${filteredLogs.length === logs.length ? "48,742,893" : filteredLogs.length.toLocaleString()})`} className="min-w-0" action={<div className="flex items-center gap-2">
        {selected.length > 0 && <button onClick={() => exportCsv(true)} className="whitespace-nowrap text-[8px] font-semibold text-primary">Export selected ({selected.length})</button>}
        <span className="flex items-center gap-1 whitespace-nowrap text-[8px]"><i className={`h-1.5 w-1.5 rounded-full ${liveTail ? "bg-emerald-500" : "bg-slate-400"}`} />{liveTail ? "Live Tail" : "Paused"}</span>
        <button type="button" role="switch" aria-checked={liveTail} aria-label="Live Tail" onClick={() => { setLiveTail((value) => !value); notify(liveTail ? "Live tail paused." : "Live tail resumed."); }} className={`relative h-4 w-8 rounded-full transition ${liveTail ? "bg-blue-500" : "bg-slate-400"}`}><i className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition ${liveTail ? "left-[17px]" : "left-0.5"}`} /></button>
        <button onClick={() => notify("Realtime log tail is a mock-data preview.")} className="hidden whitespace-nowrap text-[8px] font-semibold text-primary sm:block">View in Real-time →</button>
      </div>}>
        <div className="overflow-x-auto pt-1">
          <table className="w-full min-w-[790px] text-left text-[8px]">
            <thead><tr className="border-b border-border bg-muted/40 text-muted-foreground">
              <th className="w-7 px-1.5 py-1.5"><input type="checkbox" aria-label="Select all logs" checked={filteredLogs.length > 0 && selected.length === filteredLogs.length} onChange={toggleAll} className="accent-primary" /></th>
              {["Timestamp", "Level", "Service", "Host", "Message", "Context", "Actions"].map((heading) => <th key={heading} className="whitespace-nowrap px-1.5 py-1.5 font-semibold">{heading}{heading === "Timestamp" && <span className="ml-1">↕</span>}</th>)}
            </tr></thead>
            <tbody>{filteredLogs.map((log) => <tr key={log.id} className="border-b border-border/70 last:border-0 hover:bg-muted/30">
              <td className="px-1.5 py-[5px]"><input type="checkbox" aria-label={`Select log ${log.id}`} checked={selected.includes(log.id)} onChange={() => setSelected((items) => items.includes(log.id) ? items.filter((id) => id !== log.id) : [...items, log.id])} className="accent-primary" /></td>
              <td className="whitespace-nowrap px-1.5 py-[5px] font-medium text-foreground">{log.timestamp}</td>
              <td className="px-1.5 py-[5px]"><span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[7px] font-bold ${levelStyles[log.level].className}`}><i className={`h-1.5 w-1.5 rounded-full ${levelStyles[log.level].dot}`} />{log.level}</span></td>
              <td className="whitespace-nowrap px-1.5 py-[5px] font-medium text-blue-600">{log.service}</td>
              <td className="whitespace-nowrap px-1.5 py-[5px] text-foreground">{log.host}</td>
              <td className="whitespace-nowrap px-1.5 py-[5px] text-foreground">{log.message}</td>
              <td className="px-1.5 py-[5px]"><div className="flex gap-1">{log.context.map((tag) => <span key={tag} className={`rounded-full border px-1.5 py-0.5 text-[7px] ${tag === "error" || tag === "retry" ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300" : tag === "prod" || tag === "memory" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"}`}>{tag}</span>)}</div></td>
              <td className="px-1.5 py-[5px]"><div className="flex items-center gap-1"><button onClick={() => setSelectedLog(log)} aria-label={`View ${log.id}`} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><Search size={11} /></button><button onClick={() => notify(`Log ${log.id} copied (mock action).`)} aria-label={`Copy ${log.id}`} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><Copy size={11} /></button><button onClick={() => setSelectedLog(log)} aria-label={`More actions for ${log.id}`} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><MoreVertical size={11} /></button></div></td>
            </tr>)}
            {filteredLogs.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-[9px] text-muted-foreground">No logs match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2 text-[8px] text-muted-foreground"><span>Showing {filteredLogs.length ? `1–${filteredLogs.length}` : "0"} of {filteredLogs.length === logs.length ? "48,742,893" : filteredLogs.length} logs</span><button onClick={() => notify("Mock log pagination: latest logs are shown.")} className="font-semibold text-primary">Load More ↓</button></div>
      </Panel>

      {selectedLog && <div role="dialog" aria-modal="true" aria-label="Log details" className="fixed inset-0 z-[1200] grid place-items-center bg-slate-950/45 p-4" onClick={() => setSelectedLog(null)}><div className="w-full max-w-lg rounded-xl border border-border bg-card p-4 text-foreground shadow-xl" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-sm font-bold">Log Details</h2><button onClick={() => setSelectedLog(null)} aria-label="Close log details" className="rounded p-1 text-muted-foreground hover:bg-accent"><X size={15} /></button></div><dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-2 text-[10px]"><dt className="text-muted-foreground">Timestamp</dt><dd>{selectedLog.timestamp}</dd><dt className="text-muted-foreground">Level</dt><dd>{selectedLog.level}</dd><dt className="text-muted-foreground">Service</dt><dd>{selectedLog.service}</dd><dt className="text-muted-foreground">Host</dt><dd>{selectedLog.host}</dd><dt className="text-muted-foreground">Message</dt><dd>{selectedLog.message}</dd><dt className="text-muted-foreground">Context</dt><dd>{selectedLog.context.join(", ")}</dd><dt className="text-muted-foreground">Environment</dt><dd>{selectedLog.environment}</dd></dl></div></div>}
      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1300] rounded-lg border border-border bg-card px-3 py-2 text-[10px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
