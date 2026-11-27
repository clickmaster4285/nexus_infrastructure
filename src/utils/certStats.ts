/** Certificate pure helpers — single source for KPI, charts and table math. */

export type CertStatus = "Expired" | "Critical" | "Expiring soon" | "Healthy" | "Revoked";

export const CRITICAL_DAYS = 7;
export const WARNING_DAYS = 30;

export function daysUntilExpiry(expiresAt: string, nowMs = Date.now()): number {
  return Math.floor((Date.parse(expiresAt) - nowMs) / 86_400_000);
}

export function expiryStatus(expiresAt: string, revoked: boolean, nowMs = Date.now()): CertStatus {
  if (revoked) return "Revoked";
  const days = daysUntilExpiry(expiresAt, nowMs);
  if (days < 0) return "Expired";
  if (days <= CRITICAL_DAYS) return "Critical";
  if (days <= WARNING_DAYS) return "Expiring soon";
  return "Healthy";
}

export interface CertStatSummary {
  total: number;
  expired: number;
  expiring30: number;
  autoRenewCoveragePct: number;
  weak: number;
  avgHealthScore: number;
  expiring7: number;
  selfSigned: number;
}

export function certStats(input: { expired: number; expiring30: number; autoRenew: number; total: number; weak: number; healthScores: number[] }): CertStatSummary {
  const avgHealthScore = input.healthScores.length
    ? Math.round(input.healthScores.reduce((acc, value) => acc + value, 0) / input.healthScores.length)
    : 0;
  return {
    total: input.total,
    expired: input.expired,
    expiring30: input.expiring30,
    autoRenewCoveragePct: input.total > 0 ? Math.round((input.autoRenew / input.total) * 100) : 0,
    weak: input.weak,
    avgHealthScore,
    expiring7: 0,
    selfSigned: 0,
  };
}

export interface ExpiryBucket {
  label: string;
  count: number;
  tone: "red" | "orange" | "amber" | "blue" | "emerald";
}

export function expiryBuckets(expiries: string[], nowMs = Date.now()): ExpiryBucket[] {
  let expired = 0, d0_7 = 0, d8_30 = 0, d31_90 = 0, d90plus = 0;
  for (const iso of expiries) {
    const days = daysUntilExpiry(iso, nowMs);
    if (days < 0) expired += 1;
    else if (days <= 7) d0_7 += 1;
    else if (days <= 30) d8_30 += 1;
    else if (days <= 90) d31_90 += 1;
    else d90plus += 1;
  }
  return [
    { label: "Expired", count: expired, tone: "red" },
    { label: "0–7d", count: d0_7, tone: "orange" },
    { label: "8–30d", count: d8_30, tone: "amber" },
    { label: "31–90d", count: d31_90, tone: "blue" },
    { label: "90d+", count: d90plus, tone: "emerald" },
  ];
}

/** 0–100: expiry proximity + algorithm strength + key size + chain validity + auto-renew. */
export function healthScore(input: { daysLeft: number; signatureAlgorithm: string; keySize: number; chainValid: boolean; autoRenew: boolean; revoked: boolean }): number {
  if (input.revoked) return 0;
  let score = 0;
  if (input.daysLeft >= 90) score += 40;
  else if (input.daysLeft >= 30) score += 25;
  else if (input.daysLeft >= 7) score += 12;
  else if (input.daysLeft >= 0) score += 3;
  else score += 0;
  const sig = input.signatureAlgorithm.toLowerCase();
  score += sig.includes("sha256") || sig.includes("sha384") || sig.includes("sha512") ? 20 : 0;
  score += input.keySize >= 2048 ? 20 : input.keySize >= 1024 ? 8 : 0;
  score += input.chainValid ? 10 : 0;
  score += input.autoRenew ? 10 : 0;
  return Math.max(0, Math.min(100, score));
}

export function formatValidity(issuedAt: string, expiresAt: string): string {
  const days = Math.round((Date.parse(expiresAt) - Date.parse(issuedAt)) / 86_400_000);
  if (days >= 365) return `${Math.round(days / 365)}y validity`;
  if (days >= 30) return `${Math.round(days / 30)}mo validity`;
  return `${days}d validity`;
}

export function groupByIssuer(certs: Array<{ issuer: string }>): Array<{ issuer: string; count: number }> {
  const counts = new Map<string, number>();
  for (const cert of certs) counts.set(cert.issuer, (counts.get(cert.issuer) ?? 0) + 1);
  return [...counts.entries()].map(([issuer, count]) => ({ issuer, count })).sort((a, b) => b.count - a.count);
}
