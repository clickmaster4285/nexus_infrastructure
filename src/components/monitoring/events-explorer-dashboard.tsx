"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Bell, CalendarDays, ChevronLeft, ChevronRight, Download, Filter, List,
  Plus, Search, Save, Settings2, Shield,
  X,
} from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MetricStat } from "@/data/mock/dashboard";

type Severity = "Critical" | "Warning" | "Info" | "Debug";
type EventRecord = {
  id: number;
  time: string;
  severity: Severity;
  message: string;
  source: string;
  host: string;
  category: string;
};

const summary: MetricStat[] = [
  { label: "Total Events", value: "12.8K", change: "7.5%", trend: "up", tone: "blue", icon: "bell" },
  { label: "Resolved", value: "11.2K", change: "8.1%", trend: "up", tone: "green", icon: "online" },
  { label: "Critical", value: "124", change: "12.3%", trend: "down", tone: "red", icon: "octagon-alert" },
  { label: "Warnings", value: "642", change: "3.7%", trend: "up", tone: "amber", icon: "warning" },
  { label: "Info", value: "872", change: "1.2%", trend: "up", tone: "blue", icon: "shield-check" },
];

const trend = [
  { time: "12:00", critical: 270, warning: 580, info: 1060 },
  { time: "13:00", critical: 320, warning: 650, info: 1240 },
  { time: "14:00", critical: 350, warning: 720, info: 1360 },
  { time: "16:00", critical: 365, warning: 780, info: 1480 },
  { time: "18:00", critical: 340, warning: 760, info: 1440 },
  { time: "20:00", critical: 390, warning: 810, info: 1540 },
  { time: "22:00", critical: 355, warning: 750, info: 1440 },
  { time: "00:00", critical: 325, warning: 730, info: 1460 },
  { time: "02:00", critical: 355, warning: 690, info: 1490 },
  { time: "04:00", critical: 340, warning: 750, info: 1370 },
  { time: "06:00", critical: 365, warning: 790, info: 1500 },
  { time: "08:00", critical: 340, warning: 730, info: 1410 },
  { time: "12:00", critical: 330, warning: 710, info: 1420 },
];

const severityData = [
  { name: "Critical", value: 124, label: "124 (1.0%)", color: "#ef3340" },
  { name: "Warning", value: 642, label: "642 (5.0%)", color: "#f59e0b" },
  { name: "Info", value: 872, label: "872 (6.8%)", color: "#2878ed" },
  { name: "Debug", value: 11162, label: "11.2K (87.2%)", color: "#20b77a" },
];

const sourceData = [
  { name: "System", value: "28.4%", width: "56%", icon: Settings2 },
  { name: "Application", value: "25.1%", width: "50%", icon: Bell },
  { name: "Database", value: "20.3%", width: "40%", icon: List },
  { name: "Network", value: "15.7%", width: "31%", icon: CalendarDays },
  { name: "Security", value: "10.5%", width: "21%", icon: Shield },
];

const hostData = [
  { name: "api-server-01", value: "3.1K", width: "100%" },
  { name: "web-app-01", value: "2.7K", width: "87%" },
  { name: "db-01", value: "2.3K", width: "74%" },
  { name: "app-server-02", value: "1.9K", width: "61%" },
  { name: "web-02", value: "1.7K", width: "55%" },
];

const recentEvents = [
  { severity: "Critical" as const, message: "Database connection lost", time: "2m ago" },
  { severity: "Warning" as const, message: "High memory usage: 89%", time: "4m ago" },
  { severity: "Info" as const, message: "Scheduled backup completed", time: "6m ago" },
  { severity: "Debug" as const, message: "Cache refreshed successfully", time: "8m ago" },
  { severity: "Info" as const, message: "New deployment deployed", time: "10m ago" },
];

const allEvents: EventRecord[] = [
  { id: 1, time: "2025-11-04 12:48:17", severity: "Critical", message: "Database connection lost. Retrying...", source: "Database", host: "db-01", category: "Database" },
  { id: 2, time: "2025-11-04 12:46:32", severity: "Warning", message: "High memory usage: 89%", source: "System", host: "web-app-01", category: "Performance" },
  { id: 3, time: "2025-11-04 12:44:10", severity: "Info", message: "User login successful", source: "Auth", host: "api-server-01", category: "Authentication" },
  { id: 4, time: "2025-11-04 12:42:55", severity: "Debug", message: "Cache refreshed", source: "Cache", host: "app-server-02", category: "Cache" },
  { id: 5, time: "2025-11-04 12:40:22", severity: "Info", message: "New deployment completed", source: "Deployment", host: "web-02", category: "Deployment" },
  { id: 6, time: "2025-11-04 12:38:04", severity: "Warning", message: "Payment API response delayed: 2.3s", source: "Application", host: "pay-01", category: "Performance" },
  { id: 7, time: "2025-11-04 12:35:48", severity: "Critical", message: "Primary node health check failed", source: "System", host: "api-server-01", category: "Availability" },
  { id: 8, time: "2025-11-04 12:32:19", severity: "Info", message: "Scheduled backup completed", source: "Database", host: "db-01", category: "Backup" },
  { id: 9, time: "2025-11-04 12:29:53", severity: "Debug", message: "Health check passed", source: "Network", host: "edge-01", category: "Network" },
  { id: 10, time: "2025-11-04 12:27:11", severity: "Warning", message: "Disk utilization reached 82%", source: "System", host: "storage-01", category: "Storage" },
];

const severityStyles: Record<Severity, string> = {
  Critical: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  Warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Debug: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

const severityDots: Record<Severity, string> = {
  Critical: "bg-rose-500",
  Warning: "bg-amber-500",
  Info: "bg-blue-500",
  Debug: "bg-emerald-500",
};

function EventsTrendChart({ range }: { range: string }) {
  return (
    <div className="h-[166px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trend} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical />
          <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 8 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 2000]} ticks={[0, 500, 1000, 1500, 2000]} tickFormatter={(value) => value === 0 ? "0" : value >= 1000 ? `${value / 1000}K` : `${value}`} tick={{ fill: "var(--muted-foreground)", fontSize: 8 }} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={(label) => `${label} · ${range}`} contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 10, background: "var(--popover)" }} />
          <Line dataKey="critical" name="Critical" type="monotone" stroke="#ef3340" strokeWidth={1.7} dot={false} />
          <Line dataKey="warning" name="Warning" type="monotone" stroke="#f59e0b" strokeWidth={1.7} dot={false} />
          <Line dataKey="info" name="Info" type="monotone" stroke="#2878ed" strokeWidth={1.7} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SeverityDonut() {
  return (
    <div className="flex h-[166px] items-center gap-2">
      <div className="relative h-[130px] w-[48%] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={severityData} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={1} stroke="none">
              {severityData.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className="font-display text-[18px] font-extrabold leading-tight text-foreground">12.8K</b>
          <span className="text-[8px] text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {severityData.map((item) => (
          <div key={item.name} className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2 text-[8px]">
            <i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate text-foreground">{item.name}</span>
            <b className="whitespace-nowrap text-foreground">{item.label}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakdownBars({ rows, hosts = false }: { rows: typeof sourceData | typeof hostData; hosts?: boolean }) {
  return (
    <div className="space-y-[9px] pt-1">
      {rows.map((row) => {
        const Icon = "icon" in row ? row.icon : null;
        return (
          <div key={row.name} className="grid grid-cols-[minmax(66px,0.8fr)_minmax(0,1fr)_38px] items-center gap-2 text-[8px]">
            <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-foreground">
              {hosts ? <i className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> : Icon ? <Icon size={11} className="shrink-0 text-blue-600" /> : null}
              {row.name}
            </span>
            <div className="h-[6px] rounded-full bg-muted"><div className={`h-full rounded-full ${hosts ? "bg-blue-400" : "bg-blue-600"}`} style={{ width: row.width }} /></div>
            <b className="text-right text-foreground">{row.value}</b>
          </div>
        );
      })}
    </div>
  );
}

export function EventsExplorerDashboard() {
  const [notice, setNotice] = useState("");
  const [range, setRange] = useState("24h");
  const [severity, setSeverity] = useState("All Severities");
  const [source, setSource] = useState("All Sources");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState({ severity: "All Severities", source: "All Sources", search: "" });
  const [selected, setSelected] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const filteredEvents = useMemo(() => allEvents.filter((event) => (
    (applied.severity === "All Severities" || event.severity === applied.severity)
    && (applied.source === "All Sources" || event.source === applied.source)
    && `${event.time} ${event.severity} ${event.message} ${event.source} ${event.host} ${event.category}`.toLowerCase().includes(applied.search.toLowerCase())
  )), [applied]);
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageEvents = filteredEvents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const applyFilters = () => {
    setApplied({ severity, source, search });
    setPage(1);
    setSelected([]);
    notify("Event filters applied.");
  };
  const clearFilters = () => {
    setSeverity("All Severities");
    setSource("All Sources");
    setSearch("");
    setApplied({ severity: "All Severities", source: "All Sources", search: "" });
    setPage(1);
    setSelected([]);
    notify("Event filters cleared.");
  };
  const exportCsv = () => {
    const header = ["Time", "Severity", "Event Message", "Source", "Host", "Category"];
    const rows = filteredEvents.map((event) => [event.time, event.severity, event.message, event.source, event.host, event.category]);
    const csv = [header, ...rows].map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "events-explorer.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify(`${filteredEvents.length} mock events exported.`);
  };
  const toggleCurrentPage = () => {
    const currentIds = pageEvents.map((event) => event.id);
    setSelected((previous) => currentIds.every((id) => previous.includes(id))
      ? previous.filter((id) => !currentIds.includes(id))
      : [...new Set([...previous, ...currentIds])]);
  };

  return (
    <div className="space-y-2.5 pb-3">
      <PageMeta breadcrumbs={["Monitoring", "Events Explorer"]} showRefresh={false} />
      <PageHeading title="Events Explorer" description="Explore and analyze all system events across your infrastructure." icon={<CalendarDays size={19} />} actionsAlign="top">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-7 gap-1.5 whitespace-nowrap px-2.5 text-[9px]"><Download size={12} />Export Events</Button>
          <Button variant="outline" size="sm" onClick={() => notify("Event view saved to mock saved views.")} className="h-7 gap-1.5 whitespace-nowrap px-2.5 text-[9px]"><Save size={12} />Save View</Button>
          <Button size="sm" onClick={() => notify("New Alert Rule is a mockup action.")} className="h-7 gap-1.5 whitespace-nowrap px-2.5 text-[9px]"><Plus size={12} />New Alert Rule</Button>
        </div>
      </PageHeading>

      <section aria-label="Event summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {summary.map((item) => <MetricCard key={item.label} item={item} className="h-[68px] gap-2 p-2 sm:p-2.5" />)}
      </section>

      <section aria-label="Event trends and severity" className="grid gap-2.5 xl:grid-cols-[1.65fr_1fr]">
        <Panel title="Events Trend" className="min-w-0" action={<div className="flex items-center gap-0.5">{["1h", "6h", "12h", "24h"].map((item) => <button key={item} onClick={() => setRange(item)} className={`rounded px-1.5 py-1 text-[7px] font-semibold ${range === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{item}</button>)}</div>}>
          <div className="flex justify-center gap-4 pt-1 text-[8px] text-muted-foreground">{[["Critical", "#ef3340"], ["Warning", "#f59e0b"], ["Info", "#2878ed"]].map(([label, color]) => <span key={label} className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>
          <EventsTrendChart range={range} />
        </Panel>
        <Panel title="Events by Severity" className="min-w-0"><SeverityDonut /></Panel>
      </section>

      <section aria-label="Event sources, hosts and recent events" className="grid gap-2.5 xl:grid-cols-3">
        <Panel title="Top Event Sources" className="min-w-0"><BreakdownBars rows={sourceData} /></Panel>
        <Panel title="Events by Host" className="min-w-0" action={<button onClick={() => notify("Showing all event hosts.")} className="text-[8px] font-semibold text-primary">View All →</button>}><BreakdownBars rows={hostData} hosts /></Panel>
        <Panel title="Recent Events" className="min-w-0" action={<button onClick={() => { setApplied({ severity: "All Severities", source: "All Sources", search: "" }); notify("Showing all recent events in the table."); }} className="text-[8px] font-semibold text-primary">View All →</button>}>
          <div className="space-y-[9px] pt-1">
            {recentEvents.map((event) => <div key={`${event.severity}-${event.message}`} className="grid grid-cols-[58px_minmax(0,1fr)_38px] items-center gap-2 text-[8px]">
              <span className={`inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold ${severityStyles[event.severity]}`}><i className={`h-1.5 w-1.5 rounded-full ${severityDots[event.severity]}`} />{event.severity}</span>
              <span className="truncate text-foreground">{event.message}</span>
              <span className="text-right text-muted-foreground">{event.time}</span>
            </div>)}
          </div>
        </Panel>
      </section>

      <Panel title="All Events" className="min-w-0" action={<div className="flex flex-wrap items-center justify-end gap-1.5">
        <Button variant="outline" size="sm" onClick={() => notify("Showing advanced event filters.")} className="h-6 gap-1 px-2 text-[8px]"><Filter size={10} />Filter</Button>
        <Select value={source} onValueChange={(value) => { setSource(value); setApplied((current) => ({ ...current, source: value })); setPage(1); }}><SelectTrigger aria-label="Event source" className="h-6 w-[92px] text-[8px]"><SelectValue /></SelectTrigger><SelectContent>{["All Sources", "System", "Application", "Database", "Network", "Security", "Auth", "Cache", "Deployment"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
        <Select value={severity} onValueChange={(value) => { setSeverity(value); setApplied((current) => ({ ...current, severity: value })); setPage(1); }}><SelectTrigger aria-label="Event severity" className="h-6 w-[102px] text-[8px]"><SelectValue /></SelectTrigger><SelectContent>{["All Severities", "Critical", "Warning", "Info", "Debug"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
        <span className="relative hidden w-[110px] sm:block"><Input aria-label="Search events" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }} placeholder="Search events..." className="h-6 pr-6 text-[8px]" /><Search size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" /></span>
        <Button size="sm" onClick={applyFilters} className="h-6 px-2 text-[8px]">Apply</Button>
        <button onClick={clearFilters} aria-label="Clear event filters" className="rounded p-1 text-muted-foreground hover:bg-accent"><X size={12} /></button>
      </div>}>
        {selected.length > 0 && <div className="flex items-center justify-between border-b border-border py-1.5 text-[8px]"><span className="text-muted-foreground">{selected.length} event{selected.length === 1 ? "" : "s"} selected</span><button onClick={exportCsv} className="font-semibold text-primary">Export filtered events</button></div>}
        <div className="overflow-x-auto pt-1">
          <table className="w-full min-w-[790px] text-left text-[8px]">
            <thead><tr className="border-b border-border bg-muted/40 text-muted-foreground">
              <th className="w-7 px-1.5 py-1.5"><input type="checkbox" aria-label="Select events on this page" checked={pageEvents.length > 0 && pageEvents.every((event) => selected.includes(event.id))} onChange={toggleCurrentPage} className="accent-primary" /></th>
              {["Time", "Severity", "Event Message", "Source", "Host", "Category", "Action"].map((heading) => <th key={heading} className="whitespace-nowrap px-1.5 py-1.5 font-semibold">{heading}{heading === "Time" && <span className="ml-1">↕</span>}</th>)}
            </tr></thead>
            <tbody>{pageEvents.map((event) => <tr key={event.id} className="border-b border-border/70 last:border-0 hover:bg-muted/30">
              <td className="px-1.5 py-[5px]"><input type="checkbox" aria-label={`Select event ${event.id}`} checked={selected.includes(event.id)} onChange={() => setSelected((items) => items.includes(event.id) ? items.filter((id) => id !== event.id) : [...items, event.id])} className="accent-primary" /></td>
              <td className="whitespace-nowrap px-1.5 py-[5px] font-medium text-foreground">{event.time}</td>
              <td className="px-1.5 py-[5px]"><span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${severityStyles[event.severity]}`}><i className={`h-1.5 w-1.5 rounded-full ${severityDots[event.severity]}`} />{event.severity}</span></td>
              <td className="whitespace-nowrap px-1.5 py-[5px] text-foreground">{event.message}</td>
              <td className="whitespace-nowrap px-1.5 py-[5px] text-foreground">{event.source}</td>
              <td className="whitespace-nowrap px-1.5 py-[5px] text-foreground">{event.host}</td>
              <td className="whitespace-nowrap px-1.5 py-[5px] text-foreground">{event.category}</td>
              <td className="px-1.5 py-[5px]"><button onClick={() => notify(`Event ${event.id}: ${event.message}`)} className="whitespace-nowrap font-semibold text-primary">View →</button></td>
            </tr>)}
            {pageEvents.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-[9px] text-muted-foreground">No events match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[8px] text-muted-foreground">
          <span>Showing {filteredEvents.length ? `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, filteredEvents.length)}` : "0"} of {filteredEvents.length} loaded events <span className="text-muted-foreground/70">(12.8K total in selected period)</span></span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="Previous page" className="grid h-6 w-6 place-items-center rounded border border-border disabled:opacity-40"><ChevronLeft size={12} /></button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} onClick={() => setPage(pageNumber)} aria-current={currentPage === pageNumber ? "page" : undefined} className={`grid h-6 min-w-6 place-items-center rounded border px-1.5 ${currentPage === pageNumber ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-accent"}`}>{pageNumber}</button>)}
            <button onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} aria-label="Next page" className="grid h-6 w-6 place-items-center rounded border border-border disabled:opacity-40"><ChevronRight size={12} /></button>
          </div>
        </div>
      </Panel>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[10px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
