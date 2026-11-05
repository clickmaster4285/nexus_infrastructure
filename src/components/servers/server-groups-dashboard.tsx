"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity, ArrowLeft, ArrowRight, Boxes, Check, Database, Download, Ellipsis, Filter,
  Globe2, Grid3X3, Layers3, Maximize2, Plus, Search, Server, SlidersHorizontal, TriangleAlert,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { serverGroupActivity, serverGroups as initialGroups, serverGroupTrend, type ServerGroup } from "@/data/mock/server-groups";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 6;
const iconByName = { server: Server, database: Database, cube: Boxes, globe: Globe2, layers: Layers3, grid: Grid3X3 };
const groupIconTone = { server: "bg-[#e6f8ef] text-[#22b573]", database: "bg-[#e2efff] text-[#3287ed]", cube: "bg-[#f1eaff] text-[#8854dd]", globe: "bg-[#e4f3ff] text-[#398cf0]", layers: "bg-[#eaf1ff] text-[#3e83ec]", grid: "bg-[#edf4ff] text-[#3287ed]" };

const tooltipStyle = {
  contentStyle: { border: "1px solid var(--border)", borderRadius: 8, fontSize: 11, background: "var(--popover)", color: "var(--popover-foreground)" },
};

function HealthOverview({ healthy, warning, critical }: { healthy: number; warning: number; critical: number }) {
  const total = healthy + warning + critical;
  const pct = total ? (healthy / total) * 100 : 0;
  const data = [
    { name: "Healthy", value: healthy, color: "#32c581" },
    { name: "Warning", value: warning, color: "#f5a12b" },
    { name: "Critical", value: critical, color: "#ec3f5d" },
  ];
  return (
    <div className="flex min-h-0 flex-1 items-center gap-2 px-1">
      <div className="relative h-[132px] w-[52%] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="92%" paddingAngle={1} stroke="none">
              {data.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className="font-display text-[21px] font-extrabold leading-none text-[#10213b] dark:text-[#e6edf7]">{pct.toFixed(1)}%</b>
          <span className="mt-1 text-[9px] font-semibold text-[#4f6885]">Healthy</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {data.map((item) => <div key={item.name} className="grid grid-cols-[8px_1fr_auto] items-center gap-2 text-[10px] text-[#506781] dark:text-[#a9bcd2]"><i className="h-2 w-2 rounded-full" style={{ background: item.color }} /><span>{item.name}</span><b className="text-foreground">{item.value}</b></div>)}
      </div>
    </div>
  );
}

function GroupTrend({ period }: { period: string }) {
  const pointCount = period === "1h" ? 2 : period === "6h" ? 4 : period === "12h" ? 7 : 13;
  return (
    <div className="h-[142px] w-full pt-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={serverGroupTrend.slice(-pointCount)} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="groupHealthyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#32c581" stopOpacity={0.16} /><stop offset="100%" stopColor="#32c581" stopOpacity={0.01} /></linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="time" interval="preserveStartEnd" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} />
          <Area type="monotone" dataKey="healthy" stroke="#34c584" fill="url(#groupHealthyFill)" strokeWidth={2} dot={{ r: 1.7, fill: "#34c584" }} />
          <Area type="monotone" dataKey="warning" stroke="#f5a12b" fill="transparent" strokeWidth={1.7} dot={{ r: 1.5, fill: "#f5a12b" }} />
          <Area type="monotone" dataKey="critical" stroke="#ec3f5d" fill="transparent" strokeWidth={1.7} dot={{ r: 1.5, fill: "#ec3f5d" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function LocationMap({ className }: { className?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const markers = [
    { x: 220, y: 198, name: "North America", status: "Healthy", groups: 3, color: "#32c581", icon: "✓" },
    { x: 405, y: 157, name: "Europe", status: "Healthy", groups: 4, color: "#32c581", icon: "✓" },
    { x: 526, y: 201, name: "Middle East", status: "Warning", groups: 1, color: "#f5a12b", icon: "!" },
    { x: 735, y: 167, name: "Asia Pacific", status: "Healthy", groups: 3, color: "#32c581", icon: "✓" },
    { x: 826, y: 251, name: "Oceania", status: "Critical", groups: 1, color: "#ec3f5d", icon: "!" },
  ];
  const visibleMarkers = markers.filter((marker) => statusFilter === "All" || marker.status === statusFilter);
  const activeMarker = markers.find((marker) => marker.name === selected);
  const legend = [
    { name: "Healthy", color: "#32c581" },
    { name: "Warning", color: "#f5a12b" },
    { name: "Critical", color: "#ec3f5d" },
  ];
  return (
    <div className={cn("relative min-h-0 flex-1 overflow-hidden rounded-md", className)}>
      <svg viewBox="0 0 1000 380" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" aria-label="Server group health by location map" role="img">
        <g fill="#e4edf9" stroke="#d9e5f4" strokeWidth="1.5">
          <path d="M72 80 110 51 167 45 201 61 235 58 273 78 289 105 270 125 249 130 237 151 214 163 207 191 183 200 171 222 151 213 139 190 117 179 104 153 84 143 69 117Z" />
          <path d="m226 207 23 5 18 22-4 30-16 32-7 41-19 24-12-32-9-31 5-36-12-24Z" />
          <path d="m422 82 28-24 45 3 19 15 42-4 28 18 51-5 27 19 42 6 30 21 52 1 37 21 40 14 14 21-18 22-31-4-20 14-31-7-25 18-28-9-20-21-28-8-19-20-42-6-20-20-34 4-29-11-26 12-28-15-35 5-27-16-36-3-23-15Z" />
          <path d="m491 170 33 7 22 25-5 43-19 40-11 45-25 27-21-27-7-38-17-28 8-36 19-22Z" />
          <path d="m673 207 23 6 17 18-9 19-20-5-17-18Z" />
          <path d="m779 250 30-9 37 10 24 23-15 18-40-2-24-16Z" />
          <path d="m857 301 13 8-5 17-14-5Z" />
          <path d="m920 228 10 6-3 13-10-4Z" />
        </g>
        {visibleMarkers.map((marker) => <g
          key={marker.name}
          transform={`translate(${marker.x} ${marker.y})`}
          role="button"
          tabIndex={0}
          aria-label={`${marker.name}: ${marker.status}, ${marker.groups} groups`}
          onClick={() => setSelected((current) => current === marker.name ? null : marker.name)}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected((current) => current === marker.name ? null : marker.name); } }}
          className="cursor-pointer outline-none"
        >
          <circle r="23" fill={marker.color} opacity=".12" />
          <circle r="15" fill={marker.color} stroke="white" strokeWidth="3" />
          <text y="5" textAnchor="middle" fontSize="14" fontWeight="800" fill="white">{marker.icon}</text>
        </g>)}
      </svg>
      {activeMarker && <div className="absolute left-1/2 top-1/2 z-[1] min-w-[128px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card/95 px-3 py-2 text-[10px] shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3"><b className="text-foreground">{activeMarker.name}</b><button type="button" onClick={() => setSelected(null)} aria-label="Close location details" className="text-muted-foreground hover:text-foreground"><span aria-hidden="true">×</span></button></div>
        <div className="mt-1 flex items-center gap-1.5 text-muted-foreground"><i className="h-2 w-2 rounded-full" style={{ background: activeMarker.color }} />{activeMarker.status}<span className="ml-auto">{activeMarker.groups} groups</span></div>
      </div>}
      <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-4 text-[9px] font-semibold text-[#536782] dark:text-[#c4d1e1]">
        {legend.map((item) => <button key={item.name} type="button" aria-pressed={statusFilter === item.name} onClick={() => { setStatusFilter((current) => current === item.name ? "All" : item.name); setSelected(null); }} className={cn("flex items-center gap-1 rounded-full px-1 py-0.5 transition-opacity", statusFilter !== "All" && statusFilter !== item.name && "opacity-40")}><i className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}</button>)}
      </div>
    </div>
  );
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Server Group</DialogTitle><DialogDescription>Add a group to organize and monitor your servers.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1.5 text-[11px] font-medium text-[#536780] dark:text-[#a9bcd2]">Group name<Input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production Servers" className="h-9 text-xs" /></label>
          <label className="block space-y-1.5 text-[11px] font-medium text-[#536780] dark:text-[#a9bcd2]">Location
            <Select value={location} onValueChange={setLocation}><SelectTrigger aria-label="Group location"><SelectValue /></SelectTrigger><SelectContent>{["DC – Islamabad", "DC – Lahore", "DC – Karachi", "DC – Rawalpindi", "Multi-region"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
          </label>
          <DialogFooter><Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" size="sm"><Plus size={14} />Create Group</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ServerGroupsDashboard() {
  const [groups, setGroups] = useState(initialGroups);
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState("All health");
  const [sortBy, setSortBy] = useState("name");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [period, setPeriod] = useState("24h");
  const [lastChecked, setLastChecked] = useState("just now");
  const [locationMapOpen, setLocationMapOpen] = useState(false);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = groups.filter((group) => {
      const matchesSearch = !query || `${group.name} ${group.location}`.toLowerCase().includes(query);
      const matchesHealth = healthFilter === "All health" || (healthFilter === "Healthy" ? group.warning === 0 && group.critical === 0 : healthFilter === "Warning" ? group.warning > 0 : group.critical > 0);
      return matchesSearch && matchesHealth;
    });
    return [...filtered].sort((a, b) => sortBy === "servers" ? b.totalServers - a.totalServers : sortBy === "health" ? b.health - a.health : sortBy === "load" ? b.load - a.load : a.name.localeCompare(b.name));
  }, [groups, search, healthFilter, sortBy]);
  const pages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const visibleGroups = filteredGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalGroups = groups.length;
  const healthyGroups = groups.filter((group) => group.warning === 0 && group.critical === 0).length;
  const warningGroups = groups.filter((group) => group.warning > 0).length;
  const criticalGroups = groups.filter((group) => group.critical > 0).length;
  const groupsWithMaintenance = 1;
  const avgLoad = groups.reduce((sum, group) => sum + group.load, 0) / Math.max(groups.length, 1);
  const totalHealthy = groups.reduce((sum, group) => sum + group.healthy, 0);
  const totalWarnings = groups.reduce((sum, group) => sum + group.warning, 0);
  const totalCritical = groups.reduce((sum, group) => sum + group.critical, 0);

  const stats = [
    { label: "Total Server Groups", value: String(totalGroups), change: "+ 1 new", trend: "up" as const, tone: "blue" as const, icon: "boxes" },
    { label: "Healthy Groups", value: String(healthyGroups), change: `${totalGroups ? ((healthyGroups / totalGroups) * 100).toFixed(1) : 0}% of total`, trend: "flat" as const, tone: "green" as const, icon: "shield-check" },
    { label: "With Warnings", value: String(warningGroups), change: `${totalGroups ? ((warningGroups / totalGroups) * 100).toFixed(1) : 0}% of total`, trend: "flat" as const, tone: "amber" as const, icon: "warning" },
    { label: "Maintenance Groups", value: String(groupsWithMaintenance), change: `${totalGroups ? ((groupsWithMaintenance / totalGroups) * 100).toFixed(1) : 0}% of total`, trend: "flat" as const, tone: "red" as const, icon: "calendar-clock" },
    { label: "Critical Groups", value: String(criticalGroups), change: `${totalGroups ? ((criticalGroups / totalGroups) * 100).toFixed(1) : 0}% of total`, trend: "flat" as const, tone: "red" as const, icon: "offline" },
    { label: "Avg. Group Load", value: `${avgLoad.toFixed(1)}%`, change: "+ 2%", trend: "up" as const, tone: "purple" as const, icon: "pulse" },
  ];

  function createGroup(name: string, location: string) {
    const nextGroup: ServerGroup = { id: `group-${Date.now()}`, name, totalServers: 0, healthy: 0, warning: 0, critical: 0, health: 100, load: 0, location, icon: "server" };
    setGroups((current) => [nextGroup, ...current]);
    setPage(1);
    setCreateOpen(false);
  }

  function exportReport() {
    const content = [["Group Name", "Total Servers", "Healthy", "Warning", "Critical", "Health %", "Load %", "Location"], ...filteredGroups.map((g) => [g.name, g.totalServers, g.healthy, g.warning, g.critical, g.health, g.load, g.location])]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "nexus-server-groups.csv"; link.click(); URL.revokeObjectURL(url);
  }

  function runHealthCheck() {
    setLastChecked("just now");
    setActionMenu(null);
  }

  return (
    <>
      <PageMeta breadcrumbs={["Infrastructure", "Server Groups"]} />
      <PageHeading title="Server Groups" description="Manage and monitor your server groups across infrastructure" icon={<Boxes size={22} />}>
        <Button onClick={() => setCreateOpen(true)} className="h-8 rounded-full bg-[#287ff0] px-4 text-[11px] font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-[#176edf]"><Plus size={14} />Create Group</Button>
      </PageHeading>

      <section aria-label="Server group metrics" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[78px]" />)}
      </section>

      <section aria-label="Server group overview" className="mt-2.5 grid gap-2.5 lg:grid-cols-[0.92fr_1.48fr_1.2fr]">
        <Card className="flex h-[200px] min-w-0 flex-col p-2.5">
          <div className="mb-1 flex h-6 items-center justify-between"><h2 className="font-display text-[12px] font-bold text-foreground">Group Health Overview</h2><span className="flex items-center gap-1 rounded-full bg-[#e5f8ef] px-2 py-0.5 text-[9px] font-semibold text-[#22ad70]"><i className="h-1.5 w-1.5 rounded-full bg-[#28bd7b]" />Live</span></div>
          <HealthOverview healthy={totalHealthy} warning={totalWarnings} critical={totalCritical} />
        </Card>
        <Card className="flex h-[200px] min-w-0 flex-col p-2.5">
          <div className="flex h-6 items-center justify-between gap-2"><h2 className="font-display truncate text-[12px] font-bold text-foreground">Server Groups Trend</h2><div className="flex shrink-0 items-center gap-1">{["1h", "6h", "12h", "24h"].map((value) => <button key={value} type="button" onClick={() => setPeriod(value)} className={cn("rounded-md px-2 py-1 text-[9px] font-semibold text-muted-foreground", period === value && "bg-[#e8f1ff] text-[#267bea] shadow-sm dark:bg-[#17385c] dark:text-[#82c1ff]")}>{value}</button>)}</div></div>
          <div className="mb-1 mt-1 flex justify-center gap-4 text-[9px] font-semibold text-[#536782] dark:text-[#c4d1e1]"><span className="flex items-center gap-1"><i className="h-1.5 w-2 rounded-full bg-[#32c581]" />Healthy</span><span className="flex items-center gap-1"><i className="h-1.5 w-2 rounded-full bg-[#f5a12b]" />Warning</span><span className="flex items-center gap-1"><i className="h-1.5 w-2 rounded-full bg-[#ec3f5d]" />Critical</span></div>
          <GroupTrend period={period} />
        </Card>
        <Card className="flex h-[200px] min-w-0 flex-col p-2.5">
          <div className="mb-1 flex h-6 items-center justify-between"><h2 className="font-display text-[12px] font-bold text-foreground">Group Status by Location</h2><button type="button" aria-label="Expand location map" onClick={() => setLocationMapOpen(true)} className="grid h-6 w-6 place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent"><Maximize2 size={13} /></button></div>
          <LocationMap />
        </Card>
      </section>

      <section aria-label="Server groups and quick actions" className="mt-2.5 grid items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_250px]">
        <Card className="min-w-0 overflow-hidden p-0">
          <div className="flex min-h-[48px] flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex min-w-0 items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e6f2ff] text-[#2b85ed]"><Boxes size={16} /></span><div><h2 className="font-display text-[12px] font-bold text-foreground">Server Groups</h2><p className="text-[9px] text-muted-foreground">View and manage all server groups</p></div></div>
            <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
              <label className="relative min-w-[150px] flex-1 sm:w-[170px] sm:flex-none"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search groups..." aria-label="Search groups" className="h-[29px] pl-8 text-[10px]" /></label>
              <Select value={healthFilter} onValueChange={(value) => { setHealthFilter(value); setPage(1); }}><SelectTrigger className="h-[29px] w-[82px] text-[10px]" aria-label="Filter groups by health"><Filter size={12} /><SelectValue /></SelectTrigger><SelectContent>{["All health", "Healthy", "Warning", "Critical"].map((value) => <SelectItem value={value} key={value}>{value}</SelectItem>)}</SelectContent></Select>
              <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="h-[29px] w-[72px] text-[10px]" aria-label="Sort groups"><SlidersHorizontal size={12} /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Name</SelectItem><SelectItem value="servers">Servers</SelectItem><SelectItem value="health">Health</SelectItem><SelectItem value="load">Load</SelectItem></SelectContent></Select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] table-auto border-collapse text-left">
              <thead><tr className="bg-[#f5f8fc] text-[9px] font-semibold text-[#536781] dark:bg-[#142338] dark:text-[#a9bcd2]">{["Group Name", "Total Servers", "Healthy", "Warning", "Critical", "Health %", "Load", "Location", "Actions"].map((label) => <th key={label} scope="col" className="whitespace-nowrap border-b border-border px-2.5 py-2 text-center first:text-left">{label}</th>)}</tr></thead>
              <tbody>
                {visibleGroups.map((group) => {
                  const GroupIcon = iconByName[group.icon];
                  return <tr key={group.id} className="h-[31px] border-b border-border/70 text-[10px] last:border-b-0 hover:bg-[#f8fbff] dark:hover:bg-[#142338]">
                    <td className="whitespace-nowrap px-3 py-1.5"><span className="flex items-center gap-2 font-semibold text-[#29486d] dark:text-[#d7e2ef]"><span className={cn("grid h-4 w-4 place-items-center rounded-[4px]", groupIconTone[group.icon])}><GroupIcon size={11} /></span>{group.name}</span></td>
                    <td className="px-2 py-1.5 text-center font-medium text-[#526782] dark:text-[#b8c5d6]">{group.totalServers}</td>
                    <td className="px-2 py-1.5 text-center font-semibold text-[#26ad70]">{group.healthy}</td>
                    <td className={cn("px-2 py-1.5 text-center font-semibold", group.warning ? "text-[#e88b2b]" : "text-[#e88b2b]")}>{group.warning}</td>
                    <td className="px-2 py-1.5 text-center font-semibold text-[#e84258]">{group.critical}</td>
                    <td className="px-2 py-1.5 text-center"><span className={cn("inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold", group.health >= 80 ? "bg-[#e4f8ee] text-[#20a96c]" : "bg-[#fff1dc] text-[#dc9020]")}>{group.health}%</span></td>
                    <td className="min-w-[85px] px-2 py-1.5"><div className="flex items-center gap-1.5"><div className="h-1 w-14 overflow-hidden rounded-full bg-[#e8eff7] dark:bg-[#24364d]"><span className="block h-full rounded-full bg-[#347ff0]" style={{ width: `${Math.min(group.load, 100)}%` }} /></div><span className="text-[9px] text-[#526782] dark:text-[#b8c5d6]">{group.load.toFixed(1)}%</span></div></td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-center text-[#536782] dark:text-[#b8c5d6]">{group.location}</td>
                    <td className="relative px-2 py-1.5 text-center"><button type="button" aria-label={`Actions for ${group.name}`} aria-expanded={actionMenu === group.id} onClick={() => setActionMenu((current) => current === group.id ? null : group.id)} className="rounded-md border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-accent"><Ellipsis size={13} /></button>{actionMenu === group.id && <div className="absolute right-3 top-8 z-20 w-32 rounded-md border border-border bg-card p-1 text-left shadow-lg"><Link href="/all-servers" className="block rounded px-2 py-1.5 text-[10px] text-foreground hover:bg-accent">View servers</Link><button type="button" onClick={() => { setGroups((current) => current.filter((item) => item.id !== group.id)); setActionMenu(null); setPage(1); }} className="block w-full rounded px-2 py-1.5 text-left text-[10px] text-[#dc4256] hover:bg-accent">Remove group</button></div>}</td>
                  </tr>;
                })}
                {visibleGroups.length === 0 && <tr><td colSpan={9} className="h-20 text-center text-[11px] text-muted-foreground">No server groups match your filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex min-h-[34px] items-center justify-between gap-2 px-3 text-[9px] text-muted-foreground"><span>Showing {filteredGroups.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredGroups.length)} of {filteredGroups.length} groups</span><div className="flex items-center gap-1"><button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page" className="grid h-6 w-6 place-items-center rounded-md border border-border disabled:opacity-40"><ArrowLeft size={12} /></button>{Array.from({ length: pages }, (_, index) => index + 1).map((number) => <button key={number} onClick={() => setPage(number)} className={cn("h-6 min-w-6 rounded-md border border-border px-1.5", page === number && "border-[#327cf0] bg-[#327cf0] font-semibold text-white")}>{number}</button>)}<button disabled={page === pages} onClick={() => setPage((current) => Math.min(pages, current + 1))} aria-label="Next page" className="grid h-6 w-6 place-items-center rounded-md border border-border disabled:opacity-40"><ArrowRight size={12} /></button></div></div>
        </Card>

        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="p-2.5">
            <h2 className="mb-1.5 flex items-center gap-1.5 font-display text-[12px] font-bold text-foreground"><span className="grid h-5 w-5 place-items-center rounded-md bg-[#e6f2ff] text-[#287ff0]"><Activity size={12} /></span>Quick Actions</h2>
            <div className="grid gap-1">
              <button type="button" onClick={() => setCreateOpen(true)} className="flex h-[27px] items-center gap-2 rounded-lg bg-[#f0f5ff] px-2.5 text-left text-[10px] font-semibold text-[#315174] transition hover:bg-[#e5efff] dark:bg-[#162941] dark:text-[#c4d1e1]"><Plus size={13} className="text-[#287ff0]" />Create Server Group</button>
              <Link href="/all-servers" className="flex h-[27px] items-center gap-2 rounded-lg bg-[#f0f5ff] px-2.5 text-[10px] font-semibold text-[#315174] transition hover:bg-[#e5efff] dark:bg-[#162941] dark:text-[#c4d1e1]"><Server size={13} className="text-[#287ff0]" />View All Servers</Link>
              <button type="button" onClick={runHealthCheck} className="flex h-[27px] items-center gap-2 rounded-lg bg-[#f0f5ff] px-2.5 text-left text-[10px] font-semibold text-[#315174] transition hover:bg-[#e5efff] dark:bg-[#162941] dark:text-[#c4d1e1]"><Activity size={13} className="text-[#287ff0]" />Check Health <span className="ml-auto text-[8px] font-normal text-muted-foreground">{lastChecked}</span></button>
              <button type="button" onClick={exportReport} className="flex h-[27px] items-center gap-2 rounded-lg bg-[#f0f5ff] px-2.5 text-left text-[10px] font-semibold text-[#315174] transition hover:bg-[#e5efff] dark:bg-[#162941] dark:text-[#c4d1e1]"><Download size={13} className="text-[#287ff0]" />Export Report</button>
            </div>
          </Card>
          <Card className="p-2.5">
            <div className="mb-1.5 flex items-center justify-between"><h2 className="font-display text-[12px] font-bold text-foreground">Recent Activity</h2><Link href="/events-explorer" className="text-[9px] font-medium text-[#287ff0] hover:underline">View All →</Link></div>
            <div className="relative ml-1 border-l border-[#dce6f1] pl-3 dark:border-[#29394e]">{serverGroupActivity.map((item) => <div key={item.group} className="relative mb-2.5 last:mb-0"><span className={cn("absolute -left-[17px] top-0.5 grid h-3 w-3 place-items-center rounded-full ring-2 ring-card", item.tone === "green" ? "bg-[#e5f8ef] text-[#22b573]" : item.tone === "amber" ? "bg-[#fff2dc] text-[#e89a27]" : "bg-[#e7f1ff] text-[#287ff0]")}>{item.tone === "green" ? <Check size={8} /> : item.tone === "amber" ? <TriangleAlert size={8} /> : <Plus size={8} />}</span><p className="truncate text-[9px] font-semibold text-[#334f70] dark:text-[#d3dfed]">{item.group}</p><div className="flex items-center justify-between gap-1"><span className="truncate text-[8px] text-muted-foreground">{item.status}</span><span className="shrink-0 text-[8px] text-muted-foreground">{item.time}</span></div></div>)}</div>
          </Card>
        </div>
      </section>

      <Dialog open={locationMapOpen} onOpenChange={setLocationMapOpen}>
        <DialogContent className="h-[min(620px,85vh)] w-[min(900px,92vw)] max-w-none grid-rows-[auto_1fr] gap-3">
          <DialogHeader><DialogTitle>Group Status by Location</DialogTitle><DialogDescription>Select a marker or status to inspect server group health by region.</DialogDescription></DialogHeader>
          <LocationMap className="min-h-[320px]" />
        </DialogContent>
      </Dialog>
      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={createGroup} />
    </>
  );
}
