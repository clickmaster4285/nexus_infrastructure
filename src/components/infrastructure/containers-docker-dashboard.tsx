"use client";

import { useState } from "react";
import {
  ArrowRight, Download, RefreshCw,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { TechLogo } from "@/components/shared/icon";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MetricStat } from "@/data/mock/dashboard";

const stats: MetricStat[] = [
  { label: "Total Containers", value: "36", change: "4 running", trend: "up", tone: "blue", icon: "container" },
  { label: "Running", value: "28", change: "3", trend: "up", tone: "green", icon: "online" },
  { label: "Stopped", value: "8", change: "1", trend: "down", tone: "red", icon: "offline" },
  { label: "Images", value: "52", change: "5", trend: "up", tone: "blue", icon: "boxes" },
  { label: "Volumes", value: "18", change: "2", trend: "up", tone: "green", icon: "database" },
  { label: "Containers Health", value: "97.2%", change: "0.8%", trend: "up", tone: "purple", icon: "pulse" },
];

const healthTrend = [78, 79, 84, 79, 74, 77, 87, 76, 88, 79, 87, 77, 86].map((health, index) => ({
  time: ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00"][index],
  health,
}));

const containerStates = [
  { name: "Running", value: 28, color: "#22bd83", percent: "77.8%" },
  { name: "Stopped", value: 8, color: "#f04452", percent: "22.2%" },
  { name: "Paused", value: 0, color: "#f4b740", percent: "0%" },
  { name: "Restarting", value: 0, color: "#9857e8", percent: "0%" },
];

const runningContainers = [
  { name: "web-01", image: "nginx:1.25", cpu: "12.6%", cpuWidth: "38%", memory: "128.4 MB", memoryWidth: "31%", network: "1.2 MB/s", uptime: "3d 5h 12m", restarts: 0 },
  { name: "app-server", image: "node:18-alpine", cpu: "18.4%", cpuWidth: "52%", memory: "256.7 MB", memoryWidth: "62%", network: "2.4 MB/s", uptime: "2d 14h 33m", restarts: 1 },
  { name: "db-postgres", image: "postgres:15", cpu: "22.1%", cpuWidth: "64%", memory: "512.3 MB", memoryWidth: "82%", network: "3.1 MB/s", uptime: "5d 2h 45m", restarts: 0 },
  { name: "redis-cache", image: "redis:7-alpine", cpu: "8.7%", cpuWidth: "26%", memory: "64.2 MB", memoryWidth: "18%", network: "512 KB/s", uptime: "1d 7h 21m", restarts: 2 },
  { name: "api-gateway", image: "kong:3.4", cpu: "15.3%", cpuWidth: "44%", memory: "198.6 MB", memoryWidth: "47%", network: "1.8 MB/s", uptime: "4d 11h 9m", restarts: 1 },
];

const topImages = [
  { name: "nginx:1.25", containers: 6, size: "187 MB" },
  { name: "node:18-alpine", containers: 5, size: "156 MB" },
  { name: "postgres:15", containers: 2, size: "348 MB" },
  { name: "redis:7-alpine", containers: 2, size: "120 MB" },
  { name: "kong:3.4", containers: 1, size: "211 MB" },
];

const hosts = [
  { name: "host-01", count: 14, percent: "38.9%", width: "100%", color: "#2563eb" },
  { name: "host-02", count: 10, percent: "27.8%", width: "72%", color: "#8b5cf6" },
  { name: "host-03", count: 8, percent: "22.2%", width: "57%", color: "#10b981" },
  { name: "host-04", count: 4, percent: "11.1%", width: "29%", color: "#f59e0b" },
];

const networks = [
  { name: "bridge", count: 18, percent: "50.0%", width: "100%", color: "#8b5cf6" },
  { name: "frontend", count: 8, percent: "22.2%", width: "44%", color: "#2563eb" },
  { name: "backend", count: 6, percent: "16.7%", width: "33%", color: "#10b981" },
  { name: "monitoring", count: 4, percent: "11.1%", width: "22%", color: "#f59e0b" },
];

const events = [
  { time: "10:24", text: "Container web-01 started", ago: "2m ago", color: "bg-emerald-500" },
  { time: "10:18", text: "Container cache-01 stopped", ago: "8m ago", color: "bg-rose-500" },
  { time: "10:12", text: "Image node:18-alpine pulled", ago: "14m ago", color: "bg-blue-500" },
  { time: "10:05", text: "Container db-postgres restarted", ago: "21m ago", color: "bg-amber-500" },
];

const runningContainerCount = Number(stats.find((item) => item.label === "Running")?.value ?? 0);
const totalContainerCount = Number(stats.find((item) => item.label === "Total Containers")?.value ?? 0);
const dockerDisk = { used: 18.4, total: 92.6 };

const resourceUsage = [
  { name: "CPU Usage", used: 32.4, total: 100, detail: "12 of 37.1 cores", color: "#2563eb" },
  { name: "Memory Usage", used: 68.7, total: 100, detail: "11.0 GB of 16.0 GB", color: "#16a34a" },
  { name: "Disk Usage", used: 41.2, total: 100, detail: "92.6 GB of 224 GB", color: "#f59e0b" },
  { name: "Containers", used: runningContainerCount, total: totalContainerCount, detail: `${runningContainerCount} of ${totalContainerCount} running`, color: "#8B5CF6" },
  { name: "Docker", used: dockerDisk.used, total: dockerDisk.total, detail: `${dockerDisk.used.toFixed(1)} GB of ${dockerDisk.total.toFixed(1)} GB`, color: "#06B6D4" },
];

function StateDonut({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${compact ? "h-[112px]" : "h-[165px]"}`}>
      <div className={`relative shrink-0 ${compact ? "h-[92px] w-[92px]" : "h-[134px] w-[134px]"}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={containerStates.filter((state) => state.value > 0)} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="91%" paddingAngle={1} stroke="none">
              {containerStates.filter((state) => state.value > 0).map((state) => <Cell key={state.name} fill={state.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className={`font-display font-extrabold leading-tight text-foreground ${compact ? "text-[17px]" : "text-[22px]"}`}>36</b>
          <span className="text-[11px] text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="min-w-0 space-y-2.5">
        {containerStates.map((state) => (
          <div key={state.name} className="flex items-center gap-1.5 whitespace-nowrap text-[11px]">
            <i className="h-2 w-2 rounded-full" style={{ backgroundColor: state.color }} />
            <span className="text-foreground">{state.name}</span>
            <b className="ml-auto text-foreground">{state.value}</b>
            {!compact && <span className="text-muted-foreground">({state.percent})</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function UsageBars() {
  return (
    <div className="space-y-[10px] pt-1">
      {resourceUsage.map((resource) => (
        <div key={resource.name} className="min-w-0">
          <div className="mb-0.5 flex items-center justify-between gap-2 text-[11px] leading-4">
            <span className="font-semibold text-foreground">{resource.name}</span>
            <b className="shrink-0 tabular-nums text-foreground">{resource.total > 0 ? `${((resource.used / resource.total) * 100).toFixed(1)}%` : "0.0%"}</b>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-[6px] min-w-0 flex-1 rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${resource.total > 0 ? Math.min(100, (resource.used / resource.total) * 100) : 0}%`, backgroundColor: resource.color }} />
            </div>
            <span className="shrink-0 whitespace-nowrap text-right text-[11px] leading-4 text-muted-foreground">{resource.detail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DistributionBars({ items }: { items: { name: string; count: number; percent: string; width: string; color: string }[] }) {
  return (
    <div className="space-y-3 pt-2">
      {items.map((item) => (
        <div key={item.name} className="grid grid-cols-[52px_minmax(0,1fr)_54px] items-center gap-2 text-[11px]">
          <span className="truncate text-foreground">{item.name}</span>
          <div className="h-[6px] rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: item.width, backgroundColor: item.color }} />
          </div>
          <span className="text-right font-semibold text-foreground">{item.count} ({item.percent})</span>
        </div>
      ))}
    </div>
  );
}

export function ContainersDockerDashboard() {
  const [notice, setNotice] = useState("");
  const [updatedAt, setUpdatedAt] = useState("Just now");
  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const refresh = () => {
    setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    toast("Container data refreshed.");
  };
  const exportCsv = () => {
    const header = ["Name", "Image", "Status", "CPU", "Memory", "Network I/O", "Uptime", "Restart Count"];
    const rows = runningContainers.map((item) => [item.name, item.image, "Running", item.cpu, item.memory, item.network, item.uptime, String(item.restarts)]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "containers.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast("Container list exported.");
  };

  return (
    <div className="space-y-2.5 pb-3">
      <PageMeta breadcrumbs={["Infrastructure", "Containers & Docker"]} variant="detail" />
      <PageHeading title="Containers & Docker" description="Monitor and manage your containers, images, volumes, and Docker environments in real-time." actionsAlign="top" variant="detail">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} className="h-7 gap-1.5 whitespace-nowrap px-2.5 text-[12px]"><RefreshCw size={12} />Refresh</Button>
          <Button size="sm" onClick={exportCsv} className="h-7 gap-1.5 whitespace-nowrap px-2.5 text-[12px]"><Download size={12} />Export CSV</Button>
        </div>
      </PageHeading>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[82px]" labelClassName="text-[12px]" valueClassName="text-[24px]" trendClassName="text-[11px]" />)}
      </div>

      <div className="grid gap-2.5 min-[1000px]:grid-cols-[1.16fr_1.7fr_0.95fr_1fr]">
        <Panel title="Container Status" className="min-w-0">
          <StateDonut />
        </Panel>

        <Panel title="Container Health Over Time" className="min-w-0" action={<Select defaultValue="24h"><SelectTrigger className="h-8 w-[88px] text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{["1h", "6h", "24h", "7d"].map((range) => <SelectItem key={range} value={range}>{range}</SelectItem>)}</SelectContent></Select>}>
          <div className="h-[200px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={healthTrend} margin={{ top: 5, right: 3, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical />
                <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
                <Area dataKey="health" name="Healthy containers" type="monotone" stroke="#288af0" strokeWidth={2} fill="#288af0" fillOpacity={0.08} dot={{ r: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Docker Engine Info" className="min-w-0">
          <div className="space-y-2 pt-2 text-[12px]">
            {[["Engine Version", "24.0.7"], ["API Version", "1.43"], ["OS Type", "linux"], ["Architecture", "x86_64"], ["Containers", "36"], ["Images", "52"], ["Server Uptime", "15d 8h 32m"]].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-2"><span className="truncate text-muted-foreground">{label}</span><b className="shrink-0 text-foreground">{value}</b></div>
            ))}
          </div>
        </Panel>

        <Panel title="Resource Usage" className="min-w-0 p-2">
          <UsageBars />
        </Panel>
      </div>

      <div className="grid gap-2.5 min-[1000px]:grid-cols-[2.4fr_0.92fr]">
        <Panel title="Running Containers" className="min-w-0" action={<span className="text-[12px] text-muted-foreground">Updated {updatedAt}</span>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[760px] text-left text-[12px]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Name", "Image", "Status", "CPU %", "Memory", "Net I/O", "Uptime", "Restart Count", "Actions"].map((title) => <th key={title} className="whitespace-nowrap px-1.5 pb-1.5 font-semibold">{title}</th>)}</tr></thead>
              <tbody>
                {runningContainers.map((item) => (
                  <tr key={item.name} className="border-b border-border/70 last:border-0">
                    <td className="whitespace-nowrap px-1.5 py-2 font-semibold text-primary">{item.name}</td>
                    <td className="whitespace-nowrap px-1.5 py-2 text-foreground"><span className="mr-1.5 inline-flex align-middle"><TechLogo name={item.image} /></span>{item.image}</td>
                    <td className="px-1.5 py-2"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><i className="h-1 w-1 rounded-full bg-emerald-500" />Running</span></td>
                    <td className="px-1.5 py-2"><span className="flex items-center gap-1.5 text-foreground">{item.cpu}<span className="h-[5px] w-10 rounded-full bg-muted"><i className="block h-full rounded-full bg-blue-500" style={{ width: item.cpuWidth }} /></span></span></td>
                    <td className="px-1.5 py-2"><span className="flex items-center gap-1.5 whitespace-nowrap text-foreground">{item.memory}<span className="h-[5px] w-8 rounded-full bg-muted"><i className="block h-full rounded-full bg-emerald-500" style={{ width: item.memoryWidth }} /></span></span></td>
                    <td className="whitespace-nowrap px-1.5 py-2 text-foreground">{item.network}</td>
                    <td className="whitespace-nowrap px-1.5 py-2 text-foreground">{item.uptime}</td>
                    <td className="px-1.5 py-2 text-foreground">{item.restarts}</td>
                    <td className="px-1.5 py-2"><button aria-label={`Actions for ${item.name}`} onClick={() => toast(`Actions for ${item.name} are not available in this demo.`)} className="rounded px-1 text-muted-foreground hover:bg-accent">⋮</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Top Images" className="min-w-0" action={<button onClick={() => toast("Showing all 52 images.")} className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-primary">View All <ArrowRight size={17} strokeWidth={2.75} aria-hidden="true" /></button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[240px] text-left text-[12px]">
              <thead><tr className="border-b border-border text-muted-foreground"><th className="pb-1.5">Image</th><th className="pb-1.5">Containers</th><th className="pb-1.5 text-right">Size</th></tr></thead>
            <tbody>{topImages.map((image) => <tr key={image.name} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap py-2 font-semibold text-foreground"><span className="mr-1.5 inline-flex align-middle"><TechLogo name={image.name} /></span>{image.name}</td><td className="py-2 text-foreground">{image.containers}</td><td className="py-2 text-right text-foreground">{image.size}</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-4">
        <Panel title="Containers by State" className="min-w-0"><StateDonut compact /></Panel>
        <Panel title="Containers by Host" className="min-w-0" action={<button onClick={() => toast("Showing all Docker hosts.")} className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-primary">View All <ArrowRight size={17} strokeWidth={2.75} aria-hidden="true" /></button>}><DistributionBars items={hosts} /></Panel>
        <Panel title="Top Networks" className="min-w-0" action={<button onClick={() => toast("Showing all Docker networks.")} className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-primary">View All <ArrowRight size={17} strokeWidth={2.75} aria-hidden="true" /></button>}><DistributionBars items={networks} /></Panel>
        <Panel title="Recent Events" className="min-w-0" action={<button onClick={() => toast("Showing all container events.")} className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-primary">View All <ArrowRight size={17} strokeWidth={2.75} aria-hidden="true" /></button>}>
          <div className="space-y-3 pt-2">
            {events.map((event) => <div key={event.time} className="grid grid-cols-[8px_32px_minmax(0,1fr)_38px] items-center gap-1.5 text-[11px]"><i className={`h-2 w-2 rounded-full ${event.color}`} /><span className="text-muted-foreground">{event.time}</span><span className="truncate font-semibold text-foreground">{event.text}</span><span className="text-right text-muted-foreground">{event.ago}</span></div>)}
          </div>
        </Panel>
      </div>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[11px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
