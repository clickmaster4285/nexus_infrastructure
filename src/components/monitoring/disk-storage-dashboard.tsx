"use client";

import { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Download, Plus, Server } from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { MetricStat } from "@/data/mock/dashboard";

const stats: MetricStat[] = [
  { label: "Total Disk Usage", value: "61.3%", change: "7.2%", trend: "down", tone: "blue", icon: "storage", detail: "vs last 24 hours" },
  { label: "Used Storage", value: "12.45 TB", change: "1.8 TB", trend: "up", tone: "green", icon: "storage", detail: "of 20.30 TB" },
  { label: "Available Storage", value: "7.85 TB", change: "1.2 TB", trend: "up", tone: "purple", icon: "hard-drive-download", detail: "of 20.30 TB" },
  { label: "Avg IOPS", value: "8,512", change: "9.6%", trend: "up", tone: "amber", icon: "activity", detail: "vs last 24 hours" },
  { label: "Avg Throughput", value: "245 MB/s", change: "12.3%", trend: "up", tone: "red", icon: "network", detail: "vs last 24 hours" },
  { label: "Disks Monitored", value: "56", change: "3", trend: "up", tone: "blue", icon: "server", detail: "Across 24 servers" },
];

const diskUsageHistory = [
  { time: "12:00", used: 24, other: 48, free: 73 },
  { time: "14:00", used: 23, other: 47, free: 72 },
  { time: "16:00", used: 22, other: 47, free: 74 },
  { time: "18:00", used: 24, other: 48, free: 73 },
  { time: "20:00", used: 22, other: 46, free: 74 },
  { time: "22:00", used: 23, other: 47, free: 72 },
  { time: "00:00", used: 21, other: 45, free: 73 },
  { time: "02:00", used: 22, other: 46, free: 74 },
  { time: "04:00", used: 23, other: 47, free: 72 },
  { time: "06:00", used: 22, other: 46, free: 73 },
  { time: "08:00", used: 24, other: 48, free: 74 },
  { time: "10:00", used: 23, other: 47, free: 72 },
];

const throughputHistory = [
  { time: "12:00", read: 345, write: 142 }, { time: "14:00", read: 330, write: 151 },
  { time: "16:00", read: 372, write: 158 }, { time: "18:00", read: 418, write: 172 },
  { time: "20:00", read: 360, write: 149 }, { time: "22:00", read: 435, write: 188 },
  { time: "00:00", read: 390, write: 166 }, { time: "02:00", read: 455, write: 201 },
  { time: "04:00", read: 408, write: 180 }, { time: "06:00", read: 438, write: 210 },
  { time: "08:00", read: 421, write: 195 }, { time: "10:00", read: 449, write: 218 },
];

const iopsHistory = [
  { time: "12:00", read: 13200, write: 8800 }, { time: "14:00", read: 12500, write: 9200 },
  { time: "16:00", read: 14300, write: 8500 }, { time: "18:00", read: 15800, write: 10200 },
  { time: "20:00", read: 13900, write: 9100 }, { time: "22:00", read: 16600, write: 9800 },
  { time: "00:00", read: 14800, write: 8600 }, { time: "02:00", read: 15800, write: 10100 },
  { time: "04:00", read: 15000, write: 9200 }, { time: "06:00", read: 16400, write: 9900 },
  { time: "08:00", read: 15200, write: 8500 }, { time: "10:00", read: 16000, write: 9300 },
];

const disks = [
  { server: "web-01", mount: "/", filesystem: "xfs", capacity: "200 GB", used: "146.2 GB", usage: 73.1 },
  { server: "db-01", mount: "/var/lib/postgres", filesystem: "xfs", capacity: "500 GB", used: "321.5 GB", usage: 64.3 },
  { server: "app-server-02", mount: "/", filesystem: "ext4", capacity: "150 GB", used: "86.7 GB", usage: 57.8 },
  { server: "logs-01", mount: "/var/log", filesystem: "xfs", capacity: "300 GB", used: "143.9 GB", usage: 48.0 },
  { server: "backup-01", mount: "/backup", filesystem: "xfs", capacity: "2.00 TB", used: "812.3 GB", usage: 39.7 },
  { server: "cache-01", mount: "/cache", filesystem: "ext4", capacity: "250 GB", used: "78.4 GB", usage: 31.4 },
];

const diskIo = [
  { server: "db-01", disk: "/dev/nvme0n1", read: 152.4, write: 98.7, iops: "12.4K", usage: 64.3 },
  { server: "app-server-02", disk: "/dev/nvme1n1", read: 98.7, write: 86.2, iops: "10.1K", usage: 57.8 },
  { server: "web-01", disk: "/dev/sda1", read: 60.3, write: 40.1, iops: "6.2K", usage: 73.1 },
  { server: "cache-01", disk: "/dev/nvme0n1", read: 45.6, write: 35.2, iops: "4.8K", usage: 31.4 },
  { server: "logs-01", disk: "/dev/sdb1", read: 28.7, write: 22.9, iops: "3.1K", usage: 48.0 },
  { server: "backup-01", disk: "/dev/sdc1", read: 25.4, write: 18.6, iops: "2.6K", usage: 39.7 },
];

const storageSlices = [
  { name: "Used", value: 12.45, display: "12.45 TB (61.3%)", color: "#2878ed" },
  { name: "Free", value: 7.85, display: "7.85 TB (38.7%)", color: "#35b879" },
  { name: "Snapshots", value: 1.25, display: "1.25 TB (6.2%)", color: "#8a45df" },
  { name: "Other", value: 0.75, display: "0.75 TB (3.7%)", color: "#f39a12" },
];

const usageBands = [
  { name: "0% - 50%", value: 24, color: "#35b879" },
  { name: "50% - 75%", value: 18, color: "#2878ed" },
  { name: "75% - 90%", value: 8, color: "#f39a12" },
  { name: "90% - 100%", value: 6, color: "#ed3346" },
];

const fileSystems = [
  { name: "xfs", value: 42, color: "#35b879" },
  { name: "ext4", value: 30, color: "#8a45df" },
  { name: "ntfs", value: 12, color: "#f39a12" },
  { name: "btrfs", value: 8, color: "#2878ed" },
  { name: "other", value: 6, color: "#20b9d1" },
];

const topDiskUsage = [
  { name: "web-01", usage: 73.1, color: "bg-blue-500" }, { name: "db-01", usage: 64.3, color: "bg-emerald-500" },
  { name: "app-server-02", usage: 57.8, color: "bg-violet-500" }, { name: "logs-01", usage: 48.0, color: "bg-amber-500" },
  { name: "backup-01", usage: 39.7, color: "bg-cyan-500" },
];

const topThroughput = [
  { name: "db-01", value: 251, label: "251 MB/s", color: "bg-emerald-500" }, { name: "app-server-02", value: 185, label: "185 MB/s", color: "bg-violet-500" },
  { name: "web-01", value: 100, label: "100 MB/s", color: "bg-blue-500" }, { name: "cache-01", value: 81, label: "81 MB/s", color: "bg-rose-500" },
  { name: "logs-01", value: 51, label: "51 MB/s", color: "bg-amber-500" },
];

const alerts = [
  { text: "Disk usage high on web-01 (/dev/sda1)", ago: "2m ago", tone: "critical" },
  { text: "Disk I/O wait time high on db-01", ago: "8m ago", tone: "warning" },
  { text: "Disk usage high on app-server-02 (/)", ago: "12m ago", tone: "warning" },
  { text: "Disk space low on logs-01 (/var/log)", ago: "18m ago", tone: "warning" },
  { text: "Disk temperature high on backup-01", ago: "25m ago", tone: "info" },
];

function TrendChart({
  data,
  lines,
  max,
  ticks,
  formatter,
  area = false,
  bar = false,
}: {
  data: Record<string, string | number>[];
  lines: { key: string; name: string; color: string }[];
  max: number;
  ticks: number[];
  formatter?: (value: number) => string;
  area?: boolean;
  bar?: boolean;
}) {
  return (
    <div className="h-[165px] w-full pt-1">
      <ResponsiveContainer width="100%" height="100%">
        {bar ? (
          <BarChart data={data} margin={{ top: 4, right: 3, left: -19, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical />
            <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, max]} ticks={ticks} tickFormatter={formatter} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
            {lines.map((line) => <Bar key={line.key} dataKey={line.key} name={line.name} fill={line.color} radius={[3, 3, 0, 0]} maxBarSize={12} />)}
          </BarChart>
        ) : area ? (
          <AreaChart data={data} margin={{ top: 4, right: 3, left: -19, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical />
            <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, max]} ticks={ticks} tickFormatter={formatter} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
            {lines.map((line) => <Area key={line.key} dataKey={line.key} name={line.name} type="monotone" stroke={line.color} strokeWidth={1.4} fill={line.color} fillOpacity={0.07} dot={false} />)}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 4, right: 3, left: -19, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical />
            <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, max]} ticks={ticks} tickFormatter={formatter} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
            {lines.map((line) => <Line key={line.key} dataKey={line.key} name={line.name} type="monotone" stroke={line.color} strokeWidth={1.4} dot={{ r: 1.3 }} />)}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function StorageDonut() {
  return (
    <div className="flex h-[164px] items-center gap-2.5">
      <div className="relative h-[144px] w-[43%] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={storageSlices} dataKey="value" nameKey="name" innerRadius="63%" outerRadius="88%" paddingAngle={1} stroke="none">
              {storageSlices.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className="font-display text-[17px] font-extrabold leading-tight text-foreground">20.30 TB</b>
          <span className="text-[12px] text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {storageSlices.map((item) => <div key={item.name} className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-1.5 text-[12px]"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate text-foreground">{item.name}</span><b className="whitespace-nowrap text-foreground">{item.display}</b></div>)}
      </div>
    </div>
  );
}

function DistributionDonut({ data, total, label }: { data: typeof usageBands; total: number; label: string }) {
  return (
    <div className="flex h-[180px] w-full max-w-[380px] items-center justify-center gap-2.5">
      <div className="relative h-[158px] w-[50%] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={data} dataKey="value" innerRadius="60%" outerRadius="88%" paddingAngle={1} stroke="none">{data.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[24px] font-extrabold text-foreground">{total}</b><span className="text-[13px] text-muted-foreground">{label}</span></div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {data.map((item) => <div key={item.name} className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-1.5 text-[12px]"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="whitespace-nowrap text-foreground">{item.name.replace(" - ", "–")}</span><span className="whitespace-nowrap text-right tabular-nums text-foreground">{item.value} ({Math.round(item.value / total * 100)}%)</span></div>)}
      </div>
    </div>
  );
}

function TopDiskBars({ items, throughput = false }: { items: { name: string; usage?: number; value?: number; label?: string; color: string }[]; throughput?: boolean }) {
  const max = Math.max(...items.map((item) => item.usage ?? item.value ?? 0));
  return (
    <div className="flex flex-1 items-center justify-center py-3">
      <div className="w-full translate-y-2 space-y-3 pt-1">
        {items.map((item) => {
          const value = item.usage ?? item.value ?? 0;
          return <div key={item.name} className="grid grid-cols-[minmax(0,1fr)_minmax(38px,1fr)_42px] items-center gap-2 text-[11px]"><span className="truncate text-foreground">{item.name}</span><div className="h-[7px] rounded-full bg-muted"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${value / max * 100}%` }} /></div><b className="text-right text-foreground">{throughput ? item.label : `${item.usage}%`}</b></div>;
        })}
      </div>
    </div>
  );
}

export function DiskStorageDashboard() {
  const [notice, setNotice] = useState("");
  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const exportCsv = () => {
    const header = ["Server Name", "Mount Point", "Filesystem", "Capacity", "Used", "Usage"];
    const rows = disks.map((disk) => [disk.server, disk.mount, disk.filesystem, disk.capacity, disk.used, `${disk.usage}%`]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "disk-storage.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast("Disk and storage data exported.");
  };
  const timeAction = (
    <div className="flex items-center gap-0.5">
      <select aria-label="Aggregation" className="h-6 rounded border border-border bg-card px-1 text-[11px] text-foreground"><option>Average</option><option>Maximum</option><option>Minimum</option></select>
      {["1H", "6H", "12H", "24H"].map((item) => <button key={item} onClick={() => toast(`${item} time range selected.`)} className={`rounded px-1.5 py-1 text-[11px] font-semibold ${item === "24H" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{item}</button>)}
    </div>
  );

  return (
    <div className="space-y-2.5 pb-3">
      <PageMeta breadcrumbs={["Monitoring", "Disk & Storage"]} showRefresh={false} variant="detail" />
      <PageHeading title="Disk & Storage" description="Monitor disk usage, storage performance, and I/O metrics across your infrastructure in real-time." actionsAlign="top" variant="detail">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Download size={15} />Export CSV</Button>
          <Button size="sm" onClick={() => toast("Add Widget is a mockup action.")} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Plus size={15} />Add Widget</Button>
        </div>
      </PageHeading>

      <section aria-label="Storage summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[100px]" labelClassName="text-[12px] leading-4" valueClassName="text-[24px] leading-7" trendClassName="text-[11px] leading-4" />)}
      </section>

      <section aria-label="Storage trends" className="grid gap-2.5 xl:grid-cols-3">
        <Panel title="Disk Usage Over Time" className="min-w-0" action={timeAction}>
          <TrendChart data={diskUsageHistory} lines={[{ key: "used", name: "Used", color: "#2878ed" }, { key: "other", name: "Other", color: "#f39a12" }, { key: "free", name: "Free", color: "#35b879" }]} max={100} ticks={[0, 25, 50, 75, 100]} formatter={(value) => `${value}%`} area />
          <div className="flex justify-center gap-4 pt-1 text-[12px] text-muted-foreground">{[["Used", "#2878ed"], ["Other", "#f39a12"], ["Free", "#35b879"]].map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>)}</div>
        </Panel>
        <Panel title="I/O Throughput Over Time" className="min-w-0" action={timeAction}>
          <TrendChart data={throughputHistory} lines={[{ key: "read", name: "Read (MB/s)", color: "#2878ed" }, { key: "write", name: "Write (MB/s)", color: "#35b879" }]} max={600} ticks={[0, 150, 300, 450, 600]} formatter={(value) => value === 0 ? "0 B/s" : `${value} MB/s`} area />
          <div className="flex justify-center gap-4 pt-1 text-[12px] text-muted-foreground">{[["Read (MB/s)", "#2878ed"], ["Write (MB/s)", "#35b879"]].map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>)}</div>
        </Panel>
        <Panel title="I/O Operations (IOPS) Over Time" className="min-w-0" action={timeAction}>
          <TrendChart data={iopsHistory} lines={[{ key: "read", name: "Read IOPS", color: "#2878ed" }, { key: "write", name: "Write IOPS", color: "#35b879" }]} max={20000} ticks={[0, 5000, 10000, 15000, 20000]} formatter={(value) => value === 0 ? "0" : `${value / 1000}K`} bar />
          <div className="flex justify-center gap-4 pt-1 text-[12px] text-muted-foreground">{[["Read IOPS", "#2878ed"], ["Write IOPS", "#35b879"]].map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>)}</div>
        </Panel>
      </section>

      <section aria-label="Disk details" className="grid gap-2.5 xl:grid-cols-[1.14fr_1.04fr_0.82fr]">
        <Panel title="Top Disks by Usage" className="min-w-0" action={<button onClick={() => toast("Showing all disks by usage.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[680px] text-left text-[12px]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Server Name", "Mount Point", "Filesystem", "Capacity", "Used", "Usage", "Trend"].map((heading) => <th key={heading} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{disks.map((disk, index) => <tr key={disk.server} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1 py-[5px] font-semibold text-primary">{disk.server}</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{disk.mount}</td><td className="px-1 py-[5px] text-foreground">{disk.filesystem}</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{disk.capacity}</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{disk.used}</td><td className="px-1 py-[5px] text-foreground">{disk.usage}%</td><td className="px-1 py-[5px]"><svg viewBox="0 0 52 18" className="h-4 w-10" aria-label={`Usage trend for ${disk.server}`}><polyline points={`${index},14 9,${12 - index % 4} 18,${13 - index % 5} 27,${6 + index % 5} 36,${9 - index % 4} 50,${3 + index % 5}`} fill="none" stroke={disk.usage > 60 ? "#ef4444" : disk.usage > 50 ? "#f97316" : "#22bd83"} strokeWidth="1.3" /></svg></td></tr>)}</tbody>
            </table>
          </div>
          <div className="flex justify-between pt-1 text-[11px] text-muted-foreground"><span>Showing 1-6 of 56 disks</span><span>Rows per page:　10　‹　<span className="rounded bg-primary px-1 text-white">1</span>　2　3　…　›</span></div>
        </Panel>

        <Panel title="Top Disks by I/O Activity" className="min-w-0" action={<button onClick={() => toast("Showing all disks by I/O activity.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[600px] text-left text-[12px]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Server Name", "Disk", "Read (MB/s)", "Write (MB/s)", "IOPS", "Usage"].map((heading) => <th key={heading} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{diskIo.map((disk) => <tr key={disk.server} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1 py-[6px] font-semibold text-primary">{disk.server}</td><td className="whitespace-nowrap px-1 py-[6px] text-foreground">{disk.disk}</td><td className="px-1 py-[6px] text-foreground">{disk.read.toFixed(1)}</td><td className="px-1 py-[6px] text-foreground">{disk.write.toFixed(1)}</td><td className="px-1 py-[6px] text-foreground">{disk.iops}</td><td className="px-1 py-[6px] text-foreground">{disk.usage}%</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Current Storage Summary" className="min-w-0">
          <StorageDonut />
          <div className="grid grid-cols-3 gap-1 border-t border-border pt-2 text-[11px]">
            {[["Total Disks", "56"], ["Total Partitions", "112"], ["Total File Systems", "98"]].map(([label, value]) => <div key={label}><div className="text-muted-foreground">{label}</div><b className="mt-1 block text-[11px] text-foreground">{value}</b></div>)}
          </div>
        </Panel>
      </section>

      <section aria-label="Storage breakdown and alerts" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <Panel title="Disk Usage Distribution" className="min-w-0"><div className="flex min-h-[220px] flex-1 items-center justify-center"><DistributionDonut data={usageBands} total={56} label="Disks" /></div></Panel>
        <Panel title="File System Distribution" className="min-w-0"><div className="flex min-h-[220px] flex-1 items-center justify-center"><DistributionDonut data={fileSystems} total={98} label="File Systems" /></div></Panel>
        <Panel title="Top Servers by Disk Usage" className="min-w-0" action={<button onClick={() => toast("Showing all servers by disk usage.")} className="text-[12px] font-semibold text-primary">View All →</button>}><TopDiskBars items={topDiskUsage} /></Panel>
        <Panel title="Top Servers by I/O Throughput" className="min-w-0" action={<button onClick={() => toast("Showing all servers by I/O throughput.")} className="text-[12px] font-semibold text-primary">View All →</button>}><TopDiskBars items={topThroughput} throughput /></Panel>
        <Panel title="Recent Alerts" className="min-w-0" action={<button onClick={() => toast("Showing all disk alerts.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="space-y-2.5 pt-1.5">{alerts.map((alert) => <div key={alert.text} className="grid grid-cols-[9px_minmax(0,1fr)_34px] items-center gap-1 text-[11px]"><i className={`grid h-2 w-2 place-items-center rounded-full text-white ${alert.tone === "critical" ? "bg-rose-500" : alert.tone === "warning" ? "bg-amber-500" : "bg-purple-500"}`}>{alert.tone === "critical" ? "×" : alert.tone === "warning" ? "!" : "i"}</i><span className="truncate font-semibold text-foreground">{alert.text}</span><span className="text-right text-muted-foreground">{alert.ago}</span></div>)}</div>
        </Panel>
      </section>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
