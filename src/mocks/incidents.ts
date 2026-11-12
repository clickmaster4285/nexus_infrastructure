/**
 * Incidents mock data — single source of truth.
 *
 * 30 seeded incidents, newest = INC-1048, covering the last 29 days relative
 * to module load (`Date.now()`). Severity split: SEV1 3 / SEV2 7 / SEV3 12 /
 * SEV4 8. Status split: Investigating 2, Identified 2, Monitoring 2,
 * Resolved 24. Every number on the page (banner, stat cards, MTTA/MTTR,
 * trend buckets, donut, top services, on-call and NOC's "Active Incidents")
 * derives from this one array, so the pages can never contradict each other.
 *
 * To swap in a real API later, replace `fetchIncidents` (and the action
 * functions) — the types and derived shapes stay. The module-level store is
 * seeded once per page load; actions mutate it in-memory so Declare → detail
 * redirect works across client-side navigation.
 */

import { SAMPLE_ALERTS } from "@/mocks/alerts";

export type IncidentSeverity = "SEV1" | "SEV2" | "SEV3" | "SEV4";
export type IncidentStatus = "Investigating" | "Identified" | "Monitoring" | "Resolved";
export type TimelineEntryType = "created" | "acknowledged" | "update" | "escalated" | "resolved";
export type PostmortemStatus = "None" | "Draft" | "Published";

export interface IncidentTimelineEntry {
  id: string;
  /** ISO 8601 timestamp. */
  at: string;
  epochMs: number;
  type: TimelineEntryType;
  author: string;
  text: string;
}

export interface ActionItem {
  id: string;
  text: string;
  owner: string;
  /** ISO date (yyyy-mm-dd) or display string for due date. */
  due: string;
  done: boolean;
}

export interface Postmortem {
  status: PostmortemStatus;
  summary: string;
  rootCause: string;
  impact: string;
  actionItems: ActionItem[];
}

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  commander: string;
  assignee: string | null;
  team: string;
  affectedServices: string[];
  affectedHosts: string[];
  linkedAlertIds: string[];
  /** One-line customer/business impact, e.g. "Payments degraded for ~12% users". */
  impact: string;
  startedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  rootCause: string;
  timeline: IncidentTimelineEntry[];
  postmortem: Postmortem;
  tags: string[];
}

/* ---------------------------------- people --------------------------------- */

export const CURRENT_USER_NAME = "Ayesha Khan";
export const CURRENT_USER_EMAIL = "ayesha@nexus.io";

export const INCIDENT_PEOPLE = ["Ayesha Khan", "Marcus Lee", "Priya Nair", "Tom Becker", "Sara Iqbal", "Daniel Roth", "Nina Park", "Omar Farooq"] as const;

export const INCIDENT_TEAMS = ["SRE", "Platform", "Backend", "Database", "Network Ops"] as const;

/** Service → canonical hosts (hosts match the Alerts/Events mocks). */
export const SERVICE_HOSTS: Record<string, string[]> = {
  "api-server": ["api-server-01", "api-server-02"],
  "web-app": ["web-app-01", "web-02"],
  "database": ["db-01"],
  "cache": ["cache-01"],
  "edge-proxy": ["edge-01"],
  "scheduler": ["worker-01"],
  "payment": ["pay-01"],
  "storage": ["storage-01"],
  "app-server": ["app-server-02"],
};

export const INCIDENT_SERVICES = Object.keys(SERVICE_HOSTS);

/* ---------------------------------- seed ---------------------------------- */

const NOW = Date.now();
const MIN = 60_000;
const isoMinAgo = (minutes: number) => new Date(NOW - minutes * MIN).toISOString();
const dateMinAgo = (minutes: number) => NOW - minutes * MIN;
const dueIn = (days: number) => new Date(NOW + days * 24 * 60 * MIN).toISOString().slice(0, 10);

interface SeedRow {
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedMinAgo: number;
  /** Minutes from start → acknowledge. null = not acknowledged. */
  ackAfterMin: number | null;
  /** Minutes from start → resolved. null = still open. */
  resolveAfterMin: number | null;
  title: string;
  services: string[];
  hosts: string[];
  commander: string;
  assignee: string | null;
  team: string;
  impact: string;
  rootCause: string;
  tags: string[];
  linkedAlertIds: string[];
  updates: Array<{ atOffsetMin: number; author: string; text: string }>;
  escalated?: boolean;
  postmortem?: Omit<Postmortem, "status"> & { status: Exclude<PostmortemStatus, "None"> };
}

const NO_POSTMORTEM: Postmortem = { status: "None", summary: "", rootCause: "", impact: "", actionItems: [] };

const SEED: SeedRow[] = [
  { // INC-1019
    severity: "SEV3", status: "Resolved", startedMinAgo: 40500, ackAfterMin: 9, resolveAfterMin: 265,
    title: "Database backup verification failures", services: ["database"], hosts: ["db-01"],
    commander: "Sara Iqbal", assignee: "Sara Iqbal", team: "Database",
    impact: "Nightly backup verification failing for 2 cycles",
    rootCause: "Backup snapshot verification script timed out against the expanded table set after the November schema migration.",
    tags: ["database", "backup"], linkedAlertIds: ["ALT-1031"],
    updates: [{ atOffsetMin: 120, author: "Sara Iqbal", text: "Re-ran verification against a throttled window; jobs passing again." }],
    postmortem: {
      status: "Draft",
      summary: "Backup verification lagged behind the schema growth; no data loss, two cycles of delayed assurance.",
      rootCause: "Verification script timeout and missing index on the snapshot metadata table.",
      impact: "Verification delayed up to 6h; recovery point objective unchanged.",
      actionItems: [
        { id: "ai-1019-1", text: "Raise verification job timeout to 45m", owner: "Sara Iqbal", due: dueIn(3), done: true },
        { id: "ai-1019-2", text: "Add index on snapshot metadata", owner: "Sara Iqbal", due: dueIn(5), done: true },
        { id: "ai-1019-3", text: "Alert when verification lag > 2 cycles", owner: "Ayesha Khan", due: dueIn(9), done: false },
      ],
    },
  },
  { // INC-1020
    severity: "SEV4", status: "Resolved", startedMinAgo: 37800, ackAfterMin: 6, resolveAfterMin: 110,
    title: "Static asset CDN origin timeouts", services: ["web-app"], hosts: ["web-02"],
    commander: "Priya Nair", assignee: "Priya Nair", team: "Backend",
    impact: "Intermittent 304/504 on static assets for EU users",
    rootCause: "Origin read timeout on the CDN edge pool after a certificate rotation; stale keep-alive connections were reused.",
    tags: ["cdn", "web"], linkedAlertIds: ["ALT-1032"],
    updates: [],
  },
  { // INC-1021
    severity: "SEV3", status: "Resolved", startedMinAgo: 35000, ackAfterMin: 15, resolveAfterMin: 225,
    title: "Cache node cache-01 flapping", services: ["cache"], hosts: ["cache-01"],
    commander: "Marcus Lee", assignee: "Nina Park", team: "Platform",
    impact: "Elevated origin load; cache hit ratio dropped to 58%",
    rootCause: "Memory fragmentation after eviction policy change; node restarted under memory pressure.",
    tags: ["cache", "redis"], linkedAlertIds: ["ALT-1033"],
    updates: [{ atOffsetMin: 90, author: "Marcus Lee", text: "Failing over read traffic to replica; primary recovering." }],
  },
  { // INC-1022
    severity: "SEV3", status: "Resolved", startedMinAgo: 33000, ackAfterMin: 10, resolveAfterMin: 295,
    title: "Search indexing fell behind", services: ["app-server"], hosts: ["app-server-02"],
    commander: "Nina Park", assignee: "Nina Park", team: "Platform",
    impact: "New documents searchable after ~20 minutes instead of 1",
    rootCause: "Index worker throughput halved after a library upgrade changed default batch size from 500 to 100.",
    tags: ["search", "indexing"], linkedAlertIds: ["ALT-1034"],
    updates: [],
  },
  { // INC-1023
    severity: "SEV4", status: "Resolved", startedMinAgo: 30900, ackAfterMin: 7, resolveAfterMin: 85,
    title: "Cron overlap on worker-01", services: ["scheduler"], hosts: ["worker-01"],
    commander: "Daniel Roth", assignee: "Daniel Roth", team: "SRE",
    impact: "Duplicate nightly report emails sent to 3 recipients",
    rootCause: "Two overlapping cron schedules after timezone change; both fired on the DST boundary.",
    tags: ["scheduler", "cron"], linkedAlertIds: ["ALT-1035"],
    updates: [],
  },
  { // INC-1024
    severity: "SEV3", status: "Resolved", startedMinAgo: 29100, ackAfterMin: 12, resolveAfterMin: 210,
    title: "Disk IO saturation on db-01", services: ["database"], hosts: ["db-01"],
    commander: "Sara Iqbal", assignee: "Daniel Roth", team: "Database",
    impact: "Query p95 latency up 40% during business hours",
    rootCause: "Vacuum running concurrently with month-end report queries; IOPS budget exhausted.",
    tags: ["database", "storage"], linkedAlertIds: ["ALT-1036"],
    updates: [{ atOffsetMin: 110, author: "Sara Iqbal", text: "Moved vacuum window; latency back to baseline." }],
  },
  { // INC-1025
    severity: "SEV4", status: "Resolved", startedMinAgo: 27500, ackAfterMin: 5, resolveAfterMin: 130,
    title: "WebSocket disconnects on mobile clients", services: ["edge-proxy"], hosts: ["edge-01"],
    commander: "Tom Becker", assignee: "Tom Becker", team: "Network Ops",
    impact: "~3% of mobile sessions reconnected once; no data loss",
    rootCause: "Idle timeout on the edge load balancer set to 30s, lower than client heartbeat interval of 45s.",
    tags: ["network", "mobile"], linkedAlertIds: ["ALT-1037"],
    updates: [],
  },
  { // INC-1026
    severity: "SEV2", status: "Resolved", startedMinAgo: 25400, ackAfterMin: 17, resolveAfterMin: 340,
    title: "API rate limiting misconfigured", services: ["api-server"], hosts: ["api-server-02"],
    commander: "Marcus Lee", assignee: "Marcus Lee", team: "Platform",
    impact: "Legitimate partners throttled to 10% of contracted rate",
    rootCause: "Rate limit key collision after a refactor of the gateway token bucket; partner tier limits not loaded.",
    tags: ["api", "rate-limit"], linkedAlertIds: ["ALT-1004", "ALT-1009"],
    updates: [{ atOffsetMin: 180, author: "Marcus Lee", text: "Partner limits restored from config snapshot; reviewing diff." }],
    postmortem: {
      status: "Published",
      summary: "Partner API consumers were over-throttled for ~5.5h after a rate limiter refactor shipped.",
      rootCause: "Configuration refactor dropped the partner tier override; default 100 rpm applied to all tenants.",
      impact: "12 partner integrations degraded; 4 SLA breach notifications sent.",
      actionItems: [
        { id: "ai-1026-1", text: "Add config lint for tenant overrides", owner: "Marcus Lee", due: dueIn(2), done: true },
        { id: "ai-1026-2", text: "Canary deploys for gateway config", owner: "Nina Park", due: dueIn(6), done: true },
        { id: "ai-1026-3", text: "Partner SLA notification runbook", owner: "Priya Nair", due: dueIn(11), done: true },
        { id: "ai-1026-4", text: "Monthly config drift audit", owner: "Daniel Roth", due: dueIn(14), done: false },
        { id: "ai-1026-5", text: "Regression test for tier resolution", owner: "Marcus Lee", due: dueIn(16), done: false },
      ],
    },
  },
  { // INC-1027
    severity: "SEV3", status: "Resolved", startedMinAgo: 23200, ackAfterMin: 8, resolveAfterMin: 175,
    title: "Stripe webhook retries exhausted", services: ["payment"], hosts: ["pay-01"],
    commander: "Omar Farooq", assignee: "Omar Farooq", team: "Backend",
    impact: "Delayed payment confirmations for ~40 orders",
    rootCause: "Webhook secret rotated without updating the payment service environment; signature verification failed.",
    tags: ["payment", "stripe"], linkedAlertIds: ["ALT-1006"],
    updates: [{ atOffsetMin: 60, author: "Omar Farooq", text: "Secret updated; replaying failed events from the dead-letter queue." }],
  },
  { // INC-1028
    severity: "SEV3", status: "Resolved", startedMinAgo: 21300, ackAfterMin: 14, resolveAfterMin: 240,
    title: "Image pulls failing on staging workers", services: ["app-server"], hosts: ["app-server-02"],
    commander: "Nina Park", assignee: "Nina Park", team: "Platform",
    impact: "Staging deploys blocked for 4h; production unaffected",
    rootCause: "Registry credentials expired on the staging pull secret; cluster autoscaler created new nodes without it.",
    tags: ["registry", "staging"], linkedAlertIds: ["ALT-1038"],
    updates: [],
  },
  { // INC-1029
    severity: "SEV4", status: "Resolved", startedMinAgo: 19400, ackAfterMin: 9, resolveAfterMin: 65,
    title: "Minor latency blip on web-app-01", services: ["web-app"], hosts: ["web-app-01"],
    commander: "Priya Nair", assignee: "Priya Nair", team: "Backend",
    impact: "p95 +150ms for 8 minutes; no user impact reported",
    rootCause: "Noisy neighbor on the shared nodes during batch analytics window.",
    tags: ["web", "latency"], linkedAlertIds: ["ALT-1018"],
    updates: [],
  },
  { // INC-1030
    severity: "SEV2", status: "Resolved", startedMinAgo: 17600, ackAfterMin: 6, resolveAfterMin: 285,
    title: "Database failover rehearsal triggered alerts", services: ["database"], hosts: ["db-01"],
    commander: "Sara Iqbal", assignee: "Daniel Roth", team: "Database",
    impact: "30s of read-only mode during planned failover rehearsal",
    rootCause: "Expected behavior of the rehearsal; alerting thresholds not suppressed for the maintenance window.",
    tags: ["database", "failover"], linkedAlertIds: ["ALT-1002"],
    updates: [{ atOffsetMin: 30, author: "Sara Iqbal", text: "Marking as drill; annotating timeline for the postmortem." }],
    postmortem: {
      status: "Draft",
      summary: "Planned failover rehearsal completed in 28s; alert noise was not suppressed during the window.",
      rootCause: "Alertmanager inhibition rule missing for the db-failover-drill maintenance window.",
      impact: "Read-only mode for 28s; zero write loss; 2 false escalations.",
      actionItems: [
        { id: "ai-1030-1", text: "Auto-inhibit alerts during declared drills", owner: "Daniel Roth", due: dueIn(4), done: true },
        { id: "ai-1030-2", text: "Add drill banner to status page", owner: "Priya Nair", due: dueIn(8), done: false },
        { id: "ai-1030-3", text: "Rehearse again after inhibit fix", owner: "Sara Iqbal", due: dueIn(20), done: false },
      ],
    },
  },
  { // INC-1031
    severity: "SEV3", status: "Resolved", startedMinAgo: 15800, ackAfterMin: 11, resolveAfterMin: 190,
    title: "Cache evictions spike after flush", services: ["cache"], hosts: ["cache-01"],
    commander: "Marcus Lee", assignee: "Marcus Lee", team: "Platform",
    impact: "Origin request rate +80% for 25 minutes",
    rootCause: "Manual cache flush during incident response dropped hit ratio from 84% to 31%; refill storm followed.",
    tags: ["cache", "redis"], linkedAlertIds: ["ALT-1021"],
    updates: [],
  },
  { // INC-1032
    severity: "SEV1", status: "Resolved", startedMinAgo: 13200, ackAfterMin: 4, resolveAfterMin: 520,
    title: "Regional network partition: edge-01 unreachable", services: ["edge-proxy", "web-app"], hosts: ["edge-01", "web-02"],
    commander: "Tom Becker", assignee: "Tom Becker", team: "Network Ops",
    impact: "External traffic to EU-West impaired for ~4h; ~35% of users",
    rootCause: "Upstream ISP maintenance withdrew the primary BGP path without notice; failover peering was not pre-warmed.",
    tags: ["network", "bgp", "availability"], linkedAlertIds: ["ALT-1001", "ALT-1005", "ALT-1011"],
    updates: [
      { atOffsetMin: 45, author: "Tom Becker", text: "Traffic drained to EU-Central edge; error rate normalizing." },
      { atOffsetMin: 240, author: "Tom Becker", text: "Primary path restored by ISP; monitoring stability before close-out." },
    ],
    escalated: true,
    postmortem: {
      status: "Published",
      summary: "An unannounced ISP maintenance caused a 4h partial regional outage; single-peer dependency was the systemic gap.",
      rootCause: "Unannounced ISP path withdrawal; failover link at 40% capacity and never validated under load.",
      impact: "~35% of users saw errors or timeouts for 4h 10m; status page updated hourly.",
      actionItems: [
        { id: "ai-1032-1", text: "Pre-warm failover peering to 100%", owner: "Tom Becker", due: dueIn(1), done: true },
        { id: "ai-1032-2", text: "Quarterly failover load test", owner: "Tom Becker", due: dueIn(30), done: false },
        { id: "ai-1032-3", text: "Dual-provider requirement for edge sites", owner: "Nina Park", due: dueIn(45), done: false },
        { id: "ai-1032-4", text: "ISP maintenance notification SLA", owner: "Tom Becker", due: dueIn(21), done: true },
      ],
    },
  },
  { // INC-1033
    severity: "SEV4", status: "Resolved", startedMinAgo: 11500, ackAfterMin: 13, resolveAfterMin: 150,
    title: "Log ingestion lag in scheduler workers", services: ["scheduler"], hosts: ["worker-01"],
    commander: "Daniel Roth", assignee: "Daniel Roth", team: "SRE",
    impact: "Logs delayed up to 10 minutes; no alerting impact",
    rootCause: "Batch flush interval misconfigured to 600s after a logging-agent upgrade.",
    tags: ["logging", "observability"], linkedAlertIds: ["ALT-1025"],
    updates: [],
  },
  { // INC-1034
    severity: "SEV3", status: "Resolved", startedMinAgo: 9700, ackAfterMin: 7, resolveAfterMin: 205,
    title: "High CPU on worker-01", services: ["scheduler"], hosts: ["worker-01"],
    commander: "Daniel Roth", assignee: "Daniel Roth", team: "SRE",
    impact: "Job throughput halved for 3h; queue drained normally",
    rootCause: "Report-generation job fan-out leaked worker loops after a refactor; 40 duplicate workers spawned.",
    tags: ["scheduler", "cpu"], linkedAlertIds: ["ALT-1027"],
    updates: [{ atOffsetMin: 100, author: "Daniel Roth", text: "Rolled back the fan-out change; workers stable." }],
  },
  { // INC-1035
    severity: "SEV4", status: "Resolved", startedMinAgo: 8450, ackAfterMin: 10, resolveAfterMin: 75,
    title: "Scheduled backups delayed", services: ["storage"], hosts: ["storage-01"],
    commander: "Ayesha Khan", assignee: "Ayesha Khan", team: "SRE",
    impact: "Backups completed 50 minutes late; RPO unaffected",
    rootCause: "Snapshot lock contention with the weekly scrub job.",
    tags: ["storage", "backup"], linkedAlertIds: ["ALT-1030"],
    updates: [],
  },
  { // INC-1036
    severity: "SEV2", status: "Resolved", startedMinAgo: 6120, ackAfterMin: 18, resolveAfterMin: 380,
    title: "Payment callbacks timing out", services: ["payment", "api-server"], hosts: ["pay-01", "api-server-01"],
    commander: "Omar Farooq", assignee: "Omar Farooq", team: "Backend",
    impact: "~8% of payment confirmations delayed > 2 minutes",
    rootCause: "TLS handshake failures between the payment gateway and the callback service after cipher suite update.",
    tags: ["payment", "tls"], linkedAlertIds: ["ALT-1006", "ALT-1008"],
    updates: [{ atOffsetMin: 200, author: "Omar Farooq", text: "Cipher list rolled back; callback latency normal." }],
    escalated: true,
    postmortem: {
      status: "Published",
      summary: "A cipher-suite rollout broke gateway callbacks for ~6h; detected by synthetic probe, not by alerts.",
      rootCause: "TLS policy change removed TLS_RSA_WITH_AES_128_GCM_SHA256 required by the legacy gateway client.",
      impact: "~8% of transactions delayed; auto-retry recovered all; zero financial impact.",
      actionItems: [
        { id: "ai-1036-1", text: "Synthetic payment probe every 30s", owner: "Omar Farooq", due: dueIn(2), done: true },
        { id: "ai-1036-2", text: "TLS compatibility matrix in CI", owner: "Nina Park", due: dueIn(12), done: true },
        { id: "ai-1036-3", text: "Gateway client upgrade plan", owner: "Omar Farooq", due: dueIn(35), done: false },
      ],
    },
  },
  { // INC-1037
    severity: "SEV3", status: "Resolved", startedMinAgo: 4260, ackAfterMin: 8, resolveAfterMin: 260,
    title: "Memory pressure on app-server-02", services: ["app-server"], hosts: ["app-server-02"],
    commander: "Nina Park", assignee: "Nina Park", team: "Platform",
    impact: "Pod restarts every ~15 minutes; requests recycled",
    rootCause: "Memory leak in the PDF rendering worker after the 2.13 release; heap grew 90MB/h.",
    tags: ["memory", "app-server"], linkedAlertIds: ["ALT-1020"],
    updates: [{ atOffsetMin: 150, author: "Nina Park", text: "Heap dump confirms leak in renderer; rolling restart cadence 30m." }],
    postmortem: {
      status: "Draft",
      summary: "PDF renderer leaked ~1.5GB/day in containers, causing periodic OOM restarts on app-server-02.",
      rootCause: "2.13.0 renderer cached font buffers globally; cache never evicted.",
      impact: "2 pods restarted per hour for 4h 20m; request retry masked user impact.",
      actionItems: [
        { id: "ai-1037-1", text: "Fix font buffer cache eviction", owner: "Nina Park", due: dueIn(3), done: true },
        { id: "ai-1037-2", text: "Set container memory limits + alerts", owner: "Marcus Lee", due: dueIn(7), done: false },
        { id: "ai-1037-3", text: "Add heap growth assertion to smoke tests", owner: "Nina Park", due: dueIn(10), done: false },
      ],
    },
  },
  { // INC-1038
    severity: "SEV4", status: "Resolved", startedMinAgo: 3900, ackAfterMin: 15, resolveAfterMin: 120,
    title: "Intermittent DNS resolution failures", services: ["edge-proxy"], hosts: ["edge-01"],
    commander: "Tom Becker", assignee: "Tom Becker", team: "Network Ops",
    impact: "Sparse NXDOMAIN responses; retries succeeded",
    rootCause: "Stale anycast route to one DNS resolver after upstream maintenance.",
    tags: ["dns", "network"], linkedAlertIds: ["ALT-1017"],
    updates: [],
  },
  { // INC-1039
    severity: "SEV2", status: "Resolved", startedMinAgo: 2580, ackAfterMin: 5, resolveAfterMin: 310,
    title: "PostgreSQL replication lag 45s", services: ["database"], hosts: ["db-01"],
    commander: "Sara Iqbal", assignee: "Sara Iqbal", team: "Database",
    impact: "Read replicas served stale reads; reporting delayed",
    rootCause: "Tuning regression reduced max_wal_senders efficiency; apply worker starved under batch load.",
    tags: ["database", "replication"], linkedAlertIds: ["ALT-1002", "ALT-1014"],
    updates: [{ atOffsetMin: 120, author: "Sara Iqbal", text: "Replica caught up; lag back under 1s." }],
    postmortem: {
      status: "Published",
      summary: "Replication lag hit 45s during batch window; read-your-writes broken for reports.",
      rootCause: "WAL apply worker starved after checkpoint tuning change; batch jobs not rescheduled.",
      impact: "Reporting up to 1 min stale; no transactional corruption.",
      actionItems: [
        { id: "ai-1039-1", text: "Pin apply worker to dedicated CPUs", owner: "Sara Iqbal", due: dueIn(2), done: true },
        { id: "ai-1039-2", text: "Replication lag SLO alert at 10s", owner: "Ayesha Khan", due: dueIn(5), done: true },
        { id: "ai-1039-3", text: "Batch window isolation review", owner: "Sara Iqbal", due: dueIn(9), done: true },
        { id: "ai-1039-4", text: "Lag dashboard for on-call", owner: "Daniel Roth", due: dueIn(13), done: true },
        { id: "ai-1039-5", text: "Failover drill with lag scenario", owner: "Sara Iqbal", due: dueIn(28), done: false },
      ],
    },
  },
  { // INC-1040
    severity: "SEV4", status: "Resolved", startedMinAgo: 1310, ackAfterMin: 9, resolveAfterMin: 95,
    title: "TLS certificate for status page nearing expiry", services: ["edge-proxy"], hosts: ["edge-01"],
    commander: "Tom Becker", assignee: "Tom Becker", team: "Network Ops",
    impact: "Public status page cert would expire in 6 days",
    rootCause: "Automation renewed the SAN for the apex domain but not the status subdomain.",
    tags: ["tls", "certificates"], linkedAlertIds: ["ALT-1029"],
    updates: [],
  },
  { // INC-1041
    severity: "SEV3", status: "Resolved", startedMinAgo: 720, ackAfterMin: 12, resolveAfterMin: 180,
    title: "Disk usage above 85% on storage-01", services: ["storage"], hosts: ["storage-01"],
    commander: "Ayesha Khan", assignee: "Daniel Roth", team: "SRE",
    impact: "Backup retention at risk; no data loss",
    rootCause: "Log retention policy stopped applying after the logrotate config refactor.",
    tags: ["storage", "disk"], linkedAlertIds: ["ALT-1030"],
    updates: [{ atOffsetMin: 90, author: "Ayesha Khan", text: "Purged 400GB of unrotated logs; usage at 71%." }],
  },
  { // INC-1042
    severity: "SEV2", status: "Resolved", startedMinAgo: 395, ackAfterMin: 6, resolveAfterMin: 235,
    title: "API error spikes after deploy v2.14.3", services: ["api-server"], hosts: ["api-server-01", "api-server-02"],
    commander: "Marcus Lee", assignee: "Priya Nair", team: "Platform",
    impact: "Error rate 4.1% for ~4h; rollback completed",
    rootCause: "v2.14.3 introduced a null-handling bug in the orders serializer; crash loop on malformed carts.",
    tags: ["deploy", "api", "regression"], linkedAlertIds: ["ALT-1003", "ALT-1007", "ALT-1012"],
    updates: [
      { atOffsetMin: 55, author: "Marcus Lee", text: "Rolled back to v2.14.2; error rate dropping." },
      { atOffsetMin: 150, author: "Priya Nair", text: "Fix forward prepared; holding deploy until review." },
    ],
    escalated: true,
    postmortem: {
      status: "Draft",
      summary: "Deploy v2.14.3 shipped a serializer regression; 4.1% error rate for ~4h until rollback.",
      rootCause: "Missing cart edge-case test; serializer returned null nested objects crashing the response writer.",
      impact: "~4,200 failed requests; no data corruption; rollback restored service.",
      actionItems: [
        { id: "ai-1042-1", text: "Add cart edge-case fuzz tests", owner: "Priya Nair", due: dueIn(2), done: true },
        { id: "ai-1042-2", text: "Deploy canary for all API releases", owner: "Marcus Lee", due: dueIn(6), done: false },
        { id: "ai-1042-3", text: "Error-budget gate in CI", owner: "Daniel Roth", due: dueIn(9), done: false },
        { id: "ai-1042-4", text: "Serializer contract tests", owner: "Priya Nair", due: dueIn(12), done: true },
        { id: "ai-1042-5", text: "Blameless review with backend team", owner: "Ayesha Khan", due: dueIn(14), done: false },
      ],
    },
  },
  { // INC-1043
    severity: "SEV3", status: "Monitoring", startedMinAgo: 233, ackAfterMin: 7, resolveAfterMin: null,
    title: "Elevated 5xx on web-app-01 canary", services: ["web-app"], hosts: ["web-app-01"],
    commander: "Priya Nair", assignee: "Priya Nair", team: "Backend",
    impact: "5xx rate 2.3% on canary pods only (5% of traffic)",
    rootCause: "Under investigation; correlated with canary of web frontend 2.9.0-rc.1.",
    tags: ["web", "canary"], linkedAlertIds: ["ALT-1013"],
    updates: [
      { atOffsetMin: 40, author: "Priya Nair", text: "5xx isolated to canary; holding rollback decision for 30m observation." },
      { atOffsetMin: 150, author: "Priya Nair", text: "Error rate fading to 0.8%; keeping canary pinned at 5%." },
    ],
  },
  { // INC-1044
    severity: "SEV3", status: "Monitoring", startedMinAgo: 92, ackAfterMin: 9, resolveAfterMin: null,
    title: "Worker queue backlog growing", services: ["scheduler"], hosts: ["worker-01"],
    commander: "Daniel Roth", assignee: "Daniel Roth", team: "SRE",
    impact: "Background jobs delayed ~15 minutes",
    rootCause: "Producer throughput increase from the notification fanout refactor outpaced consumers.",
    tags: ["scheduler", "queue"], linkedAlertIds: ["ALT-1022"],
    updates: [{ atOffsetMin: 30, author: "Daniel Roth", text: "Scaled consumers 3 → 6; backlog draining at 1.4x rate." }],
  },
  { // INC-1045
    severity: "SEV2", status: "Identified", startedMinAgo: 890, ackAfterMin: null, resolveAfterMin: null,
    title: "Cache hit ratio dropped to 41%", services: ["cache", "api-server"], hosts: ["cache-01"],
    commander: "Nina Park", assignee: "Marcus Lee", team: "Platform",
    impact: "Origin load doubled on web-app-01; latency +180ms",
    rootCause: "Eviction storm after cache flush during yesterday's incident response; keys not re-warming.",
    tags: ["cache", "redis"], linkedAlertIds: ["ALT-1021", "ALT-1016"],
    updates: [{ atOffsetMin: 500, author: "Nina Park", text: "Identified as flush aftermath; enabling warm-up job for top keys." }],
  },
  { // INC-1046
    severity: "SEV2", status: "Identified", startedMinAgo: 487, ackAfterMin: 11, resolveAfterMin: null,
    title: "High latency on edge proxy for API routes", services: ["edge-proxy", "api-server"], hosts: ["edge-01"],
    commander: "Tom Becker", assignee: "Tom Becker", team: "Network Ops",
    impact: "API p95 latency 1.8s (SLO 1s) for NA-East",
    rootCause: "Congested peering link during upstream maintenance; rerouting via secondary path in progress.",
    tags: ["network", "latency"], linkedAlertIds: ["ALT-1001", "ALT-1019"],
    updates: [{ atOffsetMin: 320, author: "Tom Becker", text: "Shifted 60% of API traffic to secondary path; p95 dropping." }],
    escalated: true,
  },
  { // INC-1047
    severity: "SEV1", status: "Investigating", startedMinAgo: 322, ackAfterMin: 4, resolveAfterMin: null,
    title: "Database connection pool exhausted", services: ["database"], hosts: ["db-01"],
    commander: "Sara Iqbal", assignee: "Sara Iqbal", team: "Database",
    impact: "Checkout and login p99 > 2s; pool at 100% saturation",
    rootCause: "Connection leak in the new reporting service; max_connections reached on db-01.",
    tags: ["database", "checkout"], linkedAlertIds: ["ALT-1002", "ALT-1005"],
    updates: [
      { atOffsetMin: 90, author: "Sara Iqbal", text: "Confirmed reporting service holding 340 idle connections; killing leaks." },
      { atOffsetMin: 200, author: "Sara Iqbal", text: "Deployed connection cap for reporting role; pool recovering." },
    ],
    escalated: true,
  },
  { // INC-1048
    severity: "SEV1", status: "Investigating", startedMinAgo: 134, ackAfterMin: null, resolveAfterMin: null,
    title: "Elevated error rate on payment API", services: ["payment"], hosts: ["pay-01"],
    commander: "Ayesha Khan", assignee: "Omar Farooq", team: "SRE",
    impact: "Payments degraded for ~12% users",
    rootCause: "Under investigation; errors correlate with the v3 payment gateway rollout started 2h ago.",
    tags: ["payment", "api", "customer-facing"], linkedAlertIds: ["ALT-1006", "ALT-1008", "ALT-1015"],
    updates: [
      { atOffsetMin: 25, author: "Ayesha Khan", text: "Errors started after gateway v3 rollout; freeze on deploys, gathering traces." },
    ],
  },
];

function buildSeed(): Incident[] {
  return SEED.map((row, index) => {
    const id = `INC-${1019 + index}`;
    const startedMs = dateMinAgo(row.startedMinAgo);
    const ackMs = row.ackAfterMin == null ? null : startedMs + row.ackAfterMin * MIN;
    const resolvedMs = row.resolveAfterMin == null ? null : startedMs + row.resolveAfterMin * MIN;
    const startedAt = isoMinAgo(row.startedMinAgo);
    const timeline: IncidentTimelineEntry[] = [
      {
        id: `${id}-tl-created`,
        at: startedAt,
        epochMs: startedMs,
        type: "created",
        author: index < 2 ? "Monitoring" : row.commander,
        text: row.status === "Resolved" ? "Incident declared and triage started." : "Incident declared; responders paged.",
      },
    ];
    if (ackMs != null) {
      timeline.push({
        id: `${id}-tl-ack`,
        at: new Date(ackMs).toISOString(),
        epochMs: ackMs,
        type: "acknowledged",
        author: row.commander,
        text: `${row.commander.split(" ")[0]} acknowledged and took command.`,
      });
    }
    if (row.escalated) {
      const escalatedMs = startedMs + Math.max(30, Math.floor((row.ackAfterMin ?? 10)) + 35) * MIN;
      timeline.push({
        id: `${id}-tl-escalated`,
        at: new Date(escalatedMs).toISOString(),
        epochMs: escalatedMs,
        type: "escalated",
        author: row.commander,
        text: "Escalated: impact confirmed beyond initial scope; secondary responder engaged.",
      });
    }
    row.updates.forEach((update, updateIndex) => {
      const updateMs = startedMs + update.atOffsetMin * MIN;
      timeline.push({
        id: `${id}-tl-update-${updateIndex}`,
        at: new Date(updateMs).toISOString(),
        epochMs: updateMs,
        type: "update",
        author: update.author,
        text: update.text,
      });
    });
    if (resolvedMs != null) {
      timeline.push({
        id: `${id}-tl-resolved`,
        at: new Date(resolvedMs).toISOString(),
        epochMs: resolvedMs,
        type: "resolved",
        author: row.commander,
        text: "Service restored and metrics back within SLO; incident resolved.",
      });
    }
    timeline.sort((a, b) => a.epochMs - b.epochMs);
    return {
      id,
      title: row.title,
      severity: row.severity,
      status: row.status,
      commander: row.commander,
      assignee: row.assignee,
      team: row.team,
      affectedServices: [...row.services],
      affectedHosts: [...row.hosts],
      linkedAlertIds: [...row.linkedAlertIds],
      impact: row.impact,
      startedAt,
      acknowledgedAt: ackMs == null ? null : new Date(ackMs).toISOString(),
      resolvedAt: resolvedMs == null ? null : new Date(resolvedMs).toISOString(),
      rootCause: row.rootCause,
      timeline,
      postmortem: row.postmortem ? { ...row.postmortem, actionItems: row.postmortem.actionItems.map((item) => ({ ...item })) } : { ...NO_POSTMORTEM, actionItems: [] },
      tags: [...row.tags],
    };
  });
}

let store: Incident[] = buildSeed();
let declaredCount = 0;

const cloneIncident = (incident: Incident): Incident => ({
  ...incident,
  affectedServices: [...incident.affectedServices],
  affectedHosts: [...incident.affectedHosts],
  linkedAlertIds: [...incident.linkedAlertIds],
  tags: [...incident.tags],
  timeline: incident.timeline.map((entry) => ({ ...entry })),
  postmortem: { ...incident.postmortem, actionItems: incident.postmortem.actionItems.map((item) => ({ ...item })) },
});

/** Snapshot of the module store for hook consumers (clones every record). */
export function readIncidentStore(): Incident[] {
  return store.map(cloneIncident);
}

/** Async mock fetch — swap the body for a real `fetch("/api/incidents")` later. */
export function fetchIncidents(): Promise<Incident[]> {
  return new Promise((resolve) => {
    const timer = typeof window !== "undefined" ? window.setTimeout : setTimeout;
    timer(() => resolve(readIncidentStore()), 200 + Math.random() * 200);
  });
}

/** Timeline entry factory used by the store actions. */
export function makeTimelineEntry(type: TimelineEntryType, author: string, text: string): IncidentTimelineEntry {
  const now = Date.now();
  return { id: `tl-${now}-${Math.random().toString(36).slice(2, 7)}`, at: new Date(now).toISOString(), epochMs: now, type, author, text };
}

/** Prepend a declared incident to the store (id assigned by the caller). */
export function appendIncidentToStore(incident: Incident): void {
  store = [incident, ...store];
}

/** Low-level store mutation used by the client actions. */
export function mutateIncidents(ids: string[], patch: (incident: Incident) => Partial<Incident> | null, entries: (incident: Incident) => IncidentTimelineEntry[]): void {
  store = store.map((incident) => {
    if (!ids.includes(incident.id)) return incident;
    const partial = patch(incident);
    if (!partial) return incident;
    return { ...incident, ...partial, timeline: [...incident.timeline, ...entries(incident)] };
  });
}

export interface DeclareIncidentInput {
  title: string;
  severity: IncidentSeverity;
  services: string[];
  hosts: string[];
  impactSummary: string;
  commander: string;
  team: string;
  assignee: string | null;
  linkedAlertIds: string[];
  notifyChannels: string[];
  statusUpdate: string;
  tags: string[];
}

export function nextIncidentId(): string {
  const highest = store.reduce((max, incident) => {
    const value = Number.parseInt(incident.id.replace("INC-", ""), 10);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 1048);
  declaredCount += 1;
  return `INC-${highest + declaredCount}`;
}

export interface IncidentsSnapshot {
  open: number;
  criticalOpen: number; // SEV1+SEV2 among open
  acknowledgedOpen: number;
  mttaMinutes: number | null;
  mttrMinutes: number | null;
  resolved30d: number;
}

/** Derived figures read from the module store — used by NOC / overview mocks. */
export function incidentStoreSnapshot(): IncidentsSnapshot {
  const list = store;
  const openList = list.filter(isOpenIncident);
  const ackedOpen = openList.filter((incident) => incident.acknowledgedAt != null).length;
  const ackDeltas = list
    .filter((incident) => incident.acknowledgedAt != null)
    .map((incident) => (Date.parse(incident.acknowledgedAt as string) - Date.parse(incident.startedAt)) / MIN);
  const resolveDeltas = list
    .filter((incident): incident is Incident & { resolvedAt: string } => incident.resolvedAt != null)
    .map((incident) => (Date.parse(incident.resolvedAt) - Date.parse(incident.startedAt)) / MIN);
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * MIN;
  return {
    open: openList.length,
    criticalOpen: openList.filter((incident) => incident.severity === "SEV1" || incident.severity === "SEV2").length,
    acknowledgedOpen: ackedOpen,
    mttaMinutes: ackDeltas.length ? Math.round(ackDeltas.reduce((sum, value) => sum + value, 0) / ackDeltas.length) : null,
    mttrMinutes: resolveDeltas.length ? Math.round(resolveDeltas.reduce((sum, value) => sum + value, 0) / resolveDeltas.length) : null,
    resolved30d: list.filter((incident) => incident.resolvedAt != null && Date.parse(incident.resolvedAt) >= thirtyDaysAgo).length,
  };
}

/* ------------------------------ derivations ------------------------------- */

export const SEVERITY_ORDER: IncidentSeverity[] = ["SEV1", "SEV2", "SEV3", "SEV4"];
export const STATUS_ORDER: IncidentStatus[] = ["Investigating", "Identified", "Monitoring", "Resolved"];

export function isOpenIncident(incident: Pick<Incident, "status">): boolean {
  return incident.status !== "Resolved";
}

export function severityRank(severity: IncidentSeverity): number {
  return SEVERITY_ORDER.indexOf(severity);
}

export function statusRank(status: IncidentStatus): number {
  return STATUS_ORDER.indexOf(status);
}

/** Open incidents can be filtered with the synthetic "Open" status. */
export type StatusFilter = IncidentStatus | "Open" | "All";

export interface TrendBucket {
  key: string;
  label: string;
  SEV1: number;
  SEV2: number;
  SEV3: number;
  SEV4: number;
}

export type TrendRange = "7D" | "30D" | "90D";

export function trendBuckets(incidents: Incident[], range: TrendRange, nowMs = Date.now()): TrendBucket[] {
  const dayMs = 24 * 60 * MIN;
  const days = range === "7D" ? 7 : range === "30D" ? 30 : 90;
  const bucketMs = range === "90D" ? 3 * dayMs : dayMs;
  const bucketCount = Math.ceil(days / (bucketMs / dayMs));
  const buckets: TrendBucket[] = [];
  for (let index = bucketCount - 1; index >= 0; index -= 1) {
    const end = nowMs - index * bucketMs;
    const start = end - bucketMs;
    const date = new Date(start);
    buckets.push({
      key: `${start}`,
      label: range === "7D"
        ? date.toLocaleDateString(undefined, { weekday: "short" })
        : date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      SEV1: 0, SEV2: 0, SEV3: 0, SEV4: 0,
    });
  }
  for (const incident of incidents) {
    const time = Date.parse(incident.startedAt);
    if (time > nowMs) continue;
    if (nowMs - time >= days * dayMs) continue;
    const slotFromNow = Math.floor((nowMs - time) / bucketMs);
    const index = buckets.length - 1 - slotFromNow;
    if (index < 0 || index >= buckets.length) continue;
    buckets[index][incident.severity] += 1;
  }
  return buckets;
}

export function durationMinutes(incident: Incident, nowMs = Date.now()): number {
  const end = incident.resolvedAt ? Date.parse(incident.resolvedAt) : nowMs;
  return Math.max(0, Math.round((end - Date.parse(incident.startedAt)) / MIN));
}

export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours}h ${rest}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
}

/** Linked alert rows resolved against the alerts mock (same ids as Alerts page). */
export function linkedAlerts(incident: Incident) {
  const byId = new Map(SAMPLE_ALERTS.map((alert) => [alert.id, alert]));
  return incident.linkedAlertIds.map((id) => byId.get(id) ?? null).filter((alert): alert is NonNullable<typeof alert> => alert != null);
}

export const ON_CALL = {
  primary: { name: "Marcus Lee", role: "Platform · Primary", since: "09:00", nextShift: "Mon 09:00 · Nina Park" },
  secondary: { name: "Priya Nair", role: "Backend · Secondary", since: "09:00", nextShift: "Mon 09:00 · Omar Farooq" },
} as const;

export type IncidentRestoreSnapshot = Pick<Incident, "id" | "status" | "acknowledgedAt" | "resolvedAt" | "assignee" | "severity">;

export function snapshotOf(incident: Incident): IncidentRestoreSnapshot {
  return { id: incident.id, status: incident.status, acknowledgedAt: incident.acknowledgedAt, resolvedAt: incident.resolvedAt, assignee: incident.assignee, severity: incident.severity };
}
