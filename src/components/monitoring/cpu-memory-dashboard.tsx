"use client";

import { useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Download, Plus, Server,
} from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { MetricStat } from "@/data/mock/dashboard";

const stats: MetricStat[] = [
  { label: "Avg CPU Usage", value: "32.4%", change: "12.6%", trend: "up", tone: "blue", icon: "cpu", detail: "vs last 24 hours" },
  { label: "Peak CPU Usage", value: "78.6%", change: "15.3%", trend: "down", tone: "red", icon: "activity", detail: "vs last 24 hours" },
  { label: "Avg Memory Usage", value: "68.7%", change: "8.4%", trend: "up", tone: "green", icon: "memory", detail: "vs last 24 hours" },
  { label: "Peak Memory Usage", value: "89.3%", change: "10.7%", trend: "down", tone: "purple", icon: "chart-no-axes-column-increasing", detail: "vs last 24 hours" },
  { label: "Servers Monitored", value: "48", change: "2", trend: "up", tone: "blue", icon: "server", detail: "vs last 24 hours" },
  { label: "Total Cores", value: "256", change: "Total across all servers", trend: "flat", tone: "amber", icon: "cpu" },
];

const cpuHistory = [
  { time: "12:00", average: 80, user: 60, system: 36, ioWait: 12, steal: 20 },
  { time: "13:00", average: 76, user: 56, system: 32, ioWait: 10, steal: 18 },
  { time: "14:00", average: 72, user: 58, system: 35, ioWait: 13, steal: 20 },
  { time: "15:00", average: 78, user: 62, system: 38, ioWait: 9, steal: 16 },
  { time: "16:00", average: 74, user: 55, system: 34, ioWait: 11, steal: 19 },
  { time: "17:00", average: 79, user: 60, system: 36, ioWait: 10, steal: 17 },
  { time: "18:00", average: 82, user: 64, system: 40, ioWait: 14, steal: 21 },
  { time: "19:00", average: 73, user: 57, system: 33, ioWait: 9, steal: 16 },
  { time: "20:00", average: 77, user: 61, system: 37, ioWait: 12, steal: 18 },
  { time: "22:00", average: 83, user: 65, system: 41, ioWait: 13, steal: 22 },
  { time: "00:00", average: 75, user: 59, system: 35, ioWait: 10, steal: 19 },
  { time: "02:00", average: 80, user: 63, system: 39, ioWait: 12, steal: 18 },
  { time: "04:00", average: 72, user: 56, system: 32, ioWait: 9, steal: 16 },
  { time: "06:00", average: 78, user: 61, system: 37, ioWait: 11, steal: 20 },
  { time: "08:00", average: 85, user: 68, system: 44, ioWait: 15, steal: 24 },
  { time: "10:00", average: 73, user: 58, system: 34, ioWait: 10, steal: 17 },
  { time: "12:00", average: 80, user: 63, system: 39, ioWait: 12, steal: 21 },
];

const memoryHistory = [
  { time: "12:00", used: 72, cached: 42, buffers: 19, free: 8 },
  { time: "13:00", used: 70, cached: 41, buffers: 18, free: 9 },
  { time: "14:00", used: 73, cached: 42, buffers: 20, free: 8 },
  { time: "15:00", used: 75, cached: 43, buffers: 20, free: 7 },
  { time: "16:00", used: 72, cached: 41, buffers: 19, free: 8 },
  { time: "17:00", used: 74, cached: 42, buffers: 21, free: 8 },
  { time: "18:00", used: 76, cached: 44, buffers: 22, free: 9 },
  { time: "19:00", used: 73, cached: 41, buffers: 20, free: 8 },
  { time: "20:00", used: 75, cached: 42, buffers: 21, free: 8 },
  { time: "22:00", used: 78, cached: 45, buffers: 22, free: 10 },
  { time: "00:00", used: 72, cached: 42, buffers: 19, free: 8 },
  { time: "02:00", used: 74, cached: 43, buffers: 20, free: 9 },
  { time: "04:00", used: 76, cached: 44, buffers: 21, free: 8 },
  { time: "06:00", used: 73, cached: 42, buffers: 19, free: 9 },
  { time: "08:00", used: 77, cached: 45, buffers: 22, free: 8 },
  { time: "10:00", used: 71, cached: 40, buffers: 19, free: 9 },
  { time: "12:00", used: 75, cached: 43, buffers: 21, free: 8 },
];

const cpuServers = [
  { name: "web-01", usage: 78.6, user: 48.2, system: 22.1, ioWait: 6.3, cores: 8, load: "2.34" },
  { name: "app-server-02", usage: 62.3, user: 35.6, system: 18.7, ioWait: 4.5, cores: 8, load: "1.82" },
  { name: "db-01", usage: 45.8, user: 24.1, system: 15.9, ioWait: 3.2, cores: 16, load: "1.28" },
  { name: "cache-01", usage: 32.1, user: 18.3, system: 10.2, ioWait: 1.6, cores: 4, load: "0.98" },
  { name: "api-gateway", usage: 28.7, user: 16.2, system: 9.8, ioWait: 1.1, cores: 4, load: "0.76" },
  { name: "worker-01", usage: 22.4, user: 12.6, system: 7.3, ioWait: 0.8, cores: 4, load: "0.61" },
];

const memoryServers = [
  { name: "db-01", usage: 89.3, used: "57.2 GB / 64 GB", cached: "12.6 GB", free: "6.8 GB", swap: "2.1%" },
  { name: "app-server-02", usage: 76.4, used: "48.9 GB / 64 GB", cached: "8.1 GB", free: "7.0 GB", swap: "1.3%" },
  { name: "web-01", usage: 72.1, used: "46.1 GB / 64 GB", cached: "9.3 GB", free: "8.6 GB", swap: "0.8%" },
  { name: "worker-01", usage: 55.6, used: "17.8 GB / 32 GB", cached: "2.6 GB", free: "8.0 GB", swap: "0.0%" },
  { name: "api-gateway", usage: 42.3, used: "6.8 GB / 16 GB", cached: "2.1 GB", free: "6.8 GB", swap: "0.0%" },
  { name: "cache-01", usage: 34.2, used: "5.5 GB / 16 GB", cached: "1.6 GB", free: "8.9 GB", swap: "0.0%" },
];

const cpuDistribution = [
  { name: "0% - 25%", value: 18, color: "#35b879" },
  { name: "25% - 50%", value: 12, color: "#2878ed" },
  { name: "50% - 75%", value: 10, color: "#f39a12" },
  { name: "75% - 100%", value: 8, color: "#ed3346" },
];

const memoryDistribution = [
  { name: "0% - 25%", value: 8, color: "#35b879" },
  { name: "25% - 50%", value: 16, color: "#2878ed" },
  { name: "50% - 75%", value: 16, color: "#f39a12" },
  { name: "75% - 100%", value: 8, color: "#ed3346" },
];

const cpuProcesses = [
  { name: "node", value: 18.6, width: "72%", color: "bg-emerald-500" },
  { name: "java", value: 12.4, width: "48%", color: "bg-blue-500" },
  { name: "nginx", value: 8.7, width: "34%", color: "bg-amber-500" },
  { name: "postgres", value: 6.2, width: "24%", color: "bg-violet-500" },
  { name: "python", value: 4.1, width: "16%", color: "bg-cyan-500" },
];

const memoryProcesses = [
  { name: "java", value: 22.3, width: "86%", color: "bg-blue-500" },
  { name: "node", value: 16.8, width: "65%", color: "bg-emerald-500" },
  { name: "postgres", value: 12.6, width: "49%", color: "bg-violet-500" },
  { name: "chrome", value: 8.7, width: "34%", color: "bg-amber-500" },
  { name: "redis-server", value: 5.4, width: "21%", color: "bg-cyan-500" },
];

const alerts = [
  { text: "High CPU usage on web-01", ago: "2m ago", tone: "critical" },
  { text: "Memory usage high on db-01", ago: "8m ago", tone: "critical" },
  { text: "High memory usage on app-server-02", ago: "12m ago", tone: "warning" },
  { text: "CPU usage back to normal on cache-01", ago: "25m ago", tone: "info" },
  { text: "Memory usage normal on worker-01", ago: "38m ago", tone: "healthy" },
];

const cpuSeries = [
  { key: "average", name: "Average CPU", color: "#2878ed" },
  { key: "user", name: "User CPU", color: "#35b879" },
  { key: "system", name: "System CPU", color: "#f39a12" },
  { key: "ioWait", name: "I/O Wait", color: "#8a45df" },
  { key: "steal", name: "Steal CPU", color: "#20b9d1" },
];

const memorySeries = [
  { key: "used", name: "Used Memory", color: "#2878ed" },
  { key: "cached", name: "Cached", color: "#35b879" },
  { key: "buffers", name: "Buffers", color: "#f39a12" },
  { key: "free", name: "Free Memory", color: "#8a45df" },
];

function UsageDistribution({ data }: { data: typeof cpuDistribution }) {
  return (
    <div className="flex h-[180px] w-full max-w-[360px] items-center justify-center gap-2.5">
      <div className="relative h-[148px] w-[52%] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="59%" outerRadius="88%" paddingAngle={1} stroke="none">
              {data.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className="font-display text-[24px] font-extrabold leading-tight text-foreground">48</b>
          <span className="text-[13px] text-muted-foreground">Servers</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {data.map((item) => <div key={item.name} className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-1 text-[12px]"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="whitespace-nowrap text-foreground">{item.name.replace(" - ", "–")}</span><span className="whitespace-nowrap text-foreground">{item.value} ({Math.round(item.value / 48 * 100)}%)</span></div>)}
      </div>
    </div>
  );
}

function ProcessList({ title, items, onViewAll }: { title: string; items: { name: string; value: number; width: string; color: string }[]; onViewAll: () => void }) {
  return (
    <Panel title={title} className="min-w-0" action={<button onClick={onViewAll} className="text-[12px] font-semibold text-primary">View All →</button>}>
      <div className="flex flex-1 items-center justify-center pb-1 pt-3">
        <div className="w-full translate-y-2 space-y-3">
          {items.map((item) => <div key={item.name} className="grid grid-cols-[minmax(0,1fr)_minmax(40px,1fr)_42px] items-center gap-2 text-[12px]"><span className="truncate text-foreground">{item.name}</span><div className="h-[7px] rounded-full bg-muted"><div className={`h-full rounded-full ${item.color}`} style={{ width: item.width }} /></div><b className="text-right text-foreground">{item.value}%</b></div>)}
        </div>
      </div>
    </Panel>
  );
}

export function CpuMemoryDashboard() {
  const [notice, setNotice] = useState("");
  const [period, setPeriod] = useState("24H");
  const [cpuAverage, setCpuAverage] = useState("Average");
  const [memoryAverage, setMemoryAverage] = useState("Average");
  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const exportCsv = () => {
    const header = ["Server", "CPU Usage", "User CPU", "System CPU", "I/O Wait", "Cores", "Load Average", "Memory Usage", "Memory Used", "Cached", "Free", "Swap"];
    const rows = cpuServers.map((server, index) => {
      const memory = memoryServers.find((item) => item.name === server.name);
      return [server.name, `${server.usage}%`, `${server.user}%`, `${server.system}%`, `${server.ioWait}%`, String(server.cores), server.load, memory ? `${memory.usage}%` : "", memory?.used ?? "", memory?.cached ?? "", memory?.free ?? "", memory?.swap ?? ""];
    });
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cpu-memory-usage.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast("CPU and memory data exported.");
  };

  const timeControls = (value: string, setValue: (next: string) => void) => (
    <div className="flex items-center gap-0.5">
      <select aria-label="Aggregation" value={value} onChange={(event) => setValue(event.target.value)} className="h-8 rounded border border-border bg-card px-2 text-[12px] text-foreground">
        {["Average", "Maximum", "Minimum"].map((item) => <option key={item}>{item}</option>)}
      </select>
      {["1H", "6H", "12H", "24H"].map((item) => <button key={item} onClick={() => setPeriod(item)} className={`rounded px-1.5 py-1 text-[11px] font-semibold ${period === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{item}</button>)}
    </div>
  );

  return (
    <div className="space-y-2.5 pb-3">
      <PageMeta breadcrumbs={["Monitoring", "CPU & Memory"]} showRefresh={false} variant="detail" />
      <PageHeading title="CPU & Memory" description="Monitor and analyze CPU and memory utilization across your infrastructure in real-time." actionsAlign="top" variant="detail">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Download size={15} />Export CSV</Button>
          <Button size="sm" onClick={() => toast("Add Widget is a mockup action.")} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Plus size={15} />Add Widget</Button>
        </div>
      </PageHeading>

      <section aria-label="CPU and memory summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[100px] self-stretch" labelClassName="text-[12px] leading-4" valueClassName="text-[24px] leading-7" trendClassName="text-[11px] leading-4" />)}
      </section>

      <section aria-label="CPU and memory trends" className="grid gap-2.5 xl:grid-cols-[1.14fr_1.14fr_0.72fr]">
        <Panel title="CPU Usage Over Time" className="min-w-0" action={timeControls(cpuAverage, setCpuAverage)}>
          <div className="h-[190px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cpuHistory} margin={{ top: 4, right: 3, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical />
                <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
                <Area dataKey="average" name="Average CPU" type="monotone" stroke="#2878ed" strokeWidth={2} fill="#2878ed" fillOpacity={0.12} dot={{ r: 1.8 }} />
                {cpuSeries.filter((item) => item.key !== "average").map((item) => <Line key={item.key} dataKey={item.key} name={item.name} type="monotone" stroke={item.color} strokeWidth={1.8} dot={{ r: 1.6 }} />)}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">{cpuSeries.map((item) => <span key={item.key} className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />{item.name}</span>)}</div>
        </Panel>

        <Panel title="Memory Usage Over Time" className="min-w-0" action={timeControls(memoryAverage, setMemoryAverage)}>
          <div className="h-[190px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={memoryHistory} margin={{ top: 4, right: 3, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical />
                <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
                {memorySeries.map((item) => <Line key={item.key} dataKey={item.key} name={item.name} type="monotone" stroke={item.color} strokeWidth={1.8} dot={{ r: 1.6 }} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground">{memorySeries.map((item) => <span key={item.key} className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />{item.name}</span>)}</div>
        </Panel>

        <Panel title="Current Usage Summary" className="min-w-0">
          <div className="flex h-[174px] items-center gap-2">
            <div className="relative h-[112px] w-[49%] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: "Used CPU", value: 32.4, color: "#2878ed" }, { name: "CPU remaining", value: 67.6, color: "#e7eef8" }, { name: "Used memory", value: 68.7, color: "#35b879" }, { name: "Memory remaining", value: 31.3, color: "#e7eef8" }]} dataKey="value" cx="50%" cy="50%" innerRadius="67%" outerRadius="89%" startAngle={90} endAngle={-270} stroke="none">
                    <Cell fill="#35b879" /><Cell fill="#e7eef8" /><Cell fill="#2878ed" /><Cell fill="#e7eef8" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><Server size={15} className="text-muted-foreground" /><b className="font-display text-[16px] font-extrabold leading-tight text-foreground">48</b><span className="text-[11px] text-muted-foreground">Servers</span></div>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              {[["CPU Usage", "32.4%", "bg-blue-600", "32.4%"], ["Memory Usage", "68.7%", "bg-emerald-500", "68.7%"], ["Total Used Memory", "165.3 GB", "bg-purple-500", "68.7%"], ["Total CPU Cores", "256", "bg-blue-500", "100%"]].map(([label, value, color, width]) => <div key={label} className="text-[11px]"><div className="mb-1 flex justify-between gap-1"><span className="truncate text-muted-foreground">{label}</span><b className="shrink-0 text-foreground">{value}</b></div><div className="h-[4px] rounded-full bg-muted"><div className={`h-full rounded-full ${color}`} style={{ width }} /></div><div className="mt-0.5 text-right text-[11px] text-muted-foreground">{label === "Total Used Memory" ? "of 240.0 GB" : label === "Total CPU Cores" ? "Across all servers" : ""}</div></div>)}
            </div>
          </div>
        </Panel>
      </section>

      <section aria-label="Top CPU and memory servers" className="grid gap-2.5 xl:grid-cols-2">
        <Panel title="Top Servers by CPU Usage" className="min-w-0" action={<button onClick={() => toast("Showing all servers by CPU usage.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[780px] text-left text-[12px]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Server Name", "CPU Usage", "User %", "System %", "I/O Wait %", "Cores", "Load Average", "Trend"].map((heading) => <th key={heading} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{cpuServers.map((server, index) => <tr key={server.name} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1 py-[5px] font-semibold text-primary"><Server size={9} className="mr-1 inline text-muted-foreground" />{server.name}</td><td className={`whitespace-nowrap px-1 py-[5px] font-semibold ${server.usage > 60 ? "text-rose-600" : server.usage > 40 ? "text-amber-600" : "text-emerald-600"}`}>{server.usage.toFixed(1)}%</td><td className="px-1 py-[5px] text-foreground">{server.user.toFixed(1)}%</td><td className="px-1 py-[5px] text-foreground">{server.system.toFixed(1)}%</td><td className="px-1 py-[5px] text-foreground">{server.ioWait.toFixed(1)}%</td><td className="px-1 py-[5px] text-foreground">{server.cores}</td><td className="px-1 py-[5px] text-foreground">{server.load}</td><td className="px-1 py-[5px]"><svg viewBox="0 0 70 22" className="h-5 w-[52px]" aria-label={`CPU trend for ${server.name}`}><polyline points={`${index * 2},17 ${12 + index},${12 + index % 4} ${24 + index},${15 - index % 5} ${38 + index},${7 + index % 5} ${53 + index},${10 - index % 4} 68,${4 + index % 6}`} fill="none" stroke={server.usage > 60 ? "#f97316" : "#22bd83"} strokeWidth="1.4" /></svg></td></tr>)}</tbody>
            </table>
          </div>
          <div className="flex justify-between pt-1 text-[11px] text-muted-foreground"><span>Showing 1-6 of 48 servers</span><span>Rows per page:　10　 ‹　<span className="rounded bg-primary px-1 text-white">1</span>　2　3　4　5　…　›</span></div>
        </Panel>

        <Panel title="Top Servers by Memory Usage" className="min-w-0" action={<button onClick={() => toast("Showing all servers by memory usage.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[760px] text-left text-[12px]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Server Name", "Memory Usage", "Used / Total", "Cached", "Free", "Swap Usage", "Trend"].map((heading) => <th key={heading} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{memoryServers.map((server, index) => <tr key={server.name} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1 py-[5px] font-semibold text-primary"><Server size={9} className="mr-1 inline text-muted-foreground" />{server.name}</td><td className={`whitespace-nowrap px-1 py-[5px] font-semibold ${server.usage > 75 ? "text-rose-600" : server.usage > 50 ? "text-amber-600" : "text-emerald-600"}`}>{server.usage.toFixed(1)}%</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{server.used}</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{server.cached}</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{server.free}</td><td className="px-1 py-[5px] text-foreground">{server.swap}</td><td className="px-1 py-[5px]"><svg viewBox="0 0 70 22" className="h-5 w-[52px]" aria-label={`Memory trend for ${server.name}`}><polyline points={`${index * 2},17 ${12 + index},${12 + index % 4} ${24 + index},${15 - index % 5} ${38 + index},${7 + index % 5} ${53 + index},${10 - index % 4} 68,${4 + index % 6}`} fill="none" stroke={server.usage > 75 ? "#ef4444" : server.usage > 50 ? "#f97316" : "#22bd83"} strokeWidth="1.4" /></svg></td></tr>)}</tbody>
            </table>
          </div>
          <div className="flex justify-between pt-1 text-[11px] text-muted-foreground"><span>Showing 1-6 of 48 servers</span><span>Rows per page:　10　 ‹　<span className="rounded bg-primary px-1 text-white">1</span>　2　3　4　5　…　›</span></div>
        </Panel>
      </section>

      <section aria-label="CPU and memory details" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <Panel title="CPU Usage Distribution" className="min-w-0"><div className="flex min-h-[220px] flex-1 items-center justify-center"><UsageDistribution data={cpuDistribution} /></div></Panel>
        <Panel title="Memory Usage Distribution" className="min-w-0"><div className="flex min-h-[220px] flex-1 items-center justify-center"><UsageDistribution data={memoryDistribution} /></div></Panel>
        <ProcessList title="Top Processes by CPU" items={cpuProcesses} onViewAll={() => toast("Showing all CPU processes.")} />
        <ProcessList title="Top Processes by Memory" items={memoryProcesses} onViewAll={() => toast("Showing all memory processes.")} />
        <Panel title="Recent Alerts" className="min-w-0" action={<button onClick={() => toast("Showing all CPU and memory alerts.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="space-y-2.5 pt-1.5">{alerts.map((alert) => <div key={alert.text} className="grid grid-cols-[10px_minmax(0,1fr)_38px] items-center gap-1.5 text-[12px]"><i className={`grid h-2.5 w-2.5 place-items-center rounded-full text-white ${alert.tone === "critical" ? "bg-rose-500" : alert.tone === "warning" ? "bg-amber-500" : alert.tone === "healthy" ? "bg-emerald-500" : "bg-blue-500"}`}>{alert.tone === "critical" ? "×" : alert.tone === "warning" ? "!" : "•"}</i><span className="truncate font-semibold text-foreground">{alert.text}</span><span className="text-right text-muted-foreground">{alert.ago}</span></div>)}</div>
        </Panel>
      </section>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
