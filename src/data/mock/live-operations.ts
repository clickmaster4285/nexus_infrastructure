import type { MetricStat } from "./dashboard";
import type { DonutDatum } from "./dashboard";

export const nocStats: MetricStat[] = [
  { label: 'Total Servers', value: '12', change: '2 new', trend: 'up', tone: 'blue', icon: 'server' },
  { label: 'Healthy', value: '10', change: '83% of total', trend: 'flat', tone: 'green', icon: 'online' },
  { label: 'Degraded', value: '1', change: '8% of total', trend: 'flat', tone: 'amber', icon: 'warning' },
  { label: 'Offline', value: '1', change: '8% of total', trend: 'flat', tone: 'red', icon: 'offline' },
  { label: 'Critical Alerts', value: '5', change: '2 new', trend: 'up', tone: 'red', icon: 'bell' },
  { label: 'Active Incidents', value: '2', change: '1 new', trend: 'up', tone: 'red', icon: 'flame' },
];

export const nocHealth = {
  score: 83,
  healthy: 10,
  degraded: 1,
  offline: 1,
};

export const nocHealthSegments = [
  { name: 'Healthy', value: 10, color: '#22c55e' },
  { name: 'Degraded', value: 1, color: '#f59e0b' },
  { name: 'Offline', value: 1, color: '#ef4444' },
];

export type NocResourceTab = "cpu" | "memory" | "network" | "disk";

export interface ResourceUsagePoint { time: string; value: number; load: number }

// One point per minute from 13:00 to 14:30 — deterministic seeded noise so the
// server and client renders match exactly (no hydration drift).
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
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const nocTimes = Array.from({ length: NOC_POINTS }, (_, index) => minuteLabel(index));

/** Smooth deterministic random walk with a slow sine drift + one Gaussian spike. */
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
  cpu: {
    value: denseWalk(11, 62, 0.4, 5.2, 61, 6.5, 15),
    load: denseWalk(29, 52, 1.9, 4.6, 63, 7.5, 10),
  },
  memory: {
    value: denseWalk(47, 50, 2.1, 3.4, 70, 8.5, 9),
    load: denseWalk(83, 46, 3.0, 3.0, 72, 8, 7),
  },
  network: {
    value: denseWalk(97, 33, 0.9, 4.8, 77, 5.5, 17),
    load: denseWalk(131, 28, 1.5, 3.8, 78, 6, 12),
  },
  disk: {
    value: denseWalk(163, 44, 0.2, 1.6, 82, 12, 3),
    load: denseWalk(199, 40, 0.6, 1.4, 82, 12, 2),
  },
};

export const nocResourceUsage: Record<NocResourceTab, ResourceUsagePoint[]> = {
  cpu: nocTimes.map((time, index) => ({ time, value: nocSeries.cpu.value[index], load: nocSeries.cpu.load[index] })),
  memory: nocTimes.map((time, index) => ({ time, value: nocSeries.memory.value[index], load: nocSeries.memory.load[index] })),
  network: nocTimes.map((time, index) => ({ time, value: nocSeries.network.value[index], load: nocSeries.network.load[index] })),
  disk: nocTimes.map((time, index) => ({ time, value: nocSeries.disk.value[index], load: nocSeries.disk.load[index] })),
};

export type MarkerStatus = "healthy" | "warning" | "critical";

export interface NocMarker {
  name: string;
  lat: number;
  lng: number;
  status: MarkerStatus;
  role: string;
}

export const nocMarkers: NocMarker[] = [
  { name: 'FRA — prod-api-01', lat: 50.11, lng: 8.68, status: 'healthy', role: 'API gateway' },
  { name: 'HEL — db-primary', lat: 60.17, lng: 24.94, status: 'healthy', role: 'Primary database' },
  { name: 'LHR — web-frontend-01', lat: 51.5, lng: -0.12, status: 'healthy', role: 'Web frontend' },
  { name: 'IAD — cache-server-01', lat: 39.04, lng: -77.49, status: 'healthy', role: 'Cache (Redis)' },
  { name: 'PDX — app-worker-02', lat: 45.52, lng: -122.68, status: 'warning', role: 'Queue worker' },
  { name: 'GRU — local-office-01', lat: -23.55, lng: -46.63, status: 'warning', role: 'Office services' },
  { name: 'ISB — win-app-01', lat: 33.69, lng: 73.06, status: 'healthy', role: 'Windows app server' },
  { name: 'DXB — monitor-node-01', lat: 25.2, lng: 55.27, status: 'healthy', role: 'Monitoring agent' },
  { name: 'SIN — api-staging-01', lat: 1.35, lng: 103.82, status: 'healthy', role: 'Staging API' },
  { name: 'BOM — test-runner-01', lat: 19.07, lng: 72.87, status: 'warning', role: 'CI runners' },
  { name: 'NRT — backup-node-02', lat: 35.68, lng: 139.69, status: 'healthy', role: 'Backup node' },
  { name: 'SYD — dev-vps-01', lat: -33.87, lng: 151.21, status: 'healthy', role: 'Dev VPS' },
  { name: 'CPT — legacy-db-01', lat: -33.92, lng: 18.42, status: 'critical', role: 'Legacy database' },
  { name: 'ARN — prod-api-02', lat: 59.33, lng: 18.06, status: 'critical', role: 'API failover' },
];

export type AlertSeverity = "critical" | "high" | "medium";

export interface NocAlert {
  severity: AlertSeverity;
  time: string;
  title: string;
  detail: string;
}

export const nocActiveAlerts: NocAlert[] = [
  { severity: 'critical', time: '14:28', title: 'Database server high load', detail: 'prod-db-01' },
  { severity: 'high', time: '14:25', title: 'Disk space low', detail: 'web-01' },
  { severity: 'high', time: '14:20', title: 'API response time high', detail: 'api-gateway' },
  { severity: 'medium', time: '14:15', title: 'Memory usage elevated', detail: 'app-worker-01' },
];

export const nocServiceAvailability = [
  { name: 'Web Servers', value: 99.8 },
  { name: 'APIs', value: 99.7 },
  { name: 'Databases', value: 99.9 },
  { name: 'Services', value: 99.6 },
];

export const nocServerGroups: DonutDatum[] = [
  { name: 'Production', value: 7, color: '#288af0' },
  { name: 'Staging', value: 2, color: '#ef4444' },
  { name: 'Development', value: 2, color: '#f59e0b' },
  { name: 'Testing', value: 1, color: '#22c55e' },
];

export type TopIssueTab = "cpu" | "memory" | "disk" | "network";

export interface TopIssue {
  name: string;
  percent: number;
  tone: "red" | "amber" | "yellow";
}

export const nocTopIssues: Record<TopIssueTab, TopIssue[]> = {
  cpu: [
    { name: 'app-worker-02', percent: 92.4, tone: 'red' },
    { name: 'prod-db-01', percent: 88.7, tone: 'amber' },
    { name: 'web-01', percent: 76.3, tone: 'yellow' },
  ],
  memory: [
    { name: 'prod-db-01', percent: 91.2, tone: 'red' },
    { name: 'prod-api-01', percent: 78.4, tone: 'amber' },
    { name: 'app-worker-02', percent: 65.1, tone: 'yellow' },
  ],
  disk: [
    { name: 'prod-api-01', percent: 92.0, tone: 'red' },
    { name: 'web-01', percent: 76.3, tone: 'yellow' },
    { name: 'db-primary', percent: 55.4, tone: 'yellow' },
  ],
  network: [
    { name: 'web-frontend-01', percent: 15.2, tone: 'amber' },
    { name: 'prod-api-01', percent: 12.4, tone: 'yellow' },
    { name: 'db-primary', percent: 8.7, tone: 'yellow' },
  ],
};

export type EventTone = 'green' | 'amber' | 'blue';

export interface NocEvent {
  title: string;
  detail: string;
  time: string;
  tone: EventTone;
  icon: 'server' | 'flame' | 'database' | 'online' | 'workflow';
}

export const nocRecentEvents: NocEvent[] = [
  { title: 'Server recovered', detail: 'web-01', time: '2m ago', tone: 'green', icon: 'online' },
  { title: 'High CPU usage', detail: 'app-worker-02', time: '3m ago', tone: 'amber', icon: 'flame' },
  { title: 'New backup completed', detail: 'db-01', time: '5m ago', tone: 'blue', icon: 'database' },
  { title: 'Agent connected', detail: 'internal-api', time: '7m ago', tone: 'green', icon: 'online' },
  { title: 'Configuration changed', detail: 'alert rule', time: '10m ago', tone: 'blue', icon: 'workflow' },
];

export type FeedTone = 'green' | 'blue' | 'amber' | 'red';

export interface OperationsFeedItem {
  time: string;
  message: string;
  tone: FeedTone;
  icon: 'online' | 'shield' | 'warning' | 'flame' | 'database' | 'server';
}

export const nocOperationsFeed: OperationsFeedItem[] = [
  { time: '14:32', message: 'Server heartbeat received: app-worker-01', tone: 'green', icon: 'online' },
  { time: '14:31', message: 'Alert resolved: High memory usage on web-01', tone: 'green', icon: 'shield' },
  { time: '14:30', message: 'Incident updated: Database latency investigation', tone: 'blue', icon: 'warning' },
  { time: '14:29', message: 'High CPU usage on app-worker-02', tone: 'red', icon: 'flame' },
  { time: '14:28', message: 'Backup job started: db-01', tone: 'blue', icon: 'database' },
  { time: '14:26', message: 'Deploy completed: api-gateway v2.4.0', tone: 'green', icon: 'online' },
  { time: '14:25', message: 'Disk usage crossed 80% on web-01', tone: 'amber', icon: 'warning' },
  { time: '14:22', message: 'Agent enrolled: monitor-node-01', tone: 'blue', icon: 'server' },
  { time: '14:21', message: 'Server added: web-frontend-01', tone: 'blue', icon: 'server' },
  { time: '14:18', message: 'TLS certificate renewed: api.example.com', tone: 'green', icon: 'shield' },
];

export interface NocCollector {
  name: string;
  status: 'Online' | 'Offline';
  heartbeat: string;
  rate: string;
  spark: number[];
}

export const nocCollectors: NocCollector[] = [
  { name: 'Prometheus', status: 'Online', heartbeat: '14:32', rate: '1.2k/s', spark: [12, 14, 13, 16, 15, 17, 19, 18, 16, 20, 22, 21] },
  { name: 'Node Exporter', status: 'Online', heartbeat: '14:32', rate: '980/s', spark: [10, 10, 11, 12, 11, 13, 12, 14, 13, 15, 14, 16] },
  { name: 'Windows Exporter', status: 'Online', heartbeat: '14:31', rate: '720/s', spark: [8, 9, 8, 10, 9, 11, 10, 12, 11, 12, 13, 12] },
  { name: 'Blackbox Exporter', status: 'Online', heartbeat: '14:31', rate: '540/s', spark: [6, 6, 7, 7, 8, 8, 9, 9, 10, 9, 11, 10] },
];
