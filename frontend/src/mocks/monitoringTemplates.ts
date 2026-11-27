export type TemplateStatus = "Published" | "Draft" | "Deprecated";
export type TemplateCategory = "Server OS" | "Database" | "Network" | "Web/API" | "Container" | "Application" | "Cloud";
export type TargetType = "Server" | "Network Device" | "Database" | "Website" | "Container";
export type AssignmentStatus = "Applied" | "Pending" | "Failed" | "Drifted";

export interface TemplateVariable { name: string; default: string | number; description: string; }
export interface TemplateCheck { id: string; name: string; key: string; type: "Metric" | "Log" | "Probe"; intervalSec: number; retentionDays: number; unit: string; collector: string; enabled: boolean; }
export interface TemplateAlertRule { name: string; severity: "Critical" | "High" | "Medium" | "Low"; condition: string; durationMin: number; notifyChannels: string[]; autoResolve: boolean; }
export interface MonitoringTemplate { id: string; name: string; description: string; category: TemplateCategory; targetType: TargetType; builtIn: boolean; status: TemplateStatus; version: string; owner: string; team: string; tags: string[]; collectorsRequired: string[]; variables: TemplateVariable[]; items: TemplateCheck[]; alertRules: TemplateAlertRule[]; dashboards: string[]; createdAt: string; updatedAt: string; updatedBy: string; history: Array<{ version: string; by: string; at: string; note: string; }>; }
export interface TemplateAssignment { id: string; templateId: string; targetKind: "Asset" | "Group" | "Tag" | "OS"; targetRef: string; appliedAt: string; appliedBy: string; status: AssignmentStatus; overrides: Array<{ variable: string; templateValue: string | number; localValue: string | number }>; failReason?: string; }

const now = Date.now();
const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();
const names = ["Linux Server", "Windows Server", "Docker Host", "MySQL", "PostgreSQL", "Nginx", "Redis", "Network Switch (SNMP)", "Website / HTTP", "SSL Certificate", "Kubernetes Cluster", "API Gateway", "Java Application", "Node.js Service", "Cloud VM Baseline", "Database Backup", "Network Router", "Synthetic User Journey", "MongoDB", "Kafka"];
const categories: TemplateCategory[] = ["Server OS", "Server OS", "Container", "Database", "Database", "Web/API", "Database", "Network", "Web/API", "Web/API", "Container", "Application", "Application", "Application", "Cloud", "Database", "Network", "Web/API", "Database", "Application"];
const targetTypes: TargetType[] = ["Server", "Server", "Container", "Database", "Database", "Server", "Database", "Network Device", "Website", "Website", "Container", "Server", "Server", "Server", "Server", "Database", "Network Device", "Website", "Database", "Container"];
const statuses: TemplateStatus[] = ["Published", "Published", "Draft", "Published", "Published", "Published", "Published", "Published", "Published", "Published", "Published", "Draft", "Published", "Published", "Draft", "Published", "Deprecated", "Deprecated", "Published", "Published"];
const collectors = ["Prometheus", "Node Exporter", "Windows Exporter", "Blackbox Exporter", "Loki"];

export const monitoringTemplates: MonitoringTemplate[] = names.map((name, index) => ({
  id: `TPL-${1042 + index}`, name, description: `Production-ready checks and alert rules for ${name.toLowerCase()} workloads.`, category: categories[index], targetType: targetTypes[index], builtIn: index < 10, status: statuses[index], version: `v${index < 10 ? "3.2" : "1." + (index + 1)}`, owner: index % 2 ? "Platform Team" : "SRE Team", team: index % 2 ? "Platform" : "Reliability", tags: [categories[index].toLowerCase().replace("/", "-"), index < 10 ? "built-in" : "custom"], collectorsRequired: [collectors[index % collectors.length]], variables: [{ name: "{$CPU_WARN}", default: 80, description: "CPU warning threshold" }, { name: "{$MEM_WARN}", default: 85, description: "Memory warning threshold" }], items: ["CPU utilization", "Memory utilization", "Availability", "Error rate"].map((check, checkIndex) => ({ id: `CHK-${index}-${checkIndex}`, name: check, key: check.toLowerCase().replaceAll(" ", "."), type: check === "Availability" ? "Probe" : "Metric", intervalSec: 60, retentionDays: 30, unit: check === "Availability" ? "%" : "%", collector: collectors[index % collectors.length], enabled: true })), alertRules: [{ name: `${name} high CPU`, severity: index % 5 === 0 ? "Critical" : "High", condition: "CPU usage > {$CPU_WARN}% for 5m", durationMin: 5, notifyChannels: ["Email", "Slack"], autoResolve: true }], dashboards: ["Infrastructure Health", "Executive Overview"], createdAt: ago(120 - index * 3), updatedAt: ago(index + 1), updatedBy: index % 2 ? "Ayesha Khan" : "Tom Becker", history: [{ version: "v1.0", by: "Tom Becker", at: ago(120), note: "Initial template" }, { version: `v${index < 10 ? "3.2" : "1." + (index + 1)}`, by: "Ayesha Khan", at: ago(index + 1), note: "Thresholds and collector updates" }],
}));

export const templateAssignments: TemplateAssignment[] = monitoringTemplates.flatMap((template, index) => Array.from({ length: index < 4 ? 12 : index < 9 ? 7 : 3 }, (_, row) => ({ id: `ASN-${index}-${row}`, templateId: template.id, targetKind: row % 3 === 0 ? "Group" : "Asset", targetRef: `${template.name} ${row + 1}`, appliedAt: ago(row + 1), appliedBy: "you@nexus.io", status: row === 0 && index % 3 === 0 ? "Drifted" : "Applied", overrides: [] })));
export const templateStats = { total: 20, published: 15, appliedTargets: 118, coverage: 96, drifted: 7, unused: 2, checks: 214, staleCollectors: 1 };

let store = monitoringTemplates.map((template) => ({ ...template, items: [...template.items], alertRules: [...template.alertRules] }));
const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 200 + Math.floor(Math.random() * 201)));
export async function loadMonitoringTemplates(): Promise<MonitoringTemplate[]> { await delay(); return store.map((template) => ({ ...template, items: [...template.items], alertRules: [...template.alertRules] })); }
export async function loadMonitoringTemplate(id: string): Promise<MonitoringTemplate | null> { await delay(); return store.find((template) => template.id === id) ?? null; }
const cloneTemplate = (template: MonitoringTemplate): MonitoringTemplate => ({ ...template, items: [...template.items], alertRules: [...template.alertRules], variables: [...template.variables], tags: [...template.tags], collectorsRequired: [...template.collectorsRequired], dashboards: [...template.dashboards], history: [...template.history] });

export function cloneMonitoringTemplate(id: string): MonitoringTemplate | null { const source = store.find((template) => template.id === id); if (!source) return null; const clone = { ...cloneTemplate(source), id: `TPL-${Date.now()}`, name: `${source.name} (Custom)`, builtIn: false, status: "Draft" as const, version: "v1.0", updatedAt: new Date().toISOString() }; store = [clone, ...store]; return { ...cloneTemplate(clone) }; }
export function publishMonitoringTemplate(id: string): void { store = store.map((template) => template.id === id ? { ...template, status: "Published", version: `v${(Number(template.version.slice(1)) + 0.1).toFixed(1)}` } : template); }

/* --------------------- assignments + template actions ---------------------- */

let assignmentStore: TemplateAssignment[] = templateAssignments.map((assignment) => ({ ...assignment, overrides: [...assignment.overrides] }));

const cloneAssignment = (assignment: TemplateAssignment): TemplateAssignment => ({ ...assignment, overrides: assignment.overrides.map((override) => ({ ...override })) });

/** Snapshot of assignment records (cloned). */
export function readTemplateAssignments(): TemplateAssignment[] {
  return assignmentStore.map(cloneAssignment);
}

/** Assign a template to targets. Returns the number of assignments created. */
export function applyTemplateToTargets(templateId: string, targetKind: TemplateAssignment["targetKind"], targetRefs: string[]): number {
  const appliedAt = new Date().toISOString();
  const entries: TemplateAssignment[] = targetRefs.map((targetRef, index) => ({
    id: `ASN-${Date.now()}-${index}`,
    templateId,
    targetKind,
    targetRef,
    appliedAt,
    appliedBy: "you@nexus.io",
    status: "Applied" as AssignmentStatus,
    overrides: [],
  }));
  assignmentStore = [...entries, ...assignmentStore];
  return entries.length;
}

/** Remove a single assignment (unapply). */
export function removeTemplateAssignment(id: string): void {
  assignmentStore = assignmentStore.filter((assignment) => assignment.id !== id);
}

export interface NewTemplateInput {
  name: string;
  description?: string;
  category: TemplateCategory;
  targetType: TargetType;
  tags?: string[];
  collectorsRequired?: string[];
}

const defaultItems = (collector: string): TemplateCheck[] => (["CPU utilization", "Memory utilization", "Availability", "Error rate"] as const).map((check, index) => ({
  id: `CHK-${Date.now()}-${index}`,
  name: check,
  key: check.toLowerCase().replaceAll(" ", "."),
  type: check === "Availability" ? "Probe" : "Metric",
  intervalSec: 60,
  retentionDays: 30,
  unit: "%",
  collector,
  enabled: true,
}));

/** Create a custom Draft template and prepend it to the store. */
export function createMonitoringTemplate(input: NewTemplateInput): MonitoringTemplate {
  const name = input.name.trim();
  const nowIso = new Date().toISOString();
  const template: MonitoringTemplate = {
    id: `TPL-${Date.now()}`,
    name,
    description: input.description?.trim() || `Custom checks and alert rules for ${name.toLowerCase()} workloads.`,
    category: input.category,
    targetType: input.targetType,
    builtIn: false,
    status: "Draft",
    version: "v1.0",
    owner: "You",
    team: "Platform",
    tags: input.tags?.length ? [...input.tags] : [input.category.toLowerCase().replace("/", "-"), "custom"],
    collectorsRequired: input.collectorsRequired?.length ? [...input.collectorsRequired] : ["Prometheus"],
    variables: [
      { name: "{$CPU_WARN}", default: 80, description: "CPU warning threshold" },
      { name: "{$MEM_WARN}", default: 85, description: "Memory warning threshold" },
    ],
    items: defaultItems(input.collectorsRequired?.[0] ?? "Prometheus"),
    alertRules: [{ name: `${name} high CPU`, severity: "High", condition: "CPU usage > {$CPU_WARN}% for 5m", durationMin: 5, notifyChannels: ["Email", "Slack"], autoResolve: true }],
    dashboards: ["Infrastructure Health"],
    createdAt: nowIso,
    updatedAt: nowIso,
    updatedBy: "you@nexus.io",
    history: [{ version: "v1.0", by: "you@nexus.io", at: nowIso, note: "Template created" }],
  };
  store = [cloneTemplate(template), ...store];
  return cloneTemplate(template);
}

const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = ["Server OS", "Database", "Network", "Web/API", "Container", "Application", "Cloud"];
const TEMPLATE_TARGET_TYPES: readonly TargetType[] = ["Server", "Network Device", "Database", "Website", "Container"];

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/**
 * Import a template from parsed JSON (e.g. an exported file). The result is
 * always stored as a custom Draft. Throws with a human-readable message when
 * the payload is unusable.
 */
export function importMonitoringTemplate(data: unknown): MonitoringTemplate {
  if (typeof data !== "object" || data === null) throw new Error("Not a template JSON object");
  const raw = data as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) throw new Error('Template JSON must include a "name"');
  const category = TEMPLATE_CATEGORIES.includes(raw.category as TemplateCategory) ? raw.category as TemplateCategory : "Application";
  const targetType = TEMPLATE_TARGET_TYPES.includes(raw.targetType as TargetType) ? raw.targetType as TargetType : "Server";
  const template = createMonitoringTemplate({
    name,
    description: typeof raw.description === "string" ? raw.description : undefined,
    category,
    targetType,
    tags: asStringArray(raw.tags).length ? asStringArray(raw.tags) : undefined,
    collectorsRequired: asStringArray(raw.collectorsRequired).length ? asStringArray(raw.collectorsRequired) : undefined,
  });
  if (typeof raw.version === "string" && /^v\d+(\.\d+)?$/.test(raw.version)) {
    store = store.map((entry) => (entry.id === template.id ? { ...entry, version: raw.version as string } : entry));
    template.version = raw.version;
  }
  return template;
}