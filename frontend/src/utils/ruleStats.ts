import type { AlertRule } from "@/mocks/alertRules";
import { timeAgo } from "@/mocks/logs";

export type RuleTabKey = "all" | "threshold" | "anomaly" | "composite";

export interface RuleStats {
  total: number;
  enabled: number;
  muted: number;
  disabled: number;
  /** Muted + Disabled combined (KPI "Muted / Disabled" card). */
  mutedOrDisabled: number;
  enabledPct: number;
  /** Sum of fireHistory buckets across every rule (disabled rules contribute zeros). */
  fired24h: number;
  /** 24 hourly buckets summed across all rules — sparkline for the Fired KPI. */
  fireSparkline: number[];
  tabCounts: Record<RuleTabKey, number>;
  /** Distinct hosts errored in the sample, for KPI hints. */
  targetCount: number;
}

export function deriveRuleStats(rules: AlertRule[]): RuleStats {
  const enabled = rules.filter((rule) => rule.status === "Enabled").length;
  const muted = rules.filter((rule) => rule.status === "Muted").length;
  const disabled = rules.filter((rule) => rule.status === "Disabled").length;
  const fired24h = rules.reduce((sum, rule) => sum + rule.fired24h, 0);
  const fireSparkline = new Array(24).fill(0) as number[];
  for (const rule of rules) {
    for (let i = 0; i < 24; i += 1) fireSparkline[i] += rule.fireHistory[i] ?? 0;
  }
  return {
    total: rules.length,
    enabled,
    muted,
    disabled,
    mutedOrDisabled: muted + disabled,
    enabledPct: rules.length === 0 ? 0 : Math.round((enabled / rules.length) * 100),
    fired24h,
    fireSparkline,
    tabCounts: {
      all: rules.length,
      threshold: rules.filter((rule) => rule.type === "Threshold").length,
      anomaly: rules.filter((rule) => rule.type === "Anomaly").length,
      composite: rules.filter((rule) => rule.type === "Composite").length,
    },
    targetCount: new Set(rules.map((rule) => rule.target)).size,
  };
}

/** "42m ago" / "12d ago" / "Never" — purana for stale, plus absolute title for tooltips. */
export function formatLastFired(rule: AlertRule): string {
  if (!rule.lastFiredAt) return "Never";
  return timeAgo(new Date(rule.lastFiredAt).getTime());
}
