/**
 * Capacity Planning & Forecasting — mock data, single source of truth.
 *
 * ~24 resources anchored to the numbers shown elsewhere in the app (AWS S3
 * 22.6/25 TB @ +500 GB/wk ≈ 34d, DB storage 521 GB used / 203 GB free @
 * +4.2 GB/day ≈ 48d, Local NAS 13.4/20 TB @ +120 GB/wk, DB connections
 * 412/600). History is generated deterministically per resource (seeded
 * trend + weekly seasonality + noise); the forecast engine below (linear
 * regression, optional weekly seasonal adjustment, 1.96σ bands, backtest
 * MAPE) computes every projection — nothing is hardcoded. Maintenance
 * windows and resolved incidents are excluded from the fit.
 *
 * To swap in a real API later, replace `loadCapacityData` and the store
 * actions — the types and engine stay.
 */

import { logAudit } from "@/mocks/auditLogs";
import { readMaintenanceWindowStore } from "@/mocks/maintenanceWindows";
import { readIncidentStore } from "@/mocks/incidents";
import { ALERT_RULE_LIST, type AlertRule, type NotificationChannel } from "@/mocks/alertRules";

/* ------------------------------- forecast math ---------------------------- */

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  residualStd: number;
  mape: number;
}

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

/** Ordinary least squares over x = 0..n-1. */
export function linearRegression(y: number[]): RegressionResult {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0, r2: 0, residualStd: 0, mape: 0 };
  const xMean = (n - 1) / 2;
  const yMean = sum(y) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (i - xMean) * (y[i] - yMean);
    sxx += (i - xMean) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = yMean - slope * xMean;
  const predicted = y.map((_, i) => intercept + slope * i);
  const ssRes = sum(y.map((value, i) => (value - predicted[i]) ** 2));
  const ssTot = sum(y.map((value) => (value - yMean) ** 2));
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  const residualStd = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
  // Backtest MAPE: hold out the last 14 points, refit, score them.
  const holdout = Math.min(14, Math.floor(n / 4));
  let mape = 0;
  if (holdout >= 2 && n - holdout >= 4) {
    const train = y.slice(0, n - holdout);
    const fit = linearRegressionRaw(train);
    const errors: number[] = [];
    for (let i = n - holdout; i < n; i += 1) {
      const estimate = fit.intercept + fit.slope * i;
      const actual = y[i];
      if (actual !== 0) errors.push(Math.abs((actual - estimate) / actual));
    }
    mape = errors.length ? (sum(errors) / errors.length) * 100 : 0;
  }
  return { slope, intercept, r2, residualStd, mape };
}

/** Slope/intercept only (recursion-safe). */
function linearRegressionRaw(y: number[]): { slope: number; intercept: number } {
  const n = y.length;
  const xMean = (n - 1) / 2;
  const yMean = sum(y) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (i - xMean) * (y[i] - yMean);
    sxx += (i - xMean) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  return { slope, intercept: yMean - slope * xMean };
}

/** Weekly day-of-week means removed from the series, residual regressed. */
export function seasonalRegression(y: number[]): RegressionResult & { seasonal: number[] } {
  const byDow = new Map<number, { sum: number; count: number }>();
  y.forEach((value, index) => {
    const dow = index % 7;
    const bucket = byDow.get(dow) ?? { sum: 0, count: 0 };
    bucket.sum += value;
    bucket.count += 1;
    byDow.set(dow, bucket);
  });
  const overall = sum(y) / y.length;
  const seasonal = Array.from({ length: 7 }, (_, dow) => {
    const bucket = byDow.get(dow);
    return bucket ? bucket.sum / bucket.count - overall : 0;
  });
  const detrended = y.map((value, index) => value - seasonal[index % 7]);
  const fit = linearRegression(detrended);
  return { ...fit, seasonal };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export type ForecastMethod = "auto" | "linear" | "seasonal";

export interface ForecastOutput {
  slopePerDay: number;
  r2: number;
  residualStd: number;
  mape: number;
  method: "Linear" | "Seasonal";
  points: Array<{ index: number; value: number; lower: number; upper: number }>;
  /** Residual std used for band width (seasonal model when selected). */
}

export function forecastSeries(current: number[], horizonDays: number, method: ForecastMethod): ForecastOutput {
  const linear = linearRegression(current);
  const seasonalFit = current.length >= 28 ? seasonalRegression(current) : null;
  const autoSeasonal = seasonalFit !== null && seasonalFit.residualStd < linear.residualStd * 0.9;
  const useSeasonal = method === "seasonal" ? seasonalFit !== null : method === "auto" ? autoSeasonal : false;
  const base = useSeasonal && seasonalFit ? seasonalFit : linear;
  const slopePerDay = base.slope;
  const residualStd = base.residualStd;
  const mape = base.mape;
  const r2 = clamp01(base.r2);
  const seasonal = useSeasonal && seasonalFit ? seasonalFit.seasonal : null;
  const points = Array.from({ length: horizonDays + 1 }, (_, i) => {
    const index = current.length + i - 1;
    const seasonalOffset = seasonal ? seasonal[index % 7] : 0;
    const value = base.intercept + slopePerDay * index + seasonalOffset;
    const band = 1.96 * residualStd * Math.sqrt(1 + i / Math.max(1, current.length));
    return { index, value: Math.max(0, value), lower: Math.max(0, value - band), upper: value + band };
  });
  return { slopePerDay, r2, residualStd, mape, method: useSeasonal ? "Seasonal" : "Linear", points };
}

export function daysToThreshold(currentValue: number, slopePerDay: number, threshold: number): number {
  if (slopePerDay <= 0) return Number.POSITIVE_INFINITY;
  const days = (threshold - currentValue) / slopePerDay;
  return days < 0 ? 0 : days;
}

export type RiskLevel = "at_risk" | "watch" | "healthy" | "stable";

export function riskLevel(days: number): RiskLevel {
  if (!Number.isFinite(days)) return "stable";
  if (days <= 30) return "at_risk";
  if (days <= 90) return "watch";
  return "healthy";
}

export function confidenceLevel(historyDays: number, r2: number): "high" | "medium" | "low" {
  if (historyDays < 14 || r2 < 0.5) return "low";
  if (historyDays >= 30 && r2 >= 0.85) return "high";
  return "medium";
}

/* --------------------------------- seeds ---------------------------------- */

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();
const dayIso = (offsetDays: number) => new Date(now - offsetDays * DAY_MS).toISOString();
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

export type CapacityResourceType = "Server" | "Storage Pool" | "Database" | "Network Link" | "Cluster";
export type CapacityMetric = "CPU %" | "Memory %" | "Disk %" | "Storage TB" | "Storage GB" | "Bandwidth %" | "Connections";
export type CapacityScope = "resource" | "group";
export type RecommendationAction = "Expand storage" | "Add capacity" | "Right-size" | "Migrate" | "Cleanup" | "Investigate";
export type Priority = "Urgent" | "High" | "Medium" | "Low";

export interface CapacityResource {
  id: string;
  name: string;
  type: CapacityResourceType;
  metric: CapacityMetric;
  group: string;
  site: string;
  /** Unit capacity (limit) in the metric's unit. */
  capacity: number;
  /** Current value in the metric's unit. */
  current: number;
  avg: number;
  p95: number;
  warnThreshold: number;
  critThreshold: number;
  /** Deterministic slope in units per week (used to shape the history). */
  growthPerWeek: number;
  leadTimeDays: number;
  unitCostRate: number;
  managedBy: string;
  linkedAssetId: string | null;
  linkedPoolId: string | null;
  history: Array<{ day: string; label: string; value: number; excluded?: boolean }>;
  seed: number;
  recommendedAction: RecommendationAction;
  recommendedDetail: string;
  estimatedCost: number | null;
  effort: "S" | "M" | "L";
}

interface ResourceConfig {
  id: string;
  name: string;
  type: CapacityResourceType;
  metric: CapacityMetric;
  group: string;
  site: string;
  capacity: number;
  current: number;
  avg: number;
  p95: number;
  growthPerWeek: number;
  seed: number;
  leadTimeDays: number;
  unitCostRate: number;
  linkedAssetId?: string | null;
  linkedPoolId?: string | null;
  managedBy: string;
  action: RecommendationAction;
  detail: string;
  cost: number | null;
  effort: "S" | "M" | "L";
}

const RESOURCE_CONFIGS: ResourceConfig[] = [
  { id: "CR-POOL-S3", name: "AWS S3 pool", type: "Storage Pool", metric: "Storage TB", group: "Backups", site: "AWS", capacity: 25, current: 22.6, avg: 20.1, p95: 22.4, growthPerWeek: 0.5, seed: 1042, leadTimeDays: 14, unitCostRate: 23, linkedPoolId: "pool-s3", managedBy: "SRE Team", action: "Expand storage", detail: "Expand AWS S3 pool by 10 TB", cost: 230, effort: "S" },
  { id: "CR-POOL-NAS", name: "Local NAS", type: "Storage Pool", metric: "Storage TB", group: "Backups", site: "Helsinki DC-1", capacity: 20, current: 13.4, avg: 12.8, p95: 13.3, growthPerWeek: 0.117, seed: 1043, leadTimeDays: 14, unitCostRate: 12, linkedPoolId: "pool-nas", managedBy: "SRE Team", action: "Cleanup", detail: "Enable 30-day prune on Local NAS", cost: 0, effort: "S" },
  { id: "CR-POOL-VAULT", name: "Offsite Vault", type: "Storage Pool", metric: "Storage TB", group: "Backups", site: "Offsite", capacity: 40, current: 12.2, avg: 11.9, p95: 12.1, growthPerWeek: 0.006, seed: 1044, leadTimeDays: 14, unitCostRate: 18, linkedPoolId: "pool-vault", managedBy: "SRE Team", action: "Cleanup", detail: "Vault healthy — no action required", cost: 0, effort: "S" },
  { id: "CR-DB-STORAGE", name: "db-01 · Storage", type: "Database", metric: "Storage GB", group: "Databases", site: "Helsinki DC-1", capacity: 724, current: 521, avg: 487, p95: 519, growthPerWeek: 29.4, seed: 1045, leadTimeDays: 14, unitCostRate: 0.5, managedBy: "Database Team", action: "Expand storage", detail: "Grow db-01 data volume by 250 GB", cost: 125, effort: "M" },
  { id: "CR-DB-CONN", name: "db-01 · Connections", type: "Database", metric: "Connections", group: "Databases", site: "Helsinki DC-1", capacity: 600, current: 412, avg: 356, p95: 438, growthPerWeek: 2.5, seed: 1046, leadTimeDays: 30, unitCostRate: 0, linkedAssetId: "db-primary", managedBy: "Database Team", action: "Cleanup", detail: "Kill idle-in-transaction sessions older than 10m", cost: 0, effort: "S" },
  { id: "CR-GW01-CPU", name: "gw-01 · CPU", type: "Server", metric: "CPU %", group: "Edge Gateways", site: "London DC-2", capacity: 100, current: 88.7, avg: 62.4, p95: 91.3, growthPerWeek: 0.18, seed: 1047, leadTimeDays: 21, unitCostRate: 8, linkedAssetId: null, managedBy: "Platform Team", action: "Investigate", detail: "Profile gw-01 — 3.34 avg load vs 88% CPU", cost: 0, effort: "M" },
  { id: "CR-MON01-CPU", name: "monitor-01 · CPU", type: "Server", metric: "CPU %", group: "Monitoring", site: "London DC-2", capacity: 100, current: 86.3, avg: 61.5, p95: 89, growthPerWeek: 0.6, seed: 1048, leadTimeDays: 21, unitCostRate: 8, managedBy: "SRE Team", action: "Add capacity", detail: "Add 4 vCPU to monitor-01 (8 → 12)", cost: 320, effort: "M" },
  { id: "CR-DB01-CPU", name: "db-01 · CPU", type: "Server", metric: "CPU %", group: "Databases", site: "Helsinki DC-1", capacity: 100, current: 83.9, avg: 55.6, p95: 87.5, growthPerWeek: 0.19, seed: 1049, leadTimeDays: 21, unitCostRate: 8, linkedAssetId: "db-primary", managedBy: "Database Team", action: "Investigate", detail: "Baseline db-01 CPU by query digest", cost: 0, effort: "M" },
  { id: "CR-WEB01-CPU", name: "web-01 · CPU", type: "Server", metric: "CPU %", group: "Web", site: "London DC-2", capacity: 100, current: 78.6, avg: 61.2, p95: 82.1, growthPerWeek: 0.3, seed: 1050, leadTimeDays: 21, unitCostRate: 8, managedBy: "Platform Team", action: "Right-size", detail: "Offload static assets to CDN — web-01", cost: 0, effort: "M" },
  { id: "CR-GW02-CPU", name: "gw-02 · CPU", type: "Server", metric: "CPU %", group: "Edge Gateways", site: "London DC-2", capacity: 100, current: 79.3, avg: 52.8, p95: 84.6, growthPerWeek: 0.22, seed: 1051, leadTimeDays: 21, unitCostRate: 8, managedBy: "Platform Team", action: "Right-size", detail: "gw-02: 4 idle vCPU in off-peak — downsize", cost: -90, effort: "S" },
  { id: "CR-GW03-CPU", name: "gw-03 · CPU", type: "Server", metric: "CPU %", group: "Edge Gateways", site: "London DC-2", capacity: 100, current: 57.1, avg: 41.3, p95: 63.8, growthPerWeek: 0.3, seed: 1052, leadTimeDays: 21, unitCostRate: 8, managedBy: "Platform Team", action: "Cleanup", detail: "gw-03 healthy — quarterly review", cost: 0, effort: "S" },
  { id: "CR-DB01-MEM", name: "db-01 · Memory", type: "Server", metric: "Memory %", group: "Databases", site: "Helsinki DC-1", capacity: 100, current: 91.4, avg: 63.4, p95: 93.1, growthPerWeek: -0.3, seed: 1053, leadTimeDays: 21, unitCostRate: 1.1, linkedAssetId: "db-primary", managedBy: "Database Team", action: "Investigate", detail: "db-01 memory peaking — check buffer pool hit ratio", cost: 0, effort: "M" },
  { id: "CR-WEB01-MEM", name: "web-01 · Memory", type: "Server", metric: "Memory %", group: "Web", site: "London DC-2", capacity: 100, current: 89.3, avg: 52.3, p95: 91.5, growthPerWeek: 0.05, seed: 1054, leadTimeDays: 21, unitCostRate: 1.1, managedBy: "Platform Team", action: "Investigate", detail: "web-01 GC pressure — heap profile", cost: 0, effort: "M" },
  { id: "CR-APPW01-MEM", name: "app-worker-01 · Memory", type: "Server", metric: "Memory %", group: "Application", site: "AWS · eu-west-1", capacity: 100, current: 84.6, avg: 54.7, p95: 88, growthPerWeek: 0.7, seed: 1055, leadTimeDays: 21, unitCostRate: 1.1, managedBy: "Platform Team", action: "Add capacity", detail: "Add 16 GB RAM to app-worker-01", cost: 210, effort: "M" },
  { id: "CR-CACHE-MEM", name: "cache-01 · Memory", type: "Server", metric: "Memory %", group: "Cache", site: "Helsinki DC-1", capacity: 100, current: 86.1, avg: 61.3, p95: 88.4, growthPerWeek: 1.05, seed: 1056, leadTimeDays: 21, unitCostRate: 1.1, linkedAssetId: "cache-server-01", managedBy: "Platform Team", action: "Add capacity", detail: "Cache eviction rate rising — scale Redis 64 → 96 GB", cost: 170, effort: "M" },
  { id: "CR-DB01-DISK", name: "db-01 · Disk /", type: "Server", metric: "Disk %", group: "Databases", site: "Helsinki DC-1", capacity: 100, current: 78.4, avg: 62.9, p95: 81.2, growthPerWeek: 3.9, seed: 1057, leadTimeDays: 21, unitCostRate: 1.5, linkedAssetId: "db-primary", managedBy: "Database Team", action: "Cleanup", detail: "Purge WAL archives older than 14 days on db-01", cost: 0, effort: "S" },
  { id: "CR-GW01-DISK", name: "gw-01 · Disk", type: "Server", metric: "Disk %", group: "Edge Gateways", site: "London DC-2", capacity: 100, current: 36.9, avg: 24.1, p95: 39.2, growthPerWeek: 0.6, seed: 1058, leadTimeDays: 21, unitCostRate: 1.5, managedBy: "Platform Team", action: "Cleanup", detail: "gw-01 disk trending flat — keep", cost: 0, effort: "S" },
  { id: "CR-MON01-DISK", name: "monitor-01 · Disk", type: "Server", metric: "Disk %", group: "Monitoring", site: "London DC-2", capacity: 100, current: 35.5, avg: 23.4, p95: 37.1, growthPerWeek: 0.5, seed: 1059, leadTimeDays: 21, unitCostRate: 1.5, managedBy: "SRE Team", action: "Cleanup", detail: "monitor-01 /var/lib/monitoring — retain 30 days", cost: 0, effort: "S" },
  { id: "CR-CORE-ETH0", name: "core-switch-01 · eth0", type: "Network Link", metric: "Bandwidth %", group: "Network", site: "Helsinki DC-1", capacity: 100, current: 92.3, avg: 74.2, p95: 94.1, growthPerWeek: -0.8, seed: 1060, leadTimeDays: 30, unitCostRate: 45, managedBy: "Network Team", action: "Migrate", detail: "Migrate bulk backup traffic to 10G eth1", cost: 450, effort: "L" },
  { id: "CR-SWC2-BGP", name: "sw-c2-01 · uplink", type: "Network Link", metric: "Bandwidth %", group: "Network", site: "London DC-2", capacity: 100, current: 61.2, avg: 44.7, p95: 68.9, growthPerWeek: 2.1, seed: 1061, leadTimeDays: 30, unitCostRate: 45, managedBy: "Network Team", action: "Migrate", detail: "sw-c2-01 saturating off-peak — add LAG member", cost: 380, effort: "L" },
  { id: "CR-EDGE-LON", name: "edge-lon-01 · uplink", type: "Network Link", metric: "Bandwidth %", group: "Network", site: "London DC-2", capacity: 100, current: 47.6, avg: 38.1, p95: 54.3, growthPerWeek: 1.4, seed: 1062, leadTimeDays: 30, unitCostRate: 45, managedBy: "Network Team", action: "Cleanup", detail: "edge-lon-01 healthy", cost: 0, effort: "S" },
  { id: "CR-WORKER08-CPU", name: "worker-08 · CPU", type: "Server", metric: "CPU %", group: "Workers", site: "AWS · eu-west-1", capacity: 100, current: 9.7, avg: 6.1, p95: 9.8, growthPerWeek: 0.1, seed: 1063, leadTimeDays: 21, unitCostRate: 8, managedBy: "Platform Team", action: "Right-size", detail: "Right-size worker-08 4 vCPU → 2 vCPU", cost: -60, effort: "S" },
  { id: "CR-WORKER07-CPU", name: "worker-07 · CPU", type: "Server", metric: "CPU %", group: "Workers", site: "AWS · eu-west-1", capacity: 100, current: 15.7, avg: 8.3, p95: 14.2, growthPerWeek: 0.15, seed: 1064, leadTimeDays: 21, unitCostRate: 8, managedBy: "Platform Team", action: "Right-size", detail: "Right-size worker-07 4 vCPU → 2 vCPU", cost: -60, effort: "S" },
  { id: "CR-MON06-CPU", name: "monitor-06 · CPU", type: "Server", metric: "CPU %", group: "Monitoring", site: "London DC-2", capacity: 100, current: 11.3, avg: 5.2, p95: 8.4, growthPerWeek: 0.12, seed: 1065, leadTimeDays: 21, unitCostRate: 8, managedBy: "SRE Team", action: "Right-size", detail: "Right-size monitor-06 2 vCPU → 1 vCPU", cost: -30, effort: "S" },
];

/** Deterministic 90-day history: trend + weekly seasonality + seeded noise. Last point = current. */
function buildHistory(config: ResourceConfig): CapacityResource["history"] {
  const rand = mulberry32(config.seed);
  const points = 90;
  const weeklyAmplitude = config.metric.includes("%") ? 3.5 : config.current * 0.02;
  const noise = config.metric.includes("%") ? 1.6 : Math.max(0.02, config.current * 0.008);
  const perDay = config.growthPerWeek / 7;
  const raw: number[] = [];
  for (let i = 0; i < points; i += 1) {
    const base = config.current - perDay * (points - 1 - i);
    const seasonal = weeklyAmplitude * Math.sin((2 * Math.PI * (i + config.seed % 7)) / 7 + 0.9);
    const jitter = (rand() - 0.5) * 2 * noise;
    raw.push(base + seasonal + jitter);
  }
  const delta = config.current - raw[points - 1];
  return raw.map((value, i) => {
    const dayIndex = points - 1 - i;
    return { day: dayIso(dayIndex), label: dateLabel(dayIso(dayIndex)), value: Math.max(0, Math.round((value + delta) * 100) / 100) };
  });
}

/** Excluded-day indexes (maintenance windows + resolved incidents), for the fit. */
export function excludedDayIndexes(historyLength = 90): number[] {
  const excluded = new Set<number>();
  const windowDays = readMaintenanceWindowStore().flatMap((window) => {
    const start = Date.parse(window.start);
    const end = Date.parse(window.end);
    const indexes: number[] = [];
    for (let i = 0; i < historyLength; i += 1) {
      const dayStart = now - (historyLength - 1 - i) * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      if (start < dayEnd && end > dayStart) indexes.push(i);
    }
    return indexes;
  });
  windowDays.forEach((i) => excluded.add(i));
  readIncidentStore().forEach((incident) => {
    if (incident.status !== "Resolved" || !incident.resolvedAt) return;
    const ageMs = now - Date.parse(incident.resolvedAt);
    const dayIndex = 89 - Math.floor(ageMs / DAY_MS);
    if (dayIndex >= 0 && dayIndex < historyLength) excluded.add(dayIndex);
  });
  return [...excluded].sort((a, b) => a - b);
}

const excludedIndexes = excludedDayIndexes(90);
const excludedSet = new Set(excludedIndexes);

export const capacityResources: CapacityResource[] = RESOURCE_CONFIGS.map((config) => ({
  id: config.id,
  name: config.name,
  type: config.type,
  metric: config.metric,
  group: config.group,
  site: config.site,
  capacity: config.capacity,
  current: config.current,
  avg: config.avg,
  p95: config.p95,
  warnThreshold: 85,
  critThreshold: 90,
  growthPerWeek: config.growthPerWeek,
  leadTimeDays: config.leadTimeDays,
  unitCostRate: config.unitCostRate,
  managedBy: config.managedBy,
  linkedAssetId: config.linkedAssetId ?? null,
  linkedPoolId: config.linkedPoolId ?? null,
  history: buildHistory(config).map((point, index) => (excludedSet.has(index) ? { ...point, excluded: true } : point)),
  seed: config.seed,
  recommendedAction: config.action,
  recommendedDetail: config.detail,
  estimatedCost: config.cost,
  effort: config.effort,
}));

export const CAPACITY_EXCLUDED_DAYS = excludedIndexes.length;

export const UNIT_COST = {
  StorageTB: 23,
  StorageGB: 0.5,
  vCPU: 8,
  GBRAM: 1.1,
  GBRAMcost: 1.1,
  NetworkLink: 45,
} as const;

/* ------------------------- scenarios / plans store ------------------------ */

export interface ScenarioAdjustment { growthPct: number; addCapacity: number; addServers: number; workloadShiftPct: number; startDate: string }
export interface Scenario {
  id: string;
  name: string;
  resourceId: string | null;
  resourceName: string;
  adjustment: ScenarioAdjustment;
  resultSummary: string;
  daysGained: number;
  newExhaustionDate: string | null;
  estimatedCost: number;
  savedBy: string;
  savedAt: string;
}
export type PlanAction = "Expand storage" | "Add server" | "Right-size" | "Migrate" | "Cleanup" | "Upgrade link";
export type PlanStatus = "Proposed" | "Approved" | "In progress" | "Done" | "Rejected";

export interface PlanTimelineEntry { id: string; at: string; type: string; author: string; text: string }
export interface CapacityPlan {
  id: string;
  title: string;
  resourceId: string | null;
  resourceName: string;
  action: PlanAction;
  status: PlanStatus;
  owner: string;
  targetDate: string;
  orderByDate: string;
  estimatedCost: number;
  changeTicket: string | null;
  maintenanceWindowId: string | null;
  notes: string;
  timeline: PlanTimelineEntry[];
  createdAt: string;
}

const seedScenarios: Scenario[] = [
  { id: "SCN-1042", name: "S3 +25% churn", resourceId: "CR-POOL-S3", resourceName: "AWS S3 pool", adjustment: { growthPct: 25, addCapacity: 0, addServers: 0, workloadShiftPct: 0, startDate: dayIso(0) }, resultSummary: "+0 days gained · risk band 90–95d", daysGained: 0, newExhaustionDate: null, estimatedCost: 0, savedBy: "Ayesha Khan", savedAt: dayIso(2) },
  { id: "SCN-1041", name: "Add 5 TB to S3", resourceId: "CR-POOL-S3", resourceName: "AWS S3 pool", adjustment: { growthPct: 0, addCapacity: 5, addServers: 0, workloadShiftPct: 0, startDate: dayIso(0) }, resultSummary: "+63 days gained · exhaustion Oct 05", daysGained: 63, newExhaustionDate: dayIso(-63), estimatedCost: 115, savedBy: "Tom Becker", savedAt: dayIso(4) },
  { id: "SCN-1040", name: "Right-size fleet −30%", resourceId: null, resourceName: "Fleet (workers)", adjustment: { growthPct: -30, addCapacity: 0, addServers: 0, workloadShiftPct: 0, startDate: dayIso(0) }, resultSummary: "+118 days gained · savings $540/mo", daysGained: 118, newExhaustionDate: null, estimatedCost: -540, savedBy: "Ayesha Khan", savedAt: dayIso(9) },
];

const seedPlans: CapacityPlan[] = [
  { id: "CP-1042", title: "Expand AWS S3 pool by 10 TB", resourceId: "CR-POOL-S3", resourceName: "AWS S3 pool", action: "Expand storage", status: "Approved", owner: "Ayesha Khan", targetDate: dayIso(-20), orderByDate: dayIso(6), estimatedCost: 230, changeTicket: "CHG-2204", maintenanceWindowId: null, notes: "Pre-approved by capacity board. Apply lifecycle policy with the expansion.", timeline: [{ id: "tl-1042-1", at: dayIso(6), type: "approved", author: "Ayesha Khan", text: "Approved by capacity review board." }], createdAt: dayIso(9) },
  { id: "CP-1041", title: "Grow db-01 data volume by 250 GB", resourceId: "CR-DB-STORAGE", resourceName: "db-01 · Storage", action: "Expand storage", status: "In progress", owner: "Tom Becker", targetDate: dayIso(-9), orderByDate: dayIso(3), estimatedCost: 125, changeTicket: "CHG-2198", maintenanceWindowId: null, notes: "Online resize; verify autovacuum after growth.", timeline: [{ id: "tl-1041-1", at: dayIso(12), type: "approved", author: "Tom Becker", text: "Approved — online volume resize." }], createdAt: dayIso(15) },
  { id: "CP-1040", title: "Right-size worker-08 4 vCPU → 2 vCPU", resourceId: "CR-WORKER08-CPU", resourceName: "worker-08 · CPU", action: "Right-size", status: "Proposed", owner: "Priya Nair", targetDate: dayIso(-14), orderByDate: dayIso(9), estimatedCost: -60, changeTicket: null, maintenanceWindowId: null, notes: "30-day avg 6.1% CPU. Blue/green swap, drain first.", timeline: [], createdAt: dayIso(5) },
  { id: "CP-1039", title: "Scale Redis 64 → 96 GB", resourceId: "CR-CACHE-MEM", resourceName: "cache-01 · Memory", action: "Add server", status: "Proposed", owner: "Marcus Lee", targetDate: dayIso(-18), orderByDate: dayIso(11), estimatedCost: 170, changeTicket: "CHG-2191", maintenanceWindowId: null, notes: "Eviction rate 1.2k/s. Order memory before month end.", timeline: [], createdAt: dayIso(7) },
  { id: "CP-1038", title: "Migrate bulk backup traffic to eth1", resourceId: "CR-CORE-ETH0", resourceName: "core-switch-01 · eth0", action: "Upgrade link", status: "Approved", owner: "Network Team", targetDate: dayIso(-25), orderByDate: dayIso(1), estimatedCost: 450, changeTicket: "CHG-2180", maintenanceWindowId: null, notes: "Move backup VLAN to 10G eth1. No downtime expected.", timeline: [{ id: "tl-1038-1", at: dayIso(15), type: "approved", author: "Nina Park", text: "Approved — no downtime expected." }], createdAt: dayIso(19) },
  { id: "CP-1037", title: "Increase monitor-01 to 12 vCPU", resourceId: "CR-MON01-CPU", resourceName: "monitor-01 · CPU", action: "Add server", status: "Proposed", owner: "Sara Iqbal", targetDate: dayIso(-30), orderByDate: dayIso(14), estimatedCost: 320, changeTicket: null, maintenanceWindowId: null, notes: "Prometheus scrape latency crossing 2s p95.", timeline: [], createdAt: dayIso(11) },
];

let scenarioStore: Scenario[] = seedScenarios.map((scenario) => ({ ...scenario, adjustment: { ...scenario.adjustment } }));
let planStore: CapacityPlan[] = seedPlans.map((plan) => ({ ...plan, timeline: [...plan.timeline] }));
const dismissedRecommendations = new Set<string>();

export function readScenarios(): Scenario[] {
  return scenarioStore.map((scenario) => ({ ...scenario, adjustment: { ...scenario.adjustment } }));
}

export function readCapacityPlans(): CapacityPlan[] {
  return planStore.map((plan) => ({ ...plan, timeline: [...plan.timeline] }));
}

export function readResourceById(id: string): CapacityResource | null {
  return capacityResources.find((resource) => resource.id === id) ?? null;
}

function cloneResourceWithForecast(resource: CapacityResource) {
  return { ...resource, history: resource.history.map((point) => ({ ...point })) };
}

/** Async loader — swap for a real fetch later. Error state reachable via ?capacityError=1. */
export async function loadCapacityData(): Promise<{ resources: CapacityResource[] }> {
  const forced = typeof window !== "undefined" && window.location.search.includes("capacityError=1");
  if (forced) throw new Error("capacity-load-failed");
  await new Promise<void>((resolve) => setTimeout(resolve, 200 + Math.floor(Math.random() * 201)));
  return { resources: capacityResources.map(cloneResourceWithForecast) };
}

export function createScenario(input: Omit<Scenario, "id" | "savedAt">): Scenario {
  const scenario: Scenario = { ...input, id: `SCN-${Date.now().toString(36).toUpperCase().slice(-4)}`, savedAt: new Date().toISOString() };
  scenarioStore = [scenario, ...scenarioStore];
  logAudit({ actor: { id: "ACC-02", name: "Ayesha Khan", type: "Human", role: "Operations" }, action: "Saved capacity scenario", category: "Maintenance", resource: { type: "Scenario", id: scenario.id, name: scenario.name }, result: "Success" });
  return scenario;
}

export function createCapacityPlan(input: Omit<CapacityPlan, "id" | "timeline" | "createdAt">): CapacityPlan {
  const plan: CapacityPlan = {
    ...input,
    id: `CP-${Date.now().toString(36).toUpperCase().slice(-4)}`,
    createdAt: new Date().toISOString(),
    timeline: [{ id: `tl-${Date.now()}`, at: new Date().toISOString(), type: "created", author: "Ayesha Khan", text: `Plan proposed — order by ${input.orderByDate}.` }],
  };
  planStore = [plan, ...planStore];
  logAudit({ actor: { id: "ACC-02", name: "Ayesha Khan", type: "Human", role: "Operations" }, action: "Created capacity plan", category: "Maintenance", resource: { type: "CapacityPlan", id: plan.id, name: plan.title }, result: "Success" });
  return plan;
}

export function recordPlanDecision(id: string, status: Extract<PlanStatus, "Approved" | "Rejected">, reason: string): void {
  planStore = planStore.map((plan) => plan.id === id
    ? { ...plan, status, timeline: [...plan.timeline, { id: `tl-${Date.now()}`, at: new Date().toISOString(), type: status.toLowerCase(), author: "Ayesha Khan", text: reason || (status === "Approved" ? "Approved by capacity review." : "Rejected by capacity review.") }] }
    : plan);
  logAudit({ actor: { id: "ACC-02", name: "Ayesha Khan", type: "Human", role: "Operations" }, action: status === "Approved" ? "Approved capacity plan" : "Rejected capacity plan", category: "Maintenance", resource: { type: "CapacityPlan", id, name: id }, result: "Success", reason });
}

export function dismissRecommendation(id: string, reason: string): void {
  dismissedRecommendations.add(id);
  logAudit({ actor: { id: "ACC-02", name: "Ayesha Khan", type: "Human", role: "Operations" }, action: "Dismissed capacity recommendation", category: "Maintenance", resource: { type: "Recommendation", id, name: id }, result: "Success", reason });
}

export function restoreRecommendation(id: string): void {
  dismissedRecommendations.delete(id);
}

export function isRecommendationDismissed(id: string): boolean {
  return dismissedRecommendations.has(id);
}

const FORECAST_CHANNELS: NotificationChannel[] = ["Email", "Slack"];

/** Create an Anomaly forecast-type rule in the Alert Rules mock. */
export function createForecastAlertRule(input: { resourceName: string; metric: string; threshold: number; windowDays: number; severity: "Critical" | "Warning" | "Info" }): AlertRule {
  const nowIso = new Date().toISOString();
  const rule: AlertRule = {
    id: `RUL-${Date.now().toString(36).toUpperCase().slice(-4)}`,
    name: `Forecast: ${input.resourceName} to reach ${input.threshold}% in ${input.windowDays}d`,
    description: `Predictive alert — fires when ${input.metric} is forecast to reach ${input.threshold}% within ${input.windowDays} days. Evaluated by the capacity forecasting engine.`,
    type: "Anomaly",
    severity: input.severity,
    status: "Enabled",
    target: input.resourceName,
    targetType: "VM",
    condition: { metric: input.metric, operator: ">", value: input.threshold, unit: "%", duration: `${input.windowDays}d forecast`, evaluationInterval: "1h" },
    notifications: { channels: FORECAST_CHANNELS, recipients: ["on-call@nexus.io"], escalationMinutes: 30, repeatInterval: "6h", respectQuietHours: false },
    lastFiredAt: null,
    fired24h: 0,
    fireHistory: new Array(24).fill(0),
    metric: [],
    recentFires: [],
    audit: [{ id: `aud-${Date.now()}`, at: nowIso, epochMs: Date.now(), actor: "Ayesha Khan", action: "Created forecast rule" }],
    updatedBy: "Ayesha Khan",
    updatedAt: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    mutedUntil: null,
    tags: ["forecast", "capacity"],
  };
  ALERT_RULE_LIST.unshift(rule);
  logAudit({ actor: { id: "ACC-02", name: "Ayesha Khan", type: "Human", role: "Operations" }, action: "Created forecast alert rule", category: "Security", resource: { type: "AlertRule", id: rule.id, name: rule.name }, result: "Success" });
  return rule;
}

/* ------------------------------ derived stats ----------------------------- */

export interface ResourceForecast {
  resource: CapacityResource;
  method: "Linear" | "Seasonal";
  r2: number;
  residualStd: number;
  mape: number;
  slopePerDay: number;
  current: number;
  p95: number;
  /** Days until the value crosses the crit threshold; Infinity when flat/declining. */
  daysToCrit: number;
  exhaustionDate: string | null;
  orderByDate: string | null;
  risk: RiskLevel;
  confidence: "high" | "medium" | "low";
  /** Forecast points (history excluded) for chart rendering. */
  series: ForecastOutput;
}

const forecastCache = new Map<string, ResourceForecast>();

export function resourceForecast(resource: CapacityResource, method: ForecastMethod = "auto"): ResourceForecast {
  const key = `${resource.id}:${method}`;
  const cached = forecastCache.get(key);
  if (cached) return cached;
  const values = resource.history.filter((point) => !point.excluded).map((point) => point.value);
  const series = forecastSeries(values, 180, method);
  const days = daysToThreshold(resource.current, series.slopePerDay, resource.critThreshold);
  const confidence = confidenceLevel(values.length, series.r2);
  const exhaustion = Number.isFinite(days) ? new Date(now + days * DAY_MS).toISOString() : null;
  const orderBy = Number.isFinite(days) ? new Date(now + Math.max(0, days - resource.leadTimeDays) * DAY_MS).toISOString() : null;
  const forecast: ResourceForecast = {
    resource,
    method: series.method,
    r2: series.r2,
    residualStd: series.residualStd,
    mape: series.mape,
    slopePerDay: series.slopePerDay,
    current: resource.current,
    p95: resource.p95,
    daysToCrit: days,
    exhaustionDate: exhaustion,
    orderByDate: orderBy,
    risk: riskLevel(days),
    confidence,
    series,
  };
  forecastCache.set(key, forecast);
  return forecast;
}

/** Single-source summary — Executive Overview / other pages can consume this. */
export function getCapacitySummary() {
  const forecasts = capacityResources.map((resource) => resourceForecast(resource, "auto"));
  const atRisk = forecasts.filter((forecast) => forecast.risk === "at_risk");
  const watch = forecasts.filter((forecast) => forecast.risk === "watch");
  const healthy = forecasts.filter((forecast) => forecast.risk === "healthy");
  const overprovisioned = forecasts.filter((forecast) => forecast.resource.metric === "CPU %" && forecast.current < 20 && forecast.resource.p95 < 20);
  const withDays = forecasts.filter((forecast) => Number.isFinite(forecast.daysToCrit));
  const earliest = withDays.length ? withDays.reduce((best, forecast) => (forecast.daysToCrit < best.daysToCrit ? forecast : best)) : null;
  const headroom = Math.round(sum(forecasts.filter((forecast) => forecast.resource.metric.includes("%")).map((forecast) => 100 - forecast.p95)) / Math.max(1, forecasts.filter((forecast) => forecast.resource.metric.includes("%")).length));
  const mapeAvg = Math.round(sum(forecasts.map((forecast) => forecast.mape)) / forecasts.length);
  const growth30d = Math.round((sum(forecasts.filter((forecast) => forecast.resource.metric.includes("%")).map((forecast) => (forecast.slopePerDay * 30) / Math.max(1, forecast.current) * 100)) / Math.max(1, forecasts.filter((forecast) => forecast.resource.metric.includes("%")).length)) * 10) / 10;
  const savingsEstimate = overprovisioned.reduce((sumValue, forecast) => sumValue + Math.abs(forecast.resource.estimatedCost ?? 0), 0);
  return {
    atRisk,
    watch,
    healthy,
    total: forecasts.length,
    overprovisioned,
    earliest,
    headroom,
    mapeAvg,
    growth30d,
    savingsEstimate,
    forecasts,
  };
}

export function getCapacitySummaryFor(id: string) {
  return capacityResources.find((resource) => resource.id === id) ?? null;
}

/** Remove plans by id (used by Undo on bulk proposals). */
export function deleteCapacityPlans(ids: string[]): void {
  planStore = planStore.filter((plan) => !ids.includes(plan.id));
  logAudit({ actor: { id: "ACC-02", name: "Ayesha Khan", type: "Human", role: "Operations" }, action: "Deleted capacity plans", category: "Maintenance", resource: { type: "CapacityPlan", id: ids.join(","), name: `${ids.length} plan(s)` }, result: "Success" });
}