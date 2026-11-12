import type { RuleCondition } from "@/mocks/alertRules";

/**
 * Renders a RuleCondition as display text, e.g.
 * { metric: "CPU usage", operator: ">", value: 90, unit: "%", duration: "5m" }
 * -> "CPU usage > 90% for 5m". Composite conditions join their children with the
 * configured boolean operator.
 */
export function formatCondition(condition: RuleCondition): string {
  if (condition.conditions && condition.conditions.length > 0) {
    const joined = condition.conditions.map(formatCondition).join(` ${condition.op ?? "AND"} `);
    return condition.duration ? `${joined} for ${condition.duration}` : joined;
  }
  const base = `${condition.metric} ${condition.operator} ${condition.value}${condition.unit}`;
  return condition.duration ? `${base} for ${condition.duration}` : base;
}
