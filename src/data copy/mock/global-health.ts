import type { DonutDatum, MetricStat } from "./dashboard";

export const globalHealthStats: MetricStat[] = [
  { label: "Infrastructure Health", value: "98.7%", change: "0.2%", trend: "up", tone: "blue", icon: "pulse" },
  { label: "Monitoring Coverage", value: "99.1%", change: "0.1%", trend: "up", tone: "green", icon: "online" },
  { label: "Service Availability", value: "99.82%", change: "0.12%", trend: "up", tone: "green", icon: "shield" },
  { label: "Active Incidents", value: "2", change: "1 new", trend: "up", tone: "red", icon: "flame" },
  { label: "Critical Alerts", value: "5", change: "2 new", trend: "up", tone: "red", icon: "bell" },
  { label: "Avg Response Time", value: "142 ms", change: "12%", trend: "down", tone: "blue", icon: "network" },
];

// Dense multi-series health trend, 15-minute steps 00:00 → 24:00.
// Seeded so server-side and client-side renders match exactly.
const GH_POINTS = 97;

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ghTimeLabel = (index: number) => {
  const total = index * 15;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const ghTimes = Array.from({ length: GH_POINTS }, (_, index) => ghTimeLabel(index));

function denseHealthSeries(seed: number, base: number, variance: number, dipAt: number, dipWidth: number, dipDepth: number): number[] {
  const rand = mulberry32(seed);
  const values: number[] = [];
  let current = base;
  for (let i = 0; i < GH_POINTS; i += 1) {
    current += (Math.sin(i / 8 + seed) * 0.35 + (rand() - 0.5) * variance);
    const dip = dipDepth * Math.exp(-((i - dipAt) ** 2) / (2 * dipWidth * dipWidth));
    values.push(Math.round(Math.min(100, Math.max(82, current - dip)) * 10) / 10);
  }
  return values;
}

const infrastructureHealthLine = denseHealthSeries(11, 98.7, 0.32, 64, 5.5, 8.4);
const monitoringCoverageLine = denseHealthSeries(29, 99.1, 0.14, 64, 6, 4.2);
const availabilityLine = denseHealthSeries(47, 98.9, 0.22, 63, 5, 10.2);

export interface HealthTrendPoint {
  time: string;
  infrastructureHealth: number;
  monitoringCoverage: number;
  availability: number;
}

export const globalHealthTrend: HealthTrendPoint[] = ghTimes.map((time, index) => ({
  time,
  infrastructureHealth: infrastructureHealthLine[index],
  monitoringCoverage: monitoringCoverageLine[index],
  availability: availabilityLine[index],
}));

export const healthScore = 98.7;

export const componentHealth: DonutDatum[] = [
  { name: "Servers", value: 99.1, color: "#288af0" },
  { name: "Databases", value: 98.9, color: "#a647e8" },
  { name: "Network", value: 98.6, color: "#fa9238" },
  { name: "Applications", value: 98.8, color: "#10b981" },
  { name: "Services", value: 99.0, color: "#22c55e" },
];

export const resourceHealth = [
  { label: "CPU", value: 92, color: "#288af0" },
  { label: "Memory", value: 78, color: "#22c55e" },
  { label: "Storage", value: 85, color: "#10b981" },
  { label: "Network", value: 88, color: "#38bdf8" },
];

export const topHealthyServices = [
  { name: "Nginx Web Server", percent: 100 },
  { name: "MySQL Database", percent: 100 },
  { name: "Redis Cache", percent: 99.9 },
  { name: "Docker Engine", percent: 99.8 },
  { name: "API Service", percent: 99.7 },
];

export const environmentHealth = [
  { name: "Production", value: 99.1, color: "#22c55e" },
  { name: "Staging", value: 98.9, color: "#3b82f6" },
  { name: "Development", value: 98.4, color: "#a647e8" },
  { name: "Testing", value: 98.7, color: "#f59e0b" },
];

export const globalCollectors = [
  "Prometheus",
  "Loki",
  "Blackbox Exporter",
  "Node Exporter",
  "Windows Exporter",
  "Custom Agent",
];

export type GlobalEventTone = "info" | "warning" | "critical";

export interface GlobalEvent {
  time: string;
  type: string;
  message: string;
  source: string;
  tone: GlobalEventTone;
}

export const recentGlobalEvents: GlobalEvent[] = [
  { time: "14:32", type: "Info", message: "Metrics collection completed", source: "All Servers", tone: "info" },
  { time: "14:28", type: "Warning", message: "High disk usage on db-01", source: "Production", tone: "warning" },
  { time: "14:25", type: "Info", message: "Backup job completed", source: "Backup", tone: "info" },
  { time: "14:20", type: "Critical", message: "Server unreachable: app-worker-01", source: "Production", tone: "critical" },
  { time: "14:18", type: "Info", message: "Incident resolved", source: "Operations", tone: "info" },
];

export const infrastructureStatus = [
  { label: "Servers", value: 100 },
  { label: "Databases", value: 98 },
  { label: "Network Devices", value: 99 },
  { label: "Containers", value: 97 },
  { label: "Web Services", value: 99 },
  { label: "APIs", value: 98 },
];

export const quickActions = [
  { title: "View All Servers", description: "Manage infrastructure", href: "/all-servers", tone: "blue", icon: "server" },
  { title: "Check Alerts", description: "Review active alerts", href: "/alerts", tone: "red", icon: "bell" },
  { title: "View Incidents", description: "Track incidents", href: "/incidents", tone: "amber", icon: "flame" },
  { title: "Explore Metrics", description: "Analyze performance", href: "/metrics-explorer", tone: "blue", icon: "chart-no-axes-combined" },
  { title: "View Logs", description: "Investigate issues", href: "/logs-explorer", tone: "purple", icon: "file-search" },
  { title: "Generate Report", description: "Export health report", href: "/uptime-and-sla-reports", tone: "blue", icon: "scroll-text" },
] as const;

export const markerCounts = { healthy: 9, warning: 3, critical: 2 };
