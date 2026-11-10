export type GroupStatus = "Healthy" | "Degraded" | "Offline";
export type GroupEnvironment = "Production" | "Staging" | "Dev";

export interface ServerGroup {
  id: string;
  name: string;
  status: GroupStatus;
  servers: number;
  location: string;
  environment: GroupEnvironment;
  health: number;
  uptime: number;
  load: number;
  cpu: number;
  memory: number;
  disk: number;
  icon: "globe" | "database" | "cube" | "monitor" | "gear" | "layers" | "shield" | "cloud" | "server" | "cache" | "edge" | "internal" | "loadbalancer";
  trend: number[];
}

function spark(seed: number, base: number, variance: number): number[] {
  return Array.from({ length: 26 }, (_, index) => {
    const wave = Math.sin((index + seed) / 2.4) * variance * 0.55;
    const noise = (((index * 37 + seed * 53) % 19) / 19 - 0.5) * variance;
    return Math.max(0, Math.min(100, base + wave + noise));
  });
}

export const serverGroups: ServerGroup[] = [
  {
    id: "production-web", name: "Production Web", status: "Healthy", servers: 12,
    location: "AWS – Virginia", environment: "Production", health: 99.1, uptime: 99.8,
    load: 32, cpu: 32, memory: 28, disk: 36, icon: "globe",
    trend: spark(2, 97, 5),
  },
  {
    id: "database-cluster", name: "Database Cluster", status: "Healthy", servers: 8,
    location: "AWS – Ohio", environment: "Production", health: 98.7, uptime: 99.5,
    load: 61, cpu: 61, memory: 66, disk: 55, icon: "database",
    trend: spark(5, 95, 7),
  },
  {
    id: "api-services", name: "API Services", status: "Degraded", servers: 10,
    location: "DigitalOcean – NYC", environment: "Production", health: 93.2, uptime: 98.9,
    load: 78, cpu: 78, memory: 71, disk: 82, icon: "cube",
    trend: spark(8, 88, 14),
  },
  {
    id: "monitoring-stack", name: "Monitoring Stack", status: "Healthy", servers: 6,
    location: "Ubuntu – London", environment: "Production", health: 98.9, uptime: 99.6,
    load: 45, cpu: 45, memory: 52, disk: 38, icon: "monitor",
    trend: spark(11, 96, 6),
  },
  {
    id: "dev-environment", name: "Dev Environment", status: "Healthy", servers: 7,
    location: "Hetzner – Germany", environment: "Dev", health: 97.9, uptime: 99.2,
    load: 38, cpu: 38, memory: 42, disk: 33, icon: "gear",
    trend: spark(14, 94, 8),
  },
  {
    id: "staging-servers", name: "Staging Servers", status: "Healthy", servers: 5,
    location: "AWS – Frankfurt", environment: "Staging", health: 98.3, uptime: 99.4,
    load: 52, cpu: 52, memory: 48, disk: 57, icon: "layers",
    trend: spark(17, 95, 7),
  },
  {
    id: "security-services", name: "Security Services", status: "Offline", servers: 4,
    location: "Vultr – Tokyo", environment: "Production", health: 0, uptime: 96.2,
    load: 0, cpu: 0, memory: 0, disk: 0, icon: "shield",
    trend: spark(20, 0, 0),
  },
  {
    id: "backup-group", name: "Backup Group", status: "Healthy", servers: 6,
    location: "AWS – Ireland", environment: "Production", health: 99.5, uptime: 99.7,
    load: 41, cpu: 41, memory: 37, disk: 46, icon: "cloud",
    trend: spark(23, 98, 4),
  },
  {
    id: "cache-servers", name: "Cache Servers", status: "Healthy", servers: 2,
    location: "AWS – Oregon", environment: "Production", health: 99.4, uptime: 99.7,
    load: 34, cpu: 34, memory: 42, disk: 28, icon: "cache",
    trend: spark(26, 97, 4),
  },
  {
    id: "edge-locations", name: "Edge Locations", status: "Degraded", servers: 5,
    location: "Cloudflare – Multi-region", environment: "Production", health: 94.6, uptime: 98.8,
    load: 67, cpu: 67, memory: 59, disk: 48, icon: "edge",
    trend: spark(29, 88, 12),
  },
  {
    id: "internal-services", name: "Internal Services", status: "Healthy", servers: 2,
    location: "Azure – East US", environment: "Production", health: 98.8, uptime: 99.5,
    load: 29, cpu: 29, memory: 36, disk: 31, icon: "internal",
    trend: spark(32, 96, 5),
  },
  {
    id: "load-balancers", name: "Load Balancers", status: "Healthy", servers: 3,
    location: "AWS – Singapore", environment: "Production", health: 99.7, uptime: 99.9,
    load: 43, cpu: 43, memory: 40, disk: 25, icon: "loadbalancer",
    trend: spark(35, 98, 3),
  },
];

export const groupHealthTrend = [
  { time: "00:00", healthy: 93, degraded: 32, offline: 8 },
  { time: "02:00", healthy: 94, degraded: 35, offline: 7 },
  { time: "04:00", healthy: 92, degraded: 38, offline: 9 },
  { time: "06:00", healthy: 95, degraded: 34, offline: 8 },
  { time: "08:00", healthy: 96, degraded: 41, offline: 10 },
  { time: "10:00", healthy: 95, degraded: 39, offline: 9 },
  { time: "12:00", healthy: 94, degraded: 44, offline: 8 },
  { time: "14:00", healthy: 96, degraded: 42, offline: 9 },
  { time: "16:00", healthy: 97, degraded: 40, offline: 8 },
  { time: "18:00", healthy: 96, degraded: 45, offline: 9 },
  { time: "20:00", healthy: 97, degraded: 43, offline: 10 },
  { time: "22:00", healthy: 98, degraded: 41, offline: 8 },
  { time: "24:00", healthy: 97, degraded: 44, offline: 9 },
];

export type PerformanceMetric = "CPU Usage" | "Memory Usage" | "Disk Usage" | "Network Usage";

export const groupPerformance: Record<PerformanceMetric, { time: string; production: number; database: number; api: number }[]> = {
  "CPU Usage": [
    { time: "00:00", production: 62, database: 71, api: 48 },
    { time: "02:00", production: 65, database: 74, api: 52 },
    { time: "04:00", production: 61, database: 69, api: 45 },
    { time: "06:00", production: 70, database: 78, api: 55 },
    { time: "08:00", production: 74, database: 82, api: 61 },
    { time: "10:00", production: 68, database: 76, api: 58 },
    { time: "12:00", production: 72, database: 81, api: 63 },
    { time: "14:00", production: 66, database: 73, api: 54 },
    { time: "16:00", production: 70, database: 77, api: 59 },
    { time: "18:00", production: 75, database: 84, api: 66 },
    { time: "20:00", production: 71, database: 79, api: 60 },
    { time: "22:00", production: 77, database: 86, api: 64 },
    { time: "24:00", production: 73, database: 80, api: 62 },
  ],
  "Memory Usage": [
    { time: "00:00", production: 54, database: 68, api: 57 },
    { time: "02:00", production: 57, database: 71, api: 60 },
    { time: "04:00", production: 53, database: 66, api: 55 },
    { time: "06:00", production: 60, database: 74, api: 62 },
    { time: "08:00", production: 63, database: 78, api: 66 },
    { time: "10:00", production: 58, database: 72, api: 61 },
    { time: "12:00", production: 62, database: 76, api: 65 },
    { time: "14:00", production: 57, database: 70, api: 59 },
    { time: "16:00", production: 60, database: 74, api: 62 },
    { time: "18:00", production: 64, database: 80, api: 68 },
    { time: "20:00", production: 61, database: 75, api: 63 },
    { time: "22:00", production: 65, database: 82, api: 67 },
    { time: "24:00", production: 62, database: 77, api: 64 },
  ],
  "Disk Usage": [
    { time: "00:00", production: 41, database: 62, api: 47 },
    { time: "02:00", production: 42, database: 64, api: 49 },
    { time: "04:00", production: 40, database: 61, api: 46 },
    { time: "06:00", production: 43, database: 66, api: 51 },
    { time: "08:00", production: 45, database: 69, api: 54 },
    { time: "10:00", production: 42, database: 65, api: 50 },
    { time: "12:00", production: 44, database: 68, api: 53 },
    { time: "14:00", production: 41, database: 63, api: 48 },
    { time: "16:00", production: 43, database: 67, api: 52 },
    { time: "18:00", production: 46, database: 71, api: 56 },
    { time: "20:00", production: 44, database: 69, api: 54 },
    { time: "22:00", production: 47, database: 73, api: 58 },
    { time: "24:00", production: 45, database: 70, api: 55 },
  ],
  "Network Usage": [
    { time: "00:00", production: 48, database: 55, api: 71 },
    { time: "02:00", production: 52, database: 58, api: 76 },
    { time: "04:00", production: 46, database: 52, api: 68 },
    { time: "06:00", production: 57, database: 63, api: 81 },
    { time: "08:00", production: 62, database: 69, api: 88 },
    { time: "10:00", production: 54, database: 60, api: 79 },
    { time: "12:00", production: 59, database: 66, api: 84 },
    { time: "14:00", production: 51, database: 57, api: 74 },
    { time: "16:00", production: 56, database: 62, api: 80 },
    { time: "18:00", production: 64, database: 71, api: 91 },
    { time: "20:00", production: 58, database: 65, api: 85 },
    { time: "22:00", production: 66, database: 74, api: 94 },
    { time: "24:00", production: 61, database: 68, api: 88 },
  ],
};

export interface GroupEvent {
  time: string;
  group: string;
  event: string;
  status: "Open" | "Resolved" | "Info" | "Success" | "Warning" | "Critical";
}

export const groupEvents: GroupEvent[] = [
  { time: "Apr 24, 08:15", group: "Production Web", event: "Health check passed", status: "Success" },
  { time: "Apr 24, 07:42", group: "Cache Servers", event: "Cache nodes synchronized", status: "Info" },
  { time: "Apr 24, 06:55", group: "Edge Locations", event: "Elevated latency detected", status: "Warning" },
  { time: "Apr 23, 22:10", group: "API Services", event: "High CPU usage", status: "Open" },
  { time: "Apr 23, 20:45", group: "Security Services", event: "Service recovered", status: "Resolved" },
  { time: "Apr 23, 18:30", group: "Dev Environment", event: "New server added", status: "Info" },
  { time: "Apr 23, 16:20", group: "Database Cluster", event: "Backup completed", status: "Success" },
  { time: "Apr 23, 14:15", group: "Monitoring Stack", event: "Memory threshold", status: "Warning" },
  { time: "Apr 23, 12:42", group: "Production Web", event: "Deployment completed", status: "Success" },
  { time: "Apr 23, 11:18", group: "API Services", event: "Request latency increased", status: "Warning" },
  { time: "Apr 23, 10:05", group: "Security Services", event: "Endpoint unreachable", status: "Critical" },
  { time: "Apr 23, 09:30", group: "Staging Servers", event: "Health check passed", status: "Info" },
  { time: "Apr 23, 08:12", group: "Backup Group", event: "Snapshot stored", status: "Success" },
  { time: "Apr 23, 07:26", group: "Edge Locations", event: "Packet loss detected", status: "Open" },
  { time: "Apr 23, 06:44", group: "Cache Servers", event: "Cache refresh completed", status: "Resolved" },
  { time: "Apr 23, 05:33", group: "Internal Services", event: "Service check completed", status: "Info" },
  { time: "Apr 23, 04:21", group: "Load Balancers", event: "Traffic redistributed", status: "Success" },
  { time: "Apr 23, 03:14", group: "Dev Environment", event: "Disk threshold reached", status: "Warning" },
  { time: "Apr 23, 02:08", group: "Database Cluster", event: "Replica synchronization delayed", status: "Open" },
  { time: "Apr 23, 01:16", group: "Monitoring Stack", event: "Metrics collection restored", status: "Resolved" },
  { time: "Apr 22, 23:48", group: "Production Web", event: "TLS certificate verified", status: "Info" },
  { time: "Apr 22, 22:30", group: "API Services", event: "Rate limit threshold reached", status: "Warning" },
];
