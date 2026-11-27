/** Vulnerability & patch-status pure helpers — single source for KPI, chart and table math. */

export type VulnSeverity = "Critical" | "High" | "Medium" | "Low";
export type VulnStatus = "Open" | "In Progress" | "Patched" | "Accepted Risk" | "Ignored";

export const SLA_DAYS: Record<VulnSeverity, number> = { Critical: 7, High: 14, Medium: 30, Low: 90 };

export function severityFromCvss(cvss: number): VulnSeverity {
  if (cvss >= 9) return "Critical";
  if (cvss >= 7) return "High";
  if (cvss >= 4) return "Medium";
  return "Low";
}

export function riskScore(cvss: number, exploitAvailable: boolean, knownExploited: boolean, publicFacing: boolean): number {
  const base = cvss * 8;
  const exploit = exploitAvailable ? 12 : 0;
  const kev = knownExploited ? 15 : 0;
  const exposure = publicFacing ? 8 : 0;
  return Math.min(100, Math.round(base + exploit + kev + exposure));
}

export type SlaStatus = "On track" | "Due soon" | "Overdue" | "Patched";

export function slaStatus(slaDueAt: string, status: VulnStatus, nowMs = Date.now()): SlaStatus {
  if (status === "Patched") return "Patched";
  const due = Date.parse(slaDueAt);
  const days = (due - nowMs) / 86_400_000;
  if (days < 0) return "Overdue";
  if (days <= 2) return "Due soon";
  return "On track";
}

export function slaDueFromFirstSeen(firstSeenAt: string, severity: VulnSeverity): string {
  return new Date(Date.parse(firstSeenAt) + SLA_DAYS[severity] * 86_400_000).toISOString();
}

export interface AgingBucket { label: string; count: number; tone: "blue" | "amber" | "red"; }

export function agingBuckets(items: Array<{ detectedAt: string }>, nowMs = Date.now()): AgingBucket[] {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
  for (const item of items) {
    const days = (nowMs - Date.parse(item.detectedAt)) / 86_400_000;
    if (days <= 7) b0 += 1;
    else if (days <= 30) b1 += 1;
    else if (days <= 90) b2 += 1;
    else b3 += 1;
  }
  return [
    { label: "0-7 days", count: b0, tone: "blue" },
    { label: "8-30 days", count: b1, tone: "amber" },
    { label: "31-90 days", count: b2, tone: "amber" },
    { label: "90+ days", count: b3, tone: "red" },
  ];
}

/** Mean time to patch in days over patched items (fallback 9.1 if sample empty). */
export function mttp(patched: Array<{ firstSeenAt: string; patchedAt: string | null }>): number {
  const valid = patched.filter((item) => item.patchedAt);
  if (valid.length === 0) return 9.1;
  const total = valid.reduce((acc, item) => acc + (Date.parse(item.patchedAt as string) - Date.parse(item.firstSeenAt)) / 86_400_000, 0);
  return Math.round((total / valid.length) * 10) / 10;
}

/** Compliance score: weighted open/patched/accepted per host → 0-100. */
export function complianceScore(input: { criticalOpen: number; highOpen: number; mediumOpen: number; lowOpen: number; patched: number; accepted: number }): number {
  const penalty = input.criticalOpen * 6 + input.highOpen * 3 + input.mediumOpen * 1.2 + input.lowOpen * 0.4;
  const credit = input.patched * 0.6 + input.accepted * 0.3;
  return Math.max(22, Math.min(98, Math.round(90 - penalty + credit)));
}
