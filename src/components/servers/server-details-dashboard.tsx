"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight, Bell, Check, CheckCircle2, CircleAlert, Cpu, Download, FileText, HardDrive, Info,
  ChevronLeft, LoaderCircle, MemoryStick, Network, Pause, RotateCw, Server as ServerIcon, Settings2, Terminal, Users,
  type LucideIcon,
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { findServerById, serverDetailsPath, serverGroupName, servers, type Server as ServerRecord } from "@/data/mock/servers";
import { isServerInMaintenance } from "@/mocks/maintenanceWindows";
import {
  getServerDetailEvents, mockServerActionUser, serverQuickActionGroups,
  type ServerActionId, type ServerDetailEvent, type ServerEventSeverity,
} from "@/data/mock/server-detail-activity";

const tabs = ["Performance", "Network", "Disk", "Processes", "Services", "Logs", "Events"];

function Panel({ title, children, action, className = "", titleClassName = "" }: { title: string; children: React.ReactNode; action?: React.ReactNode; className?: string; titleClassName?: string }) {
  return (
    <Card className={`flex min-w-0 flex-col p-4 ${className}`}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <CardTitle className={`truncate font-semibold ${titleClassName || "text-[15px]"}`}>{title}</CardTitle>
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

const eventSeverityStyle: Record<ServerEventSeverity, { Icon: LucideIcon; tone: string; dot: string }> = {
  Info: { Icon: Info, tone: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  Warning: { Icon: AlertTriangle, tone: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  Critical: { Icon: CircleAlert, tone: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
};

const serverActionIcons: Record<ServerActionId, LucideIcon> = {
  "view-logs": FileText,
  "view-metrics": Activity,
  "open-terminal": Terminal,
  "manage-services": Settings2,
  "update-agent": Download,
  "add-to-group": Users,
  "create-alert-rule": Bell,
  "restart-server": RotateCw,
  "maintenance-mode": Pause,
};

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function eventStatusStyle(status: ServerDetailEvent["status"]) {
  if (status === "Open") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
  if (status === "Resolved") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
  return "border-border bg-muted/60 text-muted-foreground";
}

export function ServerDetailsDashboard({ serverId }: { serverId?: string }) {
  if (!serverId) return <ServerPicker />;
  const server = findServerById(serverId);
  if (!server) return <ServerNotFound />;
  return <ServerDetailsView key={server.id} server={server} />;
}

function ServerPicker() {
  const [query, setQuery] = useState("");
  const matches = servers.filter((server) => `${server.name} ${server.ip}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="min-w-0">
      <PageMeta breadcrumbs={["Infrastructure", "Server Details"]} />
      <PageHeading title="Server Details" description="Choose a server to view its details" />
      <Card className="p-4">
        <label htmlFor="server-picker-search" className="mb-2 block text-[12px] font-medium text-muted-foreground">Search servers</label>
        <input id="server-picker-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or IP" className="mb-3 h-9 w-full rounded-md border border-input bg-card px-3 text-[13px] text-foreground sm:max-w-sm" />
        <ul className="divide-y divide-border">
          {matches.map((server) => (
            <li key={server.id}>
              <Link href={serverDetailsPath(server)} className="flex items-center justify-between gap-3 py-3 hover:bg-accent/50">
                <span><b className="block text-[13px] text-foreground">{server.name}</b><small className="text-[12px] text-muted-foreground">{server.ip}</small></span>
                {isServerInMaintenance(server.name) ? <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2 py-1 text-[12px] font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />In Maintenance</span> : <span className={`rounded-full px-2 py-1 text-[12px] font-medium ${server.health === "Offline" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : server.health === "Degraded" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>{server.health}</span>}
              </Link>
            </li>
          ))}
          {matches.length === 0 && <li className="py-8 text-center text-[13px] text-muted-foreground">No servers found.</li>}
        </ul>
      </Card>
    </div>
  );
}

function ServerNotFound() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Card className="flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <ServerIcon size={28} className="text-muted-foreground" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-foreground">Server not found</h1>
        <p className="text-[13px] text-muted-foreground">The requested server does not exist or is no longer available.</p>
        <Button asChild variant="outline"><Link href="/all-servers">Back to All Servers</Link></Button>
      </Card>
    </div>
  );
}

function ServerDetailsView({ server }: { server: ServerRecord }) {
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("Apr 23, 2025 14:32");
  const [activeTab, setActiveTab] = useState("Performance");
  const [timeRange, setTimeRange] = useState("24h");
  const [pinging, setPinging] = useState(false);
  const [events, setEvents] = useState<ServerDetailEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState(false);
  const [eventFilter, setEventFilter] = useState<"All" | "Warning" | "Critical">("All");
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [actionLoading, setActionLoading] = useState<ServerActionId | null>(null);
  const [lastAction, setLastAction] = useState("Agent updated by admin · 2h ago");
  const noticeTimer = useRef<number | null>(null);
  const hasAdminPermission = mockServerActionUser.permissions.includes("server:manage");

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(false);
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
      setEvents(getServerDetailEvents(server));
    } catch (error) {
      console.error(`Unable to load events for server ${server.id}`, error);
      setEventsError(true);
    } finally {
      setEventsLoading(false);
    }
  }, [server]);

  useEffect(() => {
    void loadEvents();
    return () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, [loadEvents]);

  const diskUsage = server.disk;
  const networkMbps = Number.parseFloat(server.network) || 0;
  const seriesTimes = ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "24:00"];
  const performance = seriesTimes.map((time, index) => ({
    time,
    cpu: Math.max(0, Math.min(100, server.cpu + [-4, -2, 1, -3, -5, -1, 3, 1, -1, -3, -4, -2, 0][index])),
    memory: Math.max(0, Math.min(100, server.memory + [-3, -2, -2, -1, -2, -1, -2, 0, -1, 0, -1, 0, 1][index])),
  }));
  const traffic = ["00:00", "06:00", "12:00", "18:00", "24:00"].map((time, index) => ({
    time,
    inbound: Math.round(networkMbps * [0.72, 0.84, 1.18, 0.98, 0.77][index] * 10) / 10,
    outbound: Math.round(networkMbps * [0.43, 0.61, 0.69, 0.63, 0.55][index] * 10) / 10,
  }));
  const serviceNames = server.os.startsWith("Windows")
    ? ["IIS", "Windows Update", "Remote Desktop", "Event Log", "Monitoring Agent"]
    : ["nginx", "docker", "ssh", "systemd", "Monitoring Agent"];
  const services = serviceNames.map((name, index) => ({
    name,
    status: server.health === "Offline" ? "Stopped" : server.agent === "Pending" ? "Unknown" : "Running",
    cpu: `${(server.cpu * [0.04, 0.03, 0.02, 0.01, 0.015][index]).toFixed(1)}%`,
    memory: `${Math.max(12, Math.round(server.memory * [0.7, 1.8, 0.25, 0.4, 0.35][index]))} MB`,
  }));
  const processes = serviceNames.map((name, index) => ({
    name,
    pid: 1000 + index * 137 + (Number.parseInt(server.id.slice(-2), 10) || 0),
    user: index === 0 ? "root" : server.environment.toLowerCase(),
    cpu: `${(server.cpu * [0.42, 0.28, 0.16, 0.08, 0.06][index]).toFixed(1)}%`,
    memory: `${Math.max(12, Math.round(server.memory * [3.1, 2.7, 1.6, 1.2, 0.8][index]))} MB`,
  }));
  const diskHistory = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"].map((time, index) => {
    const used = Math.max(0, Math.min(100, server.disk + [-4, -3, -2, -1, 0, 1, 0][index]));
    return { time, used, free: 100 - used };
  });
  const logs = [
    { time: "14:32:08", level: "INFO", message: `${server.name}: health check completed` },
    { time: "14:31:52", level: "INFO", message: `${server.agent}: agent heartbeat ${server.heartbeat}` },
    { time: "14:30:17", level: server.memory >= 80 ? "WARN" : "INFO", message: `${server.name}: memory utilization ${server.memory}%` },
    { time: "14:29:04", level: server.cpu >= 80 ? "WARN" : "INFO", message: `${server.name}: CPU utilization ${server.cpu}%` },
    { time: "14:28:42", level: "INFO", message: `${server.name}: disk utilization ${server.disk}%` },
  ];
  const serverProfile = {
    operatingSystem: server.os,
    group: serverGroupName(server),
    location: server.location,
    provider: server.provider,
    environment: server.environment,
    uptime: server.uptime,
    lastReboot: server.uptime === "—" ? "Not reported" : `${server.uptime} ago`,
    cpuRam: `${server.cpu >= 60 ? 16 : server.cpu >= 30 ? 8 : 4} vCPU / ${server.memory >= 60 ? 64 : 32} GB`,
    lastChecked: server.heartbeat,
    usage: [
      { label: "CPU", value: server.cpu },
      { label: "Memory", value: server.memory },
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
  const resourceMetrics = [
    { label: "CPU Usage", value: `${server.cpu}%`, change: "Current", icon: Cpu, color: "#287cf0" },
    { label: "Memory Usage", value: `${server.memory}%`, change: "Current", icon: MemoryStick, color: "#a044f5" },
    { label: "Disk Usage", value: `${diskUsage}%`, change: "Current", icon: HardDrive, color: "#f59e0b" },
    { label: "Network", value: server.network, change: "Current", icon: Network, color: "#20b77a" },
    { label: "Uptime", value: server.uptime, change: "Current", icon: Activity, color: "#287cf0" },
  ];
  const memoryBreakdown = [
    { name: "Used", value: server.memory, color: "#20b77a" },
    { name: "Available", value: 100 - server.memory, color: "#dce8f5" },
  ];
  const healthTone = server.health === "Offline"
    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
    : server.health === "Degraded"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      : server.health === "Pending"
        ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const cpuValues = performance.map((point) => point.cpu);
  const memoryValues = performance.map((point) => point.memory);
  const inboundValues = traffic.map((point) => point.inbound);
  const outboundValues = traffic.map((point) => point.outbound);
  const cpuStats = `Avg CPU ${average(cpuValues)}% · Peak CPU ${Math.max(...cpuValues)}% · Avg Memory ${average(memoryValues)}% · Peak Memory ${Math.max(...memoryValues)}%`;
  const networkStats = `Avg In ${average(inboundValues)} Mbps · Avg Out ${average(outboundValues)} Mbps · Peak ${Math.max(...inboundValues)} Mbps`;
  const visibleEvents = events.filter((event) => eventFilter === "All" || event.severity === eventFilter);
  const warningCount = events.filter((event) => event.severity === "Warning").length;
  const criticalCount = events.filter((event) => event.severity === "Critical").length;

  function showNotice(message: string, isError = false) {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotice(message);
    setNoticeIsError(isError);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2600);
  }

  function actionDisabled(id: ServerActionId) {
    if (id === "restart-server" && server.health === "Offline") return true;
    if (id === "maintenance-mode" && server.health === "Offline") return true;
    if ((id === "open-terminal" || id === "update-agent" || id === "view-metrics") && (server.health === "Offline" || server.agent === "Pending")) return true;
    const action = serverQuickActionGroups.flatMap((group) => group.actions).find((item) => item.id === id);
    return Boolean(action?.requiresAdmin && !hasAdminPermission);
  }

  async function executeAction(id: ServerActionId) {
    const action = serverQuickActionGroups.flatMap((group) => group.actions).find((item) => item.id === id);
    if (!action || actionDisabled(id)) return;
    setActionLoading(id);
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 650));
      if (id === "restart-server" && server.health === "Offline") throw new Error("Offline servers cannot be restarted.");
      showNotice(`${action.label} completed for ${server.name}.`);
      setLastAction(`${action.label} by ${mockServerActionUser.name} · just now`);
      if (id === "restart-server") setConfirmRestart(false);
    } catch (error) {
      console.error(`Server action ${id} failed for ${server.id}`, error);
      showNotice(`${action.label} failed. Please retry.`, true);
    } finally {
      setActionLoading(null);
    }
  }

  function handleQuickAction(id: ServerActionId) {
    if (actionDisabled(id)) return;
    if (id === "restart-server") {
      setConfirmRestart(true);
      return;
    }
    void executeAction(id);
  }

  function refresh() {
    setLastUpdated(new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }));
    showNotice("Server details refreshed.");
  }

  function pingServer() {
    setPinging(true);
    showNotice(`${server.name} ping check completed.`);
    window.setTimeout(() => setPinging(false), 900);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 pb-3">
      <PageMeta breadcrumbs={["Infrastructure", "All Servers", server.name]} breadcrumbLinks={{ "All Servers": "/all-servers" }} variant="detail" lastUpdated={lastUpdated} actions={isServerInMaintenance(server.name) ? <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2 py-1 text-[12px] font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><i className="h-2 w-2 animate-pulse rounded-full bg-violet-500" aria-hidden="true" />In Maintenance</span> : <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-medium ${healthTone}`}><i className={`h-2 w-2 rounded-full ${server.health === "Offline" ? "bg-rose-500" : server.health === "Degraded" ? "bg-amber-500" : server.health === "Pending" ? "bg-slate-500" : "bg-emerald-500"}`} />{server.agent}</span>} onRefresh={refresh} />
      <PageHeading title={server.name} description={`${server.host} · ${server.environment} server`} actionsAlign="top" variant="detail">
        <Button asChild variant="outline" className="h-9 gap-2 px-3 text-[13px]"><Link href="/all-servers"><ChevronLeft size={15} />Back to All Servers</Link></Button>
        <Button variant="outline" onClick={refresh} className="h-9 gap-2 px-3 text-[13px]"><RotateCw size={15} />Refresh</Button>
        <Button variant="outline" onClick={() => showNotice("Server report exported.")} className="h-9 gap-2 px-3 text-[13px]"><Download size={15} />Export</Button>
      </PageHeading>

      <section aria-label="Server summary" className="grid min-w-0 grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(230px,1.25fr)_minmax(0,4fr)]">
        <Card className="flex h-full min-w-0 flex-col p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${healthTone}`}><i className={`h-2 w-2 rounded-full ${server.agent === "Online" ? "bg-emerald-500" : server.agent === "Offline" ? "bg-rose-500" : "bg-slate-500"}`} />{server.agent}</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${healthTone}`}><CheckCircle2 size={12} />{server.health}</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-blue-100 text-primary dark:bg-blue-950"><ServerIcon size={34} /></span>
            <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate font-display text-[22px] font-bold text-foreground">{server.name}</h2><button type="button" aria-label="Copy hostname" onClick={() => showNotice("Hostname copied.")} className="text-muted-foreground hover:text-primary"><FileText size={14} /></button></div><p className="mt-1 text-[11px] text-muted-foreground">IP Address</p><p className="text-[13px] font-semibold text-foreground">{server.ip}</p><p className="truncate text-[11px] text-muted-foreground">{server.host}</p></div>
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
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[12px]"><thead><tr className="border-b border-border text-[11px] text-muted-foreground">{["Time", "Type", "Message", "Status"].map((heading) => <th key={heading} className="px-3 pb-3 font-medium">{heading}</th>)}</tr></thead><tbody>
            {eventsLoading ? <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Loading events…</td></tr>
              : eventsError ? <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Could not load events.</td></tr>
              : events.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No events for this server.</td></tr>
              : events.map((event) => { const severity = eventSeverityStyle[event.severity]; const SeverityIcon = severity.Icon; return <tr key={event.id} className="h-11 border-b border-border/60 last:border-0"><td className="whitespace-nowrap px-3 tabular-nums text-muted-foreground" title={new Date(event.occurredAt).toLocaleString()}>{relativeTime(event.occurredAt)}</td><td className="px-3"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-foreground ${severity.tone}`}><i className={`h-2 w-2 shrink-0 rounded-full ${severity.dot}`} /><SeverityIcon size={13} aria-hidden="true" />{event.severity}</span></td><td title={event.message} className="max-w-0 truncate px-3 text-foreground">{event.message}</td><td className="px-3 text-foreground">{event.status}</td></tr>; })}
          </tbody></table></div>
        </Panel>}
        </div>
      </section>

      <section aria-label="Server services and health" className="grid min-w-0 items-stretch gap-3 xl:grid-cols-3">
        <Panel title="Services Status" action={<button type="button" onClick={() => { setActiveTab("Services"); showNotice("Showing all server services."); }} className="text-[11px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto"><table className="w-full min-w-[360px] text-left text-[12px]"><thead><tr className="border-b border-border text-[11px] text-muted-foreground">{["Service", "Status", "CPU", "Memory"].map((heading) => <th key={heading} className="px-2 pb-2 font-medium">{heading}</th>)}</tr></thead><tbody>{services.map((service) => <tr key={service.name} className="h-9 border-b border-border/60 last:border-0"><td className="px-2 font-medium text-foreground"><span className="inline-flex items-center gap-2.5"><ServiceIcon name={service.name} />{service.name}</span></td><td className="px-2"><span className={`inline-flex items-center gap-1.5 ${service.status === "Running" ? "text-emerald-700 dark:text-emerald-300" : service.status === "Stopped" ? "text-rose-700 dark:text-rose-300" : "text-slate-600 dark:text-slate-300"}`}><i className={`h-2 w-2 rounded-full ${service.status === "Running" ? "bg-emerald-500" : service.status === "Stopped" ? "bg-rose-500" : "bg-slate-500"}`} />{service.status}</span></td><td className="px-2 text-muted-foreground">{service.cpu}</td><td className="px-2 text-muted-foreground">{service.memory}</td></tr>)}</tbody></table></div>
        </Panel>

        <Panel title="System Information" action={<button type="button" onClick={() => showNotice("System information menu opened.")} aria-label="System information actions" className="text-muted-foreground"><span className="text-lg leading-none">⋮</span></button>}>
          <div className="grid h-full min-h-[190px] grid-cols-[minmax(0,1fr)_130px] items-center gap-2">
            <dl className="divide-y divide-border text-[12px]">{[["Operating System", server.os], ["Architecture", server.os.startsWith("Windows") ? "x64" : "x86_64"], ["CPU / RAM", serverProfile.cpuRam], ["Disk Utilization", `${server.disk}%`], ["Network", server.network]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-2 py-2"><dt className="text-muted-foreground">{label}</dt><dd className="m-0 truncate text-right font-medium text-foreground">{value}</dd></div>)}</dl>
            <div className="relative h-[128px] w-[128px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={memoryBreakdown} dataKey="value" innerRadius="72%" outerRadius="92%" startAngle={90} endAngle={-270} stroke="none">{memoryBreakdown.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[21px] font-bold text-foreground">{server.memory}%</b><span className="text-[11px] text-muted-foreground">Memory</span></div></div>
          </div>
        </Panel>

        <Panel title="Server Health">
          <div className="flex h-full min-h-[190px] flex-col justify-between">
            <div className="pt-2 text-center"><div className="flex items-center justify-center gap-3 text-emerald-600"><CheckCircle2 size={30} fill="currentColor" className="text-emerald-500 [&_*]:text-white" /><strong className="text-[23px]">{server.health}</strong></div><p className="mt-2 text-[13px] text-muted-foreground">{server.health === "Healthy" ? "All systems are running normally" : `Server status is ${server.health.toLowerCase()}`}</p></div>
            <div className="h-[92px] min-w-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={traffic} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}><Area dataKey="inbound" stroke="#20b77a" strokeWidth={2} fill="#20b77a" fillOpacity={0.13} dot={false} /></AreaChart></ResponsiveContainer></div>
          </div>
        </Panel>
      </section>

      <section aria-label="Server activity and actions" className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
        <Panel title="Recent Events" titleClassName="text-[16px] font-semibold" className="h-full rounded-xl">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter recent events">
              {([
                { label: "All", count: events.length },
                { label: "Warning", count: warningCount },
                { label: "Critical", count: criticalCount },
              ] as const).map(({ label, count }) => <button key={label} type="button" aria-pressed={eventFilter === label} onClick={() => setEventFilter(label)} className={`min-h-7 rounded-full border px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${eventFilter === label ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-accent"}`}>{label} <span className="tabular-nums">({count})</span></button>)}
            </div>
            <div className="grid grid-cols-[72px_78px_minmax(0,1fr)_76px] items-center border-b border-border px-2 pb-1 text-[12px] font-medium text-muted-foreground" aria-hidden="true">
              <span>Time</span><span>Type</span><span>Event</span><span>Status</span>
            </div>
            <div className="min-h-0 flex-1">
              {eventsLoading ? <div role="status" aria-label="Loading server events" className="divide-y divide-border/60">
                {Array.from({ length: 8 }, (_, index) => <div key={index} className="grid h-11 grid-cols-[72px_78px_minmax(0,1fr)_76px] items-center gap-1 px-2"><span className="h-3 w-12 animate-pulse rounded bg-muted" /><span className="h-3 w-14 animate-pulse rounded bg-muted" /><span className="h-3 w-4/5 animate-pulse rounded bg-muted" /><span className="h-5 w-14 animate-pulse rounded-full bg-muted" /></div>)}
              </div> : eventsError ? <div role="alert" className="flex min-h-44 flex-col items-center justify-center gap-2 text-center">
                <AlertCircle size={18} className="text-destructive" aria-hidden="true" />
                <p className="text-[13px] text-muted-foreground">Could not load events for this server.</p>
                <button type="button" onClick={() => void loadEvents()} className="min-h-8 rounded px-2 text-[12px] font-semibold text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Retry</button>
              </div> : visibleEvents.length === 0 ? <div className="flex min-h-44 items-center justify-center text-[13px] text-muted-foreground">No events for this server</div> : <ul className="divide-y divide-border/60" aria-label={`${visibleEvents.length} filtered server events`}>
                {visibleEvents.map((event) => {
                  const severity = eventSeverityStyle[event.severity];
                  const SeverityIcon = severity.Icon;
                  const StatusIcon = event.status === "Open" ? AlertCircle : event.status === "Resolved" ? CheckCircle2 : Check;
                  const dateTooltip = new Date(event.occurredAt).toLocaleString();
                  return <li key={event.id} className="grid h-11 grid-cols-[72px_78px_minmax(0,1fr)_76px] items-center gap-1 px-2 text-[13px]">
                    <time dateTime={event.occurredAt} title={dateTooltip} className="whitespace-nowrap text-[12px] text-muted-foreground">{relativeTime(event.occurredAt)}</time>
                    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${severity.tone}`}><i className={`h-2 w-2 shrink-0 rounded-full ${severity.dot}`} /><SeverityIcon size={13} aria-hidden="true" />{event.severity}</span>
                    <span title={event.message} className="truncate text-foreground">{event.message}</span>
                    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[12px] font-medium ${eventStatusStyle(event.status)}`}><StatusIcon size={12} aria-hidden="true" />{event.status}</span>
                  </li>;
                })}
              </ul>}
            </div>
            <footer className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2 text-[12px]">
              <span className="text-muted-foreground">Showing {visibleEvents.length} of 32 events</span>
              <button type="button" onClick={() => { setActiveTab("Events"); showNotice("Showing all server events."); }} className="inline-flex min-h-7 items-center gap-1 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="View all server events">View all <ArrowRight size={14} aria-hidden="true" /></button>
            </footer>
          </div>
        </Panel>
        <Panel title="Quick Actions" titleClassName="text-[16px] font-semibold" className="h-full rounded-xl">
          <div className="flex h-full min-h-0 flex-col">
            <div className="space-y-4">
              {serverQuickActionGroups.map((group) => <section key={group.label} aria-label={`${group.label} actions`}>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                <div className="grid grid-cols-3 gap-2 max-[639px]:grid-cols-2">
                  {group.actions.map((action) => {
                    const ActionIcon = serverActionIcons[action.id];
                    const danger = group.label === "Danger zone";
                    const disabled = actionDisabled(action.id);
                    const disabledMessage = action.requiresAdmin && !hasAdminPermission ? "Admin permission required" : server.health === "Offline" ? "Unavailable while server is offline" : "";
                    return <button key={action.id} type="button" disabled={disabled} title={disabled ? disabledMessage : action.label} aria-label={disabled ? `${action.label}. ${disabledMessage}` : action.label} onClick={() => handleQuickAction(action.id)} className={`inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg border px-2 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${danger ? "border-rose-300 bg-rose-50/50 text-rose-700 hover:border-rose-400 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/60" : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent"}`}>
                      {actionLoading === action.id ? <LoaderCircle size={15} className="shrink-0 animate-spin" aria-hidden="true" /> : <ActionIcon size={15} className={`shrink-0 ${danger ? "text-rose-600 dark:text-rose-300" : "text-primary"}`} aria-hidden="true" />}
                      <span className="truncate">{action.label}</span>
                    </button>;
                  })}
                </div>
              </section>)}
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <h3 className="mb-2 text-[12px] font-semibold text-muted-foreground">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {server.tags.map((tag) => <span key={tag} className="rounded-full bg-secondary px-2.5 py-1 text-[12px] font-medium text-secondary-foreground">{tag}</span>)}
                <button type="button" onClick={() => showNotice("Tag management is available to server administrators.")} className="rounded-full border border-dashed border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">+ Add tag</button>
              </div>
            </div>
            <footer className="mt-auto border-t border-border pt-3 text-[12px] text-muted-foreground"><span className="font-medium">Last action:</span> {lastAction}</footer>
          </div>
        </Panel>
      </section>

      <Dialog open={confirmRestart} onOpenChange={(open) => { if (!actionLoading) setConfirmRestart(open); }}>
        <DialogContent aria-label={`Confirm restart for ${server.name}`} onEscapeKeyDown={(event) => { if (actionLoading) event.preventDefault(); }} onInteractOutside={(event) => { if (actionLoading) event.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>Restart {server.name}?</DialogTitle>
            <DialogDescription className="text-[13px]">Yeh server kuch minutes ke liye unavailable ho sakta hai.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" disabled={Boolean(actionLoading)} onClick={() => setConfirmRestart(false)} className="min-h-9 rounded-md border border-border px-3 text-[13px] font-medium hover:bg-accent disabled:opacity-50">Cancel</button>
            <button type="button" disabled={Boolean(actionLoading) || actionDisabled("restart-server")} onClick={() => void executeAction("restart-server")} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-rose-600 px-3 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{actionLoading === "restart-server" && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}Restart</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {notice && <div role={noticeIsError ? "alert" : "status"} className={`fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] shadow-lg ${noticeIsError ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200" : "border-border bg-card text-foreground"}`}>{noticeIsError ? <CircleAlert size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}{notice}</div>}
    </div>
  );
}


