import type { Server } from "./servers";

export type ServerEventSeverity = "Info" | "Warning" | "Critical";
export type ServerActionId =
  | "view-logs"
  | "view-metrics"
  | "open-terminal"
  | "manage-services"
  | "update-agent"
  | "add-to-group"
  | "create-alert-rule"
  | "restart-server"
  | "maintenance-mode";

export interface ServerDetailEvent {
  id: string;
  occurredAt: string;
  severity: ServerEventSeverity;
  message: string;
  status: "Logged" | "Open" | "Resolved";
}

export interface ServerQuickAction {
  id: ServerActionId;
  label: string;
  requiresAdmin?: boolean;
}

export interface ServerQuickActionGroup {
  label: "Diagnose" | "Manage" | "Danger zone";
  actions: ServerQuickAction[];
}

const severityForMetric = (value: number): ServerEventSeverity => (
  value >= 90 ? "Critical" : value >= 80 ? "Warning" : "Info"
);

const eventStatus = (severity: ServerEventSeverity, resolved = false): ServerDetailEvent["status"] => (
  severity === "Info" ? "Logged" : resolved ? "Resolved" : "Open"
);

export function getServerDetailEvents(server: Server, now = Date.now()): ServerDetailEvent[] {
  if (server.agent === "Pending") return [];
  const metrics = [
    { key: "memory", label: "Memory utilization", value: server.memory, ageMinutes: 18 },
    { key: "disk", label: "Disk utilization", value: server.disk, ageMinutes: 52 },
    { key: "cpu", label: "CPU utilization", value: server.cpu, ageMinutes: 115 },
  ];
  const event = (id: string, ageMinutes: number, severity: ServerEventSeverity, message: string, resolved = false): ServerDetailEvent => ({
    id,
    occurredAt: new Date(now - ageMinutes * 60_000).toISOString(),
    severity,
    message,
    status: eventStatus(severity, resolved),
  });

  return [
    event("server-status", 2, "Info", `Server status ${server.health}`),
    event("memory", metrics[0].ageMinutes, severityForMetric(metrics[0].value), `${metrics[0].label} ${metrics[0].value}%`),
    event("agent-heartbeat", 31, "Info", `${server.agent} agent heartbeat · ${server.heartbeat}`),
    event("disk", metrics[1].ageMinutes, severityForMetric(metrics[1].value), `${metrics[1].label} ${metrics[1].value}%`),
    event("service-restarted", 76, "Info", "Service restarted successfully"),
    event("backup-completed", 94, "Info", "Backup completed successfully"),
    event("cpu", metrics[2].ageMinutes, severityForMetric(metrics[2].value), `${metrics[2].label} ${metrics[2].value}%`, true),
    event("new-ip-login", 188, "Info", "Login from new IP address"),
  ].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export const serverQuickActionGroups: ServerQuickActionGroup[] = [
  {
    label: "Diagnose",
    actions: [
      { id: "view-logs", label: "View Logs" },
      { id: "view-metrics", label: "View Metrics" },
      { id: "open-terminal", label: "Open Terminal" },
    ],
  },
  {
    label: "Manage",
    actions: [
      { id: "manage-services", label: "Manage Services" },
      { id: "update-agent", label: "Update Agent" },
      { id: "add-to-group", label: "Add to Group" },
      { id: "create-alert-rule", label: "Create Alert Rule" },
    ],
  },
  {
    label: "Danger zone",
    actions: [
      { id: "restart-server", label: "Restart Server", requiresAdmin: true },
      { id: "maintenance-mode", label: "Enable Maintenance Mode", requiresAdmin: true },
    ],
  },
];

export const mockServerActionUser = { name: "admin", permissions: ["server:manage"] as const };
