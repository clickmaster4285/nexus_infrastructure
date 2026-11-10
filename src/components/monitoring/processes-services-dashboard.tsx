"use client";

import { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Download, Plus, Settings2 } from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { MetricStat } from "@/data/mock/dashboard";

const stats: MetricStat[] = [
  { label: "Total Processes", value: "2,548", change: "5.4%", trend: "up", tone: "blue", icon: "activity", detail: "vs last 24 hours" },
  { label: "Running Processes", value: "2,214", change: "4.7%", trend: "up", tone: "green", icon: "online", detail: "vs last 24 hours" },
  { label: "Stopped Processes", value: "334", change: "3.2%", trend: "down", tone: "red", icon: "offline", detail: "vs last 24 hours" },
  { label: "Total Services", value: "398", change: "3.6%", trend: "up", tone: "purple", icon: "settings-2", detail: "vs last 24 hours" },
  { label: "Running Services", value: "368", change: "2.9%", trend: "up", tone: "green", icon: "online", detail: "vs last 24 hours" },
  { label: "Failed Services", value: "30", change: "6.3%", trend: "down", tone: "red", icon: "offline", detail: "vs last 24 hours" },
];

const times = ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00"];
const cpuHistory = times.map((time, index) => ({ time, system: [68, 72, 65, 75, 67, 74, 69, 73, 71, 76, 68, 74, 72][index], user: [42, 48, 39, 51, 43, 49, 40, 46, 42, 50, 41, 47, 45][index], ioWait: [14, 17, 12, 19, 13, 16, 11, 15, 13, 18, 12, 16, 14][index], others: [8, 10, 7, 12, 9, 11, 6, 9, 8, 12, 7, 10, 8][index] }));
const memoryHistory = times.map((time, index) => ({ time, used: [72, 74, 76, 73, 78, 75, 77, 74, 76, 79, 75, 77, 74][index], cached: [43, 44, 45, 42, 46, 44, 45, 43, 44, 47, 43, 45, 44][index], buffers: [22, 23, 24, 22, 25, 23, 24, 22, 23, 26, 22, 24, 23][index], free: [17, 16, 15, 18, 14, 16, 15, 17, 16, 13, 17, 15, 16][index] }));
const processCountHistory = times.map((time, index) => ({ time, total: [2420, 2480, 2440, 2570, 2490, 2520, 2460, 2550, 2500, 2580, 2510, 2560, 2548][index], running: [1280, 1310, 1270, 1370, 1320, 1350, 1290, 1370, 1340, 1390, 1330, 1370, 1360][index], stopped: [90, 110, 95, 120, 100, 115, 98, 122, 105, 125, 108, 121, 112][index] }));

const cpuProcesses = [
  { name: "node", server: "app-server-02", cpu: "32.6%", memory: "8.4%", user: "node", pid: "24567" },
  { name: "java", server: "app-server-01", cpu: "21.8%", memory: "12.6%", user: "java", pid: "18765" },
  { name: "nginx", server: "web-01", cpu: "12.4%", memory: "4.1%", user: "www-data", pid: "1234" },
  { name: "postgres", server: "db-01", cpu: "9.7%", memory: "15.3%", user: "postgres", pid: "2233" },
  { name: "python", server: "worker-01", cpu: "6.3%", memory: "3.8%", user: "ubuntu", pid: "3345" },
];

const memoryProcesses = [
  { name: "java", server: "app-server-01", memory: "12.6%", cpu: "21.8%", user: "java" },
  { name: "postgres", server: "db-01", memory: "15.3%", cpu: "9.7%", user: "postgres" },
  { name: "node", server: "app-server-02", memory: "8.4%", cpu: "32.6%", user: "node" },
  { name: "mysqld", server: "db-02", memory: "7.6%", cpu: "7.2%", user: "mysql" },
  { name: "redis-server", server: "cache-01", memory: "5.9%", cpu: "4.1%", user: "redis" },
];

const serviceStates = [
  { name: "Running", value: 368, percent: "92.5%", color: "#35b879" },
  { name: "Failed", value: 30, percent: "7.5%", color: "#ed3346" },
  { name: "Stopped", value: 0, percent: "0%", color: "#f39a12" },
  { name: "Unknown", value: 0, percent: "0%", color: "#9aa9be" },
];

const startupStates = [
  { name: "Automatic", value: 276, percent: "69.3%", color: "#35b879" },
  { name: "Manual", value: 102, percent: "25.6%", color: "#f39a12" },
  { name: "Disabled", value: 20, percent: "5.0%", color: "#2878ed" },
];

const topCpuServices = [
  { name: "nginx", value: "18.7%", width: "100%", color: "#2878ed" }, { name: "Elasticsearch", value: "12.4%", width: "66%", color: "#35b879" },
  { name: "Prometheus", value: "8.6%", width: "46%", color: "#8a45df" }, { name: "Docker Engine", value: "6.3%", width: "34%", color: "#f39a12" },
  { name: "Redis Server", value: "4.1%", width: "22%", color: "#06b6d4" },
];
const topMemoryServices = [
  { name: "PostgreSQL", value: "15.3%", width: "100%", color: "#8a45df" }, { name: "Elasticsearch", value: "11.8%", width: "77%", color: "#f39a12" },
  { name: "MySQL", value: "9.6%", width: "63%", color: "#06b6d4" }, { name: "MongoDB", value: "7.8%", width: "51%", color: "#2878ed" },
  { name: "Redis Server", value: "5.9%", width: "39%", color: "#35b879" },
];
const servicesByHost = [
  { name: "app-server-01", value: 78, width: "100%", color: "#06b6d4" }, { name: "app-server-02", value: 74, width: "95%", color: "#8a45df" },
  { name: "web-01", value: 56, width: "72%", color: "#f39a12" }, { name: "db-01", value: 48, width: "62%", color: "#35b879" },
  { name: "worker-01", value: 42, width: "54%", color: "#2878ed" },
];

const alerts = [
  { alert: "Service failed", type: "Service", server: "app-server-02", process: "nginx", severity: "Critical", message: "NGINX service has stopped unexpectedly", time: "2m ago" },
  { alert: "High CPU usage", type: "Process", server: "app-server-01", process: "java (PID: 18765)", severity: "Warning", message: "CPU usage is 85% which is above the threshold (80%)", time: "7m ago" },
  { alert: "High memory usage", type: "Process", server: "db-01", process: "postgres (PID: 2233)", severity: "Warning", message: "Memory usage is 90% which is above the threshold (85%)", time: "12m ago" },
  { alert: "Service restarted", type: "Service", server: "web-01", process: "apache2", severity: "Info", message: "Apache2 service restarted successfully", time: "18m ago" },
  { alert: "Process not responding", type: "Process", server: "worker-01", process: "python (PID: 3345)", severity: "Warning", message: "Process is not responding for more than 60 seconds", time: "24m ago" },
];

const severityStyles: Record<string, string> = {
  Critical: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  Warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

function TrendChart({
  data,
  lines,
  max = 100,
  ticks = [0, 25, 50, 75, 100],
  area = false,
  bar = false,
}: {
  data: Record<string, string | number>[];
  lines: { key: string; name: string; color: string }[];
  max?: number;
  ticks?: number[];
  area?: boolean;
  bar?: boolean;
}) {
  return (
    <div className="h-[165px] w-full pt-1">
      <ResponsiveContainer width="100%" height="100%">
        {bar ? (
          <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical />
            <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis width={42} domain={[0, max]} ticks={ticks} tickFormatter={(value) => `${value / 1000}K`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
            {lines.map((line) => <Bar key={line.key} dataKey={line.key} name={line.name} fill={line.color} radius={[3, 3, 0, 0]} maxBarSize={14} />)}
          </BarChart>
        ) : area ? (
          <AreaChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical />
            <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis width={42} domain={[0, max]} ticks={ticks} tickFormatter={(value) => max === 3000 ? `${value / 1000}K` : `${value}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
            {lines.map((line) => <Area key={line.key} dataKey={line.key} name={line.name} type="monotone" stroke={line.color} strokeWidth={1.3} fill={line.color} fillOpacity={0.06} dot={false} />)}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical />
            <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis width={42} domain={[0, max]} ticks={ticks} tickFormatter={(value) => max === 3000 ? `${value / 1000}K` : `${value}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
            {lines.map((line) => <Line key={line.key} dataKey={line.key} name={line.name} type="monotone" stroke={line.color} strokeWidth={1.3} dot={{ r: 1.3 }} />)}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function Donut({ data, total, label = "Total", featured = false }: { data: { name: string; value: number; percent: string; color: string }[]; total: number; label?: string; featured?: boolean }) {
  return (
      <div className={`flex items-center ${featured ? "h-[164px] justify-center gap-5" : "h-[130px] gap-2.5"}`}>
      <div className={`relative shrink-0 ${featured ? "h-[148px] w-[48%] max-w-[180px]" : "h-[116px] w-[43%]"}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={data.filter((item) => item.value > 0)} dataKey="value" innerRadius="60%" outerRadius={featured ? "92%" : "88%"} paddingAngle={1} stroke="none">{data.filter((item) => item.value > 0).map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className={`font-display font-extrabold leading-tight text-foreground ${featured ? "text-[24px]" : "text-[20px]"}`}>{total}</b><span className="text-[12px] text-muted-foreground">{label}</span></div>
      </div>
      <div className={`min-w-0 flex-1 ${featured ? "space-y-3" : "space-y-2.5"}`}>
        {data.map((item) => <div key={item.name} className={`grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-1.5 ${featured ? "text-[13px]" : "text-[12px]"}`}><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate text-foreground">{item.name}</span><b className="whitespace-nowrap text-foreground">{item.value} ({item.percent})</b></div>)}
      </div>
    </div>
  );
}

function UsageRows({ items }: { items: { name: string; value: string; width: string; color: string }[] }) {
  return <div className="space-y-3 pt-2">{items.map((item) => <div key={item.name} className="grid grid-cols-[minmax(0,1fr)_minmax(40px,1.3fr)_42px] items-center gap-2 text-[12px]"><span className="truncate text-foreground">{item.name}</span><div className="h-[7px] rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: item.width, backgroundColor: item.color }} /></div><b className="text-right text-foreground">{item.value}</b></div>)}</div>;
}

export function ProcessesServicesDashboard() {
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState("24H");
  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const exportCsv = () => {
    const header = ["Alert", "Type", "Server", "Process / Service", "Severity", "Message", "Time"];
    const rows = alerts.map((item) => [item.alert, item.type, item.server, item.process, item.severity, item.message, item.time]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "processes-services-alerts.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast("Processes and services report exported.");
  };
  const timeAction = (
    <div className="flex items-center gap-0.5">
      {["1H", "6H", "12H", "24H"].map((item) => <button key={item} onClick={() => setPeriod(item)} className={`rounded px-1.5 py-1 text-[11px] font-semibold ${period === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{item}</button>)}
    </div>
  );

  return (
    <div className="space-y-2.5 pb-3">
      <PageMeta breadcrumbs={["Monitoring", "Processes & Services"]} showRefresh={false} variant="detail" />
      <PageHeading title="Processes & Services" description="Monitor all running processes and services across your infrastructure in real-time." icon={<Settings2 size={19} />} actionsAlign="top" variant="detail">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Download size={15} />Export CSV</Button>
          <Button size="sm" onClick={() => toast("Add Widget is a mockup action.")} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Plus size={15} />Add Widget</Button>
        </div>
      </PageHeading>

      <section aria-label="Process and service summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[100px]" labelClassName="text-[12px] leading-4" valueClassName="text-[24px] leading-7" trendClassName="text-[11px] leading-4" />)}
      </section>

      <section aria-label="Process trends" className="grid gap-2.5 xl:grid-cols-3">
        <Panel title="CPU Usage by Processes" className="min-w-0" action={timeAction}>
          <TrendChart data={cpuHistory} lines={[{ key: "system", name: "System", color: "#2878ed" }, { key: "user", name: "User", color: "#35b879" }, { key: "ioWait", name: "IO Wait", color: "#8a45df" }, { key: "others", name: "Others", color: "#f39a12" }]} />
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-[12px] text-muted-foreground">{[["System", "#2878ed"], ["User", "#35b879"], ["IO Wait", "#8a45df"], ["Others", "#f39a12"]].map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>
        </Panel>
        <Panel title="Memory Usage by Processes" className="min-w-0" action={timeAction}>
          <TrendChart data={memoryHistory} lines={[{ key: "used", name: "Used", color: "#2878ed" }, { key: "cached", name: "Cached", color: "#35b879" }, { key: "buffers", name: "Buffers", color: "#8a45df" }, { key: "free", name: "Free", color: "#f39a12" }]} area />
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-[12px] text-muted-foreground">{[["Used", "#2878ed"], ["Cached", "#35b879"], ["Buffers", "#8a45df"], ["Free", "#f39a12"]].map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>
        </Panel>
        <Panel title="Processes Count Over Time" className="min-w-0" action={timeAction}>
          <TrendChart data={processCountHistory} max={3000} ticks={[0, 1000, 2000, 3000]} lines={[{ key: "total", name: "Total Processes", color: "#2878ed" }, { key: "running", name: "Running", color: "#35b879" }, { key: "stopped", name: "Stopped", color: "#ed3346" }]} bar />
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-[12px] text-muted-foreground">{[["Total Processes", "#2878ed"], ["Running", "#35b879"], ["Stopped", "#ed3346"]].map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>
        </Panel>
      </section>

      <section aria-label="Top processes and service health" className="grid gap-2.5 xl:grid-cols-[1.08fr_1.08fr_0.9fr]">
        <Panel title="Top Processes by CPU Usage" className="min-w-0" action={<button onClick={() => toast("Showing all processes by CPU.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[620px] text-left text-[12px]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Process Name", "Server", "CPU %", "Memory %", "User", "PID", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{cpuProcesses.map((item) => <tr key={item.pid} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1 py-[5px] font-semibold text-foreground">{item.name}</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{item.server}</td><td className="px-1 py-[5px] text-foreground">{item.cpu}</td><td className="px-1 py-[5px] text-foreground">{item.memory}</td><td className="px-1 py-[5px] text-foreground">{item.user}</td><td className="px-1 py-[5px] text-foreground">{item.pid}</td><td className="px-1 py-[5px]"><span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Running</span></td></tr>)}</tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Top Processes by Memory Usage" className="min-w-0" action={<button onClick={() => toast("Showing all processes by memory usage.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[560px] text-left text-[12px]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Process Name", "Server", "Memory %", "CPU %", "User", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{memoryProcesses.map((item) => <tr key={`${item.name}-${item.server}`} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1 py-[5px] font-semibold text-foreground">{item.name}</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{item.server}</td><td className="px-1 py-[5px] text-foreground">{item.memory}</td><td className="px-1 py-[5px] text-foreground">{item.cpu}</td><td className="px-1 py-[5px] text-foreground">{item.user}</td><td className="px-1 py-[5px]"><span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Running</span></td></tr>)}</tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Service Health Overview" className="min-w-0"><Donut data={serviceStates} total={398} label="Total Services" featured /></Panel>
      </section>

      <section aria-label="Service breakdown" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <Panel title="Services by Status" className="min-w-0"><Donut data={serviceStates} total={398} /></Panel>
        <Panel title="Services by Startup Type" className="min-w-0"><Donut data={startupStates} total={398} /></Panel>
        <Panel title="Top Services by CPU Usage" className="min-w-0" action={<button onClick={() => toast("Showing all services by CPU usage.")} className="text-[12px] font-semibold text-primary">View All →</button>}><UsageRows items={topCpuServices} /></Panel>
        <Panel title="Top Services by Memory Usage" className="min-w-0" action={<button onClick={() => toast("Showing all services by memory usage.")} className="text-[12px] font-semibold text-primary">View All →</button>}><UsageRows items={topMemoryServices} /></Panel>
        <Panel title="Services by Host" className="min-w-0" action={<button onClick={() => toast("Showing services on all hosts.")} className="text-[12px] font-semibold text-primary">View All →</button>}><UsageRows items={servicesByHost.map((item) => ({ ...item, value: String(item.value) }))} /></Panel>
      </section>

      <Panel title="Recent Process & Service Alerts" className="min-w-0" action={<button onClick={() => toast("Showing all process and service alerts.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
        <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[960px] text-left text-[12px]">
            <thead><tr className="border-b border-border text-muted-foreground">{["Alert", "Type", "Server", "Process / Service", "Severity", "Message", "Time"].map((heading) => <th key={heading} className="whitespace-nowrap px-1.5 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
            <tbody>{alerts.map((item) => <tr key={item.alert} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1.5 py-[6px] font-semibold text-foreground"><i className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${item.severity === "Critical" ? "bg-rose-500" : item.severity === "Warning" ? "bg-amber-500" : "bg-blue-500"}`} />{item.alert}</td><td className="px-1.5 py-[6px] text-foreground">{item.type}</td><td className="whitespace-nowrap px-1.5 py-[6px] text-foreground">{item.server}</td><td className="whitespace-nowrap px-1.5 py-[6px] text-foreground">{item.process}</td><td className="px-1.5 py-[6px]"><span className={`rounded-full px-2 py-0.5 text-[11px] ${severityStyles[item.severity]}`}>{item.severity}</span></td><td className="px-1.5 py-[6px] text-foreground">{item.message}</td><td className="whitespace-nowrap px-1.5 py-[6px] text-muted-foreground">{item.time}</td></tr>)}</tbody>
          </table>
        </div>
      </Panel>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
