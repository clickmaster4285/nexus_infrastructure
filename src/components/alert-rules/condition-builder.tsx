"use client";

import type { RuleCondition, RuleType } from "@/mocks/alertRules";
import { cn } from "@/lib/utils";

export const RULE_METRICS = [
  "CPU usage",
  "Memory usage",
  "Disk free",
  "Uptime",
  "API latency (p95)",
  "Error rate",
  "5xx rate",
  "Request rate",
  "Replication lag",
  "Queue depth",
  "DB connections",
  "Cache hit ratio",
  "Evictions",
  "IO wait",
  "Table bloat",
  "Job failures",
  "Failing checks",
  "SSL certificate expires in",
  "NotReady nodes",
  "Disk pressure",
  "Client rate",
] as const;

const OPERATORS = [">", "<", "="] as const;
const DURATIONS = ["1m", "5m", "10m", "15m", "30m", "60m"] as const;
const EVALUATION_INTERVALS = ["15s", "30s", "1m", "5m"] as const;

export interface ConditionErrors {
  metric?: string;
  value?: string;
  secondCondition?: string;
}

interface ConditionBuilderProps {
  type: RuleType;
  condition: RuleCondition;
  errors?: ConditionErrors;
  onChange: (next: RuleCondition) => void;
}

const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[0.8125rem] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

function Field({ label, htmlFor, error, children }: { label: string; htmlFor?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={htmlFor} className="text-[0.75rem] font-medium text-muted-foreground">{label}</label>
      {children}
      {error && <p role="alert" className="text-[0.6875rem] font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

interface SingleConditionFieldsProps {
  idPrefix: string;
  condition: RuleCondition;
  onChange: (next: RuleCondition) => void;
}

function SingleConditionFields({ idPrefix, condition, onChange }: SingleConditionFieldsProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_64px_minmax(0,1fr)_4rem] gap-2">
      <select
        aria-label="Metric"
        value={condition.metric}
        onChange={(event) => onChange({ ...condition, metric: event.target.value })}
        className={fieldClass}
      >
        {RULE_METRICS.map((metric) => (
          <option key={metric} value={metric}>{metric}</option>
        ))}
      </select>
      <select
        aria-label="Operator"
        value={condition.operator}
        onChange={(event) => onChange({ ...condition, operator: event.target.value as RuleCondition["operator"] })}
        className={fieldClass}
      >
        {OPERATORS.map((operator) => (
          <option key={operator} value={operator}>{operator}</option>
        ))}
      </select>
      <input
        type="number"
        aria-label="Threshold value"
        min={0}
        step="any"
        value={condition.value}
        onChange={(event) => onChange({ ...condition, value: event.target.value === "" ? 0 : Number(event.target.value) })}
        className={fieldClass}
      />
      <input
        type="text"
        aria-label="Unit"
        value={condition.unit}
        placeholder="unit"
        onChange={(event) => onChange({ ...condition, unit: event.target.value })}
        className={fieldClass}
      />
    </div>
  );
}

/**
 * Threshold / Anomaly: single condition row + duration + evaluation interval.
 * Composite: two condition rows joined by AND/OR, shared duration and interval.
 */
export function ConditionBuilder({ type, condition, errors, onChange }: ConditionBuilderProps) {
  const isComposite = type === "Composite";
  const children = isComposite
    ? condition.conditions && condition.conditions.length === 2
      ? condition.conditions
      : [
          { metric: condition.metric, operator: condition.operator, value: condition.value, unit: condition.unit },
          { metric: "API latency (p95)", operator: ">" as const, value: 2, unit: "s" },
        ]
    : null;

  const updateCompositeChild = (index: 0 | 1, next: RuleCondition) => {
    if (!children) return;
    const nextConditions = [...children] as [RuleCondition, RuleCondition];
    nextConditions[index] = next;
    onChange({ ...condition, metric: nextConditions[0].metric, conditions: nextConditions, op: condition.op ?? "AND" });
  };

  const joinOp = condition.op ?? "AND";

  return (
    <div className="grid gap-3">
      {isComposite && children ? (
        <>
          <div role="group" aria-label="Logical operator" className="inline-flex w-max items-center gap-1 rounded-lg border border-border p-0.5">
            {(["AND", "OR"] as const).map((op) => (
              <button
                key={op}
                type="button"
                aria-pressed={joinOp === op}
                onClick={() => onChange({ ...condition, op })}
                className={cn(
                  "h-7 rounded-md px-3 text-[0.75rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  joinOp === op ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {op}
              </button>
            ))}
          </div>
          {children.map((child, index) => (
            <fieldset key={index} className="grid gap-1.5 rounded-lg border border-border/80 p-2.5">
              <legend className="px-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Condition {index === 0 ? "A" : "B"}</legend>
              <SingleConditionFields idPrefix={`condition-${index}`} condition={child} onChange={(next) => updateCompositeChild(index as 0 | 1, next)} />
            </fieldset>
          ))}
          {errors?.secondCondition && <p role="alert" className="text-[0.6875rem] font-medium text-red-600 dark:text-red-400">{errors.secondCondition}</p>}
        </>
      ) : (
        <>
          <Field label={type === "Anomaly" ? "Metric (deviation from baseline)" : "Metric"} error={errors?.metric}>
            <SingleConditionFields idPrefix="condition" condition={condition} onChange={onChange} />
          </Field>
          {type === "Anomaly" && (
            <p className="text-[0.6875rem] leading-snug text-muted-foreground">Fires when the metric deviates more than the given amount (σ) from its rolling baseline.</p>
          )}
          {errors?.value && <p role="alert" className="text-[0.6875rem] font-medium text-red-600 dark:text-red-400">{errors.value}</p>}
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Duration" htmlFor="condition-duration">
          <select id="condition-duration" value={condition.duration ?? "none"} onChange={(event) => onChange({ ...condition, duration: event.target.value === "none" ? undefined : event.target.value })} className={fieldClass}>
            <option value="none">Point in time</option>
            {DURATIONS.map((duration) => (
              <option key={duration} value={duration}>for {duration}</option>
            ))}
          </select>
        </Field>
        <Field label="Evaluation interval" htmlFor="condition-interval">
          <select id="condition-interval" value={condition.evaluationInterval ?? "30s"} onChange={(event) => onChange({ ...condition, evaluationInterval: event.target.value })} className={fieldClass}>
            {EVALUATION_INTERVALS.map((interval) => (
              <option key={interval} value={interval}>every {interval}</option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}
