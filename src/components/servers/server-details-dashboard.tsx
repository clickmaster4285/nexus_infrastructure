"use client";

import { useState } from "react";
import {
  Activity, Bell, CheckCircle2, Cpu, Download, FileText, HardDrive,
  MemoryStick, Network, RotateCw, Server, Settings2, Terminal, Users,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { ServiceIcon } from "@/components/shared/icon";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

const diskUsage = 72;

const resourceMetrics = [
  { label: "CPU Usage", value: "32%", change: "↓ 8%", icon: Cpu, color: "#287cf0" },
  { label: "Memory Usage", value: "68%", change: "↓ 5%", icon: MemoryStick, color: "#a044f5" },
  { label: "Disk Usage", value: `${diskUsage}%`, change: "↑ 2%", icon: HardDrive, color: "#f59e0b" },
  { label: "Network", value: "12.4 Mbps", change: "↑ 18%", icon: Network, color: "#20b77a" },
  { label: "Uptime", value: "142d", change: "99.98%", icon: Activity, color: "#287cf0" },
];

const serverProfile = {
  operatingSystem: "Ubuntu 22.04 LTS",
  group: "Production Web",
  location: "Virginia, USA",
  provider: "Amazon Web Services",
  environment: "Production",
  uptime: "42d 6h",
  lastReboot: "Oct 29, 2026",
  cpuRam: "8 vCPU / 16 GB",
  lastChecked: "2m ago",
  usage: [
    { label: "CPU", value: 32 },
    { label: "Memory", value: 68 },
    { label: "Disk", value: diskUsage },
  ],
};

const serverProfileRows = [
  { label: "Operating System", value: serverProfile.operatingSystem },
  { label: "Server Group", value: serverProfile.group },
  { label: "Location", value: serverProfile.location },
  { label: "Provider", value: serverProfile.provider },
  { label: "Environment", value: serverProfile.environment },
  { label: "Uptime", value: serverProfile.uptime },
  { label: "Last Reboot", value: serverProfile.lastReboot },
  { label: "CPU / RAM", value: serverProfile.cpuRam },
  { label: "Last Checked", value: serverProfile.lastChecked },
];

const performance = [
  { time: "00:00", cpu: 31, memory: 65 }, { time: "02:00", cpu: 33, memory: 66 },
  { time: "04:00", cpu: 35, memory: 66 }, { time: "06:00", cpu: 32, memory: 67 },
  { time: "08:00", cpu: 30, memory: 66 }, { time: "10:00", cpu: 34, memory: 67 },
  { time: "12:00", cpu: 37, memory: 66 }, { time: "14:00", cpu: 35, memory: 68 },
  { time: "16:00", cpu: 33, memory: 67 }, { time: "18:00", cpu: 31, memory: 68 },
  { time: "20:00", cpu: 30, memory: 67 }, { time: "22:00", cpu: 32, memory: 68 },
  { time: "24:00", cpu: 33, memory: 69 },
];

const traffic = [
  { time: "00:00", inbound: 52, outbound: 31 }, { time: "06:00", inbound: 58, outbound: 38 },
  { time: "12:00", inbound: 74, outbound: 42 }, { time: "18:00", inbound: 61, outbound: 39 },
  { time: "24:00", inbound: 48, outbound: 34 },
];

const services = [
  { name: "nginx", cpu: "1.2%", memory: "48 MB" },
  { name: "mysql", cpu: "4.8%", memory: "256 MB" },
  { name: "redis", cpu: "0.6%", memory: "64 MB" },
  { name: "docker", cpu: "0.9%", memory: "72 MB" },
  { name: "ssh", cpu: "0.2%", memory: "24 MB" },
];

const processes = [
  { name: "nginx", pid: 1842, user: "www-data", cpu: "18.2%", memory: "210 MB" },
  { name: "node", pid: 2316, user: "app", cpu: "12.5%", memory: "180 MB" },
  { name: "mysql", pid: 1088, user: "mysql", cpu: "8.7%", memory: "320 MB" },
  { name: "python", pid: 2671, user: "worker", cpu: "5.1%", memory: "120 MB" },
  { name: "docker", pid: 892, user: "root", cpu: "3.9%", memory: "98 MB" },
];

const diskHistory = [
  { time: "00:00", used: 68, free: 32 }, { time: "04:00", used: 69, free: 31 },
  { time: "08:00", used: 70, free: 30 }, { time: "12:00", used: 71, free: 29 },
  { time: "16:00", used: 70, free: 30 }, { time: "20:00", used: 72, free: 28 },
  { time: "24:00", used: 72, free: 28 },
];

const logs = [
  { time: "14:32:08", level: "INFO", message: "nginx: request completed status=200 duration=18ms" },
  { time: "14:31:52", level: "INFO", message: "systemd: Started container runtime" },
  { time: "14:30:17", level: "WARN", message: "node: memory usage reached 68%" },
  { time: "14:29:04", level: "INFO", message: "healthcheck: HTTPS endpoint responding in 34ms" },
  { time: "14:28:42", level: "INFO", message: "backup: snapshot verification completed" },
];

const events = [
  { time: "Apr 23, 14:20", type: "Info", message: "Scheduled backup completed successfully", status: "Success", tone: "bg-sky-500" },
  { time: "Apr 23, 12:15", type: "Warning", message: "High memory usage (82%)", status: "Resolved", tone: "bg-amber-500" },
  { time: "Apr 23, 09:10", type: "Info", message: "Service nginx restarted", status: "Success", tone: "bg-sky-500" },
  { time: "Apr 23, 06:45", type: "Critical", message: "Disk space reached 85%", status: "Resolved", tone: "bg-rose-500" },
];

const quickActions = [
  { label: "View Logs", icon: FileText }, { label: "Manage Services", icon: Settings2 },
  { label: "Restart Server", icon: RotateCw }, { label: "Update Agent", icon: Download },
  { label: "Create Alert Rule", icon: Bell }, { label: "Add to Group", icon: Users },
];

const memoryBreakdown = [
  { name: "Used", value: 68, color: "#20b77a" },
  { name: "Available", value: 32, color: "#dce8f5" },
];

const tabs = ["Performance", "Network", "Disk", "Processes", "Services", "Logs", "Events"];

function Panel({ title, children, action, className = "" }: { title: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <Card className={`flex min-w-0 flex-col p-4 ${className}`}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <CardTitle className="truncate text-[15px] font-semibold">{title}</CardTitle>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  );
}

function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
    {items.map((item) => <span key={item.label} className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.label}</span>)}
  </div>;
}

export function ServerDetailsDashboard() {
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState("Apr 23, 2025 14:32");
  const [activeTab, setActiveTab] = useState("Performance");
  const [timeRange, setTimeRange] = useState("24h");
  const [pinging, setPinging] = useState(false);

  const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const cpuValues = performance.map((point) => point.cpu);
  const memoryValues = performance.map((point) => point.memory);
  const inboundValues = traffic.map((point) => point.inbound);
  const outboundValues = traffic.map((point) => point.outbound);
  const cpuStats = `Avg CPU ${average(cpuValues)}% · Peak CPU ${Math.max(...cpuValues)}% · Avg Memory ${average(memoryValues)}% · Peak Memory ${Math.max(...memoryValues)}%`;
  const networkStats = `Avg In ${average(inboundValues)} Mbps · Avg Out ${average(outboundValues)} Mbps · Peak ${Math.max(...inboundValues)} Mbps`;

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  }

  function refresh() {
    setLastUpdated(new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }));
    showNotice("Server details refreshed.");
  }

  function pingServer() {
    setPinging(true);
    showNotice("Ping check completed · 12 ms");
    window.setTimeout(() => setPinging(false), 900);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 pb-3">
      <PageMeta breadcrumbs={["Infrastructure", "Server Details"]} variant="detail" lastUpdated={lastUpdated} actions={<span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 dark:text-emerald-300"><i className="h-2 w-2 rounded-full bg-emerald-500" />Online</span>} onRefresh={refresh} />
      <PageHeading title="Server Details" description="Complete information and performance details for this server" actionsAlign="top" variant="detail">
        <Button variant="outline" onClick={refresh} className="h-9 gap-2 px-3 text-[13px]"><RotateCw size={15} />Refresh</Button>
        <Button variant="outline" onClick={() => showNotice("Server report exported.")} className="h-9 gap-2 px-3 text-[13px]"><Download size={15} />Export</Button>
      </PageHeading>

      <section aria-label="Server summary" className="grid min-w-0 grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(230px,1.25fr)_minmax(0,4fr)]">
        <Card className="flex h-full min-w-0 flex-col p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><i className="h-2 w-2 rounded-full bg-emerald-500" />Online</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 size={12} />Healthy</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-blue-100 text-primary dark:bg-blue-950"><Server size={34} /></span>
            <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate font-display text-[22px] font-bold text-foreground">web-01</h2><button type="button" aria-label="Copy hostname" onClick={() => showNotice("Hostname copied.")} className="text-muted-foreground hover:text-primary"><FileText size={14} /></button></div><p className="mt-1 text-[11px] text-muted-foreground">IP Address</p><p className="text-[13px] font-semibold text-foreground">192.168.1.25</p><p className="truncate text-[11px] text-muted-foreground">web-01.example.com</p></div>
          </div>
          <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-border pt-2">
            <dl className="flex flex-1 flex-col justify-around divide-y divide-border/70 text-[12px]">
              {serverProfileRows.map(({ label, value }) => (
                <div key={label} className="flex min-h-[25px] items-center justify-between gap-3 py-1">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd title={value} className="m-0 min-w-0 truncate whitespace-nowrap text-right font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {serverProfile.usage.map(({ label, value }) => {
                const color = value < 70 ? "#20a875" : value <= 85 ? "#f59e0b" : "#dc4c56";
                return <div key={label} className="min-w-0 rounded-lg bg-[#F8F9FB] p-2.5 text-center dark:bg-slate-800/70"><div className="text-[11px] text-muted-foreground">{label}</div><div className="text-[16px] font-bold tabular-nums" style={{ color }}>{value}%</div></div>;
              })}
            </div>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-3">
            <Button size="sm" onClick={pingServer} disabled={pinging} className="h-9 gap-1.5 text-[12px]"><Activity size={14} />{pinging ? "Pinging…" : "Ping Server"}</Button>
            <Button size="sm" variant="outline" onClick={() => showNotice("Console session requested.")} className="h-9 gap-1.5 text-[12px]"><Terminal size={14} />Open Console</Button>
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-3">
        <div className="grid min-w-0 grid-cols-2 items-start gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {resourceMetrics.map(({ label, value, change, icon: Icon, color }) => (
            <Card key={label} className="flex h-[96px] min-w-0 items-center gap-2.5 p-3 sm:p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-100 dark:bg-blue-950" style={{ color }}><Icon size={19} /></span>
              <div className="min-w-0"><div className="truncate text-[12px] font-medium text-muted-foreground">{label}</div><div className="truncate font-display text-[20px] font-bold leading-tight text-foreground">{value}</div><div className="mt-1 text-[11px] font-medium" style={{ color: change.startsWith("↑") ? "#dc4c56" : "#20a875" }}>{change}</div></div>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-1.5">
          <nav aria-label="Server detail sections" className="flex min-w-0 flex-wrap gap-1">
            {tabs.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-md px-3 py-2 text-[12px] font-medium transition-colors ${activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>{tab}</button>)}
          </nav>
          <select aria-label="Performance time range" value={timeRange} onChange={(event) => setTimeRange(event.target.value)} className="h-9 shrink-0 rounded-md border border-input bg-card px-2.5 text-[12px] text-foreground"><option>1h</option><option>6h</option><option>12h</option><option>24h</option></select>
        </div>

        {activeTab === "Performance" && <div aria-label="Server performance charts" className="grid min-w-0 items-stretch gap-3 [align-items:stretch] xl:grid-cols-2">
        <Panel title="CPU & Memory Usage" action={<ChartLegend items={[{ label: "CPU Usage", color: "#287cf0" }, { label: "Memory Usage", color: "#a044f5" }]} />}>
          <div className="flex h-full min-h-[300px] min-w-0 flex-col">
          <div className="min-h-[260px] min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performance} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="serverCpuFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#287cf0" stopOpacity={0.2} /><stop offset="100%" stopColor="#287cf0" stopOpacity={0.015} /></linearGradient>
                  <linearGradient id="serverMemoryFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a044f5" stopOpacity={0.14} /><stop offset="100%" stopColor="#a044f5" stopOpacity={0.01} /></linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="time" ticks={["00:00", "06:00", "12:00", "18:00", "24:00"]} interval={0} tickMargin={8} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} width={40} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ stroke: "#94a3b8", strokeDasharray: "4 4" }} contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)", boxShadow: "0 8px 24px rgba(15, 35, 65, 0.12)" }} />
                <Area type="monotone" dataKey="memory" name="Memory Usage" stroke="#a044f5" strokeWidth={2.5} fill="url(#serverMemoryFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
                <Area type="monotone" dataKey="cpu" name="CPU Usage" stroke="#287cf0" strokeWidth={2.5} fill="url(#serverCpuFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 border-t border-border/70 pt-2 text-[12px] leading-5 text-muted-foreground">{cpuStats}</div>
          </div>
        </Panel>
        <Panel title="Network Traffic" action={<ChartLegend items={[{ label: "In", color: "#20b77a" }, { label: "Out", color: "#287cf0" }]} />}>
          <div className="flex h-full min-h-[300px] min-w-0 flex-col">
            <div className="relative min-h-[260px] min-w-0 flex-1"><span className="pointer-events-none absolute left-0 top-0 z-10 text-[10px] leading-4 text-muted-foreground">Mbps</span><ResponsiveContainer width="100%" height="100%"><AreaChart data={traffic} margin={{ top: 24, right: 20, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="time" ticks={["00:00", "06:00", "12:00", "18:00", "24:00"]} interval={0} tickMargin={8} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} /><YAxis domain={[0, 150]} ticks={[0, 50, 100, 150]} tickFormatter={(value) => `${value}`} width={38} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} /><Area dataKey="inbound" name="Inbound" stroke="#20b77a" strokeWidth={2} fill="#20b77a" fillOpacity={0.1} /><Area dataKey="outbound" name="Outbound" stroke="#287cf0" strokeWidth={2} fill="#287cf0" fillOpacity={0.1} /></AreaChart></ResponsiveContainer></div>
            <div className="mt-2 border-t border-border/70 pt-2 text-[12px] leading-5 text-muted-foreground">{networkStats}</div>
          </div>
        </Panel>
        </div>}
        {activeTab === "Network" && <div className="grid min-w-0 items-stretch gap-3 [align-items:stretch] xl:grid-cols-2">
          <Panel title="Network Traffic" action={<ChartLegend items={[{ label: "Inbound", color: "#20b77a" }, { label: "Outbound", color: "#287cf0" }]} />}>
            <div className="flex h-full min-h-[300px] min-w-0 flex-col"><div className="relative min-h-[260px] min-w-0 flex-1"><span className="pointer-events-none absolute left-0 top-0 z-10 text-[10px] leading-4 text-muted-foreground">Mbps</span><ResponsiveContainer width="100%" height="100%"><AreaChart data={traffic} margin={{ top: 24, right: 20, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="time" ticks={["00:00", "06:00", "12:00", "18:00", "24:00"]} interval={0} tickMargin={8} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} /><YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(value) => `${value}`} width={38} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} /><Area type="monotone" dataKey="inbound" name="Inbound" stroke="#20b77a" strokeWidth={2.5} fill="#20b77a" fillOpacity={0.12} /><Area type="monotone" dataKey="outbound" name="Outbound" stroke="#287cf0" strokeWidth={2.5} fill="#287cf0" fillOpacity={0.1} /></AreaChart></ResponsiveContainer></div><div className="mt-2 border-t border-border/70 pt-2 text-[12px] leading-5 text-muted-foreground">{networkStats}</div></div>
          </Panel>
          <Panel title="Network Interfaces">
            <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-[12px]"><thead><tr className="border-b border-border text-[11px] text-muted-foreground">{["Interface", "In", "Out", "Errors", "Status"].map((heading) => <th key={heading} className="px-3 pb-3 font-medium">{heading}</th>)}</tr></thead><tbody>{[{ name: "eth0", inbound: "42.6 Mbps", outbound: "28.9 Mbps", errors: "0" }, { name: "eth1", inbound: "8.4 Mbps", outbound: "5.2 Mbps", errors: "0" }, { name: "lo", inbound: "1.2 Mbps", outbound: "1.2 Mbps", errors: "0" }].map((row) => <tr key={row.name} className="h-12 border-b border-border/60 last:border-0"><td className="px-3 font-semibold text-foreground">{row.name}</td><td className="px-3 text-foreground">{row.inbound}</td><td className="px-3 text-foreground">{row.outbound}</td><td className="px-3 text-muted-foreground">{row.errors}</td><td className="px-3"><span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300"><i className="h-2 w-2 rounded-full bg-emerald-500" />Up</span></td></tr>)}</tbody></table></div>
          </Panel>
        </div>}
        {activeTab === "Disk" && <div className="grid min-w-0 items-stretch gap-3 xl:grid-cols-[1.4fr_1fr]">
          <Panel title="Disk Usage Over Time" action={<ChartLegend items={[{ label: "Used", color: "#f59e0b" }, { label: "Available", color: "#287cf0" }]} />}>
            <div className="h-[240px] min-w-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={diskHistory} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="time" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} /><YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} width={40} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} /><Area type="monotone" dataKey="used" name="Used" stroke="#f59e0b" strokeWidth={2.5} fill="#f59e0b" fillOpacity={0.14} /><Area type="monotone" dataKey="free" name="Available" stroke="#287cf0" strokeWidth={2} fill="#287cf0" fillOpacity={0.08} /></AreaChart></ResponsiveContainer></div>
          </Panel>
          <Panel title="Storage Volumes">
            <div className="space-y-5 pt-1">{[{ mount: "/", size: "80 GB", used: "42 GB", value: 53 }, { mount: "/var", size: "120 GB", used: "91 GB", value: 76 }, { mount: "/data", size: "500 GB", used: "360 GB", value: 72 }].map((volume) => <div key={volume.mount}><div className="mb-2 flex items-center justify-between text-[12px]"><span className="font-semibold text-foreground">{volume.mount} <span className="font-normal text-muted-foreground">· {volume.size}</span></span><span className="text-muted-foreground">{volume.used} used</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${volume.value >= 75 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${volume.value}%` }} /></div><div className="mt-1 text-right text-[11px] text-muted-foreground">{volume.value}% used</div></div>)}</div>
          </Panel>
        </div>}
        {activeTab === "Processes" && <Panel title="Top Processes" action={<span className="text-[11px] text-muted-foreground">Updated just now</span>}>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[12px]"><thead><tr className="border-b border-border text-[11px] text-muted-foreground">{["Process", "PID", "User", "CPU", "Memory", "Status"].map((heading) => <th key={heading} className="px-3 pb-3 font-medium">{heading}</th>)}</tr></thead><tbody>{processes.map((process) => <tr key={process.pid} className="h-11 border-b border-border/60 last:border-0"><td className="px-3 font-semibold text-foreground">{process.name}</td><td className="px-3 tabular-nums text-muted-foreground">{process.pid}</td><td className="px-3 text-muted-foreground">{process.user}</td><td className="px-3 font-medium text-foreground">{process.cpu}</td><td className="px-3 text-foreground">{process.memory}</td><td className="px-3"><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Running</span></td></tr>)}</tbody></table></div>
        </Panel>}
        {activeTab === "Services" && <Panel title="Services" action={<Button size="sm" onClick={() => showNotice("Service management opened.")} className="h-8 text-[11px]">Manage Services</Button>}>
          <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-[12px]"><thead><tr className="border-b border-border text-[11px] text-muted-foreground">{["Service", "Status", "Uptime", "CPU", "Memory", "Actions"].map((heading) => <th key={heading} className="px-3 pb-3 font-medium">{heading}</th>)}</tr></thead><tbody>{services.map((service, index) => <tr key={service.name} className="h-11 border-b border-border/60 last:border-0"><td className="px-3 font-semibold text-foreground"><span className="inline-flex items-center gap-2.5"><ServiceIcon name={service.name} />{service.name}</span></td><td className="px-3"><span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300"><i className="h-2 w-2 rounded-full bg-emerald-500" />Running</span></td><td className="px-3 text-muted-foreground">{index === 0 ? "42d 6h" : "142d 6h"}</td><td className="px-3 text-foreground">{service.cpu}</td><td className="px-3 text-foreground">{service.memory}</td><td className="px-3"><button type="button" onClick={() => showNotice(`Restart requested for ${service.name}.`)} className="text-[11px] font-semibold text-primary">Restart</button></td></tr>)}</tbody></table></div>
        </Panel>}
        {activeTab === "Logs" && <Panel title="Live Server Logs" action={<button type="button" onClick={() => showNotice("Log stream refreshed.")} className="text-[11px] font-semibold text-primary">Refresh logs</button>}>
          <div className="min-h-[240px] space-y-0.5 overflow-x-auto rounded-lg bg-[#101a2a] p-4 font-mono text-[12px] text-slate-200">{logs.map((log) => <div key={log.time} className="grid min-w-[580px] grid-cols-[80px_52px_1fr] gap-3 border-b border-white/5 py-2 last:border-0"><span className="text-slate-500">{log.time}</span><span className={log.level === "WARN" ? "font-bold text-amber-300" : "font-bold text-sky-300"}>{log.level}</span><span>{log.message}</span></div>)}</div>
        </Panel>}
        {activeTab === "Events" && <Panel title="Server Events" action={<span className="text-[11px] text-muted-foreground">Last 24 hours</span>}>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[12px]"><thead><tr className="border-b border-border text-[11px] text-muted-foreground">{["Time", "Type", "Message", "Status"].map((heading) => <th key={heading} className="px-3 pb-3 font-medium">{heading}</th>)}</tr></thead><tbody>{events.map((event) => <tr key={event.time} className="h-11 border-b border-border/60 last:border-0"><td className="whitespace-nowrap px-3 text-muted-foreground">{event.time}</td><td className="px-3"><span className="inline-flex items-center gap-2 text-foreground"><i className={`h-2 w-2 rounded-full ${event.tone}`} />{event.type}</span></td><td className="px-3 text-foreground">{event.message}</td><td className="px-3 text-foreground">{event.status}</td></tr>)}</tbody></table></div>
        </Panel>}
        </div>
      </section>

      <section aria-label="Server services and health" className="grid min-w-0 items-stretch gap-3 xl:grid-cols-3">
        <Panel title="Services Status" action={<button type="button" onClick={() => { setActiveTab("Services"); showNotice("Showing all server services."); }} className="text-[11px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto"><table className="w-full min-w-[360px] text-left text-[12px]"><thead><tr className="border-b border-border text-[11px] text-muted-foreground">{["Service", "Status", "CPU", "Memory"].map((heading) => <th key={heading} className="px-2 pb-2 font-medium">{heading}</th>)}</tr></thead><tbody>{services.map((service) => <tr key={service.name} className="h-9 border-b border-border/60 last:border-0"><td className="px-2 font-medium text-foreground"><span className="inline-flex items-center gap-2.5"><ServiceIcon name={service.name} />{service.name}</span></td><td className="px-2"><span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300"><i className="h-2 w-2 rounded-full bg-emerald-500" />Running</span></td><td className="px-2 text-muted-foreground">{service.cpu}</td><td className="px-2 text-muted-foreground">{service.memory}</td></tr>)}</tbody></table></div>
        </Panel>

        <Panel title="System Information" action={<button type="button" onClick={() => showNotice("System information menu opened.")} aria-label="System information actions" className="text-muted-foreground"><span className="text-lg leading-none">⋮</span></button>}>
          <div className="grid h-full min-h-[190px] grid-cols-[minmax(0,1fr)_130px] items-center gap-2">
            <dl className="divide-y divide-border text-[12px]">{[["Kernel Version", "5.15.0-105-generic"], ["Architecture", "x86_64"], ["Total Memory", "16 GB"], ["Total Disk", "1 TB"], ["Load Average", "0.82, 0.64, 0.52"]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-2 py-2"><dt className="text-muted-foreground">{label}</dt><dd className="m-0 truncate text-right font-medium text-foreground">{value}</dd></div>)}</dl>
            <div className="relative h-[128px] w-[128px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={memoryBreakdown} dataKey="value" innerRadius="72%" outerRadius="92%" startAngle={90} endAngle={-270} stroke="none">{memoryBreakdown.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[21px] font-bold text-foreground">68%</b><span className="text-[11px] text-muted-foreground">Memory</span></div></div>
          </div>
        </Panel>

        <Panel title="Server Health">
          <div className="flex h-full min-h-[190px] flex-col justify-between">
            <div className="pt-2 text-center"><div className="flex items-center justify-center gap-3 text-emerald-600"><CheckCircle2 size={30} fill="currentColor" className="text-emerald-500 [&_*]:text-white" /><strong className="text-[23px]">Healthy</strong></div><p className="mt-2 text-[13px] text-muted-foreground">All systems are running normally</p></div>
            <div className="h-[92px] min-w-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={traffic} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}><Area dataKey="inbound" stroke="#20b77a" strokeWidth={2} fill="#20b77a" fillOpacity={0.13} dot={false} /></AreaChart></ResponsiveContainer></div>
          </div>
        </Panel>
      </section>

      <section aria-label="Server activity and actions" className="grid min-w-0 items-stretch gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Panel title="Recent Events" action={<button type="button" onClick={() => { setActiveTab("Events"); showNotice("Showing all server events."); }} className="text-[11px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-[12px]"><thead><tr className="border-b border-border text-[11px] text-muted-foreground">{["Time", "Type", "Message", "Status"].map((heading) => <th key={heading} className="px-2 pb-2 font-medium">{heading}</th>)}</tr></thead><tbody>{events.map((event) => <tr key={event.time} className="h-9 border-b border-border/60 last:border-0"><td className="whitespace-nowrap px-2 text-muted-foreground">{event.time}</td><td className="whitespace-nowrap px-2"><span className="inline-flex items-center gap-1.5 text-foreground"><i className={`h-2 w-2 rounded-full ${event.tone}`} />{event.type}</span></td><td className="px-2 text-foreground">{event.message}</td><td className="px-2"><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${event.status === "Success" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"}`}>{event.status}</span></td></tr>)}</tbody></table></div>
        </Panel>
        <Panel title="Quick Actions">
          <div className="grid h-full min-h-[180px] grid-cols-1 content-center gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map(({ label, icon: Icon }) => <button key={label} type="button" onClick={() => showNotice(`${label} action selected.`)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-[12px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon size={16} className="text-primary" />{label}</button>)}
          </div>
        </Panel>
      </section>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-30 rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
