"use client";

import { useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { AlertTriangle, Check, Database, Download, Plus } from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { MetricStat } from "@/data/mock/dashboard";

const stats: MetricStat[] = [
  { label: "Total Databases", value: "6", change: "1 new", trend: "up", tone: "blue", icon: "database" },
  { label: "Healthy", value: "5", change: "83.3%", trend: "up", tone: "green", icon: "online" },
  { label: "Issues", value: "1", change: "16.7%", trend: "down", tone: "red", icon: "octagon-alert" },
  { label: "Avg Query Time", value: "142 ms", change: "8.1%", trend: "down", tone: "blue", icon: "activity" },
  { label: "Total Size", value: "724 GB", change: "5.2%", trend: "up", tone: "green", icon: "storage" },
  { label: "Uptime", value: "99.95%", change: "0.05%", trend: "up", tone: "green", icon: "shield-check" },
];

const hours = ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00"];
const queryHistory = hours.map((time, index) => ({
  time,
  query: [232, 241, 278, 262, 281, 276, 269, 251, 263, 272, 251, 264, 245][index],
  connections: [152, 160, 173, 165, 183, 176, 169, 158, 171, 180, 161, 170, 164][index],
  throughput: [76, 82, 105, 120, 115, 98, 112, 101, 108, 116, 92, 103, 94][index],
}));
const connectionHistory = hours.map((time, index) => ({ time, active: [360, 378, 405, 390, 432, 418, 406, 420, 398, 437, 416, 428, 412][index] }));
const queryTimeHistory = hours.map((time, index) => ({ time, value: [122, 135, 128, 142, 137, 151, 145, 132, 139, 158, 144, 148, 142][index] }));

const databases = [
  { name: "my_app_db", query: "245 ms", throughput: "1,245 QPS", status: "Healthy" },
  { name: "analytics_db", query: "178 ms", throughput: "982 QPS", status: "Healthy" },
  { name: "ecommerce_db", query: "142 ms", throughput: "876 QPS", status: "Healthy" },
  { name: "hr_db", query: "121 ms", throughput: "743 QPS", status: "Healthy" },
  { name: "logs_db", query: "98 ms", throughput: "602 QPS", status: "Healthy" },
];

const events = [
  { time: "12:38 PM", database: "my_app_db", event: "Slow Query", message: "Query took 2.8s", status: "Warning" },
  { time: "11:50 AM", database: "analytics_db", event: "Connection Loss", message: "Reconnected successfully", status: "Resolved" },
  { time: "10:26 AM", database: "ecommerce_db", event: "Backup Completed", message: "Backup size: 4.2 GB", status: "Info" },
  { time: "09:12 AM", database: "hr_db", event: "High CPU", message: "CPU usage reached 90%", status: "Resolved" },
  { time: "08:45 AM", database: "logs_db", event: "Maintenance", message: "Scheduled maintenance", status: "Info" },
];

const statusClass: Record<string, string> = {
  Warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

function PerformanceChart({ period }: { period: string }) {
  return (
    <>
      <div className="flex flex-wrap justify-center gap-x-4 pt-1 text-[8px] text-muted-foreground">
        {[["Query Time (ms)", "#2878ed"], ["Connections", "#20b77a"], ["Throughput (QPS)", "#8b5cf6"]].map(([label, color]) => <span key={label} className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}
      </div>
      <div className="h-[143px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={queryHistory} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical />
            <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 8 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 400]} ticks={[0, 100, 200, 300, 400]} tickFormatter={(value) => `${value}ms`} tick={{ fill: "var(--muted-foreground)", fontSize: 8 }} axisLine={false} tickLine={false} />
            <Tooltip labelFormatter={(label) => `${label} · ${period}`} contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 10, background: "var(--popover)" }} />
            <Line dataKey="query" name="Query Time (ms)" type="monotone" stroke="#2878ed" strokeWidth={1.8} dot={{ r: 1.7 }} />
            <Line dataKey="connections" name="Connections" type="monotone" stroke="#20b77a" strokeWidth={1.8} dot={false} />
            <Line dataKey="throughput" name="Throughput (QPS)" type="monotone" stroke="#8b5cf6" strokeWidth={1.8} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function DatabaseHealth() {
  const circumference = 2 * Math.PI * 43;
  return (
    <div className="flex h-[165px] items-center justify-center gap-4">
      <div className="relative h-[120px] w-[120px] shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-label="Database health 83.3%">
          <circle cx="50" cy="50" r="43" fill="none" stroke="var(--muted)" strokeWidth="9" />
          <circle cx="50" cy="50" r="43" fill="none" stroke="#20b77a" strokeWidth="9" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - 5 / 6)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Check size={18} className="mb-1 rounded-full bg-emerald-500 p-1 text-white" />
          <b className="font-display text-[20px] font-extrabold leading-tight text-foreground">83.3%</b>
          <span className="text-[8px] text-muted-foreground">Healthy</span>
        </div>
      </div>
      <div className="space-y-3 text-[8px]">
        {[["Healthy", "5", "#20b77a"], ["Issues", "1", "#ef4444"], ["Offline", "0", "#94a3b8"]].map(([name, count, color]) => <div key={name} className="flex min-w-[70px] items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /><span className="flex-1 text-foreground">{name}</span><b className="text-foreground">{count}</b></div>)}
      </div>
    </div>
  );
}

function StorageUsage() {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="relative h-[82px] w-[82px] shrink-0">
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90" aria-label="Storage usage 72%">
          <circle cx="36" cy="36" r={radius} fill="none" stroke="var(--muted)" strokeWidth="6" />
          <circle cx="36" cy="36" r={radius} fill="none" stroke="#3182f6" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * 0.28} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[15px] font-extrabold text-foreground">72%</b><span className="text-[7px] text-muted-foreground">Used</span></div>
      </div>
      <div className="min-w-[78px] flex-1 space-y-2 text-[8px]">
        {[["Used Space", "521 GB", "#2878ed"], ["Free Space", "203 GB", "#20b77a"], ["Total Size", "724 GB", "#94a3b8"]].map(([label, value, color]) => <div key={label} className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} /><span className="flex-1 text-muted-foreground">{label}</span><b className="text-foreground">{value}</b></div>)}
      </div>
      <div className="hidden h-[50px] w-[38%] sm:block">
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={queryHistory}><Area dataKey="query" type="monotone" stroke="#3182f6" fill="#3182f6" fillOpacity={0.15} strokeWidth={1.5} dot={false} /></AreaChart></ResponsiveContainer>
      </div>
    </div>
  );
}

function ConnectionsOverview() {
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="min-w-[88px]">
        <b className="font-display text-[24px] font-extrabold leading-tight text-foreground">412</b>
        <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-emerald-600">↑ 4.3%</div>
        <div className="mt-2 space-y-1 text-[8px]">
          <div className="flex items-center gap-1.5 text-muted-foreground"><i className="h-1.5 w-1.5 rounded-full bg-blue-500" />Active <b className="ml-auto text-foreground">382</b></div>
          <div className="flex items-center gap-1.5 text-muted-foreground"><i className="h-1.5 w-1.5 rounded-full bg-slate-400" />Idle <b className="ml-auto text-foreground">30</b></div>
        </div>
      </div>
      <div className="h-[88px] min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={connectionHistory} margin={{ top: 4, right: 2, left: -22, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical />
            <XAxis dataKey="time" interval={4} tick={{ fill: "var(--muted-foreground)", fontSize: 7 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 600]} ticks={[0, 200, 400, 600]} tick={{ fill: "var(--muted-foreground)", fontSize: 7 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 9, background: "var(--popover)" }} />
            <Area dataKey="active" name="Active Connections" type="monotone" stroke="#2878ed" fill="#2878ed" fillOpacity={0.12} strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function QueryPerformance() {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className="min-w-[72px]">
        <b className="font-display text-[20px] font-extrabold text-foreground">142 ms</b>
        <p className="text-[8px] text-muted-foreground">Avg Query Time</p>
        <p className="mt-2 text-[9px] font-semibold text-emerald-600">↓ 8.1%</p>
      </div>
      <div className="h-[70px] min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={queryTimeHistory}><Area dataKey="value" type="monotone" stroke="#20b77a" fill="#20b77a" fillOpacity={0.12} strokeWidth={1.5} dot={false} /></AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 border-l border-border pl-2 text-[7px]">
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Slow Queries</span><b className="text-foreground">12</b></div>
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Normal</span><b className="text-foreground">1,245</b></div>
        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Fast Queries</span><b className="text-foreground">98.7%</b></div>
      </div>
    </div>
  );
}

function LocationMap() {
  const markers = [
    { x: 18, y: 38, state: "healthy" }, { x: 25, y: 52, state: "critical" }, { x: 31, y: 45, state: "healthy" },
    { x: 49, y: 38, state: "healthy" }, { x: 53, y: 48, state: "healthy" }, { x: 65, y: 44, state: "healthy" },
    { x: 78, y: 59, state: "healthy" }, { x: 88, y: 72, state: "healthy" },
  ];
  return (
    <div className="relative h-[108px]">
      <svg viewBox="0 0 100 80" className="absolute inset-0 h-full w-full" aria-label="World map showing database locations">
        <g fill="#dbe7f4" stroke="#fff" strokeWidth=".45">
          <path d="M5 20 12 13 22 11 29 16 28 22 33 26 29 31 25 32 23 39 19 44 14 42 13 36 9 33 11 28 7 26Z" />
          <path d="m27 43 7 3 4 8-2 10-4 8-3-7-2-9-4-7Z" />
          <path d="m43 20 4-5 9-2 4 3 9-1 6 4 8 1 4 4 9 2 2 4-5 3-7-2-4 4-6-2-4 7-5 2-1 6-5 3-4-4-6 2-4-5-7-2 1-8 5-2 4-7Z" />
          <path d="m52 47 7-3 7 2 5 7-4 8-5 5-6-2-3-7-4-4Z" />
          <path d="m76 58 6-2 8 4 4 6-4 6-6-2-5-5Z" />
        </g>
        {markers.map((marker, index) => <g key={index}><circle cx={marker.x} cy={marker.y} r="2.2" fill={marker.state === "critical" ? "#f97316" : "#20b77a"} opacity=".22" /><circle cx={marker.x} cy={marker.y} r="1.25" fill={marker.state === "critical" ? "#f97316" : "#20b77a"} stroke="#fff" strokeWidth=".6" /></g>)}
      </svg>
      <div className="absolute bottom-1 right-0 flex flex-col gap-1 text-[7px] font-semibold text-foreground">
        <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Healthy <b>5</b></span>
        <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-orange-500" />Issues <b>1</b></span>
        <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-slate-400" />Offline <b>0</b></span>
      </div>
    </div>
  );
}

export function DatabaseMonitoringDashboard() {
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState("24h");
  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const exportReport = () => {
    const header = ["Time", "Database", "Event", "Message", "Status"];
    const rows = events.map(({ time, database, event, message, status }) => [time, database, event, message, status]);
    const csv = [header, ...rows].map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "database-monitoring-report.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify("Database monitoring report exported.");
  };
  const periodControl = (
    <div className="flex items-center gap-0.5">
      {["1h", "6h", "12h", "24h"].map((item) => <button key={item} onClick={() => setPeriod(item)} className={`rounded px-1.5 py-1 text-[7px] font-semibold ${period === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{item}</button>)}
    </div>
  );

  return (
    <div className="space-y-2.5 pb-3">
      <PageMeta breadcrumbs={["Monitoring", "Database Monitoring"]} showRefresh={false} />
      <PageHeading title="Database Monitoring" description="Monitor your databases performance, health and activity in real-time." icon={<Database size={19} />} actionsAlign="top">
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1.5 text-[8px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 sm:flex"><Check size={11} />All Databases Healthy</span>
          <Button variant="outline" size="sm" onClick={exportReport} className="h-7 gap-1.5 whitespace-nowrap px-2.5 text-[9px]"><Download size={12} />Export Report</Button>
          <Button size="sm" onClick={() => notify("Add Database is a mockup action.")} className="h-7 gap-1.5 whitespace-nowrap px-2.5 text-[9px]"><Plus size={12} />Add Database</Button>
        </div>
      </PageHeading>

      <section aria-label="Database monitoring summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[68px] gap-2 p-2 sm:p-2.5" />)}
      </section>

      <section aria-label="Database performance and status" className="grid gap-2.5 xl:grid-cols-[1.7fr_0.85fr_1.05fr]">
        <Panel title="Database Performance Overview" className="min-w-0" action={periodControl}>
          <PerformanceChart period={period} />
        </Panel>
        <Panel title="Database Status" className="min-w-0"><DatabaseHealth />
          <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-[7px] dark:border-emerald-900 dark:bg-emerald-950/40">
            <span className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300"><AlertTriangle size={10} />1 Database Needs Attention</span>
            <button onClick={() => notify("Opening database health details.")} className="whitespace-nowrap font-semibold text-primary">View Details →</button>
          </div>
        </Panel>
        <Panel title="Top Databases by Load" className="min-w-0">
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[300px] text-left text-[7px]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Database", "Query Time", "Throughput", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{databases.map((database) => <tr key={database.name} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1 py-[5px] font-medium text-foreground"><Database size={9} className="mr-1 inline text-blue-500" />{database.name}</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{database.query}</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{database.throughput}</td><td className="px-1 py-[5px]"><span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[6px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Healthy</span></td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section aria-label="Database usage and query metrics" className="grid gap-2.5 xl:grid-cols-[1fr_1.28fr_1.12fr]">
        <Panel title="Storage Usage" className="min-w-0"><StorageUsage /></Panel>
        <Panel title="Connections Overview" className="min-w-0"><ConnectionsOverview /></Panel>
        <Panel title="Query Performance" className="min-w-0"><QueryPerformance /></Panel>
      </section>

      <section aria-label="Database events and locations" className="grid gap-2.5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Recent Database Events" className="min-w-0" action={<button onClick={() => notify("Showing all database events.")} className="text-[8px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[430px] text-left text-[7px]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Time", "Database", "Event", "Message", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{events.map((item) => <tr key={`${item.time}-${item.database}`} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{item.time}</td><td className="whitespace-nowrap px-1 py-[5px] font-medium text-foreground">{item.database}</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{item.event}</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{item.message}</td><td className="px-1 py-[5px]"><span className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[6px] ${statusClass[item.status]}`}>{item.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Database Health by Location" className="min-w-0" action={<button onClick={() => notify("Opening database location details.")} className="text-[8px] font-semibold text-primary">View Details →</button>}>
          <LocationMap />
        </Panel>
      </section>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[10px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
