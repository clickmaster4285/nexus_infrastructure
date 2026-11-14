import { servers } from "@/data/mock/servers";

export type SecuritySeverity = "Critical" | "High" | "Medium" | "Low" | "Info";
export type SecurityStatus = "Open" | "In progress" | "Fixed" | "Accepted risk";
export type FindingCategory = "Vulnerability" | "Patch" | "Certificate" | "Auth" | "Config" | "Access" | "Exposure";

export interface Vulnerability { id: string; cve: string; title: string; severity: SecuritySeverity; cvss: number; exploitable: boolean; affectedAssetIds: string[]; discoveredAt: string; slaDueAt: string; status: SecurityStatus; fixAvailable: boolean; patchId: string | null; }
export interface PatchStatus { assetId: string; os: string; pendingPatches: number; criticalPending: number; lastPatchedAt: string; compliant: boolean; }
export interface SecurityCertificate { id: string; domain: string; issuer: string; expiresAt: string; daysLeft: number; autoRenew: boolean; status: "Valid" | "Expiring" | "Expired"; }
export interface AuthEvent { id: string; time: string; user: string; ip: string; geo: string; result: "Success" | "Failed"; method: string; mfa: boolean; }
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
const authEvents: AuthEvent[] = Array.from({ length: 24 }, (_, index) => ({ id: `AUTH-${index + 1}`, time: new Date(now - index * 3_600_000).toISOString(), user: index % 4 === 0 ? "admin@nexus.io" : "ops@nexus.io", ip: `192.168.88.${20 + index % 7}`, geo: index % 3 === 0 ? "Karachi" : "London", result: index % 5 === 0 ? "Failed" : "Success", method: index % 2 ? "Password" : "SSO", mfa: index % 5 !== 0 }));
const configChanges: ConfigChange[] = Array.from({ length: 8 }, (_, index) => ({ id: `CFG-${3200 + index}`, assetId: serverIds[index % serverIds.length], what: index % 2 ? "Firewall rule changed" : "Package baseline drift", by: index % 2 ? "ops@nexus.io" : "automation@nexus.io", at: iso(index + 1), approved: index % 3 !== 0, driftFromBaseline: index % 3 === 0 }));
const accounts: AccessAccount[] = ([
  ["ACC-01", "admin@nexus.io", "Super Administrator", true, true, 2, 14, "human", false], ["ACC-02", "ops@nexus.io", "Operations", true, true, 1, 31, "human", false], ["ACC-03", "legacy@nexus.io", "Administrator", true, false, 120, 118, "human", false], ["ACC-04", "backup-agent", "Service Account", false, false, 4, 182, "service", false], ["ACC-05", "deploy@nexus.io", "Developer", false, true, 7, 44, "human", false], ["ACC-06", "disabled@nexus.io", "Viewer", false, true, 140, 211, "human", true],
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
