/** Status vocabulary for the NOC live map: Online / Warning / Critical. */
export type NocMapStatus = "online" | "warning" | "critical";

/** Marker palette - green, orange and red, aligned with the NEXUS status tones. */
export const NOC_MAP_STATUS_COLOR: Record<NocMapStatus, string> = {
  online: "#22c55e",
  warning: "#f59e0b",
  critical: "#ef4444",
};

export const NOC_MAP_STATUS_LABEL: Record<NocMapStatus, string> = {
  online: "Online",
  warning: "Warning",
  critical: "Critical",
};

/** A single monitored server placed inside a data center. */
export interface NocMapServer {
  hostname: string;
  ip: string;
  role: string;
  os: string;
  status: NocMapStatus;
  cpu: number;
  memory: number;
  uptime: string;
  lastCheck: string;
}

/** A monitored data center with the servers it hosts. */
export interface NocMapSite {
  id: string;
  code: string;
  city: string;
  country: string;
  region: string;
  provider: string;
  facility: string;
  lat: number;
  lng: number;
  status: NocMapStatus;
  health: number;
  throughput: string;
  alerts: number;
  uptime: string;
  lastCheck: string;
  servers: NocMapServer[];
}

/** Mock fleet rendered on the NOC OpenStreetMap view. */
export const nocMapSites: NocMapSite[] = [
  {
    id: "fra", code: "FRA", city: "Frankfurt", country: "Germany", region: "EU Central",
    provider: "AWS", facility: "FRA1 · Equinix FR5", lat: 50.11, lng: 8.68,
    status: "online", health: 99.8, throughput: "1.4 Gbps", alerts: 0,
    uptime: "412d 6h", lastCheck: "12s ago",
    servers: [
      { hostname: "prod-api-01", ip: "10.10.1.10", role: "API gateway", os: "Ubuntu 22.04 LTS", status: "online", cpu: 24, memory: 48, uptime: "14d 6h", lastCheck: "11s ago" },
      { hostname: "prod-api-02", ip: "10.10.1.11", role: "API gateway", os: "Ubuntu 22.04 LTS", status: "online", cpu: 31, memory: 52, uptime: "14d 6h", lastCheck: "14s ago" },
    ],
  },
  {
    id: "hel", code: "HEL", city: "Helsinki", country: "Finland", region: "EU North",
    provider: "Hetzner", facility: "Hetzner DC Helsinki", lat: 60.17, lng: 24.94,
    status: "online", health: 99.6, throughput: "820 Mbps", alerts: 0,
    uptime: "438d 2h", lastCheck: "9s ago",
    servers: [
      { hostname: "db-primary", ip: "10.20.4.10", role: "Primary database", os: "Debian 12", status: "online", cpu: 41, memory: 67, uptime: "31d 2h", lastCheck: "8s ago" },
    ],
  },
  {
    id: "lhr", code: "LHR", city: "London", country: "United Kingdom", region: "EU West",
    provider: "Azure", facility: "UK South · Slough", lat: 51.5, lng: -0.12,
    status: "online", health: 99.9, throughput: "2.1 Gbps", alerts: 0,
    uptime: "167d 11h", lastCheck: "15s ago",
    servers: [
      { hostname: "web-frontend-01", ip: "10.30.2.21", role: "Web frontend", os: "Ubuntu 22.04 LTS", status: "online", cpu: 18, memory: 41, uptime: "6d 11h", lastCheck: "16s ago" },
      { hostname: "web-frontend-02", ip: "10.30.2.22", role: "Web frontend", os: "Ubuntu 22.04 LTS", status: "online", cpu: 22, memory: 44, uptime: "6d 11h", lastCheck: "13s ago" },
    ],
  },
  {
    id: "iad", code: "IAD", city: "Ashburn", country: "United States", region: "US East",
    provider: "AWS", facility: "IAD1 · Equinix DC10", lat: 39.04, lng: -77.49,
    status: "online", health: 99.8, throughput: "1.8 Gbps", alerts: 0,
    uptime: "391d 3h", lastCheck: "10s ago",
    servers: [
      { hostname: "cache-server-01", ip: "10.40.1.10", role: "Cache (Redis)", os: "Ubuntu 22.04 LTS", status: "online", cpu: 12, memory: 63, uptime: "22d 3h", lastCheck: "12s ago" },
    ],
  },
  {
    id: "pdx", code: "PDX", city: "Portland", country: "United States", region: "US West",
    provider: "Google Cloud", facility: "us-west1 · Portland", lat: 45.52, lng: -122.68,
    status: "online", health: 99.7, throughput: "640 Mbps", alerts: 0,
    uptime: "97d 9h", lastCheck: "21s ago",
    servers: [
      { hostname: "app-worker-02", ip: "10.50.7.12", role: "Queue worker", os: "Ubuntu 24.04 LTS", status: "online", cpu: 87, memory: 55, uptime: "4d 9h", lastCheck: "24s ago" },
    ],
  },
  {
    id: "gru", code: "GRU", city: "Sao Paulo", country: "Brazil", region: "South America",
    provider: "Oracle Cloud", facility: "GRU · Sao Paulo A", lat: -23.55, lng: -46.63,
    status: "online", health: 99.7, throughput: "410 Mbps", alerts: 0,
    uptime: "218d 1h", lastCheck: "17s ago",
    servers: [
      { hostname: "local-office-01", ip: "10.60.9.10", role: "Office services", os: "Windows Server 2022", status: "online", cpu: 34, memory: 58, uptime: "9d 1h", lastCheck: "19s ago" },
    ],
  },
  {
    id: "isb", code: "ISB", city: "Islamabad", country: "Pakistan", region: "Asia Pacific",
    provider: "On-premise", facility: "ISB · NEXUS DC-2", lat: 33.69, lng: 73.06,
    status: "online", health: 99.9, throughput: "980 Mbps", alerts: 0,
    uptime: "449d 8h", lastCheck: "6s ago",
    servers: [
      { hostname: "win-app-01", ip: "10.70.3.14", role: "Windows app server", os: "Windows Server 2022", status: "online", cpu: 29, memory: 47, uptime: "18d 8h", lastCheck: "7s ago" },
    ],
  },
  {
    id: "dxb", code: "DXB", city: "Dubai", country: "United Arab Emirates", region: "Middle East",
    provider: "Azure", facility: "UAE North · Dubai", lat: 25.2, lng: 55.27,
    status: "online", health: 99.8, throughput: "1.1 Gbps", alerts: 0,
    uptime: "512d 2h", lastCheck: "23s ago",
    servers: [
      { hostname: "monitor-node-01", ip: "10.80.5.10", role: "Monitoring agent", os: "Debian 12", status: "online", cpu: 9, memory: 26, uptime: "44d 2h", lastCheck: "25s ago" },
    ],
  },
  {
    id: "sin", code: "SIN", city: "Singapore", country: "Singapore", region: "Asia Pacific",
    provider: "Google Cloud", facility: "ap-southeast1", lat: 1.35, lng: 103.82,
    status: "online", health: 99.6, throughput: "720 Mbps", alerts: 0,
    uptime: "74d 5h", lastCheck: "14s ago",
    servers: [
      { hostname: "api-staging-01", ip: "10.90.8.11", role: "Staging API", os: "Ubuntu 22.04 LTS", status: "online", cpu: 16, memory: 39, uptime: "3d 5h", lastCheck: "18s ago" },
    ],
  },
  {
    id: "bom", code: "BOM", city: "Mumbai", country: "India", region: "Asia Pacific",
    provider: "AWS", facility: "ap-south-1 · Mumbai", lat: 19.07, lng: 72.87,
    status: "online", health: 99.7, throughput: "530 Mbps", alerts: 0,
    uptime: "301d 14h", lastCheck: "20s ago",
    servers: [
      { hostname: "test-runner-01", ip: "10.11.6.10", role: "CI runners", os: "Ubuntu 24.04 LTS", status: "online", cpu: 64, memory: 71, uptime: "12d 14h", lastCheck: "22s ago" },
    ],
  },
  {
    id: "cpt", code: "CPT", city: "Cape Town", country: "South Africa", region: "Africa",
    provider: "Oracle Cloud", facility: "CPT · Equinix DC1", lat: -33.92, lng: 18.42,
    status: "warning", health: 98.7, throughput: "260 Mbps", alerts: 2,
    uptime: "96d 3h", lastCheck: "46s ago",
    servers: [
      { hostname: "legacy-db-01", ip: "10.12.2.10", role: "Legacy database", os: "Ubuntu 20.04 LTS", status: "warning", cpu: 92, memory: 88, uptime: "96d 3h", lastCheck: "52s ago" },
      { hostname: "legacy-db-02", ip: "10.12.2.11", role: "Legacy database", os: "Ubuntu 20.04 LTS", status: "online", cpu: 38, memory: 61, uptime: "96d 3h", lastCheck: "47s ago" },
    ],
  },
  {
    id: "arn", code: "ARN", city: "Stockholm", country: "Sweden", region: "EU North",
    provider: "AWS", facility: "EU North · ARN", lat: 59.33, lng: 18.06,
    status: "critical", health: 96.4, throughput: "0 Mbps", alerts: 4,
    uptime: "0m", lastCheck: "4m ago",
    servers: [
      { hostname: "prod-api-02", ip: "10.13.1.12", role: "API failover", os: "Ubuntu 22.04 LTS", status: "critical", cpu: 0, memory: 0, uptime: "unreachable", lastCheck: "6m ago" },
      { hostname: "api-failover-02", ip: "10.13.1.13", role: "API failover", os: "Ubuntu 22.04 LTS", status: "critical", cpu: 0, memory: 0, uptime: "unreachable", lastCheck: "6m ago" },
    ],
  },
];

export const nocMapSiteCounts = nocMapSites.reduce<Record<NocMapStatus, number>>((counts, site) => {
  counts[site.status] += 1;
  return counts;
}, { online: 0, warning: 0, critical: 0 });

export const nocMapServerCounts = nocMapSites.reduce<Record<NocMapStatus, number>>((counts, site) => {
  site.servers.forEach((server) => {
    counts[server.status] += 1;
  });
  return counts;
}, { online: 0, warning: 0, critical: 0 });

export const nocMapServerTotal = nocMapSites.reduce((total, site) => total + site.servers.length, 0);
