export interface Server {
  id: string;
  name: string;
  host: string;
  ip: string;
  publicIp: string;
  os: string;
  environment: string;
  provider: string;
  location: string;
  uptime: string;
  agent: string;
  heartbeat: string;
  cpu: number;
  memory: number;
  disk: number;
  network: string;
  health: string;
  alerts: number;
  tags: string[];
}

export function serverDetailsPath(server: Pick<Server, "name">): string {
  return `/server-details/${encodeURIComponent(server.name)}`;
}

export function findServerById(serverId: string): Server | undefined {
  let decodedId = serverId;
  try {
    decodedId = decodeURIComponent(serverId);
  } catch {
    return undefined;
  }
  return servers.find((server) => server.id === decodedId || server.name === decodedId);
}

export function serverGroupName(server: Pick<Server, "name">): string {
  if (server.name.startsWith("web-")) return "Web Servers";
  if (server.name.startsWith("db-")) return "Database Servers";
  if (/api|app|worker/.test(server.name)) return "Application Servers";
  return "Infrastructure";
}

export interface ServerStat {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "flat";
  tone: "blue" | "green" | "red" | "amber";
  icon: string;
}

export const serverStats: ServerStat[] = [
  { label: 'Total Servers', value: '12', change: '2 new', trend: 'up', tone: 'blue', icon: 'server' },
  { label: 'Online Servers', value: '10', change: '83% of total', trend: 'flat', tone: 'green', icon: 'online' },
  { label: 'Offline Servers', value: '1', change: '8% of total', trend: 'flat', tone: 'red', icon: 'offline' },
  { label: 'Degraded Servers', value: '1', change: '8% of total', trend: 'flat', tone: 'amber', icon: 'warning' },
  { label: 'Agent Healthy', value: '10 / 12', change: '83% healthy', trend: 'flat', tone: 'green', icon: 'shield' },
  { label: 'Pending Enrollment', value: '2', change: '17% pending', trend: 'flat', tone: 'blue', icon: 'pulse' },
];

export const servers: Server[] = [
  { id:'srv-01', name:'prod-api-01', host:'api-01.example.com', ip:'10.10.1.10', publicIp:'54.210.12.34', os:'Ubuntu 22.04 LTS', environment:'Production', provider:'AWS', location:'Frankfurt, Germany', uptime:'14d 6h', agent:'Online', heartbeat:'2 min ago', cpu:24, memory:48, disk:62, network:'12.4 Mbps', health:'Healthy', alerts:0, tags:['api','production','backend'] },
  { id:'srv-02', name:'db-primary', host:'db-01.example.com', ip:'10.10.2.20', publicIp:'54.210.12.35', os:'Ubuntu 22.04 LTS', environment:'Production', provider:'Hetzner', location:'Helsinki, Finland', uptime:'21d 3h', agent:'Online', heartbeat:'1 min ago', cpu:18, memory:42, disk:55, network:'8.7 Mbps', health:'Healthy', alerts:0, tags:['database','production','primary'] },
  { id:'srv-03', name:'web-frontend-01', host:'web-01.example.com', ip:'10.10.1.15', publicIp:'54.210.12.41', os:'Ubuntu 22.04 LTS', environment:'Production', provider:'DigitalOcean', location:'London, UK', uptime:'7d 12h', cpu:36, memory:68, disk:47, network:'15.2 Mbps', agent:'Online', heartbeat:'2 min ago', health:'Healthy', alerts:1, tags:['web','production','frontend'] },
  { id:'srv-04', name:'app-worker-02', host:'worker-02.example.com', ip:'10.10.3.30', publicIp:'54.210.12.50', os:'Ubuntu 22.04 LTS', environment:'Staging', provider:'AWS', location:'Frankfurt, Germany', uptime:'5d 8h', cpu:42, memory:71, disk:73, network:'9.6 Mbps', agent:'Online', heartbeat:'3 min ago', health:'Degraded', alerts:2, tags:['worker','staging','queue'] },
  { id:'srv-05', name:'dev-vps-01', host:'dev-01.example.com', ip:'10.10.4.10', publicIp:'54.210.12.61', os:'Debian 12', environment:'Development', provider:'Hetzner', location:'Helsinki, Finland', uptime:'3d 2h', cpu:28, memory:54, disk:41, network:'6.3 Mbps', agent:'Online', heartbeat:'4 min ago', health:'Healthy', alerts:0, tags:['development','test'] },
  { id:'srv-06', name:'win-app-01', host:'win-app-01.example.com', ip:'10.10.5.50', publicIp:'54.210.12.70', os:'Windows Server 2022', environment:'Production', provider:'On-prem', location:'Islamabad, Pakistan', uptime:'12d 17h', cpu:22, memory:61, disk:58, network:'11.8 Mbps', agent:'Online', heartbeat:'2 min ago', health:'Healthy', alerts:1, tags:['windows','production'] },
  { id:'srv-07', name:'cache-server-01', host:'cache-01.example.com', ip:'10.10.1.25', publicIp:'54.210.12.76', os:'Ubuntu 22.04 LTS', environment:'Production', provider:'AWS', location:'Frankfurt, Germany', uptime:'18d 4h', cpu:15, memory:38, disk:33, network:'5.1 Mbps', agent:'Online', heartbeat:'3 min ago', health:'Healthy', alerts:0, tags:['cache','redis','production'] },
  { id:'srv-08', name:'local-office-01', host:'office-01.local', ip:'192.168.1.25', publicIp:'—', os:'Windows Server 2019', environment:'Office', provider:'On-prem', location:'Islamabad, Pakistan', uptime:'36d 9h', cpu:12, memory:36, disk:28, network:'2.4 Mbps', agent:'Offline', heartbeat:'1 hour ago', health:'Offline', alerts:3, tags:['office','file-server'] },
  { id:'srv-09', name:'test-runner-01', host:'runner-01.example.com', ip:'10.10.6.10', publicIp:'54.210.12.82', os:'Debian 12', environment:'Testing', provider:'DigitalOcean', location:'London, UK', uptime:'2d 11h', cpu:31, memory:46, disk:35, network:'4.9 Mbps', agent:'Online', heartbeat:'2 min ago', health:'Healthy', alerts:0, tags:['ci','testing'] },
  { id:'srv-10', name:'api-staging-01', host:'api-stg-01.example.com', ip:'10.10.3.11', publicIp:'54.210.12.90', os:'Ubuntu 22.04 LTS', environment:'Staging', provider:'AWS', location:'Frankfurt, Germany', uptime:'8d 1h', cpu:33, memory:58, disk:44, network:'7.2 Mbps', agent:'Online', heartbeat:'1 min ago', health:'Healthy', alerts:0, tags:['api','staging'] },
  { id:'srv-11', name:'monitor-node-01', host:'monitor-01.example.com', ip:'10.10.7.10', publicIp:'54.210.12.99', os:'Ubuntu 24.04 LTS', environment:'Production', provider:'DigitalOcean', location:'London, UK', uptime:'26d 5h', cpu:19, memory:40, disk:39, network:'3.8 Mbps', agent:'Pending', heartbeat:'Not enrolled', health:'Pending', alerts:0, tags:['monitoring','production'] },
  { id:'srv-12', name:'backup-node-02', host:'backup-02.example.com', ip:'10.10.8.12', publicIp:'54.210.12.110', os:'Ubuntu 22.04 LTS', environment:'Production', provider:'Hetzner', location:'Helsinki, Finland', uptime:'—', cpu:0, memory:0, disk:0, network:'—', agent:'Pending', heartbeat:'Not enrolled', health:'Pending', alerts:0, tags:['backup','production'] },
];

export interface ServerFilterOptions {
  status: string[];
  operatingSystems: string[];
  environments: string[];
  providers: string[];
  groups: string[];
  agents: string[];
}

export const serverFilterOptions: ServerFilterOptions = {
  status: ['All', 'Online', 'Offline', 'Degraded', 'Pending'],
  operatingSystems: ['All', 'Ubuntu 22.04 LTS', 'Ubuntu 24.04 LTS', 'Debian 12', 'Windows Server 2022', 'Windows Server 2019'],
  environments: ['All', 'Production', 'Staging', 'Development', 'Testing', 'Office'],
  providers: ['All', 'AWS', 'Hetzner', 'DigitalOcean', 'On-prem'],
  groups: ['All', 'Web Servers', 'Application Servers', 'Database Servers', 'Infrastructure'],
  agents: ['All', 'Online', 'Offline', 'Pending'],
};

const serverNetworkPatterns: number[][] = [
  [3, 5, 4, 7, 5, 6, 10, 7, 5, 8, 6, 9],
  [2, 4, 3, 5, 4, 8, 5, 7, 4, 6, 3, 7],
  [4, 6, 5, 9, 6, 8, 5, 10, 7, 8, 6, 9],
  [2, 3, 6, 4, 7, 5, 9, 6, 8, 5, 7, 10],
];

export const serverNetworkTrends: Record<string, number[]> = Object.fromEntries(
  servers.map((server, index) => [server.id, serverNetworkPatterns[index % serverNetworkPatterns.length]]),
);

/**
 * Single source of truth for per-server CPU / memory telemetry.
 * Consumed by the CPU & Memory dashboard and the Server Details page so the
 * same server always reports the same figures.
 */
export interface ServerResourceMetrics {
  name: string;
  /** Functional role of the server, e.g. "web", "db", "app". */
  role: string;
  /** Total CPU utilisation in percent. */
  cpu: number;
  /** User CPU time in percent. */
  user: number;
  /** System CPU time in percent. */
  system: number;
  /** I/O wait in percent. */
  ioWait: number;
  /** Number of CPU cores. */
  cores: number;
  /** 1 minute load average. */
  load: number;
  /** Memory utilisation in percent. */
  memory: number;
  /** Installed memory in GB. */
  memoryTotal: number;
  /** Cached memory in GB. */
  memoryCached: number;
  /** Free memory in GB. */
  memoryFree: number;
  /** Swap usage in percent. */
  swap: number;
}

type ResourceRow = [
  name: string, cpu: number, user: number, system: number, ioWait: number,
  cores: number, load: number, memory: number, memoryTotal: number,
  memoryCached: number, memoryFree: number, swap: number,
];

const resourceRows: ResourceRow[] = [
  ["web-01", 78.6, 48.2, 22.1, 6.3, 8, 2.34, 89.3, 64, 12.6, 6.8, 0.8],
  ["web-02", 62.3, 35.6, 18.7, 4.5, 8, 1.82, 72.1, 64, 9.3, 8.6, 0.8],
  ["web-03", 45.8, 24.1, 15.9, 3.2, 16, 1.28, 59.4, 64, 8.1, 7.4, 0.5],
  ["web-04", 32.1, 18.3, 10.2, 1.6, 4, 0.98, 34.2, 16, 1.6, 8.9, 0.0],
  ["web-05", 75.4, 46.9, 21.4, 5.8, 8, 2.29, 82.4, 64, 11.8, 6.2, 1.2],
  ["web-06", 22.4, 12.6, 7.3, 0.8, 4, 0.61, 29.5, 16, 1.2, 9.4, 0.0],
  ["web-07", 19.8, 11.2, 6.4, 0.9, 4, 0.55, 30.6, 32, 2.1, 10.2, 0.0],
  ["web-08", 12.6, 7.1, 4.3, 0.4, 2, 0.31, 18.6, 16, 0.9, 11.3, 0.0],
  ["app-01", 81.2, 51.4, 23.6, 6.2, 8, 2.51, 84.6, 64, 12.4, 6.1, 1.5],
  ["app-02", 58.6, 32.8, 17.4, 4.9, 8, 1.67, 64.8, 64, 9.6, 7.4, 0.9],
  ["app-03", 49.2, 27.5, 16.8, 3.1, 12, 1.41, 64.8, 64, 8.8, 7.2, 0.6],
  ["app-04", 41.3, 22.6, 13.9, 2.8, 8, 1.12, 55.7, 32, 3.9, 7.8, 0.4],
  ["app-05", 35.4, 19.8, 11.2, 2.4, 8, 0.96, 52.4, 32, 3.4, 8.2, 0.0],
  ["app-06", 22.9, 13.1, 7.4, 1.2, 4, 0.64, 26.1, 16, 1.1, 9.8, 0.0],
  ["app-07", 16.3, 9.2, 5.1, 0.9, 4, 0.44, 27.4, 16, 0.9, 9.9, 0.0],
  ["app-08", 8.4, 4.7, 2.6, 0.5, 2, 0.21, 6.4, 16, 0.4, 12.6, 0.0],
  ["db-01", 83.9, 54.2, 24.8, 5.1, 16, 3.12, 91.4, 64, 12.9, 4.6, 2.4],
  ["db-02", 66.8, 39.4, 19.6, 4.2, 16, 2.24, 74.2, 64, 11.4, 5.8, 1.8],
  ["db-03", 54.8, 31.6, 16.9, 3.4, 12, 1.74, 57.2, 64, 10.2, 6.1, 1.5],
  ["db-04", 44.6, 25.9, 13.4, 2.9, 12, 1.36, 61.3, 64, 9.1, 6.8, 1.0],
  ["db-05", 33.7, 19.4, 10.1, 2.1, 8, 1.05, 38.5, 32, 3.8, 7.9, 0.5],
  ["db-06", 24.2, 13.7, 7.8, 1.2, 8, 0.66, 33.6, 32, 2.7, 8.6, 0.0],
  ["cache-01", 51.6, 29.8, 15.6, 3.2, 8, 1.58, 61.7, 64, 8.2, 6.9, 0.7],
  ["cache-02", 37.2, 21.3, 11.6, 2.4, 8, 1.13, 53.8, 32, 4.2, 7.6, 0.3],
  ["cache-03", 29.4, 16.8, 9.3, 1.6, 4, 0.84, 36.4, 16, 1.7, 8.4, 0.0],
  ["cache-04", 18.5, 10.6, 5.9, 0.9, 4, 0.52, 25.4, 16, 1.1, 9.7, 0.0],
  ["cache-05", 14.2, 8.1, 4.6, 0.7, 4, 0.39, 16.1, 16, 0.8, 11.4, 0.0],
  ["cache-06", 10.2, 5.8, 3.3, 0.5, 2, 0.27, 9.3, 16, 0.5, 12.4, 0.0],
  ["worker-01", 76.4, 46.8, 21.7, 5.9, 8, 2.28, 88.1, 64, 12.2, 6.3, 1.4],
  ["worker-02", 65.3, 38.1, 19.3, 4.6, 8, 1.93, 68.2, 64, 9.9, 6.8, 0.9],
  ["worker-03", 52.4, 30.2, 16.3, 3.3, 8, 1.62, 62.8, 64, 9.4, 7.0, 0.7],
  ["worker-04", 39.8, 22.7, 12.6, 2.6, 8, 1.21, 47.1, 32, 3.5, 8.3, 0.2],
  ["worker-05", 71.2, 42.6, 20.1, 5.2, 8, 2.11, 71.4, 64, 10.6, 6.6, 1.0],
  ["worker-06", 23.6, 13.4, 7.7, 1.4, 4, 0.68, 34.8, 32, 2.4, 9.0, 0.0],
  ["worker-07", 15.7, 8.9, 5.0, 0.8, 4, 0.45, 20.8, 16, 0.9, 10.6, 0.0],
  ["worker-08", 9.7, 5.5, 3.1, 0.5, 2, 0.26, 11.6, 16, 0.6, 11.9, 0.0],
  ["gw-01", 88.7, 56.9, 25.8, 6.0, 16, 3.34, 76.9, 64, 13.1, 5.4, 1.7],
  ["gw-02", 79.3, 48.5, 22.6, 5.4, 16, 2.86, 85.3, 64, 12.7, 5.9, 1.6],
  ["gw-03", 57.1, 33.6, 17.4, 3.9, 12, 1.79, 66.9, 64, 10.3, 6.7, 1.0],
  ["gw-04", 43.9, 25.4, 13.6, 2.8, 12, 1.32, 43.9, 32, 3.6, 8.1, 0.4],
  ["gw-05", 23.7, 13.6, 7.6, 1.3, 8, 0.65, 26.8, 16, 1.1, 9.7, 0.0],
  ["gw-06", 17.9, 10.1, 5.7, 1.0, 4, 0.49, 15.4, 16, 0.7, 11.3, 0.0],
  ["monitor-01", 86.3, 54.1, 25.1, 5.7, 8, 3.02, 78.2, 32, 6.4, 5.8, 1.2],
  ["monitor-02", 46.8, 26.9, 14.6, 3.1, 8, 1.35, 45.6, 32, 3.7, 8.4, 0.3],
  ["monitor-03", 59.9, 35.2, 17.8, 3.6, 8, 1.83, 68.4, 32, 5.8, 6.9, 0.8],
  ["monitor-04", 24.6, 14.2, 8.0, 1.2, 4, 0.67, 31.2, 16, 1.3, 9.5, 0.0],
  ["monitor-05", 20.4, 11.7, 6.5, 1.1, 4, 0.56, 28.3, 16, 1.1, 9.8, 0.0],
  ["monitor-06", 11.3, 6.4, 3.7, 0.6, 2, 0.31, 7.2, 16, 0.4, 12.8, 0.0],
];

/** Role derived from a server name prefix, e.g. "db-01" -> "db". */
function roleFromName(name: string): string {
  const prefix = name.split("-")[0];
  return ["web", "db", "app", "gw", "worker", "monitor", "cache"].includes(prefix) ? prefix : "";
}

const serverNameByResourceAlias: Record<string, string> = {
  "web-01": "web-frontend-01",
  "db-01": "db-primary",
  "app-02": "app-worker-02",
  "worker-02": "app-worker-02",
  "cache-01": "cache-server-01",
  "monitor-01": "monitor-node-01",
};

export const serverResourceMetrics: ServerResourceMetrics[] = resourceRows.map(
  ([name, cpu, user, system, ioWait, cores, load, memory, memoryTotal, memoryCached, memoryFree, swap]) => {
    const canonicalServer = servers.find((server) => server.name === (serverNameByResourceAlias[name] ?? name));
    if (!canonicalServer) {
      return { name, role: roleFromName(name), cpu, user, system, ioWait, cores, load, memory, memoryTotal, memoryCached, memoryFree, swap };
    }

    const cpuScale = cpu === 0 ? 0 : canonicalServer.cpu / cpu;
    const availableMemory = memoryTotal * (1 - canonicalServer.memory / 100);
    const adjustedMemoryFree = Math.round(availableMemory * 0.6 * 10) / 10;
    return {
      name, role: roleFromName(name), cpu: canonicalServer.cpu, user: Math.round(user * cpuScale * 10) / 10,
      system: Math.round(system * cpuScale * 10) / 10, ioWait: Math.round(ioWait * cpuScale * 10) / 10,
      cores, load: Math.round(load * cpuScale * 100) / 100, memory: canonicalServer.memory, memoryTotal,
      memoryCached: Math.round((availableMemory - adjustedMemoryFree) * 10) / 10, memoryFree: adjustedMemoryFree, swap,
    };
  },
);

/** Memory consumed in GB, derived from the utilisation percentage. */
export function memoryUsedGb(server: ServerResourceMetrics): number {
  return Math.round((server.memory / 100) * server.memoryTotal * 10) / 10;
}
