"use client";

import { Panel } from "@/components/shared/panel";
import { cn } from "@/lib/utils";
import type { AlertStats } from "@/utils/alertStats";

interface NoisyRulesCardProps {
  rules: AlertStats["noisyRules"];
  /** Clicking a rule filters the table to it. */
  onRuleClick: (ruleName: string) => void;
}

const SEVERITY_BAR: Record<string, string> = { critical: "#DC2626", warning: "#D97706", info: "#3B82F6" };

/** Top 5 noisiest rules in the last 24h: name, thin bar, count. */
export function NoisyRulesCard({ rules, onRuleClick }: NoisyRulesCardProps) {
  const max = Math.max(1, ...rules.map((rule) => rule.count));
  return (
    <Panel
      title="Top Noisy Rules"
      className="flex h-full min-w-0 flex-col rounded-xl p-5"
      titleClassName="text-[1rem] font-semibold"
      headerClassName="h-10"
      showOptions
      action={<span className="text-[0.75rem] text-muted-foreground">Last 24h</span>}
    >
      {rules.length === 0 ? (
        <p className="mt-auto mb-auto text-center text-[0.8125rem] text-muted-foreground">No alerts triggered in the last 24h.</p>
      ) : (
        <ul className="flex flex-col gap-3.5 py-1" aria-label="Top noisy alert rules">
          {rules.map((rule) => (
            <li key={rule.ruleId}>
              <button
                type="button"
                onClick={() => onRuleClick(rule.name)}
                className="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                aria-label={`Filter alerts by rule ${rule.name} (${rule.count} alerts)`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[0.8125rem] font-medium text-foreground group-hover:underline">{rule.name}</span>
                  <span className="shrink-0 text-[0.75rem] font-semibold tabular-nums text-muted-foreground">{rule.count}</span>
                </span>
                <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <span
                    aria-hidden="true"
                    className={cn("block h-full rounded-full")}
                    style={{ width: `${Math.max(6, (rule.count / max) * 100)}%`, background: SEVERITY_BAR[rule.severity] }}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto border-t border-border pt-2 text-[0.75rem] text-muted-foreground">Alerts triggered per rule · click to filter</p>
    </Panel>
  );
}
