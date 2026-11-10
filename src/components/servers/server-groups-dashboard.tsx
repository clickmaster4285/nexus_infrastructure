"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity, AlertCircle, AlertTriangle, ArrowDown, ArrowUp, Bell, Boxes,
  CalendarClock, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  Clock3, Cpu, Database, Download, Filter, Globe2, HardDrive, Layers3,
  MoreVertical, Play, Plus, RotateCw, Search, Server, ShieldCheck,
  Users, X,
  type LucideIcon,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import type { InfrastructureMapMarker } from "@/components/live-operations/infrastructure-map";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { serverGroups as initialGroups, serverGroupTrend, type ServerGroup } from "@/data/mock/server-groups";
import { cn } from "@/lib/utils";

type Environment = "Production" | "Staging" | "Dev";
type SortField = "name" | "totalServers" | "healthy" | "warning" | "critical" | "health" | "load" | "location" | "environment" | "alerts" | "cpu" | "memory" | "uptime" | "owner" | "updated";

interface GroupDetails {
  environment: Environment;
  alerts: number;
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
  owner: string;
  initials: string;
  updated: string;
  role: string;
  alertCritical: number;
  alertWarning: number;
  alertInfo: number;
}

const groupDetails: Record<string, GroupDetails> = {
  production: { environment: "Production", alerts: 1, cpu: 63, memory: 67, disk: 72, uptime: 99.98, owner: "Aisha Khan", initials: "AK", updated: "2 min ago", role: "Web", alertCritical: 0, alertWarning: 1, alertInfo: 0 },
  database: { environment: "Production", alerts: 3, cpu: 87, memory: 82, disk: 76, uptime: 99.91, owner: "Omar Farooq", initials: "OF", updated: "6 min ago", role: "Database", alertCritical: 1, alertWarning: 2, alertInfo: 0 },
  application: { environment: "Production", alerts: 0, cpu: 48, memory: 56, disk: 61, uptime: 99.99, owner: "Sara Malik", initials: "SM", updated: "8 min ago", role: "App", alertCritical: 0, alertWarning: 0, alertInfo: 0 },
  web: { environment: "Production", alerts: 2, cpu: 89, memory: 74, disk: 66, uptime: 99.87, owner: "Hamza Ali", initials: "HA", updated: "10 min ago", role: "Web", alertCritical: 0, alertWarning: 2, alertInfo: 0 },
  cache: { environment: "Production", alerts: 0, cpu: 52, memory: 68, disk: 44, uptime: 99.97, owner: "Mina Shah", initials: "MS", updated: "14 min ago", role: "Cache", alertCritical: 0, alertWarning: 0, alertInfo: 0 },
  other: { environment: "Dev", alerts: 0, cpu: 31, memory: 39, disk: 46, uptime: 99.76, owner: "Raza Ahmed", initials: "RA", updated: "17 min ago", role: "Backup", alertCritical: 0, alertWarning: 0, alertInfo: 0 },
  staging: { environment: "Staging", alerts: 1, cpu: 58, memory: 63, disk: 53, uptime: 99.72, owner: "Noor Zafar", initials: "NZ", updated: "21 min ago", role: "App", alertCritical: 0, alertWarning: 1, alertInfo: 0 },
  development: { environment: "Dev", alerts: 0, cpu: 35, memory: 42, disk: 47, uptime: 99.65, owner: "Bilal Raza", initials: "BR", updated: "27 min ago", role: "Web", alertCritical: 0, alertWarning: 0, alertInfo: 0 },
  monitoring: { environment: "Production", alerts: 4, cpu: 93, memory: 91, disk: 88, uptime: 98.91, owner: "Zara Iqbal", initials: "ZI", updated: "1 min ago", role: "App", alertCritical: 2, alertWarning: 1, alertInfo: 1 },
  backup: { environment: "Production", alerts: 0, cpu: 41, memory: 48, disk: 62, uptime: 99.94, owner: "Daniyal Khan", initials: "DK", updated: "34 min ago", role: "Backup", alertCritical: 0, alertWarning: 0, alertInfo: 0 },
  edge: { environment: "Staging", alerts: 2, cpu: 74, memory: 71, disk: 69, uptime: 99.82, owner: "Aliya Noor", initials: "AN", updated: "12 min ago", role: "Cache", alertCritical: 0, alertWarning: 1, alertInfo: 1 },
  internal: { environment: "Dev", alerts: 0, cpu: 28, memory: 33, disk: 38, uptime: 99.96, owner: "Yusuf Khan", initials: "YK", updated: "42 min ago", role: "Database", alertCritical: 0, alertWarning: 0, alertInfo: 0 },
};

const iconByName = { server: Server, database: Database, cube: Boxes, globe: Globe2, layers: Layers3, grid: Boxes };
const iconTone: Record<ServerGroup["icon"], string> = {
  server: "bg-[#e6f8ef] text-[#22b573]", database: "bg-[#e2efff] text-[#3287ed]",
  cube: "bg-[#f1eaff] text-[#8854dd]", globe: "bg-[#e4f3ff] text-[#398cf0]",
  layers: "bg-[#eaf1ff] text-[#3e83ec]", grid: "bg-[#edf4ff] text-[#3287ed]",
};
const locationCoordinates: Record<string, [number, number]> = {
  "DC – Islamabad": [33.6844, 73.0479], "DC – Rawalpindi": [33.5651, 73.0169],
  "DC – Peshawar": [34.0151, 71.5249], "DC – Lahore": [31.5204, 74.3587],
  "DC – Multan": [30.1575, 71.5249], "DC – Karachi": [24.8607, 67.0011],
};
const InfrastructureMap = dynamic(
  () => import("@/components/live-operations/infrastructure-map").then((module) => module.InfrastructureMap),
  { ssr: false, loading: () => <div className="grid min-h-40 flex-1 place-items-center text-[13px] text-muted-foreground">Loading location map…</div> },
);
const chartTooltip = {
  contentStyle: { border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)", color: "var(--popover-foreground)" },
};

const activities = [
  { title: "Monitoring Nodes health degraded", detail: "2 servers offline · Monitoring Nodes", time: "1 min ago", tone: "red" },
  { title: "CPU threshold exceeded", detail: "Database Servers · CPU reached 87%", time: "6 min ago", tone: "amber" },
  { title: "Web Servers health recovered", detail: "All 6 servers responding normally", time: "10 min ago", tone: "green" },
  { title: "New group created", detail: "Edge Locations · Created by Aliya Noor", time: "12 min ago", tone: "blue" },
  { title: "Backup completed", detail: "Backup Infrastructure · 3.2 GB verified", time: "18 min ago", tone: "green" },
  { title: "Memory warning acknowledged", detail: "Staging Servers · Acknowledged by Noor Zafar", time: "24 min ago", tone: "amber" },
  { title: "Server added to group", detail: "Database Servers · db-pg-04", time: "31 min ago", tone: "blue" },
];

const maintenance = [
  { group: "Database Servers", date: "Nov 08, 2026", time: "01:00 PKT", duration: "45 min", status: "Scheduled" },
  { group: "Web Servers", date: "Nov 09, 2026", time: "02:30 PKT", duration: "30 min", status: "Scheduled" },
  { group: "Production Servers", date: "Nov 10, 2026", time: "00:00 PKT", duration: "60 min", status: "In progress" },
  { group: "Staging Servers", date: "Nov 05, 2026", time: "23:00 PKT", duration: "30 min", status: "Completed" },
];

function getDetails(group: ServerGroup): GroupDetails {
  return groupDetails[group.id] ?? {
    environment: "Dev", alerts: group.warning + group.critical, cpu: Math.round(group.load * 0.72),
    memory: Math.round(group.load * 0.81), disk: 58, uptime: 99.9, owner: "Infrastructure Team",
    initials: "IT", updated: "just now", role: "App", alertCritical: group.critical,
    alertWarning: group.warning, alertInfo: 0,
  };
}

function CardSkeleton() {
  return <div role="status" aria-label="Loading card data" className="space-y-3">
    <span className="block h-4 w-2/3 animate-pulse rounded bg-muted" />
    <span className="block h-4 w-full animate-pulse rounded bg-muted" />
    <span className="block h-24 w-full animate-pulse rounded-lg bg-muted" />
  </div>;
}

function SectionCard({ title, icon: Icon, children, action, className = "", loading = false, error }: {
  title: string; icon: LucideIcon; children: React.ReactNode; action?: React.ReactNode;
  className?: string; loading?: boolean; error?: string | null;
}) {
  return <Card className={cn("flex h-full min-w-0 flex-col rounded-xl p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg", className)}>
    <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
      <CardTitle className="flex items-center gap-2 text-[18px] font-semibold"><Icon size={18} className="shrink-0 text-primary" />{title}</CardTitle>{action}
    </div>
    <div className="min-h-0 flex-1">
      {loading ? <CardSkeleton /> : error ? <div role="alert" className="flex min-h-24 items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive"><AlertCircle size={16} />{error}</div> : children}
    </div>
  </Card>;
}

function DashboardRow({ children }: { children: React.ReactNode }) {
  return <section className="grid min-w-0 grid-cols-1 items-stretch gap-5 min-[900px]:grid-cols-2 min-[1280px]:grid-cols-12">{children}</section>;
}

function SpanCard({ children, span = 4 }: { children: React.ReactNode; span?: 4 | 6 | 8 }) {
  return <div className={cn("min-w-0", span === 8 ? "min-[1280px]:col-span-8" : span === 6 ? "min-[1280px]:col-span-6" : "min-[1280px]:col-span-4")}>{children}</div>;
}

function GroupKpi({ label, value, trend, icon: Icon, tone, liveTick }: {
  label: string; value: string; trend: string; icon: LucideIcon; tone: string; liveTick: number;
}) {
  return <Card className="flex min-h-[112px] min-w-0 items-center gap-3 rounded-xl p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg">
    <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", tone)}><Icon size={20} /></span>
    <div className="min-w-0">
      <p className="truncate text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="font-display text-[30px] font-bold leading-tight text-foreground">{value}</p>
      <p className="text-[13px] text-emerald-600">{trend}{liveTick > 0 && label === "Healthy Groups" ? ` · updated ${liveTick * 3}s ago` : ""}</p>
    </div>
  </Card>;
}

function HealthOverview({ healthy, warning, critical }: { healthy: number; warning: number; critical: number }) {
  const total = healthy + warning + critical;
  const pct = total ? (healthy / total) * 100 : 0;
  const data = [{ name: "Healthy", value: healthy, color: "#32c581" }, { name: "Warning", value: warning, color: "#f5a12b" }, { name: "Critical", value: critical, color: "#ec3f5d" }];
  return <div className="flex min-h-52 flex-1 items-center gap-4">
    <div className="relative h-40 min-w-0 flex-1">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="88%" paddingAngle={2} stroke="none" isAnimationActive animationDuration={800}>
          {data.map((item) => <Cell key={item.name} fill={item.color} />)}
        </Pie><Tooltip {...chartTooltip} /></PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[26px] font-bold text-foreground">{pct.toFixed(1)}%</b><span className="text-[13px] text-muted-foreground">Healthy</span></div>
    </div>
    <div className="flex min-w-24 flex-col gap-3">
      {data.map((item) => <div key={item.name} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-[13px] text-muted-foreground"><i className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} /><span>{item.name}</span><b className="text-foreground">{item.value}</b></div>)}
    </div>
  </div>;
}

function GroupTrend({ period }: { period: string }) {
  const pointCount = period === "1h" ? 2 : period === "6h" ? 4 : period === "12h" ? 7 : 13;
  return <div className="h-48 w-full pt-1">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={serverGroupTrend.slice(-pointCount)} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="time" interval="preserveStartEnd" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value: number) => `${value}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip {...chartTooltip} />
        <Area type="monotone" dataKey="healthy" stroke="#32c581" fill="#32c581" fillOpacity={0.12} strokeWidth={2} dot={false} isAnimationActive animationDuration={800} />
        <Area type="monotone" dataKey="warning" stroke="#f5a12b" fill="transparent" strokeWidth={2} dot={false} isAnimationActive animationDuration={800} />
        <Area type="monotone" dataKey="critical" stroke="#ec3f5d" fill="transparent" strokeWidth={2} dot={false} isAnimationActive animationDuration={800} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

function LocationMap({ groups }: { groups: ServerGroup[] }) {
  const data = groups.reduce<{ markers: Record<string, { lat: number; lng: number; status: InfrastructureMapMarker["status"]; groupCount: number; serverCount: number }>; legend: { healthy: number; warning: number; critical: number } }>((result, group) => {
    const status = group.critical > 0 ? "critical" : group.warning > 0 ? "warning" : "healthy";
    result.legend[status] += 1;
    const coordinates = locationCoordinates[group.location];
    if (!coordinates) return result;
    const marker = result.markers[group.location];
    if (marker) {
      marker.groupCount += 1;
      marker.serverCount += group.totalServers;
      if (status === "critical" || (status === "warning" && marker.status === "healthy")) marker.status = status;
    } else result.markers[group.location] = { lat: coordinates[0], lng: coordinates[1], status, groupCount: 1, serverCount: group.totalServers };
    return result;
  }, { markers: {}, legend: { healthy: 0, warning: 0, critical: 0 } });
  const mapMarkers = Object.entries(data.markers).map(([name, value]) => ({ name, lat: value.lat, lng: value.lng, status: value.status, role: `${value.groupCount} groups · ${value.serverCount} servers` }));
  const cityCounts = ["Karachi", "Lahore", "Rawalpindi", "Multan"].map((city) => ({
    city, count: groups.filter((group) => group.location.includes(city)).length,
  }));
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="mb-2 flex flex-wrap gap-4 text-[13px] text-muted-foreground">
      {[["Healthy", "healthy", "bg-emerald-500"], ["Warning", "warning", "bg-amber-500"], ["Critical", "critical", "bg-rose-500"]].map(([label, key, color]) => <span key={key} className="flex items-center gap-2"><i className={cn("h-2.5 w-2.5 rounded-full", color)} />{label} {data.legend[key as keyof typeof data.legend]}</span>)}
    </div>
    <div className="min-h-48 flex-1 overflow-hidden rounded-lg">
      <InfrastructureMap variant="light" markers={mapMarkers} center={[30, 71]} zoom={4} legendCounts={data.legend} title="Group Status by Location" description="Server groups and health by data center" />
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4">
      {cityCounts.map(({ city, count }) => <div key={city} className="flex items-center justify-between text-[13px]"><span className="text-muted-foreground">{city}</span><b className="text-foreground">{count} groups</b></div>)}
    </div>
  </div>;
}

function CreateGroupDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (name: string, location: string) => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("DC – Islamabad");
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    onCreate(cleanName, location);
    setName("");
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>Create Server Group</DialogTitle><DialogDescription>Add a group to organize and monitor your servers.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-2 text-[13px] font-medium text-muted-foreground">Group name<Input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Production Servers" className="h-10 text-[14px]" /></label>
        <label className="block space-y-2 text-[13px] font-medium text-muted-foreground">Location
          <Select value={location} onValueChange={setLocation}><SelectTrigger aria-label="Group location" className="h-10 text-[14px]"><SelectValue /></SelectTrigger><SelectContent>{["DC – Islamabad", "DC – Lahore", "DC – Karachi", "DC – Rawalpindi", "Multi-region"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
        </label>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit"><Plus size={16} />Create Group</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function GroupDetailsDialog({ group, open, onOpenChange }: { group: ServerGroup | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!group) return null;
  const details = getDetails(group);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>{group.name}</DialogTitle><DialogDescription>{details.environment} · {group.location} · Owned by {details.owner}</DialogDescription></DialogHeader>
      <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border p-4 sm:grid-cols-3">
        {[["Total servers", group.totalServers], ["Healthy", group.healthy], ["Warning", group.warning], ["Critical", group.critical], ["Health", `${group.health}%`], ["30-day uptime", `${details.uptime}%`], ["Average CPU", `${details.cpu}%`], ["Average memory", `${details.memory}%`], ["Active alerts", details.alerts]].map(([label, value]) => <div key={label}><dt className="text-[13px] text-muted-foreground">{label}</dt><dd className="mt-1 text-[16px] font-semibold text-foreground">{value}</dd></div>)}
      </dl>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button><Button asChild><Link href="/all-servers">View servers</Link></Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function EnvironmentChip({ environment }: { environment: Environment }) {
  const tone = environment === "Production" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : environment === "Staging" ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold", tone)}>{environment}</span>;
}

function HealthBadge({ health }: { health: number }) {
  const tone = health >= 90 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : health >= 70 ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold", tone)}>{health}%</span>;
}

function SortHeader({ label, field, sortBy, sortDirection, onSort, className }: {
  label: string; field: SortField; sortBy: SortField; sortDirection: "asc" | "desc";
  onSort: (field: SortField) => void; className?: string;
}) {
  return <th scope="col" className={cn("whitespace-nowrap border-b border-border px-3 py-3 text-left text-[13px] font-semibold text-muted-foreground", className)}>
    <button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Sort by ${label}`}>
      {label}{sortBy === field && (sortDirection === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
    </button>
  </th>;
}

export function ServerGroupsDashboard() {
  const [groups, setGroups] = useState(initialGroups);
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState("All health");
  const [environmentFilter, setEnvironmentFilter] = useState("All environments");
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [period, setPeriod] = useState("24h");
  const [tab, setTab] = useState("overview");
  const [lastUpdated, setLastUpdated] = useState("Nov 7, 2026 12:09");
  const [detailGroup, setDetailGroup] = useState<ServerGroup | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [liveTick, setLiveTick] = useState(0);
  const [resourceMode, setResourceMode] = useState<"Average" | "Peak">("Average");
  const [pausedGroups, setPausedGroups] = useState<string[]>([]);
  const [policies, setPolicies] = useState([true, true, false, true, true]);

  useEffect(() => {
    const loadingTimer = window.setTimeout(() => setLoading(false), 350);
    const liveTimer = window.setInterval(() => setLiveTick((tick) => tick + 1), 3000);
    return () => { window.clearTimeout(loadingTimer); window.clearInterval(liveTimer); };
  }, []);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = groups.filter((group) => {
      const details = getDetails(group);
      const matchesSearch = !query || `${group.name} ${group.location} ${details.owner}`.toLowerCase().includes(query);
      const matchesHealth = healthFilter === "All health" || (healthFilter === "Healthy" ? group.warning === 0 && group.critical === 0 : healthFilter === "Warning" ? group.warning > 0 : group.critical > 0);
      return matchesSearch && matchesHealth && (environmentFilter === "All environments" || details.environment === environmentFilter);
    });
    const sorted = [...filtered].sort((a, b) => {
      const left = getDetails(a);
      const right = getDetails(b);
      const values: Record<SortField, string | number> = {
        name: a.name, totalServers: a.totalServers, healthy: a.healthy, warning: a.warning,
        critical: a.critical, health: a.health, load: a.load, location: a.location,
        environment: left.environment, alerts: left.alerts, cpu: left.cpu, memory: left.memory,
        uptime: left.uptime, owner: left.owner, updated: left.updated,
      };
      const otherValues: Record<SortField, string | number> = {
        name: b.name, totalServers: b.totalServers, healthy: b.healthy, warning: b.warning,
        critical: b.critical, health: b.health, load: b.load, location: b.location,
        environment: right.environment, alerts: right.alerts, cpu: right.cpu, memory: right.memory,
        uptime: right.uptime, owner: right.owner, updated: right.updated,
      };
      return typeof values[sortBy] === "number"
        ? Number(values[sortBy]) - Number(otherValues[sortBy])
        : String(values[sortBy]).localeCompare(String(otherValues[sortBy]));
    });
    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [groups, search, healthFilter, environmentFilter, sortBy, sortDirection]);
  const pages = Math.max(1, Math.ceil(filteredGroups.length / rowsPerPage));
  const visibleGroups = filteredGroups.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const totalGroups = groups.length;
  const healthyGroups = groups.filter((group) => group.warning === 0 && group.critical === 0).length;
  const warningGroups = groups.filter((group) => group.warning > 0).length;
  const criticalGroups = groups.filter((group) => group.critical > 0).length;
  const totalServers = groups.reduce((sum, group) => sum + group.totalServers, 0);
  const averageHealth = groups.reduce((sum, group) => sum + group.health, 0) / Math.max(totalGroups, 1);
  const totalAlerts = groups.reduce((sum, group) => sum + getDetails(group).alerts, 0);
  const allVisibleSelected = visibleGroups.length > 0 && visibleGroups.every((group) => selected.includes(group.id));
  const sortedAttention = [...groups].sort((a, b) => a.health - b.health).slice(0, 5);
  const timestamp = () => setLastUpdated(new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }));
  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2800); };

  function createGroup(name: string, location: string) {
    const newGroup: ServerGroup = { id: `group-${Date.now()}`, name, totalServers: 0, healthy: 0, warning: 0, critical: 0, health: 100, load: 0, location, icon: "server" };
    setGroups((current) => [newGroup, ...current]);
    setPage(1);
    setCreateOpen(false);
  }
  function exportReport() {
    const header = ["Group Name", "Total Servers", "Healthy", "Warning", "Critical", "Health %", "Load %", "Location", "Environment", "Alerts", "Avg CPU", "Avg Memory", "Uptime 30d", "Owner"];
    const content = [header, ...filteredGroups.map((group) => {
      const extra = getDetails(group);
      return [group.name, group.totalServers, group.healthy, group.warning, group.critical, group.health, group.load, group.location, extra.environment, extra.alerts, extra.cpu, extra.memory, extra.uptime, extra.owner];
    })].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "nexus-server-groups.csv"; anchor.click(); URL.revokeObjectURL(url);
    showNotice("Server groups exported.");
  }
  function onSort(field: SortField) {
    if (field === sortBy) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDirection("asc"); }
  }
  function runAction(action: string, group: ServerGroup) {
    setActionMenu(null);
    if (action === "View") setDetailGroup(group);
    else if (action === "Delete") {
      setGroups((current) => current.filter((item) => item.id !== group.id));
      setSelected((current) => current.filter((id) => id !== group.id));
      showNotice(`${group.name} deleted from demo data.`);
    } else if (action === "Pause Monitoring" || action === "Resume Monitoring") {
      setPausedGroups((current) => action === "Pause Monitoring" ? [...new Set([...current, group.id])] : current.filter((id) => id !== group.id));
      showNotice(`${action === "Pause Monitoring" ? "Paused" : "Resumed"} monitoring for ${group.name}.`);
    } else showNotice(`${action} for ${group.name} is a demo action.`);
  }
  function togglePolicy(index: number) {
    setPolicies((current) => current.map((enabled, itemIndex) => itemIndex === index ? !enabled : enabled));
  }

  return <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-x-hidden pb-4">
    <PageMeta
      breadcrumbs={["Infrastructure", "Server Groups"]}
      variant="detail"
      lastUpdated={lastUpdated}
      onRefresh={() => { timestamp(); setLiveTick((tick) => tick + 1); }}
      actions={<span className="inline-flex items-center gap-2 text-[13px] font-medium text-emerald-700 dark:text-emerald-300"><i className="h-2 w-2 rounded-full bg-emerald-500" />Online</span>}
    />
    <PageHeading title="Server Groups" description="Manage and monitor your server groups across infrastructure" actionsAlign="top" variant="detail">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => { timestamp(); showNotice("Server group data refreshed."); }} title="Refresh server groups" className="h-9 gap-2 px-3 text-[13px]"><RotateCw size={15} />Refresh</Button>
        <Button variant="outline" onClick={exportReport} title="Export server groups" className="h-9 gap-2 px-3 text-[13px]"><Download size={15} />Export</Button>
        <div className="relative">
          <Button variant="outline" aria-expanded={bulkMenuOpen} onClick={() => setBulkMenuOpen((open) => !open)} className="h-9 gap-2 px-3 text-[13px]">Bulk Actions<ChevronDown size={15} /></Button>
          {bulkMenuOpen && <div className="absolute right-0 z-30 mt-1 min-w-48 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
            {["Pause selected", "Resume selected", "Export selected", "Clear selection"].map((label) => <button key={label} type="button" onClick={() => {
              if (label === "Clear selection") setSelected([]);
              else if (label === "Export selected") showNotice(`${selected.length} selected groups exported.`);
              else setPausedGroups((current) => label === "Pause selected" ? [...new Set([...current, ...selected])] : current.filter((id) => !selected.includes(id)));
              setBulkMenuOpen(false);
            }} className="block w-full rounded-md px-3 py-2 text-left text-[13px] text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{label}{label.startsWith("Pause") || label.startsWith("Resume") ? ` (${selected.length})` : ""}</button>)}
          </div>}
        </div>
        <Button onClick={() => setCreateOpen(true)} className="h-9 gap-2 px-3 text-[13px]"><Plus size={16} />Create Group</Button>
      </div>
    </PageHeading>

    <section aria-label="Server group metrics" className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2 min-[1280px]:grid-cols-6">
      <GroupKpi label="Total Groups" value={String(totalGroups)} trend={`${totalServers} servers monitored`} icon={Boxes} tone="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300" liveTick={liveTick} />
      <GroupKpi label="Healthy Groups" value={String(healthyGroups)} trend={`${totalGroups ? Math.round(healthyGroups / totalGroups * 100) : 0}% of all groups`} icon={ShieldCheck} tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" liveTick={liveTick} />
      <GroupKpi label="Warning Groups" value={String(warningGroups)} trend="Requires attention" icon={AlertTriangle} tone="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300" liveTick={liveTick} />
      <GroupKpi label="Critical Groups" value={String(criticalGroups)} trend="Active critical status" icon={AlertCircle} tone="bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300" liveTick={liveTick} />
      <GroupKpi label="Average Health" value={`${averageHealth.toFixed(1)}%`} trend="Across all groups" icon={Activity} tone="bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300" liveTick={liveTick} />
      <GroupKpi label="Active Alerts" value={String(totalAlerts + liveTick % 2)} trend="Across monitored groups" icon={Bell} tone="bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300" liveTick={liveTick} />
    </section>

    <Tabs value={tab} onValueChange={setTab} className="min-w-0">
      <TabsList aria-label="Server group sections" className="flex w-full flex-wrap items-center justify-start gap-2 rounded-xl border border-border bg-card p-2 shadow-card">
        {[
          ["overview", "Overview", Activity], ["members", "Members", Users], ["performance", "Performance", Cpu],
          ["alerts", "Alerts", Bell], ["policies", "Policies", ShieldCheck], ["activity", "Activity", Clock3],
        ].map(([value, label, Icon]) => {
          const TabIcon = Icon as LucideIcon;
          return <TabsTrigger key={value as string} value={value as string} className="mb-0 gap-2 rounded-lg border border-transparent px-3 py-2 text-[13px] data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary"><TabIcon size={15} />{label as string}</TabsTrigger>;
        })}
      </TabsList>

      <TabsContent value={tab} className="mt-5 min-w-0 space-y-5">
        {tab !== "overview" ? <SectionCard title={`${tab[0].toUpperCase()}${tab.slice(1)}`} icon={CircleHelp} loading={loading}>
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><CircleHelp size={22} /></span>
            <p className="text-[16px] font-semibold text-foreground">{tab[0].toUpperCase()}{tab.slice(1)} overview</p>
            <p className="max-w-md text-[13px] text-muted-foreground">This section is ready for server group {tab} details. The current demo data remains available in Overview.</p>
            <Button variant="outline" onClick={() => setTab("overview")} className="text-[13px]">Back to Overview</Button>
          </div>
        </SectionCard> : <>
          <section aria-label="Server groups table" className="grid min-w-0 grid-cols-1 items-stretch gap-5">
            <Card className="min-w-0 overflow-hidden rounded-xl p-0 transition-[transform,box-shadow] duration-200 hover:shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Boxes size={20} /></span><div><h2 className="font-display text-[18px] font-semibold text-foreground">Server Groups</h2><p className="text-[13px] text-muted-foreground">Monitor and manage groups across your infrastructure</p></div></div>
                <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
                  <label className="relative min-w-48 flex-1 xl:w-56 xl:flex-none"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search groups..." aria-label="Search groups" className="h-10 pl-10 text-[13px]" /></label>
                  <Select value={environmentFilter} onValueChange={(value) => { setEnvironmentFilter(value); setPage(1); }}><SelectTrigger className="h-10 w-44 text-[13px]" aria-label="Filter by environment"><Filter size={15} /><SelectValue /></SelectTrigger><SelectContent>{["All environments", "Production", "Staging", "Dev"].map((value) => <SelectItem value={value} key={value}>{value}</SelectItem>)}</SelectContent></Select>
                  <Select value={healthFilter} onValueChange={(value) => { setHealthFilter(value); setPage(1); }}><SelectTrigger className="h-10 w-36 text-[13px]" aria-label="Filter groups by health"><SelectValue /></SelectTrigger><SelectContent>{["All health", "Healthy", "Warning", "Critical"].map((value) => <SelectItem value={value} key={value}>{value}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1840px] border-collapse text-left">
                  <thead><tr className="bg-muted/60">
                    <th scope="col" className="w-12 border-b border-border px-4 py-3"><input type="checkbox" aria-label="Select all groups on this page" checked={allVisibleSelected} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, ...visibleGroups.map((group) => group.id)])] : current.filter((id) => !visibleGroups.some((group) => group.id === id)))} className="h-4 w-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring" /></th>
                    {([
                      ["Group Name", "name"], ["Total Servers", "totalServers"], ["Healthy", "healthy"], ["Warning", "warning"],
                      ["Critical", "critical"], ["Health %", "health"], ["Load", "load"], ["Location", "location"],
                      ["Environment", "environment"], ["Alerts", "alerts"], ["Avg CPU", "cpu"], ["Avg Memory", "memory"],
                      ["Uptime 30d", "uptime"], ["Owner", "owner"], ["Last Updated", "updated"],
                    ] as [string, SortField][]).map(([label, field]) => <SortHeader key={field} label={label} field={field} sortBy={sortBy} sortDirection={sortDirection} onSort={onSort} />)}
                    <th scope="col" className="sticky right-0 border-b border-border bg-muted/60 px-4 py-3 text-[13px] font-semibold text-muted-foreground">Actions</th>
                  </tr></thead>
                  <tbody>
                    {loading ? Array.from({ length: 5 }, (_, index) => <tr key={index} className="h-[52px]"><td colSpan={17} className="px-5"><span className="block h-5 animate-pulse rounded bg-muted" /></td></tr>) : visibleGroups.map((group) => {
                      const GroupIcon = iconByName[group.icon];
                      const extra = getDetails(group);
                      const isSelected = selected.includes(group.id);
                      return <tr key={group.id} tabIndex={0} role="button" aria-label={`View details for ${group.name}`} onClick={() => setDetailGroup(group)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setDetailGroup(group); } }} className="h-[52px] cursor-pointer border-b border-border/70 text-[14px] transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                        <td className="px-4 py-2" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${group.name}`} checked={isSelected} onChange={(event) => setSelected((current) => event.target.checked ? [...current, group.id] : current.filter((id) => id !== group.id))} className="h-4 w-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring" /></td>
                        <td className="whitespace-nowrap px-3 py-2"><span className="flex items-center gap-2.5 font-semibold text-foreground"><span className={cn("grid h-8 w-8 place-items-center rounded-lg", iconTone[group.icon])}><GroupIcon size={16} /></span>{group.name}</span></td>
                        <td className="px-3 py-2 text-center tabular-nums">{group.totalServers}</td>
                        <td className="px-3 py-2 text-center font-semibold text-emerald-600">{group.healthy}</td>
                        <td className="px-3 py-2 text-center font-semibold text-amber-600">{group.warning}</td>
                        <td className="px-3 py-2 text-center font-semibold text-rose-600">{group.critical}</td>
                        <td className="px-3 py-2"><HealthBadge health={group.health} /></td>
                        <td className="min-w-28 px-3 py-2"><div className="flex items-center gap-2"><div className="h-2 w-16 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(group.load, 100)}%` }} /></div><span className="tabular-nums">{group.load.toFixed(1)}%</span></div></td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{group.location.replace("DC – ", "")}</td>
                        <td className="px-3 py-2"><EnvironmentChip environment={extra.environment} /></td>
                        <td className="px-3 py-2"><span className={cn("inline-flex min-w-8 justify-center rounded-full px-2.5 py-1 text-[12px] font-semibold", extra.alerts ? extra.alertCritical ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300")}>{extra.alerts}</span></td>
                        <td className="px-3 py-2 tabular-nums">{extra.cpu}%</td><td className="px-3 py-2 tabular-nums">{extra.memory}%</td><td className="px-3 py-2 tabular-nums">{extra.uptime}%</td>
                        <td className="whitespace-nowrap px-3 py-2"><span className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[12px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{extra.initials}</span>{extra.owner}</span></td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{extra.updated}</td>
                        <td className="sticky right-0 bg-card px-3 py-2" onClick={(event) => event.stopPropagation()}>
                          <div className="relative"><button type="button" aria-label={`Actions for ${group.name}`} title={`Actions for ${group.name}`} aria-expanded={actionMenu === group.id} onClick={() => setActionMenu((current) => current === group.id ? null : group.id)} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MoreVertical size={18} /></button>
                            {actionMenu === group.id && <div className="absolute right-0 z-30 mt-1 w-48 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
                              {["View", "Edit", "Add Servers", pausedGroups.includes(group.id) ? "Resume Monitoring" : "Pause Monitoring", "Delete"].map((action) => <button key={action} type="button" onClick={() => runAction(action, group)} className={cn("block w-full rounded-md px-3 py-2 text-left text-[13px] text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", action === "Delete" && "text-destructive")}>{action}</button>)}
                            </div>}
                          </div>
                        </td>
                      </tr>;
                    })}
                    {!loading && visibleGroups.length === 0 && <tr><td colSpan={17} className="px-5 py-12 text-center"><div className="flex flex-col items-center gap-2 text-[14px] text-muted-foreground"><Search size={20} />No server groups match these filters.</div></td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[13px] text-muted-foreground">
                <span>Showing {filteredGroups.length ? (page - 1) * rowsPerPage + 1 : 0}-{Math.min(page * rowsPerPage, filteredGroups.length)} of {filteredGroups.length} groups</span>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2">Rows per page<Select value={String(rowsPerPage)} onValueChange={(value) => { setRowsPerPage(Number(value)); setPage(1); }}><SelectTrigger aria-label="Rows per page" className="h-9 w-20 text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{[6, 10, 25].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></label>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon-sm" title="Previous page" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></Button>
                    {Array.from({ length: pages }, (_, index) => index + 1).map((number) => <Button key={number} variant={page === number ? "default" : "outline"} onClick={() => setPage(number)} aria-current={page === number ? "page" : undefined} className="h-9 min-w-9 px-2 text-[13px]">{number}</Button>)}
                    <Button variant="outline" size="icon-sm" title="Next page" aria-label="Next page" disabled={page === pages} onClick={() => setPage((current) => Math.min(pages, current + 1))}><ChevronRight size={16} /></Button>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <DashboardRow>
            <SpanCard><SectionCard title="Group Health Overview" icon={ShieldCheck} loading={loading} action={<span className="inline-flex items-center gap-2 text-[12px] font-semibold text-emerald-600"><i className="h-2 w-2 rounded-full bg-emerald-500" />Live</span>}>
              <HealthOverview healthy={groups.reduce((sum, group) => sum + group.healthy, 0)} warning={groups.reduce((sum, group) => sum + group.warning, 0)} critical={groups.reduce((sum, group) => sum + group.critical, 0)} />
            </SectionCard></SpanCard>
            <SpanCard><SectionCard title="Server Groups Trend" icon={Activity} loading={loading} action={<div className="flex gap-1">{["1h", "6h", "12h", "24h"].map((value) => <button key={value} type="button" onClick={() => setPeriod(value)} className={cn("rounded-md px-2 py-1 text-[12px] text-muted-foreground", period === value && "bg-primary/10 font-semibold text-primary")}>{value}</button>)}</div>}>
              <div className="mb-2 flex justify-center gap-4 text-[13px] text-muted-foreground">{[["Healthy", "bg-emerald-500"], ["Warning", "bg-amber-500"], ["Critical", "bg-rose-500"]].map(([label, color]) => <span key={label} className="flex items-center gap-2"><i className={cn("h-2.5 w-2.5 rounded-full", color)} />{label}</span>)}</div>
              <GroupTrend period={period} />
            </SectionCard></SpanCard>
            <SpanCard><SectionCard title="Group Status by Location" icon={Globe2} loading={loading}>
              <LocationMap groups={groups} />
            </SectionCard></SpanCard>
          </DashboardRow>

          <DashboardRow>
            <SpanCard span={6}><SectionCard title="Quick Actions" icon={Activity} loading={loading}>
              <div className="grid h-full content-center gap-3 sm:grid-cols-2">
                {[
                  ["Create Server Group", Plus, () => setCreateOpen(true)],
                  ["View All Servers", Server, () => { window.location.href = "/all-servers"; }],
                  ["Add Servers to Group", Users, () => showNotice("Choose a group to add servers (demo action).")],
                  ["Schedule Maintenance", CalendarClock, () => showNotice("Maintenance scheduling is available in this demo.")],
                  ["Check Health", Activity, () => { timestamp(); showNotice("Group health check completed."); }],
                  ["Export Report", Download, exportReport],
                ].map(([label, Icon, onClick]) => {
                  const ActionIcon = Icon as LucideIcon;
                  return <button key={label as string} type="button" onClick={onClick as () => void} title={label as string} className="flex h-11 items-center gap-3 rounded-lg border border-border px-4 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ActionIcon size={17} className="text-primary" />{label as string}</button>;
                })}
              </div>
            </SectionCard></SpanCard>
            <SpanCard span={6}><SectionCard title="Recent Activity" icon={Clock3} loading={loading} action={<Link href="/events-explorer" className="rounded text-[13px] font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View All</Link>}>
              <div className="space-y-3">
                {activities.map((item) => <div key={item.title} className="flex items-start gap-3 border-b border-border/70 pb-3 last:border-0 last:pb-0">
                  <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full", item.tone === "green" ? "bg-emerald-100 text-emerald-600" : item.tone === "amber" ? "bg-amber-100 text-amber-600" : item.tone === "red" ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600")}>{item.tone === "green" ? <Check size={15} /> : item.tone === "amber" ? <AlertTriangle size={15} /> : item.tone === "red" ? <AlertCircle size={15} /> : <Plus size={15} />}</span>
                  <div className="min-w-0 flex-1"><p className="text-[14px] font-semibold text-foreground">{item.title}</p><p className="text-[13px] text-muted-foreground">{item.detail}</p></div><time className="whitespace-nowrap text-[12px] text-muted-foreground">{item.time}</time>
                </div>)}
              </div>
            </SectionCard></SpanCard>
          </DashboardRow>

          <DashboardRow>
            <SpanCard><SectionCard title="Groups Needing Attention" icon={AlertTriangle} loading={loading}>
              {sortedAttention.some((group) => group.warning || group.critical) ? <div className="space-y-3">
                {sortedAttention.filter((group) => group.warning || group.critical).slice(0, 5).map((group) => {
                  const severity = group.critical ? "Critical" : "Warning";
                  const reason = group.critical ? `${group.critical} server${group.critical > 1 ? "s" : ""} critical` : group.load > 85 ? "CPU above 85%" : `${group.warning} server${group.warning > 1 ? "s" : ""} need attention`;
                  return <div key={group.id} className="flex items-center gap-3 border-b border-border/70 pb-3 last:border-0 last:pb-0">
                    <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", severity === "Critical" ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300")}>{severity}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold text-foreground">{group.name}</p><p className="text-[12px] text-muted-foreground">{reason}</p></div>
                    <HealthBadge health={group.health} /><button type="button" onClick={() => setDetailGroup(group)} className="text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View</button>
                  </div>;
                })}
              </div> : <div className="flex min-h-40 items-center justify-center gap-3 text-[14px] font-medium text-emerald-600"><CheckCircle2 size={22} />All groups healthy</div>}
            </SectionCard></SpanCard>
            <SpanCard><SectionCard title="Alerts by Group" icon={Bell} loading={loading} action={<span className="rounded-full bg-rose-50 px-2.5 py-1 text-[12px] font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">{totalAlerts} active</span>}>
              <div className="space-y-3">
                {[...groups].sort((a, b) => getDetails(b).alerts - getDetails(a).alerts).slice(0, 6).map((group) => {
                  const extra = getDetails(group);
                  const total = Math.max(1, extra.alerts);
                  return <div key={group.id} className="grid grid-cols-[minmax(100px,1fr)_2fr_auto] items-center gap-3 text-[13px]">
                    <span className="truncate text-foreground">{group.name}</span>
                    <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${extra.alertCritical} critical, ${extra.alertWarning} warning, ${extra.alertInfo} informational alerts`}>
                      <span className="bg-rose-500 transition-[width] duration-700" style={{ width: `${extra.alertCritical / total * 100}%` }} /><span className="bg-amber-500 transition-[width] duration-700" style={{ width: `${extra.alertWarning / total * 100}%` }} /><span className="bg-sky-500 transition-[width] duration-700" style={{ width: `${extra.alertInfo / total * 100}%` }} />
                    </div><b className="tabular-nums text-foreground">{extra.alerts}</b>
                  </div>;
                })}
                <div className="flex flex-wrap gap-4 border-t border-border pt-3 text-[12px] text-muted-foreground"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" />Critical</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" />Warning</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-sky-500" />Info</span></div>
              </div>
            </SectionCard></SpanCard>
            <SpanCard><SectionCard title="Group Availability (SLA)" icon={CheckCircle2} loading={loading} action={<span className="text-[13px] text-muted-foreground">Overall <b className="text-foreground">99.79%</b></span>}>
              <div className="space-y-3">{groups.slice(0, 6).map((group) => {
                const uptime = getDetails(group).uptime;
                return <div key={group.id} className="space-y-1.5">
                  <div className="flex justify-between gap-2 text-[13px]"><span className="truncate text-foreground">{group.name}</span><span className={cn("font-semibold tabular-nums", uptime >= 99.9 ? "text-emerald-600" : "text-amber-600")}>{uptime}% <span className="font-normal text-muted-foreground">/ 99.9%</span></span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full", uptime >= 99.9 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${uptime}%` }} /></div>
                </div>;
              })}</div>
            </SectionCard></SpanCard>
          </DashboardRow>

          <DashboardRow>
            <SpanCard><SectionCard title="Resource Usage by Group" icon={HardDrive} loading={loading} action={<div className="flex rounded-lg border border-border p-0.5">{(["Average", "Peak"] as const).map((mode) => <button key={mode} type="button" onClick={() => setResourceMode(mode)} className={cn("rounded-md px-2.5 py-1 text-[12px]", resourceMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{mode}</button>)}</div>}>
              <div className="space-y-3">
                {groups.slice(0, 6).map((group) => {
                  const extra = getDetails(group);
                  return <div key={group.id} className="space-y-2">
                    <p className="text-[13px] font-semibold text-foreground">{group.name}</p>
                    <div className="space-y-1.5">
                      {([["CPU", extra.cpu], ["Memory", extra.memory], ["Disk", extra.disk]] as [string, number][]).map(([label, baseValue]) => {
                        const value = Math.min(100, baseValue + (resourceMode === "Peak" ? 8 : 0) + (liveTick % 3));
                        const color = value > 90 ? "bg-rose-500" : value >= 70 ? "bg-amber-500" : "bg-emerald-500";
                        return <div key={label} className="grid grid-cols-[52px_1fr_42px] items-center gap-2 text-[12px]"><span className="text-muted-foreground">{label}</span><div className="h-2.5 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full transition-[width] duration-700", color)} style={{ width: `${value}%` }} /></div><b className="text-right tabular-nums text-foreground">{value}%</b></div>;
                      })}
                    </div>
                  </div>;
                })}
              </div>
            </SectionCard></SpanCard>
            <SpanCard><SectionCard title="Servers by Environment and Role" icon={Activity} loading={loading}>
              <div className="grid min-h-40 grid-cols-[minmax(110px,1fr)_1fr] items-center gap-3">
                <div className="h-40 min-w-0">
                  <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[
                    { name: "Production", value: groups.filter((group) => getDetails(group).environment === "Production").reduce((sum, group) => sum + group.totalServers, 0), color: "#2789ee" },
                    { name: "Staging", value: groups.filter((group) => getDetails(group).environment === "Staging").reduce((sum, group) => sum + group.totalServers, 0), color: "#f5a12b" },
                    { name: "Dev", value: groups.filter((group) => getDetails(group).environment === "Dev").reduce((sum, group) => sum + group.totalServers, 0), color: "#32c581" },
                  ]} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%" paddingAngle={3} stroke="none" isAnimationActive animationDuration={800}>{["#2789ee", "#f5a12b", "#32c581"].map((color, index) => <Cell key={index} fill={color} />)}</Pie><Tooltip {...chartTooltip} /></PieChart></ResponsiveContainer>
                </div>
                <div className="space-y-3 text-[13px]">{[
                  ["Production", groups.filter((group) => getDetails(group).environment === "Production").reduce((sum, group) => sum + group.totalServers, 0), "bg-blue-500"],
                  ["Staging", groups.filter((group) => getDetails(group).environment === "Staging").reduce((sum, group) => sum + group.totalServers, 0), "bg-amber-500"],
                  ["Dev", groups.filter((group) => getDetails(group).environment === "Dev").reduce((sum, group) => sum + group.totalServers, 0), "bg-emerald-500"],
                ].map(([label, count, color]) => <div key={label as string} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-muted-foreground"><i className={cn("h-2.5 w-2.5 rounded-full", color)} />{label}</span><b className="text-foreground">{count}</b></div>)}</div>
              </div>
              <div className="mt-3 border-t border-border pt-3"><p className="mb-2 text-[13px] font-semibold text-foreground">By role</p><div className="flex flex-wrap gap-2">{["Web", "Database", "Cache", "Backup", "App"].map((role) => <span key={role} className="rounded-full border border-border px-3 py-1 text-[12px] text-muted-foreground">{role} <b className="text-foreground">{groups.filter((group) => getDetails(group).role === role).reduce((sum, group) => sum + group.totalServers, 0)}</b></span>)}</div></div>
            </SectionCard></SpanCard>
            <SpanCard><SectionCard title="Maintenance Schedule" icon={CalendarClock} loading={loading} action={<Button variant="outline" onClick={() => showNotice("Maintenance scheduling is available in this demo.")} className="h-9 text-[12px]">Schedule maintenance</Button>}>
              <div className="space-y-3">{maintenance.map((item) => <div key={`${item.group}-${item.date}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3 last:border-0 last:pb-0">
                <div className="min-w-0"><p className="truncate text-[14px] font-semibold text-foreground">{item.group}</p><p className="text-[12px] text-muted-foreground">{item.date} · {item.time} · {item.duration}</p></div>
                <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", item.status === "Completed" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : item.status === "In progress" ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300")}>{item.status}</span>
              </div>)}</div>
            </SectionCard></SpanCard>
          </DashboardRow>

          <DashboardRow>
            <SpanCard span={8}><SectionCard title="Group Policies and Rules" icon={ShieldCheck} loading={loading}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead><tr className="border-b border-border text-[13px] font-semibold text-muted-foreground">{["Group", "CPU threshold", "Memory threshold", "Alert channel", "Auto-restart", "On-call contact"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
                  <tbody>{[
                    ["Production Servers", "85%", "80%", "#prod-alerts", 0, "Aisha Khan"],
                    ["Database Servers", "80%", "85%", "#database-ops", 1, "Omar Farooq"],
                    ["Web Servers", "85%", "80%", "#web-platform", 2, "Hamza Ali"],
                    ["Staging Servers", "90%", "85%", "#staging-alerts", 3, "Noor Zafar"],
                    ["Monitoring Nodes", "75%", "75%", "#infra-oncall", 4, "Zara Iqbal"],
                  ].map(([name, cpu, memory, channel, index, contact]) => <tr key={name as string} className="h-[52px] border-b border-border/70 text-[13px] last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-foreground">{name}</td><td className="px-3 py-2">{cpu}</td><td className="px-3 py-2">{memory}</td><td className="px-3 py-2 text-primary">{channel}</td>
                    <td className="px-3 py-2"><button type="button" role="switch" aria-checked={policies[index as number]} aria-label={`Toggle auto-restart for ${name}`} onClick={() => togglePolicy(index as number)} className={cn("relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", policies[index as number] ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}><span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-transform", policies[index as number] ? "left-6" : "left-1")} /></button></td>
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">{contact}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </SectionCard></SpanCard>
          </DashboardRow>
        </>}
      </TabsContent>
    </Tabs>
    <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={createGroup} />
    <GroupDetailsDialog group={detailGroup} open={Boolean(detailGroup)} onOpenChange={(open) => { if (!open) setDetailGroup(null); }} />
    {notice && <div role="status" className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-foreground shadow-lg"><Check size={16} className="text-emerald-600" />{notice}<button type="button" title="Dismiss" aria-label="Dismiss notification" onClick={() => setNotice("")} className="ml-2 rounded p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X size={15} /></button></div>}
  </div>;
}
