"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BellOff, FileDown, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/shared/panel";
import { AlertBulkBar } from "@/components/alerts/alert-bulk-bar";
import { AlertDrawer } from "@/components/alerts/alert-drawer";
import { AlertMenu, type AlertMenuItem } from "@/components/alerts/alert-menu";
import { AlertsFilters } from "@/components/alerts/alerts-filters";
import { AlertsKpiRow } from "@/components/alerts/alerts-kpi-row";
import { AlertsTable } from "@/components/alerts/alerts-table";
import { AlertsTrendCard } from "@/components/alerts/alerts-trend-card";
import { NoisyRulesCard } from "@/components/alerts/noisy-rules-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Alert, AlertSeverity, AlertStatus } from "@/mocks/alerts";
import { DEFAULT_ALERTS_FILTERS, useAlerts, type AlertRangeKey } from "@/mocks/useAlerts";import { alertDuration, deriveAlertStats, formatDateTime, type AlertKpiKey, type AlertTabKey } from "@/utils/alertStats";
import { cn } from "@/lib/utils";

const TAB_ORDER: AlertTabKey[] = ["all", "firing", "acknowledged", "resolved", "silenced"];
const TAB_LABELS: Record<AlertTabKey, string> = { all: "All", firing: "Firing", acknowledged: "Acknowledged", resolved: "Resolved", silenced: "Silenced" };

function isAlertStatus(value: string | null): value is AlertStatus {
  return value === "firing" || value === "acknowledged" || value === "silenced" || value === "resolved";
}

function isRange(value: string | null): value is AlertRangeKey {
  return value === "1h" || value === "6h" || value === "24h" || value === "7d";
}

/** Operations > Alerts — KPIs, 24h trend, noisy rules, filterable table, detail drawer. */
export function AlertsDashboard() {
  const [filters, setFilters] = useState(DEFAULT_ALERTS_FILTERS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const didInitURL = useRef(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  }, []);

  const { alerts, allAlerts, status, reload, acknowledge, resolve, assign, silence, addNote } = useAlerts(filters);
  const isLoading = status === "loading";
  const isError = status === "error";

  const stats = useMemo(() => deriveAlertStats(allAlerts), [allAlerts]);
  const drawerAlert = useMemo(() => allAlerts.find((alert) => alert.id === drawerId) ?? null, [allAlerts, drawerId]);

  /* URL params sync (?status=&severity=&host=&q=&range=&alert=) */
  useEffect(() => {
    if (didInitURL.current) return;
    didInitURL.current = true;
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get("status");
    const severityParam = params.get("severity");
    const hostParam = params.get("host");
    const queryParam = params.get("q");
    const ruleParam = params.get("rule");
    const rangeParam = params.get("range");
    setFilters({
      status: isAlertStatus(statusParam) ? statusParam : "all",
      severity: (severityParam ?? "").split(",").filter((value): value is AlertSeverity => value === "critical" || value === "warning" || value === "info"),
      host: hostParam ?? "all",
      query: ruleParam ?? queryParam ?? "",
      range: isRange(rangeParam) ? rangeParam : "7d",
    });
    const alertParam = params.get("alert");
    if (alertParam) setDrawerId(alertParam);
  }, []);

  useEffect(() => {
    if (!didInitURL.current) return;
    const params = new URLSearchParams();
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.severity.length > 0) params.set("severity", filters.severity.join(","));
    if (filters.host !== "all") params.set("host", filters.host);
    if (filters.query) params.set("q", filters.query);
    if (filters.range !== "7d") params.set("range", filters.range);
    if (drawerId) params.set("alert", drawerId);
    const qs = params.toString();
    if (typeof window !== "undefined") window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [filters, drawerId]);

  const setFilter = <K extends keyof typeof DEFAULT_ALERTS_FILTERS>(key: K, value: (typeof DEFAULT_ALERTS_FILTERS)[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleKpiClick = (key: AlertKpiKey) => {
    if (key === "active") setFilter("status", "all");
    else if (key === "critical") setFilters((current) => ({ ...current, status: "all", severity: ["critical"] }));
    else if (key === "warning") setFilters((current) => ({ ...current, status: "all", severity: ["warning"] }));
    else if (key === "unacknowledged") setFilter("status", "firing");
    else if (key === "mtta") setFilter("status", "acknowledged");
    else setFilter("status", "resolved");
  };

  const copyLink = useCallback((alert: Alert) => {
    const url = `${window.location.origin}${window.location.pathname}?alert=${alert.id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => notify(`Link copied for ${alert.id}.`),
        () => notify(url),
      );
    } else notify(url);
  }, [notify]);

  const exportFile = (kind: "csv" | "json") => {
    const rows = alerts.map((alert) => ({
      id: alert.id, name: alert.name, severity: alert.severity, status: alert.status, host: alert.host, service: alert.service,
      triggeredAt: formatDateTime(alert.epochMs), duration: alertDuration(alert, Date.now()), assignee: alert.assignee ?? "",
    }));
    let blob: Blob;
    let filename: string;
    if (kind === "json") {
      blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" });
      filename = "alerts-export.json";
    } else {
      const header = Object.keys(rows[0] ?? { id: "" });
      const csv = [header, ...rows.map((row) => header.map((key) => `"${String((row as Record<string, unknown>)[key]).replaceAll("\"", "\"\"")}"`).join(","))].join("\r\n");
      blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      filename = "alerts-export.csv";
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    notify(`${kind.toUpperCase()} exported (${alerts.length} alerts).`);
  };

  const exportItems: AlertMenuItem[] = [
    { key: "csv", label: "Export CSV", onSelect: () => exportFile("csv") },
    { key: "json", label: "Export JSON", onSelect: () => exportFile("json") },
  ];

  const runBulk = (action: (ids: string[]) => void, ids: string[], message: string) => {
    if (ids.length === 0) return;
    action(ids);
    setSelectedIds([]);
    notify(message);
  };

  const tableActions = {
    onAcknowledge: (ids: string[]) => { acknowledge(ids); notify(ids.length === 1 ? `Alert ${ids[0]} acknowledged.` : `${ids.length} alerts acknowledged.`); },
    onResolve: (ids: string[]) => { resolve(ids); notify(ids.length === 1 ? `Alert ${ids[0]} resolved.` : `${ids.length} alerts resolved.`); },
    onAssign: (ids: string[], user: string | null) => { assign(ids, user); notify(user ? `Assigned ${user} → ${ids.length === 1 ? ids[0] : `${ids.length} alerts`}.` : `Assignee removed.`); },
    onSilence: (ids: string[], hours: number) => { silence(ids, hours); notify(`Silenced ${ids.length === 1 ? ids[0] : `${ids.length} alerts`} for ${hours}h.`); },
    onCreateRule: (alert: Alert) => notify(`Alert rule draft created from "${alert.ruleName}" (demo).`),
    onCopyLink: copyLink,
  };

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  if (isError) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader
          breadcrumbs={["Operations", "Alerts"]}
          title="Alerts"
          subtitle="Active alerts with routing, acknowledgement and escalation"
        />
        <section role="alert" className="grid min-h-[20rem] place-items-center rounded-xl border border-border bg-card p-6 text-center">
          <div className="flex max-w-md flex-col items-center gap-2">
            <p className="font-display text-base font-bold text-foreground">Alerts could not be loaded</p>
            <p className="text-sm text-muted-foreground">The alert service failed for the requested window. Retry to reload it.</p>
            <Button onClick={reload} ><RotateCcw size={15} />Retry</Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Operations", "Alerts"]}
        title="Alerts"
        subtitle="Active alerts with routing, acknowledgement and escalation"
        onRefresh={reload}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={selectedIds.length === 0}
              onClick={() => runBulk((ids) => silence(ids, 4), selectedIds, `Silenced ${selectedIds.length} ${selectedIds.length === 1 ? "alert" : "alerts"} for 4h.`)}
            >
              <BellOff size={15} aria-hidden="true" />Silence
            </Button>
            <AlertMenu
              label="Export alerts"
              submenuAlign="left"
              trigger={
                <Button variant="outline" >
                  <FileDown size={15} aria-hidden="true" />Export
                </Button>
              }
              items={exportItems}
            />
            <Link
              href="/alert-rules"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Plus size={15} aria-hidden="true" />Create Alert Rule
            </Link>
          </div>
        }
      />

      {isLoading ? (
        <>
          <section aria-busy="true" aria-label="Loading alert KPIs" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[6.5rem] animate-pulse rounded-xl bg-muted" />)}
          </section>
          <section aria-busy="true" className="grid items-stretch gap-4 xl:grid-cols-3">
            <div className="h-[20.625rem] animate-pulse rounded-xl bg-muted xl:col-span-2" />
            <div className="h-[20.625rem] animate-pulse rounded-xl bg-muted" />
          </section>
          <div className="h-[32.5rem] animate-pulse rounded-xl bg-muted" />
        </>
      ) : (
        <>
          <AlertsKpiRow stats={stats} onKpiClick={handleKpiClick} />

          <section className="grid items-stretch gap-4 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <AlertsTrendCard trend={stats.trend} total24h={stats.trend.reduce((sum, bucket) => sum + bucket.total, 0)} />
            </div>
            <div className="min-w-0">
              <NoisyRulesCard rules={stats.noisyRules} onRuleClick={(ruleName) => setFilter("query", ruleName)} />
            </div>
          </section>

          <Panel
            title="Alerts"
            className="flex min-w-0 flex-col rounded-xl p-5"
            titleClassName="text-[1rem] font-semibold"
            headerClassName="h-10"
            showOptions
            action={
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.75rem] font-semibold text-muted-foreground">
                <SlidersHorizontal size={11} aria-hidden="true" />
                {alerts.length} {alerts.length === 1 ? "alert" : "alerts"}
              </span>
            }
          >
            <Tabs value={filters.status} onValueChange={(value) => setFilter("status", value as AlertStatus | "all")}>
              <TabsList className="flex-wrap gap-x-4" aria-label="Filter alerts by status">
                {TAB_ORDER.map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="gap-1.5 text-[0.8125rem]">
                    {TAB_LABELS[tab]}
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold tabular-nums", filters.status === tab ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      {stats.tabCounts[tab]}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="mt-4">
              <AlertsFilters
                query={filters.query}
                onQueryChange={(query) => setFilter("query", query)}
                severity={filters.severity}
                onSeverityChange={(severity) => setFilter("severity", severity)}
                host={filters.host}
                hosts={stats.hosts}
                onHostChange={(host) => setFilter("host", host)}
                range={filters.range}
                onRangeChange={(range) => setFilter("range", range)}
                resultCount={alerts.length}
              />
            </div>

            {selectedIds.length > 0 && (
              <div className="mt-4">
                <AlertBulkBar
                  count={selectedIds.length}
                  onAcknowledge={() => runBulk(acknowledge, selectedIds, `${selectedIds.length} ${selectedIds.length === 1 ? "alert" : "alerts"} acknowledged.`)}
                  onAssign={(user) => {
                    const target = user === "" ? null : user;
                    assign(selectedIds, target);
                    notify(target ? `Assigned ${target} → ${selectedIds.length} ${selectedIds.length === 1 ? "alert" : "alerts"}.` : "Assignee removed.");
                  }}
                  onSilence={(hours) => runBulk((ids) => silence(ids, hours), selectedIds, `Silenced ${selectedIds.length} ${selectedIds.length === 1 ? "alert" : "alerts"} for ${hours}h.`)}
                  onResolve={() => runBulk(resolve, selectedIds, `${selectedIds.length} ${selectedIds.length === 1 ? "alert" : "alerts"} resolved.`)}
                  onClear={clearSelection}
                />
              </div>
            )}

            <div className="mt-4">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
                    <BellOff size={20} />
                  </span>
                  <p className="font-display text-[0.9375rem] font-bold text-foreground">No alerts match your filters</p>
                  <p className="text-[0.8125rem] text-muted-foreground">Try widening the time range or clearing filters.</p>
                  <Button variant="outline" onClick={() => setFilters(DEFAULT_ALERTS_FILTERS)} className="mt-1">
                    Clear filters
                  </Button>
                </div>
              ) : (
                <AlertsTable
                  alerts={alerts}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  onOpenDrawer={(alert) => setDrawerId(alert.id)}
                  {...tableActions}
                />
              )}
            </div>
          </Panel>
        </>
      )}

      <AlertDrawer
        alert={drawerAlert}
        onClose={() => setDrawerId(null)}
        onAcknowledge={(id) => { acknowledge([id]); notify(`Alert ${id} acknowledged.`); }}
        onAssign={(id, user) => { assign([id], user); notify(user ? `Assigned ${user} → ${id}.` : `Assignee removed from ${id}.`); }}
        onResolve={(id) => { resolve([id]); notify(`Alert ${id} resolved.`); }}
        onAddNote={(id, text) => { addNote(id, text); notify(`Note added to ${id}.`); }}
        onCopyLink={copyLink}
      />

      {toast && <div role="status" className="fixed bottom-4 right-4 z-[1300] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg">{toast}</div>}
    </div>
  );
}
