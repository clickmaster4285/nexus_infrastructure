import type { MetricStat } from "./dashboard";
import { nocCollectors } from "./live-operations";
import { incidentStoreSnapshot } from "@/mocks/incidents";

const incidentsSnapshot = incidentStoreSnapshot();

export type HealthStatus = "healthy" | "warning" | "critical";
export const SLA_TARGET = 99;
export const statusForHealth = (value: number): HealthStatus => value >= SLA_TARGET ? "healthy" : value >= 98 ? "warning" : "critical";
export const statusColors: Record<HealthStatus, string> = { healthy: "#34D399", warning: "#FBBF24", critical: "#F87171" };

export const componentHealth = [
  { name: "Servers", value: 99.1, icon: "server", belowMinutes: 0, lastIncident: "No incidents in the last 24 hours" },
  { name: "Databases", value: 98.9, icon: "database", belowMinutes: 72, lastIncident: "Replication lag recovered at 11:30" },
  { name: "Network", value: 98.6, icon: "network", belowMinutes: 192, lastIncident: "Packet loss increased at 11:42" },
  { name: "Applications", value: 98.8, icon: "workflow", belowMinutes: 96, lastIncident: "Response time recovered at 10:34" },
  { name: "Services", value: 99.0, icon: "activity", belowMinutes: 0, lastIncident: "No incidents in the last 24 hours" },
  { name: "Storage", value: 99.2, icon: "storage", belowMinutes: 0, lastIncident: "No incidents in the last 24 hours" },
  { name: "Load Balancers", value: 99.3, icon: "network", belowMinutes: 0, lastIncident: "No incidents in the last 24 hours" },
  { name: "Security", value: 98.9, icon: "shield", belowMinutes: 84, lastIncident: "Patch compliance recovered at 09:14" },
  { name: "Backup", value: 98.3, icon: "hard-drive-download", belowMinutes: 268, lastIncident: "Backup job retried successfully at 06:45" },
];
export const healthScore = Number((componentHealth.reduce((sum, item) => sum + item.value, 0) / componentHealth.length).toFixed(1));

export const globalHealthStats: MetricStat[] = [
  { label: "Infrastructure Health", value: `${healthScore}%`, change: "0.2%", trend: "up", tone: "blue", icon: "pulse" },
  { label: "Monitoring Coverage", value: "99.1%", change: "0.1%", trend: "up", tone: "green", icon: "online" },
  { label: "Service Availability", value: "98.9%", change: "0.12%", trend: "up", tone: "green", icon: "shield" },
  { label: "Active Incidents", value: `${incidentsSnapshot.open}`, change: "1 new", trend: "up", tone: "red", icon: "flame" },
  { label: "Critical Alerts", value: "5", change: "2 new", trend: "up", tone: "red", icon: "bell" },
  { label: "Avg Response Time", value: "142 ms", change: "12%", trend: "down", tone: "blue", icon: "network" },
];

const times = Array.from({ length: 49 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const wobble = (i: number, base: number, amp: number, phase: number) => Number(Math.max(90, Math.min(100, base + Math.sin(i / 4 + phase) * amp + Math.sin(i / 9 + phase) * amp * .35)).toFixed(1));
export const componentHealthHistory = componentHealth.map((component, componentIndex) => {
  const values = times.map((_, index) => wobble(index, component.value, 0.22 + componentIndex * 0.035, componentIndex * 0.8));
  values[values.length - 1] = component.value;
  const average = Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
  return { name: component.name, values, min: Math.min(...values), avg: average, max: Math.max(...values), lastIncident: component.lastIncident };
});
export const globalHealthTrend = times.map((time, i) => ({
  time,
  infrastructureHealth: Number((componentHealthHistory.reduce((sum, series) => sum + series.values[i], 0) / componentHealthHistory.length).toFixed(1)),
  monitoringCoverage: wobble(i, 99.1, .35, 1.2),
  availability: wobble(i, 98.92, .62, 2.4),
})).map((point, index, points) => index === points.length - 1
  ? { ...point, infrastructureHealth: healthScore, monitoringCoverage: 99.1, availability: 98.9 }
  : point);

export type GlobalHealthTrendRange = "24H" | "7D" | "30D";
export type GlobalHealthTrendPoint = (typeof globalHealthTrend)[number];

const rangeHours: Record<GlobalHealthTrendRange, number> = { "24H": 24, "7D": 168, "30D": 720 };
export const globalHealthRangeIntervalMinutes: Record<GlobalHealthTrendRange, number> = { "24H": 30, "7D": 210, "30D": 900 };
const trendBases = { infrastructureHealth: healthScore, monitoringCoverage: 99.1, availability: 98.9 };

export const globalHealthTrendByRange: Record<GlobalHealthTrendRange, GlobalHealthTrendPoint[]> = {
  "24H": globalHealthTrend,
  "7D": globalHealthTrend.map((point, index) => {
    const time = new Date(Date.now() - rangeHours["7D"] * 60 * 60 * 1000 + index * (rangeHours["7D"] / (globalHealthTrend.length - 1)) * 60 * 60 * 1000)
      .toLocaleString("en-US", { weekday: "short", hour: "2-digit", hour12: false, timeZone: "UTC" });
    return { ...point, time };
  }),
  "30D": globalHealthTrend.map((point, index) => {
    const time = new Date(Date.now() - rangeHours["30D"] * 60 * 60 * 1000 + index * (rangeHours["30D"] / (globalHealthTrend.length - 1)) * 60 * 60 * 1000)
      .toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", hour12: false, timeZone: "UTC" });
    return { ...point, time };
  }),
};

Object.entries(globalHealthTrendByRange).forEach(([range, points]) => {
  const key = range as GlobalHealthTrendRange;
  const phase = key === "24H" ? 0 : key === "7D" ? 0.8 : 1.6;
  points.forEach((point, index) => {
    if (index === points.length - 1) {
      point.infrastructureHealth = healthScore;
      point.monitoringCoverage = 99.1;
      point.availability = 98.9;
      return;
    }
    point.infrastructureHealth = wobble(index, trendBases.infrastructureHealth, key === "30D" ? 0.42 : 0.28, phase);
    point.monitoringCoverage = wobble(index, trendBases.monitoringCoverage, key === "30D" ? 0.48 : 0.35, phase + 1.2);
    point.availability = wobble(index, trendBases.availability, key === "30D" ? 0.72 : 0.55, phase + 2.4);
  });
});

export const resourceHealth = [
  { label: "CPU", value: 92, kind: "Usage", detail: "12 / 37 cores", trend: "2% vs 1h", trendDirection: "up", icon: "cpu" },
  { label: "Memory", value: 78, kind: "Usage", detail: "11.0 / 16 GB", trend: "1% vs 1h", trendDirection: "up", icon: "memory" },
  { label: "Storage", value: 85, kind: "Usage", detail: "92.6 / 224 GB", trend: "0.4% vs 1h", trendDirection: "down", icon: "storage" },
  { label: "Network", value: 88, kind: "Utilization", detail: "142 Mbps in/out", trend: "3% vs 1h", trendDirection: "up", icon: "network" },
];

export const topHealthyServices = [
  { name: "Nginx Web Server", key: "nginx", percent: 100, period: "30d" },
  { name: "MySQL Database", key: "mysql", percent: 100, period: "30d" },
  { name: "Redis Cache", key: "redis", percent: 99.9, period: "30d" },
  { name: "Docker Engine", key: "docker", percent: 99.8, period: "30d" },
  { name: "API Service", key: "kong", percent: 99.7, period: "30d" },
  { name: "Prometheus", key: "prometheus", percent: 99.6, period: "30d" },
  { name: "PostgreSQL", key: "postgres", percent: 99.5, period: "30d" },
];
export const totalHealthyServices = 18;

export const environmentHealth = [
  { name: "Production", value: 99.1, servers: 42, alerts: 0, belowMinutes: 0 },
  { name: "Staging", value: 98.9, servers: 18, alerts: 1, belowMinutes: 72 },
  { name: "Development", value: 98.4, servers: 12, alerts: 3, belowMinutes: 192 },
  { name: "Testing", value: 98.7, servers: 9, alerts: 2, belowMinutes: 128 },
  { name: "UAT", value: 98.6, servers: 7, alerts: 2, belowMinutes: 156 },
  { name: "DR", value: 98.2, servers: 6, alerts: 4, belowMinutes: 246 },
];

export const environmentHealthHistory = environmentHealth.map((environment, environmentIndex) => {
  const values = times.map((_, index) => wobble(index, environment.value, 0.2 + environmentIndex * 0.025, environmentIndex * 0.67));
  values[values.length - 1] = environment.value;
  return { name: environment.name, values };
});

export const globalCollectors = nocCollectors.map((collector) => ({
  name: collector.name,
  key: collector.name.toLowerCase(),
  version: collector.version,
  targetsUp: collector.targetsUp,
  targetsTotal: collector.targetsTotal,
  lastSeen: collector.heartbeat,
  ingestionPerSecond: collector.ingestionPerSecond,
  scrapeSeconds: collector.scrapeSeconds,
  spark: collector.spark,
  status: collector.status === "Online" ? "healthy" as const : collector.status === "Stale" ? "warning" as const : "critical" as const,
}));

const healthChangeSources = [
  ...componentHealthHistory.map((history) => ({ ...history, kind: "Component" as const })),
  ...environmentHealthHistory.map((history) => ({ ...history, kind: "Environment" as const })),
];
export const recentHealthChanges = healthChangeSources.flatMap((source) => source.values.flatMap((to, index) => {
  if (index === 0 || to === source.values[index - 1]) return [];
  const from = source.values[index - 1];
  const kind = to < from ? "drop" as const : "recovery" as const;
  return [{ time: times[index], name: source.name, sourceType: source.kind, from, to, delta: Number((to - from).toFixed(1)), kind }];
})).sort((a, b) => b.time.localeCompare(a.time)).slice(0, 8);
