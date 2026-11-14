"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, Boxes, Check, ChevronDown, Cloud, Cpu, Database, Download, Globe2,
  HardDrive, Layers3, LayoutGrid, List, MapPin, Monitor, MoreVertical, Plus,
  RefreshCw, Server, Settings2, Shield, ShieldCheck, Sparkles, Users, X,
  type LucideIcon,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Sector, Tooltip, XAxis, YAxis,
  type SectorProps,
} from "recharts";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  groupEvents, groupHealthTrend, groupPerformance, serverGroups as initialGroups,
  type GroupEnvironment, type GroupEvent, type GroupStatus, type PerformanceMetric, type ServerGroup,
} from "@/data/mock/server-groups";
import { cn } from "@/lib/utils";

const statusColor: Record<GroupStatus, string> = {
  Healthy: "oklch(0.7227 0.192 149.58)",
  Degraded: "oklch(0.7686 0.1647 70.08)",
  Offline: "oklch(0.6368 0.2078 25.33)",
};

const statusTone: Record<GroupStatus, string> = {
  Healthy: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Degraded: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Offline: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

const iconByName: Record<ServerGroup["icon"], LucideIcon> = {
  globe: Globe2,
  database: Database,
  cube: Boxes,
  monitor: Monitor,
  gear: Settings2,
  layers: Layers3,
  shield: Shield,
  cloud: Cloud,
  server: Server,
  cache: HardDrive,
  edge: Globe2,
  internal: Settings2,
  loadbalancer: Activity,
};

const iconTone: Record<ServerGroup["icon"], string> = {
  globe: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
  database: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300",
  cube: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
  monitor: "bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300",
  gear: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300",
  layers: "bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-300",
  shield: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300",
  cloud: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
  server: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
  cache: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
  edge: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-300",
  internal: "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300",
  loadbalancer: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
};

const chartTooltip = {
  contentStyle: { border: "0.0625rem solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)", color: "var(--popover-foreground)" },
};

const environments: (GroupEnvironment | "All Environments")[] = ["All Environments", "Production", "Staging", "Dev"];
const statuses: (GroupStatus | "All Status")[] = ["All Status", "Healthy", "Degraded", "Offline"];
const performanceMetrics: PerformanceMetric[] = ["CPU Usage", "Memory Usage", "Disk Usage", "Network Usage"];
const healthRanges = ["24h", "7d", "30d"] as const;
type HealthRange = (typeof healthRanges)[number];

interface HealthTrendPoint {
  time: string;
  healthy: number;
  degraded: number;
  offline: number;
}

interface GroupPerformancePoint {
  time: string;
  production: number;
  database: number;
  api: number;
}

const performanceSeries = [
  { key: "production" as const, name: "Production Web", groupId: "production-web", color: "oklch(0.5855 0.1885 255.72)" },
  { key: "database" as const, name: "Database Cluster", groupId: "database-cluster", color: "oklch(0.5571 0.2214 299.62)" },
  { key: "api" as const, name: "API Services", groupId: "api-services", color: "oklch(0.694 0.1607 156.12)" },
];

function GroupPerformanceTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ payload?: GroupPerformancePoint }>;
  label?: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="min-w-40 rounded-lg border border-border bg-popover px-3 py-2.5 text-[0.75rem] text-popover-foreground shadow-lg">
      <p className="mb-2 font-semibold">{label}</p>
      {performanceSeries.map((series) => <div key={series.key} className="flex items-center gap-2 py-0.5"><i className="h-2 w-2 rounded-full" style={{ background: series.color }} /><span className="text-muted-foreground">{series.name}</span><b className="ml-auto tabular-nums">{point[series.key]}%</b></div>)}
    </div>
  );
}

function HealthTrendTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ payload?: HealthTrendPoint }>;
  label?: string;
}) {
  const point = payload?.[0]?.payload;
  const total = point ? point.healthy + point.degraded + point.offline : 0;
  if (!active || !point || !total) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2.5 text-[0.75rem] text-popover-foreground shadow-lg">
      <p className="mb-2 font-semibold">{label}</p>
      {(["healthy", "degraded", "offline"] as const).map((key) => {
        const name = key === "healthy" ? "Healthy" : key === "degraded" ? "Degraded" : "Offline";
        const color = key === "healthy" ? statusColor.Healthy : key === "degraded" ? statusColor.Degraded : statusColor.Offline;
        const percentage = (point[key] / total) * 100;
        return <div key={key} className="flex min-w-36 items-center gap-2 py-0.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /><span className="text-muted-foreground">{name}</span><b className="ml-auto tabular-nums">{percentage.toFixed(1)}%</b></div>;
      })}
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 100;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = points.join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      <polygon points={`0,${height} ${line} ${width},${height}`} fill={color} fillOpacity={0.12} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function StatusPill({ status }: { status: GroupStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold", statusTone[status])}>
      <i aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor[status] }} />
      {status}
    </span>
  );
}

function SectionCard({ title, icon: Icon, children, action, className = "" }: {
  title: string; icon: LucideIcon; children: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  const compactHeader = className.includes("p-4");
  return (
    <Card className={cn("flex h-full min-w-0 flex-col rounded-xl p-5", className)}>
      <div className={cn("mb-4 flex shrink-0 items-center justify-between gap-3", compactHeader && "mb-3 min-h-10")}>
        <CardTitle className={cn("flex items-center gap-2 text-[1.125rem] font-semibold", compactHeader && "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap")}>
          <Icon size={18} className="shrink-0 text-primary" />
          {title}
        </CardTitle>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  );
}

function KpiCard({ icon: Icon, label, value, trend, tone, trendUp = true }: {
  icon: LucideIcon; label: string; value: string; trend: string; tone: string; trendUp?: boolean;
}) {
  return (
    <StatCard icon={<Icon size={20} />} label={label} value={value} trend={trend} iconTone={tone} trendClassName={trendUp ? "text-emerald-600" : "text-muted-foreground"} />
  );
}

function GroupCard({ group, selected, onSelect, onMenu }: {
  group: ServerGroup; selected: boolean; onSelect: () => void; onMenu: () => void;
}) {
  const GroupIcon = iconByName[group.icon];
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View ${group.name}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex h-full min-w-0 cursor-pointer flex-col rounded-xl border bg-card p-4 text-left transition-[box-shadow,border-color] duration-200 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary shadow-lg" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span aria-hidden="true" className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", iconTone[group.icon])}>
            <GroupIcon size={17} />
          </span>
          <span title={group.name} className="min-w-0 flex-1 truncate whitespace-nowrap text-[0.9375rem] font-semibold leading-5 text-foreground">{group.name}</span>
        </div>
        <button
          type="button"
          aria-label={`Actions for ${group.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onMenu();
          }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill status={group.status} />
        <span className="text-[0.8125rem] font-semibold text-foreground">{group.servers} Servers</span>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
        <MapPin size={12} aria-hidden="true" />
        {group.location}
      </p>

      <div className="mt-auto flex items-end gap-2 pt-3">
        <div className="min-w-0 flex-1">
          <Sparkline values={group.trend} color={statusColor[group.status]} />
        </div>
        <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[0.8125rem] font-semibold", statusTone[group.status])}>
          {group.health.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function GroupListRow({ group, selected, onSelect }: { group: ServerGroup; selected: boolean; onSelect: () => void }) {
  const GroupIcon = iconByName[group.icon];
  return (
    <tr
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "h-[3.375rem] cursor-pointer border-b border-border/70 text-[0.875rem] transition-colors last:border-0 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        selected && "bg-primary/5",
      )}
    >
      <td className="px-3 py-2">
        <span className="flex items-center gap-2.5 font-semibold text-foreground">
          <span aria-hidden="true" className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", iconTone[group.icon])}>
            <GroupIcon size={16} />
          </span>
          {group.name}
        </span>
      </td>
      <td className="px-3 py-2"><StatusPill status={group.status} /></td>
      <td className="px-3 py-2 text-center tabular-nums">{group.servers}</td>
      <td className="px-3 py-2 text-muted-foreground">{group.location}</td>
      <td className="px-3 py-2 text-muted-foreground">{group.environment}</td>
      <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">{group.health.toFixed(1)}%</td>
    </tr>
  );
}

function CreateGroupDialog({ open, onOpenChange, onCreate }: {
  open: boolean; onOpenChange: (open: boolean) => void; onCreate: (name: string, location: string, environment: GroupEnvironment) => void;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("AWS – Virginia");
  const [environment, setEnvironment] = useState<GroupEnvironment>("Production");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    onCreate(cleanName, location, environment);
    setName("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Server Group</DialogTitle>
          <DialogDescription>Add a group to organize and monitor your servers.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-2 text-[0.8125rem] font-medium text-muted-foreground">
            Group name
            <Input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Production Web" className="h-10 text-[0.875rem]" />
          </label>
          <label className="block space-y-2 text-[0.8125rem] font-medium text-muted-foreground">
            Location
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger aria-label="Group location" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["AWS – Virginia", "AWS – Ohio", "AWS – Frankfurt", "AWS – Ireland", "DigitalOcean – NYC", "Vultr – Tokyo", "Hetzner – Germany", "Ubuntu – London"].map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-2 text-[0.8125rem] font-medium text-muted-foreground">
            Environment
            <Select value={environment} onValueChange={(value) => setEnvironment(value as GroupEnvironment)}>
              <SelectTrigger aria-label="Group environment" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["Production", "Staging", "Dev"] as GroupEnvironment[]).map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit"><Plus size={16} />Create Group</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ServerGroupsDashboard() {
  const [groups, setGroups] = useState(initialGroups);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All Status");
  const [locationFilter, setLocationFilter] = useState<string>("All Locations");
  const [environmentFilter, setEnvironmentFilter] = useState<string>("All Environments");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [visibleGroupCount, setVisibleGroupCount] = useState(12);
  const [selectedId, setSelectedId] = useState<string>("");
  const [performanceMetric, setPerformanceMetric] = useState<PerformanceMetric>("CPU Usage");
  const [performanceRange, setPerformanceRange] = useState<"24h" | "7d">("24h");
  const [visiblePerformanceSeries, setVisiblePerformanceSeries] = useState<Record<string, boolean>>({ production: true, database: true, api: true });
  const [eventFilter, setEventFilter] = useState<"All" | "Open" | "Resolved">("All");
  const [trendRange, setTrendRange] = useState<HealthRange>("24h");
  const [hoveredHealthStatus, setHoveredHealthStatus] = useState<GroupStatus | null>(null);
  const [visibleHealthSeries, setVisibleHealthSeries] = useState<Record<GroupStatus, boolean>>({ Healthy: true, Degraded: true, Offline: true });
  const [createOpen, setCreateOpen] = useState(false);
  const [menuGroup, setMenuGroup] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState("Nov 7, 2026 12:09");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!menuGroup) return;
    const close = () => setMenuGroup(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuGroup]);

  const locations = useMemo(
    () => ["All Locations", ...Array.from(new Set(groups.map((group) => group.location)))],
    [groups],
  );

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return groups.filter((group) => {
      const matchesSearch = !query || `${group.name} ${group.location} ${group.environment}`.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "All Status" || group.status === statusFilter;
      const matchesLocation = locationFilter === "All Locations" || group.location === locationFilter;
      const matchesEnvironment = environmentFilter === "All Environments" || group.environment === environmentFilter;
      return matchesSearch && matchesStatus && matchesLocation && matchesEnvironment;
    });
  }, [groups, search, statusFilter, locationFilter, environmentFilter]);

  const totalGroups = groups.length;
  const healthyGroups = groups.filter((group) => group.status === "Healthy").length;
  const degradedGroups = groups.filter((group) => group.status === "Degraded").length;
  const offlineGroups = groups.filter((group) => group.status === "Offline").length;
  const totalServers = groups.reduce((sum, group) => sum + group.servers, 0);
  const averageHealth = groups.reduce((sum, group) => sum + group.health, 0) / Math.max(totalGroups, 1);
  const visibleGroups = filteredGroups.slice(0, visibleGroupCount);
  const selectedGroup = groups.find((group) => group.id === selectedId) ?? groups[0];

  const healthOverview = [
    { name: "Healthy" as const, value: healthyGroups, color: statusColor.Healthy },
    { name: "Degraded" as const, value: degradedGroups, color: statusColor.Degraded },
    { name: "Offline" as const, value: offlineGroups, color: statusColor.Offline },
  ];
  const healthyPercent = totalGroups ? (healthyGroups / totalGroups) * 100 : 0;
  const trendData = useMemo(() => {
    const source = groupHealthTrend.map((point, index) => index === groupHealthTrend.length - 1
      ? { ...point, healthy: healthyGroups, degraded: degradedGroups, offline: offlineGroups }
      : point);
    if (trendRange === "24h") return source;
    const start = new Date();
    return source.map((point, index) => {
      const daysBack = trendRange === "7d"
        ? Math.round((source.length - 1 - index) * 6 / Math.max(source.length - 1, 1))
        : Math.round((source.length - 1 - index) * 29 / Math.max(source.length - 1, 1));
      const date = new Date(start);
      date.setDate(start.getDate() - daysBack);
      return { ...point, time: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
    });
  }, [healthyGroups, degradedGroups, offlineGroups, trendRange]);
  const latestHealthPoint = trendData[trendData.length - 1];
  const latestTotal = latestHealthPoint ? latestHealthPoint.healthy + latestHealthPoint.degraded + latestHealthPoint.offline : 0;
  const latestHealthyPercent = latestTotal ? (latestHealthPoint.healthy / latestTotal) * 100 : healthyPercent;
  const averageTrendHealth = trendData.reduce((sum, point) => {
    const total = point.healthy + point.degraded + point.offline;
    return sum + (total ? point.healthy / total * 100 : 0);
  }, 0) / Math.max(trendData.length, 1);
  const lowestTrendPoint = trendData.reduce((lowest, point) => {
    const pointTotal = point.healthy + point.degraded + point.offline;
    const lowestTotal = lowest.healthy + lowest.degraded + lowest.offline;
    return pointTotal && point.healthy / pointTotal < lowest.healthy / lowestTotal ? point : lowest;
  }, trendData[0] ?? { time: "—", healthy: 0, degraded: 0, offline: 0 });
  const lowestTrendTotal = lowestTrendPoint.healthy + lowestTrendPoint.degraded + lowestTrendPoint.offline;
  const lowestTrendPercent = lowestTrendTotal ? lowestTrendPoint.healthy / lowestTrendTotal * 100 : 0;
  const previousTrendPoint = trendData[Math.max(0, trendData.length - 2)];
  const previousTrendTotal = previousTrendPoint ? previousTrendPoint.healthy + previousTrendPoint.degraded + previousTrendPoint.offline : 0;
  const trendDelta = latestHealthyPercent - (previousTrendTotal ? previousTrendPoint.healthy / previousTrendTotal * 100 : latestHealthyPercent);
  const trendTickIndexes = Array.from(new Set([0, Math.round((trendData.length - 1) / 4), Math.round((trendData.length - 1) / 2), Math.round((trendData.length - 1) * 3 / 4), trendData.length - 1]));
  const trendTicks = trendTickIndexes.map((index) => trendData[index]?.time).filter((time): time is string => Boolean(time));
  const toggleHealthSeries = (status: GroupStatus) => setVisibleHealthSeries((current) => ({ ...current, [status]: !current[status] }));
  const performanceData = useMemo(() => {
    const source = groupPerformance[performanceMetric];
    if (performanceRange === "24h") return source;
    const today = new Date();
    return source.map((point, index) => {
      const daysBack = Math.round((source.length - 1 - index) * 6 / Math.max(source.length - 1, 1));
      const date = new Date(today);
      date.setDate(today.getDate() - daysBack);
      return { ...point, time: date.toLocaleDateString("en-US", { weekday: "short" }) };
    });
  }, [performanceMetric, performanceRange]);
  const performanceLatest = performanceData[performanceData.length - 1];
  const performanceTicks = Array.from(new Set([0, Math.round((performanceData.length - 1) / 4), Math.round((performanceData.length - 1) / 2), Math.round((performanceData.length - 1) * 3 / 4), performanceData.length - 1])).map((index) => performanceData[index]?.time).filter((time): time is string => Boolean(time));
  const performanceAverage = performanceData.reduce((sum, point) => sum + performanceSeries.reduce((seriesSum, series) => seriesSum + point[series.key], 0) / performanceSeries.length, 0) / Math.max(performanceData.length, 1);
  const performancePeak = performanceData.reduce((peak, point) => {
    const candidate = performanceSeries.map((series) => ({ name: series.name, value: point[series.key] })).reduce((max, item) => item.value > max.value ? item : max, { name: "", value: -Infinity });
    return candidate.value > peak.value ? { ...candidate, time: point.time } : peak;
  }, { name: "—", value: 0, time: "—" });
  const performancePrevious = performanceData[Math.max(0, performanceData.length - 2)];
  const performanceLatestAverage = performanceLatest ? performanceSeries.reduce((sum, series) => sum + performanceLatest[series.key], 0) / performanceSeries.length : 0;
  const performancePreviousAverage = performancePrevious ? performanceSeries.reduce((sum, series) => sum + performancePrevious[series.key], 0) / performanceSeries.length : performanceLatestAverage;
  const performanceDelta = performanceLatestAverage - performancePreviousAverage;
  const eventRows = useMemo(() => [...groupEvents]
    .filter((event) => eventFilter === "All" || event.status === eventFilter)
    .sort((a, b) => Date.parse(b.time.replace(", ", ", 2026 ")) - Date.parse(a.time.replace(", ", ", 2026 ")))
    .slice(0, 8), [eventFilter]);
  const activeAlerts = groupEvents.filter((event) => event.group === selectedGroup?.name && (event.status === "Open" || event.status === "Warning")).length;
  const lastIncident = groupEvents.find((event) => event.group === selectedGroup?.name)?.time ?? "No incidents";

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  function refresh() {
    setRefreshing(true);
    setLastUpdated(new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }));
    window.setTimeout(() => setRefreshing(false), 600);
    showNotice("Server group data refreshed.");
  }

  function createGroup(name: string, location: string, environment: GroupEnvironment) {
    const newGroup: ServerGroup = {
      id: `group-${Date.now()}`,
      name,
      status: "Healthy",
      servers: 0,
      location,
      environment,
      health: 100,
      uptime: 100,
      load: 0,
      cpu: 0,
      memory: 0,
      disk: 0,
      icon: "server" as ServerGroup["icon"],
      trend: Array.from({ length: 26 }, () => 100),
    };
    setGroups((current) => [newGroup, ...current]);
    setSelectedId(newGroup.id);
    setCreateOpen(false);
    showNotice(`${name} created.`);
  }

  function exportReport() {
    const header = ["Group Name", "Status", "Servers", "Location", "Environment", "Health %", "Avg. Uptime %", "Load %"];
    const rows = filteredGroups.map((group) => [
      group.name, group.status, group.servers, group.location, group.environment,
      group.health.toFixed(1), group.uptime.toFixed(1), group.load,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nexus-server-groups.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    showNotice("Server groups exported.");
  }

  function runMenuAction(action: string, group: ServerGroup) {
    setMenuGroup(null);
    if (action === "View details") {
      setSelectedId(group.id);
      return;
    }
    if (action === "Delete group") {
      setGroups((current) => current.filter((item) => item.id !== group.id));
      if (selectedId === group.id) setSelectedId(groups.find((item) => item.id !== group.id)?.id ?? "");
      showNotice(`${group.name} deleted.`);
      return;
    }
    showNotice(`${action} for ${group.name} is a demo action.`);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-x-hidden pb-4">
      <PageHeader
        breadcrumbs={["Infrastructure", "Server Groups"]}
        title="Server Groups"
        subtitle="Manage and monitor your server groups and clusters"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={<div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setCreateOpen(true)} ><Plus size={16} />Create Group</Button>
          <Button variant="outline" onClick={exportReport} ><Download size={16} />Export</Button>
        </div>}
      />

      <section aria-label="Server group metrics" className="grid grid-cols-2 items-stretch gap-4 min-[56.25rem]:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={Boxes} label="Total Groups" value={String(totalGroups)} trend="↑ 1 new" tone="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300" />
        <KpiCard icon={ShieldCheck} label="Healthy Groups" value={String(healthyGroups)} trend={`${Math.round((healthyGroups / Math.max(totalGroups, 1)) * 100)}% of total`} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" />
        <KpiCard icon={Activity} label="Degraded Groups" value={String(degradedGroups)} trend={`${((degradedGroups / Math.max(totalGroups, 1)) * 100).toFixed(1)}% of total`} tone="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300" />
        <KpiCard icon={Activity} label="Offline Groups" value={String(offlineGroups)} trend={`${((offlineGroups / Math.max(totalGroups, 1)) * 100).toFixed(1)}% of total`} tone="bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300" />
        <KpiCard icon={Server} label="Total Servers" value={String(totalServers)} trend="↑ 2 new" tone="bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300" />
        <KpiCard icon={Sparkles} label="Avg. Health" value={`${averageHealth.toFixed(1)}%`} trend="↑ 0.4%" tone="bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-300" />
      </section>

      <section className="grid min-w-0 grid-cols-1 items-stretch gap-5 min-[80rem]:grid-cols-[minmax(0,1fr)_22.5rem]">
        <Card className="flex h-full min-h-0 min-w-0 flex-col rounded-xl p-5">
          <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-[1.125rem] font-semibold">Server Groups</CardTitle>
            <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
              <label className="relative min-w-44 flex-1 xl:w-56 xl:flex-none">
                <Server size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search groups..." aria-label="Search groups" className="h-9 pl-9 text-[0.8125rem]" />
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-36 text-[0.8125rem]" aria-label="Filter groups by status"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="h-9 w-44 text-[0.8125rem]" aria-label="Filter groups by location"><SelectValue /></SelectTrigger>
                <SelectContent>{locations.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={environmentFilter} onValueChange={setEnvironmentFilter}>
                <SelectTrigger className="h-9 w-44 text-[0.8125rem]" aria-label="Filter groups by environment"><SelectValue /></SelectTrigger>
                <SelectContent>{environments.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex shrink-0 rounded-lg border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                  className={cn("grid h-8 w-9 place-items-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-label="List view"
                  aria-pressed={view === "list"}
                  className={cn("grid h-8 w-9 place-items-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          {filteredGroups.length === 0 ? (
            <div className="flex min-h-40 flex-1 flex-col items-center justify-center gap-2 text-[0.875rem] text-muted-foreground">
              <Server size={20} />
              No server groups match these filters.
            </div>
          ) : view === "grid" ? (
            <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 items-stretch gap-4 min-[40rem]:grid-cols-2 min-[68.75rem]:grid-cols-[repeat(auto-fill,minmax(13.75rem,1fr))]">
              {visibleGroups.map((group) => (
                <div key={group.id} className="relative flex min-h-0">
                  <GroupCard group={group} selected={selectedId === group.id} onSelect={() => setSelectedId(group.id)} onMenu={() => setMenuGroup((current) => current === group.id ? null : group.id)} />
                  {menuGroup === group.id && (
                    <div onClick={(event) => event.stopPropagation()} className="absolute right-3 top-3 z-30 w-44 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
                      {["View details", "Edit group", "Add servers", "Pause monitoring", "Delete group"].map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => runMenuAction(action, group)}
                          className={cn("block w-full rounded-md px-3 py-2 text-left text-[0.8125rem] text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", action === "Delete group" && "text-destructive")}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-x-auto">
              <table className="w-full min-w-[45rem] border-collapse text-left">
                <thead>
                  <tr className="bg-muted/60 text-[0.8125rem] font-semibold text-muted-foreground">
                    <th scope="col" className="border-b border-border px-3 py-3">Group Name</th>
                    <th scope="col" className="border-b border-border px-3 py-3">Status</th>
                    <th scope="col" className="border-b border-border px-3 py-3 text-center">Servers</th>
                    <th scope="col" className="border-b border-border px-3 py-3">Location</th>
                    <th scope="col" className="border-b border-border px-3 py-3">Environment</th>
                    <th scope="col" className="border-b border-border px-3 py-3 text-right">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleGroups.map((group) => (
                    <GroupListRow key={group.id} group={group} selected={selectedId === group.id} onSelect={() => setSelectedId(group.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-auto flex shrink-0 items-center justify-between border-t border-border pt-3 text-[0.75rem] text-muted-foreground">
            <span>Showing {Math.min(visibleGroupCount, filteredGroups.length)} of {filteredGroups.length} groups</span>
            {filteredGroups.length > visibleGroupCount && (
              <Button variant="ghost" onClick={() => setVisibleGroupCount((count) => count + 12)} className="text-primary">
                Load more
              </Button>
            )}
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard title="Group Health Overview" icon={ShieldCheck}>
            <div className="flex h-full min-h-[18.75rem] flex-col justify-between gap-4">
              <div className="flex min-h-[11rem] flex-1 flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
                <div className="relative h-[10.625rem] w-[10.625rem] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={healthOverview}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="75%"
                        outerRadius="92%"
                        paddingAngle={3}
                        cornerRadius={5}
                        stroke="var(--card)"
                        strokeWidth={1}
                        activeIndex={hoveredHealthStatus ? healthOverview.findIndex((item) => item.name === hoveredHealthStatus) : undefined}
                        activeShape={(props: SectorProps) => <Sector {...props} outerRadius={(Number(props.outerRadius) || 78) + 5} />}
                        onMouseEnter={(_, index) => setHoveredHealthStatus(healthOverview[index]?.name ?? null)}
                        onMouseLeave={() => setHoveredHealthStatus(null)}
                        isAnimationActive
                        animationDuration={900}
                      >
                        {healthOverview.map((item) => <Cell key={item.name} fill={item.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    {hoveredHealthStatus ? (() => {
                      const item = healthOverview.find((status) => status.name === hoveredHealthStatus)!;
                      const percent = totalGroups ? item.value / totalGroups * 100 : 0;
                      return <><b className="font-display text-[1.5rem] font-bold leading-none text-foreground">{item.value} · {percent.toFixed(0)}%</b><span className="mt-1 text-[0.75rem] text-muted-foreground">{item.name}</span></>;
                    })() : <><b className="font-display text-[1.75rem] font-bold leading-none text-foreground">{healthyPercent.toFixed(0)}%</b><span className="mt-1 text-[0.75rem] text-muted-foreground">Healthy</span></>}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                  {healthOverview.map((item) => {
                    const percent = totalGroups ? item.value / totalGroups * 100 : 0;
                    return (
                      <div key={item.name} className="min-w-0">
                        <div className="flex items-center gap-2 whitespace-nowrap text-[0.75rem] sm:text-[0.8125rem]">
                          <i aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.name}</span>
                          <b className="shrink-0 tabular-nums text-foreground">{item.value} · {percent.toFixed(0)}%</b>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${percent}%`, background: item.color }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
                {[
                  { label: "Avg Health", value: `${averageHealth.toFixed(1)}%` },
                  { label: "Affected Groups", value: String(degradedGroups + offlineGroups) },
                  { label: "Active Incidents", value: String(groups.filter((group) => group.status !== "Healthy").length) },
                ].map((stat) => <div key={stat.label} className="min-w-0 rounded-lg bg-muted/70 p-2.5 text-center"><b className="block truncate text-[0.9375rem] font-bold tabular-nums text-foreground">{stat.value}</b><span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">{stat.label}</span></div>)}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Health Trend" icon={Activity} action={
            <div className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5" aria-label="Health trend range">
              {healthRanges.map((range) => <button key={range} type="button" onClick={() => setTrendRange(range)} aria-pressed={trendRange === range} className={cn("rounded-lg px-2.5 py-1 text-[0.6875rem] font-medium transition-colors", trendRange === range ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{range}</button>)}
            </div>
          }>
            <div className="flex h-full min-h-[18.75rem] flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[0.6875rem]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                  <span>Now <b className="text-foreground">{latestHealthyPercent.toFixed(0)}%</b></span>
                  <span>Avg <b className="text-foreground">{averageTrendHealth.toFixed(0)}%</b></span>
                  <span>Lowest <b className="text-foreground">{lowestTrendPercent.toFixed(0)}% at {lowestTrendPoint.time}</b></span>
                </div>
                <span className={cn("rounded-full px-2 py-1 font-semibold", trendDelta >= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300")}>{trendDelta >= 0 ? "▲" : "▼"} {Math.abs(trendDelta).toFixed(1)}%</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.6875rem]">
                {healthOverview.map((item) => <button key={item.name} type="button" onClick={() => toggleHealthSeries(item.name)} aria-pressed={visibleHealthSeries[item.name]} className={cn("inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 transition-opacity", !visibleHealthSeries[item.name] && "opacity-40")}><i aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}</button>)}
              </div>
              <div className="min-h-[13.75rem] w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} stackOffset="expand" margin={{ top: 6, right: 18, left: -18, bottom: 0 }}>
                    <defs>
                      {healthOverview.map((item) => <linearGradient key={item.name} id={`health-${item.name.toLowerCase()}-gradient`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={item.color} stopOpacity={0.35} /><stop offset="100%" stopColor={item.color} stopOpacity={0.05} /></linearGradient>)}
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="time" ticks={trendTicks} interval={0} minTickGap={0} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                    <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(value: number) => `${Math.round(value * 100)}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<HealthTrendTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4", strokeWidth: 1 }} />
                    {visibleHealthSeries.Healthy && <Area type="monotone" dataKey="healthy" name="Healthy" stackId="health" stroke={statusColor.Healthy} strokeWidth={2} fill="url(#health-healthy-gradient)" isAnimationActive animationDuration={800} />}
                    {visibleHealthSeries.Degraded && <Area type="monotone" dataKey="degraded" name="Degraded" stackId="health" stroke={statusColor.Degraded} strokeWidth={2} fill="url(#health-degraded-gradient)" isAnimationActive animationDuration={800} />}
                    {visibleHealthSeries.Offline && <Area type="monotone" dataKey="offline" name="Offline" stackId="health" stroke={statusColor.Offline} strokeWidth={2} fill="url(#health-offline-gradient)" isAnimationActive animationDuration={800} />}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SectionCard>
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-1 items-stretch gap-5 min-[80rem]:grid-cols-12">
        <div className="min-w-0 min-[80rem]:col-span-5">
          <SectionCard title="Group Performance" icon={Cpu} className="p-4" action={
            <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              <div className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5">
                {performanceMetrics.map((metric) => <button key={metric} type="button" onClick={() => setPerformanceMetric(metric)} aria-pressed={performanceMetric === metric} className={cn("rounded-lg px-1.5 py-1 text-[0.625rem] whitespace-nowrap", performanceMetric === metric ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{metric === "Memory Usage" ? "Memory" : metric === "Network Usage" ? "Network" : metric === "CPU Usage" ? "CPU" : "Disk"}</button>)}
              </div>
              <div className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5">{(["24h", "7d"] as const).map((range) => <button key={range} type="button" onClick={() => setPerformanceRange(range)} aria-pressed={performanceRange === range} className={cn("rounded-lg px-1.5 py-1 text-[0.625rem]", performanceRange === range ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{range}</button>)}</div>
            </div>
          }>
            <div className="flex h-full min-h-[19.375rem] flex-col gap-2">
              <div className="min-h-[15rem] w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData} margin={{ top: 6, right: 16, left: -18, bottom: 0 }}>
                    <defs>{performanceSeries.map((series) => <linearGradient key={series.key} id={"performance-" + series.key + "-gradient"} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={series.color} stopOpacity={0.3} /><stop offset="100%" stopColor={series.color} stopOpacity={0} /></linearGradient>)}</defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="time" ticks={performanceTicks} interval={0} minTickGap={0} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value: number) => value + "%"} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<GroupPerformanceTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4", strokeWidth: 1 }} />
                    {performanceSeries.map((series) => visiblePerformanceSeries[series.key] && <Area key={series.key} type="monotone" dataKey={series.key} name={series.name} stroke={series.color} strokeWidth={2} fill={"url(#performance-" + series.key + "-gradient)"} isAnimationActive animationDuration={700} />)}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[0.625rem] sm:text-[0.6875rem]">
                {performanceSeries.map((series) => <button key={series.key} type="button" onClick={() => { setVisiblePerformanceSeries((current) => ({ ...current, [series.key]: !current[series.key] })); setSelectedId(series.groupId); }} aria-pressed={visiblePerformanceSeries[series.key]} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-1 py-0.5 text-muted-foreground", !visiblePerformanceSeries[series.key] && "opacity-40")}><i className="h-2 w-2 rounded-full" style={{ background: series.color }} />{series.name} <b className="text-foreground">{performanceLatest?.[series.key] ?? 0}%</b></button>)}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[0.625rem] text-muted-foreground sm:text-[0.6875rem]">
                <span>Avg <b className="text-foreground">{performanceAverage.toFixed(1)}%</b></span>
                <span>Peak <b className="text-foreground">{performancePeak.value}% · {performancePeak.name}</b></span>
                <span className={cn("font-semibold", performanceDelta >= 0 ? "text-emerald-600" : "text-rose-600")}>{performanceDelta >= 0 ? "▲" : "▼"} {Math.abs(performanceDelta).toFixed(1)}%</span>
              </div>
            </div>
          </SectionCard>
        </div>
        <div className="min-w-0 min-[80rem]:col-span-3">
          {selectedGroup ? <SectionCard title="Group Details" icon={Server} className="p-4">
            <div className="flex h-full min-h-[19.375rem] flex-col">
              <Select value={selectedGroup.id} onValueChange={setSelectedId}>
                <SelectTrigger aria-label="Select server group" className="h-9 w-full text-[0.75rem]"><SelectValue /></SelectTrigger>
                <SelectContent>{groups.map((group) => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="mt-3 flex min-w-0 items-center justify-between gap-2"><h3 title={selectedGroup.name} className="truncate text-[0.875rem] font-semibold text-foreground">{selectedGroup.name}</h3><StatusPill status={selectedGroup.status} /></div>
              <dl className="mt-3 grid gap-2">
                {([["Servers", String(selectedGroup.servers)], ["Location", selectedGroup.location], ["Environment", selectedGroup.environment], ["Avg. Uptime", selectedGroup.uptime.toFixed(1) + "%"]] as [string, string][]).map(([label, value]) => <div key={label} className="flex min-w-0 items-center justify-between gap-3 text-[0.75rem]"><dt className="shrink-0 text-muted-foreground">{label}</dt><dd title={value} className="min-w-0 truncate text-right font-semibold text-foreground">{value}</dd></div>)}
              </dl>
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-2 text-[0.75rem] font-semibold text-foreground">Current Load</p>
                <div className="space-y-2.5">
                  {([["CPU", selectedGroup.cpu], ["Memory", selectedGroup.memory], ["Disk", selectedGroup.disk]] as [string, number][]).map(([label, value]) => { const color = value < 70 ? "oklch(0.7227 0.192 149.58)" : value <= 85 ? "oklch(0.7686 0.1647 70.08)" : "oklch(0.6368 0.2078 25.33)"; return <div key={label}><div className="mb-1 flex items-center justify-between text-[0.6875rem]"><span className="text-muted-foreground">{label}</span><b className="tabular-nums text-foreground">{value}%</b></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-[width] duration-500" style={{ width: Math.max(0, Math.min(value, 100)) + "%", backgroundColor: color }} /></div></div>; })}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[{ label: "Active Alerts", value: String(activeAlerts) }, { label: "Last Incident", value: lastIncident === "No incidents" ? lastIncident : lastIncident.split(", ").at(-1) ?? lastIncident }].map((tile) => <div key={tile.label} className="min-w-0 rounded-lg bg-muted/70 p-2"><span className="block truncate text-[0.625rem] text-muted-foreground">{tile.label}</span><b title={tile.value} className="mt-0.5 block truncate text-[0.75rem] font-semibold text-foreground">{tile.value}</b></div>)}
              </div>
              <Link href={"/server-details?group=" + encodeURIComponent(selectedGroup.id)} className="mt-auto inline-flex items-center gap-1 self-end pt-3 text-[0.75rem] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View Details <ArrowRight size={14} strokeWidth={2} aria-hidden="true" /></Link>
            </div>
          </SectionCard> : null}
        </div>
        <div className="min-w-0 min-[80rem]:col-span-4">
          <SectionCard title="Recent Group Events" icon={Activity} className="p-4" action={<Link href="/events-explorer" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View All <ArrowRight size={14} strokeWidth={2} aria-hidden="true" /></Link>}>
            <div className="flex h-full min-h-[19.375rem] flex-col">
              <div className="mb-2 flex gap-1 border-b border-border pb-2">{(["All", "Open", "Resolved"] as const).map((filter) => <button key={filter} type="button" onClick={() => setEventFilter(filter)} aria-pressed={eventFilter === filter} className={cn("rounded-full px-2.5 py-1 text-[0.6875rem]", eventFilter === filter ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-accent")}>{filter}</button>)}</div>
              <div className="min-h-0 flex-1">
                {eventRows.length ? eventRows.map((event: GroupEvent) => <div key={event.time + "-" + event.group} className="grid h-12 grid-cols-[44px_minmax(0,1fr)_5rem] items-center gap-2 border-b border-border/70 px-1 last:border-0 hover:bg-muted/50">
                  <time title={event.time.replace(", ", ", 2026 ")} className="whitespace-nowrap text-[0.6875rem] tabular-nums text-muted-foreground">{event.time.split(", ").at(-1)}</time><div className="min-w-0 leading-tight"><b title={event.group} className="block truncate text-[0.6875rem] font-semibold text-foreground">{event.group}</b><span title={event.event} className="block truncate text-[0.6875rem] text-muted-foreground">{event.event}</span></div><div className="flex justify-end"><EventBadge status={event.status} /></div>
                </div>) : <p className="py-6 text-center text-[0.75rem] text-muted-foreground">No {eventFilter.toLowerCase()} events.</p>}
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2 text-[0.6875rem] text-muted-foreground"><span>Showing {eventRows.length} of {groupEvents.length} events</span><Link href="/events-explorer" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View All <ArrowRight size={14} strokeWidth={2} aria-hidden="true" /></Link></div>
            </div>
          </SectionCard>
        </div>
      </section>

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={createGroup} />

      {notice && (
        <div role="status" className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-[0.8125rem] text-foreground shadow-lg">
          <Check size={16} className="text-emerald-600" />
          {notice}
          <button type="button" title="Dismiss" aria-label="Dismiss notification" onClick={() => setNotice("")} className="ml-2 rounded-lg p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X size={15} />
          </button>
        </div>
      )}

      {refreshing && (
        <div className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-[0.8125rem] text-foreground shadow-lg">
          <RefreshCw size={15} className="animate-spin text-primary" />
          Refreshing…
        </div>
      )}
    </div>
  );
}

function EventBadge({ status }: { status: GroupEvent["status"] }) {
  const tone: Record<GroupEvent["status"], string> = {
    Open: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    Resolved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    Info: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    Success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    Warning: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    Critical: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  };
  return (
    <span className={cn("inline-flex w-20 shrink-0 items-center justify-center gap-1 rounded-full px-1.5 py-1 text-[0.625rem] font-semibold whitespace-nowrap", tone[status])}>
      <i aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
