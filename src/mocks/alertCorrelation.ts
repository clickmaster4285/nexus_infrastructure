/**
 * Advanced Alert Correlation mock — single source of truth.
 * 6 seeded correlation clusters (member alerts inline), 24h trend, root-cause
 * ranking, signal weights and a correlation event feed. Actions mutate the
 * module-level store in-memory so acknowledge / suppress / resolve stay
 * consistent across the page and client-side navigation, mirroring
 * `mocks/onCallTeam.ts`. To swap in a real API later, replace the action
 * functions — the types and cluster shape stay.
 */

/* ---------------------------------- types --------------------------------- */

export type CorrelationSeverity = "critical" | "high" | "medium" | "low";
export type CorrelationStatus = "active" | "acknowledged" | "resolved" | "suppressed";
export type CorrelationCategory = "Database" | "Network" | "Deploy" | "Infrastructure" | "Application" | "Capacity";

export interface CorrelatedAlert {
  id: string;
  name: string;
  host: string;
  service: string;
  severity: CorrelationSeverity;
  source: string;
  triggeredAgoMinutes: number;
}

export interface CorrelationSignal {
  /** Signal that linked the alerts together. */
  kind: "topology" | "time" | "service" | "rule";
  weight: number;
}

export interface CorrelationCluster {
  id: string;
  title: string;
  rootCause: string;
  category: CorrelationCategory;
  severity: CorrelationSeverity;
  /** 0–100 confidence from the correlation engine. */
  confidence: number;
  status: CorrelationStatus;
  detectedAgoMinutes: number;
  durationMinutes: number;
  impact: string;
  recommendedAction: string;
  hosts: string[];
  services: string[];
  signals: CorrelationSignal[];
  /** Raw alerts auto-grouped under this cluster. */
  suppressedCount: number;
  alerts: CorrelatedAlert[];
}

export interface CorrelationTrendPoint { hour: string; correlated: number; suppressed: number }
export interface RootCauseStat { cause: string; confidence: number; clusters: number }
export interface CorrelationSignalStat { name: string; percent: number }
export interface ServiceImpactStat { service: string; clusters: number; alerts: number }
export interface CorrelationEvent { id: string; time: string; label: string; tone: "violet" | "blue" | "amber" | "green" }

/* ---------------------------------- seed ---------------------------------- */

const nowMinutes = (ago: number) => ago;
const seedClusters: CorrelationCluster[] = [
  {
    id: "COR-2041",
    title: "Database failover cascade",
    rootCause: "Primary DB failover at 11:42 PKT triggered a connection storm across the API tier.",
    category: "Database",
    severity: "critical",
    confidence: 94,
    status: "active",
    detectedAgoMinutes: nowMinutes(12),
    durationMinutes: 12,
    impact: "Checkout and payments APIs degraded for ~14% of users",
    recommendedAction: "Fail back to the primary and drain the connection pool on legacy-db-01",
    hosts: ["db-primary", "legacy-db-01", "prod-api-01"],
    services: ["Payments API", "Checkout Web", "Orders"],
    signals: [{ kind: "topology", weight: 44 }, { kind: "time", weight: 38 }, { kind: "service", weight: 18 }],
    suppressedCount: 23,
    alerts: [
      { id: "ALT-2210", name: "Database replication lag", host: "legacy-db-01", service: "Databases", severity: "critical", source: "prometheus", triggeredAgoMinutes: 21 },
      { id: "ALT-2211", name: "Failover node unreachable", host: "prod-api-02", service: "APIs", severity: "high", source: "prometheus", triggeredAgoMinutes: 18 },
      { id: "ALT-2212", name: "API availability below SLA", host: "api-gateway", service: "APIs", severity: "high", source: "blackbox", triggeredAgoMinutes: 16 },
      { id: "ALT-2213", name: "Connection pool exhausted", host: "db-primary", service: "Databases", severity: "critical", source: "prometheus", triggeredAgoMinutes: 14 },
      { id: "ALT-2214", name: "High CPU usage", host: "prod-api-01", service: "APIs", severity: "high", source: "node-exporter", triggeredAgoMinutes: 9 },
      { id: "ALT-2215", name: "Latency p95 above threshold", host: "api-gateway", service: "APIs", severity: "medium", source: "blackbox", triggeredAgoMinutes: 7 },
    ],
  },
  {
    id: "COR-2040",
    title: "Post-deploy error spike (v2.4.0)",
    rootCause: "Deploy v2.4.0 at 14:26 PKT — 5xx rate is 6x baseline on the checkout path.",
    category: "Deploy",
    severity: "high",
    confidence: 88,
    status: "active",
    detectedAgoMinutes: nowMinutes(22),
    durationMinutes: 18,
    impact: "Checkout error rate 4.2% (SLO burn 3.1x)",
    recommendedAction: "Rollback v2.4.0 or disable the checkout-refactor flag",
    hosts: ["prod-api-01", "web-frontend-01"],
    services: ["Checkout Web", "APIs"],
    signals: [{ kind: "time", weight: 52 }, { kind: "topology", weight: 31 }, { kind: "rule", weight: 17 }],
    suppressedCount: 17,
    alerts: [
      { id: "ALT-2198", name: "5xx rate above threshold", host: "prod-api-01", service: "APIs", severity: "high", source: "prometheus", triggeredAgoMinutes: 24 },
      { id: "ALT-2199", name: "Node heartbeat missed", host: "prod-api-02", service: "APIs", severity: "critical", source: "node-exporter", triggeredAgoMinutes: 20 },
      { id: "ALT-2200", name: "Failed health checks", host: "web-frontend-01", service: "Web Servers", severity: "high", source: "blackbox", triggeredAgoMinutes: 17 },
      { id: "ALT-2201", name: "Memory usage elevated", host: "app-worker-01", service: "Services", severity: "medium", source: "node-exporter", triggeredAgoMinutes: 12 },
    ],
  },
  {
    id: "COR-2039",
    title: "Edge switch BGP flapping — rack C2",
    rootCause: "BGP session flap on sw-c2-01; path instability between Helsinki and London.",
    category: "Network",
    severity: "high",
    confidence: 81,
    status: "acknowledged",
    detectedAgoMinutes: nowMinutes(47),
    durationMinutes: 31,
    impact: "~8% packet loss on EU edge traffic",
    recommendedAction: "Drain rack C2 and investigate sw-c2-01 uplink optics",
    hosts: ["sw-c2-01", "edge-lon-01"],
    services: ["CDN", "APIs"],
    signals: [{ kind: "topology", weight: 58 }, { kind: "time", weight: 29 }, { kind: "service", weight: 13 }],
    suppressedCount: 14,
    alerts: [
      { id: "ALT-2185", name: "BGP session down", host: "sw-c2-01", service: "Network", severity: "high", source: "snmp", triggeredAgoMinutes: 48 },
      { id: "ALT-2186", name: "Interface errors increasing", host: "sw-c2-01", service: "Network", severity: "medium", source: "snmp", triggeredAgoMinutes: 44 },
      { id: "ALT-2187", name: "CDN latency above SLA", host: "edge-lon-01", service: "CDN", severity: "high", source: "blackbox", triggeredAgoMinutes: 39 },
    ],
  },
  {
    id: "COR-2038",
    title: "Memory pressure vs batch jobs",
    rootCause: "Nightly batch jobs overlapping with memory-critical services on shared nodes.",
    category: "Infrastructure",
    severity: "medium",
    confidence: 74,
    status: "active",
    detectedAgoMinutes: nowMinutes(63),
    durationMinutes: 54,
    impact: "Worker queue depth +38%, no user-facing impact yet",
    recommendedAction: "Reschedule batch jobs outside 13:00–16:00 PKT window",
    hosts: ["app-worker-01", "cache-server-01"],
    services: ["Services", "Cache", "Message Queue"],
    signals: [{ kind: "time", weight: 47 }, { kind: "service", weight: 33 }, { kind: "topology", weight: 20 }],
    suppressedCount: 12,
    alerts: [
      { id: "ALT-2160", name: "Memory usage elevated", host: "app-worker-01", service: "Services", severity: "medium", source: "node-exporter", triggeredAgoMinutes: 63 },
      { id: "ALT-2161", name: "OOM killer invoked", host: "app-worker-01", service: "Services", severity: "medium", source: "loki", triggeredAgoMinutes: 51 },
      { id: "ALT-2162", name: "Cache hit ratio dropped", host: "cache-server-01", service: "Cache", severity: "medium", source: "prometheus", triggeredAgoMinutes: 37 },
    ],
  },
  {
    id: "COR-2037",
    title: "Certificate expiry warning chain",
    rootCause: "Three certificates expiring within 14 days on the public edge.",
    category: "Application",
    severity: "medium",
    confidence: 69,
    status: "resolved",
    detectedAgoMinutes: nowMinutes(240),
    durationMinutes: 96,
    impact: "None — renewed before expiry",
    recommendedAction: "Renewals completed; monitor for auto-renew failures",
    hosts: ["api.example.com", "app.example.com"],
    services: ["APIs", "Web Servers"],
    signals: [{ kind: "service", weight: 61 }, { kind: "rule", weight: 24 }, { kind: "time", weight: 15 }],
    suppressedCount: 9,
    alerts: [
      { id: "ALT-2099", name: "TLS certificate expires < 14d", host: "api.example.com", service: "APIs", severity: "medium", source: "blackbox", triggeredAgoMinutes: 240 },
      { id: "ALT-2100", name: "TLS certificate expires < 14d", host: "app.example.com", service: "Web Servers", severity: "medium", source: "blackbox", triggeredAgoMinutes: 235 },
    ],
  },
  {
    id: "COR-2036",
    title: "Legacy storage I/O saturation",
    rootCause: "legacy-db-01 disk I/O at 92% sustained; backup job amplified contention.",
    category: "Capacity",
    severity: "low",
    confidence: 62,
    status: "suppressed",
    detectedAgoMinutes: nowMinutes(320),
    durationMinutes: 140,
    impact: "Backup windows 2x longer",
    recommendedAction: "Move legacy-db-01 to NVMe and re-tune backup throughput",
    hosts: ["legacy-db-01"],
    services: ["Databases"],
    signals: [{ kind: "topology", weight: 55 }, { kind: "time", weight: 45 }],
    suppressedCount: 21,
    alerts: [
      { id: "ALT-2070", name: "Disk space critically low", host: "legacy-db-01", service: "Databases", severity: "high", source: "node-exporter", triggeredAgoMinutes: 320 },
      { id: "ALT-2071", name: "Disk I/O wait high", host: "legacy-db-01", service: "Databases", severity: "medium", source: "prometheus", triggeredAgoMinutes: 310 },
    ],
  },
];

let store: CorrelationCluster[] = seedClusters.map((cluster) => ({ ...cluster, hosts: [...cluster.hosts], services: [...cluster.services], signals: [...cluster.signals], alerts: [...cluster.alerts] }));

const cloneCluster = (cluster: CorrelationCluster): CorrelationCluster => ({
  ...cluster,
  hosts: [...cluster.hosts],
  services: [...cluster.services],
  signals: [...cluster.signals],
  alerts: [...cluster.alerts],
});

/** Snapshot of the module store (cloned). */
export function readCorrelationClusters(): CorrelationCluster[] {
  return store.map(cloneCluster);
}

export function acknowledgeCluster(id: string): void {
  store = store.map((cluster) => (cluster.id === id ? { ...cluster, status: "acknowledged" } : cluster));
}

export function suppressCluster(id: string): void {
  store = store.map((cluster) => (cluster.id === id ? { ...cluster, status: "suppressed" } : cluster));
}

export function resolveCluster(id: string): void {
  store = store.map((cluster) => (cluster.id === id ? { ...cluster, status: "resolved" } : cluster));
}

/* ------------------------- derived + static series ------------------------- */

export const correlationTrend: CorrelationTrendPoint[] = [
  { hour: "00:00", correlated: 3, suppressed: 4 }, { hour: "01:00", correlated: 2, suppressed: 5 },
  { hour: "02:00", correlated: 2, suppressed: 6 }, { hour: "03:00", correlated: 1, suppressed: 8 },
  { hour: "04:00", correlated: 2, suppressed: 7 }, { hour: "05:00", correlated: 4, suppressed: 6 },
  { hour: "06:00", correlated: 5, suppressed: 5 }, { hour: "07:00", correlated: 6, suppressed: 8 },
  { hour: "08:00", correlated: 9, suppressed: 12 }, { hour: "09:00", correlated: 11, suppressed: 14 },
  { hour: "10:00", correlated: 8, suppressed: 13 }, { hour: "11:00", correlated: 14, suppressed: 19 },
  { hour: "12:00", correlated: 12, suppressed: 16 }, { hour: "13:00", correlated: 10, suppressed: 15 },
  { hour: "14:00", correlated: 15, suppressed: 18 }, { hour: "15:00", correlated: 13, suppressed: 15 },
  { hour: "16:00", correlated: 9, suppressed: 12 }, { hour: "17:00", correlated: 7, suppressed: 9 },
  { hour: "18:00", correlated: 6, suppressed: 8 }, { hour: "19:00", correlated: 5, suppressed: 6 },
  { hour: "20:00", correlated: 4, suppressed: 5 }, { hour: "21:00", correlated: 4, suppressed: 4 },
  { hour: "22:00", correlated: 3, suppressed: 3 }, { hour: "23:00", correlated: 2, suppressed: 2 },
];

export const correlationRootCauses: RootCauseStat[] = [
  { cause: "Database failover cascade", confidence: 94, clusters: 3 },
  { cause: "Deploy regression (v2.4.0)", confidence: 88, clusters: 2 },
  { cause: "Network / BGP flapping", confidence: 81, clusters: 2 },
  { cause: "Memory pressure vs batch jobs", confidence: 74, clusters: 2 },
  { cause: "Storage I/O saturation", confidence: 62, clusters: 1 },
];

export const correlationSignals: CorrelationSignalStat[] = [
  { name: "Time proximity", percent: 41 },
  { name: "Topology / dependency", percent: 34 },
  { name: "Shared service", percent: 18 },
  { name: "Repeated rule", percent: 7 },
];

export const correlationServiceImpact: ServiceImpactStat[] = [
  { service: "Payments API", clusters: 6, alerts: 31 },
  { service: "Checkout Web", clusters: 5, alerts: 24 },
  { service: "Orders", clusters: 4, alerts: 17 },
  { service: "APIs", clusters: 4, alerts: 16 },
  { service: "Databases", clusters: 3, alerts: 14 },
];

export const correlationEvents: CorrelationEvent[] = [
  { id: "EVT-1", time: "12m ago", label: "COR-2041 auto-correlated 6 alerts across 3 hosts", tone: "violet" },
  { id: "EVT-2", time: "25m ago", label: "Ayesha Khan acknowledged COR-2039", tone: "blue" },
  { id: "EVT-3", time: "31m ago", label: "COR-2040 linked 4 alerts to deploy v2.4.0 by deploy time", tone: "violet" },
  { id: "EVT-4", time: "58m ago", label: "Suppressed 14 duplicates (noise reduction +9%)", tone: "amber" },
  { id: "EVT-5", time: "2h ago", label: "COR-2037 resolved — certificates renewed", tone: "green" },
  { id: "EVT-6", time: "4h ago", label: "COR-2036 suppressed (legacy storage known issue)", tone: "amber" },
];

export const correlationHeroStats = { correlated24h: 147, noiseReduction: 68, mttaImprovement: 38 };
