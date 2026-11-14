/**
 * Runbooks mock data - single source of truth for Operations > Runbooks.
 *
 * Pattern: seeded deterministic specs -> builder -> module-private store +
 * subscribe/getSnapshot/mutate (same family as mocks/backups.ts and
 * mocks/scheduledTasks.ts). "Now"-relative timestamps are derived from
 * module-load Date.now(); derived numbers (usage, coverage, overdue reviews)
 * are computed from the arrays on demand so banner, stat cards, charts and
 * library always agree. fetchRunbooks() returns a Promise with 200-400ms
 * latency so swapping the source to a real API later is a one-function change.
 */

import { ALERT_RULE_LIST } from "@/mocks/alertRules";

export type RunbookCategory = "Database" | "Network" | "Compute" | "Storage" | "Application" | "Security" | "Backup" | "General";
export type RunbookSeverity = "Critical" | "High" | "Medium" | "Low";
export type RunbookStatus = "Published" | "Draft" | "Needs review" | "Archived";
export type RunbookStepType = "Manual" | "Command" | "Check" | "Warning" | "Automated";
export type RunbookExecutionResult = "Completed" | "Aborted" | "Failed";

export const RUNBOOK_CATEGORIES: readonly RunbookCategory[] = ["Database", "Network", "Compute", "Storage", "Application", "Security", "Backup", "General"];
export const RUNBOOK_SEVERITIES: readonly RunbookSeverity[] = ["Critical", "High", "Medium", "Low"];
export const RUNBOOK_STATUSES: readonly RunbookStatus[] = ["Published", "Draft", "Needs review", "Archived"];
export const RUNBOOK_STEP_TYPES: readonly RunbookStepType[] = ["Manual", "Command", "Check", "Warning", "Automated"];

export interface RunbookStep {
  id: string;
  title: string;
  description: string;
  type: RunbookStepType;
  /** Shell/SQL/CLI payload for Command and Automated steps. */
  command?: string;
  expectedOutput?: string;
  estimatedMinutes: number;
}

export interface RunbookHistoryEntry {
  version: number;
  by: string;
  at: string;
  note: string;
}

export interface Runbook {
  id: string;
  title: string;
  summary: string;
  category: RunbookCategory;
  severity: RunbookSeverity;
  services: string[];
  /** Alert rule ids (RUL-###) this runbook remediates. */
  linkedAlertRuleIds: string[];
  owner: string;
  team: string;
  status: RunbookStatus;
  version: number;
  estimatedMinutes: number;
  prerequisites: string[];
  steps: RunbookStep[];
  rollback: RunbookStep[];
  verification: RunbookStep[];
  tags: string[];
  lastReviewedAt: string;
  reviewIntervalDays: number;
  createdAt: string;
  updatedAt: string;
  epochMs: number;
  helpfulCount: number;
  notHelpfulCount: number;
  history: RunbookHistoryEntry[];
}

export interface RunbookExecution {
  id: string;
  runbookId: string;
  by: string;
  /** Incident ids reference mocks/incidents.ts (INC-####). */
  incidentId: string | null;
  startedAt: string;
  endedAt: string | null;
  epochMs: number;
  durationMs: number | null;
  result: RunbookExecutionResult;
  stepsDone: number;
  notes: string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const daysAgo = (days: number, extraMs = 0) => iso(now - days * DAY - extraMs);

/** Compact step factory; ids are assigned positionally in the builder. */
function st(type: RunbookStepType, title: string, estimatedMinutes: number, description: string, extra?: Partial<RunbookStep>): RunbookStep {
  return { id: "", title, description, type, estimatedMinutes, ...extra };
}

interface SeedSpec {
  id: string;
  title: string;
  summary: string;
  category: RunbookCategory;
  severity: RunbookSeverity;
  services: string[];
  linkedAlertRuleIds: string[];
  owner: string;
  team: string;
  status: RunbookStatus;
  version: number;
  estimatedMinutes: number;
  prerequisites: string[];
  steps: RunbookStep[];
  rollback: RunbookStep[];
  verification: RunbookStep[];
  tags: string[];
  lastReviewedDaysAgo: number;
  reviewIntervalDays?: number;
  createdDaysAgo: number;
  updatedDaysAgo: number;
  helpfulCount: number;
  notHelpfulCount: number;
  lastChangeNote?: string;
}

const SEED_SPECS: SeedSpec[] = [
  {
    id: "RB-1042", title: "API latency high (p95)", category: "Application", severity: "Critical",
    summary: "Triage p95 latency breaches on the public API: locate the slow route, check dependency saturation, and apply the standard mitigation for the api-services tier.",
    services: ["api-server-01", "api-server-02"], linkedAlertRuleIds: ["RUL-203", "RUL-207"],
    owner: "Sara Iqbal", team: "Platform", status: "Published", version: 4, estimatedMinutes: 20,
    prerequisites: ["VPN or bastion access to the api-services host group", "Read access to Logs Explorer and the API gateway metrics", "Confirm a recent deploy is not the cause (check /deploys for the last 2h)"],
    steps: [
      st("Check", "Confirm the breach", 2, "Open Metrics Explorer and compare p95 for /v1/orders vs all routes. Confirm the alert fired on two consecutive 5m windows."),
      st("Command", "Pull top slow routes", 3, "Aggregate gateway logs by route for the last 15 minutes.", { command: "kubectl logs deploy/api-gateway --since=15m | jq -r '.route' | sort | uniq -c | sort -rn | head -10", expectedOutput: "Top-10 routes by request count; the hottest route should exceed the baseline by 3x." }),
      st("Command", "Check dependency saturation", 3, "Look at upstream DB pool and cache hit ratio.", { command: "psql -h db-01 -c \"select count(*) from pg_stat_activity where state='active';\" && redis-cli -h cache-01 info stats | grep -E 'keyspace_hits|evicted'", expectedOutput: "Active connections < 80% of max_connections; cache evictions near zero." }),
      st("Manual", "Scale out or roll back", 8, "If a route is hot and dependencies are healthy, scale the api deployment to 6 replicas. If the breach started after a deploy, roll back via the release pipeline.", { expectedOutput: "p95 back below 400ms within 5 minutes of the change." }),
      st("Check", "Verify recovery", 4, "Watch the alert rule RUL-203 for two clean windows; confirm error rate unchanged."),
    ],
    rollback: [
      st("Command", "Revert replica count", 2, "Return the api deployment to the pre-incident replica count.", { command: "kubectl scale deploy/api-server-01 --replicas=3" }),
      st("Manual", "Restore previous release", 5, "If a rollback was performed, redeploy the previous tag from the release pipeline and confirm health checks."),
    ],
    verification: [
      st("Check", "p95 under target", 4, "Metrics Explorer: p95(/v1/*) < 400ms for 15 minutes."),
      st("Check", "No new alerts", 2, "RUL-203/RUL-207 silent for two consecutive windows."),
    ],
    tags: ["latency", "api", "gateway", "p95"], lastReviewedDaysAgo: 12, createdDaysAgo: 210, updatedDaysAgo: 12,
    helpfulCount: 41, notHelpfulCount: 3, lastChangeNote: "Step 3 now checks redis eviction counter explicitly.",
  },
  {
    id: "RB-1043", title: "Database connection lost", category: "Database", severity: "Critical",
    summary: "Restore connectivity to the PostgreSQL cluster: verify network path, credentials, connection pool exhaustion and failover state on db-01 / db-02.",
    services: ["db-01", "db-02"], linkedAlertRuleIds: ["RUL-202"],
    owner: "Marcus Lee", team: "Data", status: "Published", version: 6, estimatedMinutes: 15,
    prerequisites: ["Bastion access to the database-cluster group", "Read replica credentials from the vault (engineering-ro role)", "Confirm maintenance windows do not cover db-01 right now"],
    steps: [
      st("Check", "Confirm scope", 2, "Is it all clients or one app tier? Check pg_stat_activity from the replica and the alert payload for affected hosts."),
      st("Command", "Test network path", 2, "Verify reachability and TLS handshake from an app host.", { command: "psql -h db-01 -U uptime -c 'select 1;' -w", expectedOutput: "Connection refused/timeout -> network or service down. Auth error -> credential issue, skip to step 4." }),
      st("Command", "Check service and pool", 3, "Confirm postgres is up and the pool is not exhausted.", { command: "systemctl status postgresql && psql -h db-01 -c \"select count(*), state from pg_stat_activity group by state;\"", expectedOutput: "service active; active sessions below max_connections." }),
      st("Automated", "Restart connection pooler", 3, "Bounce pgbouncer on the app tier to clear stale sessions.", { command: "systemctl restart pgbouncer" }),
      st("Check", "Failover if primary is down", 5, "If db-01 is unresponsive, promote db-02 per the replica failover doc and re-point the service.", { expectedOutput: "Writes succeed against the promoted replica." }),
    ],
    rollback: [
      st("Manual", "Revert failover", 10, "If db-02 was promoted in error, follow the split-brain procedure before re-enabling writes on db-01."),
      st("Command", "Restart pooler rollback", 2, "Restore the previous pgbouncer config if the restart did not help.", { command: "systemctl restart pgbouncer" }),
    ],
    verification: [
      st("Check", "Apps healthy", 4, "Error rate back to baseline; connection errors zero for 10 minutes."),
      st("Check", "Replication resynced", 4, "pg_stat_replication shows streaming with lag < 5s on both replicas."),
    ],
    tags: ["database", "postgres", "connectivity", "pool"], lastReviewedDaysAgo: 8, createdDaysAgo: 240, updatedDaysAgo: 8,
    helpfulCount: 38, notHelpfulCount: 2, lastChangeNote: "Added pgbouncer bounce as automated step with host confirm.",
  },
  {
    id: "RB-1044", title: "Disk usage > 90%", category: "Storage", severity: "Medium",
    summary: "Reclaim disk on saturated volumes: identify growth source, rotate logs, prune docker artefacts and old release directories, then verify headroom.",
    services: ["db-01", "storage-01", "worker-01"], linkedAlertRuleIds: ["RUL-206"],
    owner: "Tom Becker", team: "Infrastructure", status: "Published", version: 5, estimatedMinutes: 25,
    prerequisites: ["Root or sudo on the target host", "Confirm no backup is running on the volume (check /backups-and-recovery)", "Screenshot current usage before reclaiming"],
    steps: [
      st("Command", "Find the biggest consumers", 4, "Locate the top growing directories on the volume.", { command: "du -xhd1 / | sort -rh | head -12", expectedOutput: "One or two directories account for >60% of growth; typical offenders: /var/log, docker volumes, old releases." }),
      st("Command", "Rotate and compress logs", 3, "Rotate logs now and compress yesterday's logs.", { command: "logrotate -f /etc/logrotate.conf && find /var/log -mtime +1 -name '*.log' -exec gzip -9 {} \\;" }),
      st("Command", "Prune docker artefacts", 4, "Remove dangling images and stopped containers older than 14 days.", { command: "docker system prune -af --filter 'until=336h'" }),
      st("Warning", "Do not delete data directories", 2, "Never remove /var/lib/postgresql, backup staging or the only copy of any artefact. If usage is still >85%, escalate to storage expansion instead."),
      st("Check", "Verify headroom", 3, "df -h should show at least 15% free on the volume.", { expectedOutput: "Filesystem usage <= 85% and no monitoring alert re-fires." }),
    ],
    rollback: [
      st("Manual", "Restore logs from archive", 10, "If logrotate removed an active log, reopen the deleted inode via the process or restore from the archive directory."),
    ],
    verification: [
      st("Check", "Headroom restored", 5, "Volume <= 85% for two consecutive polling cycles."),
      st("Check", "Alerted rule clear", 2, "RUL-206 auto-resolves or is acknowledged with the action taken."),
    ],
    tags: ["disk", "storage", "cleanup", "capacity"], lastReviewedDaysAgo: 21, createdDaysAgo: 300, updatedDaysAgo: 21,
    helpfulCount: 33, notHelpfulCount: 4, lastChangeNote: "Warned against deleting /var/lib/postgresql explicitly.",
  },
  {
    id: "RB-1045", title: "Node not ready", category: "Compute", severity: "Critical",
    summary: "Recover a Kubernetes node stuck in NotReady: check kubelet, container runtime, disk pressure and network plugin on the host.",
    services: ["edge-01", "worker-01", "monitor-01"], linkedAlertRuleIds: ["RUL-217"],
    owner: "Tom Becker", team: "Infrastructure", status: "Published", version: 3, estimatedMinutes: 30,
    prerequisites: ["SSH/bastion access to the node", "kubectl with cluster-admin or at least node-reader on the cluster", "Know the workload disruption budget before cordon/drain"],
    steps: [
      st("Command", "Check node condition", 2, "Describe the node and read the conditions.", { command: "kubectl describe node <node> | sed -n '/Conditions/,/Addresses/p'", expectedOutput: "Ready=Unknown/False with a reason (KubeletNotReady, DiskPressure, NetworkUnavailable...)." }),
      st("Command", "Check kubelet and runtime", 4, "Inspect kubelet and containerd/cri-o status on the host.", { command: "systemctl status kubelet containerd && journalctl -u kubelet -n 80 --no-pager" }),
      st("Manual", "Cordone and drain", 8, "If the node is unrecoverable quickly, cordon it and drain with grace period 60s, respecting PodDisruptionBudgets."),
      st("Automated", "Restart kubelet", 3, "Restart kubelet and the container runtime on the node.", { command: "systemctl restart kubelet" }),
      st("Check", "Confirm rejoin", 13, "Node returns to Ready and pods reschedule. Watch 15 minutes."),
    ],
    rollback: [
      st("Command", "Uncordon node", 2, "Allow scheduling again once healthy.", { command: "kubectl uncordon <node>" }),
    ],
    verification: [
      st("Check", "Node Ready 15m", 15, "No flaps; all DaemonSets report desired replicas."),
      st("Check", "Pods rebalanced", 5, "Evicted pods rescheduled successfully on other nodes."),
    ],
    tags: ["kubernetes", "node", "kubelet", "compute"], lastReviewedDaysAgo: 30, createdDaysAgo: 260, updatedDaysAgo: 30,
    helpfulCount: 29, notHelpfulCount: 2, lastChangeNote: "Documented drain grace period for PDB-protected workloads.",
  },
  {
    id: "RB-1046", title: "SSL certificate expiring", category: "Security", severity: "Medium",
    summary: "Renew or re-issue a TLS certificate approaching expiry: confirm which endpoint, renew via ACME or CA, deploy, and verify chain and expiry.",
    services: ["edge-01", "edge-02", "web-app-01"], linkedAlertRuleIds: ["RUL-208"],
    owner: "Priya Nair", team: "Security", status: "Published", version: 4, estimatedMinutes: 20,
    prerequisites: ["Access to the certificate authority or ACME account (vault: pki/)", "Update rights on the load balancer / ingress config", "List of all endpoints serving the certificate (edge-01, edge-02)"],
    steps: [
      st("Command", "Confirm the certificate", 3, "Check expiry dates on all edge endpoints.", { command: "for h in edge-01 edge-02 web-app-01; do echo | openssl s_client -connect $h:443 -servername $h 2>/dev/null | openssl x509 -noout -enddate -subject; done" }),
      st("Command", "Renew via ACME", 8, "Trigger the ACME renewal for the certificate.", { command: "acme.sh --renew -d $(hostname -f) --force", expectedOutput: "Certificate renewed; new expiry >= 60 days out." }),
      st("Manual", "Deploy to edges", 5, "Push the new certificate to edge-01/edge-02 and reload NGINX/ingress."),
      st("Check", "Verify chain and dates", 4, "Re-check s_client output; confirm chain verifies and expiry moved."),
    ],
    rollback: [
      st("Manual", "Restore previous cert", 8, "Re-deploy the last known good certificate from the vault if clients fail validation after renewal."),
    ],
    verification: [
      st("Check", "Chain valid", 3, "openssl s_client returns Verify return code: 0 for all endpoints."),
      st("Check", "Alert clear", 2, "RUL-208/RUL-221 cleared or expiry > 14 days."),
    ],
    tags: ["tls", "certificate", "expiry", "edge"], lastReviewedDaysAgo: 18, createdDaysAgo: 320, updatedDaysAgo: 18,
    helpfulCount: 26, notHelpfulCount: 1, lastChangeNote: "Added edge-02 to the deployment list.",
  },
  {
    id: "RB-1047", title: "Backup job failed", category: "Backup", severity: "Critical",
    summary: "Diagnose and re-run a failed backup job: read the run error, check pool capacity and credentials, re-run, and escalate for restore-point gaps.",
    services: ["db-01", "storage-01", "worker-01"], linkedAlertRuleIds: ["RUL-212"],
    owner: "Sara Iqbal", team: "Data", status: "Published", version: 7, estimatedMinutes: 15,
    prerequisites: ["Access to Backups & Recovery", "The failing job id (BJ-####) from the alert payload", "Storage pool credentials in the vault if the job uploads off-site"],
    steps: [
      st("Command", "Read the last run error", 3, "Pull the most recent failed run for the job.", { command: "echo 'Open /backups-and-recovery -> Jobs -> <job> -> last run' && tail -n 40 /var/log/backup/<job>.log", expectedOutput: "Error class: credentials / capacity / lock / timeout / target-down." }),
      st("Check", "Check pool headroom", 3, "Local NAS 13.4/20TB, S3 22.6/25TB, Offsite Vault 12.2/40TB. Failures at >90% used are capacity stops."),
      st("Check", "Check target reachability", 2, "For pool-vault jobs, confirm the vault endpoint and credentials; for NAS, confirm the mount."),
      st("Manual", "Fix and re-run", 5, "Address the error class, then trigger Run Backup from the job page. Watch the first 10 minutes of the run."),
      st("Check", "Verify recovery point", 2, "Confirm a new restore point exists with status success dated today."),
    ],
    rollback: [
      st("Manual", "Revert retention change", 5, "If you extended retention as part of the fix and the pool is over capacity, revert to the previous retention immediately."),
    ],
    verification: [
      st("Check", "Run success", 5, "Latest run status success; runbook matches RPO tier."),
      st("Check", "Restore point valid", 5, "Create a test restore or verify checksum from the restore-points list."),
    ],
    tags: ["backup", "rpo", "restore-point", "failure"], lastReviewedDaysAgo: 5, createdDaysAgo: 280, updatedDaysAgo: 5,
    helpfulCount: 47, notHelpfulCount: 2, lastChangeNote: "Added pool-vault reachability checks.",
  },
  {
    id: "RB-1048", title: "High CPU usage", category: "Compute", severity: "High",
    summary: "Identify the process burning CPU, decide between scaling, restart or throttling, and confirm the load returns to baseline.",
    services: ["worker-01", "app-server-02", "cache-01"], linkedAlertRuleIds: ["RUL-201"],
    owner: "Tom Becker", team: "Infrastructure", status: "Published", version: 5, estimatedMinutes: 15,
    prerequisites: ["SSH access to the host", "Awareness of the workload's peak schedule (batch windows)", "No overlapping maintenance window for the host"],
    steps: [
      st("Command", "Find the hot process", 2, "List the top CPU consumers.", { command: "top -b -o %CPU -n 1 | head -20", expectedOutput: "Process name, pid and %CPU; compare against the known budget for the service." }),
      st("Command", "Check for runaway threads", 3, "Per-thread breakdown of the hot process.", { command: "ps -L -p <pid> -o pcpu,tid,comm --sort=-pcpu | head" }),
      st("Manual", "Decide the action", 8, "Batch job past its window: kill or reschedule. Service hot under real traffic: scale horizontally or throttle the offending client. Leaked goroutines/threads: restart the service off-peak."),
      st("Command", "Restart or throttle", 2, "Apply the chosen action.", { command: "systemctl restart <service>   # or: renice +10 -p <pid>" }),
    ],
    rollback: [
      st("Command", "Renice back", 1, "Restore normal scheduling priority if throttling hurt latency.", { command: "renice 0 -p <pid>" }),
    ],
    verification: [
      st("Check", "Load normalised", 5, "Load1 below core count x 0.7 for 10 minutes."),
      st("Check", "No latency impact", 5, "Service p95 unchanged from baseline."),
    ],
    tags: ["cpu", "load", "compute", "performance"], lastReviewedDaysAgo: 9, createdDaysAgo: 230, updatedDaysAgo: 9,
    helpfulCount: 36, notHelpfulCount: 2, lastChangeNote: "Added ps -L thread inspection step.",
  },
  {
    id: "RB-1049", title: "Service unavailable (5xx)", category: "Application", severity: "Critical",
    summary: "Triage a spike in HTTP 5xx on a service: check deploys, saturation and dependencies; roll back or shed load to restore availability.",
    services: ["web-app-01", "web-02", "api-server-01"], linkedAlertRuleIds: ["RUL-215"],
    owner: "Marcus Lee", team: "Platform", status: "Published", version: 6, estimatedMinutes: 12,
    prerequisites: ["Deploy history access", "Current error budget for the service", "Ability to roll back the last release within 5 minutes"],
    steps: [
      st("Check", "Confirm the spike", 2, "5xx rate over 5 minutes by service and status code (502 vs 500 vs 503)."),
      st("Command", "Correlate with deploys", 2, "List recent deploys to the service.", { command: "kubectl rollout history deploy/<service> | tail -5" }),
      st("Command", "Check pod health", 3, "Restarts, OOM kills, readiness failures.", { command: "kubectl get pods -l app=<service> -o wide && kubectl top pods -l app=<service>" }),
      st("Manual", "Roll back or shed load", 4, "If deploy-correlated: roll back. If capacity: enable load shedding / scale out. If dependency: fail over the dependency per its runbook."),
      st("Check", "Watch recovery", 1, "5xx under SLO for two consecutive windows."),
    ],
    rollback: [
      st("Command", "Undo rollback", 3, "Re-apply the rolled-back release once the root cause is confirmed fixed.", { command: "kubectl rollout undo deploy/<service> --to-revision=<n>" }),
    ],
    verification: [
      st("Check", "5xx cleared", 5, "Error rate < 0.1% for 10 minutes."),
      st("Check", "Synthetic checks green", 3, "Uptime checks pass from at least 3 regions."),
    ],
    tags: ["5xx", "availability", "rollback", "deploy"], lastReviewedDaysAgo: 7, createdDaysAgo: 250, updatedDaysAgo: 7,
    helpfulCount: 44, notHelpfulCount: 3, lastChangeNote: "Split 5xx by status code in step 1.",
  },
  {
    id: "RB-1050", title: "Memory usage high", category: "Compute", severity: "Medium",
    summary: "Diagnose memory pressure: distinguish leak from cache growth, capture a heap profile if needed, and restart or right-size the service.",
    services: ["app-server-02", "worker-01", "cache-01"], linkedAlertRuleIds: ["RUL-205"],
    owner: "Priya Nair", team: "Platform", status: "Published", version: 4, estimatedMinutes: 20,
    prerequisites: ["SSH access", "Permission to restart the affected service", "Peak-traffic awareness for the host"],
    steps: [
      st("Command", "Identify the consumer", 3, "List processes by RSS.", { command: "ps -eo rss,pid,comm --sort=-rss | head -12" }),
      st("Check", "Leak vs cache", 5, "Watch RSS growth over 10 minutes. Steady linear growth = leak; plateau at high % is cache or working set."),
      st("Command", "Capture profile", 7, "For JVM services, capture a heap histogram.", { command: "jmap -histo:live <pid> | head -30" }),
      st("Manual", "Resize or restart", 5, "Leak: rolling restart and file a bug with the profile. Cache: raise cache limits or eviction policy. Working set: right-size the reservation."),
    ],
    rollback: [
      st("Command", "Resize back", 2, "Revert any limit changes to the previous values.", { command: "kubectl set resources deploy/<service> --limits=memory=<prev>" }),
    ],
    verification: [
      st("Check", "RSS headroom", 10, "RSS < 70% of limit for 15 minutes."),
      st("Check", "No OOM kills", 5, "kube_pod_container_status_terminated_reason{reason=\"OOMKilled\"} == 0."),
    ],
    tags: ["memory", "oom", "heap", "compute"], lastReviewedDaysAgo: 26, createdDaysAgo: 220, updatedDaysAgo: 26,
    helpfulCount: 24, notHelpfulCount: 2,
  },
  {
    id: "RB-1051", title: "Health check failing", category: "Application", severity: "Critical",
    summary: "Restore a failing readiness/liveness health check: inspect probe output, dependency checks baked into the endpoint, and recent config changes.",
    services: ["web-app-01", "api-server-01", "auth-01"], linkedAlertRuleIds: ["RUL-204"],
    owner: "Sara Iqbal", team: "Platform", status: "Published", version: 3, estimatedMinutes: 10,
    prerequisites: ["Access to the service logs and probe configuration", "curl access to the health endpoint from inside the cluster"],
    steps: [
      st("Command", "Hit the probe endpoint", 2, "Reproduce the failing check from inside the network.", { command: "curl -sS -w '\\nHTTP %{http_code}\\n' http://<service>:8080/healthz", expectedOutput: "HTTP 200 with expected body, or the sub-check that fails (db, cache, queue)." }),
      st("Command", "Inspect probe config", 2, "Show the probe definition for the deployment.", { command: "kubectl get deploy <service> -o jsonpath='{.spec.template.spec.containers[0].livenessProbe}{\"\\n\"}{.spec.template.spec.containers[0].readinessProbe}'" }),
      st("Check", "Check embedded sub-checks", 3, "Health endpoints often check dependencies; a failing DB or cache turns the whole check red."),
      st("Manual", "Fix the failing dependency", 3, "Restore the dependency (see its runbook) or, if the probe threshold is wrong, adjust the probe after confirming with the service owner."),
    ],
    rollback: [
      st("Manual", "Revert probe change", 5, "Undo any probe edits made during the fix; probe changes must be reviewed by the service owner."),
    ],
    verification: [
      st("Check", "Probe green", 5, "Two consecutive healthy probe windows; pods 1/1 Ready."),
    ],
    tags: ["healthcheck", "readiness", "probe", "availability"], lastReviewedDaysAgo: 15, createdDaysAgo: 190, updatedDaysAgo: 15,
    helpfulCount: 31, notHelpfulCount: 1,
  },
  {
    id: "RB-1052", title: "HTTP 5xx on edge", category: "Network", severity: "Medium",
    summary: "Handle elevated 5xx at the edge/CDN layer: verify origin health, TLS termination, WAF blocks and upstream timeouts on edge-01/edge-02.",
    services: ["edge-01", "edge-02"], linkedAlertRuleIds: ["RUL-219"],
    owner: "Tom Becker", team: "Network", status: "Published", version: 2, estimatedMinutes: 15,
    prerequisites: ["Edge admin access", "CDN/WAF console read access", "Origin hostnames for the affected routes"],
    steps: [
      st("Command", "Check origin health from edge", 3, "Probe the origin through each edge node.", { command: "for e in edge-01 edge-02; do ssh $e 'curl -sS -o /dev/null -w \"%{http_code} %{time_total}s\\n\" https://origin/healthz'; done" }),
      st("Check", "Review WAF blocks", 3, "Check the WAF console for a block-rule spike matching the affected path."),
      st("Command", "Inspect upstream errors", 3, "Tail edge error logs for upstream connect/timeout counts.", { command: "ssh edge-01 'tail -n 500 /var/log/nginx/error.log | grep -c upstream'" }),
      st("Manual", "Shift traffic or tune upstream", 6, "If one edge is unhealthy, drain it. If origins time out, raise proxy_read_timeout for the affected location. If WAF is blocking, open a ticket for rule review rather than disabling it."),
    ],
    rollback: [
      st("Command", "Restore edge config", 3, "Push the previous edge config from the config repository.", { command: "git revert <edge-config-commit> && ansible-playbook edge-reload.yml" }),
    ],
    verification: [
      st("Check", "5xx baseline", 10, "Edge 5xx rate back below 0.1% for 15 minutes."),
    ],
    tags: ["edge", "cdn", "waf", "5xx", "network"], lastReviewedDaysAgo: 34, createdDaysAgo: 170, updatedDaysAgo: 34,
    helpfulCount: 19, notHelpfulCount: 2,
  },
  {
    id: "RB-1053", title: "Replication lag high", category: "Database", severity: "High",
    summary: "Diagnose PostgreSQL replica lag: check WAL send rate, network throughput, replica replay and long-running queries on the primary.",
    services: ["db-02"], linkedAlertRuleIds: ["RUL-210"],
    owner: "Marcus Lee", team: "Data", status: "Published", version: 3, estimatedMinutes: 20,
    prerequisites: ["Read access on the primary and replicas", "Query-change access via the replica only", "Awareness of bulk loads or maintenance in progress"],
    steps: [
      st("Command", "Measure current lag", 2, "Replication lag in bytes and seconds.", { command: "psql -h db-01 -c \"select client_addr, pg_wal_lsn_diff(sent_lsn, replay_lsn) as lag_bytes, now()-pg_last_xact_replay_timestamp() as lag_time from pg_stat_replication;\"" }),
      st("Command", "Find long-running queries", 3, "Queries older than 60s on the primary block replay.", { command: "psql -h db-01 -c \"select pid, now()-query_start as age, query from pg_stat_activity where state='active' and now()-query_start > interval '60 seconds';\"" }),
      st("Command", "Check network and disk on replica", 3, "Replica receive/write throughput and disk IO.", { command: "ssh db-02 'sar -n DEV 1 5; iostat -x 1 3'" }),
      st("Manual", "Act on findings", 12, "Kill long queries with owner approval, or throttle the bulk job. If the replica is I/O bound, raise wal_receiver_timeout or rebuild the replica from a fresh base backup."),
    ],
    rollback: [
      st("Manual", "Rebuild replica", 30, "If the replica fell too far behind, re-seed it: stop replication, take pg_basebackup, rejoin as standby."),
    ],
    verification: [
      st("Check", "Lag < 5s", 10, "pg_stat_replication shows replay lag below 5 seconds."),
      st("Check", "Replica readable", 2, "Read-only queries succeed against db-02."),
    ],
    tags: ["postgres", "replication", "lag", "wal", "database"], lastReviewedDaysAgo: 40, createdDaysAgo: 150, updatedDaysAgo: 40,
    helpfulCount: 27, notHelpfulCount: 3,
  },
  {
    id: "RB-1054", title: "Cache eviction storm", category: "Application", severity: "Medium",
    summary: "Handle a surge in Redis evictions: identify the keyspace causing pressure, apply TTLs or reject writes, and confirm hit ratio recovery.",
    services: ["cache-01"], linkedAlertRuleIds: ["RUL-211"],
    owner: "Priya Nair", team: "Platform", status: "Published", version: 3, estimatedMinutes: 15,
    prerequisites: ["Redis CLI access", "Knowledge of maxmemory policy on the instance", "Owner approval before flushing keys"],
    steps: [
      st("Command", "Confirm eviction rate", 2, "Stats deltas over the last 5 minutes.", { command: "redis-cli -h cache-01 info stats | grep -E 'evicted_keys|keyspace_hits|keyspace_misses'" }),
      st("Command", "Find the biggest key families", 4, "Sample keys by prefix.", { command: "redis-cli -h cache-01 --scan | sed 's/:.*//' | sort | uniq -c | sort -rn | head" }),
      st("Check", "Check memory pressure", 2, "Used memory vs maxmemory and the eviction policy.", { command: "redis-cli -h cache-01 info memory | grep -E 'used_memory_human|maxmemory_human|maxmemory_policy'" }),
      st("Manual", "Apply the fix", 7, "Set TTLs on un-expired key families, or reject new large writes at the app layer. Do NOT FLUSHALL. If a single tenant is responsible, rate-limit that tenant."),
    ],
    rollback: [
      st("Manual", "Revert TTL changes", 5, "If the TTL change evicts data the app expects, remove the TTL overrides and re-warm the cache."),
    ],
    verification: [
      st("Check", "Hit ratio recovered", 10, "Keyspace hit rate back above 90% for 15 minutes."),
      st("Check", "Evictions stopped", 5, "evicted_keys flat across two polls."),
    ],
    tags: ["redis", "cache", "eviction", "hit-ratio"], lastReviewedDaysAgo: 44, createdDaysAgo: 140, updatedDaysAgo: 44,
    helpfulCount: 22, notHelpfulCount: 4,
  },
  {
    id: "RB-1055", title: "Queue depth elevated", category: "Application", severity: "Medium",
    summary: "Drain a growing message queue: measure consumer lag, find the poison messages, scale consumers, and confirm throughput recovery.",
    services: ["queue-01"], linkedAlertRuleIds: ["RUL-209"],
    owner: "Sara Iqbal", team: "Platform", status: "Published", version: 2, estimatedMinutes: 20,
    prerequisites: ["Access to the queue dashboard", "Deploy rights for the consumer deployment", "Awareness of any producer incidents that may have flooded the queue"],
    steps: [
      st("Command", "Measure depth and drain rate", 3, "Queue depth now vs 15 minutes ago, and consumer throughput.", { command: "rabbitmqctl list_queues name messages_ready messages_unacknowledged | head -15" }),
      st("Command", "Find poison messages", 4, "Check the dead-letter queue for repeated failures.", { command: "rabbitmqadmin get queue=dlq count=5 ackmode=nack_requeue_false" }),
      st("Manual", "Scale consumers", 8, "Scale the consumer deployment by 2x temporarily, or pause the noisiest producer if identifiable."),
      st("Check", "Confirm drain", 5, "Depth falling steadily; DLQ stable; consumers not erroring."),
    ],
    rollback: [
      st("Command", "Scale consumers back", 1, "Return consumer replicas to the baseline after drain.", { command: "kubectl scale deploy/queue-consumer --replicas=3" }),
    ],
    verification: [
      st("Check", "Depth under threshold", 15, "Queue depth < alert threshold for 30 minutes."),
    ],
    tags: ["queue", "rabbitmq", "consumer", "lag"], lastReviewedDaysAgo: 52, createdDaysAgo: 130, updatedDaysAgo: 52,
    helpfulCount: 21, notHelpfulCount: 1,
  },
  {
    id: "RB-1056", title: "Error rate high", category: "Application", severity: "Medium",
    summary: "Investigate elevated application error rate: break errors down by class, correlate with deploys and dependencies, and apply the targeted fix.",
    services: ["api-server-02", "app-server-02"], linkedAlertRuleIds: ["RUL-216"],
    owner: "Marcus Lee", team: "Platform", status: "Needs review", version: 3, estimatedMinutes: 18,
    prerequisites: ["Logs Explorer access", "Deploy history for the last 24h", "Service error budget status"],
    steps: [
      st("Check", "Break errors down", 3, "Group errors by exception class and route over the last 30 minutes."),
      st("Command", "Sample the top error", 3, "Pull stack traces for the dominant exception.", { command: "grep -A 12 'NullPointerException' /var/log/app/api-server-02.log | head -60" }),
      st("Check", "Correlate with deploys", 2, "Errors spiking after a deploy = rollback candidate (see RB-1049)."),
      st("Manual", "Apply fix", 10, "Config error: fix config and roll. Poison input: patch validation. Dependency: switch to fallback path."),
    ],
    rollback: [
      st("Manual", "Revert config", 5, "Restore the previous configuration values if the fix increased errors."),
    ],
    verification: [
      st("Check", "Error rate baseline", 10, "Error rate < 1% for 15 minutes."),
    ],
    tags: ["errors", "exceptions", "error-rate"], lastReviewedDaysAgo: 118, createdDaysAgo: 165, updatedDaysAgo: 118,
    helpfulCount: 18, notHelpfulCount: 5, lastChangeNote: "Added stack-trace sampling step.",
  },
  {
    id: "RB-1057", title: "Disk I/O wait high", category: "Storage", severity: "Medium",
    summary: "Diagnose high iowait on a host: find the I/O heavy process, check for volume saturation and failing disks, and move or throttle the workload.",
    services: ["db-01", "storage-01"], linkedAlertRuleIds: ["RUL-218"],
    owner: "Tom Becker", team: "Infrastructure", status: "Needs review", version: 2, estimatedMinutes: 20,
    prerequisites: ["SSH/iostat access on the host", "Knowledge of the volume layout"],
    steps: [
      st("Command", "Measure iowait", 2, "CPU iowait and per-disk utilization.", { command: "iostat -x 1 5" }),
      st("Command", "Find the I/O heavy process", 3, "Per-process I/O counters.", { command: "pidstat -d 1 5" }),
      st("Check", "Check for disk errors", 3, "dmesg and SMART for failing devices.", { command: "dmesg -T | grep -iE 'error|fail|reset' | tail -20" }),
      st("Manual", "Move or throttle", 12, "Reschedule the batch job to off-peak, or move the hot volume to faster storage. Failing disk: replace and resilver (see hardware runbook)."),
    ],
    rollback: [
      st("Manual", "Revert workload move", 10, "If the workload was migrated and performs worse, move it back after confirming storage tier characteristics."),
    ],
    verification: [
      st("Check", "iowait normal", 10, "%iowait < 10 for 15 minutes."),
    ],
    tags: ["io", "iowait", "disk", "storage"], lastReviewedDaysAgo: 142, createdDaysAgo: 200, updatedDaysAgo: 142,
    helpfulCount: 15, notHelpfulCount: 2, lastChangeNote: "Added pidstat step.",
  },
  {
    id: "RB-1058", title: "Cache hit ratio low", category: "Application", severity: "Low",
    summary: "Recover a degraded cache hit ratio: verify cache population, key TTL consistency, and whether a deploy changed the cache key format.",
    services: ["cache-01", "api-server-01"], linkedAlertRuleIds: ["RUL-222"],
    owner: "Priya Nair", team: "Platform", status: "Needs review", version: 2, estimatedMinutes: 15,
    prerequisites: ["Redis CLI access", "Recent deploy timeline for the app tier"],
    steps: [
      st("Command", "Current hit ratio", 2, "Hits/misses since the last restart.", { command: "redis-cli -h cache-01 info stats | grep -E 'keyspace_hits|keyspace_misses'" }),
      st("Check", "Check key TTLs", 3, "A deploy clearing TTLs causes a miss spike; check SETEX/EXPIRE in recent code."),
      st("Manual", "Re-warm and fix", 10, "Re-warm the top key families, or roll back the key-format change. Confirm TTLs match the expected distribution."),
    ],
    rollback: [
      st("Manual", "Roll back cache change", 5, "Restore previous TTL/key configuration from the last release."),
    ],
    verification: [
      st("Check", "Hit ratio > 90%", 15, "Ratio recovers above 90% for 30 minutes."),
    ],
    tags: ["cache", "hit-ratio", "ttl", "redis"], lastReviewedDaysAgo: 96, createdDaysAgo: 155, updatedDaysAgo: 96,
    helpfulCount: 12, notHelpfulCount: 3,
  },
  {
    id: "RB-1059", title: "Database connection pool exhausted", category: "Database", severity: "Critical",
    summary: "Recover from connection pool exhaustion on the primary: count waiting clients, kill idle-in-transaction sessions, and rebalance app pool settings.",
    services: ["db-01", "db-02"], linkedAlertRuleIds: ["RUL-225"],
    owner: "Marcus Lee", team: "Data", status: "Needs review", version: 4, estimatedMinutes: 15,
    prerequisites: ["superuser access on the primary", "App pool configuration per service", "Awareness of in-flight migrations holding locks"],
    steps: [
      st("Command", "Count pool users", 2, "Active vs idle vs idle-in-transaction sessions.", { command: "psql -h db-01 -c \"select state, count(*) from pg_stat_activity group by state;\"" }),
      st("Command", "Kill idle-in-transaction", 4, "Sessions stuck in transaction hold connections.", { command: "psql -h db-01 -c \"select pg_terminate_backend(pid) from pg_stat_activity where state='idle in transaction' and state_change < now() - interval '5 minutes';\"", expectedOutput: "One row per terminated session." }),
      st("Check", "Confirm app pool settings", 3, "max_connections per app instance x instances < 80% of postgres max_connections."),
      st("Manual", "Rebalance pools", 6, "Lower app pool max, or raise postgres max_connections with the DBA, or add PgBouncer in front of the app tier."),
    ],
    rollback: [
      st("Command", "Restore session settings", 2, "Return max_connections to the previous value after the incident.", { command: "ALTER SYSTEM SET max_connections = <prev>; SELECT pg_reload_conf();" }),
    ],
    verification: [
      st("Check", "Wait queue empty", 5, "Zero clients waiting for connections for 10 minutes."),
      st("Check", "Error rate cleared", 5, "App 5xx from pool timeouts at zero."),
    ],
    tags: ["postgres", "pool", "connections", "database"], lastReviewedDaysAgo: 105, createdDaysAgo: 175, updatedDaysAgo: 105,
    helpfulCount: 25, notHelpfulCount: 2, lastChangeNote: "Added idle-in-transaction auto-kill with 5m threshold.",
  },
  {
    id: "RB-1060", title: "Kubelet disk pressure", category: "Compute", severity: "Critical",
    summary: "Draft: recover a node reporting DiskPressure: clean kubelet/image GC artefacts, verify eviction thresholds and reclaim space safely.",
    services: ["worker-01", "edge-01"], linkedAlertRuleIds: ["RUL-223"],
    owner: "Tom Becker", team: "Infrastructure", status: "Draft", version: 1, estimatedMinutes: 20,
    prerequisites: ["SSH access to the node", "kubectl access"],
    steps: [
      st("Command", "Check eviction signals", 2, "Kubelet eviction manager decisions.", { command: "journalctl -u kubelet | grep -i evict | tail -20" }),
      st("Command", "Reclaim image space", 5, "Garbage-collect unused images.", { command: "crictl rmi --prune" }),
      st("Manual", "Verify and escalate", 13, "If pressure persists, cordon the node and page storage."),
    ],
    rollback: [
      st("Manual", "Uncordon", 2, "Return the node to service after pressure clears."),
    ],
    verification: [
      st("Check", "Pressure cleared", 10, "DiskPressure condition False for 15 minutes."),
    ],
    tags: ["kubernetes", "kubelet", "disk", "eviction"], lastReviewedDaysAgo: 60, createdDaysAgo: 45, updatedDaysAgo: 20,
    helpfulCount: 0, notHelpfulCount: 0,
  },
  {
    id: "RB-1061", title: "Anomaly: request spike", category: "Application", severity: "Medium",
    summary: "Draft: triage an anomalous request-volume spike: distinguish traffic surge from attack/retry storm, and enable rate limiting if needed.",
    services: ["api-server-01", "edge-01", "lb-01"], linkedAlertRuleIds: ["RUL-224"],
    owner: "Priya Nair", team: "Platform", status: "Draft", version: 1, estimatedMinutes: 15,
    prerequisites: ["CDN/WAF console access", "Rate-limit configuration access"],
    steps: [
      st("Command", "Characterize the spike", 3, "Requests by path and source ASN.", { command: "awk '{print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10" }),
      st("Check", "Organic vs anomalous", 4, "Compare against the same hour last week; check for single-IP concentration."),
      st("Manual", "Apply rate limit", 8, "If the profile is anomalous, apply the WAF/rate-limit rule for the offending path and notify Security."),
    ],
    rollback: [
      st("Manual", "Remove temporary rate limit", 3, "Lift the emergency limit after the spike subsides."),
    ],
    verification: [
      st("Check", "Traffic baseline", 10, "Request rate within 20% of the trailing 4-week same-hour average."),
    ],
    tags: ["anomaly", "traffic", "waf", "rate-limit"], lastReviewedDaysAgo: 30, createdDaysAgo: 20, updatedDaysAgo: 6,
    helpfulCount: 0, notHelpfulCount: 0,
  },
  {
    id: "RB-1062", title: "Postgres table bloat", category: "Database", severity: "Low",
    summary: "Draft: identify and remediate table bloat: measure dead tuples, run targeted VACUUM, and adjust autovacuum for hot tables.",
    services: ["db-01"], linkedAlertRuleIds: ["RUL-220"],
    owner: "Marcus Lee", team: "Data", status: "Draft", version: 1, estimatedMinutes: 30,
    prerequisites: ["Read access on pg_stat_user_tables", "Scheduled maintenance window for heavy vacuums"],
    steps: [
      st("Command", "Measure bloat", 5, "Dead tuple ratio for the top tables.", { command: "psql -h db-01 -c \"select relname, n_dead_tup, n_live_tup, round(100.0*n_dead_tup/nullif(n_live_tup+n_dead_tup,0),1) as pct_dead from pg_stat_user_tables order by n_dead_tup desc limit 10;\"" }),
      st("Command", "Vacuum the hottest table", 15, "Run a non-blocking VACUUM on the target table.", { command: "psql -h db-01 -c 'VACUUM (ANALYZE) <table>;'" }),
      st("Manual", "Tune autovacuum", 10, "Lower autovacuum_vacuum_scale_factor for the bloated table."),
    ],
    rollback: [
      st("Manual", "Revert autovacuum settings", 5, "Restore previous storage parameters if write amplification increases."),
    ],
    verification: [
      st("Check", "Dead tuple ratio down", 15, "pg_stat_user_tables shows dead tuples below 10% for the table."),
    ],
    tags: ["postgres", "bloat", "vacuum", "autovacuum"], lastReviewedDaysAgo: 75, createdDaysAgo: 60, updatedDaysAgo: 45,
    helpfulCount: 0, notHelpfulCount: 0,
  },
  {
    id: "RB-1063", title: "Composite: latency + 5xx spike", category: "Application", severity: "Critical",
    summary: "Archived: superseded by RB-1042 + RB-1049 - the composite rule RUL-225 is handled by the two dedicated runbooks; kept for audit history.",
    services: ["api-server-01", "api-server-02", "web-app-01"], linkedAlertRuleIds: ["RUL-225"],
    owner: "Sara Iqbal", team: "Platform", status: "Archived", version: 2, estimatedMinutes: 25,
    prerequisites: ["Access to both dedicated runbooks"],
    steps: [
      st("Manual", "Use the dedicated runbooks", 5, "Execute RB-1042 (latency) and RB-1049 (5xx) in parallel; this composite runbook is retired."),
    ],
    rollback: [
      st("Manual", "None", 1, "Superseded procedure - follow the dedicated runbooks' rollback sections."),
    ],
    verification: [
      st("Check", "Both alerts cleared", 5, "RUL-203, RUL-207, RUL-215 and RUL-225 silent for two windows."),
    ],
    tags: ["composite", "latency", "5xx", "archived"], lastReviewedDaysAgo: 190, createdDaysAgo: 365, updatedDaysAgo: 190,
    helpfulCount: 9, notHelpfulCount: 3, lastChangeNote: "Archived - superseded by RB-1042 and RB-1049.",
  },
];

function buildHistory(spec: SeedSpec): RunbookHistoryEntry[] {
  const history: RunbookHistoryEntry[] = [
    { version: 1, by: spec.owner, at: iso(now - spec.createdDaysAgo * DAY), note: "Initial runbook created." },
  ];
  if (spec.version >= 3) {
    history.push({ version: spec.version - 1, by: spec.owner, at: iso(now - Math.floor((spec.createdDaysAgo - spec.updatedDaysAgo) / 2 + spec.updatedDaysAgo) * DAY), note: "Reviewed and updated during quarterly review." });
  }
  history.push({ version: spec.version, by: spec.owner, at: iso(now - spec.updatedDaysAgo * DAY), note: spec.lastChangeNote ?? "Reviewed; steps verified against current systems." });
  return history;
}

function buildRunbook(spec: SeedSpec): Runbook {
  const assign = (steps: RunbookStep[], prefix: string) => steps.map((step, index) => ({ ...step, id: `${prefix}-${index + 1}` }));
  const steps = assign(spec.steps, "step");
  const rollback = assign(spec.rollback, "rb");
  const verification = assign(spec.verification, "ver");
  return {
    id: spec.id,
    title: spec.title,
    summary: spec.summary,
    category: spec.category,
    severity: spec.severity,
    services: [...spec.services],
    linkedAlertRuleIds: [...spec.linkedAlertRuleIds],
    owner: spec.owner,
    team: spec.team,
    status: spec.status,
    version: spec.version,
    estimatedMinutes: spec.estimatedMinutes,
    prerequisites: [...spec.prerequisites],
    steps,
    rollback,
    verification,
    tags: [...spec.tags],
    lastReviewedAt: iso(now - spec.lastReviewedDaysAgo * DAY),
    reviewIntervalDays: spec.reviewIntervalDays ?? 90,
    createdAt: iso(now - spec.createdDaysAgo * DAY),
    updatedAt: iso(now - spec.updatedDaysAgo * DAY),
    epochMs: now,
    helpfulCount: spec.helpfulCount,
    notHelpfulCount: spec.notHelpfulCount,
    history: buildHistory(spec),
  };
}

let RUNBOOKS: Runbook[] = SEED_SPECS.map(buildRunbook);

interface ExecutionSeed {
  runbookId: string;
  by: string;
  daysAgo: number;
  hourOffset: number;
  durationMin: number;
  result: RunbookExecutionResult;
  stepsDone: number;
  incidentId?: string;
  notes: string;
}

const EXECUTION_SEEDS: ExecutionSeed[] = [
  { runbookId: "RB-1042", by: "Sara Iqbal", daysAgo: 0, hourOffset: 4, durationMin: 14, result: "Completed", stepsDone: 5, incidentId: "INC-1046", notes: "Hot route scaled to 6 replicas; p95 back under 400ms." },
  { runbookId: "RB-1047", by: "Sara Iqbal", daysAgo: 0, hourOffset: 8, durationMin: 11, result: "Completed", stepsDone: 5, notes: "Pool-vault credentials rotated by operator; run re-triggered OK." },
  { runbookId: "RB-1042", by: "Marcus Lee", daysAgo: 1, hourOffset: 6, durationMin: 17, result: "Completed", stepsDone: 5, incidentId: "INC-1048", notes: "Deploy v2.14.3 rollback; error rate recovered." },
  { runbookId: "RB-1043", by: "Marcus Lee", daysAgo: 1, hourOffset: 10, durationMin: 13, result: "Completed", stepsDone: 5, incidentId: "INC-1047", notes: "pgbouncer bounced on app tier; pool drained." },
  { runbookId: "RB-1044", by: "Tom Becker", daysAgo: 2, hourOffset: 5, durationMin: 22, result: "Completed", stepsDone: 5, notes: "logrotate + docker prune reclaimed 38GB on worker-01." },
  { runbookId: "RB-1048", by: "Tom Becker", daysAgo: 2, hourOffset: 9, durationMin: 12, result: "Completed", stepsDone: 4, notes: "Batch job killed; reniced offenders." },
  { runbookId: "RB-1047", by: "Sara Iqbal", daysAgo: 3, hourOffset: 7, durationMin: 16, result: "Completed", stepsDone: 5, notes: "S3 lifecycle lock cleared; rerun succeeded." },
  { runbookId: "RB-1049", by: "Marcus Lee", daysAgo: 3, hourOffset: 11, durationMin: 9, result: "Completed", stepsDone: 5, incidentId: "INC-1043", notes: "Canary 5xx traced to bad config; rolled back." },
  { runbookId: "RB-1051", by: "Sara Iqbal", daysAgo: 4, hourOffset: 4, durationMin: 8, result: "Completed", stepsDone: 4, notes: "readiness probe hit cache dependency; cache restored." },
  { runbookId: "RB-1042", by: "Priya Nair", daysAgo: 4, hourOffset: 8, durationMin: 19, result: "Aborted", stepsDone: 2, notes: "Spike resolved itself; aborted at step 2." },
  { runbookId: "RB-1044", by: "Tom Becker", daysAgo: 5, hourOffset: 6, durationMin: 26, result: "Completed", stepsDone: 5, notes: "storage-01 cleaned; 120GB reclaimed." },
  { runbookId: "RB-1043", by: "Marcus Lee", daysAgo: 6, hourOffset: 3, durationMin: 15, result: "Completed", stepsDone: 5, notes: "db-02 promotion rehearsal executed cleanly." },
  { runbookId: "RB-1048", by: "Tom Becker", daysAgo: 6, hourOffset: 12, durationMin: 10, result: "Completed", stepsDone: 4, notes: "worker-01 load normalised." },
  { runbookId: "RB-1054", by: "Priya Nair", daysAgo: 7, hourOffset: 5, durationMin: 13, result: "Failed", stepsDone: 3, incidentId: "INC-1045", notes: "TTL overrides reverted; eviction storm returned." },
  { runbookId: "RB-1056", by: "Marcus Lee", daysAgo: 7, hourOffset: 14, durationMin: 14, result: "Completed", stepsDone: 4, notes: "NullPointer in order transformer; patched." },
  { runbookId: "RB-1047", by: "Sara Iqbal", daysAgo: 8, hourOffset: 6, durationMin: 10, result: "Completed", stepsDone: 5, notes: "BJ-1054 retry succeeded after vault endpoint fix." },
  { runbookId: "RB-1050", by: "Priya Nair", daysAgo: 9, hourOffset: 9, durationMin: 16, result: "Completed", stepsDone: 4, notes: "app-server-02 rolling restart; RSS headroom restored." },
  { runbookId: "RB-1042", by: "Sara Iqbal", daysAgo: 10, hourOffset: 4, durationMin: 15, result: "Completed", stepsDone: 5, notes: "Gateway route hot; autoscaled and cooled down." },
  { runbookId: "RB-1049", by: "Marcus Lee", daysAgo: 11, hourOffset: 8, durationMin: 11, result: "Failed", stepsDone: 3, notes: "Rollback did not clear 5xx; dependency issue, escalated to db team." },
  { runbookId: "RB-1046", by: "Priya Nair", daysAgo: 12, hourOffset: 10, durationMin: 18, result: "Completed", stepsDone: 4, notes: "api.example.com cert renewed; edges reloaded." },
  { runbookId: "RB-1053", by: "Marcus Lee", daysAgo: 13, hourOffset: 7, durationMin: 22, result: "Completed", stepsDone: 4, notes: "Long migration query killed; lag replayed." },
  { runbookId: "RB-1044", by: "Tom Becker", daysAgo: 14, hourOffset: 4, durationMin: 28, result: "Completed", stepsDone: 5, notes: "db-01 base volume at 82%; cleanup done." },
  { runbookId: "RB-1045", by: "Tom Becker", daysAgo: 16, hourOffset: 6, durationMin: 24, result: "Completed", stepsDone: 5, notes: "edge-01 kubelet restarted; node rejoined." },
  { runbookId: "RB-1047", by: "Sara Iqbal", daysAgo: 18, hourOffset: 5, durationMin: 12, result: "Completed", stepsDone: 5, notes: "BJ-1042 lock timeout; re-run success." },
  { runbookId: "RB-1055", by: "Sara Iqbal", daysAgo: 20, hourOffset: 9, durationMin: 17, result: "Completed", stepsDone: 4, notes: "queue-01 drained after consumer scale-out." },
  { runbookId: "RB-1048", by: "Tom Becker", daysAgo: 22, hourOffset: 8, durationMin: 9, result: "Completed", stepsDone: 4, notes: "cache-01 CPU normalised after eviction fix." },
  { runbookId: "RB-1051", by: "Priya Nair", daysAgo: 24, hourOffset: 7, durationMin: 7, result: "Completed", stepsDone: 4, notes: "Probe sub-check on queue recovered." },
  { runbookId: "RB-1046", by: "Priya Nair", daysAgo: 26, hourOffset: 11, durationMin: 16, result: "Aborted", stepsDone: 2, notes: "Cert auto-renewed by ACME; no manual action needed." },
  { runbookId: "RB-1049", by: "Marcus Lee", daysAgo: 28, hourOffset: 6, durationMin: 10, result: "Completed", stepsDone: 5, notes: "web-02 5xx cleared after config rollback." },
  { runbookId: "RB-1043", by: "Marcus Lee", daysAgo: 30, hourOffset: 5, durationMin: 14, result: "Completed", stepsDone: 5, notes: "db-01 connectivity restored after brief network partition." },
];

function buildExecution(seed: ExecutionSeed, index: number): RunbookExecution {
  const startMs = now - seed.daysAgo * DAY - seed.hourOffset * HOUR;
  const endMs = startMs + seed.durationMin * MIN;
  return {
    id: `EX-${9001 + index}`,
    runbookId: seed.runbookId,
    by: seed.by,
    incidentId: seed.incidentId ?? null,
    startedAt: iso(startMs),
    endedAt: iso(endMs),
    epochMs: startMs,
    durationMs: seed.durationMin * MIN,
    result: seed.result,
    stepsDone: seed.stepsDone,
    notes: seed.notes,
  };
}

let EXECUTIONS: RunbookExecution[] = EXECUTION_SEEDS.map(buildExecution);

const listeners = new Set<() => void>();
function emit() { for (const listener of [...listeners]) listener(); }
export function subscribeRunbooks(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getRunbookSnapshot(): Runbook[] { return RUNBOOKS; }
export function getRunbookById(id: string): Runbook | undefined { return RUNBOOKS.find((runbook) => runbook.id === id); }
export function getExecutionSnapshot(): RunbookExecution[] { return EXECUTIONS; }
export function executionsForRunbook(runbookId: string): RunbookExecution[] { return EXECUTIONS.filter((execution) => execution.runbookId === runbookId); }

export function nextRunbookId(): string {
  let max = 1041;
  for (const runbook of RUNBOOKS) {
    const match = /^RB-(\d+)$/.exec(runbook.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `RB-${max + 1}`;
}
export function nextExecutionId(): string {
  let max = 9000;
  for (const execution of EXECUTIONS) {
    const match = /^EX-(\d+)$/.exec(execution.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `EX-${max + 1}`;
}

/** Async fetch with simulated latency; swap this one function for a real API later. */
export function fetchRunbooks(): Promise<{ runbooks: Runbook[]; executions: RunbookExecution[] }> {
  return new Promise((resolve) => {
    const timer = typeof window !== "undefined" ? window.setTimeout : setTimeout;
    timer(() => resolve({ runbooks: [...RUNBOOKS], executions: [...EXECUTIONS] }), 200 + Math.random() * 200);
  });
}

export interface RunbookMutation {
  ids: string[];
  patch: (runbook: Runbook) => Partial<Runbook> | null;
  historyNote?: string;
}
export function mutateRunbooks({ ids, patch, historyNote }: RunbookMutation): void {
  const at = iso(Date.now());
  RUNBOOKS = RUNBOOKS.map((runbook) => {
    if (!ids.includes(runbook.id)) return runbook;
    const partial = patch(runbook);
    if (!partial) return runbook;
    const nextVersion = partial.version ?? runbook.version;
    const history = historyNote
      ? [...runbook.history, { version: nextVersion, by: runbook.owner, at, note: historyNote }]
      : runbook.history;
    return { ...runbook, ...partial, history };
  });
  emit();
}

export function archiveRunbooks(ids: string[]): void {
  mutateRunbooks({ ids, patch: (runbook) => (runbook.status === "Archived" ? null : { status: "Archived" }), historyNote: "Archived by operator." });
}
export function markRunbookReviewed(id: string): void {
  const at = iso(Date.now());
  mutateRunbooks({ ids: [id], patch: () => ({ lastReviewedAt: at, status: "Published" }), historyNote: "Marked reviewed after quarterly check." });
}
export function duplicateRunbook(id: string): Runbook | null {
  const source = getRunbookById(id);
  if (!source) return null;
  const nowId = nextRunbookId();
  const copy: Runbook = {
    ...source,
    id: nowId,
    title: `${source.title} (copy)`,
    status: "Draft",
    version: 1,
    helpfulCount: 0,
    notHelpfulCount: 0,
    createdAt: iso(Date.now()),
    updatedAt: iso(Date.now()),
    lastReviewedAt: iso(Date.now()),
    history: [{ version: 1, by: source.owner, at: iso(Date.now()), note: `Duplicated from ${source.id}.` }],
  };
  RUNBOOKS = [copy, ...RUNBOOKS];
  emit();
  return copy;
}

export interface RunbookDraftInput {
  title: string;
  summary: string;
  category: RunbookCategory;
  severity: RunbookSeverity;
  tags: string[];
  owner: string;
  team: string;
  reviewIntervalDays: number;
  linkedAlertRuleIds: string[];
  services: string[];
  prerequisites: string[];
  steps: RunbookStep[];
  rollback: RunbookStep[];
  verification: RunbookStep[];
  status: RunbookStatus;
}
export function createRunbook(input: RunbookDraftInput): Runbook {
  const id = nextRunbookId();
  const at = iso(Date.now());
  const estimatedMinutes = [...input.steps, ...input.rollback, ...input.verification].reduce((sum, step) => sum + step.estimatedMinutes, 0);
  const runbook: Runbook = {
    id,
    title: input.title,
    summary: input.summary,
    category: input.category,
    severity: input.severity,
    services: [...input.services],
    linkedAlertRuleIds: [...input.linkedAlertRuleIds],
    owner: input.owner,
    team: input.team,
    status: input.status,
    version: 1,
    estimatedMinutes,
    prerequisites: [...input.prerequisites],
    steps: input.steps.map((step, index) => ({ ...step, id: `step-${index + 1}` })),
    rollback: input.rollback.map((step, index) => ({ ...step, id: `rb-${index + 1}` })),
    verification: input.verification.map((step, index) => ({ ...step, id: `ver-${index + 1}` })),
    tags: [...input.tags],
    lastReviewedAt: at,
    reviewIntervalDays: input.reviewIntervalDays,
    createdAt: at,
    updatedAt: at,
    epochMs: Date.now(),
    helpfulCount: 0,
    notHelpfulCount: 0,
    history: [{ version: 1, by: input.owner, at, note: input.status === "Draft" ? "Saved as draft." : "Published." }],
  };
  RUNBOOKS = [runbook, ...RUNBOOKS];
  emit();
  return runbook;
}

export function updateRunbook(id: string, input: RunbookDraftInput): Runbook | null {
  const existing = getRunbookById(id);
  if (!existing) return null;
  const at = iso(Date.now());
  const bump = input.status === "Published" || existing.status !== input.status;
  const estimatedMinutes = [...input.steps, ...input.rollback, ...input.verification].reduce((sum, step) => sum + step.estimatedMinutes, 0);
  const patch: Partial<Runbook> = {
    ...input,
    services: [...input.services],
    linkedAlertRuleIds: [...input.linkedAlertRuleIds],
    prerequisites: [...input.prerequisites],
    tags: [...input.tags],
    steps: input.steps.map((step, index) => ({ ...step, id: `step-${index + 1}` })),
    rollback: input.rollback.map((step, index) => ({ ...step, id: `rb-${index + 1}` })),
    verification: input.verification.map((step, index) => ({ ...step, id: `ver-${index + 1}` })),
    estimatedMinutes,
    updatedAt: at,
    ...(input.status === "Published" ? { lastReviewedAt: at } : {}),
    ...(bump ? { version: existing.version + 1 } : {}),
  };
  mutateRunbooks({ ids: [id], patch: () => patch, historyNote: input.status === "Draft" ? "Saved as draft." : `Updated and published v${existing.version + 1}.` });
  return getRunbookById(id) ?? null;
}

export interface ExecutionInput {
  runbookId: string;
  by: string;
  incidentId: string | null;
  startedAt: string;
  endedAt: string | null;
  epochMs: number;
  durationMs: number | null;
  result: RunbookExecutionResult;
  stepsDone: number;
  notes: string;
}
export function recordExecution(input: ExecutionInput): RunbookExecution {
  const execution: RunbookExecution = { id: nextExecutionId(), ...input };
  EXECUTIONS = [execution, ...EXECUTIONS];
  emit();
  return execution;
}
export function recordHelpful(id: string, helpful: boolean): void {
  mutateRunbooks({ ids: [id], patch: (runbook) => (helpful ? { helpfulCount: runbook.helpfulCount + 1 } : { notHelpfulCount: runbook.notHelpfulCount + 1 }) });
}

/* ---------- derived stats (single source for banner / cards / charts) ---------- */

export function isNeedsReview(runbook: Runbook): boolean {
  if (runbook.status === "Needs review") return true;
  if (runbook.status === "Archived" || runbook.status === "Draft") return false;
  const elapsedDays = (Date.now() - new Date(runbook.lastReviewedAt).getTime()) / DAY;
  return elapsedDays > runbook.reviewIntervalDays;
}

export interface RunbookStats {
  total: number;
  published: number;
  draft: number;
  needsReview: number;
  archived: number;
  coverageCount: number;
  coverageTotal: number;
  coveragePct: number;
  uncoveredRuleIds: string[];
  executions30d: number;
  avgMinutes: number | null;
  successPct: number | null;
  usage30d: Map<string, number>;
  helpfulPct: (runbook: Runbook) => number | null;
}
export function getRunbookStats(): RunbookStats {
  const runbooks = RUNBOOKS;
  const active = runbooks.filter((runbook) => runbook.status !== "Archived");
  const published = runbooks.filter((runbook) => runbook.status === "Published").length;
  const draft = runbooks.filter((runbook) => runbook.status === "Draft").length;
  const archived = runbooks.filter((runbook) => runbook.status === "Archived").length;
  const needsReview = runbooks.filter(isNeedsReview).length;
  const linked = new Set<string>();
  for (const runbook of active) for (const ruleId of runbook.linkedAlertRuleIds) linked.add(ruleId);
  const coverageTotal = ALERT_RULE_LIST.length;
  const coverageCount = ALERT_RULE_LIST.filter((rule) => linked.has(rule.id)).length;
  const uncoveredRuleIds = ALERT_RULE_LIST.filter((rule) => !linked.has(rule.id)).map((rule) => rule.id);
  const since = Date.now() - 30 * DAY;
  const executions30d = EXECUTIONS.filter((execution) => execution.epochMs >= since);
  const durations = executions30d.map((execution) => execution.durationMs).filter((value): value is number => value != null);
  const avgMinutes = durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length / MIN) : null;
  const completed = executions30d.filter((execution) => execution.result === "Completed").length;
  const successPct = executions30d.length > 0 ? Math.round((completed / executions30d.length) * 100) : null;
  const usage30d = new Map<string, number>();
  for (const execution of executions30d) usage30d.set(execution.runbookId, (usage30d.get(execution.runbookId) ?? 0) + 1);
  const helpfulPct = (runbook: Runbook) => {
    const total = runbook.helpfulCount + runbook.notHelpfulCount;
    return total > 0 ? Math.round((runbook.helpfulCount / total) * 100) : null;
  };
  return {
    total: runbooks.length,
    published,
    draft,
    needsReview,
    archived,
    coverageCount,
    coverageTotal,
    coveragePct: coverageTotal > 0 ? Math.round((coverageCount / coverageTotal) * 100) : 0,
    uncoveredRuleIds,
    executions30d: executions30d.length,
    avgMinutes,
    successPct,
    usage30d,
    helpfulPct,
  };
}

/** Map an alert rule id to its best-matching non-archived runbook (Published preferred). */
export function getRunbookForRule(ruleId: string): Runbook | null {
  const candidates = RUNBOOKS.filter((runbook) => runbook.linkedAlertRuleIds.includes(ruleId) && runbook.status !== "Archived");
  return candidates.find((runbook) => runbook.status === "Published") ?? candidates[0] ?? null;
}

/** Map an incident id to the most recently executed non-archived runbook for it (executions are the only incident↔runbook link). */
export function getRunbookForIncident(incidentId: string): Runbook | null {
  const executions = EXECUTIONS.filter((execution) => execution.incidentId === incidentId);
  for (const execution of [...executions].sort((a, b) => b.epochMs - a.epochMs)) {
    const runbook = getRunbookById(execution.runbookId);
    if (runbook && runbook.status !== "Archived") return runbook;
  }
  return null;
}

export const CURRENT_RUNBOOK_USER = "you@nexus.io";
