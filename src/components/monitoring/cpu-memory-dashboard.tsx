"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AppWindow, ArrowDown, ArrowUp, Cog, Database, Download, Globe, Info, Network, Plus, Server, Zap,
  type LucideIcon,
} from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MetricStat } from "@/data/mock/dashboard";
import { memoryUsedGb, serverResourceMetrics, type ServerResourceMetrics } from "@/data/mock/servers";
import { cn } from "@/lib/utils";

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

const ROWS_PER_PAGE_OPTIONS = [8, 16, 32];

/**
 * Usage severity bands. The bar colour follows these thresholds while the
 * percentage itself always stays in the regular foreground colour so the
 * tables stay calm and readable.
 */
const USAGE_LEGEND = [
  { label: "Critical (>85%)", light: "bg-[#ef4444]", dark: "bg-[#f87171]" },
  { label: "High (70–85%)", light: "bg-[#f59e0b]", dark: "bg-[#fbbf24]" },
  { label: "Normal", light: "bg-[#3b82f6]", dark: "bg-[#60a5fa]" },
];

/** Bar colours per severity band, with muted dark-mode variants. */
function usageBarColor(value: number): string {
  if (value > 85) return "bg-[#ef4444] dark:bg-[#f87171]";
  if (value >= 70) return "bg-[#f59e0b] dark:bg-[#fbbf24]";
  return "bg-[#3b82f6] dark:bg-[#60a5fa]";
}

/** Usage percentage with a small threshold-coloured progress bar. */
function UsageCell({ value }: { value: number }) {
  return (
    <span className="flex items-center justify-end gap-2 whitespace-nowrap">
      <span className="font-medium tabular-nums text-foreground">{value.toFixed(1)}%</span>
      <span className="h-[5px] w-[110px] shrink-0 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", usageBarColor(value))} style={{ width: `${Math.min(value, 100)}%` }} />
      </span>
    </span>
  );
}

/** Breakdown segments for the CPU stacked bar. */
const CPU_BREAKDOWN_SEGMENTS = [
  { label: "User", color: "bg-[#2878ed] dark:bg-[#60a5fa]" },
  { label: "System", color: "bg-[#8a45df] dark:bg-[#a78bfa]" },
  { label: "I/O Wait", color: "bg-[#f39a12] dark:bg-[#fbbf24]" },
];

/** Stacked bar summarising user / system / I/O wait split of CPU time. */
function CpuBreakdown({ server }: { server: ServerResourceMetrics }) {
  const total = server.user + server.system + server.ioWait;
  const values = [server.user, server.system, server.ioWait];
  return (
    <span
      title={`User ${server.user.toFixed(1)}% · System ${server.system.toFixed(1)}% · I/O Wait ${server.ioWait.toFixed(1)}%`}
      className="flex h-[5px] w-[100px] shrink-0 overflow-hidden rounded-full bg-muted"
    >
      {CPU_BREAKDOWN_SEGMENTS.map((segment, index) => (
        <span
          key={segment.label}
          className={cn("block h-full", segment.color)}
          style={{ width: `${total ? (values[index] / total) * 100 : 0}%` }}
        />
      ))}
    </span>
  );
}

/** Info affordance explaining the CPU breakdown bar colours. */
function BreakdownInfo() {
  return (
    <span
      title="User (blue) · System (purple) · I/O Wait (orange) — hover a row for exact percentages"
      className="inline-flex"
    >
      <Info size={11} aria-label="Breakdown legend: User, System, I/O Wait" className="cursor-help text-muted-foreground/70 transition-colors hover:text-foreground" />
    </span>
  );
}

/** Server role -> icon and brand colour used in the Server Name column. */
const roleIcons: Record<string, { icon: LucideIcon; color: string }> = {
  web: { icon: Globe, color: "#6366F1" },
  db: { icon: Database, color: "#8B5CF6" },
  app: { icon: AppWindow, color: "#14B8A6" },
  gw: { icon: Network, color: "#06B6D4" },
  worker: { icon: Cog, color: "#64748B" },
  monitor: { icon: Activity, color: "#EC4899" },
  cache: { icon: Zap, color: "#84CC16" },
};

/** Human readable role labels used for the icon tooltip. */
const roleLabels: Record<string, string> = {
  web: "Web",
  db: "Database",
  app: "Application",
  gw: "Gateway",
  worker: "Worker",
  monitor: "Monitoring",
  cache: "Cache",
};

/**
 * Resolves the role icon for a server: the explicit role wins, otherwise the
 * name prefix is used. Unknown roles fall back to a generic server icon.
 */
function roleIconFor(server: ServerResourceMetrics): { icon: LucideIcon; color: string; label: string } {
  const role = server.role || server.name.split("-")[0];
  const entry = roleIcons[role];
  const label = roleLabels[role] ?? role;
  if (!entry) return { icon: Server, color: "#64748B", label: label || "Server" };
  return { ...entry, label };
}

/** Server name cell with a soft tinted role icon badge. */
function ServerNameCell({ server }: { server: ServerResourceMetrics }) {
  const { icon: RoleIcon, color, label } = roleIconFor(server);
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        title={label}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[color-mix(in_srgb,var(--role-color)_12%,transparent)] dark:bg-[color-mix(in_srgb,var(--role-color)_20%,transparent)]"
        style={{ "--role-color": color, color } as CSSProperties}
      >
        <RoleIcon size={16} aria-label={`${label} server`} />
      </span>
      <span className="truncate font-medium text-slate-800 transition-colors hover:text-primary hover:underline dark:text-slate-100">{server.name}</span>
    </span>
  );
}

type SortKey = "name" | "cpu" | "memory" | "cores" | "load" | "used" | "cached" | "free" | "swap";

/** Clickable table header that toggles ascending / descending sorting. */
function SortableHeader({ label, sortKey, activeKey, direction, onSort, align = "left", children }: {
  label: string; sortKey: SortKey; activeKey: SortKey; direction: "asc" | "desc"; onSort: (key: SortKey) => void; align?: "left" | "right"; children?: React.ReactNode;
}) {
  const isActive = activeKey === sortKey;
  return (
    <th scope="col" className={cn("whitespace-nowrap px-1 pb-1.5 text-[11px] font-medium text-muted-foreground", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive && "text-foreground",
        )}
      >
        {label}
        {isActive && (direction === "asc" ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />)}
        {children}
      </button>
    </th>
  );
}

/** Legend describing the usage severity bands used by the bars. */
function UsageLegend() {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {USAGE_LEGEND.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <i aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", item.light, item.dark)} />
          {item.label}
        </span>
      ))}
    </span>
  );
}

/** Pagination footer shared by both server tables. */
function TablePagination({ page, pageCount, rowsPerPage, onPageChange, onRowsPerPageChange, total }: {
  page: number; pageCount: number; rowsPerPage: number; onPageChange: (page: number) => void; onRowsPerPageChange: (rows: number) => void; total: number;
}) {
  const from = total ? (page - 1) * rowsPerPage + 1 : 0;
  const to = Math.min(page * rowsPerPage, total);
  return (
    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-[12px] text-muted-foreground">
      <UsageLegend />
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-2 whitespace-nowrap">Showing {from}-{to} of {total} servers</span>
        <label className="mr-1 flex items-center gap-1 whitespace-nowrap">
          Rows per page:
          <Select value={String(rowsPerPage)} onValueChange={(value) => onRowsPerPageChange(Number(value))}>
            <SelectTrigger aria-label="Rows per page" className="h-7 w-[62px] text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>{ROWS_PER_PAGE_OPTIONS.map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        {Array.from({ length: Math.min(5, Math.max(1, pageCount)) }, (_, index) => index + 1).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onPageChange(value)}
            aria-current={page === value ? "page" : undefined}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              page === value ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent hover:text-foreground",
            )}
          >
            {value}
          </button>
        ))}
        {pageCount > 5 && <span aria-hidden="true">…</span>}
        {pageCount > 5 && (
          <button type="button" onClick={() => onPageChange(pageCount)} className="grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-accent hover:text-foreground">
            {pageCount}
          </button>
        )}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page === pageCount}
          aria-label="Next page"
          className="grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowDown size={12} aria-hidden="true" className="-rotate-90" />
        </button>
      </div>
    </div>
  );
}

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
  const [cpuSort, setCpuSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "cpu", direction: "desc" });
  const [memorySort, setMemorySort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "memory", direction: "desc" });
  const [cpuPage, setCpuPage] = useState(1);
  const [memoryPage, setMemoryPage] = useState(1);
  const [cpuRowsPerPage, setCpuRowsPerPage] = useState(8);
  const [memoryRowsPerPage, setMemoryRowsPerPage] = useState(8);

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const sortedCpuServers = useMemo(() => {
    const direction = cpuSort.direction === "asc" ? 1 : -1;
    return [...serverResourceMetrics].sort((a, b) => {
      if (cpuSort.key === "name") return a.name.localeCompare(b.name) * direction;
      const left = cpuSort.key === "cpu" ? a.cpu : a[cpuSort.key as keyof ServerResourceMetrics] as number;
      const right = cpuSort.key === "cpu" ? b.cpu : b[cpuSort.key as keyof ServerResourceMetrics] as number;
      return (left - right) * direction;
    });
  }, [cpuSort]);

  const sortedMemoryServers = useMemo(() => {
    const direction = memorySort.direction === "asc" ? 1 : -1;
    return [...serverResourceMetrics].sort((a, b) => {
      if (memorySort.key === "name") return a.name.localeCompare(b.name) * direction;
      const value = (server: ServerResourceMetrics): number => {
        switch (memorySort.key) {
          case "memory": return server.memory;
          case "used": return memoryUsedGb(server);
          case "cached": return server.memoryCached;
          case "free": return server.memoryFree;
          case "swap": return server.swap;
          default: return 0;
        }
      };
      return (value(a) - value(b)) * direction;
    });
  }, [memorySort]);

  const cpuPageCount = Math.max(1, Math.ceil(sortedCpuServers.length / cpuRowsPerPage));
  const memoryPageCount = Math.max(1, Math.ceil(sortedMemoryServers.length / memoryRowsPerPage));
  const visibleCpuServers = sortedCpuServers.slice((cpuPage - 1) * cpuRowsPerPage, cpuPage * cpuRowsPerPage);
  const visibleMemoryServers = sortedMemoryServers.slice((memoryPage - 1) * memoryRowsPerPage, memoryPage * memoryRowsPerPage);

  function toggleSort(current: { key: SortKey; direction: "asc" | "desc" }, key: SortKey, setSort: (value: { key: SortKey; direction: "asc" | "desc" }) => void, resetPage: () => void) {
    setSort(current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" });
    resetPage();
  }

  const exportCsv = () => {
    const header = ["Server", "CPU Usage", "User CPU", "System CPU", "I/O Wait", "Cores", "Load Average", "Memory Usage", "Memory Used", "Cached", "Free", "Swap"];
    const rows = sortedCpuServers.map((server) => [
      server.name,
      `${server.cpu}%`,
      `${server.user}%`,
      `${server.system}%`,
      `${server.ioWait}%`,
      String(server.cores),
      String(server.load),
      `${server.memory}%`,
      `${memoryUsedGb(server)} GB / ${server.memoryTotal} GB`,
      `${server.memoryCached} GB`,
      `${server.memoryFree} GB`,
      `${server.swap}%`,
    ]);
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

      <section aria-label="Top CPU and memory servers" className="grid items-stretch gap-2.5 xl:grid-cols-2">
        <Panel title="Top Servers by CPU Usage" className="flex min-w-0 flex-col p-3.5" action={<button onClick={() => toast("Showing all servers by CPU usage.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="flex min-h-0 flex-1 flex-col pt-1">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[560px] table-fixed text-left text-[12.5px]">
                <colgroup>
                  <col style={{ width: "26%" }} /><col style={{ width: "30%" }} /><col style={{ width: "24%" }} />
                  <col style={{ width: "9%" }} /><col style={{ width: "11%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <SortableHeader label="Server Name" sortKey="name" activeKey={cpuSort.key} direction={cpuSort.direction} onSort={(key) => toggleSort(cpuSort, key, setCpuSort, () => setCpuPage(1))} />
                    <SortableHeader label="CPU Usage" sortKey="cpu" activeKey={cpuSort.key} direction={cpuSort.direction} onSort={(key) => toggleSort(cpuSort, key, setCpuSort, () => setCpuPage(1))} align="right" />
                    <th scope="col" className="whitespace-nowrap px-1 pb-1.5 text-[11px] font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">Breakdown<BreakdownInfo /></span>
                    </th>
                    <SortableHeader label="Cores" sortKey="cores" activeKey={cpuSort.key} direction={cpuSort.direction} onSort={(key) => toggleSort(cpuSort, key, setCpuSort, () => setCpuPage(1))} align="right" />
                    <SortableHeader label="Load Avg" sortKey="load" activeKey={cpuSort.key} direction={cpuSort.direction} onSort={(key) => toggleSort(cpuSort, key, setCpuSort, () => setCpuPage(1))} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {visibleCpuServers.map((server) => (
                    <tr key={server.name} className="h-[34px] border-b border-border/70 transition-colors last:border-0 hover:bg-muted/50">
                      <td className="px-1"><ServerNameCell server={server} /></td>
                      <td className="px-1 text-right"><UsageCell value={server.cpu} /></td>
                      <td className="px-1"><CpuBreakdown server={server} /></td>
                      <td className="px-1 text-right font-normal tabular-nums text-muted-foreground">{server.cores}</td>
                      <td className="px-1 text-right font-normal tabular-nums text-muted-foreground">{server.load.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={cpuPage}
              pageCount={cpuPageCount}
              rowsPerPage={cpuRowsPerPage}
              total={sortedCpuServers.length}
              onPageChange={setCpuPage}
              onRowsPerPageChange={(rows) => { setCpuRowsPerPage(rows); setCpuPage(1); }}
            />
          </div>
        </Panel>

        <Panel title="Top Servers by Memory Usage" className="flex min-w-0 flex-col p-3.5" action={<button onClick={() => toast("Showing all servers by memory usage.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="flex min-h-0 flex-1 flex-col pt-1">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[560px] table-fixed text-left text-[12.5px]">
                <colgroup>
                  <col style={{ width: "26%" }} /><col style={{ width: "30%" }} /><col style={{ width: "17%" }} />
                  <col style={{ width: "9%" }} /><col style={{ width: "9%" }} /><col style={{ width: "9%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <SortableHeader label="Server Name" sortKey="name" activeKey={memorySort.key} direction={memorySort.direction} onSort={(key) => toggleSort(memorySort, key, setMemorySort, () => setMemoryPage(1))} />
                    <SortableHeader label="Memory Usage" sortKey="memory" activeKey={memorySort.key} direction={memorySort.direction} onSort={(key) => toggleSort(memorySort, key, setMemorySort, () => setMemoryPage(1))} align="right" />
                    <SortableHeader label="Used / Total" sortKey="used" activeKey={memorySort.key} direction={memorySort.direction} onSort={(key) => toggleSort(memorySort, key, setMemorySort, () => setMemoryPage(1))} align="right" />
                    <SortableHeader label="Cached" sortKey="cached" activeKey={memorySort.key} direction={memorySort.direction} onSort={(key) => toggleSort(memorySort, key, setMemorySort, () => setMemoryPage(1))} align="right" />
                    <SortableHeader label="Free" sortKey="free" activeKey={memorySort.key} direction={memorySort.direction} onSort={(key) => toggleSort(memorySort, key, setMemorySort, () => setMemoryPage(1))} align="right" />
                    <SortableHeader label="Swap" sortKey="swap" activeKey={memorySort.key} direction={memorySort.direction} onSort={(key) => toggleSort(memorySort, key, setMemorySort, () => setMemoryPage(1))} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {visibleMemoryServers.map((server) => (
                    <tr key={server.name} className="h-[34px] border-b border-border/70 transition-colors last:border-0 hover:bg-muted/50">
                      <td className="px-1"><ServerNameCell server={server} /></td>
                      <td className="px-1 text-right"><UsageCell value={server.memory} /></td>
                      <td className="whitespace-nowrap px-1 text-right font-normal tabular-nums text-muted-foreground">{memoryUsedGb(server)} / {server.memoryTotal} GB</td>
                      <td className="whitespace-nowrap px-1 text-right font-normal tabular-nums text-muted-foreground" title={`${server.memoryCached} GB cached`}>{server.memoryCached} GB</td>
                      <td className="whitespace-nowrap px-1 text-right font-normal tabular-nums text-muted-foreground" title={`${server.memoryFree} GB free`}>{server.memoryFree} GB</td>
                      <td className="whitespace-nowrap px-1 text-right font-normal tabular-nums text-muted-foreground">{server.swap.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={memoryPage}
              pageCount={memoryPageCount}
              rowsPerPage={memoryRowsPerPage}
              total={sortedMemoryServers.length}
              onPageChange={setMemoryPage}
              onRowsPerPageChange={(rows) => { setMemoryRowsPerPage(rows); setMemoryPage(1); }}
            />
          </div>
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
