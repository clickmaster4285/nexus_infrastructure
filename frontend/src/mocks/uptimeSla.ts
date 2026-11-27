/**
 * Uptime & SLA Reports — mock data, single source of truth.
 * Everything on the page derives from DOWNTIME_INCIDENTS via src/lib/slaCalculations.ts.
 * Names match Events / Database Monitoring / Logs Explorer hosts. Dates are deterministic.
 */

import { uptimeFromDowntime, errorBudgetStats, statusForUptime, type BudgetStats, type SlaStatus } from "@/lib/slaCalculations";

export type ErrorBudget = BudgetStats;

export type ServiceType = "API" | "Web" | "Database" | "VM" | "Cache" | "Network";
export type IncidentSeverity = "Critical" | "Warning" | "Info";
export type IncidentStatus = "Open" | "Investigating" | "Acknowledged" | "Resolved";
export type SlaTarget = 99.0 | 99.5 | 99.9 | 99.95 | 99.99;

export interface ServiceUptime {
  id: string;
  name: string;
  type: ServiceType;
  slaTarget: number;
  currentUptime: number;
  downtimeSeconds: number;
  incidents: number;
  mttrMinutes: number;
  mtbfHours: number;
  dailyUptime: number[];
  status: SlaStatus;
}

export interface DailyUptime {
  iso: string;
  label: string;
  uptime: number;
  incidents: number;
  downtimeMinutes: number;
}

export interface DowntimeIncident {
  id: string;
  eventId: string | null;
  serviceName: string;
  startedAt: string;
  durationMinutes: number;
  severity: IncidentSeverity;
  cause: string;
  status: IncidentStatus;
}

export interface SlaSummary {
  overallUptime: number;
  slaTarget: number;
  status: SlaStatus;
  breachedCount: number;
  totalDowntimeSeconds: number;
  incidents: number;
  mttrMinutes: number;
  mtbfHours: number;
  previousUptime: number;
  statusLabel: string;
}

const WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

/* ------------------------------------------------------------------ *
 * Incidents — the ONLY source of downtime on this page.
 * ------------------------------------------------------------------ */
export const DOWNTIME_INCIDENTS: DowntimeIncident[] = [
  { id: "INC-4821", eventId: "EVT-2026-48001", serviceName: "db-01", startedAt: new Date(now - 6 * DAY_MS + 9 * 60 * 60 * 1000).toISOString(), durationMinutes: 24, severity: "Critical", cause: "Database connection lost · retry storm", status: "Resolved" },
  { id: "INC-4817", eventId: "EVT-2026-48007", serviceName: "api-server-01", startedAt: new Date(now - 12 * DAY_MS + 7 * 60 * 60 * 1000).toISOString(), durationMinutes: 12, severity: "Critical", cause: "Primary node health check failed", status: "Resolved" },
  { id: "INC-4812", eventId: "EVT-2026-48006", serviceName: "web-app-01", startedAt: new Date(now - 18 * DAY_MS + 14 * 60 * 60 * 1000).toISOString(), durationMinutes: 8, severity: "Warning", cause: "High memory usage · GC pressure", status: "Resolved" },
];

const INCIDENTS_IN_WINDOW = DOWNTIME_INCIDENTS.filter((incident) => Date.now() - Date.parse(incident.startedAt) <= WINDOW_DAYS * DAY_MS);
const DOWNTIME_MINUTES = INCIDENTS_IN_WINDOW.reduce((sum, incident) => sum + incident.durationMinutes, 0);
const INCIDENT_COUNT = INCIDENTS_IN_WINDOW.length;
const MTTR = INCIDENT_COUNT ? Math.round(DOWNTIME_MINUTES / INCIDENT_COUNT) : 0;

/* ------------------------------------------------------------------ *
 * Daily fleet series — 120 days, derived from incidents + tiny noise.
 * ------------------------------------------------------------------ */
const INCIDENT_BY_DAY_AGO: Record<number, number> = { 6: 24, 12: 12, 18: 8 };

export const FLEET_DAILY: DailyUptime[] = (() => {
  const rand = (seed: number) => {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const randRange = rand(20261113);
  const days: DailyUptime[] = [];
  for (let index = 0; index < 120; index += 1) {
    const daysAgo = 119 - index;
    const dip = INCIDENT_BY_DAY_AGO[daysAgo] ?? 0;
    const noise = (randRange() - 0.5) * 0.04;
    const uptime = Math.max(0, Math.min(100, 100 - (dip / 1440) * 100 + noise));
    const date = new Date(now - daysAgo * DAY_MS);
    days.push({
      iso: date.toISOString(),
      label: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      uptime: Number(uptime.toFixed(3)),
      incidents: dip > 0 ? 1 : 0,
      downtimeMinutes: dip,
    });
  }
  return days;
})();

/* ------------------------------------------------------------------ *
 * Services — uptime derives from incidents (matches Incidents count).
 * ------------------------------------------------------------------ */
const SERVICES_RAW = [
  { id: "api-server-01", name: "api-server-01", type: "API" as ServiceType, slaTarget: 99.9, incidents: 1, downtimeSeconds: 720, mttr: 12, mtbf: 720, seed: 11, incidentIndex: 17 },
  { id: "web-app-01", name: "web-app-01", type: "Web" as ServiceType, slaTarget: 99.95, incidents: 1, downtimeSeconds: 480, mttr: 8, mtbf: 720, seed: 22, incidentIndex: 11 },
  { id: "db-01", name: "db-01", type: "Database" as ServiceType, slaTarget: 99.99, incidents: 1, downtimeSeconds: 1440, mttr: 24, mtbf: 720, seed: 33, incidentIndex: 23 },
  { id: "app-server-02", name: "app-server-02", type: "VM" as ServiceType, slaTarget: 99.9, incidents: 0, downtimeSeconds: 0, mttr: 0, mtbf: 720, seed: 44, incidentIndex: null },
  { id: "cache-01", name: "cache-01", type: "Cache" as ServiceType, slaTarget: 99.9, incidents: 0, downtimeSeconds: 0, mttr: 0, mtbf: 720, seed: 55, incidentIndex: null },
  { id: "edge-01", name: "edge-01", type: "Network" as ServiceType, slaTarget: 99.95, incidents: 0, downtimeSeconds: 0, mttr: 0, mtbf: 720, seed: 66, incidentIndex: null },
];

/** Per-service daily uptime series — 100% minus the incident dip plus tiny noise. */
function serviceSeries(seed: number, downtimeMinutes: number, incidentIndex: number | null): number[] {
  const rand = (() => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const series: number[] = [];
  for (let index = 0; index < 30; index += 1) {
    const noise = (rand() - 0.5) * 0.04;
    const dip = incidentIndex === index ? (downtimeMinutes / 1440) * 100 : 0;
    // Keep the value positive and clamp to 100.
    const value = Math.max(0, Math.min(100, 100 - dip + noise));
    series.push(Number(value.toFixed(3)));
  }
  return series;
}

export const SLA_SERVICES: ServiceUptime[] = SERVICES_RAW.map((service) => {
  const uptime = uptimeFromDowntime(service.downtimeSeconds / 60, WINDOW_DAYS);
  const status = statusForUptime(uptime, service.slaTarget);
  const { incidentIndex, ...rest } = service;
  return {
    ...rest,
    currentUptime: Number(uptime.toFixed(3)),
    dailyUptime: serviceSeries(service.seed, service.downtimeSeconds / 60, incidentIndex),
    mttrMinutes: service.mttr,
    mtbfHours: service.mtbf,
    status,
  };
});

/* ------------------------------------------------------------------ *
 * Summary / budget — everything from incidents (single source).
 * ------------------------------------------------------------------ */
export function buildFleetSummary(target: number, days = WINDOW_DAYS): SlaSummary {
  const downtimeMinutes = DOWNTIME_MINUTES;
  const overallUptime = uptimeFromDowntime(downtimeMinutes, days);
  const services = SLA_SERVICES;
  // Worst-of status across services for the given target — breach if ANY service breaches its own target.
  const anyBreached = services.some((service) => statusForUptime(service.currentUptime, service.slaTarget) === "breached");
  const anyAtRisk = services.some((service) => statusForUptime(service.currentUptime, service.slaTarget) === "at_risk");
  const status: SlaStatus = anyBreached ? "breached" : anyAtRisk ? "at_risk" : "met";
  const breachedCount = services.filter((service) => statusForUptime(service.currentUptime, service.slaTarget) === "breached").length;
  return {
    overallUptime: Number(overallUptime.toFixed(2)),
    slaTarget: target,
    status,
    breachedCount,
    totalDowntimeSeconds: Math.round(downtimeMinutes * 60),
    incidents: INCIDENT_COUNT,
    mttrMinutes: MTTR,
    mtbfHours: INCIDENT_COUNT > 0 ? Math.round((days * 24) / INCIDENT_COUNT) : days * 24,
    previousUptime: 100,
    statusLabel: breachedCount > 0 ? `${breachedCount} service${breachedCount > 1 ? "s" : ""} breached` : anyAtRisk ? "At risk" : "All services met",
  };
}

export function buildErrorBudget(target: number, days = WINDOW_DAYS): BudgetStats {
  return errorBudgetStats(DOWNTIME_MINUTES, target, days);
}

/** SLA compliance by type — derived from the services, not hard-coded. */
export const SLA_TYPE_BREAKDOWN: Array<{ type: ServiceType; uptime: number; services: number; status: SlaStatus; downtimeMinutes: number; incidents: number }> = (() => {
  const grouped = new Map<ServiceType, ServiceUptime[]>();
  for (const service of SLA_SERVICES) grouped.set(service.type, [...(grouped.get(service.type) ?? []), service]);
  return [...grouped.entries()].map(([type, list]) => {
    const downtimeMinutes = list.reduce((sum, service) => sum + service.downtimeSeconds / 60, 0);
    const incidents = list.reduce((sum, service) => sum + service.incidents, 0);
    const uptime = uptimeFromDowntime(downtimeMinutes, WINDOW_DAYS);
    const target = Math.min(...list.map((service) => service.slaTarget));
    return { type, uptime: Number(uptime.toFixed(3)), services: list.length, status: statusForUptime(uptime, target), downtimeMinutes: Math.round(downtimeMinutes), incidents };
  }).sort((a, b) => a.uptime - b.uptime);
})();
