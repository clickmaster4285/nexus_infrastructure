import type { MetricStat } from "./dashboard";
import type { DonutDatum } from "./dashboard";
import { servers } from "./servers";
import { incidentStoreSnapshot } from "@/mocks/incidents";

const incidentsSnapshot = incidentStoreSnapshot();

/** One mock fleet source drives the NOC KPI cards, health donut and map legend. */
export const nocFleet = {
  total: 12,
  healthy: 10,
  degraded: 1,
  offline: 1,
  criticalAlerts: 5,
  activeIncidents: incidentsSnapshot.open,
};

export const nocStats: MetricStat[] = [
  { label: "Total Servers", value: `${nocFleet.total}`, change: "2 new", trend: "up", tone: "blue", icon: "server" },
  { label: "Healthy", value: `${nocFleet.healthy}`, change: `${Math.round((nocFleet.healthy / nocFleet.total) * 100)}% of total`, trend: "flat", tone: "green", icon: "online" },
  { label: "Degraded", value: `${nocFleet.degraded}`, change: `${Math.round((nocFleet.degraded / nocFleet.total) * 100)}% of total`, trend: "flat", tone: "amber", icon: "warning" },
  { label: "Offline", value: `${nocFleet.offline}`, change: `${Math.round((nocFleet.offline / nocFleet.total) * 100)}% of total`, trend: "flat", tone: "red", icon: "offline" },
  { label: "Critical Alerts", value: `${nocFleet.criticalAlerts}`, change: "2 new", trend: "up", tone: "red", icon: "bell" },
  { label: "Active Incidents", value: `${nocFleet.activeIncidents}`, change: "1 new", trend: "up", tone: "red", icon: "flame" },
];

export const nocHealth = {
  ...nocFleet,
  score: Math.round(((nocFleet.healthy + nocFleet.degraded * 0.5) / nocFleet.total) * 100),
};

export const nocHealthSegments = [
  { name: "Healthy", status: "Healthy", value: nocFleet.healthy, color: "oklch(0.7729 0.1535 163.22)", servers: ["prod-api-01", "db-primary", "web-frontend-01", "cache-server-01", "app-worker-02", "local-office-01", "win-app-01", "monitor-node-01", "api-staging-01", "test-runner-01"] },
  { name: "Degraded", status: "Degraded", value: nocFleet.degraded, color: "oklch(0.8369 0.1644 84.43)", servers: ["app-worker-01"] },
  { name: "Offline", status: "Offline", value: nocFleet.offline, color: "oklch(0.7106 0.1661 22.22)", servers: ["prod-api-02"] },
];

export type NocHealthChangeStatus = "offline" | "degraded" | "recovered";
export interface NocHealthTrendPoint {
  time: string;
  health: number;
  healthy: number;
  degraded: number;
  offline: number;
  eventLabel?: string;
  eventTone?: "amber" | "red";
}

export type NocResourceTab = "cpu" | "memory" | "network" | "disk";
export type NocResourceRange = "5m" | "15m" | "1h";
export interface ResourceUsagePoint { time: string; value: number; load: number }

const NOC_POINTS = 91;
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const minuteLabel = (index: number) => {
  const total = 13 * 60 + index;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const nocTimes = Array.from({ length: NOC_POINTS }, (_, index) => minuteLabel(index));
function denseWalk(seed: number, base: number, drift: number, variance: number, spikeAt: number, spikeWidth: number, spikeAmount: number): number[] {
  const rand = mulberry32(seed);
  const values: number[] = [];
  let current = base;
  for (let i = 0; i < NOC_POINTS; i += 1) {
    const driftTarget = base + Math.sin(i / 9 + drift) * 6 + Math.sin(i / 4.6 + drift * 2.3) * 4;
    current += (driftTarget - current) * 0.16 + (rand() - 0.5) * variance;
    const spike = spikeAmount * Math.exp(-((i - spikeAt) ** 2) / (2 * spikeWidth * spikeWidth));
    values.push(Math.round(Math.min(96, Math.max(8, current + spike)) * 10) / 10);
  }
  return values;
}
const nocSeries: Record<NocResourceTab, { value: number[]; load: number[] }> = {
  cpu: { value: denseWalk(11, 62, 0.4, 5.2, 61, 6.5, 15), load: denseWalk(29, 52, 1.9, 4.6, 63, 7.5, 10) },
  memory: { value: denseWalk(47, 50, 2.1, 3.4, 70, 8.5, 9), load: denseWalk(83, 46, 3.0, 3.0, 72, 8, 7) },
  network: { value: denseWalk(97, 33, 0.9, 4.8, 77, 5.5, 17), load: denseWalk(131, 28, 1.5, 3.8, 78, 6, 12) },
  disk: { value: denseWalk(163, 44, 0.2, 1.6, 82, 12, 3), load: denseWalk(199, 40, 0.6, 1.4, 82, 12, 2) },
};
export const nocResourceUsage: Record<NocResourceTab, ResourceUsagePoint[]> = {
  cpu: nocTimes.map((time, index) => ({ time, value: nocSeries.cpu.value[index], load: nocSeries.cpu.load[index] })),
  memory: nocTimes.map((time, index) => ({ time, value: nocSeries.memory.value[index], load: nocSeries.memory.load[index] })),
  network: nocTimes.map((time, index) => ({ time, value: nocSeries.network.value[index], load: nocSeries.network.load[index] })),
  disk: nocTimes.map((time, index) => ({ time, value: nocSeries.disk.value[index], load: nocSeries.disk.load[index] })),
};

export type MarkerStatus = "healthy" | "warning" | "critical";
export interface NocMarker { name: string; lat: number; lng: number; status: MarkerStatus; role: string; servers: number; health: number }
export const nocMarkers: NocMarker[] = [
  { name: "FRA — prod-api-01", lat: 50.11, lng: 8.68, status: "healthy", role: "API gateway", servers: 2, health: 99.8 },
  { name: "HEL — db-primary", lat: 60.17, lng: 24.94, status: "healthy", role: "Primary database", servers: 1, health: 99.6 },
  { name: "LHR — web-frontend-01", lat: 51.5, lng: -0.12, status: "healthy", role: "Web frontend", servers: 2, health: 99.9 },
  { name: "IAD — cache-server-01", lat: 39.04, lng: -77.49, status: "healthy", role: "Cache (Redis)", servers: 1, health: 99.8 },
  { name: "PDX — app-worker-02", lat: 45.52, lng: -122.68, status: "healthy", role: "Queue worker", servers: 1, health: 99.7 },
  { name: "GRU — local-office-01", lat: -23.55, lng: -46.63, status: "healthy", role: "Office services", servers: 1, health: 99.7 },
  { name: "ISB — win-app-01", lat: 33.69, lng: 73.06, status: "healthy", role: "Windows app server", servers: 1, health: 99.9 },
  { name: "DXB — monitor-node-01", lat: 25.2, lng: 55.27, status: "healthy", role: "Monitoring agent", servers: 1, health: 99.8 },
  { name: "SIN — api-staging-01", lat: 1.35, lng: 103.82, status: "healthy", role: "Staging API", servers: 1, health: 99.6 },
  { name: "BOM — test-runner-01", lat: 19.07, lng: 72.87, status: "healthy", role: "CI runners", servers: 1, health: 99.7 },
  { name: "CPT — legacy-db-01", lat: -33.92, lng: 18.42, status: "warning", role: "Legacy database", servers: 1, health: 98.7 },
  { name: "ARN — prod-api-02", lat: 59.33, lng: 18.06, status: "critical", role: "API failover", servers: 1, health: 96.4 },
];
export const nocMapCounts = nocMarkers.reduce<Record<MarkerStatus, number>>((counts, marker) => {
  counts[marker.status] += 1;
  return counts;
}, { healthy: 0, warning: 0, critical: 0 });

export type AlertSeverity = "critical" | "high" | "medium";
export interface NocAlert { id: string; severity: AlertSeverity; time: string; ageMinutes: number; title: string; detail: string; groupId: string; healthChange?: NocHealthChangeStatus }
export const nocActiveAlerts: NocAlert[] = [
  { id: "a-1", severity: "high", time: "14:28", ageMinutes: 8, title: "Database server high load", detail: "prod-db-01", groupId: "production" },
  { id: "a-2", severity: "high", time: "14:25", ageMinutes: 11, title: "Disk space critically low", detail: "web-01", groupId: "production" },
  { id: "a-3", severity: "medium", time: "14:20", ageMinutes: 16, title: "API availability below SLA", detail: "api-gateway", groupId: "production" },
  { id: "a-4", severity: "high", time: "14:18", ageMinutes: 18, title: "Failover node is unreachable", detail: "prod-api-02", groupId: "production", healthChange: "offline" },
  { id: "a-5", severity: "critical", time: "14:15", ageMinutes: 21, title: "Database replication lag", detail: "legacy-db-01", groupId: "staging" },
  { id: "a-6", severity: "critical", time: "14:12", ageMinutes: 24, title: "Memory usage elevated", detail: "app-worker-01", groupId: "testing", healthChange: "degraded" },
];

export const nocServiceAvailability = [
  { name: "Web Servers", value: 99.8 }, { name: "APIs", value: 99.7 }, { name: "Databases", value: 99.9 },
  { name: "Services", value: 99.6 }, { name: "CDN", value: 99.8 }, { name: "Cache", value: 99.5 },
  { name: "Load Balancers", value: 99.9 }, { name: "Payment Gateway", value: 99.7 },
  { name: "Message Queue", value: 99.6 }, { name: "Search", value: 99.7 }, { name: "Email Service", value: 99.8 },
];
export const nocServiceAvailabilitySla = 99.5;
export const nocOverallAvailability = Number((nocServiceAvailability.reduce((sum, item) => sum + item.value, 0) / nocServiceAvailability.length).toFixed(1));
export type NocHealthRange = "24h" | "7d" | "30d";
const healthTrendPoint = (time: string, healthy: number, degraded: number, offline: number, eventLabel?: string, eventTone?: "amber" | "red"): NocHealthTrendPoint => ({
  time,
  health: Math.round(((healthy + degraded * 0.5) / (healthy + degraded + offline)) * 100),
  healthy,
  degraded,
  offline,
  ...(eventLabel ? { eventLabel, eventTone } : {}),
});
const currentHealthTrendPoint = healthTrendPoint("Now", nocFleet.healthy, nocFleet.degraded, nocFleet.offline);
export const nocHealthTrendData: Record<NocHealthRange, NocHealthTrendPoint[]> = {
  "24h": [
    healthTrendPoint("00:00", 12, 0, 0),
    healthTrendPoint("06:00", 11, 1, 0),
    healthTrendPoint("11:42", 10, 1, 1, "11:42 prod-api-02 offline", "red"),
    healthTrendPoint("18:00", 10, 2, 0),
    currentHealthTrendPoint,
  ],
  "7d": [
    healthTrendPoint("Mon", 12, 0, 0),
    healthTrendPoint("Tue", 11, 1, 0),
    healthTrendPoint("Wed", 10, 2, 0, "Wed · app-worker-01 degraded", "amber"),
    healthTrendPoint("Fri", 9, 2, 1),
    currentHealthTrendPoint,
  ],
  "30d": [
    healthTrendPoint("Feb 01", 11, 1, 0),
    healthTrendPoint("Feb 08", 10, 2, 0),
    healthTrendPoint("Feb 15", 9, 2, 1, "Feb 15 prod-api-02 offline", "red"),
    healthTrendPoint("Feb 22", 10, 2, 0),
    currentHealthTrendPoint,
  ],
};
export const nocHealthRangeData: Record<NocHealthRange, {
  averageUptime: number;
  uptimeTrend: number;
  trend: number;
  trendDirection: "up" | "down";
  comparison: string;
  openIncidents: number;
  newIncidents: number;
  mttrMinutes: number;
}> = {
  "24h": { averageUptime: nocOverallAvailability, uptimeTrend: 0.1, trend: 2, trendDirection: "up", comparison: "vs yesterday", openIncidents: nocFleet.activeIncidents, newIncidents: 1, mttrMinutes: 18 },
  "7d": { averageUptime: 99.8, uptimeTrend: 0.2, trend: 1.4, trendDirection: "up", comparison: "vs prior week", openIncidents: 3, newIncidents: 2, mttrMinutes: 22 },
  "30d": { averageUptime: 99.9, uptimeTrend: 0.1, trend: 0.8, trendDirection: "down", comparison: "vs prior month", openIncidents: 4, newIncidents: 3, mttrMinutes: 24 },
};

export const nocServerGroupsSla = 99;
export const nocServerGroups: Array<DonutDatum & { id: string; health: number; avgCpu: number; avgMemory: number; lastIncident: string }> = [
  { id: "production", name: "Production", value: 7, color: "oklch(0.7137 0.1434 254.62)", health: 99.4, avgCpu: 72.4, avgMemory: 68.2, lastIncident: "8m ago" },
  { id: "staging", name: "Staging", value: 2, color: "oklch(0.709 0.1592 293.54)", health: 98.8, avgCpu: 54.8, avgMemory: 61.2, lastIncident: "No recent incidents" },
  { id: "development", name: "Development", value: 2, color: "oklch(0.7845 0.1325 181.91)", health: 98.1, avgCpu: 42.6, avgMemory: 58.9, lastIncident: "21m ago" },
  { id: "testing", name: "Testing", value: 1, color: "oklch(0.7107 0.0351 256.79)", health: 97.6, avgCpu: 87.1, avgMemory: 79.4, lastIncident: "24m ago" },
];
export type TopIssueTab = "cpu" | "memory" | "disk" | "network";
export interface TopIssue { name: string; percent: number; duration: string }
function topIssuesFor(metric: TopIssueTab): TopIssue[] {
  return [...servers]
    .map((server) => ({
      server,
      percent: metric === "network" ? Number.parseFloat(server.network) || 0 : server[metric],
    }))
    .sort((left, right) => right.percent - left.percent)
    .slice(0, 6)
    .map(({ server, percent }) => ({
      name: server.name,
      percent: Math.round(percent * 10) / 10,
      duration: server.heartbeat === "Not enrolled" ? "agent not enrolled" : `last sample ${server.heartbeat}`,
    }));
}
const issueRows = {
  cpu: topIssuesFor("cpu"),
  memory: topIssuesFor("memory"),
  disk: topIssuesFor("disk"),
  network: topIssuesFor("network"),
} satisfies Record<TopIssueTab, TopIssue[]>;
export const nocTopIssues = issueRows;

export type EventTone = "green" | "amber" | "blue" | "red";
export interface NocEvent { title: string; detail: string; time: string; tone: EventTone; icon: "server" | "flame" | "database" | "online" | "workflow" | "offline"; ageMinutes?: number; healthChange?: NocHealthChangeStatus }
export const nocRecentEvents: NocEvent[] = [
  { title: "Server recovered", detail: "web-01", time: "2m ago", tone: "green", icon: "online", ageMinutes: 2, healthChange: "recovered" },
  { title: "Critical database load", detail: "prod-db-01", time: "3m ago", tone: "red", icon: "offline" },
  { title: "High CPU usage", detail: "app-worker-02", time: "5m ago", tone: "amber", icon: "flame" },
  { title: "New backup completed", detail: "db-01", time: "8m ago", tone: "blue", icon: "database" },
  { title: "Agent connected", detail: "internal-api", time: "12m ago", tone: "green", icon: "online" },
  { title: "Configuration changed", detail: "alert rule", time: "16m ago", tone: "blue", icon: "workflow" },
  { title: "Node heartbeat missed", detail: "prod-api-02", time: "20m ago", tone: "red", icon: "server" },
];

export type FeedTone = "green" | "blue" | "amber" | "red";
export interface OperationsFeedItem { time: string; relativeTime: string; message: string; source: string; severity: "critical" | "warning" | "info" | "success"; tone: FeedTone; icon: "online" | "shield" | "warning" | "flame" | "database" | "server" }
export const nocOperationsFeed: OperationsFeedItem[] = [
  { time: "14:32", relativeTime: "2m ago", message: "Server heartbeat received", source: "app-worker-01", severity: "success", tone: "green", icon: "online" },
  { time: "14:31", relativeTime: "3m ago", message: "Alert resolved: High memory usage", source: "web-01", severity: "success", tone: "green", icon: "shield" },
  { time: "14:30", relativeTime: "4m ago", message: "Incident updated: Database latency investigation", source: "prod-db-01", severity: "info", tone: "blue", icon: "warning" },
  { time: "14:29", relativeTime: "5m ago", message: "Critical CPU usage", source: "app-worker-02", severity: "critical", tone: "red", icon: "flame" },
  { time: "14:28", relativeTime: "6m ago", message: "Backup job started", source: "db-01", severity: "info", tone: "blue", icon: "database" },
  { time: "14:26", relativeTime: "8m ago", message: "Deploy completed: v2.4.0", source: "api-gateway", severity: "success", tone: "green", icon: "online" },
  { time: "14:25", relativeTime: "9m ago", message: "Disk usage crossed 80%", source: "web-01", severity: "warning", tone: "amber", icon: "warning" },
  { time: "14:22", relativeTime: "12m ago", message: "Agent enrolled", source: "monitor-node-01", severity: "info", tone: "blue", icon: "server" },
  { time: "14:21", relativeTime: "13m ago", message: "Server added", source: "web-frontend-01", severity: "info", tone: "blue", icon: "server" },
  { time: "14:18", relativeTime: "16m ago", message: "TLS certificate renewed", source: "api.example.com", severity: "success", tone: "green", icon: "shield" },
];

export interface NocCollector { name: string; status: "Online" | "Stale" | "Offline"; heartbeat: string; ingestionPerSecond: number; scrapeSeconds: number; spark: number[]; version: string; targetsUp: number; targetsTotal: number }
export const nocCollectors: NocCollector[] = [
  { name: "Prometheus", status: "Online", heartbeat: "12s ago", ingestionPerSecond: 1200, scrapeSeconds: 0.8, spark: [12, 14, 13, 16, 15, 17, 19, 18, 16, 20, 22, 21], version: "2.51.0", targetsUp: 42, targetsTotal: 42 },
  { name: "Node Exporter", status: "Online", heartbeat: "18s ago", ingestionPerSecond: 600, scrapeSeconds: 1, spark: [10, 10, 11, 12, 11, 13, 12, 14, 13, 15, 14, 16], version: "1.7.0", targetsUp: 38, targetsTotal: 38 },
  { name: "Windows Exporter", status: "Stale", heartbeat: "2m ago", ingestionPerSecond: 450, scrapeSeconds: 2.4, spark: [8, 9, 8, 10, 9, 11, 10, 12, 11, 12, 13, 12], version: "0.25.1", targetsUp: 16, targetsTotal: 17 },
  { name: "Blackbox Exporter", status: "Online", heartbeat: "22s ago", ingestionPerSecond: 350, scrapeSeconds: 1.1, spark: [6, 6, 7, 7, 8, 8, 9, 9, 10, 9, 11, 10], version: "0.24.0", targetsUp: 24, targetsTotal: 24 },
  { name: "Loki", status: "Online", heartbeat: "8s ago", ingestionPerSecond: 500, scrapeSeconds: 1, spark: [9, 10, 11, 10, 12, 13, 12, 14, 15, 14, 16, 17], version: "3.0.0", targetsUp: 18, targetsTotal: 18 },
  { name: "Grafana Agent", status: "Online", heartbeat: "11s ago", ingestionPerSecond: 300, scrapeSeconds: 0.9, spark: [7, 8, 8, 9, 10, 9, 11, 12, 11, 12, 13, 14], version: "0.40.4", targetsUp: 16, targetsTotal: 16 },
];

export const formatNocIngestionRate = (rate: number) => rate >= 1000
  ? `${Number((rate / 1000).toFixed(1))}k/s`
  : `${rate}/s`;
export const nocCollectorSummary = {
  total: nocCollectors.length,
  healthy: nocCollectors.filter((collector) => collector.status === "Online").length,
  stale: nocCollectors.filter((collector) => collector.status === "Stale").length,
  offline: nocCollectors.filter((collector) => collector.status === "Offline").length,
  targetsUp: nocCollectors.reduce((total, collector) => total + collector.targetsUp, 0),
  targetsTotal: nocCollectors.reduce((total, collector) => total + collector.targetsTotal, 0),
  ingestionPerSecond: nocCollectors.reduce((total, collector) => total + collector.ingestionPerSecond, 0),
  averageScrapeSeconds: nocCollectors.reduce((total, collector) => total + collector.scrapeSeconds, 0) / nocCollectors.length,
};

export const nocFeedBufferedCount = 3;
export const nocAlertMetrics = { mttaMinutes: 6, acknowledgedBy: "Ayesha Khan", acknowledgedAgo: "2m ago" };

export const nocOnCall = {
  primary: { name: "Ayesha Khan", role: "Primary · SRE", since: "09:00 PKT" },
  nextShift: "16:00 PKT · Omar Farooq",
  escalations: [{ level: "L1", name: "Omar Farooq", role: "Platform engineer" }, { level: "L2", name: "Sara Ahmed", role: "Infrastructure lead" }],
};
