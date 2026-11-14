"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity, AlertCircle, AlertTriangle, ArrowDown, ArrowUp, Bell, Check, CheckCircle2,
  Clock3, Cpu, Database, FileText, HardDrive, HeartPulse, Info, Network, Pause, Play,
  RotateCw, Server, ShieldCheck, Terminal, Zap,
  type LucideIcon,
} from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { Card, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type AlertSeverity = "Critical" | "Warning" | "Info";

const initialAlerts: { id: number; severity: AlertSeverity; title: string; age: string }[] = [
  { id: 1, severity: "Warning", title: "Memory usage above 70%", age: "12m ago" },
  { id: 2, severity: "Info", title: "Deployment completed", age: "38m ago" },
];

const demoEvents = [
  { time: "2m ago", title: "CPU usage dropped to 32%", status: "Info" },
  { time: "5m ago", title: "Backup completed successfully", status: "Success" },
  { time: "12m ago", title: "Memory usage reached 72%", status: "Warning" },
  { time: "1h ago", title: "Scheduled maintenance started", status: "Info" },
  { time: "2h ago", title: "nginx service restarted", status: "Success" },
  { time: "3h ago", title: "TLS certificate check passed", status: "Info" },
  { time: "5h ago", title: "Disk snapshot created", status: "Success" },
  { time: "8h ago", title: "Elevated network traffic detected", status: "Warning" },
];

const processRows = [
  { pid: 1842, name: "nginx", cpu: "18.2%", memory: "210 MB" },
  { pid: 2316, name: "node", cpu: "12.5%", memory: "180 MB" },
  { pid: 1088, name: "postgres", cpu: "8.7%", memory: "320 MB" },
  { pid: 2671, name: "python", cpu: "5.1%", memory: "120 MB" },
  { pid: 892, name: "dockerd", cpu: "3.9%", memory: "98 MB" },
  { pid: 1420, name: "redis-server", cpu: "2.8%", memory: "64 MB" },
  { pid: 754, name: "sshd", cpu: "1.2%", memory: "22 MB" },
  { pid: 506, name: "cron", cpu: "0.4%", memory: "12 MB" },
];

const healthChecks = [
  { name: "Ping", detail: "12 ms", tone: "bg-emerald-500", color: "oklch(0.6978 0.1459 161.8)", values: [16, 13, 14, 11, 12, 12, 10, 12] },
  { name: "HTTP :80", detail: "28 ms", tone: "bg-emerald-500", color: "oklch(0.6274 0.175 253.33)", values: [31, 28, 29, 27, 30, 26, 28, 28] },
  { name: "HTTPS :443", detail: "34 ms", tone: "bg-emerald-500", color: "oklch(0.6274 0.175 253.33)", values: [37, 35, 36, 31, 33, 32, 34, 34] },
  { name: "SSH :22", detail: "18 ms", tone: "bg-emerald-500", color: "oklch(0.6207 0.1922 300.63)", values: [20, 18, 19, 17, 18, 16, 18, 18] },
];

const diskPartitions = [
  { mount: "/", size: "80 GB", used: "42 GB", free: "38 GB", percent: 53, iops: "1.2k" },
  { mount: "/var", size: "120 GB", used: "91 GB", free: "29 GB", percent: 76, iops: "2.8k" },
  { mount: "/data", size: "500 GB", used: "438 GB", free: "62 GB", percent: 88, iops: "4.1k" },
];

const networkSeries = [
  { time: "00:00", inbound: 34, outbound: 22 },
  { time: "04:00", inbound: 28, outbound: 19 },
  { time: "08:00", inbound: 55, outbound: 32 },
  { time: "12:00", inbound: 42, outbound: 29 },
  { time: "16:00", inbound: 68, outbound: 41 },
  { time: "20:00", inbound: 51, outbound: 36 },
];

const initialServices = [
  { name: "nginx", status: "Running", uptime: "42d 6h", memory: "210 MB" },
  { name: "sshd", status: "Running", uptime: "142d 6h", memory: "22 MB" },
  { name: "docker", status: "Running", uptime: "18d 3h", memory: "98 MB" },
  { name: "cron", status: "Running", uptime: "142d 6h", memory: "12 MB" },
  { name: "postgresql", status: "Running", uptime: "42d 6h", memory: "320 MB" },
];

const initialLogs = [
  { time: "14:32:08", level: "INFO", text: "nginx: request completed status=200 duration=18ms" },
  { time: "14:31:52", level: "INFO", text: "systemd: Started container runtime" },
  { time: "14:30:17", level: "WARN", text: "node: memory usage reached 72%" },
  { time: "14:29:04", level: "INFO", text: "healthcheck: HTTPS endpoint responding in 34ms" },
  { time: "14:28:42", level: "INFO", text: "backup: snapshot verification completed" },
  { time: "14:27:31", level: "WARN", text: "disk: /data usage reached 88%" },
  { time: "14:26:09", level: "INFO", text: "sshd: accepted publickey for deploy" },
  { time: "14:25:18", level: "ERROR", text: "worker: retrying upstream connection (attempt 1)" },
];

const generatedLogMessages = [
  { level: "INFO", text: "nginx: request completed status=200 duration=21ms" },
  { level: "INFO", text: "healthcheck: all endpoints responding normally" },
  { level: "WARN", text: "node: memory usage is above 70%" },
  { level: "INFO", text: "systemd: scheduled task completed successfully" },
  { level: "ERROR", text: "worker: upstream retry completed successfully" },
];

function SectionCard({
  title, icon: Icon, children, action, className = "", gridClassName = "", loading = false, error,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  gridClassName?: string;
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <Card className={`flex h-full min-w-0 flex-col p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg ${className} ${gridClassName}`}>
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-[1rem] font-semibold"><Icon size={17} className="shrink-0 text-primary" />{title}</CardTitle>
        {action}
      </div>
      <div className="min-h-0 flex-1">
        {loading ? <CardSkeleton /> : error ? <CardError message={error} /> : children}
      </div>
    </Card>
  );
}

function CardSkeleton() {
  return <div role="status" aria-label="Loading card data" className="space-y-3 pt-1">
    <span className="block h-4 w-2/3 animate-pulse rounded bg-muted" />
    <span className="block h-4 w-full animate-pulse rounded bg-muted" />
    <span className="block h-4 w-4/5 animate-pulse rounded bg-muted" />
    <span className="block h-20 w-full animate-pulse rounded-md bg-muted" />
  </div>;
}

function CardError({ message }: { message: string }) {
  return <div role="alert" className="flex min-h-24 items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-[0.8125rem] text-destructive">
    <AlertCircle size={16} />{message}
  </div>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center text-[0.8125rem] text-muted-foreground">{children}</div>;
}

function DashboardRow({ children }: { children: React.ReactNode }) {
  return <section className="grid min-w-0 grid-cols-1 items-stretch gap-5 min-[56.25rem]:grid-cols-2 xl:grid-cols-12">{children}</section>;
}

function SpanCard({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "min-w-0 xl:col-span-8" : "min-w-0 xl:col-span-4"}>{children}</div>;
}

function TinyTrend({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 24 - ((value - min) / Math.max(1, max - min)) * 20;
    return `${x},${y}`;
  }).join(" ");
  return <svg viewBox="0 0 100 28" className="h-7 w-20 shrink-0" role="img" aria-label="Recent trend">
    <polyline points={points} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>;
}

function StatusDot({ tone = "bg-emerald-500" }: { tone?: string }) {
  return <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} />;
}

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  return <div className="flex flex-col items-center gap-2">
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90" role="img" aria-label={`${label} usage ${value}%`}>
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--muted)" strokeWidth="8" />
        <circle cx="48" cy="48" r={radius} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-[1.125rem] font-bold text-foreground">{value}%</span>
    </div>
    <span className="text-[0.8125rem] font-medium text-muted-foreground">{label}</span>
  </div>;
}

function severityClass(severity: AlertSeverity) {
  if (severity === "Critical") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  if (severity === "Warning") return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300";
}

function UptimeBars() {
  const bars = Array.from({ length: 90 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (89 - index));
    const status = index === 23 ? "Incident" : index === 54 || index === 77 ? "Degraded" : index === 34 ? "No data" : "Uptime";
    const color = status === "Incident" ? "bg-red-500" : status === "Degraded" ? "bg-amber-400" : status === "No data" ? "bg-slate-300 dark:bg-slate-600" : "bg-emerald-500";
    return { date, status, color };
  });
  return <div className="flex h-12 items-stretch gap-px" aria-label="90 day uptime history">
    {bars.map(({ date, status, color }, index) => <span key={index} title={`${date.toLocaleDateString()} - ${status}`} className={`min-w-0 flex-1 rounded-[0.0625rem] ${color}`} />)}
  </div>;
}

function ProgressBar({ value }: { value: number }) {
  const tone = value > 90 ? "bg-red-500" : value >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return <div className="h-2 min-w-16 overflow-hidden rounded-full bg-muted">
    <div className={`h-full rounded-full transition-[width] duration-500 ${tone}`} style={{ width: `${value}%` }} />
  </div>;
}

function HealthChecks() {
  return <div className="divide-y divide-border">
    {healthChecks.map((check) => <div key={check.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <StatusDot tone={check.tone} />
      <span className="min-w-0 flex-1 text-[0.8125rem] font-medium text-foreground">{check.name}</span>
      <TinyTrend values={check.values} color={check.color} />
      <span className="w-16 text-right text-[0.8125rem] tabular-nums text-muted-foreground">{check.detail}</span>
    </div>)}
  </div>;
}

export function ServerDetailsOverview({
  onTabChange, onAction,
}: {
  onTabChange: (tab: string) => void;
  onAction: (label: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [eventFilter, setEventFilter] = useState("All");
  const [services, setServices] = useState(initialServices);
  const [serviceToRestart, setServiceToRestart] = useState<string | null>(null);
  const [backupRunning, setBackupRunning] = useState(false);
  const [logPaused, setLogPaused] = useState(false);
  const [logs, setLogs] = useState(initialLogs);
  const [liveTick, setLiveTick] = useState(0);
  const logSequence = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 450);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setLiveTick((value) => value + 1), 3000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (logPaused) return;
    const timer = window.setInterval(() => {
      const entry = generatedLogMessages[logSequence.current % generatedLogMessages.length];
      logSequence.current += 1;
      setLogs((current) => [...current, {
        ...entry,
        time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      }].slice(-8));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [logPaused]);

  const filteredEvents = eventFilter === "All" ? demoEvents : demoEvents.filter((event) => event.status === eventFilter);
  const diskUsage = 72 + liveTick % 3;
  const inboundTraffic = 142 + (liveTick % 5) * 2;
  const coreUsage = [24, 42, 63, 38, 72, 51, 29, 46].map((value, index) => (value + liveTick * (index % 3 + 1)) % 100);

  function updateService() {
    if (!serviceToRestart) return;
    setServices((current) => current.map((service) => service.name === serviceToRestart ? { ...service, status: "Running" } : service));
    onAction(`Restarted ${serviceToRestart}`);
    setServiceToRestart(null);
  }

  return <div className="flex min-w-0 flex-col gap-5">
    <DashboardRow>
      <SpanCard><SectionCard title="Server Overview" icon={Server} loading={loading} action={<span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Healthy</span>}>
        <div className="grid h-full min-h-48 items-center gap-5 sm:grid-cols-[150px_minmax(0,1fr)]">
          <div className="relative mx-auto grid h-36 w-36 place-items-center">
            <svg viewBox="0 0 144 144" className="absolute inset-0 h-full w-full -rotate-90" role="img" aria-label="Overall health 98.7 percent">
              <circle cx="72" cy="72" r="61" fill="none" stroke="var(--muted)" strokeWidth="10" />
              <circle cx="72" cy="72" r="61" fill="none" stroke="oklch(0.7157 0.1468 162.25)" strokeWidth="10" strokeLinecap="round" strokeDasharray={2 * Math.PI * 61} strokeDashoffset={2 * Math.PI * 61 * 0.013} />
            </svg>
            <div className="text-center"><strong className="font-display text-[1.5625rem] font-extrabold text-foreground">98.7%</strong><div className="text-[0.8125rem] font-medium text-muted-foreground">Overall Health</div><div className="mt-1 text-[0.8125rem] text-emerald-600">+0.2% today</div></div>
          </div>
          <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {[["Hostname", "web-01"], ["IP Address", "192.168.1.25"], ["Operating System", "Ubuntu 22.04 LTS"], ["Location", "New York, USA"], ["Server Group", "Web Servers"], ["Data Center", "DC-1"]].map(([label, value]) => <div key={label} className="flex min-w-0 items-center justify-between gap-2 border-b border-border/70 py-2 last:border-0"><dt className="text-[0.8125rem] text-muted-foreground">{label}</dt><dd className="m-0 truncate text-right text-[0.8125rem] font-semibold text-foreground">{value}</dd></div>)}
          </dl>
        </div>
      </SectionCard></SpanCard>

      <SpanCard><SectionCard title="Performance Overview" icon={Activity} loading={loading} action={<span className="text-xs text-muted-foreground">Last 24 hours</span>}>
        <div className="flex h-full min-h-48 flex-col">
          <div className="flex flex-wrap gap-x-4 gap-y-2 pb-2 text-xs text-muted-foreground">
            {[["CPU", "oklch(0.6311 0.1762 253.47)"], ["Memory", "oklch(0.7128 0.1367 167.48)"], ["Disk", "oklch(0.562 0.1512 286.83)"], ["Network", "oklch(0.776 0.1483 69.58)"]].map(([name, color]) => <span key={name} className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{name}</span>)}
          </div>
          <div className="min-h-40 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={networkSeries.map((point, index) => ({ ...point, cpu: metricCpu[index] + liveTick % 4, memory: metricMemory[index], disk: 67 + ((index + liveTick) % 8) }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ border: "0.0625rem solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
                <Line dataKey="cpu" name="CPU" stroke="oklch(0.6311 0.1762 253.47)" strokeWidth={2} dot={false} isAnimationActive animationDuration={600} />
                <Line dataKey="memory" name="Memory" stroke="oklch(0.7128 0.1367 167.48)" strokeWidth={2} dot={false} isAnimationActive animationDuration={600} />
                <Line dataKey="disk" name="Disk" stroke="oklch(0.562 0.1512 286.83)" strokeWidth={2} dot={false} isAnimationActive animationDuration={600} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[0.8125rem] text-muted-foreground">CPU averages <strong className="text-foreground">32%</strong> with steady memory at <strong className="text-foreground">46%</strong>.</p>
        </div>
      </SectionCard></SpanCard>

      <SpanCard><SectionCard title="Quick Actions" icon={Zap} loading={loading}>
        <div className="grid h-full content-center gap-3">
          {[
            ["Restart Server", RotateCw],
            ["Shutdown Server", Pause],
            ["View Logs", FileText],
            ["Open Console", Terminal],
          ].map(([label, Icon]) => <button key={label as string} type="button" onClick={() => onAction(label as string)} title={label as string} className="flex h-11 items-center gap-3 rounded-lg border border-border px-4 text-left text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon size={17} className="text-primary" />{label as string}</button>)}
        </div>
      </SectionCard></SpanCard>
    </DashboardRow>

    <DashboardRow>
      <SpanCard><SectionCard title="Resources Usage" icon={HardDrive} loading={loading}>
        <div className="flex h-full flex-col">
          <div className="grid flex-1 grid-cols-2 items-center gap-4 min-[80rem]:grid-cols-2">
            <Gauge label="CPU" value={32 + liveTick % 3} color="oklch(0.7035 0.1467 162.06)" />
            <Gauge label="Memory" value={46 + liveTick % 2} color="oklch(0.6868 0.1224 226.14)" />
            <Gauge label="Disk" value={diskUsage} color="oklch(0.6122 0.1867 302.04)" />
            <Gauge label="Network" value={28 + liveTick % 4} color="oklch(0.7697 0.1533 72.36)" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
            {[["Swap", "12%"], ["Inodes", "34%"], ["Processes", "187"]].map(([label, value]) => <div key={label}><div className="text-[0.8125rem] text-muted-foreground">{label}</div><div className="mt-1 text-[0.9375rem] font-semibold text-foreground">{value}</div></div>)}
          </div>
        </div>
      </SectionCard></SpanCard>

      <SpanCard><SectionCard title="Top Processes" icon={Cpu} loading={loading} action={<button type="button" onClick={() => onTabChange("processes")} className="rounded text-[0.8125rem] font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View All</button>}>
        <div className="overflow-x-auto max-[39.9375rem]:-mx-2 max-[39.9375rem]:px-2">
          <table className="server-details-table w-full border-collapse text-left">
            <colgroup><col className="w-[14%]" /><col className="w-[26%]" /><col className="w-[15%]" /><col className="w-[23%]" /><col className="w-[22%]" /></colgroup>
            <thead className="sticky top-0 z-[1] bg-card text-muted-foreground"><tr className="border-b border-border"><th>PID</th><th>Process</th><th className="text-right">CPU</th><th className="text-right">Memory</th><th className="text-right">Status</th></tr></thead>
            <tbody>{processRows.map((process) => <tr key={process.pid} className="border-b border-border/60 last:border-0"><td className="tabular-nums text-muted-foreground">{process.pid}</td><td className="font-semibold text-foreground">{process.name}</td><td className="text-right tabular-nums text-muted-foreground">{process.cpu}</td><td className="text-right tabular-nums text-muted-foreground">{process.memory}</td><td className="text-right"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Running</span></td></tr>)}</tbody>
          </table>
        </div>
      </SectionCard></SpanCard>

      <SpanCard><SectionCard title="Recent Events" icon={Bell} loading={loading} action={<button type="button" onClick={() => onTabChange("events")} className="rounded text-[0.8125rem] font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View All</button>}>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter recent events">
          {["All", "Info", "Warning", "Success"].map((filter) => <button key={filter} type="button" onClick={() => setEventFilter(filter)} aria-pressed={eventFilter === filter} className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${eventFilter === filter ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>{filter}</button>)}
        </div>
        <div className="divide-y divide-border">
          {filteredEvents.map((event) => <div key={event.title} className="flex items-center gap-3 py-2.5 first:pt-0">
            <StatusDot tone={event.status === "Warning" ? "bg-amber-500" : event.status === "Success" ? "bg-emerald-500" : "bg-sky-500"} />
            <span className="w-16 shrink-0 text-[0.8125rem] text-muted-foreground">{event.time}</span>
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-foreground">{event.title}</span>
            <span className={`rounded-full px-2 py-1 text-[0.75rem] font-semibold ${event.status === "Warning" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : event.status === "Success" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"}`}>{event.status}</span>
          </div>)}
          {filteredEvents.length === 0 && <EmptyState>No events match this filter.</EmptyState>}
        </div>
      </SectionCard></SpanCard>
    </DashboardRow>

    <DashboardRow>
      <SpanCard><SectionCard title="Active Alerts" icon={AlertTriangle} loading={loading} action={<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">{alerts.length} open</span>}>
        {alerts.length === 0 ? <EmptyState><CheckCircle2 size={22} className="text-emerald-600" />No active alerts</EmptyState> : <div className="divide-y divide-border">
          {alerts.map((alert) => <div key={alert.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severityClass(alert.severity)}`}>{alert.severity}</span>
            <span className="min-w-0 flex-1 text-[0.8125rem] font-medium text-foreground">{alert.title}</span>
            <span className="text-[0.8125rem] text-muted-foreground">{alert.age}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setAlerts((current) => current.filter((item) => item.id !== alert.id)); onAction("Alert acknowledged"); }} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Acknowledge</button>
              <button type="button" onClick={() => { setAlerts((current) => current.filter((item) => item.id !== alert.id)); onAction("Alert resolved"); }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Resolve</button>
            </div>
          </div>)}
        </div>}
      </SectionCard></SpanCard>

      <SpanCard><SectionCard title="Uptime History" icon={Clock3} loading={loading}>
        <div className="flex h-full flex-col">
          <div className="mb-4 flex items-end justify-between gap-3"><strong className="server-details-metric-value font-display font-bold text-foreground">99.98% <span className="text-[0.875rem] font-medium text-muted-foreground">uptime</span></strong><span className="text-[0.8125rem] text-muted-foreground">Last 90 days</span></div>
          <UptimeBars />
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-[0.8125rem]"><span className="text-muted-foreground">Last incident</span><strong className="font-medium text-foreground">Oct 14, 2026 · 4m</strong></div>
        </div>
      </SectionCard></SpanCard>

      <SpanCard><SectionCard title="Health Checks" icon={HeartPulse} loading={loading} action={<span className="text-xs text-emerald-600">All passing</span>}>
        <HealthChecks />
      </SectionCard></SpanCard>
    </DashboardRow>

    <DashboardRow>
      <SpanCard><SectionCard title="Disk Partitions" icon={HardDrive} loading={loading}>
        <div className="overflow-x-auto max-[39.9375rem]:-mx-2 max-[39.9375rem]:px-2">
          <table className="server-details-table w-full border-collapse text-left">
            <colgroup><col className="w-[10%]" /><col className="w-[13%]" /><col className="w-[13%]" /><col className="w-[13%]" /><col className="w-[39%]" /><col className="w-[12%]" /></colgroup>
            <thead className="text-muted-foreground"><tr className="border-b border-border"><th>Mount</th><th className="text-right">Size</th><th className="text-right">Used</th><th className="text-right">Free</th><th>Usage</th><th className="text-right">IOPS</th></tr></thead>
            <tbody>{diskPartitions.map((partition) => <tr key={partition.mount} className="border-b border-border/60 last:border-0"><td className="font-semibold text-foreground">{partition.mount}</td><td className="text-right tabular-nums text-muted-foreground">{partition.size}</td><td className="text-right tabular-nums text-muted-foreground">{partition.used}</td><td className="text-right tabular-nums text-muted-foreground">{partition.free}</td><td><div className="flex min-w-[7.5rem] items-center gap-2"><ProgressBar value={partition.percent} /><span className="shrink-0 text-[0.8125rem] tabular-nums text-muted-foreground">{partition.percent}%</span></div></td><td className="text-right tabular-nums text-muted-foreground">{partition.iops}</td></tr>)}</tbody>
          </table>
        </div>
      </SectionCard></SpanCard>

      <SpanCard><SectionCard title="Network Interfaces" icon={Network} loading={loading}>
        <div className="flex h-full min-h-64 flex-col">
          <div className="mb-3 grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs text-muted-foreground"><span>Interface</span><span>In / Out Mbps</span><span>Errors</span></div>
          <div className="divide-y divide-border text-[0.8125rem]">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-2"><span className="font-semibold text-foreground">eth0 <span className="font-normal text-muted-foreground">· 142 / 68 Mbps</span></span><span className="text-muted-foreground">18.2k / 9.4k pkts</span><span className="text-emerald-600">0</span></div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-2"><span className="font-semibold text-foreground">lo <span className="font-normal text-muted-foreground">· 4 / 4 Mbps</span></span><span className="text-muted-foreground">1.2k / 1.2k pkts</span><span className="text-emerald-600">0</span></div>
          </div>
          <div className="mt-3 min-h-32 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={networkSeries.map((point, index) => ({ ...point, inbound: point.inbound + liveTick % 7, outbound: point.outbound + liveTick % 4 }))} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ border: "0.0625rem solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
                <Line dataKey="inbound" name="Inbound Mbps" stroke="oklch(0.6311 0.1762 253.47)" strokeWidth={2} dot={false} isAnimationActive animationDuration={600} />
                <Line dataKey="outbound" name="Outbound Mbps" stroke="oklch(0.7128 0.1367 167.48)" strokeWidth={2} dot={false} isAnimationActive animationDuration={600} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground"><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-[oklch(0.6311_0.1762_253.47)]" />Inbound</span><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-[oklch(0.7128_0.1367_167.48)]" />Outbound</span></div>
        </div>
      </SectionCard></SpanCard>

      <SpanCard><SectionCard title="Load and CPU Cores" icon={Cpu} loading={loading}>
        <div className="flex h-full flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {[["1 min", "0.84"], ["5 min", "0.76"], ["15 min", "0.69"]].map(([label, value]) => <div key={label} className="rounded-md bg-muted/60 p-3 text-center"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-[1rem] font-semibold text-foreground">{value}</div></div>)}
          </div>
          <div className="grid grid-cols-2 gap-3 text-[0.8125rem]"><div><div className="mb-2 flex justify-between"><span className="text-muted-foreground">Swap usage</span><span className="font-medium text-foreground">12%</span></div><ProgressBar value={12} /></div><div className="flex items-center justify-between"><span className="text-muted-foreground">CPU temperature</span><strong className="font-semibold text-foreground">54°C</strong></div></div>
          <div className="mt-auto">
            <div className="mb-2 text-[0.8125rem] font-medium text-foreground">Per-core utilization</div>
            <div className="grid grid-cols-4 gap-2" aria-label="CPU core utilization heatmap">
              {coreUsage.map((value, index) => <div key={index} title={`Core ${index} - ${value}%`} className="grid h-12 place-items-center rounded-md text-xs font-semibold text-slate-900" style={{ backgroundColor: `rgba(34, 185, 129, ${0.15 + value / 125})` }}>Core {index}<br />{value}%</div>)}
            </div>
          </div>
        </div>
      </SectionCard></SpanCard>
    </DashboardRow>

    <DashboardRow>
      <SpanCard><SectionCard title="Services" icon={Server} loading={loading}>
        <div className="divide-y divide-border">
          {services.map((service) => <div key={service.name} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="min-w-20 flex-1 text-[0.8125rem] font-semibold text-foreground">{service.name}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${service.status === "Running" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>{service.status}</span>
            <span className="text-[0.8125rem] text-muted-foreground">{service.uptime}</span>
            <span className="w-20 text-right text-[0.8125rem] text-muted-foreground">{service.memory}</span>
            <button type="button" title={`Restart ${service.name}`} aria-label={`Restart ${service.name}`} onClick={() => setServiceToRestart(service.name)} className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><RotateCw size={16} /></button>
          </div>)}
        </div>
      </SectionCard></SpanCard>

      <SpanCard><SectionCard title="Security and Compliance" icon={ShieldCheck} loading={loading} action={<span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Score 94</span>}>
        <div className="flex h-full flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-[0.8125rem]"><div className="rounded-md bg-muted/60 p-3"><div className="text-muted-foreground">Pending updates</div><strong className="mt-1 block text-[1rem] text-foreground">3</strong></div><div className="rounded-md bg-muted/60 p-3"><div className="text-muted-foreground">Last patch</div><strong className="mt-1 block text-[0.8125rem] text-foreground">Nov 02, 2026</strong></div></div>
          <div><div className="mb-2 text-[0.8125rem] font-medium text-foreground">Open ports</div><div className="flex flex-wrap gap-2">{["22 SSH", "80 HTTP", "443 HTTPS"].map((port) => <span key={port} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{port}</span>)}</div></div>
          <div className="min-w-0"><div className="mb-2 text-[0.8125rem] font-medium text-foreground">Recent SSH logins</div><div className="overflow-x-auto max-[39.9375rem]:-mx-2 max-[39.9375rem]:px-2"><table className="server-details-table w-full border-collapse text-left"><colgroup><col className="w-[24%]" /><col className="w-[48%]" /><col className="w-[28%]" /></colgroup><thead><tr className="text-muted-foreground"><th>User</th><th>IP address</th><th className="text-right">Time</th></tr></thead><tbody>{[["deploy", "203.0.113.42", "14:26"], ["admin", "198.51.100.18", "13:10"], ["ops", "203.0.113.15", "11:42"]].map(([user, ip, time]) => <tr key={`${user}-${time}`}><td className="text-foreground">{user}</td><td className="tabular-nums text-muted-foreground">{ip}</td><td className="text-right tabular-nums text-muted-foreground">{time}</td></tr>)}</tbody></table></div></div>
          <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-[0.8125rem]"><span className="flex items-center gap-2 text-foreground"><StatusDot />Firewall active</span><span className="font-semibold text-emerald-600">No critical findings</span></div>
        </div>
      </SectionCard></SpanCard>

      <SpanCard><SectionCard title="Backups" icon={Database} loading={loading}>
        <div className="flex h-full flex-col gap-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="flex items-center gap-2 text-[0.8125rem] font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={16} />Last backup successful</div>
            <div className="mt-2 text-[0.8125rem] text-foreground">Today, 02:15 <span className="text-muted-foreground">· 18.4 GB</span></div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-[0.8125rem]"><div><dt className="text-muted-foreground">Next scheduled</dt><dd className="mt-1 font-medium text-foreground">Tomorrow, 02:00</dd></div><div><dt className="text-muted-foreground">Retention</dt><dd className="mt-1 font-medium text-foreground">30 daily copies</dd></div></dl>
          <button type="button" disabled={backupRunning} onClick={() => { setBackupRunning(true); onAction("Backup started"); window.setTimeout(() => setBackupRunning(false), 1800); }} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-[0.8125rem] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"><RotateCw size={16} className={backupRunning ? "animate-spin" : ""} />{backupRunning ? "Backup running..." : "Run backup now"}</button>
        </div>
      </SectionCard></SpanCard>
    </DashboardRow>

    <DashboardRow>
      <SpanCard wide><SectionCard title="Live Log Tail" icon={Terminal} loading={loading} action={<div className="flex items-center gap-2">
        <button type="button" onClick={() => setLogPaused((paused) => !paused)} title={logPaused ? "Resume log stream" : "Pause log stream"} aria-label={logPaused ? "Resume log stream" : "Pause log stream"} className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{logPaused ? <Play size={16} /> : <Pause size={16} />}</button>
        <button type="button" onClick={() => setLogs([])} title="Clear logs" aria-label="Clear logs" className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="text-xs">Clear</span></button>
        <button type="button" onClick={() => onTabChange("logs")} className="rounded text-[0.8125rem] font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open Logs</button>
      </div>}>
        <div className="flex h-full min-h-72 flex-col rounded-lg bg-[oklch(0.2169_0.0349_259.51)] p-4 font-mono text-xs text-slate-200">
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3 text-slate-400"><span>web-01 / var / log / syslog</span><span className="flex items-center gap-2">{logPaused ? <Pause size={13} /> : <span className="h-2 w-2 rounded-full bg-emerald-400" />}{logPaused ? "Paused" : "Live"}</span></div>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto" aria-live="polite" aria-label="Live server log">
            {logs.length === 0 ? <EmptyState>Log buffer is empty.</EmptyState> : logs.map((log, index) => <div key={`${log.time}-${index}-${log.text}`} className="flex gap-3 opacity-100 transition-opacity duration-500">
              <span className="shrink-0 text-slate-500">{log.time}</span>
              <span className={`w-14 shrink-0 font-bold ${log.level === "ERROR" ? "text-red-400" : log.level === "WARN" ? "text-amber-300" : "text-sky-300"}`}>{log.level}</span>
              <span className="min-w-0 break-words">{log.text}</span>
            </div>)}
          </div>
        </div>
      </SectionCard></SpanCard>

      <SpanCard><SectionCard title="Specs and Related" icon={Info} loading={loading}>
        <div className="flex h-full flex-col">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
            {[["vCPU", "8 cores"], ["RAM", "32 GB"], ["Disk", "700 GB NVMe"], ["Kernel", "5.15.0-91"], ["Agent", "Nexus 2.8.4"], ["Owner", "Platform team"], ["On-call", "ops@nexus.io"]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 truncate font-medium text-foreground">{value}</dd></div>)}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">{["production", "web-tier", "critical"].map((tag) => <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{tag}</span>)}</div>
          <div className="mt-auto border-t border-border pt-3">
            <div className="mb-3 text-[0.8125rem] font-medium text-foreground">Dependencies</div>
            <div className="flex items-center justify-between gap-2">
              <div className="rounded-md border border-border px-2 py-2 text-center"><Network size={16} className="mx-auto mb-1 text-primary" /><span className="text-xs text-foreground">Load balancer</span></div>
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
              <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-center"><Server size={16} className="mx-auto mb-1 text-primary" /><span className="text-xs font-semibold text-foreground">web-01</span></div>
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
              <div className="rounded-md border border-border px-2 py-2 text-center"><Database size={16} className="mx-auto mb-1 text-primary" /><span className="text-xs text-foreground">Database</span></div>
            </div>
          </div>
        </div>
      </SectionCard></SpanCard>
    </DashboardRow>

    <Dialog open={serviceToRestart !== null} onOpenChange={(open) => { if (!open) setServiceToRestart(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restart {serviceToRestart ?? "service"}?</DialogTitle>
          <DialogDescription>This will restart the selected demo service on web-01. The service may be briefly unavailable.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button" onClick={() => setServiceToRestart(null)} className="rounded-md border border-border px-4 py-2 text-[0.8125rem] font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cancel</button>
          <button type="button" onClick={updateService} className="rounded-md bg-primary px-4 py-2 text-[0.8125rem] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Restart service</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

const metricCpu = [28, 31, 29, 34, 32, 36];
const metricMemory = [42, 44, 43, 45, 46, 44];
