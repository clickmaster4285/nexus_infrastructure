"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowDownRight, ArrowRight, ArrowUp, ArrowUpRight, CheckCircle2, ChevronDown, Download, Expand, Globe, MoreVertical, Pause, Pencil,
  Play, Plus, RefreshCw, Search, ShieldCheck, TriangleAlert, XCircle,
  type LucideIcon,
} from "lucide-react";
import * as echarts from "echarts/core";
import { LineChart as ELineChart } from "echarts/charts";
import {
  AxisPointerComponent,
  GridComponent,
  MarkAreaComponent,
  TooltipComponent,
} from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MetricStat } from "@/data/mock/dashboard";
import type { NocMapSite, NocMapStatus } from "@/data/mock/noc-map";
import { cn } from "@/lib/utils";

const NocOsmMap = dynamic(
  () => import("@/components/live-operations/noc-osm-map").then((module) => module.NocOsmMap),
  { ssr: false, loading: () => <div className="grid h-full min-h-[13.75rem] animate-pulse place-items-center rounded-lg bg-slate-100 text-[0.75rem] text-slate-500 dark:bg-slate-800 dark:text-slate-400">Loading map…</div> },
);

echarts.use([
  ELineChart,
  GridComponent,
  TooltipComponent,
  MarkAreaComponent,
  AxisPointerComponent,
  LabelLayout,
  CanvasRenderer,
]);

/* ------------------------------------------------------------------ *
 * Muted palette shared with the other monitoring dashboards
 * ------------------------------------------------------------------ */

const PALETTE = {
  blue: "oklch(0.7137 0.1434 254.62)",
  green: "oklch(0.7729 0.1535 163.22)",
  purple: "oklch(0.709 0.1592 293.54)",
  amber: "oklch(0.8369 0.1644 84.43)",
  red: "oklch(0.7106 0.1661 22.22)",
  slate: "oklch(0.7107 0.0351 256.79)",
} as const;

/** Percentile of a sorted numeric list, using linear interpolation. */
function percentileOf(sorted: number[], ratio: number): number {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower));
}

/* ------------------------------------------------------------------ *
 * Data - single source of truth for every card on the page
 * ------------------------------------------------------------------ */

type MonitorStatus = "Healthy" | "Degraded" | "Down";
type MonitorKind = "Website" | "API";
type MonitorMethod = "GET" | "POST" | "PUT";

interface Monitor {
  id: string;
  endpoint: string;
  kind: MonitorKind;
  method: MonitorMethod;
  status: MonitorStatus;
  code: number | null;
  responseMs: number | null;
  p95Ms: number;
  uptime30d: number;
  lastCheck: string;
  /** Sparkline samples for the trend column. */
  values: number[];
  region: string;
  /** Why the endpoint is unhealthy - shown instead of a code / response time. */
  issueReason?: string;
}

const monitors: Monitor[] = [
  { id: "m-01", endpoint: "/api/users", kind: "API", method: "GET", status: "Healthy", code: 200, responseMs: 132, p95Ms: 168, uptime30d: 99.99, lastCheck: "30s ago", values: [9, 12, 10, 14, 11, 13, 9, 12, 10, 13], region: "Virginia" },
  { id: "m-02", endpoint: "/api/products", kind: "API", method: "GET", status: "Healthy", code: 200, responseMs: 178, p95Ms: 221, uptime30d: 99.97, lastCheck: "28s ago", values: [12, 10, 13, 11, 15, 12, 9, 12, 11, 13], region: "Virginia" },
  { id: "m-03", endpoint: "/api/orders", kind: "API", method: "GET", status: "Down", code: null, responseMs: null, p95Ms: 0, uptime30d: 0, lastCheck: "12m ago", values: [15, 15, 14, 15, 15, 8, 8, 8, 8, 8], region: "Virginia", issueReason: "Connection refused" },
  { id: "m-04", endpoint: "/api/payments", kind: "API", method: "POST", status: "Degraded", code: 200, responseMs: 845, p95Ms: 912, uptime30d: 98.2, lastCheck: "1m ago", values: [10, 12, 16, 18, 21, 19, 17, 16, 15, 14], region: "London", issueReason: "HTTP 503" },
  { id: "m-05", endpoint: "/api/notifications", kind: "API", method: "GET", status: "Healthy", code: 200, responseMs: 167, p95Ms: 205, uptime30d: 99.96, lastCheck: "35s ago", values: [10, 13, 11, 12, 9, 12, 14, 10, 13, 11], region: "Virginia" },
  { id: "m-06", endpoint: "/api/reports", kind: "API", method: "GET", status: "Healthy", code: 200, responseMs: 244, p95Ms: 302, uptime30d: 99.91, lastCheck: "41s ago", values: [14, 13, 15, 12, 14, 13, 12, 15, 14, 13], region: "Frankfurt" },
  { id: "m-07", endpoint: "/api/inventory", kind: "API", method: "GET", status: "Healthy", code: 200, responseMs: 151, p95Ms: 188, uptime30d: 99.98, lastCheck: "22s ago", values: [9, 10, 11, 10, 12, 11, 10, 9, 11, 10], region: "Virginia" },
  { id: "m-08", endpoint: "/api/cart", kind: "API", method: "POST", status: "Healthy", code: 201, responseMs: 196, p95Ms: 240, uptime30d: 99.94, lastCheck: "19s ago", values: [11, 12, 10, 13, 11, 12, 13, 11, 12, 11], region: "London" },
  { id: "m-09", endpoint: "/api/checkout", kind: "API", method: "POST", status: "Healthy", code: 200, responseMs: 274, p95Ms: 331, uptime30d: 99.89, lastCheck: "33s ago", values: [13, 12, 14, 13, 15, 14, 13, 14, 12, 13], region: "Singapore" },
  { id: "m-10", endpoint: "/api/sessions", kind: "API", method: "GET", status: "Healthy", code: 200, responseMs: 118, p95Ms: 149, uptime30d: 99.99, lastCheck: "17s ago", values: [8, 9, 10, 9, 11, 10, 9, 8, 10, 9], region: "Virginia" },
  { id: "m-11", endpoint: "/api/webhooks", kind: "API", method: "POST", status: "Healthy", code: 202, responseMs: 223, p95Ms: 268, uptime30d: 99.93, lastCheck: "26s ago", values: [12, 11, 13, 12, 14, 13, 12, 11, 13, 12], region: "Sydney" },
  { id: "m-12", endpoint: "/api/search", kind: "API", method: "GET", status: "Healthy", code: 200, responseMs: 289, p95Ms: 355, uptime30d: 99.87, lastCheck: "37s ago", values: [14, 13, 15, 14, 16, 15, 14, 13, 15, 14], region: "Frankfurt" },
  { id: "m-13", endpoint: "/api/catalog", kind: "API", method: "GET", status: "Healthy", code: 200, responseMs: 163, p95Ms: 199, uptime30d: 99.95, lastCheck: "24s ago", values: [10, 12, 11, 13, 12, 11, 12, 10, 11, 12], region: "Singapore" },
  { id: "m-14", endpoint: "/api/reviews", kind: "API", method: "POST", status: "Healthy", code: 201, responseMs: 207, p95Ms: 251, uptime30d: 99.92, lastCheck: "31s ago", values: [11, 13, 12, 14, 13, 12, 13, 11, 12, 13], region: "London" },
  { id: "m-15", endpoint: "/api/shipping", kind: "API", method: "GET", status: "Healthy", code: 200, responseMs: 186, p95Ms: 228, uptime30d: 99.96, lastCheck: "29s ago", values: [10, 11, 12, 11, 13, 12, 11, 12, 10, 11], region: "Frankfurt" },
  { id: "m-16", endpoint: "/api/pricing", kind: "API", method: "GET", status: "Healthy", code: 200, responseMs: 142, p95Ms: 177, uptime30d: 99.98, lastCheck: "20s ago", values: [9, 10, 11, 10, 12, 11, 10, 11, 9, 10], region: "Virginia" },
  { id: "m-17", endpoint: "/api/analytics", kind: "API", method: "GET", status: "Healthy", code: 200, responseMs: 258, p95Ms: 314, uptime30d: 99.9, lastCheck: "39s ago", values: [13, 12, 14, 13, 15, 14, 13, 14, 12, 13], region: "Sydney" },
  { id: "m-18", endpoint: "www.example.com", kind: "Website", method: "GET", status: "Healthy", code: 200, responseMs: 126, p95Ms: 158, uptime30d: 99.97, lastCheck: "15s ago", values: [9, 10, 9, 11, 10, 11, 10, 9, 10, 9], region: "Virginia" },
  { id: "m-19", endpoint: "api.example.com", kind: "Website", method: "GET", status: "Healthy", code: 200, responseMs: 174, p95Ms: 214, uptime30d: 99.95, lastCheck: "18s ago", values: [11, 12, 11, 13, 12, 11, 12, 11, 12, 11], region: "Singapore" },
  { id: "m-20", endpoint: "status.example.com", kind: "Website", method: "GET", status: "Healthy", code: 200, responseMs: 158, p95Ms: 193, uptime30d: 99.99, lastCheck: "12s ago", values: [9, 9, 10, 10, 11, 10, 10, 9, 10, 10], region: "Frankfurt" },
  { id: "m-21", endpoint: "shop.example.com", kind: "Website", method: "GET", status: "Healthy", code: 200, responseMs: 236, p95Ms: 288, uptime30d: 99.88, lastCheck: "27s ago", values: [13, 12, 14, 13, 15, 14, 13, 12, 14, 13], region: "Sydney" },
  { id: "m-22", endpoint: "docs.example.com", kind: "Website", method: "GET", status: "Healthy", code: 200, responseMs: 195, p95Ms: 236, uptime30d: 99.94, lastCheck: "23s ago", values: [11, 12, 13, 12, 14, 13, 12, 13, 11, 12], region: "London" },
  { id: "m-23", endpoint: "/api/audit", kind: "API", method: "GET", status: "Healthy", code: 200, responseMs: 148, p95Ms: 183, uptime30d: 99.96, lastCheck: "21s ago", values: [10, 11, 10, 12, 11, 12, 11, 10, 11, 12], region: "Virginia" },
  { id: "m-24", endpoint: "/api/flags", kind: "API", method: "GET", status: "Healthy", code: 200, responseMs: 112, p95Ms: 141, uptime30d: 99.99, lastCheck: "16s ago", values: [8, 9, 9, 10, 9, 10, 9, 9, 10, 9], region: "Frankfurt" },
];

/* ---------------- Incidents - single source for card, chart and banner ---------------- */

type IncidentStatus = "Down" | "Degraded";
type IncidentSeverity = "Critical" | "Warning";

interface Incident {
  id: string;
  endpoint: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  /** Time slot on the performance chart where the incident starts. */
  chartTime: string;
  region: string;
  /** Timestamp the incident started - used for the live duration. */
  startedAt: number;
}

/** Timestamp for a fixed wall-clock time today - keeps incident times stable. */
function todayAt(hour: number, minute: number): number {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

const incidents: Incident[] = [
  { id: "inc-01", endpoint: "/api/orders", status: "Down", severity: "Critical", chartTime: "12:00", region: "Virginia", startedAt: todayAt(12, 32) },
  { id: "inc-02", endpoint: "/api/payments", status: "Degraded", severity: "Warning", chartTime: "20:00", region: "London", startedAt: todayAt(10, 20) },
];

interface ResolvedIncident {
  id: string;
  endpoint: string;
  /** Minutes the incident took to resolve. */
  resolvedInMinutes: number;
}

const resolvedIncidents: ResolvedIncident[] = [
  { id: "res-01", endpoint: "/api/products", resolvedInMinutes: 14 },
  { id: "res-02", endpoint: "/api/auth", resolvedInMinutes: 9 },
  { id: "res-03", endpoint: "/api/search", resolvedInMinutes: 22 },
];

/** Mean time to resolve across today's resolved incidents. */
const mttrMinutes = Math.round(resolvedIncidents.reduce((sum, item) => sum + item.resolvedInMinutes, 0) / resolvedIncidents.length);

/** Incident totals - the stat card and the banner read from here. */
const openIncidents = incidents;
const issueCount = openIncidents.length;
const downIncident = openIncidents.find((incident) => incident.status === "Down");
const degradedIncident = openIncidents.find((incident) => incident.status === "Degraded");

/** Finds the active incident for an endpoint, if there is one. */
function incidentFor(endpoint: string): Incident | undefined {
  return openIncidents.find((incident) => incident.endpoint === endpoint);
}

/** Formats a timestamp as a 12-hour clock time. */
function formatSince(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Formats a duration as "3h 12m" or "45m". */
function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** Formats the expiry date of a certificate, e.g. "Nov 22, 2026". */
function formatExpiry(daysLeft: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysLeft);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Colour used for an incident marker on the chart. */
function incidentColor(incident: Incident): string {
  return incident.status === "Down" ? PALETTE.red : PALETTE.amber;
}

/* ---------------- Monitor totals ---------------- */

const totalMonitors = monitors.length;
const healthyMonitors = monitors.filter((monitor) => monitor.status === "Healthy").length;

/* ---------------- Performance series ---------------- */

const performanceTimes = ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00"];
const performance = performanceTimes.map((time, index) => ({
  time,
  response: [186, 200, 215, 203, 223, 213, 232, 218, 245, 209, 197, 215, 198][index],
  availability: [98.6, 98.8, 99.1, 98.7, 99.3, 99.2, 99.4, 99.1, 99.8, 99.2, 98.9, 99.1, 99.3][index],
}));

/** Response time percentiles - the single source used by the chart and the chips. */
const sortedResponses = performance.map((point) => point.response).sort((a, b) => a - b);
const responsePercentiles = {
  p50: percentileOf(sortedResponses, 0.5),
  p95: percentileOf(sortedResponses, 0.95),
  p99: percentileOf(sortedResponses, 0.99),
};

/** P95 of the response time series, shared by the chart and the tiles. */
const P95_RESPONSE_MS = responsePercentiles.p95;

/** Availability - the single source for the Uptime card, the chart chip and the tile. */
const avgAvailability = performance.reduce((sum, point) => sum + point.availability, 0) / performance.length;
const latestAvailability = performance[performance.length - 1].availability;

/** Average response time - shared by the stat card and the summary tile. */
const avgResponseTime = performance.reduce((sum, point) => sum + point.response, 0) / performance.length;

/** Vertical bands marking where each incident started - kept very light. */
const incidentAreas = incidents.map((incident) => {
  const index = performanceTimes.indexOf(incident.chartTime);
  const end = performanceTimes[Math.min(index + 1, performanceTimes.length - 1)];
  return [
    { xAxis: incident.chartTime, itemStyle: { color: `${incidentColor(incident)}0F` } },
    { xAxis: end },
  ] as [{ xAxis: string; itemStyle?: { color: string } }, { xAxis: string }];
});

/** Thin vertical marker + label pill drawn at the start of each incident. */
const incidentMarkers = incidents.map((incident) => ({
  xAxis: incident.chartTime,
  label: {
    show: true,
    formatter: `${incident.status === "Down" ? "API Down" : "Degraded"} ${formatSince(incident.startedAt)}`,
    color: incidentColor(incident),
    fontSize: 12,
    backgroundColor: "var(--popover)",
    borderColor: incidentColor(incident),
    borderWidth: 1,
    borderRadius: 8,
    padding: [2, 6],
    position: "insideEndTop" as const,
  },
}));

/** Availability colour rule used by every gauge and bar on this page: >=99.5 green, 99-99.5 amber, below 99 red. */
function availabilityTone(value: number): string {
  if (value >= 99.5) return PALETTE.green;
  if (value >= 99) return PALETTE.amber;
  return PALETTE.red;
}

const serviceHealth = [
  { label: "Web Apps", value: 99.2 },
  { label: "APIs", value: 98.4 },
  { label: "Databases", value: 99.6 },
  { label: "Infrastructure", value: 99.8 },
  { label: "CDN", value: 99.7 },
  { label: "Payments", value: 99.1 },
];

const topServices = [
  { name: "Web API", value: 99.94, issue: undefined as string | undefined },
  { name: "User Service", value: 99.86, issue: undefined as string | undefined },
  { name: "Database", value: 99.71, issue: undefined as string | undefined },
  { name: "CDN Edge", value: 99.97, issue: undefined as string | undefined },
  { name: "Notification API", value: 99.42, issue: "3 failed checks in 24h" },
  { name: "Payment API", value: 99.28, issue: "7 failed checks in 24h" },
  { name: "Search API", value: 98.95, issue: "12 failed checks in 24h" },
  { name: "Auth Service", value: 99.91, issue: undefined as string | undefined },
  { name: "Email Service", value: 99.78, issue: undefined as string | undefined },
  { name: "Storage", value: 99.63, issue: undefined as string | undefined },
  { name: "Inventory API", value: 99.38, issue: "5 failed checks in 24h" },
];

interface Region {
  name: string;
  /** Latency in ms for the region. */
  latencyMs: number;
  /** Geographic coordinates used by the shared map. */
  lat: number;
  lng: number;
}

const regions: Region[] = [
  { name: "Virginia", latencyMs: 42, lat: 38.0, lng: -77.5 },
  { name: "London", latencyMs: 58, lat: 51.51, lng: -0.13 },
  { name: "Frankfurt", latencyMs: 64, lat: 50.11, lng: 8.68 },
  { name: "Singapore", latencyMs: 91, lat: 1.35, lng: 103.82 },
  { name: "Sydney", latencyMs: 118, lat: -33.87, lng: 151.21 },
];

/** Region state derived from the monitors it hosts. */
/**
 * Region state - driven by the active incidents so a location hosting an
 * incident is never shown as healthy.
 */
function regionState(region: Region): "online" | "warning" | "offline" {
  const scoped = incidents.filter((incident) => incident.region === region.name);
  if (scoped.some((incident) => incident.status === "Down")) return "offline";
  if (scoped.some((incident) => incident.status === "Degraded")) return "warning";
  return "online";
}

const regionStates = regions.map((region) => ({ ...region, state: regionState(region) }));

/** Islamabad (NEXUS DC-2) — map opens here at street level, like Global Health. */
const ISLAMABAD_SITE: NocMapSite = {
  id: "islamabad",
  code: "ISL",
  city: "Islamabad",
  country: "Pakistan",
  region: "South Asia",
  provider: "—",
  facility: "NEXUS DC-2",
  lat: 33.69,
  lng: 73.06,
  status: "online",
  health: 99.7,
  throughput: "—",
  alerts: 0,
  uptime: "99.99%",
  lastCheck: "just now",
  servers: [],
};

/** Shared NOC map sites - status comes from the active incidents, health reflects region state. Same reusable component as Global Health. */
const availabilitySites: NocMapSite[] = [
  ...regionStates.map((region): NocMapSite => {
  const status: NocMapStatus = region.state === "offline" ? "critical" : region.state === "warning" ? "warning" : "online";
  const health = region.state === "offline" ? 96.2 : region.state === "warning" ? 98.4 : 99.9;
  return {
    id: `region-${region.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    code: region.name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3),
    city: region.name,
    country: region.name,
    region: `${region.latencyMs}ms latency`,
    provider: "—",
    facility: "—",
    lat: region.lat,
    lng: region.lng,
    status,
    health,
    throughput: `${region.latencyMs}ms latency`,
    alerts: status === "critical" ? 3 : status === "warning" ? 1 : 0,
    uptime: "—",
    lastCheck: "just now",
    servers: [],
  };
  }),
  ISLAMABAD_SITE,
];

/* ---------------- Events ---------------- */

/** Builds a timestamp for a fixed wall-clock time today. */
function eventTime(hour: number, minute: number): number {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

interface MonitoringEvent {
  /** Timestamp - events are sorted by it, newest first. */
  at: number;
  type: string;
  message: string;
  status: "Open" | "Resolved" | "Investigating" | "Info";
}

/** Feed of monitoring events - open incidents are injected from the incident source. */
const monitoringEvents: MonitoringEvent[] = [
  { at: eventTime(11, 45), type: "Recovery", message: "/api/orders is back online", status: "Resolved" },
  { at: eventTime(9, 50), type: "New Monitor", message: "Added new endpoint /api/reports", status: "Info" },
  { at: eventTime(9, 12), type: "SSL Renewal", message: "Certificate for www.example.com renewed", status: "Resolved" },
  { at: eventTime(8, 35), type: "Deploy", message: "Released v2.14.2 across production", status: "Info" },
  { at: eventTime(7, 58), type: "Threshold Update", message: "/api/search latency threshold set to 800ms", status: "Info" },
];

/** Total events recorded today - used by the Recent Events footer. */
const TOTAL_EVENTS = 31;

/**
 * Events feed shown in Recent Events - open incidents are injected from the
 * incident source so the timestamps match the banner and the incidents card.
 */
const sortedEvents = [
  ...openIncidents.map((incident) => ({
    key: `open-${incident.id}`,
    at: incident.startedAt,
    time: formatSince(incident.startedAt),
    message: incident.status === "Down"
      ? `API Down: ${incident.endpoint} down since ${formatSince(incident.startedAt)}`
      : `High Latency: ${incident.endpoint} since ${formatSince(incident.startedAt)}`,
    status: "Open" as const,
  })),
  ...monitoringEvents.map((event) => ({
    key: `event-${event.at}-${event.type}`,
    at: event.at,
    time: formatSince(event.at),
    message: event.message,
    status: event.status,
  })),
].sort((a, b) => b.at - a.at);

/** Response time buckets - percentages add up to 100. */
const responseDistribution = [
  { label: "< 100ms", value: 38, color: PALETTE.blue },
  { label: "100-300ms", value: 27, color: PALETTE.green },
  { label: "300-500ms", value: 20, color: PALETTE.purple },
  { label: "> 500ms", value: 15, color: PALETTE.amber },
];

interface SslCertificate {
  domain: string;
  daysLeft: number;
  /** Whether the certificate renews automatically. */
  autoRenew: boolean;
}

const sslCertificates: SslCertificate[] = [
  { domain: "api.example.com", daysLeft: 12, autoRenew: true },
  { domain: "www.example.com", daysLeft: 74, autoRenew: true },
  { domain: "shop.example.com", daysLeft: 26, autoRenew: false },
  { domain: "status.example.com", daysLeft: 121, autoRenew: true },
  { domain: "docs.example.com", daysLeft: 38, autoRenew: true },
];

/** Certificates sorted by expiry - the soonest to expire first. */
const sortedSslCertificates = [...sslCertificates].sort((a, b) => a.daysLeft - b.daysLeft);

/* ------------------------------------------------------------------ *
 * Worked targets and yesterday-deltas per phase (ms). Avg within target →
 * green tone, above → amber. Percentages are derived from the averages.
 * ------------------------------------------------------------------ */
interface BreakdownPhase {
  label: string;
  /** Average phase time in ms. */
  avg: number;
  /** P95 phase time in ms. */
  p95: number;
  /** Phase target in ms (DNS < 20, Connect < 50, TLS < 60, TTFB < 80). */
  target: number;
  color: string;
  /** Change vs yesterday in ms. Negative = improved (green), positive = regressed (red). */
  deltaMs: number;
}

const breakdownAll: BreakdownPhase[] = [
  { label: "DNS", avg: 18, p95: 32, target: 20, color: PALETTE.blue, deltaMs: -2 },
  { label: "Connect", avg: 42, p95: 71, target: 50, color: PALETTE.green, deltaMs: 12 },
  { label: "TLS", avg: 56, p95: 98, target: 60, color: PALETTE.purple, deltaMs: -1 },
  { label: "TTFB", avg: 96, p95: 188, target: 80, color: PALETTE.amber, deltaMs: 9 },
];

/** Per-endpoint response breakdown - the selector switches between them. */
const responseBreakdownByEndpoint: Record<string, BreakdownPhase[]> = {
  all: breakdownAll,
  "/api/payments": [
    { label: "DNS", avg: 26, p95: 44, target: 20, color: PALETTE.blue, deltaMs: 3 },
    { label: "Connect", avg: 58, p95: 96, target: 50, color: PALETTE.green, deltaMs: 15 },
    { label: "TLS", avg: 74, p95: 118, target: 60, color: PALETTE.purple, deltaMs: 6 },
    { label: "TTFB", avg: 110, p95: 214, target: 80, color: PALETTE.amber, deltaMs: 14 },
  ],
  "/api/orders": [
    { label: "DNS", avg: 12, p95: 21, target: 20, color: PALETTE.blue, deltaMs: -1 },
    { label: "Connect", avg: 28, p95: 47, target: 50, color: PALETTE.green, deltaMs: 4 },
    { label: "TLS", avg: 34, p95: 55, target: 60, color: PALETTE.purple, deltaMs: -2 },
    { label: "TTFB", avg: 22, p95: 38, target: 80, color: PALETTE.amber, deltaMs: -6 },
  ],
  "/api/users": [
    { label: "DNS", avg: 9, p95: 16, target: 20, color: PALETTE.blue, deltaMs: -1 },
    { label: "Connect", avg: 21, p95: 36, target: 50, color: PALETTE.green, deltaMs: 3 },
    { label: "TLS", avg: 31, p95: 52, target: 60, color: PALETTE.purple, deltaMs: -2 },
    { label: "TTFB", avg: 71, p95: 141, target: 80, color: PALETTE.amber, deltaMs: 11 },
  ],
};

/** P95 response time per breakdown selection - shown as a chip next to the total. */
const breakdownP95: Record<string, number> = { all: 389, "/api/payments": 512, "/api/orders": 214, "/api/users": 356 };

/** Global slowest endpoint - independent of the breakdown selection. */
const slowestEndpoint = { endpoint: "/api/payments", phase: "TTFB", value: 312 };

/** Endpoints offered by the response breakdown selector. */
const breakdownEndpoints = ["all", "/api/payments", "/api/orders", "/api/users"];

/* ------------------------------------------------------------------ *
 * Theme resolution - ECharts renders on canvas and cannot read CSS vars
 * ------------------------------------------------------------------ */

interface ChartTheme {
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  card: string;
  popover: string;
  popoverForeground: string;
  /** Axis label colour - slightly brighter in dark mode. */
  axisLabel: string;
  dark: boolean;
}

const FALLBACK_THEME: ChartTheme = {
  foreground: "oklch(0.2595 0.0482 258.68)",
  muted: "oklch(0.9598 0.0091 258.34)",
  mutedForeground: "oklch(0.6001 0.0389 260.33)",
  border: "oklch(0.9318 0.0126 255.51)",
  card: "oklch(1 0 89.88)",
  popover: "oklch(1 0 89.88)",
  popoverForeground: "oklch(0.2595 0.0482 258.68)",
  axisLabel: "oklch(0.5544 0.0407 257.42)",
  dark: false,
};

function readChartTheme(scope: Element | null): ChartTheme {
  if (!scope) return FALLBACK_THEME;
  const styles = getComputedStyle(scope);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  const dark = scope.classList.contains("dark");
  return {
    foreground: read("--foreground", FALLBACK_THEME.foreground),
    muted: read("--muted", FALLBACK_THEME.muted),
    mutedForeground: read("--muted-foreground", FALLBACK_THEME.mutedForeground),
    border: read("--border", FALLBACK_THEME.border),
    card: read("--card", FALLBACK_THEME.card),
    popover: read("--popover", FALLBACK_THEME.popover),
    popoverForeground: read("--popover-foreground", FALLBACK_THEME.popoverForeground),
    axisLabel: dark ? "oklch(0.7107 0.0351 256.79)" : "oklch(0.5544 0.0407 257.42)",
    dark,
  };
}

function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(FALLBACK_THEME);

  useEffect(() => {
    const scope = document.body.firstElementChild;
    const resolve = () => {
      const next = readChartTheme(scope);
      setTheme((current) => (current.foreground === next.foreground && current.border === next.border && current.dark === next.dark ? current : next));
    };
    resolve();
    if (!scope) return;
    const observer = new MutationObserver(resolve);
    observer.observe(scope, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

/* ------------------------------------------------------------------ *
 * Shared primitives
 * ------------------------------------------------------------------ */

function tooltipCard(theme: ChartTheme, title: string, rows: { name: string; value: string; color: string }[]) {
  const body = rows
    .map((row) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:1.25rem;line-height:1.1875rem"><span style="display:flex;align-items:center;gap:0.375rem;color:${theme.mutedForeground}"><i style="width:0.5rem;height:0.5rem;border-radius:50%;background:${row.color};display:inline-block"></i>${row.name}</span><b style="font-variant-numeric:tabular-nums;color:${theme.foreground}">${row.value}</b></div>`)
    .join("");
  return `<div style="min-width:11rem;border-radius:0.5rem;border:0.0625rem solid ${theme.border};background:${theme.popover};box-shadow:0 0.5rem 1.5rem oklch(0.2447 0.0544 259.66 / 0.16);padding:0.5rem 0.75rem;font-size:0.75rem;color:${theme.popoverForeground}"><div style="font-weight:600;margin-bottom:0.375rem">${title}</div>${body}</div>`;
}

/** ECharts wrapper - initialises only once the container has a real size. */
function EChart({ option, className }: { option: EChartsOption; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const optionRef = useRef(option);
  optionRef.current = option;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let chart: echarts.ECharts | null = null;

    const observer = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      if (!chart) {
        chart = echarts.init(container, undefined, { renderer: "canvas" });
        chartRef.current = chart;
        chart.setOption(optionRef.current, true);
      } else {
        chart.resize();
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={containerRef} className={className} />;
}

/** Status pill with an icon so colour is never the only signal. */
const statusStyles: Record<MonitorStatus, { icon: LucideIcon; className: string }> = {
  Healthy: { icon: ShieldCheck, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  Degraded: { icon: TriangleAlert, className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  Down: { icon: XCircle, className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
};

function StatusBadge({ status }: { status: MonitorStatus }) {
  const { icon: Icon, className } = statusStyles[status];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.75rem] font-semibold", className)}>
      <Icon size={11} aria-hidden="true" />
      {status}
    </span>
  );
}

/** HTTP method chip. */
const methodStyles: Record<MonitorMethod, string> = {
  GET: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  POST: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  PUT: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

function MethodBadge({ method }: { method: MonitorMethod }) {
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[0.75rem] font-semibold uppercase", methodStyles[method])}>
      {method}
    </span>
  );
}

/** Response time colour by threshold. */
function responseTone(value: number | null): string {
  if (value === null) return "text-muted-foreground";
  if (value < 200) return "text-emerald-600";
  if (value <= 500) return "text-amber-600";
  return "text-rose-600";
}

/** Inline sparkline for the trend column. */
function Sparkline({ values, down = false }: { values: number[]; down?: boolean }) {
  const width = 60;
  const height = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color = down ? PALETTE.red : PALETTE.green;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-5 w-[3.75rem]" role="img" aria-label="Recent trend">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Circular availability gauge. Ring colour follows availabilityTone. */
function HealthGauge({ label, value }: { label: string; value: number }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const color = availabilityTone(value);
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" role="img" aria-label={`${label} availability ${value}%`}>
          <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--muted)" strokeWidth="7" />
          <circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-display text-[0.8125rem] font-extrabold text-foreground">{value}%</div>
      </div>
      <span className="truncate text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}

/** Direction of a change that counts as an improvement for a metric. */
type GoodDirection = "up" | "down";

/** Summary tile config - the arrow and colour follow the metric's good direction. */
interface SummaryTileConfig {
  label: string;
  value: string;
  trend: string;
  /** Whether the trend value is rising or falling. */
  change: "up" | "down";
  /** Which direction is good for this metric. */
  good: GoodDirection;
}

/** Summary tile with a value and a metric-aware trend indicator. */
function SummaryTile({ label, value, trend, change, good }: SummaryTileConfig) {
  const improving = change === good;
  return (
    <div className="rounded-lg bg-[oklch(0.9819_0.0029_264.54)] px-3 py-2 dark:bg-[oklch(0.2863_0.0439_256.9)]">
      <p className="text-[0.75rem] text-muted-foreground">{label}</p>
      <p className="font-display text-[1rem] font-bold leading-tight text-foreground">{value}</p>
      <p className={cn("mt-0.5 flex items-center gap-0.5 text-[0.75rem]", improving ? "text-emerald-600" : "text-rose-600")}>
        {change === "up" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
        {trend}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Response time distribution chart (ECharts)
 * ------------------------------------------------------------------ */

function ResponseDistributionChart({ theme }: { theme: ChartTheme }) {
  const option = useMemo<EChartsOption>(() => ({
    animationDuration: 600,
    grid: { top: 26, right: 16, bottom: 24, left: 40 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" as const },
      backgroundColor: theme.popover,
      borderColor: theme.border,
      borderWidth: 1,
      padding: 0,
      textStyle: { color: theme.popoverForeground, fontSize: 12 },
      formatter: (params: unknown) => {
        const items = params as { axisValue: string; value: number; color: string }[];
        if (!items?.length) return "";
        return tooltipCard(theme, items[0].axisValue, [{ name: "Share", value: `${items[0].value}%`, color: items[0].color }]);
      },
    },
    xAxis: {
      type: "category",
      data: responseDistribution.map((bucket) => bucket.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: theme.axisLabel, fontSize: 12 },
    },
    yAxis: {
      type: "value",
      max: 50,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: theme.axisLabel, fontSize: 12, formatter: (value: number) => `${value}%` },
      splitLine: { lineStyle: { color: theme.border, type: "dashed" as const, width: 1 } },
    },
    series: [{
      name: "Share",
      type: "bar",
      barMaxWidth: 46,
      data: responseDistribution.map((bucket) => ({
        value: bucket.value,
        itemStyle: { color: bucket.color, borderRadius: [4, 4, 0, 0] },
      })),
      label: { show: true, position: "top" as const, formatter: "{c}%", color: theme.foreground, fontSize: 12 },
    }],
  }), [theme]);

  return (
    <div className="relative min-h-[13.75rem] min-w-0 flex-1">
      <EChart option={option} className="absolute inset-0" />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Performance chart (ECharts)
 * ------------------------------------------------------------------ */

function PerformanceChart({ theme, hidden, onToggle }: {
  theme: ChartTheme;
  hidden: string[];
  onToggle: (key: string) => void;
}) {
  const showResponse = !hidden.includes("response");
  const showAvailability = !hidden.includes("availability");
  const showP95 = !hidden.includes("p95");

  const option = useMemo<EChartsOption>(() => {
    const axisBase = {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: theme.axisLabel, fontSize: 12 },
      splitLine: { lineStyle: { color: theme.border, type: "dashed" as const, width: 1 } },
    };
    const responseValues = performance.map((point) => point.response);
    const responseMax = Math.max(...responseValues);
    const responseMin = Math.min(...responseValues);
    // Start the axis near the data so the lines use the full chart height.
    const responseFloor = Math.max(0, Math.floor((responseMin - (responseMax - responseMin) * 0.35) / 10) * 10);
    const responseCeil = Math.ceil((responseMax + (responseMax - responseMin) * 0.25) / 10) * 10;
    const zoomed = responseFloor > 0;
    return {
      animationDuration: 600,
      grid: { top: 18, right: 16, bottom: 24, left: 44 },
      tooltip: {
        trigger: "axis",
        confine: true,
        axisPointer: { type: "line" as const, lineStyle: { color: theme.mutedForeground, type: "dashed" as const, width: 1 }, label: { show: false } },
        backgroundColor: theme.popover,
        borderColor: theme.border,
        borderWidth: 1,
        padding: 0,
        textStyle: { color: theme.popoverForeground, fontSize: 12 },
        formatter: (params: unknown) => {
          const items = params as { axisValue: string; seriesName: string; value: number; color: string }[];
          if (!items?.length) return "";
          const rows = items.map((item) => ({
            name: item.seriesName,
            value: item.seriesName === "Response Time" ? `${item.value} ms` : item.seriesName === "P95" ? `${item.value} ms` : `${item.value}%`,
            color: item.color,
          }));
          const incident = incidents.find((entry) => entry.chartTime === items[0].axisValue);
          if (incident) {
            rows.push({
              name: `${incident.status === "Down" ? "API Down" : "Degraded"}: ${incident.endpoint}`,
              value: formatSince(incident.startedAt),
              color: incidentColor(incident),
            });
          }
          return tooltipCard(theme, items[0].axisValue, rows);
        },
      },
      xAxis: {
        type: "category",
        data: performanceTimes,
        ...axisBase,
        splitLine: { show: false },
        axisLabel: { ...axisBase.axisLabel, interval: Math.max(0, Math.ceil(performanceTimes.length / 6) - 1) },
      },
      yAxis: [
        {
          type: "value",
          name: zoomed ? "ms · zoomed" : "ms",
          nameTextStyle: { color: theme.axisLabel, fontSize: 12, align: "right" },
          min: responseFloor,
          max: responseCeil,
          scale: true,
          ...axisBase,
          axisLabel: { ...axisBase.axisLabel, formatter: (value: number) => String(value) },
        },
        { type: "value", name: "%", nameTextStyle: { color: theme.axisLabel, fontSize: 12 }, min: 90, max: 100, interval: 2.5, ...axisBase, splitLine: { show: false }, axisLabel: { ...axisBase.axisLabel, formatter: (value: number) => `${value}%` } },
      ],
      series: [
        ...(showResponse ? [{
          name: "Response Time",
          type: "line" as const,
          yAxisIndex: 0,
          smooth: 0.3,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: false,
          data: performance.map((point) => point.response),
          lineStyle: { width: 2, color: PALETTE.blue },
          itemStyle: { color: PALETTE.blue },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${PALETTE.blue}40` },
              { offset: 1, color: `${PALETTE.blue}00` },
            ]),
          },
          markArea: incidentAreas.length ? { silent: true, data: incidentAreas } : undefined,
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: theme.mutedForeground, type: "dashed" as const, width: 1 },
            data: incidentMarkers,
          },
        }] : []),
        ...(showP95 ? [{
          name: "P95",
          type: "line" as const,
          yAxisIndex: 0,
          smooth: 0,
          symbol: "none",
          data: performance.map(() => P95_RESPONSE_MS),
          lineStyle: { width: 1.5, color: `${PALETTE.purple}99`, type: "dotted" as const },
          itemStyle: { color: PALETTE.purple },
        }] : []),
        ...(showAvailability ? [{
          name: "Availability",
          type: "line" as const,
          yAxisIndex: 1,
          smooth: 0.3,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: false,
          data: performance.map((point) => point.availability),
          lineStyle: { width: 2, color: PALETTE.green },
          itemStyle: { color: PALETTE.green },
        }] : []),
      ],
    };
  }, [theme, showResponse, showAvailability, showP95]);

  const latest = performance[performance.length - 1];

  const chips = [
    { key: "response", name: "Response Time", color: PALETTE.blue, value: `Now ${latest.response} ms` },
    { key: "availability", name: "Availability", color: PALETTE.green, value: `Now ${latestAvailability}%` },
    { key: "p95", name: "P95", color: `${PALETTE.purple}99`, value: `${P95_RESPONSE_MS} ms` },
  ];

  /** Summary tiles - arrow and colour follow each metric's good direction. */
  const summaryTiles: SummaryTileConfig[] = [
    { label: "Avg Response", value: `${Math.round(avgResponseTime)} ms`, trend: "2.1% vs yesterday", change: "down", good: "down" },
    { label: "P95", value: `${responsePercentiles.p95} ms`, trend: "4.2% vs yesterday", change: "down", good: "down" },
    { label: "Avg Availability", value: `${avgAvailability.toFixed(2)}%`, trend: "0.2% vs yesterday", change: "up", good: "up" },
    { label: "Incidents", value: String(issueCount), trend: issueCount ? "1 new today" : "none today", change: issueCount ? "up" : "down", good: "down" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => {
          const enabled = !hidden.includes(chip.key);
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onToggle(chip.key)}
              aria-pressed={enabled}
              title={enabled ? `Hide ${chip.name}` : `Show ${chip.name}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.75rem] font-medium transition-colors",
                enabled ? "border-border bg-background text-foreground" : "border-transparent bg-muted text-muted-foreground line-through",
              )}
            >
              <i aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: enabled ? chip.color : PALETTE.slate }} />
              {chip.name} &middot; <b className="tabular-nums">{chip.value}</b>
            </button>
          );
        })}
      </div>

      <div className="relative min-h-[16.25rem] min-w-0 flex-1">
        <EChart option={option} className="absolute inset-0" />
      </div>

      <div className="grid grid-cols-4 gap-3 border-t border-border pt-2">
        {summaryTiles.map((tile) => <SummaryTile key={tile.label} {...tile} />)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Active incidents card
 * ------------------------------------------------------------------ */

type IncidentFilter = "All" | IncidentStatus;

function IncidentStatusBadge({ incident, acknowledged }: { incident: Incident; acknowledged: boolean }) {
  if (acknowledged) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[0.75rem] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <CheckCircle2 size={11} aria-hidden="true" />Acknowledged
      </span>
    );
  }
  const Icon = incident.status === "Down" ? XCircle : TriangleAlert;
  const className = incident.status === "Down"
    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.75rem] font-semibold", className)}>
      <Icon size={11} aria-hidden="true" />
      {incident.status}
    </span>
  );
}

/** Severity shown as a small dot + text next to the region. */
function SeverityDot({ severity }: { severity: IncidentSeverity }) {
  const color = severity === "Critical" ? PALETTE.red : PALETTE.amber;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[0.75rem] text-muted-foreground">
      <i aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {severity}
    </span>
  );
}

function ActiveIncidentsCard({ now, acknowledged, onAcknowledge, onView }: {
  now: number;
  acknowledged: string[];
  onAcknowledge: (id: string) => void;
  onView: (incident: Incident) => void;
}) {
  const [filter, setFilter] = useState<IncidentFilter>("All");
  const visible = filter === "All" ? openIncidents : openIncidents.filter((incident) => incident.status === filter);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex items-center rounded-md border border-border p-0.5" aria-label="Incident filter">
          {(["All", "Down", "Degraded"] as IncidentFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              aria-pressed={filter === item}
              className={cn("rounded px-2 py-1 text-[0.75rem] font-semibold transition-colors", filter === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {visible.map((incident) => {
          const isAcknowledged = acknowledged.includes(incident.id);
          const duration = formatDuration(now - incident.startedAt);
          return (
            <div key={incident.id} className="flex shrink-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[0.75rem] font-semibold text-foreground">{incident.endpoint}</p>
                <IncidentStatusBadge incident={incident} acknowledged={isAcknowledged} />
              </div>
              <p className="text-[0.75rem] text-muted-foreground">
                {incident.status === "Down" ? "Down" : "Degraded"} since {formatSince(incident.startedAt)} &middot; {duration}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
                  <Globe size={11} aria-hidden="true" />
                  {incident.region}
                </span>
                <SeverityDot severity={incident.severity} />
              </div>
              <div className="flex items-center gap-1.5 pt-0.5">
                <Button size="sm" onClick={() => onView(incident)} className="h-[1.875rem] gap-1 px-2.5 text-[0.75rem]">View</Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isAcknowledged}
                  onClick={() => onAcknowledge(incident.id)}
                  className="h-[1.875rem] gap-1 px-2.5 text-[0.75rem]"
                >
                  {isAcknowledged ? "Acknowledged" : "Acknowledge"}
                </Button>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="flex min-h-16 flex-col items-center justify-center gap-1 text-[0.75rem] text-muted-foreground">
            <ShieldCheck size={16} aria-hidden="true" />
            No {filter === "All" ? "" : filter.toLowerCase()} incidents
          </div>
        )}

        <div className="mt-1 shrink-0 border-t border-border pt-2">
          <p className="mb-1 text-[0.75rem] font-semibold text-foreground">Recently Resolved</p>
          <div className="flex flex-col gap-0.5">
            {resolvedIncidents.map((item) => (
              <div key={item.id} className="flex h-8 items-center justify-between gap-2 text-[0.75rem] text-muted-foreground">
                <span className="flex min-w-0 items-center gap-1.5">
                  <CheckCircle2 size={12} className="shrink-0 text-emerald-600" aria-hidden="true" />
                  <span className="truncate">{item.endpoint}</span>
                </span>
                <span className="whitespace-nowrap">Resolved in {item.resolvedInMinutes}m</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-2 text-[0.75rem]">
        <span className="text-muted-foreground">MTTR <b className="text-foreground">{mttrMinutes}m</b></span>
        <span className="text-muted-foreground">Resolved today <b className="text-foreground">{resolvedIncidents.length}</b></span>
        <span className="text-muted-foreground">Open <b className="text-foreground">{openIncidents.length}</b></span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

type ViewStatus = "loading" | "ready" | "error";
type RangeKey = "1H" | "6H" | "12H" | "24H" | "7D";

const RANGE_POINTS: Record<RangeKey, number> = { "1H": 2, "6H": 5, "12H": 9, "24H": performance.length, "7D": 0 };
const ROWS_PER_PAGE = 8;

export function WebsiteApiMonitoringDashboard() {
  const theme = useChartTheme();
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<ViewStatus>("loading");
  const [range, setRange] = useState<RangeKey>("24H");
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"All" | MonitorKind>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | MonitorStatus>("All");
  const [page, setPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState("Nov 7, 2026 12:09");
  const [menuOpen, setMenuOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [breakdownEndpoint, setBreakdownEndpoint] = useState("all");

  const activeBreakdown = responseBreakdownByEndpoint[breakdownEndpoint] ?? breakdownAll;
  const activeBreakdownTotal = activeBreakdown.reduce((sum, part) => sum + part.avg, 0);
  const activeBreakdownP95 = breakdownP95[breakdownEndpoint] ?? breakdownP95.all;
  const slowestPhase = activeBreakdown.reduce((slowest, part) => (part.avg > slowest.avg ? part : slowest), activeBreakdown[0]);

  const pageCount = Math.max(1, Math.ceil(monitors.length / ROWS_PER_PAGE));

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  useEffect(() => {
    setStatus("loading");
    const timer = window.setTimeout(() => setStatus("ready"), 320);
    return () => window.clearTimeout(timer);
  }, [range]);

  // Keeps the incident durations live.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredMonitors = useMemo(() => {
    const query = search.trim().toLowerCase();
    return monitors.filter((monitor) => {
      const matchesQuery = !query || `${monitor.endpoint} ${monitor.region} ${monitor.method}`.toLowerCase().includes(query);
      const matchesKind = kindFilter === "All" || monitor.kind === kindFilter;
      const matchesStatus = statusFilter === "All" || monitor.status === statusFilter;
      return matchesQuery && matchesKind && matchesStatus;
    });
  }, [search, kindFilter, statusFilter]);

  const visibleMonitors = filteredMonitors.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);
  const hasData = RANGE_POINTS[range] > 0;
  const hasFilters = search.trim() !== "" || kindFilter !== "All" || statusFilter !== "All";

  const clearFilters = () => {
    setSearch("");
    setKindFilter("All");
    setStatusFilter("All");
    setPage(1);
  };

  const refresh = () => {
    setStatus("loading");
    window.setTimeout(() => {
      setStatus("ready");
      setLastUpdated(new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }));
      notify("Monitoring data refreshed.");
    }, 320);
  };

  const exportCsv = () => {
    const header = ["Endpoint", "Type", "Method", "Status", "Code", "Response (ms)", "P95 (ms)", "Uptime 30d", "Region", "Last Check"];
    const rows = filteredMonitors.map((monitor) => [
      monitor.endpoint, monitor.kind, monitor.method, monitor.status,
      monitor.code === null ? "-" : String(monitor.code),
      monitor.responseMs === null ? "-" : String(monitor.responseMs),
      String(monitor.p95Ms), `${monitor.uptime30d}%`, monitor.region, monitor.lastCheck,
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "website-api-monitoring-report.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify("Monitoring report exported.");
  };

  const allHealthy = issueCount === 0;
  const statusBadge = allHealthy ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[0.75rem] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
      <ShieldCheck size={12} aria-hidden="true" />All Systems Operational
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[0.75rem] font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
      <XCircle size={12} aria-hidden="true" />{issueCount} Incident{issueCount === 1 ? "" : "s"} Active
    </span>
  );

  /** Compact incident list for the banner - first incident plus a "+N more" hint. */
  const incidentSummary = openIncidents.length === 1
    ? (() => {
      const incident = openIncidents[0];
      return incident.status === "Down"
        ? `${incident.endpoint} down since ${formatSince(incident.startedAt)}`
        : `${incident.endpoint} degraded`;
    })()
    : (() => {
      const [first, ...rest] = openIncidents;
      const firstText = first.status === "Down"
        ? `${first.endpoint} down since ${formatSince(first.startedAt)}`
        : `${first.endpoint} degraded`;
      return `${firstText}, ${rest.map((incident) => incident.endpoint).join(", ")} +${rest.length} more`;
    })();
  const rangeControl = (
    <div className="flex items-center gap-1">
      <div className="flex items-center rounded-md border border-border p-0.5" aria-label="Chart time range">
        {(["1H", "6H", "12H", "24H", "7D"] as RangeKey[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => { setRange(item); setPage(1); }}
            aria-pressed={range === item}
            className={cn("rounded px-1.5 py-1 text-[0.75rem] font-semibold transition-colors", range === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
          >
            {item}
          </button>
        ))}
      </div>
      <details className="relative" open={menuOpen} onToggle={(event) => setMenuOpen((event.currentTarget as HTMLDetailsElement).open)}>
        <summary aria-label="Performance chart options" className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-md text-muted-foreground hover:bg-accent">
          <MoreVertical size={15} />
        </summary>
        <div className="absolute right-0 top-8 z-30 w-44 rounded-lg border border-border bg-popover p-1 shadow-lg">
          <button onClick={exportCsv} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[0.75rem] text-foreground hover:bg-accent"><Download size={14} />Export CSV</button>
          <button onClick={() => notify("Chart image export is a demo action.")} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[0.75rem] text-foreground hover:bg-accent"><Download size={14} />Export PNG</button>
          <button onClick={() => notify("Fullscreen is a demo action.")} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[0.75rem] text-foreground hover:bg-accent"><Expand size={14} />Fullscreen</button>
          <div className="my-1 border-t border-border" />
          <button onClick={() => { setStatus("error"); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[0.75rem] text-foreground hover:bg-accent"><TriangleAlert size={14} />Simulate error</button>
        </div>
      </details>
    </div>
  );

  const summaryCards: MetricStat[] = [
    { label: "Total Monitors", value: String(totalMonitors), change: "2 new", trend: "up", tone: "blue", icon: "globe-2" },
    { label: "Healthy", value: String(healthyMonitors), change: `${((healthyMonitors / totalMonitors) * 100).toFixed(1)}%`, trend: "flat", tone: "green", icon: "online" },
    { label: "Issues", value: String(issueCount), change: `${downIncident ? 1 : 0} down, ${degradedIncident ? 1 : 0} degraded`, trend: "down", tone: "red", icon: "octagon-alert" },
    { label: "Avg Response Time", value: `${Math.round(avgResponseTime)} ms`, change: "12.4%", trend: "down", tone: "blue", icon: "activity" },
    { label: "Uptime 24h", value: `${avgAvailability.toFixed(2)}%`, change: "0.01%", trend: "up", tone: "green", icon: "shield-check" },
    { label: "Total Checks", value: "48,320", change: "12.5%", trend: "up", tone: "purple", icon: "pulse" },
  ];

  return (
    <div className="flex flex-col gap-4 pb-3">
      <PageHeader
        breadcrumbs={["Monitoring", "Websites & API Monitoring"]}
        title="Websites & API Monitoring"
        subtitle="Monitor your websites and APIs for performance, availability and response time."
        icon={<Globe size={22} />}
        statusBadge={statusBadge}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        actions={
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={() => notify("Add Monitor is a mockup action.")} className="h-10 gap-2 rounded-lg px-4 text-[0.875rem] font-medium"><Plus size={16} />Add Monitor</Button>
            <Button variant="outline" onClick={exportCsv} className="h-10 gap-2 rounded-lg px-4 text-[0.875rem] font-medium"><Download size={16} />Export Report</Button>
          </div>
        }
      />

      {openIncidents.length > 0 && (
        <div role="alert" className="flex min-h-11 items-center justify-between gap-3 rounded-[0.625rem] border border-rose-200 bg-rose-50 px-4 py-2 dark:border-rose-900/60 dark:bg-rose-950/40">
          <p className="min-w-0 truncate text-[0.75rem] font-medium text-rose-800 dark:text-rose-200">
            <b className="font-semibold">{openIncidents.length} active incident{openIncidents.length === 1 ? "" : "s"}:</b>{" "}
            {incidentSummary}
          </p>
          <Button size="sm" onClick={() => { setStatusFilter("All"); setKindFilter("All"); setSearch(""); setPage(1); notify("Showing all incidents."); }} className="h-8 shrink-0 gap-1.5 whitespace-nowrap rounded-lg px-3 text-[0.75rem]">
            View details
          </Button>
        </div>
      )}

      {status === "loading" ? (
        <div className="grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {summaryCards.map((card) => (
            <div key={card.label} className="flex h-[6.75rem] items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
              <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <span className="block h-3 w-24 animate-pulse rounded bg-muted" />
                <span className="block h-6 w-16 animate-pulse rounded bg-muted" />
                <span className="block h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : status === "error" ? (
        <div className="flex min-h-[18.75rem] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-6 text-center shadow-card">
          <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
            <TriangleAlert size={22} />
          </span>
          <p className="text-[1rem] font-semibold text-foreground">Could not load monitoring data</p>
          <p className="max-w-sm text-[0.75rem] text-muted-foreground">Something went wrong while fetching the latest monitor results. Please try again.</p>
          <Button onClick={refresh} className="h-9 gap-1.5 px-3 text-[0.75rem]"><RefreshCw size={15} />Retry</Button>
        </div>
      ) : (
        <>
          <section aria-label="Website and API monitoring summary" className="grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {summaryCards.map((item) => (
              <MetricCard key={item.label} item={item} className="h-[6.75rem] self-stretch" labelClassName="text-[0.875rem]" valueClassName="text-[1.75rem]" trendClassName={item.label === "Issues" ? "text-rose-600" : undefined} />
            ))}
          </section>

          <section aria-label="Performance and active incidents" className="grid items-stretch gap-4 xl:grid-cols-[1.72fr_1fr]">
            <Panel title="Performance Overview" className="min-w-0 p-4" titleClassName="text-[1rem] font-semibold" showOptions={false} action={rangeControl}>
              {hasData ? (
                <PerformanceChart theme={theme} hidden={hiddenSeries} onToggle={(key) => setHiddenSeries((current) => current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key])} />
              ) : (
                <div className="flex min-h-[16.25rem] flex-1 flex-col items-center justify-center gap-2 text-center">
                  <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground"><Globe size={20} /></span>
                  <p className="text-[0.875rem] font-semibold text-foreground">No data for this range</p>
                  <p className="text-[0.75rem] text-muted-foreground">Pick a shorter range to see the collected samples.</p>
                  <Button variant="outline" size="sm" onClick={() => setRange("24H")} className="mt-1 h-8 gap-1.5 px-2.5 text-[0.75rem]">Show last 24H</Button>
                </div>
              )}
            </Panel>

            <Panel
              title="Active Incidents"
              className="min-w-0"
              action={<span className="rounded-full bg-rose-100 px-2 py-0.5 text-[0.75rem] font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">{openIncidents.length} open</span>}
            >
              <ActiveIncidentsCard
                now={now}
                acknowledged={acknowledged}
                onAcknowledge={(id) => { setAcknowledged((current) => [...current, id]); notify("Incident acknowledged."); }}
                onView={(incident) => { setSearch(incident.endpoint); setStatusFilter(incident.status); setPage(1); notify(`Showing ${incident.endpoint}.`); }}
              />
            </Panel>
          </section>

          <section aria-label="Monitored endpoints" className="grid items-stretch gap-4">
            <Panel title="API Endpoints Status" className="min-w-0 p-4" titleClassName="text-[1rem] font-semibold" action={<button onClick={() => notify("Showing all monitored endpoints.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <div className="relative min-w-[12.5rem] flex-1">
                  <Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search endpoints..." aria-label="Search endpoints" className="h-8 pl-9 text-[0.75rem]" />
                </div>
                <div className="flex items-center rounded-md border border-border p-0.5" aria-label="Endpoint type filter">
                  {(["All", "Website", "API"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => { setKindFilter(item); setPage(1); }}
                      aria-pressed={kindFilter === item}
                      className={cn("rounded px-2 py-1 text-[0.75rem] font-semibold transition-colors", kindFilter === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
                    >
                      {item === "API" ? "APIs" : item === "Website" ? "Websites" : "All"}
                    </button>
                  ))}
                </div>
                <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value as "All" | MonitorStatus); setPage(1); }}>
                  <SelectTrigger aria-label="Filter by status" className="h-8 w-36 text-[0.75rem]"><SelectValue /></SelectTrigger>
                  <SelectContent>{(["All", "Healthy", "Degraded", "Down"] as const).map((item) => <SelectItem key={item} value={item}>{item === "All" ? "All statuses" : item}</SelectItem>)}</SelectContent>
                </Select>
                {hasFilters && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {search.trim() && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[0.75rem] text-muted-foreground">
                        &ldquo;{search.trim()}&rdquo;
                        <button type="button" onClick={() => { setSearch(""); setPage(1); }} aria-label="Clear search filter" className="rounded-full p-0.5 hover:bg-accent hover:text-foreground"><XCircle size={12} /></button>
                      </span>
                    )}
                    {kindFilter !== "All" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[0.75rem] text-muted-foreground">
                        {kindFilter === "API" ? "APIs" : "Websites"}
                        <button type="button" onClick={() => { setKindFilter("All"); setPage(1); }} aria-label="Clear type filter" className="rounded-full p-0.5 hover:bg-accent hover:text-foreground"><XCircle size={12} /></button>
                      </span>
                    )}
                    {statusFilter !== "All" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[0.75rem] text-muted-foreground">
                        {statusFilter}
                        <button type="button" onClick={() => { setStatusFilter("All"); setPage(1); }} aria-label="Clear status filter" className="rounded-full p-0.5 hover:bg-accent hover:text-foreground"><XCircle size={12} /></button>
                      </span>
                    )}
                    <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[0.75rem] font-medium text-foreground transition-colors hover:bg-accent">
                      <XCircle size={12} aria-hidden="true" />Clear filters
                    </button>
                  </div>
                )}
              </div>

              {filteredMonitors.length === 0 ? (
                <div className="flex min-h-[13.75rem] flex-1 flex-col items-center justify-center gap-2 text-center">
                  <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground"><Search size={20} /></span>
                  <p className="text-[0.875rem] font-semibold text-foreground">No monitors match your filters</p>
                  <p className="text-[0.75rem] text-muted-foreground">Try a different search term or reset the filters.</p>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="mt-1 h-8 gap-1.5 px-2.5 text-[0.75rem]"><XCircle size={13} />Clear filters</Button>
                </div>
              ) : (
                <>
                  <div className="min-h-0 flex-1 overflow-x-auto">
                    <table className="w-full min-w-[51.25rem] table-fixed text-[0.75rem]">
                      <colgroup>
                        <col style={{ width: "20%" }} /><col style={{ width: "11%" }} /><col style={{ width: "9%" }} />
                        <col style={{ width: "12%" }} /><col style={{ width: "8%" }} /><col style={{ width: "11%" }} />
                        <col style={{ width: "9%" }} /><col style={{ width: "12%" }} /><col style={{ width: "8%" }} />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          {[
                            { label: "Endpoint", align: "left" },
                            { label: "Status", align: "left" },
                            { label: "Code", align: "right" },
                            { label: "Response", align: "right" },
                            { label: "P95", align: "right" },
                            { label: "Uptime 30d", align: "right" },
                            { label: "Trend", align: "center" },
                            { label: "Last Check", align: "left" },
                            { label: "Actions", align: "center" },
                          ].map((heading) => (
                            <th key={heading.label} className={cn("whitespace-nowrap px-1.5 pb-1.5 text-[0.75rem] font-medium", heading.align === "right" && "text-right", heading.align === "center" && "text-center")}>
                              {heading.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleMonitors.map((monitor) => {
                          const incident = incidentFor(monitor.endpoint);
                          const isUnhealthy = monitor.status !== "Healthy";
                          return (
                            <tr
                              key={monitor.id}
                              className={cn(
                                "h-11 border-b border-border/70 transition-colors last:border-0 hover:bg-muted/50",
                                monitor.status === "Down" && "bg-rose-50/60 dark:bg-rose-950/25",
                              )}
                              style={monitor.status === "Down" ? { boxShadow: "inset 0.1875rem 0 0 0 oklch(0.7106 0.1661 22.22)" } : undefined}
                            >
                              <td className="whitespace-nowrap px-1.5 text-left">
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate font-medium text-foreground">{monitor.endpoint}</span>
                                  <MethodBadge method={monitor.method} />
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-1.5 text-left"><StatusBadge status={monitor.status} /></td>
                              <td className={cn("whitespace-nowrap px-1.5 text-right tabular-nums", isUnhealthy ? "font-medium text-rose-600" : "text-foreground")}>
                                {isUnhealthy ? (monitor.issueReason ?? "-") : monitor.code}
                              </td>
                              <td className={cn("whitespace-nowrap px-1.5 text-right font-medium tabular-nums", isUnhealthy ? "text-rose-600" : responseTone(monitor.responseMs))}>
                                {isUnhealthy ? "-" : `${monitor.responseMs} ms`}
                              </td>
                              <td className="whitespace-nowrap px-1.5 text-right tabular-nums text-foreground">{monitor.p95Ms ? `${monitor.p95Ms} ms` : "-"}</td>
                              <td className="whitespace-nowrap px-1.5 text-right tabular-nums text-foreground">{monitor.uptime30d}%</td>
                              <td className="px-1.5 text-center"><Sparkline values={monitor.values} down={monitor.status === "Down"} /></td>
                              <td className="whitespace-nowrap px-1.5 text-left text-muted-foreground">
                                <span className="block">{monitor.lastCheck}</span>
                                {incident && <span className="block text-[0.75rem] text-rose-600">Down for {formatDuration(now - incident.startedAt)}</span>}
                              </td>
                              <td className="px-1.5 text-center">
                                <details className="relative inline-block">
                                  <summary aria-label={`Actions for ${monitor.endpoint}`} className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-md text-muted-foreground hover:bg-accent">
                                    <MoreVertical size={15} />
                                  </summary>
                                  <div className="absolute right-0 top-8 z-30 w-40 rounded-lg border border-border bg-popover p-1 shadow-lg">
                                    <button onClick={() => notify(`Check queued for ${monitor.endpoint}.`)} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[0.75rem] text-foreground hover:bg-accent"><Play size={13} />Run check now</button>
                                    <button onClick={() => notify(`${monitor.endpoint} paused.`)} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[0.75rem] text-foreground hover:bg-accent"><Pause size={13} />Pause</button>
                                    <button onClick={() => notify(`Editing ${monitor.endpoint}.`)} className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[0.75rem] text-foreground hover:bg-accent"><Pencil size={13} />Edit</button>
                                  </div>
                                </details>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[0.75rem] text-muted-foreground">
                    <span className="whitespace-nowrap">
                      {hasFilters
                        ? `Showing ${filteredMonitors.length} of ${filteredMonitors.length} result${filteredMonitors.length === 1 ? "" : "s"} (${totalMonitors} monitors total)`
                        : `Showing ${filteredMonitors.length ? (page - 1) * ROWS_PER_PAGE + 1 : 0}-${Math.min(page * ROWS_PER_PAGE, filteredMonitors.length)} of ${totalMonitors} monitors`}
                    </span>
                    {pageCount > 1 && (
                      <div className="flex items-center gap-1">
                        {Array.from({ length: pageCount }, (_, index) => index + 1).map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setPage(value)}
                            aria-current={page === value ? "page" : undefined}
                            className={cn(
                              "grid h-7 w-7 place-items-center rounded-md transition-colors",
                              page === value ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent hover:text-foreground",
                            )}
                          >
                            {value}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPage(Math.min(pageCount, page + 1))}
                          disabled={page === pageCount}
                          aria-label="Next page"
                          className="grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                        >
                          <ChevronDown size={13} className="-rotate-90" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </Panel>
          </section>

          <section aria-label="Service health and availability" className="grid items-stretch gap-4 xl:grid-cols-[1.02fr_0.98fr_1.1fr]">
            <Panel title="Service Health" className="min-w-0 p-4" titleClassName="text-[1rem] font-semibold" action={<button onClick={() => notify("Showing health details for all services.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="grid grid-cols-3 gap-y-5 pt-3">
                  {serviceHealth.map((service) => <HealthGauge key={service.label} label={service.label} value={service.value} />)}
                </div>
                <div className="mt-auto">
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[0.75rem] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400" />&ge; 99.5%</span>
                    <span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-400" />99 - 99.5%</span>
                    <span className="flex items-center gap-1.5"><i aria-hidden="true" className="h-2 w-2 rounded-full bg-red-400" />&lt; 99%</span>
                  </div>
                  <p className="mt-1.5 text-center text-[0.75rem] text-muted-foreground">
                    Healthy <b className="text-foreground">{healthyMonitors}</b> &middot; Issues <b className="text-rose-600">{issueCount}</b>
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="Top Monitored Services" className="min-w-0 p-4" titleClassName="text-[1rem] font-semibold" action={<span className="text-[0.75rem] text-muted-foreground">Scale 95-100%</span>}>
              <div className="flex min-h-0 flex-1 flex-col justify-between gap-0.5 pt-1">
                {topServices.map((service) => {
                  const color = availabilityTone(service.value);
                  const width = ((service.value - 95) / 5) * 100;
                  return (
                    <div
                      key={service.name}
                      title={service.issue}
                      className="grid h-[1.75rem] grid-cols-[minmax(0,1fr)_minmax(3.75rem,1.4fr)_3.5rem] items-center gap-2 text-[0.75rem]"
                    >
                      <span className="truncate font-medium text-foreground">{service.name}</span>
                      <span className="h-[0.375rem] min-w-0 rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} /></span>
                      <b className="whitespace-nowrap text-right tabular-nums text-foreground">{service.value.toFixed(2)}%</b>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Global Availability" className="min-w-0 p-4" titleClassName="text-[1rem] font-semibold" action={<Globe size={14} className="text-primary" aria-hidden="true" />}>
              <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1">
                <div className="relative mt-3 h-[14.375rem] min-h-[14.375rem] flex-1 overflow-hidden rounded-lg">
                  <NocOsmMap sites={availabilitySites} center={[33.69, 73.06]} initialZoom={13} />
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[0.75rem] text-muted-foreground">
                  {regionStates.map((region) => (
                    <span key={region.name} className="flex items-center justify-between gap-2 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 truncate">
                        <i
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: region.state === "offline" ? PALETTE.red : region.state === "warning" ? PALETTE.amber : PALETTE.green }}
                        />
                        {region.name}
                      </span>
                      <b className="tabular-nums text-foreground">{region.latencyMs}ms</b>
                    </span>
                  ))}
                </div>
              </div>
            </Panel>
          </section>

          <section aria-label="Events, certificates and response analysis" className="grid items-stretch gap-4 xl:grid-cols-4">
            <Panel title="Recent Events" className="min-w-0 p-4" titleClassName="text-[1rem] font-semibold" action={<button onClick={() => notify("Showing all monitoring events.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {sortedEvents.map((event) => (
                  <div key={event.key} className="grid h-10 grid-cols-[78px_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/70 text-[0.75rem] last:border-0">
                    <span className="whitespace-nowrap text-muted-foreground">{event.time}</span>
                    <span className="truncate font-medium text-foreground" title={event.message}>{event.message}</span>
                    <span className={cn(
                      "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.75rem] font-semibold",
                      event.status === "Open" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                        : event.status === "Resolved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : event.status === "Investigating" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                    )}>
                      {event.status}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-auto border-t border-border pt-2 text-[0.75rem] text-muted-foreground">
                Showing {sortedEvents.length} of {TOTAL_EVENTS} events
              </div>
            </Panel>

            <Panel title="Response Time Distribution" className="min-w-0 p-4" titleClassName="text-[1rem] font-semibold">
              <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "P50", value: `${responsePercentiles.p50} ms` },
                    { label: "P95", value: `${responsePercentiles.p95} ms` },
                    { label: "P99", value: `${responsePercentiles.p99} ms` },
                  ].map((item) => (
                    <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-[0.75rem] text-muted-foreground">
                      {item.label} <b className="tabular-nums text-foreground">{item.value}</b>
                    </span>
                  ))}
                </div>
                <ResponseDistributionChart theme={theme} />
              </div>
            </Panel>

            <Panel title="SSL Certificates" className="min-w-0 p-4" titleClassName="text-[1rem] font-semibold" action={<button onClick={() => notify("Showing all certificates.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
              <div className="flex min-h-0 flex-1 flex-col pt-1">
                {sortedSslCertificates.map((certificate) => {
                  const tone = certificate.daysLeft > 30
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : certificate.daysLeft >= 7
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
                  const Icon = certificate.daysLeft > 30 ? ShieldCheck : certificate.daysLeft >= 7 ? TriangleAlert : XCircle;
                  return (
                    <div key={certificate.domain} className="flex items-center justify-between gap-2 border-b border-border/70 py-1.5 last:border-0">
                      <span className="min-w-0">
                        <span className="block truncate text-[0.75rem] font-medium text-foreground">{certificate.domain}</span>
                        <span className="block text-[0.75rem] text-muted-foreground">Expires {formatExpiry(certificate.daysLeft)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <span className={cn(
                          "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.75rem] font-semibold",
                          certificate.autoRenew ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : "bg-muted text-muted-foreground",
                        )}>
                          {certificate.autoRenew ? <CheckCircle2 size={11} aria-hidden="true" /> : <XCircle size={11} aria-hidden="true" />}
                          Auto-renew {certificate.autoRenew ? "On" : "Off"}
                        </span>
                        <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.75rem] font-semibold", tone)}>
                          <Icon size={11} aria-hidden="true" />{certificate.daysLeft}d
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-auto border-t border-border pt-2 text-[0.75rem] text-muted-foreground">
                Next expiry in <b className="text-foreground">{Math.min(...sslCertificates.map((certificate) => certificate.daysLeft))} days</b>
              </div>
            </Panel>

            <Panel
              title="Response Time Breakdown"
              className="flex h-full min-w-0 flex-col rounded-xl p-4"
              titleClassName="text-[1rem] font-semibold whitespace-nowrap overflow-visible"
            >
              <div className="flex min-h-0 flex-1 flex-col pt-1">
                <Select value={breakdownEndpoint} onValueChange={setBreakdownEndpoint}>
                  <SelectTrigger aria-label="Select endpoint for response breakdown" className="h-8 w-full text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{breakdownEndpoints.map((item) => <SelectItem key={item} value={item}>{item === "all" ? "All endpoints" : item}</SelectItem>)}</SelectContent>
                </Select>

                <div className="mt-3 flex h-3 w-full gap-[0.125rem] overflow-hidden rounded-full bg-muted" role="group" aria-label="Response time breakdown by phase">
                  {activeBreakdown.map((part) => {
                    const share = Math.round((part.avg / activeBreakdownTotal) * 100);
                    return <span key={part.label} role="img" aria-label={`${part.label}: ${part.avg} ms, ${share}% of total`} title={`${part.label}: ${part.avg} ms (${share}%)`} style={{ width: `${(part.avg / activeBreakdownTotal) * 100}%`, backgroundColor: part.color }} />;
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[0.75rem] text-muted-foreground">Total <b className="text-[0.875rem] tabular-nums text-foreground">{activeBreakdownTotal} ms</b></p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground" title="P95 response time">P95 {activeBreakdownP95} ms</span>
                </div>

                <ul className="mt-2 flex flex-1 flex-col justify-between divide-y divide-border/60">
                  {activeBreakdown.map((part) => {
                    const share = Math.round((part.avg / activeBreakdownTotal) * 100);
                    const withinTarget = part.avg <= part.target;
                    const improved = part.deltaMs <= 0;
                    return (
                      <li key={part.label} className="grid h-10 grid-cols-[84px_minmax(0,1fr)_auto_auto_auto] items-center gap-2">
                        <span className="flex min-w-0 items-center gap-1.5"><i aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: part.color }} /><span className="truncate text-[0.8125rem] font-medium text-foreground">{part.label}</span></span>
                        <span className="h-[0.375rem] min-w-0 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${share}%`, backgroundColor: part.color }} /></span>
                        <b className={cn("w-14 whitespace-nowrap text-right text-[0.8125rem] tabular-nums", withinTarget ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")} title={withinTarget ? `Within target (${part.target} ms)` : `Above target (${part.target} ms)`}>{part.avg} ms</b>
                        <span className="w-[4.625rem] whitespace-nowrap text-right text-[0.75rem] tabular-nums text-muted-foreground" title="P95 phase time">P95 {part.p95} ms</span>
                        <span className={cn("flex w-[4.375rem] items-center justify-end gap-0.5 whitespace-nowrap text-[0.75rem] font-semibold tabular-nums", improved ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")} title={improved ? "Faster than yesterday" : "Slower than yesterday"}>{improved ? <ArrowDownRight size={12} aria-hidden="true" /> : <ArrowUpRight size={12} aria-hidden="true" />}{Math.abs(part.deltaMs)} ms</span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-auto border-t border-border pt-2 text-[0.75rem] leading-5 text-muted-foreground">
                  <p>Slowest: <b className="text-foreground">{slowestPhase.label} {slowestPhase.avg} ms</b> <span>(target {slowestPhase.target} ms)</span></p>
                  <p>Slowest endpoint: <b className="text-foreground">{slowestEndpoint.endpoint} &middot; {slowestEndpoint.phase} {slowestEndpoint.value} ms</b></p>
                </div>
              </div>
            </Panel>
          </section>
        </>
      )}

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[0.75rem] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
