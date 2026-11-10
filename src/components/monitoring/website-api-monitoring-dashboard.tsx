"use client";

import { useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Bell, Check, Download, Globe, Plus, Rocket,
} from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { MetricStat } from "@/data/mock/dashboard";

const stats: MetricStat[] = [
  { label: "Total Monitors", value: "24", change: "2 new", trend: "up", tone: "blue", icon: "globe-2" },
  { label: "Healthy", value: "22", change: "91.7%", trend: "flat", tone: "green", icon: "online" },
  { label: "Issues", value: "2", change: "8.3%", trend: "down", tone: "red", icon: "octagon-alert" },
  { label: "Avg Response Time", value: "245 ms", change: "12.4%", trend: "down", tone: "blue", icon: "activity" },
  { label: "Uptime", value: "99.95%", change: "0.01%", trend: "up", tone: "green", icon: "shield-check" },
  { label: "Total Checks", value: "48,320", change: "12.5%", trend: "up", tone: "purple", icon: "pulse" },
];

const times = ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00"];
const performance = times.map((time, index) => ({
  time,
  response: [218, 234, 252, 237, 261, 249, 272, 255, 287, 244, 230, 251, 245][index],
  availability: [98.6, 98.8, 99.1, 98.7, 99.3, 99.2, 99.4, 99.1, 99.8, 99.2, 98.9, 99.1, 99.3][index],
}));

const endpointRows = [
  { endpoint: "/api/users", status: "Healthy", response: "132 ms", uptime: "99.99%", values: [9, 12, 10, 14, 11, 13, 9, 12, 10, 13] },
  { endpoint: "/api/products", status: "Healthy", response: "178 ms", uptime: "99.97%", values: [12, 10, 13, 11, 15, 12, 9, 12, 11, 13] },
  { endpoint: "/api/orders", status: "Down", response: "—", uptime: "0.00%", values: [15, 15, 14, 15, 15, 8, 8, 8, 8, 8] },
  { endpoint: "/api/payments", status: "Healthy", response: "205 ms", uptime: "99.98%", values: [11, 12, 14, 11, 13, 10, 12, 14, 11, 13] },
  { endpoint: "/api/notifications", status: "Healthy", response: "167 ms", uptime: "99.96%", values: [10, 13, 11, 12, 9, 12, 14, 10, 13, 11] },
];

const serviceHealth = [
  { label: "Web Apps", value: 98.7, color: "#20b77a" },
  { label: "APIs", value: 99.2, color: "#20b77a" },
  { label: "Databases", value: 97.9, color: "#20b77a" },
  { label: "Infrastructure", value: 99.1, color: "#20b77a" },
];

const topServices = [
  { name: "Web API", value: "99.9%", width: "99.9%" },
  { name: "Payment API", value: "99.7%", width: "99.7%" },
  { name: "User Service", value: "99.5%", width: "99.5%" },
  { name: "Database", value: "99.3%", width: "99.3%" },
  { name: "Notification API", value: "99.1%", width: "99.1%" },
];

const events = [
  { time: "12:32 PM", type: "API Down", color: "red", message: "/api/orders is not responding", status: "Open" },
  { time: "11:45 AM", type: "Recovery", color: "blue", message: "/api/orders is back online", status: "Resolved" },
  { time: "10:20 AM", type: "High Latency", color: "amber", message: "Response time is 845ms", status: "Investigating" },
  { time: "09:50 AM", type: "New Monitor", color: "blue", message: "Added new endpoint /api/reports", status: "Info" },
];

const responseDistribution = [
  { label: "< 100ms", value: 42, color: "#2878ed" },
  { label: "100-300ms", value: 33, color: "#22c55e" },
  { label: "300-500ms", value: 15, color: "#39aee8" },
  { label: "> 500ms", value: 8, color: "#8b5cf6" },
];

const statusClass: Record<string, string> = {
  Open: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  Resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Investigating: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

function PerformanceChart({ period }: { period: string }) {
  return (
    <div className="h-[144px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={performance} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical />
          <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 8 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" domain={[0, 400]} ticks={[0, 100, 200, 300, 400]} tickFormatter={(value) => `${value}ms`} tick={{ fill: "var(--muted-foreground)", fontSize: 8 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" domain={[95, 100]} hide />
          <Tooltip labelFormatter={(label) => `${label} · ${period}`} contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 10, background: "var(--popover)" }} />
          <Line yAxisId="left" dataKey="response" name="Response Time (ms)" type="monotone" stroke="#2878ed" strokeWidth={1.8} dot={{ r: 1.8, fill: "#2878ed" }} activeDot={{ r: 3 }} />
          <Line yAxisId="right" dataKey="availability" name="Availability (%)" type="monotone" stroke="#20b77a" strokeWidth={1.8} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Sparkline({ values, down = false }: { values: number[]; down?: boolean }) {
  const data = values.map((value, index) => ({ index, value }));
  const color = down ? "#ef4444" : "#20b77a";
  return (
    <div className="h-[22px] w-[64px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line dataKey="value" type="monotone" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function HealthGauge({ label, value, color }: { label: string; value: number; color: string }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <div className="relative h-[70px] w-[70px]">
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90" aria-label={`${label} availability ${value}%`}>
          <circle cx="36" cy="36" r={radius} fill="none" stroke="var(--muted)" strokeWidth="5" />
          <circle cx="36" cy="36" r={radius} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-display text-[13px] font-extrabold text-foreground">{value}%</div>
      </div>
      <span className="truncate text-[8px] font-semibold text-foreground">{label}</span>
    </div>
  );
}

function TopServices() {
  return (
    <div className="space-y-[9px] pt-1">
      {topServices.map((service) => (
        <div key={service.name} className="grid grid-cols-[84px_minmax(0,1fr)_34px] items-center gap-2 text-[8px]">
          <span className="truncate font-medium text-foreground">{service.name}</span>
          <div className="h-[6px] rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: service.width }} /></div>
          <b className="text-right text-foreground">{service.value}</b>
        </div>
      ))}
    </div>
  );
}

function AvailabilityMap() {
  const markers = [
    { x: 16, y: 38, state: "online" }, { x: 21, y: 52, state: "online" }, { x: 30, y: 45, state: "online" },
    { x: 48, y: 35, state: "online" }, { x: 53, y: 48, state: "online" }, { x: 56, y: 30, state: "online" },
    { x: 65, y: 45, state: "online" }, { x: 72, y: 54, state: "warning" }, { x: 79, y: 59, state: "online" },
    { x: 88, y: 71, state: "online" },
  ];
  return (
    <div className="relative h-[111px] min-w-0">
      <svg viewBox="0 0 100 80" className="absolute inset-0 h-full w-full" aria-label="World map showing monitored service locations">
        <g fill="#dbe7f4" stroke="#fff" strokeWidth=".45">
          <path d="M5 20 12 13 22 11 29 16 28 22 33 26 29 31 25 32 23 39 19 44 14 42 13 36 9 33 11 28 7 26Z" />
          <path d="m27 43 7 3 4 8-2 10-4 8-3-7-2-9-4-7Z" />
          <path d="m43 20 4-5 9-2 4 3 9-1 6 4 8 1 4 4 9 2 2 4-5 3-7-2-4 4-6-2-4 7-5 2-1 6-5 3-4-4-6 2-4-5-7 1-3-5-7-2 1-8 5-2 4-7Z" />
          <path d="m52 47 7-3 7 2 5 7-4 8-5 5-6-2-3-7-4-4Z" />
          <path d="m76 58 6-2 8 4 4 6-4 6-6-2-5-5Z" />
          <path d="m44 15 3-3 4 1-1 3Z" />
        </g>
        {markers.map((marker, index) => <circle key={index} cx={marker.x} cy={marker.y} r="1.7" fill={marker.state === "warning" ? "#f59e0b" : "#20b77a"} stroke="#fff" strokeWidth=".8" />)}
      </svg>
      <div className="absolute bottom-1 right-0 flex flex-col gap-1 text-[7px] font-semibold text-foreground">
        <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Online <b>22</b></span>
        <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-amber-500" />Warning <b>1</b></span>
        <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-rose-500" />Offline <b>1</b></span>
      </div>
    </div>
  );
}

export function WebsiteApiMonitoringDashboard() {
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState("24h");
  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const exportReport = () => {
    const header = ["Time", "Type", "Message", "Status"];
    const csvRows = events.map((event) => [event.time, event.type, event.message, event.status]);
    const csv = [header, ...csvRows].map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "website-api-monitoring-report.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify("Monitoring report exported.");
  };

  const periodControl = (
    <div className="flex items-center gap-0.5">
      {["1h", "6h", "12h", "24h"].map((item) => <button key={item} onClick={() => setPeriod(item)} className={`rounded px-1.5 py-1 text-[7px] font-semibold ${period === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{item}</button>)}
    </div>
  );

  return (
    <div className="space-y-2.5 pb-3">
      <PageMeta breadcrumbs={["Monitoring", "Websites & API Monitoring"]} showRefresh={false} />
      <PageHeading title="Websites & API Monitoring" description="Monitor your websites and APIs for performance, availability and response time." icon={<Globe size={19} />} actionsAlign="top">
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1.5 text-[8px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 sm:flex"><Check size={11} />All Systems Operational</span>
          <Button size="sm" onClick={() => notify("Add Monitor is a mockup action.")} className="h-7 gap-1.5 whitespace-nowrap px-2.5 text-[9px]"><Plus size={12} />Add Monitor</Button>
          <Button variant="outline" size="sm" onClick={exportReport} className="h-7 gap-1.5 whitespace-nowrap px-2.5 text-[9px]"><Download size={12} />Export Report</Button>
        </div>
      </PageHeading>

      <section aria-label="Website and API monitoring summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[70px] gap-2 p-2 sm:p-2.5" />)}
      </section>

      <section aria-label="Performance and endpoint status" className="grid gap-2.5 xl:grid-cols-[1.06fr_0.94fr]">
        <Panel title="Performance Overview" className="min-w-0" action={periodControl}>
          <div className="flex justify-center gap-4 pt-1 text-[8px] text-muted-foreground">
            <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-blue-500" />Response Time (ms)</span>
            <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Availability (%)</span>
          </div>
          <PerformanceChart period={period} />
        </Panel>

        <Panel title="API Endpoints Status" className="min-w-0" action={<button onClick={() => notify("Showing all API endpoints.")} className="text-[8px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[400px] text-left text-[8px]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Endpoint", "Status", "Response Time", "Uptime", "Trend"].map((title) => <th key={title} className="whitespace-nowrap px-1.5 pb-1.5 font-semibold">{title}</th>)}</tr></thead>
              <tbody>{endpointRows.map((row) => <tr key={row.endpoint} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1.5 py-[6px] font-medium text-foreground">{row.endpoint}</td><td className="whitespace-nowrap px-1.5 py-[6px]"><span className={`inline-flex items-center gap-1 font-semibold ${row.status === "Down" ? "text-rose-600" : "text-emerald-600"}`}><i className={`h-1.5 w-1.5 rounded-full ${row.status === "Down" ? "bg-rose-500" : "bg-emerald-500"}`} />{row.status}</span></td><td className="whitespace-nowrap px-1.5 py-[6px] text-foreground">{row.response}</td><td className="whitespace-nowrap px-1.5 py-[6px] text-foreground">{row.uptime}</td><td className="px-1.5 py-[2px]"><Sparkline values={row.values} down={row.status === "Down"} /></td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section aria-label="Service health and availability" className="grid gap-2.5 xl:grid-cols-[1.06fr_0.9fr_1fr]">
        <Panel title="Service Health" className="min-w-0" action={<button onClick={() => notify("Showing health details for all services.")} className="text-[8px] font-semibold text-primary">View All →</button>}>
          <div className="grid grid-cols-4 items-center gap-1 pt-3">
            {serviceHealth.map((service) => <HealthGauge key={service.label} {...service} />)}
          </div>
        </Panel>
        <Panel title="Top Monitored Services" className="min-w-0"><TopServices /></Panel>
        <Panel title="Global Availability" className="min-w-0" action={<Globe size={14} className="text-primary" />}>
          <AvailabilityMap />
        </Panel>
      </section>

      <section aria-label="Recent events and response times" className="grid gap-2.5 xl:grid-cols-[1.08fr_0.92fr_0.78fr]">
        <Panel title="Recent Events" className="min-w-0" action={<button onClick={() => notify("Showing all monitoring events.")} className="text-[8px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[350px] text-left text-[8px]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Time", "Type", "Message", "Status"].map((title) => <th key={title} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{title}</th>)}</tr></thead>
              <tbody>{events.map((event) => <tr key={event.time} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1 py-[6px] text-foreground">{event.time}</td><td className="whitespace-nowrap px-1 py-[6px]"><span className={`inline-flex items-center gap-1 font-semibold ${event.color === "red" ? "text-rose-600" : event.color === "amber" ? "text-amber-600" : "text-blue-600"}`}><i className={`h-1.5 w-1.5 rounded-full ${event.color === "red" ? "bg-rose-500" : event.color === "amber" ? "bg-amber-500" : "bg-blue-500"}`} />{event.type}</span></td><td className="px-1 py-[6px] text-foreground">{event.message}</td><td className="px-1 py-[6px]"><span className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[7px] ${statusClass[event.status]}`}>{event.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Response Time Distribution" className="min-w-0">
          <div className="flex h-[121px] items-end justify-around gap-3 border-b border-border px-2 pb-0">
            {responseDistribution.map((bucket) => <div key={bucket.label} className="flex h-full flex-1 flex-col items-center justify-end">
              <b className="mb-1 text-[9px] text-foreground">{bucket.value}%</b>
              <div className="w-full max-w-[48px] rounded-t-[4px]" style={{ height: `${bucket.value * 1.65}px`, backgroundColor: bucket.color }} />
              <span className="h-5 pt-1 text-center text-[7px] text-muted-foreground">{bucket.label}</span>
            </div>)}
          </div>
        </Panel>

        <div className="relative flex min-h-[150px] flex-col justify-center overflow-hidden rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 via-blue-50 to-emerald-50 p-4 dark:border-sky-900 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950">
          <div aria-hidden="true" className="absolute -bottom-8 -left-7 h-24 w-24 rounded-full bg-emerald-200/50 dark:bg-emerald-800/20" />
          <div aria-hidden="true" className="absolute -right-7 -top-8 h-28 w-28 rounded-full bg-sky-200/50 dark:bg-sky-800/20" />
          <Rocket size={32} className="relative mb-2 text-blue-500" />
          <h2 className="relative font-display text-[13px] font-extrabold leading-tight text-foreground">Keep Your Services Healthy</h2>
          <p className="relative mt-1 text-[8px] leading-relaxed text-muted-foreground">Get instant alerts and ensure maximum uptime for your APIs.</p>
          <Button size="sm" onClick={() => notify("Configure Alerts is a mockup action.")} className="relative mt-2 h-7 w-fit gap-1.5 px-2.5 text-[8px]"><Bell size={11} />Configure Alerts →</Button>
        </div>
      </section>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[10px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
