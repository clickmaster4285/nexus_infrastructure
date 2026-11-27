/** Access Control pure helpers — single source for KPIs, permission checks and risk scoring. */

export type UserStatus = "active" | "invited" | "suspended" | "disabled";
export type RoleType = "system" | "custom";
export type TokenEnv = "production" | "staging" | "development";
export type TokenStatus = "active" | "expired" | "revoked";

export const STALE_DAYS = 90;

export interface UserStats {
  total: number;
  active: number;
  invited: number;
  suspended: number;
  disabled: number;
  mfaEnabled: number;
  mfaCoveragePct: number;
  stale: number;
  adminsWithoutMfa: number;
}

export function computeUserStats(input: { status: UserStatus; mfaEnabled: boolean; roleIds: string[]; lastLoginAt: string | null }[]): UserStats {
  const now = Date.now();
  const total = input.length;
  const active = input.filter((u) => u.status === "active").length;
  const invited = input.filter((u) => u.status === "invited").length;
  const suspended = input.filter((u) => u.status === "suspended").length;
  const disabled = input.filter((u) => u.status === "disabled").length;
  const mfaEnabled = input.filter((u) => u.mfaEnabled).length;
  const stale = input.filter((u) => {
    if (!u.lastLoginAt) return false;
    return (now - Date.parse(u.lastLoginAt)) / 86_400_000 > STALE_DAYS;
  }).length;
  const adminsWithoutMfa = input.filter((u) => u.roleIds.some((r) => r === "role-super-admin" || r === "role-admin") && !u.mfaEnabled).length;
  return {
    total,
    active,
    invited,
    suspended,
    disabled,
    mfaEnabled,
    mfaCoveragePct: total > 0 ? Math.round((mfaEnabled / total) * 100) : 0,
    stale,
    adminsWithoutMfa,
  };
}

export function effectivePermissions(user: { roleIds: string[]; rolePermissions: Map<string, string[]> }): Set<string> {
  const result = new Set<string>();
  for (const roleId of user.roleIds) {
    for (const perm of user.rolePermissions.get(roleId) ?? []) result.add(perm);
  }
  return result;
}

export function riskScore(input: { roleIds: string[]; mfaEnabled: boolean; lastLoginAt: string | null; hasOverPrivilegedToken: boolean }): number {
  let score = 10;
  if (input.roleIds.some((r) => r === "role-super-admin" || r === "role-admin")) score += 35;
  if (!input.mfaEnabled) score += 30;
  if (input.lastLoginAt) {
    const days = (Date.now() - Date.parse(input.lastLoginAt)) / 86_400_000;
    if (days > STALE_DAYS) score += 20;
  } else {
    score += 15;
  }
  if (input.hasOverPrivilegedToken) score += 25;
  return Math.min(100, score);
}

export function tokenStatus(expiresAt: string | null, revoked: boolean): TokenStatus {
  if (revoked) return "revoked";
  if (!expiresAt) return "active";
  return Date.parse(expiresAt) >= Date.now() ? "active" : "expired";
}

export function maskToken(token: string): string {
  const parts = token.split("_");
  if (parts.length < 3) return "nxs_live_****";
  return `${parts[0]}_${parts[1]}_${parts[2].slice(0, 4)}••••`;
}

export const RESOURCE_LABELS: Record<string, string> = {
  servers: "Servers",
  alerts: "Alerts",
  "alert-rules": "Alert Rules",
  incidents: "Incidents",
  "maintenance-windows": "Maintenance Windows",
  "scheduled-tasks": "Scheduled Tasks",
  backups: "Backups",
  logs: "Logs",
  security: "Security",
  certificates: "Certificates",
  "access-control": "Access Control",
  settings: "Settings",
};

export const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  execute: "Execute",
  approve: "Approve",
};
