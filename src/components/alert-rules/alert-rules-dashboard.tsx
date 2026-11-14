"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellOff, FileDown, Plus, RotateCcw, SlidersHorizontal, Upload } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/shared/panel";
import { RulesKpiRow, type RuleKpiKey } from "@/components/alert-rules/rules-kpi-row";
import { RulesFilterPanel } from "@/components/alert-rules/rules-filter-panel";
import { RulesTable, type RulesTableColumns, type RulesTableDensity } from "@/components/alert-rules/rules-table";
import { RuleBulkBar } from "@/components/alert-rules/rule-bulk-bar";
import { RuleEditorDrawer, type RuleEditorDraft, type RuleEditorState } from "@/components/alert-rules/rule-editor-drawer";
import { RuleDetailDrawer } from "@/components/alert-rules/rule-detail-drawer";
import { AlertMenu, type AlertMenuItem } from "@/components/alerts/alert-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GROUP_TYPE, HOST_TYPE, type AlertRule, type RuleSeverity, type RuleStatus, type RuleType, type TargetType } from "@/mocks/alertRules";
import { DEFAULT_RULE_FILTERS, useAlertRules, type RuleTypeFilter } from "@/hooks/useAlertRules";
import { deriveRuleStats } from "@/utils/ruleStats";
import { formatCondition } from "@/utils/formatCondition";
import type { RuleTabKey } from "@/utils/ruleStats";

function isRuleSeverity(value: string): value is RuleSeverity {
  return value === "Critical" || value === "Warning" || value === "Info";
}

function isRuleType(value: string): value is RuleType {
  return value === "Threshold" || value === "Anomaly" || value === "Composite";
}

function isRuleStatus(value: string): value is RuleStatus {
  return value === "Enabled" || value === "Muted" || value === "Disabled";
}

function isTargetType(value: string): value is TargetType {
  return ["API", "Web", "Database", "VM", "Cache", "Network"].includes(value);
}

const csv = (value: string | null) => (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);

/** Operations > Alert Rules - KPIs, filterable/sortable/paginated table, editor + detail drawers. */
export function AlertRulesDashboard() {
  const router = useRouter();
  const [filters, setFilters] = useState(DEFAULT_RULE_FILTERS);
  const [visibleColumns, setVisibleColumns] = useState<RulesTableColumns>({ type: true, notifications: true, activity: true });
  const [density, setDensity] = useState<RulesTableDensity>("comfortable");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<RuleEditorState>(null);
  const [deleteTargets, setDeleteTargets] = useState<AlertRule[]>([]);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const didInitURL = useRef(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  }, []);

  const { rules, allRules, status, reload, toggleRule, setRulesEnabled, muteRules, unmuteRule, deleteRules, duplicateRule, createRule, updateRule } = useAlertRules(filters);
  const isLoading = status === "loading";
  const isError = status === "error";

  const stats = useMemo(() => deriveRuleStats(allRules), [allRules]);
  const detailRule = useMemo(() => allRules.find((rule) => rule.id === detailId) ?? null, [allRules, detailId]);

  /* URL params sync (?q=&type=&severity=&status=&target=&fired=&rule=) */
  useEffect(() => {
    if (didInitURL.current) return;
    didInitURL.current = true;
    const params = new URLSearchParams(window.location.search);
    const typeParam = params.get("type");
    const firedParam = params.get("fired");
    setFilters({
      query: params.get("q") ?? "",
      severity: csv(params.get("severity")).filter(isRuleSeverity),
      type: typeParam && isRuleType(typeParam) ? typeParam : "all",
      statusSelection: csv(params.get("status")).filter(isRuleStatus),
      targetTypes: csv(params.get("target")).filter(isTargetType),
      firedOnly: firedParam === "1",
    });
    const ruleParam = params.get("rule");
    if (ruleParam) setDetailId(ruleParam);
  }, []);

  useEffect(() => {
    if (!didInitURL.current) return;
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.type !== "all") params.set("type", filters.type);
    if (filters.severity.length > 0) params.set("severity", filters.severity.join(","));
    if (filters.statusSelection.length > 0) params.set("status", filters.statusSelection.join(","));
    if (filters.targetTypes.length > 0) params.set("target", filters.targetTypes.join(","));
    if (filters.firedOnly) params.set("fired", "1");
    if (detailId) params.set("rule", detailId);
    const qs = params.toString();
    if (typeof window !== "undefined") window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [filters, detailId]);

  const setFilter = <K extends keyof typeof DEFAULT_RULE_FILTERS>(key: K, value: (typeof DEFAULT_RULE_FILTERS)[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const kpiActive: RuleKpiKey = filters.firedOnly
    ? "fired"
    : filters.statusSelection.length === 1 && filters.statusSelection[0] === "Enabled"
      ? "enabled"
      : filters.statusSelection.length === 2 && filters.statusSelection.includes("Muted") && filters.statusSelection.includes("Disabled")
        ? "disabled"
        : "all";

  const handleKpiClick = (key: RuleKpiKey) => {
    if (key === "all") setFilters((current) => ({ ...current, type: "all", statusSelection: [], firedOnly: false }));
    else if (key === "enabled") setFilters((current) => ({ ...current, statusSelection: ["Enabled"], firedOnly: false }));
    else if (key === "disabled") setFilters((current) => ({ ...current, statusSelection: ["Muted", "Disabled"], firedOnly: false }));
    else setFilters((current) => ({ ...current, firedOnly: !current.firedOnly }));
  };

  const copyRuleLink = useCallback((rule: AlertRule) => {
    const url = `${window.location.origin}${window.location.pathname}?rule=${rule.id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => notify(`Link copied for ${rule.id}.`),
        () => notify(url),
      );
    } else notify(url);
  }, [notify]);

  const exportFile = (kind: "csv" | "json") => {
    const rows = rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      type: rule.type,
      severity: rule.severity,
      status: rule.status,
      target: rule.target,
      targetType: rule.targetType,
      condition: formatCondition(rule.condition),
      fired24h: rule.fired24h,
      channels: rule.notifications.channels.join("|"),
    }));
    let blob: Blob;
    let filename: string;
    if (kind === "json") {
      blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" });
      filename = "alert-rules-export.json";
    } else {
      const header = Object.keys(rows[0] ?? { id: "" });
      const csvText = [header, ...rows.map((row) => header.map((key) => `"${String((row as Record<string, unknown>)[key]).replaceAll("\"", "\"\"")}"`).join(","))].join("\r\n");
      blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
      filename = "alert-rules-export.csv";
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    notify(`${kind.toUpperCase()} exported (${rules.length} rules).`);
  };

  const exportItems: AlertMenuItem[] = [
    { key: "csv", label: "Export CSV", onSelect: () => exportFile("csv") },
    { key: "json", label: "Export JSON", onSelect: () => exportFile("json") },
  ];

  const selectedRules = useMemo(() => allRules.filter((rule) => selectedIds.includes(rule.id)), [allRules, selectedIds]);

  const runBulk = (action: (ids: string[]) => void, message: string) => {
    if (selectedIds.length === 0) return;
    action(selectedIds);
    setSelectedIds([]);
    notify(message);
  };

  const applyEditorSave = (draft: RuleEditorDraft, enable: boolean) => {
    const targetType = GROUP_TYPE[draft.target] ?? HOST_TYPE[draft.target] ?? "VM";
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      severity: draft.severity,
      type: draft.type,
      condition: draft.condition,
      target: draft.target,
      targetType,
      notifications: draft.notifications,
      tags: draft.tags,
      environment: draft.environment,
      exclude: draft.exclude,
    };
    if (editorState?.mode === "edit") {
      const id = editorState.rule.id;
      updateRule(id, enable ? { ...payload, status: "Enabled", mutedUntil: null } : payload);
      notify(enable ? `Rule ${id} saved and enabled.` : `Rule ${id} saved.`);
    } else {
      const id = createRule(payload, enable);
      notify(enable ? `Rule ${id} created and enabled.` : `Rule ${id} created (disabled).`);
    }
    setEditorState(null);
  };

  const tableActions = {
    onToggle: (rule: AlertRule) => {
      toggleRule(rule.id);
      notify(`${rule.name} ${rule.status === "Enabled" ? "disabled" : "enabled"}.`);
    },
    onEdit: (rule: AlertRule) => setEditorState({ mode: "edit", rule }),
    onDuplicate: (rule: AlertRule) => {
      const duplicateId = duplicateRule(rule.id);
      notify(duplicateId ? `Duplicated as ${duplicateId} (disabled).` : `Could not duplicate ${rule.id}.`);
    },
    onMute: (ids: string[], hours: number) => { muteRules(ids, hours); notify(`Muted ${ids.length === 1 ? ids[0] : `${ids.length} rules`} for ${hours}h.`); },
    onUnmute: (rule: AlertRule) => { unmuteRule(rule.id); notify(`${rule.name} unmuted.`); },
    onDelete: (rule: AlertRule) => setDeleteTargets([rule]),
    onViewAlerts: (rule: AlertRule) => router.push(`/alerts?rule=${rule.id}`),
    onOpenDetail: (rule: AlertRule) => setDetailId(rule.id),
  };

  const confirmDelete = () => {
    const ids = deleteTargets.map((rule) => rule.id);
    deleteRules(ids);
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTargets([]);
    notify(ids.length === 1 ? `Rule ${ids[0]} deleted.` : `${ids.length} rules deleted.`);
  };

  if (isError) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader
          breadcrumbs={["Operations", "Alert Rules"]}
          title="Alert Rules"
          subtitle="Threshold, anomaly and composite rules with notification policies"
        />
        <section role="alert" className="grid min-h-[20rem] place-items-center rounded-xl border border-border bg-card p-6 text-center">
          <div className="flex max-w-md flex-col items-center gap-2">
            <p className="font-display text-base font-bold text-foreground">Alert rules could not be loaded</p>
            <p className="text-sm text-muted-foreground">The rules service failed for this request. Retry to reload it.</p>
            <Button onClick={reload} ><RotateCcw size={15} />Retry</Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Operations", "Alert Rules"]}
        title="Alert Rules"
        subtitle="Threshold, anomaly and composite rules with notification policies"
        onRefresh={reload}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => notify("Import is not wired in this demo. Upload a CSV/JSON export of rules.")} >
              <Upload size={15} aria-hidden="true" />Import
            </Button>
            <AlertMenu
              label="Export rules"
              submenuAlign="left"
              trigger={
                <Button variant="outline" >
                  <FileDown size={15} aria-hidden="true" />Export
                </Button>
              }
              items={exportItems}
            />
            <Button onClick={() => setEditorState({ mode: "create" })} >
              <Plus size={15} aria-hidden="true" />Create Rule
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <>
          <section aria-busy="true" aria-label="Loading rule KPIs" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-[5.5rem] animate-pulse rounded-xl bg-muted" />)}
          </section>
          <div className="h-[7.5rem] animate-pulse rounded-xl bg-muted" />
          <div className="h-[32.5rem] animate-pulse rounded-xl bg-muted" />
        </>
      ) : (
        <>
          <RulesKpiRow stats={stats} active={kpiActive} onSelect={handleKpiClick} />

          <Panel
            title="Rules"
            className="flex min-w-0 flex-col rounded-xl p-5"
            titleClassName="text-[1rem] font-semibold"
            headerClassName="h-10"
            showOptions
            action={
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.75rem] font-semibold text-muted-foreground">
                <SlidersHorizontal size={11} aria-hidden="true" />
                {rules.length} {rules.length === 1 ? "rule" : "rules"}
              </span>
            }
          >
            <RulesFilterPanel
              tab={filters.type.toLowerCase() as RuleTabKey}
              onTabChange={(tab) => setFilter("type", (tab === "all" ? "all" : (tab.charAt(0).toUpperCase() + tab.slice(1))) as RuleTypeFilter)}
              tabCounts={stats.tabCounts}
              query={filters.query}
              onQueryChange={(query) => setFilter("query", query)}
              severity={filters.severity}
              onSeverityChange={(severity) => setFilter("severity", severity)}
              statusSelection={filters.statusSelection}
              onStatusChange={(statusSelection) => setFilter("statusSelection", statusSelection)}
              targetTypes={filters.targetTypes}
              onTargetTypeChange={(targetTypes) => setFilter("targetTypes", targetTypes)}
              firedOnly={filters.firedOnly}
              onFiredOnlyChange={(firedOnly) => setFilter("firedOnly", firedOnly)}
              columns={visibleColumns}
              onColumnsChange={setVisibleColumns}
              density={density}
              onDensityChange={setDensity}
              onClearAll={() => setFilters(DEFAULT_RULE_FILTERS)}
            />

            {selectedIds.length > 0 && (
              <div className="mt-4">
                <RuleBulkBar
                  count={selectedIds.length}
                  onEnable={() => runBulk((ids) => setRulesEnabled(ids, true), `${selectedIds.length} ${selectedIds.length === 1 ? "rule" : "rules"} enabled.`)}
                  onDisable={() => runBulk((ids) => setRulesEnabled(ids, false), `${selectedIds.length} ${selectedIds.length === 1 ? "rule" : "rules"} disabled.`)}
                  onMute={(hours) => runBulk((ids) => muteRules(ids, hours), `Muted ${selectedIds.length} ${selectedIds.length === 1 ? "rule" : "rules"} for ${hours}h.`)}
                  onDelete={() => setDeleteTargets(selectedRules)}
                  onClear={() => setSelectedIds([])}
                />
              </div>
            )}

            <div className="mt-4">
              {rules.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
                    <BellOff size={20} />
                  </span>
                  <p className="font-display text-[0.9375rem] font-bold text-foreground">No rules match your filters</p>
                  <p className="text-[0.8125rem] text-muted-foreground">Try widening the filters or clearing them.</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Button variant="outline" onClick={() => setFilters(DEFAULT_RULE_FILTERS)} >
                      Clear filters
                    </Button>
                    <Button onClick={() => setEditorState({ mode: "create" })} >
                      <Plus size={14} aria-hidden="true" />Create Rule
                    </Button>
                  </div>
                </div>
              ) : (
                <RulesTable
                  rules={rules}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  columns={visibleColumns}
                  density={density}
                  {...tableActions}
                />
              )}
            </div>
          </Panel>
        </>
      )}

      <RuleEditorDrawer state={editorState} onSave={applyEditorSave} onClose={() => setEditorState(null)} />
      <RuleDetailDrawer
        rule={detailRule}
        onClose={() => setDetailId(null)}
        onEdit={(rule) => { setEditorState({ mode: "edit", rule }); }}
        onToggle={(rule) => { toggleRule(rule.id); notify(`${rule.name} ${rule.status === "Enabled" ? "disabled" : "enabled"}.`); }}
        onCopyLink={copyRuleLink}
      />

      {/* Delete confirm */}
      <Dialog open={deleteTargets.length > 0} onOpenChange={(open) => { if (!open) setDeleteTargets([]); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteTargets.length === 1 ? `Delete rule ${deleteTargets[0]?.id}?` : `Delete ${deleteTargets.length} rules?`}</DialogTitle>
            <DialogDescription>
              {deleteTargets.length === 1
                ? `"${deleteTargets[0]?.name}" will be removed. This cannot be undone from this demo.`
                : "The selected rules will be removed. This cannot be undone from this demo."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargets([])} >Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} >Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && <div role="status" className="fixed bottom-4 right-4 z-[1300] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg">{toast}</div>}
    </div>
  );
}
