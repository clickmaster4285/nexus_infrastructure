"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ALERT_RULE_LIST, type AlertRule, type RuleSeverity, type RuleStatus, type RuleType, type TargetType } from "@/mocks/alertRules";
import { formatCondition } from "@/utils/formatCondition";

export type RuleTypeFilter = "all" | RuleType;

export interface RuleFilters {
  query: string;
  /** Empty selection = all severities. */
  severity: RuleSeverity[];
  /** Quick type tab: "all" shows every rule type. */
  type: RuleTypeFilter;
  /** Multi-select checkbox dropdown; empty = all. */
  statusSelection: RuleStatus[];
  /** Multi-select checkbox dropdown; empty = all. */
  targetTypes: TargetType[];
  /** Show only rules that fired in the last 24h. */
  firedOnly: boolean;
}

export const DEFAULT_RULE_FILTERS: RuleFilters = { query: "", severity: [], type: "all", statusSelection: [], targetTypes: [], firedOnly: false };

export type RulesStatus = "loading" | "error" | "success";

export interface UseAlertRulesResult {
  /** Rules matching the filters, severity-first then name. */
  rules: AlertRule[];
  /** Unfiltered list — KPI and tab counts derive from this. */
  allRules: AlertRule[];
  status: RulesStatus;
  /** Re-runs the mock fetch (used by the error state's Retry button). */
  reload: () => void;
  toggleRule: (id: string) => void;
  setRulesEnabled: (ids: string[], enabled: boolean) => void;
  muteRules: (ids: string[], hours: number) => void;
  unmuteRule: (id: string) => void;
  deleteRules: (ids: string[]) => void;
  duplicateRule: (id: string) => string | null;
  /** Creates a rule from a partial draft; returns the new id. */
  createRule: (draft: Partial<AlertRule> & Pick<AlertRule, "name">, enable: boolean) => string;
  /** Applies a partial update to one rule. */
  updateRule: (id: string, patch: Partial<AlertRule>) => void;
}

function cloneRule(rule: AlertRule): AlertRule {
  return { ...rule, notifications: { ...rule.notifications, channels: [...rule.notifications.channels], recipients: [...rule.notifications.recipients] }, condition: { ...rule.condition }, fireHistory: [...rule.fireHistory], metric: [...rule.metric], recentFires: [...rule.recentFires], audit: [...rule.audit], tags: [...rule.tags] };
}

/**
 * Mock async fetch for Alert Rules with a 200-400ms delay and
 * loading/error/success states. Swap the body of `load` for a real
 * `fetch("/api/rules")` later — the signature stays the same. Mutations
 * update local mock state so the UI stays consistent.
 *
 * Error state is reachable via `?rulesError=1` in the URL (first attempt
 * fails, Retry succeeds) so it can be exercised without touching the network.
 */
export function useAlertRules(filters: RuleFilters): UseAlertRulesResult {
  const [allRules, setAllRules] = useState<AlertRule[]>([]);
  const [status, setStatus] = useState<RulesStatus>("loading");
  const attemptRef = useRef(0);

  const load = useCallback(() => {
    setStatus("loading");
    const attempt = attemptRef.current;
    attemptRef.current += 1;
    const delay = 200 + Math.random() * 200;
    const timer = window.setTimeout(() => {
      const forcedError = typeof window !== "undefined" && window.location.search.includes("rulesError=1");
      if (forcedError && attempt === 0) {
        setAllRules([]);
        setStatus("error");
        return;
      }
      setAllRules(ALERT_RULE_LIST.map(cloneRule));
      setStatus("success");
    }, delay);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => load(), [load]);

  const patchRules = useCallback((ids: string[], patch: (rule: AlertRule) => Partial<AlertRule>) => {
    setAllRules((current) => current.map((rule) => (ids.includes(rule.id) ? { ...rule, ...patch(rule) } : rule)));
  }, []);

  const toggleRule = useCallback((id: string) => {
    patchRules([id], (rule) => ({ status: rule.status === "Enabled" ? ("Disabled" as RuleStatus) : ("Enabled" as RuleStatus), mutedUntil: null }));
  }, [patchRules]);

  const setRulesEnabled = useCallback((ids: string[], enabled: boolean) => {
    patchRules(ids, () => ({ status: enabled ? ("Enabled" as RuleStatus) : ("Disabled" as RuleStatus), mutedUntil: null }));
  }, [patchRules]);

  const muteRules = useCallback((ids: string[], hours: number) => {
    patchRules(ids, () => ({ status: "Muted" as RuleStatus, mutedUntil: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() }));
  }, [patchRules]);

  const unmuteRule = useCallback((id: string) => {
    patchRules([id], () => ({ status: "Enabled" as RuleStatus, mutedUntil: null }));
  }, [patchRules]);

  const deleteRules = useCallback((ids: string[]) => {
    setAllRules((current) => current.filter((rule) => !ids.includes(rule.id)));
  }, []);

  const duplicateRule = useCallback((id: string): string | null => {
    let duplicateId: string | null = null;
    setAllRules((current) => {
      const source = current.find((rule) => rule.id === id);
      if (!source) return current;
      const maxNumber = current.reduce((max, rule) => Math.max(max, Number(rule.id.replace(/\D/g, "")) || 0), 0);
      duplicateId = `RUL-${maxNumber + 1}`;
      const copy: AlertRule = {
        ...cloneRule(source),
        id: duplicateId,
        name: `${source.name} (copy)`,
        status: "Disabled",
        mutedUntil: null,
        fired24h: 0,
        fireHistory: new Array(24).fill(0),
        recentFires: [],
        updatedBy: "you@nexus.io",
        updatedAt: new Date().toISOString(),
      };
      const index = current.findIndex((rule) => rule.id === id);
      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
    return duplicateId;
  }, []);

  const rules = useMemo(() => {
    const tokens = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
    const severityRank: Record<string, number> = { Critical: 0, Warning: 1, Info: 2 };
    return allRules
      .filter((rule) => {
        if (filters.type !== "all" && rule.type !== filters.type) return false;
        if (filters.statusSelection.length > 0 && !filters.statusSelection.includes(rule.status)) return false;
        if (filters.severity.length > 0 && !filters.severity.includes(rule.severity)) return false;
        if (filters.targetTypes.length > 0 && !filters.targetTypes.includes(rule.targetType)) return false;
        if (filters.firedOnly && rule.fired24h <= 0) return false;
        if (tokens.length > 0) {
          const conditionText = formatCondition(rule.condition);
          const haystack = `${rule.id} ${rule.name} ${rule.description} ${rule.target} ${rule.targetType} ${conditionText}`.toLowerCase();
          if (!tokens.every((token) => haystack.includes(token))) return false;
        }
        return true;
      })
      .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.name.localeCompare(b.name));
  }, [allRules, filters]);

  const nextRuleNumber = useCallback((current: AlertRule[]) => current.reduce((max, rule) => Math.max(max, Number(rule.id.replace(/\D/g, "")) || 0), 0) + 1, []);

  const createRule = useCallback((draft: Partial<AlertRule> & Pick<AlertRule, "name">, enable: boolean): string => {
    let createdId = "";
    setAllRules((current) => {
      createdId = `RUL-${nextRuleNumber(current)}`;
      const now = new Date();
      const rule: AlertRule = {
        id: createdId,
        name: draft.name.trim(),
        description: draft.description ?? "",
        type: draft.type ?? "Threshold",
        severity: draft.severity ?? "Warning",
        status: enable ? "Enabled" : "Disabled",
        target: draft.target ?? "api-server-01",
        targetType: draft.targetType ?? "API",
        condition: draft.condition ?? { metric: "CPU usage", operator: ">", value: 90, unit: "%", duration: "5m", evaluationInterval: "30s" },
        notifications: draft.notifications ?? { channels: ["Email"], recipients: ["on-call@nexus.io"], escalationMinutes: 30, repeatInterval: "1h", respectQuietHours: true },
        lastFiredAt: null,
        fired24h: 0,
        fireHistory: new Array(24).fill(0),
        metric: draft.metric ?? [],
        recentFires: [],
        audit: [{ id: `au-${Date.now()}`, at: now.toISOString(), epochMs: now.getTime(), actor: "you@nexus.io", action: "Rule created" }],
        updatedBy: "you@nexus.io",
        updatedAt: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        mutedUntil: null,
        tags: draft.tags ?? [],
      };
      return [rule, ...current];
    });
    return createdId;
  }, [nextRuleNumber]);

  const updateRule = useCallback((id: string, patch: Partial<AlertRule>) => {
    setAllRules((current) =>
      current.map((rule) => {
        if (rule.id !== id) return rule;
        const now = Date.now();
        const entry = { id: `au-${now}`, at: new Date(now).toISOString(), epochMs: now, actor: "you@nexus.io", action: "Rule edited" };
        return { ...rule, ...patch, audit: patch.audit ?? [entry, ...rule.audit] };
      }),
    );
  }, []);

  return { rules, allRules, status, reload: load, toggleRule, setRulesEnabled, muteRules, unmuteRule, deleteRules, duplicateRule, createRule, updateRule };
}
