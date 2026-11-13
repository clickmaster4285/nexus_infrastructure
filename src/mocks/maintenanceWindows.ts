/**
 * Maintenance Windows mock data - single source of truth for Operations > Maintenance Windows.
 *
 * 20 seeded windows (MW-1042..MW-1061), newest = MW-1061, all timestamps
 * relative to module load (Date.now()). Status split: Scheduled 8, In Progress 2,
 * Completed 8, Cancelled 2. Lifecycle rule: stored `status` is only authoritative
 * for "Cancelled" - everything else is derived live from start/end vs now
 * (future = Scheduled, between = In Progress, past = Completed), so the page
 * can never go stale. Every number on the page (stat cards, calendar, tabs,
 * charts, banner, cross-page "In Maintenance" state) derives from this one array.
 *
 * To swap in a real API later, replace `fetchMaintenanceWindows` (and the
 * action functions) - the types and derived shapes stay. The module-level store
 * is seeded once per page load; actions mutate it in-memory so
 * create -> redirect -> detail works across client-side navigation.
 */

import { ALERT_RULES } from "@/mocks/alertRules";
import { CURRENT_USER_NAME, INCIDENT_PEOPLE } from "@/mocks/incidents";
import { serverGroups } from "@/data/mock/server-groups";

export type MaintenanceWindowType = "Planned" | "Emergency" | "Recurring";
export type MaintenanceWindowStatus = "Scheduled" | "In Progress" | "Completed" | "Cancelled";
export type MaintenanceApprovalStatus = "Pending" | "Approved" | "Rejected";
export type MaintenanceTimelineType =
  | "created" | "scheduled" | "approved" | "rejected" | "started" | "extended"
  | "completed" | "cancelled" | "updated" | "note";

export interface MaintenanceRecurrence {
  kind: "none" | "daily" | "weekly" | "monthly";
  /** weekly: 0-6 (Sun..Sat); monthly: day-of-month (1-31); daily: ignored. */
  days: number[];
  /** ISO date (yyyy-mm-dd) the recurrence ends, or null for none. */
  until: string | null;
}

export interface MaintenanceScope {
  servers: string[];
  groups: string[];
  services: string[];
  tags: string[];
  exclude: string[];
}

export interface MaintenanceAlertBehavior {
  muteAlerts: boolean;
  suppressIncidents: boolean;
  /** SEV1 / critical alerts still page through during the window. */
  allowCritical: boolean;
  mutedRuleIds: string[];
  autoEnd: boolean;
}

export interface MaintenanceTimelineEntry {
  id: string;
  /** ISO 8601 timestamp. */
  at: string;
  epochMs: number;
  type: MaintenanceTimelineType;
  author: string;
  text: string;
}

export interface MaintenanceSummary {
  suppressedAlerts: number;
  suppressedIncidents: number;
  actualStart: string | null;
  actualEnd: string | null;
  notes: string;
}

export interface MaintenanceWindow {
  id: string;
  title: string;
  description: string;
  type: MaintenanceWindowType;
  status: MaintenanceWindowStatus;
  start: string;
  end: string;
  /** IANA time zone the window is anchored to, e.g. "Asia/Karachi". */
  timeZone: string;
  recurrence: MaintenanceRecurrence;
  scope: MaintenanceScope;
  alertBehavior: MaintenanceAlertBehavior;
  owner: string;
  approver: string | null;
  approvalStatus: MaintenanceApprovalStatus;
  changeTicket: string | null;
  notifyChannels: string[];
  impact: string;
  createdBy: string;
  createdAt: string;
  timeline: MaintenanceTimelineEntry[];
  summary: MaintenanceSummary | null;
}

/* ------------------------------- reference data ------------------------------ */

export const MAINTENANCE_PEOPLE = INCIDENT_PEOPLE;
export const MAINTENANCE_CHANNELS = ["Slack", "Email", "PagerDuty", "Teams"] as const;
export const MAINTENANCE_TIME_ZONES = ["Asia/Karachi", "UTC", "Europe/London", "Europe/Helsinki", "America/New_York", "Asia/Singapore"] as const;

/** Ops-style host names used across the monitoring mocks (api-server-01, db-01, web-app-01...). */
export const SCOPE_SERVERS = [
  "api-server-01", "api-server-02", "web-app-01", "web-02", "db-01",
  "app-server-02", "worker-01", "cache-01", "edge-01", "pay-01", "storage-01",
] as const;

export const SCOPE_GROUPS = serverGroups.map((group) => ({ id: group.id, name: group.name }));
export const SCOPE_SERVICES = ["api-server", "web-app", "database", "cache", "edge-proxy", "scheduler", "payment", "storage", "app-server"] as const;
export const SCOPE_TAGS = ["production", "staging", "database", "api", "edge", "storage", "payment", "cache", "web"] as const;

/** Group id -> canonical ops hosts (used to derive which alert rules a scope mutes). */
export const GROUP_TO_HOSTS: Record<string, string[]> = {
  "production-web": ["web-app-01", "web-02"],
  "database-cluster": ["db-01"],
  "api-services": ["api-server-01", "api-server-02"],
  "monitoring-stack": ["worker-01"],
  "dev-environment": [],
  "staging-servers": ["api-staging-01"],
  "security-services": [],
  "backup-group": ["storage-01", "db-01"],
  "cache-servers": ["cache-01"],
  "edge-locations": ["edge-01"],
  "internal-services": ["app-server-02"],
  "load-balancers": ["edge-01"],
  "prod-api": ["api-server-01", "api-server-02"],
  "prod-web": ["web-app-01", "web-02"],
  "prod-db": ["db-01"],
  "prod-cache": ["cache-01"],
  "prod-edge": ["edge-01"],
};

/** All host names a scope resolves to (servers + expanded groups). */
export function scopeHosts(scope: Pick<MaintenanceScope, "servers" | "groups">): string[] {
  const hosts = new Set<string>(scope.servers);
  for (const group of scope.groups) for (const host of GROUP_TO_HOSTS[group] ?? []) hosts.add(host);
  return [...hosts];
}

/** Alert rules that a scope would mute (target inside the resolved host set). */
export function rulesForScope(scope: Pick<MaintenanceScope, "servers" | "groups" | "services">): typeof ALERT_RULES {
  const hosts = new Set(scopeHosts(scope));
  if (hosts.size === 0) return [];
  return ALERT_RULES.filter((rule) => hosts.has(rule.target));
}

export const STATUS_ORDER: MaintenanceWindowStatus[] = ["In Progress", "Scheduled", "Completed", "Cancelled"];

/* ---------------------------------- seed ---------------------------------- */

const NOW = Date.now();
const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();
const at = (minutesFromNow: number) => iso(NOW + minutesFromNow * MIN);
const dayIso = (daysFromNow: number) => new Date(NOW + daysFromNow * 24 * 60 * MIN).toISOString().slice(0, 10);

interface SeedTimeline { atOffsetMin: number; type: MaintenanceTimelineType; author: string; text: string }

interface SeedRow {
  /** Store "Completed"/"Cancelled" as-is; anything else is re-derived live from start/end. */
  status: MaintenanceWindowStatus;
  type: MaintenanceWindowType;
  startMin: number;
  endMin: number;
  title: string;
  description: string;
  impact: string;
  servers: string[];
  groups: string[];
  services: string[];
  tags: string[];
  owner: string;
  approver: string | null;
  approvalStatus: MaintenanceApprovalStatus;
  changeTicket: string | null;
  channels: string[];
  recurrence?: MaintenanceRecurrence;
  muteAlerts?: boolean;
  suppressIncidents?: boolean;
  allowCritical?: boolean;
  mutedRuleIds?: string[];
  createdMinAgo: number;
  timeline: SeedTimeline[];
  summary?: MaintenanceSummary | null;
}

const seedRow = (id: string, row: SeedRow): Omit<MaintenanceWindow, "id"> => ({
  title: row.title,
  description: row.description,
  type: row.type,
  status: row.status,
  start: at(row.startMin),
  end: at(row.endMin),
  timeZone: "Asia/Karachi",
  recurrence: row.recurrence ?? { kind: "none", days: [], until: null },
  scope: { servers: [...row.servers], groups: [...row.groups], services: [...row.services], tags: [...row.tags], exclude: [] },
  alertBehavior: {
    muteAlerts: row.muteAlerts ?? true,
    suppressIncidents: row.suppressIncidents ?? true,
    allowCritical: row.allowCritical ?? true,
    mutedRuleIds: [...(row.mutedRuleIds ?? [])],
    autoEnd: true,
  },
  owner: row.owner,
  approver: row.approver,
  approvalStatus: row.approvalStatus,
  changeTicket: row.changeTicket,
  notifyChannels: [...row.channels],
  impact: row.impact,
  createdBy: row.owner,
  createdAt: at(-row.createdMinAgo),
  timeline: row.timeline.map((entry, index) => ({
    id: `${id}-tl-${index}`,
    at: at(entry.atOffsetMin),
    epochMs: NOW + entry.atOffsetMin * MIN,
    type: entry.type,
    author: entry.author,
    text: entry.text,
  })),
  summary: row.summary ?? null,
});

const SEED: Array<[string, SeedRow]> = [
  /* -------------------------------- Completed (8) -------------------------------- */
  ["MW-1042", {
    status: "Completed", type: "Planned", startMin: -25 * 24 * 60 - 240, endMin: -25 * 24 * 60 - 60,
    title: "Postgres minor version upgrade", description: "Upgrade db-01 from 16.3 to 16.4 including the replica. Vacuum freeze after upgrade completes.",
    impact: "Primary DB read-only, failover to replica, ~15 min write pause",
    servers: ["db-01"], groups: ["database-cluster", "prod-db"], services: ["database"], tags: ["database", "production"],
    owner: "Sara Iqbal", approver: "Ayesha Khan", approvalStatus: "Approved", changeTicket: "CHG-1988", channels: ["Slack", "Email"],
    mutedRuleIds: ["RUL-202", "RUL-206", "RUL-210", "RUL-212"], createdMinAgo: 30 * 24 * 60,
    timeline: [
      { atOffsetMin: -30 * 24 * 60, type: "created", author: "Sara Iqbal", text: "Window created from change request CHG-1988." },
      { atOffsetMin: -28 * 24 * 60, type: "approved", author: "Ayesha Khan", text: "Change approved with database team sign-off." },
      { atOffsetMin: -25 * 24 * 60 - 240, type: "started", author: "Sara Iqbal", text: "Upgrade started; db-01 failover to replica initiated." },
      { atOffsetMin: -25 * 24 * 60 - 60, type: "completed", author: "Sara Iqbal", text: "Upgrade complete, replica re-joined, alerts restored." },
    ],
    summary: { suppressedAlerts: 214, suppressedIncidents: 2, actualStart: at(-25 * 24 * 60 - 238), actualEnd: at(-25 * 24 * 60 - 64), notes: "Failover took 4 minutes longer than rehearsed; replica lag back to zero within 10 minutes." },
  }],
  ["MW-1043", {
    status: "Completed", type: "Emergency", startMin: -21 * 24 * 60 - 130, endMin: -21 * 24 * 60 - 70,
    title: "Redis failover rehearsal", description: "Unplanned failover drill on cache-01 after eviction storm; validate replica promotion and client reconnection.",
    impact: "Cache read misses for ~10 minutes; origin load elevated",
    servers: ["cache-01"], groups: ["cache-servers", "prod-cache"], services: ["cache"], tags: ["cache", "redis", "production"],
    owner: "Marcus Lee", approver: null, approvalStatus: "Approved", changeTicket: "CHG-1994", channels: ["Slack", "PagerDuty"],
    mutedRuleIds: ["RUL-211", "RUL-222"], createdMinAgo: 21 * 24 * 60 + 150,
    timeline: [
      { atOffsetMin: -21 * 24 * 60 - 150, type: "created", author: "Marcus Lee", text: "Emergency window opened during eviction incident; no approval required." },
      { atOffsetMin: -21 * 24 * 60 - 130, type: "started", author: "Marcus Lee", text: "Replica promoted to primary." },
      { atOffsetMin: -21 * 24 * 60 - 70, type: "completed", author: "Marcus Lee", text: "Clients reconnected to replica-now-primary; window closed." },
    ],
    summary: { suppressedAlerts: 87, suppressedIncidents: 1, actualStart: at(-21 * 24 * 60 - 128), actualEnd: at(-21 * 24 * 60 - 72), notes: "Failover completed in 38s. Client reconnect storm was visible for 4 minutes." },
  }],
  ["MW-1044", {
    status: "Completed", type: "Planned", startMin: -18 * 24 * 60 - 200, endMin: -18 * 24 * 60 - 110,
    title: "Edge proxy TLS certificate renewal", description: "Certbot renewal + config reload on edge-01. Canary on 10% traffic before full reload.",
    impact: "None expected; handshake latency briefly elevated during reload",
    servers: ["edge-01"], groups: ["edge-locations", "prod-edge"], services: ["edge-proxy"], tags: ["edge", "tls"],
    owner: "Tom Becker", approver: "Daniel Roth", approvalStatus: "Approved", changeTicket: "CHG-2001", channels: ["Slack"],
    mutedRuleIds: ["RUL-207", "RUL-208"], createdMinAgo: 20 * 24 * 60,
    timeline: [
      { atOffsetMin: -20 * 24 * 60, type: "created", author: "Tom Becker", text: "Renewal window for the edge certificate chain." },
      { atOffsetMin: -19 * 24 * 60, type: "approved", author: "Daniel Roth", text: "Approved; canary plan accepted." },
      { atOffsetMin: -18 * 24 * 60 - 200, type: "started", author: "Tom Becker", text: "Canary reload on 10% of edge traffic." },
      { atOffsetMin: -18 * 24 * 60 - 110, type: "completed", author: "Tom Becker", text: "Full reload complete, cert valid for next 60 days." },
    ],
    summary: { suppressedAlerts: 96, suppressedIncidents: 0, actualStart: at(-18 * 24 * 60 - 199), actualEnd: at(-18 * 24 * 60 - 112), notes: "Clean reload. Next renewal due 2027-01-10." },
  }],
  ["MW-1045", {
    status: "Completed", type: "Planned", startMin: -15 * 24 * 60 - 170, endMin: -15 * 24 * 60 - 80,
    title: "Storage node rebalance", description: "Rebalance storage-01 shards after the volume expansion; scrub and re-replicate affected shards.",
    impact: "Object listing latency +200ms during scrub; writes unaffected",
    servers: ["storage-01"], groups: ["backup-group"], services: ["storage"], tags: ["storage", "production"],
    owner: "Nina Park", approver: "Ayesha Khan", approvalStatus: "Approved", changeTicket: "CHG-2007", channels: ["Slack", "Email"],
    mutedRuleIds: [], createdMinAgo: 17 * 24 * 60,
    timeline: [
      { atOffsetMin: -17 * 24 * 60, type: "created", author: "Nina Park", text: "Rebalance window after the 40% volume expansion." },
      { atOffsetMin: -16 * 24 * 60, type: "approved", author: "Ayesha Khan", text: "Approved." },
      { atOffsetMin: -15 * 24 * 60 - 170, type: "started", author: "Nina Park", text: "Scrub started on shard set A." },
      { atOffsetMin: -15 * 24 * 60 - 80, type: "completed", author: "Nina Park", text: "Rebalance complete; all shards re-replicated." },
    ],
    summary: { suppressedAlerts: 64, suppressedIncidents: 0, actualStart: at(-15 * 24 * 60 - 168), actualEnd: at(-15 * 24 * 60 - 82), notes: "Scrub finished 6 minutes early." },
  }],
  ["MW-1046", {
    status: "Completed", type: "Recurring", startMin: -2 * 24 * 60 - 90, endMin: -2 * 24 * 60,
    title: "Weekly database vacuum window", description: "Weekly autovacuum tuning + manual vacuum on hot tables. Ran Sundays 02:00; series ended after the schema migration.",
    impact: "Vacuum IO burst; query p95 +300ms during window",
    servers: ["db-01"], groups: ["database-cluster", "prod-db"], services: ["database"], tags: ["database", "maintenance"],
    owner: "Sara Iqbal", approver: "Ayesha Khan", approvalStatus: "Approved", changeTicket: "CHG-2011", channels: ["Slack"],
    recurrence: { kind: "weekly", days: [0], until: dayIso(-3) },
    mutedRuleIds: ["RUL-206", "RUL-210"], createdMinAgo: 35 * 24 * 60,
    timeline: [
      { atOffsetMin: -35 * 24 * 60, type: "created", author: "Sara Iqbal", text: "Recurring weekly window created; runs Sundays 02:00." },
      { atOffsetMin: -2 * 24 * 60 - 90, type: "started", author: "Sara Iqbal", text: "Vacuum started on orders + events tables." },
      { atOffsetMin: -2 * 24 * 60, type: "completed", author: "Sara Iqbal", text: "Vacuum complete; bloat back under 20%." },
    ],
    summary: { suppressedAlerts: 74, suppressedIncidents: 0, actualStart: at(-2 * 24 * 60 - 88), actualEnd: at(-2 * 24 * 60 - 4), notes: "Series ended after the schema migration made the window unnecessary." },
  }],
  ["MW-1047", {
    status: "Completed", type: "Planned", startMin: -6 * 24 * 60 - 300, endMin: -6 * 24 * 60 - 180,
    title: "App server OS patching - batch 2", description: "Kernel + openssh patches on app-server-02. Node cordoned, workloads shifted to api-server-01.",
    impact: "None for users; one batch of pods rescheduled",
    servers: ["app-server-02"], groups: ["internal-services"], services: ["app-server"], tags: ["vm", "patching"],
    owner: "Daniel Roth", approver: "Marcus Lee", approvalStatus: "Approved", changeTicket: "CHG-2024", channels: ["Slack", "Email"],
    mutedRuleIds: ["RUL-205", "RUL-218"], createdMinAgo: 9 * 24 * 60,
    timeline: [
      { atOffsetMin: -9 * 24 * 60, type: "created", author: "Daniel Roth", text: "Batch 2 patching window for app-server-02." },
      { atOffsetMin: -8 * 24 * 60, type: "approved", author: "Marcus Lee", text: "Approved." },
      { atOffsetMin: -6 * 24 * 60 - 300, type: "started", author: "Daniel Roth", text: "Node cordoned; patches applied." },
      { atOffsetMin: -6 * 24 * 60 - 180, type: "completed", author: "Daniel Roth", text: "Reboot complete, node uncordoned, health checks green." },
    ],
    summary: { suppressedAlerts: 156, suppressedIncidents: 1, actualStart: at(-6 * 24 * 60 - 297), actualEnd: at(-6 * 24 * 60 - 184), notes: "One kubelet NotReady flap during reboot; recovered automatically in 90s." },
  }],
  ["MW-1048", {
    status: "Completed", type: "Emergency", startMin: -3 * 24 * 60 - 115, endMin: -3 * 24 * 60 - 55,
    title: "API canary deploy rollback drill", description: "Controlled rollback of v2.14.3 canary after elevated 5xx; verified gates and rollback automation.",
    impact: "Error budget burn at 2x for ~30 minutes",
    servers: ["api-server-01", "api-server-02"], groups: ["api-services", "prod-api"], services: ["api-server"], tags: ["api", "deploy", "production"],
    owner: "Marcus Lee", approver: null, approvalStatus: "Approved", changeTicket: "CHG-2031", channels: ["Slack", "PagerDuty"],
    mutedRuleIds: ["RUL-201", "RUL-203", "RUL-213"], createdMinAgo: 3 * 24 * 60 + 125,
    timeline: [
      { atOffsetMin: -3 * 24 * 60 - 125, type: "created", author: "Marcus Lee", text: "Emergency window opened from canary gate failure." },
      { atOffsetMin: -3 * 24 * 60 - 115, type: "started", author: "Marcus Lee", text: "Canary rolled back to v2.14.2." },
      { atOffsetMin: -3 * 24 * 60 - 55, type: "completed", author: "Marcus Lee", text: "Error rate back under SLO; drill closed." },
    ],
    summary: { suppressedAlerts: 142, suppressedIncidents: 1, actualStart: at(-3 * 24 * 60 - 113), actualEnd: at(-3 * 24 * 60 - 57), notes: "Rollback automation fired in 42s; human approval gate was the slowest step." },
  }],
  ["MW-1049", {
    status: "Completed", type: "Planned", startMin: -18 * 60, endMin: -13 * 60,
    title: "Payments provider callback secret rotation", description: "Rotate the Stripe webhook signing secret; drain the dead-letter queue before and after.",
    impact: "Payment confirmations delayed for in-flight orders (~40)",
    servers: ["pay-01"], groups: ["internal-services"], services: ["payment"], tags: ["payment", "production"],
    owner: "Omar Farooq", approver: "Priya Nair", approvalStatus: "Approved", changeTicket: "CHG-2039", channels: ["Slack", "Email"],
    mutedRuleIds: [], createdMinAgo: 4 * 24 * 60,
    timeline: [
      { atOffsetMin: -4 * 24 * 60, type: "created", author: "Omar Farooq", text: "Quarterly secret rotation window." },
      { atOffsetMin: -3 * 24 * 60, type: "approved", author: "Priya Nair", text: "Approved." },
      { atOffsetMin: -18 * 60, type: "started", author: "Omar Farooq", text: "DLQ drained (12 events), secret rotated." },
      { atOffsetMin: -13 * 60, type: "completed", author: "Omar Farooq", text: "Callback verification passing; window closed." },
    ],
    summary: { suppressedAlerts: 118, suppressedIncidents: 0, actualStart: at(-17 * 60 - 30), actualEnd: at(-12 * 60 - 50), notes: "No payment confirmations lost; DLQ replayed cleanly." },
  }],

  /* -------------------------------- Cancelled (2) -------------------------------- */
  ["MW-1050", {
    status: "Cancelled", type: "Planned", startMin: -5 * 24 * 60 - 200, endMin: -5 * 24 * 60 - 80,
    title: "Network edge firmware upgrade", description: "Upgrade edge router firmware to R12.4. Cancelled - vendor pulled the image after two reported reboots.",
    impact: "Cancelled; no customer impact",
    servers: ["edge-01"], groups: ["edge-locations", "prod-edge"], services: ["edge-proxy"], tags: ["edge", "network"],
    owner: "Tom Becker", approver: "Daniel Roth", approvalStatus: "Rejected", changeTicket: "CHG-2033", channels: ["Slack"],
    mutedRuleIds: ["RUL-207", "RUL-208", "RUL-219", "RUL-224"], createdMinAgo: 8 * 24 * 60,
    timeline: [
      { atOffsetMin: -8 * 24 * 60, type: "created", author: "Tom Becker", text: "Firmware window for edge routers." },
      { atOffsetMin: -7 * 24 * 60, type: "rejected", author: "Daniel Roth", text: "Rejected: vendor advisory recommends against this build." },
      { atOffsetMin: -6 * 24 * 60, type: "cancelled", author: "Tom Becker", text: "Window cancelled; new image expected 2026-11-27." },
    ],
    summary: null,
  }],
  ["MW-1051", {
    status: "Cancelled", type: "Planned", startMin: -12 * 24 * 60 - 150, endMin: -12 * 24 * 60 - 60,
    title: "Storage array expansion", description: "Add capacity to the storage array and migrate one LUN. Cancelled after budget review moved it to next quarter.",
    impact: "Cancelled; capacity headroom holds for ~6 weeks",
    servers: ["storage-01"], groups: ["backup-group"], services: ["storage"], tags: ["storage", "capex"],
    owner: "Nina Park", approver: "Ayesha Khan", approvalStatus: "Rejected", changeTicket: "CHG-2017", channels: ["Email"],
    mutedRuleIds: [], createdMinAgo: 15 * 24 * 60,
    timeline: [
      { atOffsetMin: -15 * 24 * 60, type: "created", author: "Nina Park", text: "Array expansion window proposed." },
      { atOffsetMin: -13 * 24 * 60, type: "rejected", author: "Ayesha Khan", text: "Rejected in budget review; resubmit in Q1." },
      { atOffsetMin: -12 * 24 * 60 - 400, type: "cancelled", author: "Nina Park", text: "Window cancelled; capacity monitoring alert raised." },
    ],
    summary: null,
  }],

  /* ------------------------------- In Progress (2) ------------------------------ */
  ["MW-1052", {
    status: "Scheduled", type: "Planned", startMin: -40, endMin: 110,
    title: "Database major upgrade db-01", description: "Major version upgrade of the primary database with online replica promotion. Change window includes pre-check, failover and post-checks.",
    impact: "Primary DB read-only, failover to replica, ~15 min write pause",
    servers: ["db-01"], groups: ["database-cluster", "prod-db"], services: ["database"], tags: ["database", "production"],
    owner: "Sara Iqbal", approver: "Ayesha Khan", approvalStatus: "Approved", changeTicket: "CHG-2041", channels: ["Slack", "Email", "PagerDuty"],
    mutedRuleIds: ["RUL-202", "RUL-206", "RUL-210", "RUL-212"], createdMinAgo: 6 * 24 * 60,
    timeline: [
      { atOffsetMin: -6 * 24 * 60, type: "created", author: "Sara Iqbal", text: "Window created from change request CHG-2041." },
      { atOffsetMin: -5 * 24 * 60, type: "approved", author: "Ayesha Khan", text: "Approved with DBA sign-off; freeze lifted for this window." },
      { atOffsetMin: -40, type: "started", author: "Sara Iqbal", text: "Pre-checks passed; upgrade started on the replica first." },
    ],
    summary: { suppressedAlerts: 34, suppressedIncidents: 1, actualStart: at(-38), actualEnd: null, notes: "In progress - replica upgrade complete, failover at :30 past the hour." },
  }],
  ["MW-1053", {
    status: "Scheduled", type: "Emergency", startMin: -25, endMin: 35,
    title: "Edge 5xx mitigation - CDN rule deploy", description: "Emergency rollout of the edge rule throttling abusive POST bodies after a 5xx spike from one tenant.",
    impact: "Edge rule rollout; possible 5xx blip for ~10 min during reload",
    servers: ["edge-01"], groups: ["edge-locations", "prod-edge"], services: ["edge-proxy"], tags: ["edge", "mitigation"],
    owner: "Tom Becker", approver: null, approvalStatus: "Approved", changeTicket: "CHG-2043", channels: ["Slack", "PagerDuty"],
    mutedRuleIds: ["RUL-207", "RUL-208", "RUL-215", "RUL-219", "RUL-224"], createdMinAgo: 40,
    timeline: [
      { atOffsetMin: -30, type: "created", author: "Tom Becker", text: "Emergency window opened; single-tenant 5xx spike from malformed POST bodies." },
      { atOffsetMin: -25, type: "started", author: "Tom Becker", text: "Edge rule deployed to 50% of fleet." },
    ],
    summary: { suppressedAlerts: 9, suppressedIncidents: 0, actualStart: at(-24), actualEnd: null, notes: "In progress - rolling to remaining edge nodes next." },
  }],

  /* -------------------------------- Scheduled (8) -------------------------------- */
  ["MW-1054", {
    status: "Scheduled", type: "Planned", startMin: 130, endMin: 175,
    title: "API server rolling restart", description: "Rolling restart of api-server-01 and api-server-02 to pick up the base image with the OpenSSL fix.",
    impact: "~5 min elevated latency during each node rotation; no full outage",
    servers: ["api-server-01", "api-server-02"], groups: ["api-services", "prod-api"], services: ["api-server"], tags: ["api", "production", "patching"],
    owner: "Marcus Lee", approver: "Priya Nair", approvalStatus: "Pending", changeTicket: "CHG-2045", channels: ["Slack"],
    mutedRuleIds: ["RUL-201", "RUL-203", "RUL-213"], createdMinAgo: 2 * 24 * 60,
    timeline: [
      { atOffsetMin: -2 * 24 * 60, type: "created", author: "Marcus Lee", text: "Rolling restart window for OpenSSL base image." },
    ],
    summary: null,
  }],
  ["MW-1055", {
    status: "Scheduled", type: "Recurring", startMin: 5 * 60 + 20, endMin: 5 * 60 + 50,
    title: "Weekly SSL certificate rotation check", description: "Verify cert rotation and expiry headroom on the web tier. Runs Sundays 22:30.",
    impact: "None expected; check is read-only",
    servers: ["web-app-01"], groups: ["production-web", "prod-web"], services: ["web-app"], tags: ["web", "tls"],
    owner: "Daniel Roth", approver: "Priya Nair", approvalStatus: "Approved", changeTicket: "CHG-2046", channels: ["Slack"],
    recurrence: { kind: "weekly", days: [0], until: dayIso(180) },
    mutedRuleIds: ["RUL-204", "RUL-216"], createdMinAgo: 12 * 24 * 60,
    timeline: [
      { atOffsetMin: -12 * 24 * 60, type: "created", author: "Daniel Roth", text: "Recurring weekly cert check." },
      { atOffsetMin: -11 * 24 * 60, type: "approved", author: "Priya Nair", text: "Approved (standing approval for the weekly series)." },
    ],
    summary: null,
  }],
  ["MW-1056", {
    status: "Scheduled", type: "Planned", startMin: 24 * 60 + 240, endMin: 24 * 60 + 360,
    title: "Web tier deploy v2.15.0", description: "Deploy v2.15.0 to the web tier behind the CDN. Canary 10% -> 50% -> 100% with a 15-minute soak at each step.",
    impact: "Possible 5xx blip at each canary step for ~2 min; no hard outage",
    servers: ["web-app-01", "web-02"], groups: ["production-web", "prod-web"], services: ["web-app"], tags: ["web", "deploy", "production"],
    owner: "Priya Nair", approver: "Ayesha Khan", approvalStatus: "Approved", changeTicket: "CHG-2048", channels: ["Slack", "Email"],
    mutedRuleIds: ["RUL-204", "RUL-214", "RUL-216"], createdMinAgo: 3 * 24 * 60,
    timeline: [
      { atOffsetMin: -3 * 24 * 60, type: "created", author: "Priya Nair", text: "Deploy window for v2.15.0 web tier." },
      { atOffsetMin: -2 * 24 * 60, type: "approved", author: "Ayesha Khan", text: "Approved with canary plan; freeze lifted for this window." },
    ],
    summary: null,
  }],
  ["MW-1057", {
    status: "Scheduled", type: "Planned", startMin: 2 * 24 * 60 + 360, endMin: 2 * 24 * 60 + 450,
    title: "Cache eviction policy migration", description: "Migrate cache-01 from allkeys-lru to volatile-lfu; requires cache flush between policy changes.",
    impact: "Cache hit ratio drops to ~40% for the first minutes; origin load elevated",
    servers: ["cache-01"], groups: ["cache-servers", "prod-cache"], services: ["cache"], tags: ["cache", "redis"],
    owner: "Marcus Lee", approver: "Nina Park", approvalStatus: "Pending", changeTicket: "CHG-2051", channels: ["Slack"],
    mutedRuleIds: ["RUL-211", "RUL-222"], createdMinAgo: 26 * 60,
    timeline: [
      { atOffsetMin: -26 * 60, type: "created", author: "Marcus Lee", text: "Eviction policy migration for cache-01." },
    ],
    summary: null,
  }],
  ["MW-1058", {
    status: "Scheduled", type: "Planned", startMin: 3 * 24 * 60 + 180, endMin: 3 * 24 * 60 + 210,
    title: "App server batch upgrade", description: "Apply the batch of OS + agent upgrades to app-server-02. Rolling, single node.",
    impact: "Batch workers drained for ~10 min; queued jobs delayed",
    servers: ["app-server-02"], groups: ["internal-services"], services: ["app-server", "scheduler"], tags: ["vm", "patching"],
    owner: "Daniel Roth", approver: "Marcus Lee", approvalStatus: "Approved", changeTicket: "CHG-2052", channels: ["Slack", "Email"],
    mutedRuleIds: ["RUL-205", "RUL-218"], createdMinAgo: 30 * 60,
    timeline: [
      { atOffsetMin: -30 * 60, type: "created", author: "Daniel Roth", text: "Batch upgrade window." },
      { atOffsetMin: -29 * 60, type: "approved", author: "Marcus Lee", text: "Approved." },
    ],
    summary: null,
  }],
  ["MW-1059", {
    status: "Scheduled", type: "Planned", startMin: 4 * 24 * 60 + 60, endMin: 4 * 24 * 60 + 300,
    title: "Quarterly disaster-recovery drill", description: "Full DR drill: promote replica, fail traffic at the edge, restore from backup to staging. All hands exercise.",
    impact: "Intermittent 503s during edge failover steps (~10 min total)",
    servers: ["db-01", "api-server-01", "web-app-01", "edge-01"], groups: ["database-cluster", "api-services", "production-web", "edge-locations"], services: ["database", "api-server", "web-app", "edge-proxy"], tags: ["dr", "production", "drill"],
    owner: "Nina Park", approver: "Omar Farooq", approvalStatus: "Pending", changeTicket: "CHG-2055", channels: ["Slack", "Email", "PagerDuty"],
    mutedRuleIds: ["RUL-201", "RUL-202", "RUL-203", "RUL-204", "RUL-206", "RUL-207", "RUL-210", "RUL-212", "RUL-215", "RUL-216", "RUL-219"], createdMinAgo: 52 * 60,
    timeline: [
      { atOffsetMin: -52 * 60, type: "created", author: "Nina Park", text: "Quarterly DR drill window. Change freeze for the drill day, 06:00-10:00." },
    ],
    summary: null,
  }],
  ["MW-1060", {
    status: "Scheduled", type: "Recurring", startMin: 6 * 24 * 60 + 120, endMin: 6 * 24 * 60 + 240,
    title: "Monthly backup verification", description: "Restore the latest db-01 backup to staging and verify checksums + app boot. Runs the 1st of each month.",
    impact: "None for production; staging unavailable during restore",
    servers: ["storage-01", "db-01"], groups: ["backup-group", "prod-db"], services: ["storage", "database"], tags: ["backup", "storage", "compliance"],
    owner: "Sara Iqbal", approver: "Ayesha Khan", approvalStatus: "Approved", changeTicket: "CHG-2056", channels: ["Slack", "Email"],
    recurrence: { kind: "monthly", days: [new Date(NOW).getDate()], until: dayIso(365) },
    mutedRuleIds: ["RUL-212"], createdMinAgo: 20 * 24 * 60,
    timeline: [
      { atOffsetMin: -20 * 24 * 60, type: "created", author: "Sara Iqbal", text: "Recurring monthly backup verification." },
      { atOffsetMin: -19 * 24 * 60, type: "approved", author: "Ayesha Khan", text: "Approved (standing approval for the monthly series)." },
    ],
    summary: null,
  }],
  ["MW-1061", {
    status: "Scheduled", type: "Planned", startMin: 8 * 24 * 60 + 90, endMin: 8 * 24 * 60 + 120,
    title: "API rate-limiter config rollout", description: "Roll out the per-tenant rate limit configuration refresh to the API edge. Staged by segment.",
    impact: "None expected; partners on default limits for ~15 min",
    servers: ["api-server-01", "edge-01"], groups: ["api-services", "edge-locations", "prod-api"], services: ["api-server", "edge-proxy"], tags: ["api", "edge", "config"],
    owner: "Ayesha Khan", approver: "Tom Becker", approvalStatus: "Approved", changeTicket: "CHG-2058", channels: ["Slack", "Email"],
    mutedRuleIds: ["RUL-213", "RUL-219", "RUL-225"], createdMinAgo: 70,
    timeline: [
      { atOffsetMin: -70, type: "created", author: "Ayesha Khan", text: "Rate-limiter config rollout window." },
      { atOffsetMin: -60, type: "approved", author: "Tom Becker", text: "Approved." },
    ],
    summary: null,
  }],
];

function buildSeed(): MaintenanceWindow[] {
  return SEED.map(([id, row]) => ({ id, ...seedRow(id, row) }));
}

let store: MaintenanceWindow[] = buildSeed();

const cloneWindow = (window: MaintenanceWindow): MaintenanceWindow => ({
  ...window,
  recurrence: { ...window.recurrence, days: [...window.recurrence.days] },
  scope: { ...window.scope, servers: [...window.scope.servers], groups: [...window.scope.groups], services: [...window.scope.services], tags: [...window.scope.tags], exclude: [...window.scope.exclude] },
  alertBehavior: { ...window.alertBehavior, mutedRuleIds: [...window.alertBehavior.mutedRuleIds] },
  notifyChannels: [...window.notifyChannels],
  timeline: window.timeline.map((entry) => ({ ...entry })),
  summary: window.summary ? { ...window.summary } : null,
});

/** Live lifecycle: stored status wins only for Cancelled; otherwise derive from start/end vs now. */
export function effectiveStatus(window: Pick<MaintenanceWindow, "status" | "start" | "end">, nowMs = Date.now()): MaintenanceWindowStatus {
  if (window.status === "Cancelled") return "Cancelled";
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    if (nowMs >= start && nowMs < end) return "In Progress";
    if (nowMs >= end) return "Completed";
    return "Scheduled";
  }
  return window.status;
}

/** Clone + attach the derived live status. */
export function withDerivedStatus(window: MaintenanceWindow, nowMs = Date.now()): MaintenanceWindow {
  return { ...cloneWindow(window), status: effectiveStatus(window, nowMs) };
}

/** Snapshot of the module store for hook consumers (clones every record, derived status). */
export function readMaintenanceWindowStore(nowMs = Date.now()): MaintenanceWindow[] {
  return store.map((window) => withDerivedStatus(window, nowMs));
}

/** Async mock fetch - swap the body for a real `fetch("/api/maintenance-windows")` later. */
export function fetchMaintenanceWindows(): Promise<MaintenanceWindow[]> {
  return new Promise((resolve) => {
    const timer = typeof window !== "undefined" ? window.setTimeout : setTimeout;
    timer(() => resolve(readMaintenanceWindowStore()), 200 + Math.random() * 200);
  });
}

/** Timeline entry factory used by the store actions. */
export function makeTimelineEntry(type: MaintenanceTimelineType, author: string, text: string): MaintenanceTimelineEntry {
  const now = Date.now();
  return { id: `tl-${now}-${Math.random().toString(36).slice(2, 7)}`, at: new Date(now).toISOString(), epochMs: now, type, author, text };
}

/** Low-level store mutation used by the client actions. */
export function mutateMaintenanceWindows(ids: string[], patch: (window: MaintenanceWindow) => Partial<MaintenanceWindow> | null, entries: (window: MaintenanceWindow) => MaintenanceTimelineEntry[]): void {
  store = store.map((window) => {
    if (!ids.includes(window.id)) return window;
    const partial = patch(window);
    if (!partial) return window;
    return { ...window, ...partial, timeline: [...window.timeline, ...entries(window)] };
  });
}

/** Prepend a created window to the store (id assigned by the caller). */
export function appendMaintenanceWindowToStore(window: MaintenanceWindow): void {
  store = [window, ...store];
}

export interface CreateMaintenanceWindowInput {
  title: string;
  description: string;
  type: MaintenanceWindowType;
  start: string;
  end: string;
  timeZone: string;
  recurrence: MaintenanceRecurrence;
  scope: MaintenanceScope;
  alertBehavior: MaintenanceAlertBehavior;
  owner: string;
  approver: string | null;
  approvalStatus: MaintenanceApprovalStatus;
  changeTicket: string | null;
  notifyChannels: string[];
  impact: string;
  statusUpdate?: string;
}

export function nextMaintenanceWindowId(): string {
  const highest = store.reduce((max, window) => {
    const value = Number.parseInt(window.id.replace("MW-", ""), 10);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 1061);
  return `MW-${highest + 1}`;
}

/* ------------------------------ derivations -------------------------------- */

/** Windows currently in progress (live status), cloned. */
export function activeMaintenanceWindows(nowMs = Date.now()): MaintenanceWindow[] {
  return readMaintenanceWindowStore(nowMs).filter((window) => window.status === "In Progress");
}

/**
 * Canonical All-Servers name -> ops-style names covered by maintenance scope.
 * All Servers uses canonical names (prod-api-01 ...); the ops mocks use
 * api-server-01 ... - this bridge lets one helper answer for both pages.
 */
export const CANONICAL_TO_OPS: Record<string, string[]> = {
  "prod-api-01": ["api-server-01", "api-server-02"],
  "db-primary": ["db-01"],
  "web-frontend-01": ["web-app-01"],
  "cache-server-01": ["cache-01"],
  "app-worker-02": ["app-server-02", "worker-01"],
};

/** True when an *in-progress* window scopes this server (accepts ops or canonical names). */
export function isServerInMaintenance(serverName: string, nowMs = Date.now()): boolean {
  const active = activeMaintenanceWindows(nowMs);
  if (active.length === 0) return false;
  const opsNames = new Set<string>([serverName, ...(CANONICAL_TO_OPS[serverName] ?? [])]);
  return active.some((window) => window.scope.servers.some((server) => opsNames.has(server)));
}

/** Id of the window muting this rule right now (In Progress or upcoming Scheduled), else null. */
export function maintenanceWindowMutingRule(ruleId: string, nowMs = Date.now()): string | null {
  const windows = readMaintenanceWindowStore(nowMs);
  const active = windows.find((window) => window.status === "In Progress" && window.alertBehavior.mutedRuleIds.includes(ruleId));
  if (active) return active.id;
  const next = windows
    .filter((window) => window.status === "Scheduled" && window.alertBehavior.muteAlerts && window.alertBehavior.mutedRuleIds.includes(ruleId))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  return next?.id ?? null;
}

/** Unique scope servers across currently in-progress windows. */
export function serversInMaintenance(nowMs = Date.now()): string[] {
  const hosts = new Set<string>();
  for (const window of activeMaintenanceWindows(nowMs)) for (const server of scopeHosts(window.scope)) hosts.add(server);
  return [...hosts];
}

/** Total alerts suppressed in the last 24h (completed-in-24h + in-progress actuals). */
export function alertsSuppressed24h(nowMs = Date.now()): number {
  const dayMs = 24 * 60 * MIN;
  return readMaintenanceWindowStore(nowMs)
    .filter((window) => window.summary != null)
    .filter((window) => {
      const started = Date.parse(window.summary?.actualStart ?? window.start);
      const ended = window.summary?.actualEnd ? Date.parse(window.summary.actualEnd) : nowMs;
      return ended >= nowMs - dayMs && started <= nowMs;
    })
    .reduce((sum, window) => sum + (window.summary?.suppressedAlerts ?? 0), 0);
}

/** Total incidents suppressed in the last 24h (completed-in-24h + in-progress actuals). */
export function incidentsSuppressed24h(nowMs = Date.now()): number {
  const dayMs = 24 * 60 * MIN;
  return readMaintenanceWindowStore(nowMs)
    .filter((window) => window.summary != null)
    .filter((window) => {
      const started = Date.parse(window.summary?.actualStart ?? window.start);
      const ended = window.summary?.actualEnd ? Date.parse(window.summary.actualEnd) : nowMs;
      return ended >= nowMs - dayMs && started <= nowMs;
    })
    .reduce((sum, window) => sum + (window.summary?.suppressedIncidents ?? 0), 0);
}

/** Per-day suppressed alerts for the trailing `days` days (each window spreads across its span). */
export function suppressedAlertsByDay(days: number, nowMs = Date.now()): Array<{ label: string; key: string; alerts: number }> {
  const dayMs = 24 * 60 * MIN;
  const buckets: Array<{ label: string; key: string; alerts: number; start: number; end: number }> = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const end = nowMs - index * dayMs;
    const start = end - dayMs;
    buckets.push({
      key: `${start}`,
      label: new Date(start).toLocaleDateString(undefined, { weekday: "short" }),
      alerts: 0,
      start,
      end,
    });
  }
  for (const window of readMaintenanceWindowStore(nowMs)) {
    const suppressed = window.summary?.suppressedAlerts ?? 0;
    if (suppressed <= 0) continue;
    const from = Date.parse(window.summary?.actualStart ?? window.start);
    const to = window.summary?.actualEnd ? Date.parse(window.summary.actualEnd) : nowMs;
    const spanMs = Math.max(to - from, MIN);
    for (const bucket of buckets) {
      const overlap = Math.min(to, bucket.end) - Math.max(from, bucket.start);
      if (overlap <= 0) continue;
      bucket.alerts += Math.round((suppressed * overlap) / spanMs);
    }
  }
  return buckets.map(({ label, key, alerts }) => ({ label, key, alerts }));
}

export interface GroupMaintenanceStat { group: string; name: string; windows: number; hours: number }

/** Windows + hours per server group, for the "Maintenance by Group" insight. */
export function maintenanceByGroup(nowMs = Date.now()): GroupMaintenanceStat[] {
  const stats = new Map<string, { windows: number; hours: number }>();
  for (const window of readMaintenanceWindowStore(nowMs)) {
    if (window.status === "Cancelled") continue;
    const groups = window.scope.groups.length > 0
      ? window.scope.groups
      : (() => {
          const hosts = new Set(window.scope.servers);
          return Object.entries(GROUP_TO_HOSTS).filter(([, hostsForGroup]) => hostsForGroup.some((host) => hosts.has(host))).map(([group]) => group);
        })();
    const durationHours = Math.max(0, (Date.parse(window.end) - Date.parse(window.start)) / (60 * MIN));
    for (const group of groups) {
      const entry = stats.get(group) ?? { windows: 0, hours: 0 };
      entry.windows += 1;
      entry.hours += durationHours;
      stats.set(group, entry);
    }
  }
  const names = new Map(SCOPE_GROUPS.map((group) => [group.id, group.name]));
  return [...stats.entries()]
    .map(([group, value]) => ({ group, name: names.get(group) ?? group, windows: value.windows, hours: Math.round(value.hours) }))
    .sort((a, b) => b.windows - a.windows || b.hours - a.hours);
}

/** Windows overlapping the range [fromMs, toMs) - used by the form's conflict check. */
export function overlappingWindows(scope: Pick<MaintenanceScope, "servers" | "groups">, startMs: number, endMs: number, excludeId?: string): MaintenanceWindow[] {
  const hosts = new Set(scopeHosts(scope));
  if (hosts.size === 0) return [];
  return readMaintenanceWindowStore().filter((window) => {
    if (excludeId && window.id === excludeId) return false;
    if (window.status === "Cancelled") return false;
    const start = Date.parse(window.start);
    const end = Date.parse(window.end);
    if (!(start < endMs && end > startMs)) return false;
    return scopeHosts(window.scope).some((host) => hosts.has(host));
  });
}

export { CURRENT_USER_NAME };
