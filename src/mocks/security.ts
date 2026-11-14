import { servers } from "@/data/mock/servers";
import { CURRENT_USER_NAME, appendIncidentToStore, nextIncidentId } from "@/mocks/incidents";
import { logAudit } from "@/mocks/auditLogs";

export type SecuritySeverity = "Critical" | "High" | "Medium" | "Low" | "Info";
export type SecurityStatus = "Open" | "In progress" | "Fixed" | "Accepted risk";
export type FindingCategory = "Vulnerability" | "Patch" | "Certificate" | "Auth" | "Config" | "Access" | "Exposure";

export interface Vulnerability { id: string; cve: string; title: string; severity: SecuritySeverity; cvss: number; exploitable: boolean; affectedAssetIds: string[]; discoveredAt: string; slaDueAt: string; status: SecurityStatus; fixAvailable: boolean; patchId: string | null; }
export interface PatchStatus { assetId: string; os: string; pendingPatches: number; criticalPending: number; lastPatchedAt: string; compliant: boolean; }
export interface SecurityCertificate { id: string; domain: string; issuer: string; expiresAt: string; daysLeft: number; autoRenew: boolean; status: "Valid" | "Expiring" | "Expired"; }
export type AuthUserType = "Human" | "Admin" | "Service";
export type AuthEventType = "Login" | "Logout" | "MFA challenge" | "Password reset" | "Account lockout" | "SSO assertion" | "Token issued";
export type AuthMethod = "Password" | "SSO/SAML" | "SSH key" | "API token" | "MFA/TOTP";
export type AuthResult = "Success" | "Failed" | "Blocked" | "Challenged";
export type AuthFailureReason = "Wrong password" | "MFA failed" | "Account locked" | "Expired credential" | "Disabled account" | "IP blocked" | "SSO assertion invalid";
export type AuthRiskFlag = "brute_force" | "password_spray" | "impossible_travel" | "new_location" | "new_device" | "off_hours" | "privileged" | "mfa_fatigue" | "anonymizer";
export type AuthReviewState = "New" | "Reviewed" | "False positive";

export interface AuthImpossibleTravel { fromCity: string; fromTime: string; toCity: string; toTime: string; distanceKm: number; minutes: number; }
/** Authentication event across the fleet. `time` is an ISO 8601 timestamp relative to module load. */
export interface AuthEvent { id: string; time: string; user: string; userType: AuthUserType; eventType: AuthEventType; method: AuthMethod; result: AuthResult; failureReason: AuthFailureReason | null; ip: string; country: string; countryCode: string; city: string; browser: string; os: string; /** e.g. "Chrome on macOS". */ device: string; /** App or ops-style server name (api-server-01, grafana.nexus.io, …). */ target: string; targetKind: "server" | "app"; mfaUsed: boolean; riskScore: number; riskFlags: AuthRiskFlag[]; reviewState: AuthReviewState; blocked: boolean; /** Present when the event was flagged as impossible travel. */ impossibleTravel?: AuthImpossibleTravel; }
export type AuthDetectionType = "brute_force" | "password_spray" | "impossible_travel" | "mfa_fatigue" | "off_hours";
export type AuthDetectionStatus = "Open" | "Investigating" | "Resolved" | "False positive";
/** Grouped auth anomaly raised by the detection engine. */
export interface AuthDetection { id: string; type: AuthDetectionType; severity: SecuritySeverity; /** User email or IP address. */ subject: string; count: number; firstSeen: string; lastSeen: string; status: AuthDetectionStatus; relatedEventIds: string[]; detail: string; }
export interface ConfigChange { id: string; assetId: string; what: string; by: string; at: string; approved: boolean; driftFromBaseline: boolean; }
export interface AccessAccount { id: string; user: string; role: string; privileged: boolean; mfa: boolean; lastLoginAt: string; keyAgeDays: number; type: "human" | "service"; locked: boolean; }
export interface Exposure { assetId: string; publicFacing: boolean; openPorts: Array<{ port: number; service: string; risky: boolean }>; }
export interface Finding { id: string; title: string; category: FindingCategory; severity: SecuritySeverity; assetId: string; status: SecurityStatus; owner: string; createdAt: string; dueAt: string; recommendation: string; evidence: string; linkedIncidentId?: string; acceptedUntil?: string; }
export interface SecuritySnapshot { vulnerabilities: Vulnerability[]; patches: PatchStatus[]; certificates: SecurityCertificate[]; authEvents: AuthEvent[]; configChanges: ConfigChange[]; accounts: AccessAccount[]; exposures: Exposure[]; findings: Finding[]; }


const DAY = 86_400_000;
const now = Date.now();
const iso = (offsetDays: number) => new Date(now - offsetDays * DAY).toISOString();
const due = (offsetDays: number) => new Date(now + offsetDays * DAY).toISOString();
const serverIds = ["api-server-01", "db-01", "web-app-01", "app-server-02", "cache-01", "edge-01"];
const domains = [
  ["api.example.com", 12, true], ["www.example.com", 74, true], ["shop.example.com", 26, false], ["status.example.com", 121, true], ["docs.example.com", 38, true], ["internal.nexus.io", 18, false], ["vpn.nexus.io", 52, true], ["grafana.nexus.io", 9, false],
] as const;

const vulnSeverity: SecuritySeverity[] = ["Critical", "Critical", "Critical", ...Array.from({ length: 9 }, () => "High" as const), ...Array.from({ length: 21 }, () => "Medium" as const), ...Array.from({ length: 14 }, () => "Low" as const)];
const vulnerabilities: Vulnerability[] = vulnSeverity.map((severity, index) => ({
  id: `VUL-${1042 + index}`, cve: `CVE-2026-${String(1234 + index).padStart(4, "0")}`, title: severity === "Critical" ? "Remote code execution in exposed service" : severity === "High" ? "Privilege escalation in system package" : "Outdated dependency requires remediation", severity, cvss: severity === "Critical" ? 9.8 - index / 10 : severity === "High" ? 8.1 - (index % 4) / 10 : severity === "Medium" ? 6.4 - (index % 3) / 10 : 3.8, exploitable: severity === "Critical" || (severity === "High" && index % 3 === 0), affectedAssetIds: [serverIds[index % serverIds.length]], discoveredAt: iso((index % 24) + 1), slaDueAt: due(severity === "Critical" ? -2 : severity === "High" ? 5 : 20), status: index % 11 === 0 ? "In progress" : "Open", fixAvailable: index % 4 !== 1, patchId: index % 4 !== 1 ? `PT-${2200 + index}` : null,
}));

const patches: PatchStatus[] = ([
  ["api-server-01", "Ubuntu 22.04", 3, 1, false], ["db-01", "Debian 12", 2, 0, true], ["web-app-01", "Windows Server 2022", 7, 2, false], ["app-server-02", "Windows Server 2019", 5, 1, false], ["cache-01", "Ubuntu 22.04", 4, 0, true], ["edge-01", "Debian 12", 5, 1, false],
] as Array<[string, string, number, number, boolean]>).map(([assetId, os, pendingPatches, criticalPending, compliant], index) => ({ assetId, os, pendingPatches, criticalPending, compliant, lastPatchedAt: iso(12 + index * 7) }));

const certificates: SecurityCertificate[] = domains.map(([domain, daysLeft, autoRenew], index) => ({ id: `CRT-${4100 + index}`, domain, issuer: index % 2 ? "Let's Encrypt" : "DigiCert", daysLeft, autoRenew, expiresAt: new Date(now + daysLeft * DAY).toISOString(), status: daysLeft < 7 ? "Expiring" : "Valid" }));
/* ---------------------------------------------------------------- *
 * Authentication events — single source of truth.
 *
 * 24h headline totals are FIXED constants (TOTAL_24H …); everything the
 * pages render (stat cards, banner, charts, tables, tabs, Security
 * Overview) derives from them or from the module-level `authEvents`
 * sample. Trend buckets are normalised so their sum matches the totals.
 * The 400-row `authEvents` array is a seeded deterministic SAMPLE of the
 * last 30 days (weighted to the last 24h); swap `loadAuthEvents` /
 * `loadAuthDetections` for real API fetches later — the types stay.
 * ---------------------------------------------------------------- */

export const AUTH_TOTAL_24H = 18_420;
export const AUTH_SUCCESS_24H = 17_180;
export const AUTH_FAILED_24H = 1_240;
/** Failed + Blocked + Challenged = AUTH_FAILED_24H. */
export const AUTH_FAILED_BREAKDOWN_24H = { failed: 900, blocked: 190, challenged: 150 } as const;
export const AUTH_LOCKED_ACCOUNTS = 6;
export const AUTH_SUSPICIOUS_24H = 14;
export const AUTH_MFA_COVERAGE_PCT = 87;
export const AUTH_UNIQUE_USERS_24H = 312;
export const AUTH_UNIQUE_IPS_24H = 1_246;

export const AUTH_RANGE_STATS = {
  "1H": { uniqueUsers: 96, uniqueIps: 341 },
  "24H": { uniqueUsers: AUTH_UNIQUE_USERS_24H, uniqueIps: AUTH_UNIQUE_IPS_24H },
  "7D": { uniqueUsers: 429, uniqueIps: 2_183 },
  "30D": { uniqueUsers: 573, uniqueIps: 3_904 },
} as const;

/** Suspect IPs share these documentation (TEST-NET) ranges everywhere — never real addresses. */
export const AUTH_BRUTE_FORCE_SUSPECTS = [
  { ip: "203.0.113.44", country: "Russia", countryCode: "RU", city: "Moscow", attempts: 486, usersTargeted: 37, firstSeenHoursAgo: 6, status: "Watch" as const },
  { ip: "198.51.100.23", country: "China", countryCode: "CN", city: "Shanghai", attempts: 412, usersTargeted: 29, firstSeenHoursAgo: 9, status: "Watch" as const },
  { ip: "192.0.2.171", country: "Netherlands", countryCode: "NL", city: "Amsterdam", attempts: 342, usersTargeted: 24, firstSeenHoursAgo: 14, status: "Blocked" as const, anonymizer: true },
];

/** The six accounts counted in the "Locked Accounts" KPI. */
export const AUTH_LOCKED_ACCOUNT_USERS = ["legacy@nexus.io", "disabled@nexus.io", "temp.contractor@nexus.io", "svc-test@nexus.io", "former.employee@nexus.io", "breakglass@nexus.io"] as const;

export const AUTH_METHOD_COUNTS = [
  { method: "Password", count: 8_214 },
  { method: "SSO/SAML", count: 5_893 },
  { method: "MFA/TOTP", count: 2_213 },
  { method: "SSH key", count: 1_471 },
  { method: "API token", count: 629 },
] as const;

export const AUTH_SSO_FAILURE_RATE_PCT = 2.1;

/** Seven failure reasons; sums to AUTH_FAILED_24H (wrong password = 724/1240 ≈ 58%). */
export const AUTH_FAILURE_REASONS = [
  { reason: "Wrong password", count: 724 },
  { reason: "MFA failed", count: 154 },
  { reason: "Account locked", count: 92 },
  { reason: "SSO assertion invalid", count: 70 },
  { reason: "Expired credential", count: 78 },
  { reason: "IP blocked", count: 68 },
  { reason: "Disabled account", count: 54 },
] as const;

export const AUTH_LOCATIONS = [
  { country: "Pakistan", countryCode: "PK", logins: 10_860, failedPct: 2.9, unusual: false },
  { country: "Germany", countryCode: "DE", logins: 3_214, failedPct: 4.1, unusual: false },
  { country: "United Kingdom", countryCode: "GB", logins: 2_140, failedPct: 6.8, unusual: false },
  { country: "Finland", countryCode: "FI", logins: 1_180, failedPct: 3.3, unusual: false },
  { country: "Netherlands", countryCode: "NL", logins: 742, failedPct: 5.2, unusual: false },
  { country: "Vietnam", countryCode: "VN", logins: 168, failedPct: 71.4, unusual: true },
  { country: "Nigeria", countryCode: "NG", logins: 116, failedPct: 64.1, unusual: true },
] as const;

export const AUTH_TARGETED_ACCOUNTS = [
  { user: "legacy@nexus.io", failedAttempts: 42, locked: true, lastAttemptMinutesAgo: 12 },
  { user: "admin@nexus.io", failedAttempts: 31, locked: false, lastAttemptMinutesAgo: 4 },
  { user: "disabled@nexus.io", failedAttempts: 28, locked: true, lastAttemptMinutesAgo: 47 },
  { user: "ops@nexus.io", failedAttempts: 24, locked: false, lastAttemptMinutesAgo: 8 },
  { user: "marcus.lee@nexus.io", failedAttempts: 9, locked: false, lastAttemptMinutesAgo: 132 },
  { user: "sara.iqbal@nexus.io", failedAttempts: 7, locked: false, lastAttemptMinutesAgo: 256 },
] as const;

/** Ops-style target name → All-Servers canonical name for /server-details links. */
export const OPS_TO_CANONICAL_SERVER: Record<string, string> = {
  "api-server-01": "prod-api-01",
  "api-server-02": "prod-api-01",
  "web-app-01": "web-frontend-01",
  "web-02": "web-frontend-01",
  "db-01": "db-primary",
  "app-server-02": "app-worker-02",
  "worker-01": "app-worker-02",
  "cache-01": "cache-server-01",
};

const authMulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

/** Largest-remainder integer split of `total` across `weights`. */
function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  const raw = weights.map((weight) => (weight / sum) * total);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((acc, value) => acc + value, 0);
  const order = raw.map((value, index) => ({ index, frac: value - Math.floor(value) })).sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k += 1, remainder -= 1) out[order[k].index] += 1;
  return out;
}

export type AuthTrendRange = "24H" | "7D" | "30D";
export interface AuthTrendBucket { label: string; success: number; failed: number; blocked: number; challenged: number; total: number; }
export interface AuthSummary {
  total: number; success: number; failed: number; failureRatePct: number;
  failedBreakdown: { failed: number; blocked: number; challenged: number };
  lockedAccounts: number; suspicious: number; mfaCoveragePct: number; uniqueUsers: number; uniqueIps: number; impossibleTravel: number;
  deltas: { total: number; totalPct: string; success: number; successPct: string; failed: number; failedPct: string; locked: number; suspicious: number; mfaCoverage: number; uniqueUsers: number };
  bruteForceSuspects: typeof AUTH_BRUTE_FORCE_SUSPECTS;
  lockedAccountUsers: readonly string[];
}

const AUTH_SUMMARY: AuthSummary = {
  total: AUTH_TOTAL_24H,
  success: AUTH_SUCCESS_24H,
  failed: AUTH_FAILED_24H,
  failureRatePct: Number(((AUTH_FAILED_24H / AUTH_TOTAL_24H) * 100).toFixed(1)),
  failedBreakdown: { ...AUTH_FAILED_BREAKDOWN_24H },
  lockedAccounts: AUTH_LOCKED_ACCOUNTS,
  suspicious: AUTH_SUSPICIOUS_24H,
  mfaCoveragePct: AUTH_MFA_COVERAGE_PCT,
  uniqueUsers: AUTH_UNIQUE_USERS_24H,
  uniqueIps: AUTH_UNIQUE_IPS_24H,
  impossibleTravel: 2,
  deltas: { total: 1_124, totalPct: "6.5%", success: 928, successPct: "5.7%", failed: 196, failedPct: "18.8%", locked: 2, suspicious: 3, mfaCoverage: 1.2, uniqueUsers: 11 },
  bruteForceSuspects: AUTH_BRUTE_FORCE_SUSPECTS,
  lockedAccountUsers: AUTH_LOCKED_ACCOUNT_USERS,
};

/** Sync snapshot used by every auth surface (this page + Security Overview). */
export function getAuthSummary(): AuthSummary {
  return AUTH_SUMMARY;
}

const trendCache = new Map<AuthTrendRange, AuthTrendBucket[]>();

function buildAuthTrendBuckets(range: AuthTrendRange): AuthTrendBucket[] {
  const rand = authMulberry32(range === "24H" ? 9101 : range === "7D" ? 9102 : 9103);
  if (range === "24H") {
    const startOfHour = (() => { const d = new Date(); d.setMinutes(0, 0, 0); return d.getTime(); })();
    const hourOfDay = (index: number) => new Date(startOfHour - (23 - index) * HOUR_MS).getHours();
    const weights = Array.from({ length: 24 }, (_, index) => {
      const hour = hourOfDay(index);
      const baseline = 0.55 + rand() * 0.3 + (hour >= 8 && hour <= 18 ? 0.35 : 0);
      const spike = hour === 2 ? 5.2 : hour === 3 ? 2.1 : hour === 14 ? 1.35 : 1;
      return baseline * spike;
    });
    const success = distribute(AUTH_SUCCESS_24H, weights);
    const failedWeights = weights.map((weight, index) => weight * (hourOfDay(index) === 2 ? 6.5 : hourOfDay(index) === 3 ? 3.2 : 1));
    const failed = distribute(AUTH_FAILED_BREAKDOWN_24H.failed, failedWeights);
    const blocked = distribute(AUTH_FAILED_BREAKDOWN_24H.blocked, failedWeights);
    const challenged = distribute(AUTH_FAILED_BREAKDOWN_24H.challenged, weights);
    return Array.from({ length: 24 }, (_, index) => {
      const start = startOfHour - (23 - index) * HOUR_MS;
      const label = new Date(start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
      return {
        label,
        success: success[index],
        failed: failed[index],
        blocked: blocked[index],
        challenged: challenged[index],
        total: success[index] + failed[index] + blocked[index] + challenged[index],
      };
    });
  }
  const count = range === "7D" ? 7 : 30;
  const total = range === "7D" ? 128_940 : 552_600;
  const successTotal = range === "7D" ? 120_190 : 515_000;
  const failedTotal = total - successTotal;
  const failedPlain = Math.round(failedTotal * 0.72);
  const blockedPlain = Math.round(failedTotal * 0.14);
  const challengedPlain = failedTotal - failedPlain - blockedPlain;
  const weights = Array.from({ length: count }, (_, index) => {
    const weekday = new Date(Date.now() - (count - 1 - index) * DAY).getDay();
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.62 : 1;
    return (0.7 + rand() * 0.5) * weekendFactor * (index === count - 1 ? 0.7 : 1);
  });
  const success = distribute(successTotal, weights);
  const failed = distribute(failedPlain, weights.map((weight, index) => weight * (index === count - 4 ? 4.5 : 1)));
  const blocked = distribute(blockedPlain, weights);
  const challenged = distribute(challengedPlain, weights);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.now() - (count - 1 - index) * DAY);
    const label = range === "7D"
      ? date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })
      : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { label, success: success[index], failed: failed[index], blocked: blocked[index], challenged: challenged[index], total: success[index] + failed[index] + blocked[index] + challenged[index] };
  });
}

/** Range totals scale with the auth volume; 24H sums exactly to the fixed headline totals. */
export function authTrendBuckets(range: AuthTrendRange): AuthTrendBucket[] {
  const cached = trendCache.get(range);
  if (cached) return cached;
  const built = buildAuthTrendBuckets(range);
  trendCache.set(range, built);
  return built;
}

const HOUR_MS = 3_600_000;

function seedAuthEvents(): AuthEvent[] {
  const rand = authMulberry32(20261113);
  const now = Date.now();
  const eventTypes: AuthEventType[] = ["Login", "Login", "Login", "Login", "Login", "Login", "Login", "Logout", "MFA challenge", "Password reset", "SSO assertion", "Token issued"];
  const methods: AuthMethod[] = ["Password", "Password", "Password", "Password", "SSO/SAML", "SSO/SAML", "SSO/SAML", "MFA/TOTP", "SSH key", "API token"];
  const users: Array<{ user: string; type: AuthUserType }> = [
    { user: "admin@nexus.io", type: "Admin" }, { user: "ops@nexus.io", type: "Admin" }, { user: "legacy@nexus.io", type: "Admin" }, { user: "breakglass@nexus.io", type: "Admin" },
    { user: "sara.iqbal@nexus.io", type: "Human" }, { user: "marcus.lee@nexus.io", type: "Human" }, { user: "priya.nair@nexus.io", type: "Human" }, { user: "tom.becker@nexus.io", type: "Human" }, { user: "nina.park@nexus.io", type: "Human" }, { user: "deploy@nexus.io", type: "Human" }, { user: "ayesha.khan@nexus.io", type: "Human" }, { user: "daniel.roth@nexus.io", type: "Human" },
    { user: "backup-agent", type: "Service" }, { user: "monitoring-probe", type: "Service" }, { user: "ci-cd-bot", type: "Service" }, { user: "svc-test@nexus.io", type: "Service" },
  ];
  const normalIps = ["203.0.113.10", "203.0.113.27", "198.51.100.41", "192.168.88.14", "192.168.88.23", "10.10.1.10", "203.0.113.88", "198.51.100.112", "203.0.113.131", "192.168.88.31"];
  const failedIps = ["203.0.113.44", "198.51.100.23", "192.0.2.171", "203.0.113.101", "198.51.100.87", "203.0.113.102"];
  const countries = [
    { country: "Pakistan", countryCode: "PK", city: "Karachi" }, { country: "Germany", countryCode: "DE", city: "Frankfurt" }, { country: "United Kingdom", countryCode: "GB", city: "London" },
    { country: "Finland", countryCode: "FI", city: "Helsinki" }, { country: "Netherlands", countryCode: "NL", city: "Amsterdam" },
  ] as const;
  const browsers = [
    { browser: "Chrome", os: "macOS", device: "Chrome on macOS" }, { browser: "Chrome", os: "Windows", device: "Chrome on Windows" }, { browser: "Firefox", os: "Linux", device: "Firefox on Linux" },
    { browser: "Safari", os: "macOS", device: "Safari on macOS" }, { browser: "Edge", os: "Windows", device: "Edge on Windows" }, { browser: "curl", os: "Linux", device: "curl on Linux" }, { browser: "OpenSSH", os: "Linux", device: "OpenSSH on Linux" },
  ] as const;
  const targets: Array<{ target: string; kind: "server" | "app" }> = [
    { target: "api-server-01", kind: "server" }, { target: "db-01", kind: "server" }, { target: "web-app-01", kind: "server" }, { target: "app-server-02", kind: "server" }, { target: "cache-01", kind: "server" }, { target: "edge-01", kind: "server" }, { target: "pay-01", kind: "server" }, { target: "auth-01", kind: "server" },
    { target: "grafana.nexus.io", kind: "app" }, { target: "vpn.nexus.io", kind: "app" }, { target: "auth-service", kind: "app" }, { target: "web-app", kind: "app" },
  ];
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];

  const events: AuthEvent[] = [];
  for (let index = 0; index < 392; index += 1) {
    const withinDay = index < 240;
    const ageMs = withinDay ? rand() * 24 * HOUR_MS : 24 * HOUR_MS + rand() * 29 * DAY;
    const at = new Date(now - ageMs);
    const actor = pick(users);
    const method = pick(methods);
    const eventType = actor.type === "Service" ? (rand() < 0.72 ? "Token issued" : "Login") : pick(eventTypes);
    const offHours = at.getHours() < 6 || at.getHours() >= 22;
    const fromSuspect = !withinDay && rand() < 0.04;
    const ip = fromSuspect ? pick(failedIps) : rand() < 0.32 ? pick(normalIps.slice(3)) : pick(normalIps.slice(0, 3));
    const suspiciousRoll = rand();
    const failureRoll = rand();
    const forcedFailure = ip === "203.0.113.44" || ip === "198.51.100.23" ? failureRoll < 0.82 : failureRoll < (withinDay ? 0.055 : 0.03);
    const result: AuthResult = forcedFailure ? "Failed" : actor.type === "Service" && method === "API token" && suspiciousRoll < 0.02 ? "Blocked" : "Success";
    const reason = result === "Failed" ? (method === "SSO/SAML" ? "SSO assertion invalid" : method === "MFA/TOTP" ? "MFA failed" : ip.startsWith("192.168") ? "Account locked" : "Wrong password") : null;
    const geo = rand() < 0.88
      ? pick(countries)
      : { country: "Vietnam" as const, countryCode: "VN" as const, city: "Hanoi" as const };
    const browser = method === "SSH key" ? browsers[6] : method === "API token" || method === "MFA/TOTP" && actor.type === "Service" ? browsers[5] : pick(browsers.slice(0, 5));
    const target = pick(targets);
    const flags: AuthRiskFlag[] = [];
    if (ip === "203.0.113.44" || ip === "198.51.100.23") flags.push("brute_force");
    if (ip === "203.0.113.101" || ip === "198.51.100.87") flags.push("password_spray");
    if (ip === "192.0.2.171") flags.push("anonymizer");
    if (offHours && actor.type !== "Service") flags.push("off_hours");
    if (geo.country === "Vietnam") flags.push("new_location");
    if (rand() < 0.06) flags.push("new_device");
    if (actor.type === "Admin") flags.push("privileged");
    if (result === "Failed" && method === "MFA/TOTP") flags.push("mfa_fatigue");
    const riskScore = Math.min(99, Math.max(2, Math.round((result === "Failed" ? 38 : 6) + flags.length * 17 + rand() * 12)));
    const reviewState: AuthReviewState = riskScore >= 70 ? "New" : rand() < 0.18 ? "Reviewed" : rand() < 0.06 ? "False positive" : "New";
    events.push({
      id: "", time: at.toISOString(), user: actor.user, userType: actor.type, eventType, method,
      result, failureReason: reason, ip, country: geo.country, countryCode: geo.countryCode, city: geo.city,
      browser: browser.browser, os: browser.os, device: browser.device,
      target: target.target, targetKind: target.kind,
      mfaUsed: method !== "Password" && method !== "API token" ? true : rand() < 0.72,
      riskScore, riskFlags: flags, reviewState, blocked: result === "Blocked",
    });
  }

  // Hand-authored showcase events (fixed shape, ids assigned after sorting).
  const showcase: Array<Omit<AuthEvent, "id">> = [
    { time: new Date(now - 18 * 60_000).toISOString(), user: "admin@nexus.io", userType: "Admin", eventType: "Login", method: "Password", result: "Failed", failureReason: "Wrong password", ip: "203.0.113.44", country: "Russia", countryCode: "RU", city: "Moscow", browser: "Chrome", os: "Windows", device: "Chrome on Windows", target: "vpn.nexus.io", targetKind: "app", mfaUsed: false, riskScore: 92, riskFlags: ["brute_force", "privileged", "new_device", "new_location"], reviewState: "New", blocked: false, impossibleTravel: { fromCity: "Karachi", fromTime: new Date(now - 40 * 60_000).toISOString(), toCity: "Frankfurt", toTime: new Date(now).toISOString(), distanceKm: 5_300, minutes: 22 } },
    { time: new Date(now - 2 * HOUR_MS).toISOString(), user: "ops@nexus.io", userType: "Admin", eventType: "Login", method: "SSO/SAML", result: "Success", failureReason: null, ip: "198.51.100.23", country: "China", countryCode: "CN", city: "Shanghai", browser: "Edge", os: "Windows", device: "Edge on Windows", target: "grafana.nexus.io", targetKind: "app", mfaUsed: true, riskScore: 86, riskFlags: ["impossible_travel", "new_location", "new_device", "privileged"], reviewState: "New", blocked: false, impossibleTravel: { fromCity: "Karachi", fromTime: new Date(now - 2 * HOUR_MS - 22 * 60_000).toISOString(), toCity: "Frankfurt", toTime: new Date(now - 2 * HOUR_MS).toISOString(), distanceKm: 5_300, minutes: 18 } },
    { time: new Date(now - 3 * HOUR_MS).toISOString(), user: "legacy@nexus.io", userType: "Admin", eventType: "MFA challenge", method: "SSO/SAML", result: "Challenged", failureReason: null, ip: "203.0.113.27", country: "Pakistan", countryCode: "PK", city: "Karachi", browser: "Firefox", os: "Linux", device: "Firefox on Linux", target: "api-server-01", targetKind: "server", mfaUsed: true, riskScore: 74, riskFlags: ["mfa_fatigue", "privileged", "off_hours"], reviewState: "New", blocked: false },
    { time: new Date(now - 5 * HOUR_MS).toISOString(), user: "backup-agent", userType: "Service", eventType: "Login", method: "Password", result: "Success", failureReason: null, ip: "192.168.88.23", country: "Pakistan", countryCode: "PK", city: "Karachi", browser: "OpenSSH", os: "Linux", device: "OpenSSH on Linux", target: "db-01", targetKind: "server", mfaUsed: false, riskScore: 71, riskFlags: ["privileged", "new_device", "off_hours"], reviewState: "New", blocked: false },
    { time: new Date(now - 6 * HOUR_MS).toISOString(), user: "disabled@nexus.io", userType: "Human", eventType: "Account lockout", method: "Password", result: "Blocked", failureReason: "Disabled account", ip: "203.0.113.44", country: "Russia", countryCode: "RU", city: "Moscow", browser: "curl", os: "Linux", device: "curl on Linux", target: "web-app-01", targetKind: "server", mfaUsed: false, riskScore: 78, riskFlags: ["brute_force", "new_location"], reviewState: "Reviewed", blocked: true },
    { time: new Date(now - 8 * HOUR_MS).toISOString(), user: "tom.becker@nexus.io", userType: "Human", eventType: "Login", method: "Password", result: "Failed", failureReason: "Wrong password", ip: "203.0.113.101", country: "Russia", countryCode: "RU", city: "Saint Petersburg", browser: "curl", os: "Linux", device: "curl on Linux", target: "vpn.nexus.io", targetKind: "app", mfaUsed: false, riskScore: 79, riskFlags: ["password_spray", "new_location"], reviewState: "New", blocked: false },
    { time: new Date(now - 11 * HOUR_MS).toISOString(), user: "priya.nair@nexus.io", userType: "Human", eventType: "SSO assertion", method: "SSO/SAML", result: "Failed", failureReason: "SSO assertion invalid", ip: "198.51.100.112", country: "United Kingdom", countryCode: "GB", city: "London", browser: "Chrome", os: "macOS", device: "Chrome on macOS", target: "grafana.nexus.io", targetKind: "app", mfaUsed: true, riskScore: 66, riskFlags: ["new_device"], reviewState: "Reviewed", blocked: false },
    { time: new Date(now - 14 * HOUR_MS).toISOString(), user: "marcus.lee@nexus.io", userType: "Human", eventType: "Login", method: "SSO/SAML", result: "Success", failureReason: null, ip: "192.0.2.171", country: "Netherlands", countryCode: "NL", city: "Amsterdam", browser: "Firefox", os: "Linux", device: "Firefox on Linux", target: "vpn.nexus.io", targetKind: "app", mfaUsed: true, riskScore: 58, riskFlags: ["anonymizer"], reviewState: "New", blocked: false },
  ];
  for (const entry of showcase) events.push({ id: "", ...entry });

  events.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  return events.map((event, index) => ({ ...event, id: `AUTH-${90001 + index}` }));
}
const authEvents: AuthEvent[] = seedAuthEvents();

const authDetections: AuthDetection[] = [
  { id: "DET-3101", type: "brute_force", severity: "Critical", subject: "203.0.113.44", count: 486, firstSeen: new Date(now - 6 * HOUR_MS).toISOString(), lastSeen: new Date().toISOString(), status: "Open", relatedEventIds: authEvents.filter((event) => event.ip === "203.0.113.44").slice(0, 8).map((event) => event.id), detail: "486 failed password attempts against 37 accounts from a single IP." },
  { id: "DET-3102", type: "brute_force", severity: "High", subject: "198.51.100.23", count: 412, firstSeen: new Date(now - 9 * HOUR_MS).toISOString(), lastSeen: new Date().toISOString(), status: "Open", relatedEventIds: authEvents.filter((event) => event.ip === "198.51.100.23").slice(0, 8).map((event) => event.id), detail: "412 failed attempts from a second source; same account list as DET-3101." },
  { id: "DET-3103", type: "brute_force", severity: "High", subject: "192.0.2.171", count: 342, firstSeen: new Date(now - 14 * HOUR_MS).toISOString(), lastSeen: new Date(now - 2 * HOUR_MS).toISOString(), status: "Investigating", relatedEventIds: authEvents.filter((event) => event.ip === "192.0.2.171").slice(0, 8).map((event) => event.id), detail: "342 attempts through an anonymizer exit node; auto-blocked at the edge." },
  { id: "DET-3104", type: "impossible_travel", severity: "High", subject: "ops@nexus.io", count: 2, firstSeen: new Date(now - 3 * HOUR_MS).toISOString(), lastSeen: new Date().toISOString(), status: "Investigating", relatedEventIds: authEvents.filter((event) => event.user === "ops@nexus.io" && event.riskFlags.includes("impossible_travel")).slice(0, 8).map((event) => event.id), detail: "Karachi 10:02 → Frankfurt 10:20 (≈ 5,300 km in 18 min)." },
  { id: "DET-3105", type: "password_spray", severity: "Medium", subject: "203.0.113.101", count: 171, firstSeen: new Date(now - 11 * HOUR_MS).toISOString(), lastSeen: new Date().toISOString(), status: "Open", relatedEventIds: authEvents.filter((event) => event.ip === "203.0.113.101").slice(0, 8).map((event) => event.id), detail: "Low-and-slow spray across 29 accounts; 1 successful login attempt observed." },
  { id: "DET-3106", type: "mfa_fatigue", severity: "Medium", subject: "legacy@nexus.io", count: 14, firstSeen: new Date(now - 5 * HOUR_MS).toISOString(), lastSeen: new Date(now - HOUR_MS).toISOString(), status: "Resolved", relatedEventIds: authEvents.filter((event) => event.user === "legacy@nexus.io").slice(0, 8).map((event) => event.id), detail: "14 consecutive MFA pushes in 30 minutes; user denied all of them." },
];

const authStore = {
  blockedIps: new Set<string>(AUTH_BRUTE_FORCE_SUSPECTS.filter((suspect) => suspect.status === "Blocked").map((suspect) => suspect.ip)),
  lockedUsers: new Set<string>(AUTH_LOCKED_ACCOUNT_USERS),
};
const delay = () => 200 + Math.random() * 200;

/** Move a detection to a new status (used by Investigate / Resolve quick actions). */
export function setAuthDetectionStatus(id: string, status: AuthDetectionStatus): void {
  const detection = authDetections.find((item) => item.id === id);
  if (!detection) return;
  detection.status = status;
  auditAuth("Updated detection", { type: "Detection", id, name: id }, `Status → ${status}`);
}

export function getAuthDetections(): AuthDetection[] {
  return authDetections.map((detection) => ({ ...detection, relatedEventIds: [...detection.relatedEventIds] }));
}

/** Async mock fetch — swap for `fetch("/api/auth/events")` later. */
export function loadAuthEvents(): Promise<AuthEvent[]> {
  return new Promise((resolve) => {
    const timer = typeof window !== "undefined" ? window.setTimeout : setTimeout;
    timer(() => resolve(authEvents), delay());
  });
}

/** Async mock fetch — swap for `fetch("/api/auth/detections")` later. */
export function loadAuthDetections(): Promise<AuthDetection[]> {
  return new Promise((resolve) => {
    const timer = typeof window !== "undefined" ? window.setTimeout : setTimeout;
    timer(() => resolve(authDetections.map((detection) => ({ ...detection, relatedEventIds: [...detection.relatedEventIds] }))), delay());
  });
}

export function getAuthEventById(id: string): AuthEvent | undefined {
  return authEvents.find((event) => event.id === id);
}

export function isAuthIpBlocked(ip: string): boolean {
  return authStore.blockedIps.has(ip);
}

export function isAuthAccountLocked(user: string): boolean {
  return authStore.lockedUsers.has(user);
}

/** Every mutating auth action writes to the shared Audit Logs store. */
function auditAuth(action: string, resource: { type: string; id: string; name: string }, reason?: string): void {
  logAudit({
    actor: { id: "ACC-02", name: CURRENT_USER_NAME, type: "Human", role: "Operations" },
    action,
    category: resource.type === "IP address" ? "Security" : resource.type === "Incident" ? "Incident" : "Auth",
    resource,
    result: "Success",
    reason,
  });
}

/** In-memory block; production wires this to the edge firewall API. */
export function blockAuthIp(ip: string, opts: { duration: string; reason: string; scope: string }): void {
  authStore.blockedIps.add(ip);
  for (const event of authEvents) {
    if (event.ip === ip && event.result === "Success") event.blocked = true;
  }
  auditAuth("Blocked IP", { type: "IP address", id: ip, name: ip }, `Blocked for ${opts.duration} · scope: ${opts.scope} · reason: ${opts.reason}`);
}

export function unblockAuthIp(ip: string): void {
  authStore.blockedIps.delete(ip);
  auditAuth("Unblocked IP", { type: "IP address", id: ip, name: ip }, "Manual unblock via Authentication Events.");
}

export function setAuthAccountLocked(user: string, locked: boolean, reason: string): void {
  if (locked) authStore.lockedUsers.add(user); else authStore.lockedUsers.delete(user);
  auditAuth(locked ? "Locked account" : "Unlocked account", { type: "Account", id: user, name: user }, reason);
}

export function markAuthReviewed(ids: string[], state: AuthReviewState, reason?: string): void {
  const idSet = new Set(ids);
  for (const event of authEvents) {
    if (idSet.has(event.id)) event.reviewState = state;
  }
  auditAuth(
    state === "False positive" ? "Marked false positive" : "Marked reviewed",
    { type: "Auth event", id: ids.length === 1 ? ids[0] : "bulk", name: ids.length === 1 ? ids[0] : `${ids.length} events` },
    reason ?? `Marked as ${state}.`,
  );
}

/** Demo permission flag — flip to false to see admin-gated actions disable with a tooltip. */
export const MOCK_ADMIN_PERMISSION = true;

/** Deterministic mock "active session" count for a user. */
export function authSessionCountFor(user: string): number {
  return 2 + Math.floor(Math.abs([...user].reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 4);
}

export function forceAuthPasswordReset(user: string): number {
  const sessions = authSessionCountFor(user);
  auditAuth("Forced password reset", { type: "Account", id: user, name: user }, `Password reset forced; ${sessions} active sessions invalidated.`);
  return sessions;
}

export function revokeAuthSessions(user: string): number {
  const sessions = authSessionCountFor(user);
  auditAuth("Revoked sessions", { type: "Account", id: user, name: user }, `${sessions} active sessions terminated.`);
  return sessions;
}

export const AUTH_DETECTION_LABEL: Record<AuthDetectionType, string> = {
  brute_force: "Brute force",
  password_spray: "Password spray",
  impossible_travel: "Impossible travel",
  mfa_fatigue: "MFA fatigue",
  off_hours: "Off-hours privileged access",
};

export const AUTH_RISK_FLAG_LABEL: Record<AuthRiskFlag, string> = {
  brute_force: "Brute force",
  password_spray: "Password spray",
  impossible_travel: "Impossible travel",
  new_location: "New location",
  new_device: "New device",
  off_hours: "Off-hours",
  privileged: "Privileged",
  mfa_fatigue: "MFA fatigue",
  anonymizer: "Anonymizer",
};

/** Create an incident from an auth context. Returns the new incident id. */
export function createAuthIncident(input: { title: string; severity: "SEV1" | "SEV2" | "SEV3"; impact: string; hosts?: string[]; tags?: string[] }): string {
  const id = nextIncidentId();
  const at = new Date().toISOString();
  appendIncidentToStore({
    id, title: input.title.trim(), severity: input.severity, status: "Investigating",
    commander: CURRENT_USER_NAME, assignee: null, team: "SRE",
    affectedServices: ["auth-service"], affectedHosts: input.hosts ?? ["auth-01"],
    linkedAlertIds: [], impact: input.impact.trim() || "Authentication anomaly under investigation.",
    startedAt: at, acknowledgedAt: null, resolvedAt: null, rootCause: "Under investigation.",
    timeline: [{ id: `${id}-tl-created`, at, epochMs: Date.parse(at), type: "created", author: CURRENT_USER_NAME, text: "Incident declared from Authentication Events." }],
    postmortem: { status: "None", summary: "", rootCause: "", impact: "", actionItems: [] },
    tags: input.tags ?? ["security", "auth"],
  });
  auditAuth("Declared incident", { type: "Incident", id, name: input.title.trim().slice(0, 120) }, "Incident created from Authentication Events.");
  return id;
}

const configChanges: ConfigChange[] = Array.from({ length: 8 }, (_, index) => ({ id: `CFG-${3200 + index}`, assetId: serverIds[index % serverIds.length], what: index % 2 ? "Firewall rule changed" : "Package baseline drift", by: index % 2 ? "ops@nexus.io" : "automation@nexus.io", at: iso(index + 1), approved: index % 3 !== 0, driftFromBaseline: index % 3 === 0 }));
const accounts: AccessAccount[] = ([
  ["ACC-01", "admin@nexus.io", "Super Administrator", true, true, 2, 14, "human", false], ["ACC-02", "ops@nexus.io", "Operations", true, true, 1, 31, "human", false],   ["ACC-03", "legacy@nexus.io", "Administrator", true, false, 120, 118, "human", true],   ["ACC-04", "backup-agent", "Service Account", false, false, 4, 182, "service", false], ["ACC-05", "deploy@nexus.io", "Developer", false, true, 7, 44, "human", false], ["ACC-06", "disabled@nexus.io", "Viewer", false, true, 140, 211, "human", true], ["ACC-07", "temp.contractor@nexus.io", "Viewer", false, false, 45, 30, "human", true], ["ACC-08", "svc-test@nexus.io", "Service Account", false, false, 61, 400, "service", true], ["ACC-09", "former.employee@nexus.io", "Developer", false, true, 200, 280, "human", true], ["ACC-10", "breakglass@nexus.io", "Break-glass Admin", true, true, 365, 365, "human", true],
] as Array<[string, string, string, boolean, boolean, number, number, "human" | "service", boolean]>).map(([id, user, role, privileged, mfa, lastLoginDays, keyAgeDays, type, locked]) => ({ id, user, role, privileged, mfa, lastLoginAt: iso(lastLoginDays), keyAgeDays, type, locked }));
const exposures: Exposure[] = serverIds.map((assetId, index) => ({ assetId, publicFacing: index < 4, openPorts: [{ port: 443, service: "HTTPS", risky: false }, ...(index % 2 === 0 ? [{ port: 22, service: "SSH", risky: true }] : []), ...(index === 2 ? [{ port: 3306, service: "MySQL", risky: true }] : [])] }));

const findings: Finding[] = [
  ...vulnerabilities.slice(0, 16).map((vulnerability, index) => ({ id: `SEC-${1042 + index}`, title: vulnerability.title, category: "Vulnerability" as const, severity: vulnerability.severity, assetId: vulnerability.affectedAssetIds[0], status: vulnerability.status, owner: index % 2 ? "Tom Becker" : "Sara Iqbal", createdAt: vulnerability.discoveredAt, dueAt: vulnerability.slaDueAt, recommendation: "Apply the available vendor patch and verify the service restart.", evidence: `${vulnerability.cve} detected by the vulnerability scanner.`, linkedIncidentId: index === 0 ? "INC-1041" : undefined })),
  { id: "SEC-1060", title: "Critical patches pending on web tier", category: "Patch", severity: "High", assetId: "web-app-01", status: "Open", owner: "Marcus Lee", createdAt: iso(8), dueAt: due(2), recommendation: "Schedule the next approved maintenance window.", evidence: "2 critical patches are pending." },
  { id: "SEC-1061", title: "Certificate expires within 7 days", category: "Certificate", severity: "Critical", assetId: "edge-01", status: "Open", owner: "Priya Nair", createdAt: iso(2), dueAt: due(4), recommendation: "Renew and deploy the certificate chain.", evidence: "vpn.nexus.io expires in 9 days; edge certificate rule is active." },
  { id: "SEC-1062", title: "Repeated failed login burst", category: "Auth", severity: "High", assetId: "edge-01", status: "In progress", owner: "ops@nexus.io", createdAt: iso(1), dueAt: due(1), recommendation: "Block the source IP and enforce MFA.", evidence: "1,240 failed login attempts in the last 24 hours." },
  { id: "SEC-1063", title: "Configuration drift from baseline", category: "Config", severity: "Medium", assetId: "app-server-02", status: "Open", owner: "Tom Becker", createdAt: iso(11), dueAt: due(8), recommendation: "Review and approve the firewall rule change.", evidence: "Baseline hash differs from the approved configuration." },
  { id: "SEC-1064", title: "Privileged account without MFA", category: "Access", severity: "High", assetId: "db-01", status: "Open", owner: "admin@nexus.io", createdAt: iso(14), dueAt: due(6), recommendation: "Enroll the account in MFA or remove privilege.", evidence: "legacy@nexus.io has administrator privileges and MFA disabled." },
  { id: "SEC-1065", title: "Risky MySQL port exposed", category: "Exposure", severity: "Critical", assetId: "web-app-01", status: "Open", owner: "Sara Iqbal", createdAt: iso(3), dueAt: due(1), recommendation: "Restrict port 3306 to the database security group.", evidence: "TCP 3306 is reachable from a public-facing asset." },
];

export const SECURITY_SNAPSHOT: SecuritySnapshot = { vulnerabilities, patches, certificates, authEvents, configChanges, accounts, exposures, findings };

export function getSecuritySnapshot(): SecuritySnapshot { return SECURITY_SNAPSHOT; }
export async function loadSecuritySnapshot(): Promise<SecuritySnapshot> { await new Promise((resolve) => setTimeout(resolve, 280)); return SECURITY_SNAPSHOT; }
export function securityScore(snapshot: SecuritySnapshot): number { const vuln = Math.max(35, 100 - snapshot.vulnerabilities.filter((item) => item.status === "Open").length * 1.2); const patch = Math.round(snapshot.patches.filter((item) => item.compliant).length / snapshot.patches.length * 100); const cert = Math.round(snapshot.certificates.filter((item) => item.daysLeft > 30).length / snapshot.certificates.length * 100); const config = Math.round(snapshot.configChanges.filter((item) => !item.driftFromBaseline).length / snapshot.configChanges.length * 100); const access = Math.round(snapshot.accounts.filter((item) => !item.privileged || item.mfa).length / snapshot.accounts.length * 100); const exposure = Math.round(snapshot.exposures.filter((item) => item.openPorts.every((port) => !port.risky)).length / snapshot.exposures.length * 100); return Math.round(vuln * .3 + patch * .2 + cert * .1 + config * .15 + access * .15 + exposure * .1); }
export function assetName(assetId: string): string { return servers.find((server) => server.id === assetId || server.name === assetId)?.name ?? assetId; }

