/**
 * RPO calculation helpers. RPO for a job = now - last successful backup.
 * Pure functions - no store access.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;

export interface RpoAssessment {
  /** Minutes since the last successful run; null when the job never succeeded or is paused. */
  lagMinutes: number | null;
  /** true/false vs target; null when not assessable (paused / never succeeded handled by caller via lagMinutes === null). */
  met: boolean | null;
}

/** now - last successful run, in whole minutes. null when never. */
export function rpoLagMinutes(lastSuccessMs: number | null, nowMs = Date.now()): number | null {
  if (lastSuccessMs == null) return null;
  return Math.max(0, Math.floor((nowMs - lastSuccessMs) / MIN));
}

export function assessRpo(lastSuccessMs: number | null, targetMinutes: number, nowMs = Date.now()): RpoAssessment {
  const lag = rpoLagMinutes(lastSuccessMs, nowMs);
  if (lag == null) return { lagMinutes: null, met: false };
  return { lagMinutes: lag, met: lag <= targetMinutes };
}

/** "45m" / "6h 12m" / "2d 4h". */
export function formatLag(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

/** "37h / 4h" style compact cell text. */
export function formatRpoCell(lagMinutes: number | null, targetMinutes: number): string {
  const target = targetMinutes >= 60 && targetMinutes % 60 === 0 ? `${Math.floor(targetMinutes / 60)}h` : `${targetMinutes}m`;
  return `${formatLag(lagMinutes)} / ${target}`;
}

/** Aggregate a tier: jobs meeting their target / total assessable. */
export function tierCompliance(assessments: Array<{ met: boolean | null }>): { met: number; total: number; pct: number | null } {
  const assessable = assessments.filter((entry) => entry.met !== null);
  const met = assessable.filter((entry) => entry.met === true).length;
  const total = assessable.length;
  return { met, total, pct: total === 0 ? null : Math.round((met / total) * 100) };
}
