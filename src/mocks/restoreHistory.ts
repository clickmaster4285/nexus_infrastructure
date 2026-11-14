/**
 * Restore history mock data + DR drill log for Backups & Recovery.
 * Seeded operations are relative to module load. The RestoreModal appends
 * completed operations to this store so the Restore History tab and the
 * audit trail update immediately after a restore.
 */

import { CURRENT_USER_NAME } from "@/mocks/backups";

export type RestoreStatus = "success" | "failed" | "running";
export type DrillResult = "Passed" | "Failed";

export interface RestoreOperation {
  id: string;
  operation: string;
  host: string;
  jobName: string | null;
  pointId: string;
  status: RestoreStatus;
  startedAt: string;
  epochMs: number;
  durationMs: number | null;
  requestedBy: string;
  /** Set while a restore is in-flight (fake progress). */
  progress: number | null;
}

export interface DrDrill {
  id: string;
  name: string;
  executedAt: string;
  epochMs: number;
  /** Wall-clock drill duration in minutes. */
  durationMin: number;
  /** RTO target for the drilled scope, in minutes. */
  rtoTargetMin: number;
  /** Tier the drill exercises (drives tier RTO actuals). */
  tier: "Critical" | "Standard";
  result: DrillResult;
  executedBy: string;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

let OPERATIONS: RestoreOperation[] = [
  { id: "RES-4101", operation: "Point-in-time restore", host: "db-01", jobName: "Nightly database backup", pointId: "RST-5188", status: "success", startedAt: iso(now - 3 * DAY - 4 * HOUR), epochMs: now - 3 * DAY - 4 * HOUR, durationMs: 47 * MIN, requestedBy: "sara.iqbal@nexus.io", progress: null },
  { id: "RES-4102", operation: "Full restore (cold vault)", host: "storage-01", jobName: "Daily backup to cold storage", pointId: "RST-5173", status: "success", startedAt: iso(now - 9 * DAY - 2 * HOUR), epochMs: now - 9 * DAY - 2 * HOUR, durationMs: 52 * MIN, requestedBy: "sara.iqbal@nexus.io", progress: null },
  { id: "RES-4103", operation: "Config rollback", host: "edge-01", jobName: "Edge config snapshot", pointId: "RST-5154", status: "failed", startedAt: iso(now - 16 * DAY - 6 * HOUR), epochMs: now - 16 * DAY - 6 * HOUR, durationMs: 58 * MIN, requestedBy: "tom.becker@nexus.io", progress: null },
  { id: "RES-4104", operation: "Point-in-time restore", host: "api-server-01", jobName: "API checkpoint backup", pointId: "RST-5211", status: "success", startedAt: iso(now - 23 * DAY - 3 * HOUR), epochMs: now - 23 * DAY - 3 * HOUR, durationMs: 31 * MIN, requestedBy: "tom.becker@nexus.io", progress: null },
  { id: "RES-4105", operation: "Vault restore (rehearsal)", host: "auth-01", jobName: "Nightly auth backup", pointId: "RST-5130", status: "success", startedAt: iso(now - 30 * DAY - 7 * HOUR), epochMs: now - 30 * DAY - 7 * HOUR, durationMs: 17 * MIN, requestedBy: "priya.nair@nexus.io", progress: null },
  { id: "RES-4106", operation: "Point-in-time restore", host: "web-app-01", jobName: "Nightly web tier backup", pointId: "RST-5118", status: "success", startedAt: iso(now - 41 * DAY - 5 * HOUR), epochMs: now - 41 * DAY - 5 * HOUR, durationMs: 39 * MIN, requestedBy: "marcus.lee@nexus.io", progress: null },
  { id: "RES-4107", operation: "Bare-metal restore", host: "queue-01", jobName: "Nightly message queue backup", pointId: "RST-5091", status: "success", startedAt: iso(now - 52 * DAY - 8 * HOUR), epochMs: now - 52 * DAY - 8 * HOUR, durationMs: 44 * MIN, requestedBy: "sara.iqbal@nexus.io", progress: null },
  { id: "RES-4108", operation: "Point-in-time restore", host: "db-02", jobName: "Database replica backup", pointId: "RST-5203", status: "success", startedAt: iso(now - 2 * DAY - 1 * HOUR), epochMs: now - 2 * DAY - 1 * HOUR, durationMs: 28 * MIN, requestedBy: "marcus.lee@nexus.io", progress: null },
];

/** DR drill log - module-store; the Test Restore wizard appends rehearsals here. Exact 6 seeded drills, newest first. */
let DRILLS_STORE: DrDrill[] = [
  { id: "DRL-212", name: "Quarterly DR drill - db-01 restore", executedAt: iso(now - 3 * DAY), epochMs: now - 3 * DAY, durationMin: 47, rtoTargetMin: 60, tier: "Critical", result: "Passed", executedBy: "Sara Iqbal" },
  { id: "DRL-209", name: "Backup verification restore - hr_db", executedAt: iso(now - 6 * DAY), epochMs: now - 6 * DAY, durationMin: 28, rtoTargetMin: 120, tier: "Standard", result: "Passed", executedBy: "Priya Nair" },
  { id: "DRL-206", name: "Cold vault restore rehearsal - storage-01", executedAt: iso(now - 9 * DAY), epochMs: now - 9 * DAY, durationMin: 52, rtoTargetMin: 240, tier: "Critical", result: "Passed", executedBy: "Marcus Lee" },
  { id: "DRL-203", name: "Edge config rollback - edge-01", executedAt: iso(now - 16 * DAY), epochMs: now - 16 * DAY, durationMin: 58, rtoTargetMin: 45, tier: "Critical", result: "Failed", executedBy: "Tom Becker" },
  { id: "DRL-199", name: "Web tier failover - web-01", executedAt: iso(now - 23 * DAY), epochMs: now - 23 * DAY, durationMin: 41, rtoTargetMin: 120, tier: "Standard", result: "Passed", executedBy: "Marcus Lee" },
  { id: "DRL-195", name: "Network config restore - edge-router-01", executedAt: iso(now - 30 * DAY), epochMs: now - 30 * DAY, durationMin: 31, rtoTargetMin: 120, tier: "Standard", result: "Passed", executedBy: "Tom Becker" },
];

const drillListeners = new Set<() => void>();
function emitDrills() { for (const listener of [...drillListeners]) listener(); }
export function subscribeDrills(listener: () => void): () => void {
  drillListeners.add(listener);
  return () => {
    drillListeners.delete(listener);
  };
}
export function getDrillsSnapshot(): DrDrill[] { return DRILLS_STORE; }
export function nextDrillId(): string {
  let max = 200;
  for (const drill of DRILLS_STORE) {
    const match = /^DRL-(\d+)$/.exec(drill.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `DRL-${max + 1}`;
}
export function appendDrill(drill: DrDrill): void {
  DRILLS_STORE = [drill, ...DRILLS_STORE];
  emitDrills();
}

const listeners = new Set<() => void>();
function emit() { for (const listener of [...listeners]) listener(); }
export function subscribeRestoreHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getRestoreHistorySnapshot(): RestoreOperation[] { return OPERATIONS; }
export function nextRestoreId(): string {
  let max = 4100;
  for (const op of OPERATIONS) {
    const match = /^RES-(\d+)$/.exec(op.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `RES-${max + 1}`;
}
export function appendRestoreOperation(op: RestoreOperation): void {
  OPERATIONS = [op, ...OPERATIONS];
  emit();
}
export function completeRestoreOperation(id: string, status: RestoreStatus, durationMs: number): void {
  OPERATIONS = OPERATIONS.map((op) => (op.id === id ? { ...op, status, durationMs, progress: null } : op));
  emit();
}
export function updateRestoreProgress(id: string, progress: number): void {
  OPERATIONS = OPERATIONS.map((op) => (op.id === id ? { ...op, progress } : op));
  emit();
}
