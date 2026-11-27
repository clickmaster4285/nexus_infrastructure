/**
 * Access Control mock — single source of truth.
 * 20 users, 9 roles (6 system + 3 custom), permissions matrix, API tokens,
 * audit trail, in-memory actions. Swap load* for real /api/access/* later.
 */
import { logAudit } from "@/mocks/auditLogs";

export type { UserStatus, RoleType, TokenEnv, TokenStatus } from "@/utils/accessStats";
export { RESOURCE_LABELS, ACTION_LABELS } from "@/utils/accessStats";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  roleIds: string[];
  status: "active" | "invited" | "suspended" | "disabled";
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  groupIds: string[];
  siteIds: string[];
  invitedBy: string | null;
  passwordLastChangedAt: string | null;
  sessions: Array<{ id: string; device: string; ip: string; location: string; startedAt: string; lastActiveAt: string }>;
  apiTokenIds: string[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  type: "system" | "custom";
  permissions: string[];
  userCount: number;
  createdAt: string;
  createdBy: string;
  riskLevel: "High" | "Medium" | "Low";
}

export interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  ownerId: string;
  ownerName: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  expiresAt: string | null;
  status: "active" | "expired" | "revoked";
  environment: "production" | "staging" | "development";
}

export interface AccessAuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  ip: string;
  result: "Success" | "Denied";
}

export interface AccessInvite {
  id: string;
  email: string;
  roleId: string;
  groupIds: string[];
  invitedBy: string;
  invitedAt: string;
  status: "pending" | "accepted" | "cancelled";
}

const HOUR = 3_600_000, DAY = 86_400_000;
const now = Date.now();
const ago = (days: number) => new Date(now - days * DAY).toISOString();
const agoHours = (hours: number) => new Date(now - hours * HOUR).toISOString();
const ahead = (days: number) => new Date(now + days * DAY).toISOString();

const groups = ["sre", "security", "platform", "network", "database"] as const;
const sites = ["frankfurt", "helsinki", "london", "islamabad"] as const;

export const DEMO_CURRENT_USER = { id: "USR-1001", name: "Admin", email: "admin@gmail.com", role: "Super Administrator", roleId: "role-super-admin" } as const;

export const ROLES: Role[] = [
  { id: "role-super-admin", name: "Super Administrator", description: "Full access across all resources and accounts", type: "system", permissions: ["*"], userCount: 1, createdAt: ago(480), createdBy: "system", riskLevel: "High" },
  { id: "role-admin", name: "Administrator", description: "Manage users, roles, and security configuration", type: "system", permissions: ["servers:*", "alerts:*", "alert-rules:*", "incidents:*", "maintenance-windows:*", "scheduled-tasks:*", "backups:*", "logs:*", "security:*", "certificates:*", "access-control:*", "settings:view", "settings:edit"], userCount: 2, createdAt: ago(480), createdBy: "system", riskLevel: "High" },
  { id: "role-operator", name: "Operator", description: "Day-to-day operations: incidents, deploys, and monitoring", type: "system", permissions: ["servers:view", "alerts:view", "incidents:view", "incidents:create", "incidents:edit", "maintenance-windows:view", "maintenance-windows:create", "scheduled-tasks:view", "scheduled-tasks:execute", "backups:view", "backups:execute", "logs:view", "security:view", "certificates:view", "access-control:view"], userCount: 4, createdAt: ago(480), createdBy: "system", riskLevel: "Medium" },
  { id: "role-security-analyst", name: "Security Analyst", description: "Security posture, vulnerabilities, and audit", type: "system", permissions: ["security:*", "certificates:*", "access-control:view", "logs:view", "incidents:view", "incidents:create", "incidents:edit", "alerts:view", "alerts:create", "alerts:edit", "alert-rules:view", "alert-rules:create", "alert-rules:edit"], userCount: 2, createdAt: ago(480), createdBy: "system", riskLevel: "Medium" },
  { id: "role-read-only", name: "Read-only Viewer", description: "View-only access to dashboards and logs", type: "system", permissions: ["servers:view", "alerts:view", "incidents:view", "maintenance-windows:view", "scheduled-tasks:view", "backups:view", "logs:view", "security:view", "certificates:view", "access-control:view", "settings:view"], userCount: 5, createdAt: ago(480), createdBy: "system", riskLevel: "Low" },
  { id: "role-auditor", name: "Auditor", description: "Read-only audit and compliance access", type: "system", permissions: ["logs:view", "access-control:view", "security:audit", "alerts:view", "incidents:view", "backups:view"], userCount: 1, createdAt: ago(480), createdBy: "system", riskLevel: "Low" },
  { id: "role-db-admin", name: "Database Admin", description: "Database servers, backups, and maintenance windows", type: "custom", permissions: ["servers:view", "servers:edit", "backups:*", "maintenance-windows:*", "logs:view"], userCount: 2, createdAt: ago(200), createdBy: "Ayesha Khan", riskLevel: "High" },
  { id: "role-oncall", name: "On-call Engineer", description: "Incident response and runbook execution", type: "custom", permissions: ["incidents:*", "alerts:view", "alerts:edit", "alerts:execute", "runbooks:execute", "servers:view", "logs:view", "maintenance-windows:view"], userCount: 2, createdAt: ago(180), createdBy: "Ayesha Khan", riskLevel: "Medium" },
  { id: "role-backup-operator", name: "Backup Operator", description: "Backup and restore operations", type: "custom", permissions: ["backups:*", "servers:view", "logs:view"], userCount: 1, createdAt: ago(120), createdBy: "Ayesha Khan", riskLevel: "Medium" },
];

const roleById = new Map(ROLES.map((role) => [role.id, role]));

export const USERS: User[] = [
  { id: "USR-1001", name: "Admin", email: "admin@gmail.com", avatarInitials: "AD", roleIds: ["role-super-admin"], status: "active", mfaEnabled: true, lastLoginAt: agoHours(1), lastLoginIp: "203.0.113.44", createdAt: ago(480), groupIds: ["platform"], siteIds: ["frankfurt"], invitedBy: null, passwordLastChangedAt: ago(20), sessions: [{ id: "ses-1001", device: "Chrome on macOS", ip: "203.0.113.44", location: "Frankfurt, Germany", startedAt: agoHours(1), lastActiveAt: agoHours(0.1) }], apiTokenIds: ["TOK-5001"] },
  { id: "USR-1002", name: "Sara Iqbal", email: "sara.iqbal@nexus.io", avatarInitials: "SI", roleIds: ["role-admin"], status: "active", mfaEnabled: true, lastLoginAt: agoHours(2), lastLoginIp: "198.51.100.23", createdAt: ago(365), groupIds: ["security", "sre"], siteIds: ["frankfurt", "london"], invitedBy: "Ayesha Khan", passwordLastChangedAt: ago(45), sessions: [{ id: "ses-1002", device: "Chrome on Windows", ip: "198.51.100.23", location: "Karachi, Pakistan", startedAt: agoHours(2), lastActiveAt: agoHours(0.2) }], apiTokenIds: ["TOK-5002"] },
  { id: "USR-1003", name: "Tom Becker", email: "tom.becker@nexus.io", avatarInitials: "TB", roleIds: ["role-admin", "role-db-admin"], status: "active", mfaEnabled: true, lastLoginAt: agoHours(4), lastLoginIp: "203.0.113.88", createdAt: ago(300), groupIds: ["database"], siteIds: ["helsinki"], invitedBy: "Ayesha Khan", passwordLastChangedAt: ago(30), sessions: [{ id: "ses-1003", device: "Edge on Windows", ip: "203.0.113.88", location: "Frankfurt, Germany", startedAt: agoHours(4), lastActiveAt: agoHours(1) }], apiTokenIds: ["TOK-5003"] },
  { id: "USR-1004", name: "Marcus Lee", email: "marcus.lee@nexus.io", avatarInitials: "ML", roleIds: ["role-operator", "role-oncall"], status: "active", mfaEnabled: false, lastLoginAt: agoHours(6), lastLoginIp: "192.0.2.171", createdAt: ago(280), groupIds: ["sre", "platform"], siteIds: ["frankfurt", "islamabad"], invitedBy: "Ayesha Khan", passwordLastChangedAt: ago(60), sessions: [{ id: "ses-1004", device: "Firefox on Linux", ip: "192.0.2.171", location: "Amsterdam, Netherlands", startedAt: agoHours(6), lastActiveAt: agoHours(2) }], apiTokenIds: ["TOK-5004"] },
  { id: "USR-1005", name: "Priya Nair", email: "priya.nair@nexus.io", avatarInitials: "PN", roleIds: ["role-security-analyst"], status: "active", mfaEnabled: true, lastLoginAt: agoHours(1), lastLoginIp: "203.0.113.101", createdAt: ago(260), groupIds: ["security"], siteIds: ["london"], invitedBy: "Ayesha Khan", passwordLastChangedAt: ago(14), sessions: [{ id: "ses-1005", device: "Safari on macOS", ip: "203.0.113.101", location: "London, UK", startedAt: agoHours(1), lastActiveAt: agoHours(0.05) }], apiTokenIds: ["TOK-5005"] },
  { id: "USR-1006", name: "Daniel Roth", email: "daniel.roth@nexus.io", avatarInitials: "DR", roleIds: ["role-operator"], status: "active", mfaEnabled: true, lastLoginAt: ago(2), lastLoginIp: "198.51.100.112", createdAt: ago(240), groupIds: ["sre"], siteIds: ["frankfurt"], invitedBy: "Sara Iqbal", passwordLastChangedAt: ago(90), sessions: [], apiTokenIds: ["TOK-5006"] },
  { id: "USR-1007", name: "Nina Park", email: "nina.park@nexus.io", avatarInitials: "NP", roleIds: ["role-read-only", "role-auditor"], status: "active", mfaEnabled: true, lastLoginAt: ago(5), lastLoginIp: "203.0.113.131", createdAt: ago(220), groupIds: ["security"], siteIds: ["helsinki"], invitedBy: "Priya Nair", passwordLastChangedAt: ago(120), sessions: [], apiTokenIds: [] },
  { id: "USR-1008", name: "Ayesha Khan", email: "ayesha@nexus.io", avatarInitials: "AK", roleIds: ["role-super-admin"], status: "active", mfaEnabled: true, lastLoginAt: ago(0.2), lastLoginIp: "203.0.113.10", createdAt: ago(500), groupIds: ["platform"], siteIds: ["frankfurt"], invitedBy: null, passwordLastChangedAt: ago(5), sessions: [{ id: "ses-1008", device: "Chrome on macOS", ip: "203.0.113.10", location: "Karachi, Pakistan", startedAt: ago(0.2), lastActiveAt: ago(0.05) }], apiTokenIds: ["TOK-5007"] },
  { id: "USR-1009", name: "Marcus Lee (contractor)", email: "marco.ext@partner.io", avatarInitials: "ML", roleIds: ["role-read-only"], status: "suspended", mfaEnabled: false, lastLoginAt: ago(12), lastLoginIp: "198.51.100.87", createdAt: ago(90), groupIds: [], siteIds: ["frankfurt"], invitedBy: "Tom Becker", passwordLastChangedAt: ago(90), sessions: [], apiTokenIds: [] },
  { id: "USR-1010", name: "Deploy Bot", email: "deploy-bot@nexus.io", avatarInitials: "DB", roleIds: ["role-operator"], status: "active", mfaEnabled: false, lastLoginAt: ago(0.1), lastLoginIp: "10.10.1.10", createdAt: ago(200), groupIds: ["platform"], siteIds: ["frankfurt"], invitedBy: "Ayesha Khan", passwordLastChangedAt: ago(150), sessions: [{ id: "ses-1010", device: "GitHub Actions", ip: "10.10.1.10", location: "Internal", startedAt: ago(0.1), lastActiveAt: ago(0.02) }], apiTokenIds: ["TOK-5008"] },
  { id: "USR-1011", name: "Old Intern", email: "intern.old@nexus.io", avatarInitials: "OI", roleIds: ["role-read-only"], status: "disabled", mfaEnabled: false, lastLoginAt: ago(300), lastLoginIp: "192.0.2.88", createdAt: ago(400), groupIds: [], siteIds: [], invitedBy: "Sara Iqbal", passwordLastChangedAt: ago(380), sessions: [], apiTokenIds: [] },
  { id: "USR-1012", name: "Sara Khan", email: "sara.khan@nexus.io", avatarInitials: "SK", roleIds: ["role-security-analyst"], status: "invited", mfaEnabled: false, lastLoginAt: null, lastLoginIp: null, createdAt: ago(3), groupIds: ["security"], siteIds: ["london"], invitedBy: "Priya Nair", passwordLastChangedAt: null, sessions: [], apiTokenIds: [] },
  { id: "USR-1013", name: "Raj Patel", email: "raj.patel@nexus.io", avatarInitials: "RP", roleIds: ["role-read-only", "role-backup-operator"], status: "active", mfaEnabled: true, lastLoginAt: ago(8), lastLoginIp: "203.0.113.27", createdAt: ago(180), groupIds: ["sre", "database"], siteIds: ["helsinki"], invitedBy: "Tom Becker", passwordLastChangedAt: ago(80), sessions: [], apiTokenIds: [] },
  { id: "USR-1014", name: "Lena Fischer", email: "lena.fischer@nexus.io", avatarInitials: "LF", roleIds: ["role-operator"], status: "invited", mfaEnabled: false, lastLoginAt: null, lastLoginIp: null, createdAt: ago(1), groupIds: ["sre"], siteIds: ["frankfurt"], invitedBy: "Marcus Lee", passwordLastChangedAt: null, sessions: [], apiTokenIds: [] },
  { id: "USR-1015", name: "Backup Agent", email: "backup-agent@nexus.io", avatarInitials: "BA", roleIds: ["role-backup-operator"], status: "active", mfaEnabled: false, lastLoginAt: ago(0.5), lastLoginIp: "10.10.2.20", createdAt: ago(160), groupIds: ["database"], siteIds: ["helsinki"], invitedBy: "Tom Becker", passwordLastChangedAt: ago(200), sessions: [{ id: "ses-1015", device: "Cron agent", ip: "10.10.2.20", location: "Internal", startedAt: ago(0.5), lastActiveAt: ago(0.1) }], apiTokenIds: ["TOK-5009"] },
  { id: "USR-1016", name: "Monitoring Probe", email: "monitoring-probe@nexus.io", avatarInitials: "MP", roleIds: ["role-read-only"], status: "active", mfaEnabled: false, lastLoginAt: ago(0.05), lastLoginIp: "10.10.7.10", createdAt: ago(150), groupIds: ["platform"], siteIds: ["frankfurt"], invitedBy: "Ayesha Khan", passwordLastChangedAt: ago(220), sessions: [{ id: "ses-1016", device: "Scheduled probe", ip: "10.10.7.10", location: "Internal", startedAt: ago(0.05), lastActiveAt: ago(0.01) }], apiTokenIds: ["TOK-5010"] },
  { id: "USR-1017", name: "Omar Farooq", email: "omar.farooq@nexus.io", avatarInitials: "OF", roleIds: ["role-operator", "role-oncall"], status: "active", mfaEnabled: true, lastLoginAt: ago(0.9), lastLoginIp: "203.0.113.88", createdAt: ago(140), groupIds: ["sre", "network"], siteIds: ["islamabad"], invitedBy: "Sara Iqbal", passwordLastChangedAt: ago(33), sessions: [{ id: "ses-1017", device: "iPhone 15 Pro", ip: "203.0.113.88", location: "Islamabad, Pakistan", startedAt: ago(0.9), lastActiveAt: ago(0.3) }], apiTokenIds: [] },
  { id: "USR-1018", name: "Priya Nair (auditor)", email: "priya.audit@nexus.io", avatarInitials: "PA", roleIds: ["role-auditor"], status: "active", mfaEnabled: true, lastLoginAt: ago(45), lastLoginIp: "203.0.113.112", createdAt: ago(330), groupIds: ["security"], siteIds: ["london"], invitedBy: "Ayesha Khan", passwordLastChangedAt: ago(140), sessions: [], apiTokenIds: [] },
  { id: "USR-1019", name: "CI/CD Bot", email: "cicd-bot@nexus.io", avatarInitials: "CI", roleIds: ["role-operator"], status: "active", mfaEnabled: false, lastLoginAt: ago(0.02), lastLoginIp: "10.10.3.11", createdAt: ago(100), groupIds: ["platform"], siteIds: ["frankfurt"], invitedBy: "Ayesha Khan", passwordLastChangedAt: ago(90), sessions: [{ id: "ses-1019", device: "GitHub Actions", ip: "10.10.3.11", location: "Internal", startedAt: ago(0.02), lastActiveAt: ago(0.005) }], apiTokenIds: ["TOK-5011"] },
  { id: "USR-1020", name: "Tom Becker (contractor)", email: "tom.ext@consultant.io", avatarInitials: "TB", roleIds: ["role-read-only"], status: "suspended", mfaEnabled: false, lastLoginAt: ago(35), lastLoginIp: "198.51.100.55", createdAt: ago(60), groupIds: [], siteIds: ["helsinki"], invitedBy: "Tom Becker", passwordLastChangedAt: ago(55), sessions: [], apiTokenIds: [] },
];

export const API_TOKENS: ApiToken[] = [
  { id: "TOK-5001", name: "admin-dashboard", prefix: "nxs_live_9ab3", ownerId: "USR-1001", ownerName: "Admin", scopes: ["*"], createdAt: ago(200), lastUsedAt: agoHours(1), lastUsedIp: "203.0.113.44", expiresAt: null, status: "active", environment: "production" },
  { id: "TOK-5002", name: "deploy-pipeline", prefix: "nxs_live_2cd1", ownerId: "USR-1002", ownerName: "Sara Iqbal", scopes: ["servers:edit", "incidents:view"], createdAt: ago(180), lastUsedAt: agoHours(3), lastUsedIp: "198.51.100.23", expiresAt: ahead(12), status: "active", environment: "production" },
  { id: "TOK-5003", name: "db-backup-agent", prefix: "nxs_live_7ef2", ownerId: "USR-1003", ownerName: "Tom Becker", scopes: ["backups:*", "servers:view"], createdAt: ago(150), lastUsedAt: agoHours(2), lastUsedIp: "203.0.113.88", expiresAt: ahead(45), status: "active", environment: "production" },
  { id: "TOK-5004", name: "oncall-bot", prefix: "nxs_live_a1b2", ownerId: "USR-1004", ownerName: "Marcus Lee", scopes: ["incidents:*", "alerts:view"], createdAt: ago(140), lastUsedAt: agoHours(6), lastUsedIp: "192.0.2.171", expiresAt: ahead(8), status: "active", environment: "production" },
  { id: "TOK-5005", name: "security-scan", prefix: "nxs_live_e5f6", ownerId: "USR-1005", ownerName: "Priya Nair", scopes: ["security:view", "logs:view"], createdAt: ago(100), lastUsedAt: ago(2), lastUsedIp: "203.0.113.101", expiresAt: null, status: "active", environment: "production" },
  { id: "TOK-5006", name: "ops-readonly", prefix: "nxs_live_c3d4", ownerId: "USR-1006", ownerName: "Daniel Roth", scopes: ["servers:view", "alerts:view", "incidents:view"], createdAt: ago(90), lastUsedAt: ago(14), lastUsedIp: "198.51.100.112", expiresAt: ahead(2), status: "active", environment: "staging" },
  { id: "TOK-5007", name: "automation-master", prefix: "nxs_live_b8c9", ownerId: "USR-1008", ownerName: "Ayesha Khan", scopes: ["*"], createdAt: ago(110), lastUsedAt: ago(120), lastUsedIp: "203.0.113.10", expiresAt: null, status: "active", environment: "production" },
  { id: "TOK-5008", name: "deploy-bot-token", prefix: "nxs_live_d1e2", ownerId: "USR-1010", ownerName: "Deploy Bot", scopes: ["servers:edit", "scheduled-tasks:execute"], createdAt: ago(70), lastUsedAt: ago(0.1), lastUsedIp: "10.10.1.10", expiresAt: ahead(200), status: "active", environment: "production" },
  { id: "TOK-5009", name: "backup-agent-token", prefix: "nxs_live_f3a4", ownerId: "USR-1015", ownerName: "Backup Agent", scopes: ["backups:*"], createdAt: ago(60), lastUsedAt: ago(0.5), lastUsedIp: "10.10.2.20", expiresAt: ahead(365), status: "active", environment: "production" },
  { id: "TOK-5010", name: "monitoring-token", prefix: "nxs_live_g5h6", ownerId: "USR-1016", ownerName: "Monitoring Probe", scopes: ["servers:view", "metrics:read"], createdAt: ago(40), lastUsedAt: ago(0.05), lastUsedIp: "10.10.7.10", expiresAt: ahead(180), status: "active", environment: "production" },
  { id: "TOK-5011", name: "cicd-pipeline", prefix: "nxs_live_h7i8", ownerId: "USR-1019", ownerName: "CI/CD Bot", scopes: ["servers:edit", "scheduled-tasks:execute"], createdAt: ago(30), lastUsedAt: ago(0.02), lastUsedIp: "10.10.3.11", expiresAt: ahead(90), status: "active", environment: "production" },
  { id: "TOK-5012", name: "staging-deploy", prefix: "nxs_live_j9k0", ownerId: "USR-1004", ownerName: "Marcus Lee", scopes: ["servers:edit"], createdAt: ago(20), lastUsedAt: ago(30), lastUsedIp: "192.0.2.171", expiresAt: ago(10), status: "expired", environment: "staging" },
  { id: "TOK-5013", name: "old-admin-token", prefix: "nxs_live_k1l2", ownerId: "USR-1002", ownerName: "Sara Iqbal", scopes: ["*"], createdAt: ago(250), lastUsedAt: ago(120), lastUsedIp: "198.51.100.23", expiresAt: ago(5), status: "expired", environment: "production" },
  { id: "TOK-5014", name: "revoked-contractor", prefix: "nxs_live_m2n3", ownerId: "USR-1009", ownerName: "Marcus Lee (contractor)", scopes: ["servers:view"], createdAt: ago(80), lastUsedAt: ago(35), lastUsedIp: "198.51.100.87", expiresAt: null, status: "revoked", environment: "staging" },
];

export const ACCESS_AUDIT: AccessAuditEntry[] = [
  { id: "AA-9001", at: agoHours(1), actor: "Ayesha Khan", action: "Updated role permissions", target: "role-oncall", ip: "203.0.113.10", result: "Success" },
  { id: "AA-9000", at: agoHours(3), actor: "Ayesha Khan", action: "Created API token", target: "TOK-5011", ip: "203.0.113.10", result: "Success" },
  { id: "AA-8999", at: ago(2), actor: "Sara Iqbal", action: "Suspended user", target: "USR-1009", ip: "198.51.100.23", result: "Success" },
  { id: "AA-8998", at: ago(2), actor: "Sara Iqbal", action: "Invited user", target: "USR-1014", ip: "198.51.100.23", result: "Success" },
  { id: "AA-8997", at: ago(5), actor: "Ayesha Khan", action: "Updated role permissions", target: "role-operator", ip: "203.0.113.10", result: "Success" },
  { id: "AA-8996", at: ago(6), actor: "System", action: "API token used", target: "TOK-5001", ip: "203.0.113.44", result: "Success" },
  { id: "AA-8995", at: ago(7), actor: "Priya Nair", action: "Required MFA", target: "USR-1004", ip: "203.0.113.101", result: "Success" },
  { id: "AA-8994", at: ago(8), actor: "Ayesha Khan", action: "Assigned role", target: "USR-1013", ip: "203.0.113.10", result: "Success" },
  { id: "AA-8993", at: ago(10), actor: "System", action: "Login blocked", target: "USR-1011", ip: "192.0.2.88", result: "Denied" },
  { id: "AA-8992", at: ago(12), actor: "Sara Iqbal", action: "Revoked API token", target: "TOK-5014", ip: "198.51.100.23", result: "Success" },
];

const CURRENT_USER = DEMO_CURRENT_USER.name;

export function getRoleById(roleId: string): Role | undefined {
  return ROLES.find((role) => role.id === roleId);
}

export function getUserById(id: string): User | undefined {
  const user = USERS.find((item) => item.id === id);
  return user ? { ...user, roleIds: [...user.roleIds], groupIds: [...user.groupIds], siteIds: [...user.siteIds], sessions: user.sessions.map((s) => ({ ...s })), apiTokenIds: [...user.apiTokenIds] } : undefined;
}

export function getTokenById(id: string): ApiToken | undefined {
  return API_TOKENS.find((token) => token.id === id);
}

const delay = () => 200 + Math.random() * 200;

export async function loadUsers(): Promise<User[]> {
  await new Promise((resolve) => setTimeout(resolve, delay()));
  return USERS.map((user) => ({ ...user, roleIds: [...user.roleIds], groupIds: [...user.groupIds], siteIds: [...user.siteIds], sessions: user.sessions.map((s) => ({ ...s })), apiTokenIds: [...user.apiTokenIds] }));
}

export async function loadRoles(): Promise<Role[]> {
  await new Promise((resolve) => setTimeout(resolve, delay()));
  return ROLES.map((role) => ({ ...role, permissions: [...role.permissions] }));
}

export async function loadApiTokens(): Promise<ApiToken[]> {
  await new Promise((resolve) => setTimeout(resolve, delay()));
  return API_TOKENS.map((token) => ({ ...token, scopes: [...token.scopes] }));
}

export async function loadAccessAudit(): Promise<AccessAuditEntry[]> {
  await new Promise((resolve) => setTimeout(resolve, delay()));
  return ACCESS_AUDIT.map((entry) => ({ ...entry }));
}

function appendAudit(entry: Omit<AccessAuditEntry, "id" | "at">): void {
  ACCESS_AUDIT.unshift({ id: `AA-${Date.now()}`, at: new Date().toISOString(), ...entry });
}

export function suspendUser(userId: string, reason: string): void {
  const user = USERS.find((item) => item.id === userId);
  if (!user) return;
  user.status = "suspended";
  const role = user.roleIds.map((id) => roleById.get(id)?.name ?? id).join(", ");
  appendAudit({ actor: CURRENT_USER, action: "Suspended user", target: `${user.id} (${role})`, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Suspended user", category: "Access", resource: { type: "User", id: userId, name: user.name }, result: "Success", reason });
}

export function reactivateUser(userId: string): void {
  const user = USERS.find((item) => item.id === userId);
  if (!user) return;
  user.status = "active";
  appendAudit({ actor: CURRENT_USER, action: "Reactivated user", target: user.id, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Reactivated user", category: "Access", resource: { type: "User", id: userId, name: user.name }, result: "Success" });
}

export function requireMfa(userId: string): void {
  const user = USERS.find((item) => item.id === userId);
  if (!user) return;
  user.mfaEnabled = true;
  appendAudit({ actor: CURRENT_USER, action: "Required MFA", target: user.id, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Required MFA", category: "Access", resource: { type: "User", id: userId, name: user.name }, result: "Success" });
}

export function assignRole(userId: string, roleId: string): void {
  const user = USERS.find((item) => item.id === userId);
  if (!user || user.roleIds.includes(roleId)) return;
  user.roleIds.push(roleId);
  const role = roleById.get(roleId);
  appendAudit({ actor: CURRENT_USER, action: "Assigned role", target: `${user.id} → ${role?.name ?? roleId}`, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Assigned role", category: "Access", resource: { type: "User", id: userId, name: user.name }, result: "Success", reason: `Role: ${role?.name ?? roleId}` });
}

export function removeRole(userId: string, roleId: string): void {
  const user = USERS.find((item) => item.id === userId);
  if (!user) return;
  user.roleIds = user.roleIds.filter((id) => id !== roleId);
  const role = roleById.get(roleId);
  appendAudit({ actor: CURRENT_USER, action: "Removed role", target: `${user.id} → ${role?.name ?? roleId}`, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Removed role", category: "Access", resource: { type: "User", id: userId, name: user.name }, result: "Success", reason: `Role removed: ${role?.name ?? roleId}` });
}

export function resetPassword(userId: string): { temporaryPassword: string } {
  const user = USERS.find((item) => item.id === userId);
  const temp = `Temp-${Math.random().toString(36).slice(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  if (user) {
    user.passwordLastChangedAt = new Date().toISOString();
    appendAudit({ actor: CURRENT_USER, action: "Reset password", target: user.id, ip: "203.0.113.44", result: "Success" });
    logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Reset password", category: "Access", resource: { type: "User", id: userId, name: user.name }, result: "Success" });
  }
  return { temporaryPassword: temp };
}

export function revokeSession(userId: string, sessionId: string): void {
  const user = USERS.find((item) => item.id === userId);
  if (!user) return;
  user.sessions = user.sessions.filter((session) => session.id !== sessionId);
  appendAudit({ actor: CURRENT_USER, action: "Revoked session", target: `${user.id} (${sessionId})`, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Revoked session", category: "Access", resource: { type: "User", id: userId, name: user.name }, result: "Success" });
}

export function revokeAllSessions(userId: string): void {
  const user = USERS.find((item) => item.id === userId);
  if (!user) return;
  user.sessions = [];
  appendAudit({ actor: CURRENT_USER, action: "Revoked all sessions", target: user.id, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Revoked all sessions", category: "Access", resource: { type: "User", id: userId, name: user.name }, result: "Success" });
}

export function deleteUser(userId: string): boolean {
  const index = USERS.findIndex((item) => item.id === userId);
  if (index === -1) return false;
  const [user] = USERS.splice(index, 1);
  appendAudit({ actor: CURRENT_USER, action: "Deleted user", target: user.id, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Deleted user", category: "Access", resource: { type: "User", id: userId, name: user.name }, result: "Success" });
  return true;
}

export function rotateToken(tokenId: string): { newToken: string } {
  const token = API_TOKENS.find((item) => item.id === tokenId);
  if (!token) return { newToken: "" };
  const next = `nxs_live_${Math.random().toString(16).slice(2, 6)}${Math.random().toString(16).slice(2, 6)}`;
  token.prefix = next;
  token.lastUsedAt = null;
  appendAudit({ actor: CURRENT_USER, action: "Rotated API token", target: token.id, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Rotated API token", category: "Access", resource: { type: "API Token", id: tokenId, name: token.name }, result: "Success" });
  return { newToken: `${next}_live_${Math.random().toString(36).slice(2, 18)}` };
}

export function revokeToken(tokenId: string, reason: string): void {
  const token = API_TOKENS.find((item) => item.id === tokenId);
  if (!token) return;
  token.status = "revoked";
  appendAudit({ actor: CURRENT_USER, action: "Revoked API token", target: token.id, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Revoked API token", category: "Access", resource: { type: "API Token", id: tokenId, name: token.name }, result: "Success", reason });
}

export function createToken(input: Omit<ApiToken, "id" | "lastUsedAt" | "lastUsedIp" | "status">): { id: string; secret: string } {
  const id = `TOK-${5000 + API_TOKENS.length + 1}`;
  const secret = `nxs_live_${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`;
  API_TOKENS.unshift({ id, ...input, prefix: input.prefix, status: "active", lastUsedAt: null, lastUsedIp: null });
  appendAudit({ actor: CURRENT_USER, action: "Created API token", target: id, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Created API token", category: "Access", resource: { type: "API Token", id, name: input.name }, result: "Success" });
  return { id, secret };
}

export function inviteUser(input: { email: string; roleId: string; groupIds: string[] }): string {
  const id = `USR-${1000 + USERS.length + 1}`;
  const local = input.email.split("@")[0] ?? "user";
  const initials = local.split(/[._-]/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("").slice(0, 2) || local.slice(0, 2).toUpperCase();
  USERS.push({ id, name: local.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), email: input.email, avatarInitials: initials, roleIds: [input.roleId], status: "invited", mfaEnabled: false, lastLoginAt: null, lastLoginIp: null, createdAt: new Date().toISOString(), groupIds: [...input.groupIds], siteIds: ["frankfurt"], invitedBy: CURRENT_USER, passwordLastChangedAt: null, sessions: [], apiTokenIds: [] });
  appendAudit({ actor: CURRENT_USER, action: "Invited user", target: `${id} (${input.email})`, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Invited user", category: "Access", resource: { type: "User", id, name: input.email }, result: "Success" });
  return id;
}

export function resendInvite(userId: string): void {
  const user = USERS.find((item) => item.id === userId && item.status === "invited");
  if (!user) return;
  appendAudit({ actor: CURRENT_USER, action: "Resent invite", target: user.id, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Resent invite", category: "Access", resource: { type: "User", id: userId, name: user.name }, result: "Success" });
}

export function cancelInvite(userId: string): void {
  const index = USERS.findIndex((item) => item.id === userId && item.status === "invited");
  if (index === -1) return;
  const [user] = USERS.splice(index, 1);
  appendAudit({ actor: CURRENT_USER, action: "Cancelled invite", target: user.id, ip: "203.0.113.44", result: "Success" });
  logAudit({ actor: { id: "ACC-02", name: CURRENT_USER, type: "Human", role: "Operations" }, action: "Cancelled invite", category: "Access", resource: { type: "User", id: userId, name: user.email }, result: "Success" });
}
