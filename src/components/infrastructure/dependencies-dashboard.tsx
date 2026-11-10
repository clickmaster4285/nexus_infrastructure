"use client";

import { useState } from "react";
import {
  Download, Link2, Plus, RefreshCw,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { MetricStat } from "@/data/mock/dashboard";

type DependencyStatus = "Healthy" | "Warning" | "Critical";

const stats: MetricStat[] = [
  { label: "Total Dependencies", value: "128", change: "12 new", trend: "up", tone: "purple", icon: "workflow" },
  { label: "Healthy", value: "96", change: "75.0%", trend: "flat", tone: "green", icon: "online" },
  { label: "Warning", value: "24", change: "18.8%", trend: "flat", tone: "amber", icon: "warning" },
  { label: "Critical", value: "8", change: "6.2%", trend: "flat", tone: "red", icon: "offline" },
  { label: "Services", value: "46", change: "3 new", trend: "up", tone: "blue", icon: "settings-2" },
  { label: "External Dependencies", value: "32", change: "25.0%", trend: "flat", tone: "purple", icon: "network" },
];

const healthData = [
  { time: "12:00", healthy: 86, warning: 41, critical: 4 },
  { time: "14:00", healthy: 83, warning: 39, critical: 5 },
  { time: "16:00", healthy: 82, warning: 40, critical: 5 },
  { time: "18:00", healthy: 88, warning: 43, critical: 6 },
  { time: "20:00", healthy: 81, warning: 37, critical: 5 },
  { time: "22:00", healthy: 89, warning: 39, critical: 7 },
  { time: "00:00", healthy: 79, warning: 35, critical: 5 },
  { time: "02:00", healthy: 87, warning: 40, critical: 4 },
  { time: "04:00", healthy: 88, warning: 38, critical: 5 },
  { time: "06:00", healthy: 76, warning: 40, critical: 5 },
  { time: "08:00", healthy: 85, warning: 44, critical: 6 },
  { time: "10:00", healthy: 78, warning: 37, critical: 5 },
  { time: "12:00", healthy: 84, warning: 41, critical: 6 },
];

const healthSlices = [
  { name: "Healthy", value: 96, color: "#35b879" },
  { name: "Warning", value: 24, color: "#f39a12" },
  { name: "Critical", value: 8, color: "#ed3346" },
];

const dependencyTypes = [
  { name: "Database", value: 42, color: "#2878ed" },
  { name: "API / HTTP", value: 36, color: "#35b879" },
  { name: "Cache / Queue", value: 18, color: "#f39a12" },
  { name: "Storage", value: 16, color: "#8a45df" },
  { name: "Others", value: 16, color: "#9aa9be" },
];

const dependencies: {
  name: string;
  type: string;
  parent: string;
  target: string;
  status: DependencyStatus;
  response: string;
  responseMs: number;
  uptime: string;
}[] = [
  { name: "User Service → PostgreSQL", type: "Database", parent: "User Service", target: "PostgreSQL (Primary)", status: "Healthy", response: "12 ms", responseMs: 12, uptime: "99.99%" },
  { name: "Order Service → Redis", type: "Cache", parent: "Order Service", target: "Redis Cache", status: "Healthy", response: "8 ms", responseMs: 8, uptime: "99.99%" },
  { name: "Payment Service → Stripe API", type: "API / HTTP", parent: "Payment Service", target: "Stripe API", status: "Healthy", response: "210 ms", responseMs: 210, uptime: "99.95%" },
  { name: "Inventory Service → RabbitMQ", type: "Queue", parent: "Inventory Service", target: "RabbitMQ", status: "Warning", response: "512 ms", responseMs: 512, uptime: "98.76%" },
  { name: "Reporting Service → S3", type: "Storage", parent: "Reporting Service", target: "AWS S3", status: "Healthy", response: "45 ms", responseMs: 45, uptime: "99.97%" },
  { name: "Auth Service → MongoDB", type: "Database", parent: "Auth Service", target: "MongoDB Replica Set", status: "Critical", response: "—", responseMs: 0, uptime: "95.12%" },
  { name: "Web Frontend → User Service", type: "API / HTTP", parent: "Web Frontend", target: "User Service API", status: "Healthy", response: "18 ms", responseMs: 18, uptime: "99.99%" },
  { name: "Notification Service → SendGrid", type: "API / HTTP", parent: "Notification Service", target: "SendGrid API", status: "Warning", response: "780 ms", responseMs: 780, uptime: "98.10%" },
  { name: "Search Service → Elasticsearch", type: "API / HTTP", parent: "Search Service", target: "Elasticsearch Cluster", status: "Warning", response: "340 ms", responseMs: 340, uptime: "98.90%" },
  { name: "Analytics Service → ClickHouse", type: "Database", parent: "Analytics Service", target: "ClickHouse Cluster", status: "Healthy", response: "74 ms", responseMs: 74, uptime: "99.98%" },
];
const totalDependencyCount = Number(stats.find((item) => item.label === "Total Dependencies")?.value ?? 0);

const topDependenciesByResponseTime = [
  { name: "Notification Service → SendGrid", type: "API / HTTP", responseMs: 780 },
  { name: "Inventory Service → RabbitMQ", type: "Queue", responseMs: 512 },
  { name: "Search Service → Elasticsearch", type: "API / HTTP", responseMs: 340 },
  { name: "Payment Service → Stripe API", type: "API / HTTP", responseMs: 210 },
  { name: "Auth Service → PostgreSQL", type: "Database", responseMs: 96 },
  { name: "Order Service → Kafka", type: "Queue", responseMs: 88 },
  { name: "Analytics Service → ClickHouse", type: "Database", responseMs: 74 },
  { name: "Reporting Service → S3", type: "Storage", responseMs: 45 },
  { name: "User Service → Redis", type: "Cache", responseMs: 32 },
  { name: "API Gateway → Auth Service", type: "API / HTTP", responseMs: 24 },
  { name: "Web Frontend → User Service", type: "API / HTTP", responseMs: 18 },
  { name: "Session Service → Redis", type: "Cache", responseMs: 9 },
].sort((a, b) => b.responseMs - a.responseMs);

const topParents = [
  { name: "User Service", count: 24, width: "100%", color: "#2878ed" },
  { name: "Order Service", count: 18, width: "75%", color: "#35b879" },
  { name: "Inventory Service", count: 16, width: "67%", color: "#f39a12" },
  { name: "Payment Service", count: 12, width: "50%", color: "#8a45df" },
  { name: "Reporting Service", count: 10, width: "42%", color: "#06b6d4" },
];

const events = [
  { text: "Critical dependency: Auth Service → MongoDB", ago: "2m ago", color: "bg-rose-500" },
  { text: "New dependency added: Web Frontend → User Service", ago: "8m ago", color: "bg-emerald-500" },
  { text: "Warning: High response time on SendGrid API", ago: "15m ago", color: "bg-amber-500" },
  { text: "Dependency restored: Inventory Service → RabbitMQ", ago: "28m ago", color: "bg-emerald-500" },
  { text: "New dependency added: Reporting Service → AWS S3", ago: "45m ago", color: "bg-emerald-500" },
];

const statusClass: Record<DependencyStatus, string> = {
  Healthy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Critical: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

const statusColor: Record<DependencyStatus, string> = {
  Healthy: "text-emerald-600",
  Warning: "text-amber-600",
  Critical: "text-rose-600",
};

function DependencyDonut({ data, size = "large" }: { data: { name: string; value: number; color: string }[]; size?: "large" | "small" }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const compact = size === "small";
  return (
    <div className={`flex items-center justify-center gap-3 ${compact ? "h-[160px]" : "h-[150px]"}`}>
      <div className={`relative shrink-0 ${compact ? "h-[120px] w-[120px]" : "h-[112px] w-[112px]"}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="65%" outerRadius="89%" paddingAngle={1} stroke="none">
              {data.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className={`font-display font-extrabold leading-tight text-foreground ${compact ? "text-[19px]" : "text-[20px]"}`}>{total}</b>
          <span className="text-[12px] text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        {data.map((item) => (
          <div key={item.name} className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-1.5 text-[12px]">
            <i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate text-foreground">{item.name}</span>
            <span className="whitespace-nowrap text-foreground">{item.value} ({Math.round(item.value / total * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionRows({ items, color = "bg-blue-500" }: { items: { name: string; count: number; width: string; color?: string }[]; color?: string }) {
  return (
    <div className="space-y-3 pt-2">
      {items.map((item) => (
        <div key={item.name} className="grid grid-cols-[minmax(0,1fr)_minmax(48px,1fr)_32px] items-center gap-2 text-[12px]">
          <span className="truncate text-foreground">{item.name}</span>
          <div className="h-[6px] rounded-full bg-muted"><div className={`h-full rounded-full ${item.color ? "" : color}`} style={{ width: item.width, ...(item.color ? { backgroundColor: item.color } : {}) }} /></div>
          <b className="text-right text-foreground">{item.count}</b>
        </div>
      ))}
    </div>
  );
}

export function DependenciesDashboard() {
  const [notice, setNotice] = useState("");
  const [updatedAt, setUpdatedAt] = useState("Just now");
  const [pageSize, setPageSize] = useState("10");
  const currentPage = 1;
  const pageSizeNumber = Number(pageSize);
  const rangeStart = dependencies.length ? (currentPage - 1) * pageSizeNumber + 1 : 0;
  const rangeEnd = Math.min(currentPage * pageSizeNumber, dependencies.length);
  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const refresh = () => {
    setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    toast("Dependency data refreshed.");
  };
  const exportCsv = () => {
    const header = ["Dependency Name", "Type", "Parent Service", "Dependency", "Status", "Health", "Response Time", "Uptime"];
    const rows = dependencies.map((item) => [item.name, item.type, item.parent, item.target, item.status, item.status, item.response, item.uptime]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "dependencies.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast("Dependency list exported.");
  };

  return (
    <div className="space-y-2.5 pb-3">
      <PageMeta breadcrumbs={["Infrastructure", "Dependencies"]} variant="detail" />
      <PageHeading title="Dependencies" description="Monitor your infrastructure dependencies and service relationships in real-time." actionsAlign="top" variant="detail">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><RefreshCw size={15} />Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Download size={15} />Export CSV</Button>
          <Button size="sm" onClick={() => toast("Add Dependency is a mockup action.")} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Plus size={15} />Add Dependency</Button>
        </div>
      </PageHeading>

      <section aria-label="Dependency metrics" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[82px]" labelClassName="text-[12px]" valueClassName="text-[24px]" trendClassName="text-[11px]" />)}
      </section>

      <section aria-label="Dependency health overview" className="grid gap-2.5 md:grid-cols-[1fr_1.38fr_1fr]">
        <Panel title="Dependency Health Distribution" className="min-w-0">
          <DependencyDonut data={healthSlices} />
        </Panel>
        <Panel title="Dependency Health Over Time" range="24h" className="min-w-0">
          <div className="h-[160px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={healthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
                <Line dataKey="healthy" name="Healthy" type="monotone" stroke="#27ad5a" strokeWidth={1.7} dot={{ r: 1.5 }} />
                <Line dataKey="warning" name="Warning" type="monotone" stroke="#f28a13" strokeWidth={1.7} dot={{ r: 1.5 }} />
                <Line dataKey="critical" name="Critical" type="monotone" stroke="#ed3346" strokeWidth={1.7} dot={{ r: 1.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1 text-[12px] text-muted-foreground">
            {[["Healthy", "#27ad5a"], ["Warning", "#f28a13"], ["Critical", "#ed3346"]].map(([label, color]) => <span key={label} className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}
          </div>
        </Panel>
        <Panel title="Dependency Type" className="min-w-0">
          <DependencyDonut data={dependencyTypes} />
        </Panel>
      </section>

      <section aria-label="Dependencies and response times" className="grid items-stretch gap-2.5 md:grid-cols-[2.1fr_1fr]">
        <Panel title="Dependencies" className="flex h-full min-w-0 flex-col" action={<span className="text-[12px] text-muted-foreground">Updated {updatedAt}</span>}>
          <div className="min-h-0 flex-1 overflow-auto pt-1">
            <table className="w-full min-w-[1040px] text-left text-[12px]">
              <colgroup>
                {[24, 10, 14, 15, 9, 9, 10, 6, 3].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
              </colgroup>
              <thead><tr className="border-b border-border text-muted-foreground">{["Dependency Name", "Type", "Parent Service", "Dependency", "Status", "Health", "Response Time", "Uptime", "Actions"].map((heading) => <th key={heading} className="overflow-hidden text-ellipsis whitespace-nowrap px-2 pb-2 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>
                {dependencies.map((item) => (
                  <tr key={item.name} className="border-b border-border/70 last:border-0">
                    <td title={item.name} className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2.5 font-semibold text-foreground"><Link2 size={12} className={`mr-1.5 inline ${statusColor[item.status]}`} />{item.name}</td>
                    <td title={item.type} className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2.5 text-foreground">{item.type}</td>
                    <td title={item.parent} className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2.5 text-foreground">{item.parent}</td>
                    <td title={item.target} className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2.5 text-foreground">{item.target}</td>
                    <td className="overflow-hidden px-2 py-2.5"><span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${statusClass[item.status]}`}>{item.status}</span></td>
                    <td className="overflow-hidden px-2 py-2.5"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-semibold ${statusColor[item.status]}`}><i className={`h-2 w-2 shrink-0 rounded-full ${item.status === "Healthy" ? "bg-emerald-500" : item.status === "Warning" ? "bg-amber-500" : "bg-rose-500"}`} />{item.status}</span></td>
                    <td className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2.5 text-foreground">{item.response}</td>
                    <td className="overflow-hidden text-ellipsis whitespace-nowrap px-2 py-2.5 text-foreground">{item.uptime}</td>
                    <td className="overflow-hidden px-2 py-2.5"><button aria-label={`Actions for ${item.name}`} onClick={() => toast(`Actions for ${item.name} are a mockup action.`)} className="rounded px-1 text-muted-foreground hover:bg-accent">⋮</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-[12px] text-muted-foreground">
            <span>Showing {rangeStart}-{rangeEnd} of {totalDependencyCount} dependencies</span>
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select aria-label="Rows per page" value={pageSize} onChange={(event) => setPageSize(event.target.value)} className="h-8 rounded border border-border bg-card px-2 text-[12px] text-foreground">
                {["10", "20", "50"].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <button aria-label="Previous page" disabled className="rounded px-1.5 py-1 hover:bg-accent disabled:opacity-40">‹</button>
              {[1, 2, 3, 4, 5].map((page) => <button key={page} aria-label={`Go to page ${page}`} onClick={() => toast(`Page ${page} is a mockup action.`)} className={`rounded px-1.5 py-1 ${page === 1 ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{page}</button>)}
              <span>…</span>
              <button aria-label="Go to last page" onClick={() => toast("Last page is a mockup action.")} className="rounded px-1.5 py-1 hover:bg-accent">13</button>
              <button aria-label="Next page" onClick={() => toast("Next page is a mockup action.")} className="rounded px-1.5 py-1 hover:bg-accent">›</button>
            </div>
          </div>
        </Panel>

        <Panel title="Top Dependencies by Response Time" className="flex h-full min-w-0 flex-col" action={<button onClick={() => toast("Showing all dependencies by response time.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="min-h-0 flex-1 overflow-auto pt-1">
            <table className="w-full min-w-[320px] table-fixed text-left text-[12px]">
              <colgroup><col className="w-[52%]" /><col className="w-[24%]" /><col className="w-[24%]" /></colgroup>
              <thead><tr className="border-b border-border text-muted-foreground"><th className="pb-1.5">Dependency</th><th className="pb-1.5">Type</th><th className="whitespace-nowrap pb-1.5 text-right">Response Time</th></tr></thead>
              <tbody>
                {topDependenciesByResponseTime.map((item) => {
                  const isSlow = item.responseMs >= 300;
                  const tone = isSlow ? "text-amber-600" : "text-emerald-600";
                  return (
                    <tr key={item.name} className="border-b border-border/70 last:border-0">
                      <td className="overflow-hidden py-[9px] font-semibold text-foreground"><span className="block truncate whitespace-nowrap" title={item.name}><span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${isSlow ? "bg-amber-500" : "bg-emerald-500"}`} />{item.name}</span></td>
                      <td className="overflow-hidden py-[9px] text-foreground"><span className="block truncate whitespace-nowrap" title={item.type}>{item.type}</span></td>
                      <td className={`whitespace-nowrap py-[9px] text-right font-semibold ${tone}`}>{item.responseMs} ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section aria-label="Dependency breakdown" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="Dependencies by Status" className="flex h-full min-w-0 flex-col">
          <div className="flex flex-1 items-center justify-center">
            <DependencyDonut data={healthSlices} size="small" />
          </div>
        </Panel>
        <Panel title="Dependencies by Type" className="min-w-0">
          <DistributionRows items={dependencyTypes.map((item) => ({ name: item.name, count: item.value, width: `${item.value / 42 * 100}%`, color: item.color }))} />
        </Panel>
        <Panel title="Top Parent Services" className="min-w-0" action={<button onClick={() => toast("Showing all parent services.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <DistributionRows items={topParents} />
        </Panel>
        <Panel title="Recent Events" className="min-w-0" action={<button onClick={() => toast("Showing all dependency events.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="space-y-2.5 pt-1.5">
            {events.map((event) => <div key={event.text} className="grid grid-cols-[8px_minmax(0,1fr)_48px] items-center gap-2 text-[12px]"><i className={`h-2 w-2 rounded-full ${event.color}`} /><span className="truncate font-semibold text-foreground">{event.text}</span><span className="text-right text-muted-foreground">{event.ago}</span></div>)}
          </div>
        </Panel>
      </section>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
