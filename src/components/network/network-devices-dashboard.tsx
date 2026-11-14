"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle, ArrowRight, CircleX, Download, MoreVertical, Network,
  Plus, Search, Signal,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { Icon } from "@/components/shared/icon";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MetricStat } from "@/data/mock/dashboard";
import type { InfrastructureMapMarker } from "@/components/live-operations/infrastructure-map";
import type { NocMapSite, NocMapStatus } from "@/data/mock/noc-map";

const NocOsmMap = dynamic(
  () => import("@/components/live-operations/noc-osm-map").then((module) => module.NocOsmMap),
  { ssr: false, loading: () => <div className="grid h-full min-h-[10.625rem] place-items-center rounded-md bg-card text-[0.75rem] text-muted-foreground">Loading location map…</div> },
);

type DeviceStatus = "Online" | "Warning" | "Offline";
type Device = { id: string; name: string; ip: string; type: string; maker: string; location: string; status: DeviceStatus; uptime: string; seen: string };

const stats: MetricStat[] = [
  { label: "Total Devices", value: "86", change: "2 new", trend: "up", tone: "blue", icon: "router" },
  { label: "Online", value: "78", change: "90.7% of total", trend: "flat", tone: "green", icon: "online" },
  { label: "Warning", value: "5", change: "5.8% of total", trend: "flat", tone: "amber", icon: "warning" },
  { label: "Offline", value: "3", change: "3.5% of total", trend: "flat", tone: "red", icon: "offline" },
  { label: "Average Uptime", value: "99.21%", change: "+0.12%", trend: "up", tone: "blue", icon: "network" },
];

const trend = Array.from({ length: 25 }, (_, i) => ({
  time: `${String(i).padStart(2, "0")}:00`,
  healthy: [98, 99, 98, 99, 98, 98, 97, 98, 98, 97, 98, 98, 99, 98, 98, 97, 98, 99, 98, 98, 99, 98, 99, 98, 97][i],
  warning: [2, 2, 3, 2, 3, 2, 3, 3, 2, 2, 3, 2, 2, 2, 3, 2, 2, 2, 3, 2, 2, 3, 2, 2, 3][i],
  offline: [1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1][i],
}));

const deviceTypes = [
  { name: "Switches", value: 33, color: "#288af0", percent: "38.4%" },
  { name: "Routers", value: 29, color: "#22bb83", percent: "33.7%" },
  { name: "Firewalls", value: 14, color: "#a15be3", percent: "16.3%" },
  { name: "Access Points", value: 10, color: "#f4a329", percent: "11.6%" },
];

const manufacturers = [
  { name: "Cisco", value: "32.6%", width: "65%", color: "#288af0", icon: "◈" },
  { name: "HP", value: "27.9%", width: "56%", color: "#22bb83", icon: "hp" },
  { name: "Juniper", value: "19.8%", width: "40%", color: "#a15be3", icon: "juniper" },
  { name: "Huawei", value: "11.6%", width: "23%", color: "#f4a329", icon: "✿" },
  { name: "Others", value: "8.1%", width: "16%", color: "#8fa2bb", icon: "●" },
];

const alerts = [
  { icon: CircleX, color: "text-rose-500", title: "Switch SW-01 is offline", sub: "Data Center · DC1", time: "2m ago" },
  { icon: AlertTriangle, color: "text-amber-500", title: "High CPU on Router RTR-02", sub: "Branch Office · BO1", time: "5m ago" },
  { icon: Signal, color: "text-sky-500", title: "Interface flapping on SW-03", sub: "Main Campus · MC", time: "12m ago" },
];

const devices: Device[] = [
  { id: "dev-01", name: "SW-CORE-01", ip: "192.168.1.1", type: "Switch", maker: "Cisco", location: "Data Center - DC1", status: "Online", uptime: "99.99%", seen: "Apr 23, 14:58" },
  { id: "dev-02", name: "RTR-EDGE-01", ip: "192.168.10.1", type: "Router", maker: "Juniper", location: "Branch Office - BO1", status: "Online", uptime: "99.95%", seen: "Apr 23, 14:57" },
  { id: "dev-03", name: "FW-01", ip: "192.168.20.1", type: "Firewall", maker: "Fortinet", location: "Main Campus - MC", status: "Warning", uptime: "99.12%", seen: "Apr 23, 14:55" },
  { id: "dev-04", name: "AP-01", ip: "192.168.30.1", type: "Access Point", maker: "Cisco", location: "Hostel Block - HB1", status: "Offline", uptime: "98.34%", seen: "Apr 23, 14:52" },
  { id: "dev-05", name: "SW-DIST-02", ip: "192.168.1.2", type: "Switch", maker: "HP", location: "Data Center - DC1", status: "Online", uptime: "99.98%", seen: "Apr 23, 14:50" },
];

const networkDeviceMapMarkers: InfrastructureMapMarker[] = [
  { name: "SW-CORE-01", lat: 24.8607, lng: 67.0011, status: "healthy", role: "Switch · Karachi" },
  { name: "RTR-EDGE-01", lat: 33.6844, lng: 73.0479, status: "healthy", role: "Router · Islamabad" },
  { name: "FW-01", lat: 31.5204, lng: 74.3587, status: "warning", role: "Firewall · Lahore" },
  { name: "AP-01", lat: 34.0151, lng: 71.5249, status: "critical", role: "Access point · Peshawar" },
  { name: "SW-DIST-02", lat: 33.5651, lng: 73.0169, status: "healthy", role: "Switch · Rawalpindi" },
];

const HEALTH_BY_STATUS = { healthy: 99.1, warning: 98.4, critical: 97.6 } as const;
const ALERTS_BY_STATUS = { healthy: 0, warning: 1, critical: 3 } as const;

/** Adapts the network device location markers to the NOC map's site model. */
const networkDeviceMapSites: NocMapSite[] = networkDeviceMapMarkers.map((marker) => {
  const status: NocMapStatus = marker.status === "healthy" ? "online" : marker.status;
  return {
    id: marker.name.toLowerCase(),
    code: marker.name,
    city: marker.name,
    country: marker.role,
    region: marker.role,
    provider: "—",
    facility: "—",
    lat: marker.lat,
    lng: marker.lng,
    status,
    health: HEALTH_BY_STATUS[marker.status],
    throughput: "—",
    alerts: ALERTS_BY_STATUS[marker.status],
    uptime: "—",
    lastCheck: "just now",
    servers: [],
  };
});

const statusStyle: Record<DeviceStatus, string> = {
  Online: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Offline: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

function HealthRing() {
  const circumference = 2 * Math.PI * 51;
  return <div className="relative h-[9.375rem] w-[9.375rem] shrink-0">
    <svg viewBox="0 0 142 142" className="h-full w-full -rotate-90"><circle cx="71" cy="71" r="51" fill="none" stroke="var(--muted)" strokeWidth="12" /><circle cx="71" cy="71" r="51" fill="none" stroke="#22bd83" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${circumference * 0.907} ${circumference}`} /></svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[1.5rem] font-extrabold leading-tight text-foreground">90.7%</b><span className="text-center text-[0.75rem] font-semibold leading-tight text-muted-foreground">Overall<br />Health</span></div>
  </div>;
}

export function NetworkDevicesDashboard() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All Status");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const visibleDevices = useMemo(() => devices.filter((device) => {
    const matchesQuery = `${device.name} ${device.ip} ${device.type} ${device.maker} ${device.location}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (filter === "All Status" || device.status === filter);
  }), [filter, query]);
  const toast = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const allVisibleSelected = visibleDevices.length > 0 && visibleDevices.every((device) => selected.includes(device.id));
  const selectVisible = () => {
    const visibleIds = new Set(visibleDevices.map((device) => device.id));
    setSelected(allVisibleSelected ? selected.filter((id) => !visibleIds.has(id)) : [...new Set([...selected, ...visibleIds])]);
  };

  return <div className="space-y-2.5 pb-3">
    <PageMeta breadcrumbs={["Infrastructure", "Network Devices"]} variant="detail" />
    <PageHeading title="Network Devices" description="Monitor and manage all network devices across your infrastructure" actionsAlign="top" variant="detail" />

    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">{stats.map((item) => <MetricCard key={item.label} item={item} className="h-[5.5rem]" labelClassName="text-[0.75rem] leading-4" valueClassName="text-[1.5rem] leading-7" trendClassName="text-[0.6875rem] leading-4" />)}</div>

    <div className="grid gap-2.5 xl:grid-cols-[1fr_1.3fr_1.3fr]">
      <Panel title="Device Health Overview" className="min-w-0" action={<Select defaultValue="24h"><SelectTrigger className="h-8 w-[4.75rem] text-[0.75rem]"><SelectValue /></SelectTrigger><SelectContent>{["1h", "6h", "24h", "7d"].map((range) => <SelectItem key={range} value={range}>{range}</SelectItem>)}</SelectContent></Select>}>
        <div className="flex min-h-[10.25rem] items-center justify-around gap-3"><HealthRing /><div className="space-y-3 text-[0.75rem]">{[["Healthy", "78", "bg-emerald-500"], ["Warning", "5", "bg-amber-500"], ["Offline", "3", "bg-rose-500"]].map(([label, value, color]) => <div key={label} className="flex min-w-[6.25rem] items-center gap-2"><i className={`h-2.5 w-2.5 rounded-full ${color}`} /><span className="flex-1 text-foreground">{label}</span><b className="text-foreground">{value}</b></div>)}</div></div>
      </Panel>

      <Panel title="Health Trend" className="min-w-0" action={<div className="flex items-center gap-3 text-[0.75rem] text-muted-foreground">{[["Healthy", "#288af0"], ["Warning", "#f59e0b"], ["Offline", "#ef4444"]].map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>}>
        <div className="h-[10.25rem] w-full pt-1"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="time" interval={3} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} /><YAxis width={44} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ border: "0.0625rem solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} /><Area dataKey="healthy" type="monotone" stroke="#288af0" strokeWidth={2} fill="#288af0" fillOpacity={0.05} dot={{ r: 2 }} /><Area dataKey="warning" type="monotone" stroke="#f59e0b" strokeWidth={1.8} fill="#f59e0b" fillOpacity={0.06} dot={{ r: 1.8 }} /><Area dataKey="offline" type="monotone" stroke="#ef4444" strokeWidth={1.7} fill="#ef4444" fillOpacity={0.05} dot={{ r: 1.6 }} /></AreaChart></ResponsiveContainer></div>
      </Panel>

      <Panel title="Device Status by Location" className="min-w-0">
        <div className="relative h-[10.25rem] overflow-hidden rounded-lg"><NocOsmMap sites={networkDeviceMapSites} center={[34.0151, 71.5249]} initialZoom={13} /></div>
      </Panel>
    </div>

    <div className="grid gap-2.5 xl:grid-cols-[1fr_1.12fr_1.05fr_0.9fr]">
      <Panel title="Top Manufacturers" className="min-w-0" action={<button onClick={() => toast("Showing manufacturer distribution.")} className="inline-flex shrink-0 items-center gap-1 text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={15} strokeWidth={3} aria-hidden="true" /></button>}>
        <div className="space-y-3 pt-1">{manufacturers.map((maker) => <div key={maker.name} className="grid grid-cols-[52px_minmax(0,1fr)_2.75rem] items-center gap-2 text-[0.75rem]"><span className="truncate font-semibold text-foreground">{maker.name}</span><div className="h-[0.5rem] rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: maker.width, background: maker.color }} /></div><b className="text-right text-foreground">{maker.value}</b></div>)}</div>
      </Panel>

      <Panel title="Device Types" className="min-w-0">
        <div className="flex h-[10.25rem] items-center gap-3"><div className="relative h-[9.375rem] w-[48%] shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={deviceTypes} dataKey="value" nameKey="name" innerRadius="65%" outerRadius="88%" paddingAngle={1} stroke="none">{deviceTypes.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[1.375rem] font-extrabold text-foreground">86</b><span className="text-[0.75rem] text-muted-foreground">Total</span></div></div><div className="min-w-0 flex-1 space-y-3">{deviceTypes.map((item) => <div key={item.name} className="grid grid-cols-[8px_minmax(0,1fr)_2.75rem] items-center gap-2 text-[0.75rem]"><i className="h-2 w-2 rounded-full" style={{ background: item.color }} /><span className="truncate text-foreground">{item.name}</span><b className="text-right text-foreground">{item.percent}</b></div>)}</div></div>
      </Panel>

      <Panel title="Alerts Summary" className="min-w-0" action={<button onClick={() => toast("Showing all active network alerts.")} className="inline-flex shrink-0 items-center gap-1 text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={15} strokeWidth={3} aria-hidden="true" /></button>}>
        <div className="space-y-3.5 pt-1">{alerts.map((alert) => <div key={alert.title} className="flex items-start gap-2.5"><alert.icon size={17} className={`mt-0.5 shrink-0 ${alert.color}`} /><div className="min-w-0 flex-1"><div className="truncate text-[0.75rem] font-semibold text-foreground">{alert.title}</div><div className="truncate text-[0.6875rem] text-muted-foreground">{alert.sub}</div></div><span className="shrink-0 text-[0.6875rem] text-muted-foreground">{alert.time}</span></div>)}</div>
      </Panel>

      <Panel title="Quick Actions" className="min-w-0" showOptions={false}>
        <div className="grid grid-cols-2 gap-2 pt-1">{[[Search, "Explore Devices"], [Network, "Manage Devices"], [Plus, "Add Device"], [Download, "Export Report"]].map(([IconComponent, label]) => <button key={label as string} onClick={() => toast(`${label as string} is a mockup action.`)} className="flex min-h-[3.625rem] flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-1.5 text-[0.6875rem] font-semibold text-[#526b87] transition-colors hover:border-primary/30 hover:bg-accent dark:text-[#c6d2e1]"><IconComponent size={17} className="text-primary" />{label as string}</button>)}</div>
      </Panel>
    </div>

    <Panel title="Network Devices List" action={<div className="flex flex-wrap items-center gap-2"><div className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search devices..." className="h-9 w-[9.375rem] pl-8 text-[0.75rem]" /></div><Select value={filter} onValueChange={setFilter}><SelectTrigger className="h-9 w-[7rem] text-[0.75rem]"><SelectValue /></SelectTrigger><SelectContent>{["All Status", "Online", "Warning", "Offline"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><button onClick={() => toast("Showing all 86 mock devices.")} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap px-1 text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={15} strokeWidth={3} aria-hidden="true" /></button></div>}>
      <div className="overflow-x-auto pt-4"><table className="w-full min-w-[67.5rem] text-left text-[0.75rem]"><thead><tr className="border-b border-border text-muted-foreground"><th className="w-10 pb-2"><input aria-label="Select all visible devices" type="checkbox" checked={allVisibleSelected} onChange={selectVisible} className="accent-primary" /></th>{["Device Name", "IP Address", "Type", "Manufacturer", "Location", "Status", "Uptime", "Last Seen", "Actions"].map((label) => <th key={label} className={`whitespace-nowrap pb-2 font-semibold ${label === "Actions" ? "text-center" : ""}`}>{label}</th>)}</tr></thead><tbody>{visibleDevices.map((device) => <tr key={device.id} className="border-b border-border/60 last:border-0"><td className="py-2.5"><input aria-label={`Select ${device.name}`} type="checkbox" checked={selected.includes(device.id)} onChange={() => toggleSelected(device.id)} className="accent-primary" /></td><td className="whitespace-nowrap py-2.5"><div className="flex items-center gap-2 font-semibold text-foreground"><i className={`h-2 w-2 rounded-full ${device.status === "Online" ? "bg-emerald-500" : device.status === "Warning" ? "bg-amber-500" : "bg-rose-500"}`} />{device.name}</div></td><td className="whitespace-nowrap py-2.5 text-muted-foreground">{device.ip}</td><td className="whitespace-nowrap py-2.5"><span className="rounded-full bg-sky-100 px-2 py-1 text-[0.6875rem] text-sky-700 dark:bg-sky-950 dark:text-sky-300">{device.type}</span></td><td className="whitespace-nowrap py-2.5 text-muted-foreground">{device.maker}</td><td className="whitespace-nowrap py-2.5 text-muted-foreground">{device.location}</td><td className="whitespace-nowrap py-2.5"><span className={`rounded-full px-2 py-1 text-[0.6875rem] font-semibold ${statusStyle[device.status]}`}>● {device.status}</span></td><td className="whitespace-nowrap py-2.5 text-muted-foreground">{device.uptime}</td><td className="whitespace-nowrap py-2.5 text-muted-foreground">{device.seen}</td><td className="py-2.5 text-center"><button onClick={() => toast(`${device.name} device actions are a mockup.`)} aria-label={`More actions for ${device.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><MoreVertical size={18} /></button></td></tr>)}</tbody></table>{visibleDevices.length === 0 && <div className="py-8 text-center text-[0.75rem] text-muted-foreground">No devices match this search.</div>}</div>
      {selected.length > 0 && <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[0.75rem] text-muted-foreground"><span>{selected.length} device{selected.length === 1 ? "" : "s"} selected</span><button onClick={() => setSelected([])} className="font-semibold text-primary">Clear selection</button></div>}
    </Panel>

    {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[0.75rem] text-foreground shadow-lg">{notice}</div>}
  </div>;
}
