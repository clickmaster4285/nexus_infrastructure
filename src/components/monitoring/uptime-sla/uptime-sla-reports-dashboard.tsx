"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import {
  CalendarDays, ChevronDown, Download, FileText, FileSpreadsheet, RotateCcw, Search, CheckCircle2,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useUptimeSla } from "@/mocks/useUptimeSla";
import { SlaKpiCards, SlaStatusBadge } from "@/components/monitoring/uptime-sla/sla-kpi-cards";
import { UptimeTrendChart } from "@/components/monitoring/uptime-sla/uptime-trend-chart";
import { ErrorBudgetCard } from "@/components/monitoring/uptime-sla/error-budget-card";
import { UptimeCalendar } from "@/components/monitoring/uptime-sla/uptime-calendar";
import { ServiceUptimeTable } from "@/components/monitoring/uptime-sla/service-uptime-table";
import { DowntimeIncidentsTable } from "@/components/monitoring/uptime-sla/downtime-incidents-table";
import { SlaByType } from "@/components/monitoring/uptime-sla/sla-by-type";

const RANGE_OPTIONS = ["24h", "7d", "30d", "90d", "custom"] as const;
const VALID_TARGETS = [99.0, 99.5, 99.9, 99.95, 99.99] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number];
const RANGE_TEXT: Record<RangeKey, string> = { "24h": "Last 24 hours", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "custom": "Custom (30d)" };

function isValidTarget(value: number): value is 99.0 | 99.5 | 99.9 | 99.95 | 99.99 {
  return VALID_TARGETS.includes(value as (typeof VALID_TARGETS)[number]);
}

/** Uptime & SLA Reports — all figures derive from DOWNTIME_INCIDENTS. */
export function UptimeSlaReportsDashboard() {
  const [slaTarget, setSlaTarget] = useState<number>(99.9);
  const [range, setRange] = useState<RangeKey>("30d");
  const [serviceSearch, setServiceSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleFreq, setScheduleFreq] = useState("weekly");
  const [scheduleFormat, setScheduleFormat] = useState("pdf");
  const [scheduleRecipients, setScheduleRecipients] = useState("sre@nexus.io");
  const toastTimer = useRef<number | null>(null);
  const didInitURL = useRef(false);

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  };

  const { services, fleetDaily, incidents, summary, errorBudget, types, reload, status } = useUptimeSla(slaTarget);
  const isLoading = status === "loading";
  const isError = status === "error";

  /* URL params sync (?range=&target=&service=) */
  useEffect(() => {
    if (didInitURL.current) return;
    didInitURL.current = true;
    const params = new URLSearchParams(window.location.search);
    const r = params.get("range");
    if (r && (RANGE_OPTIONS as readonly string[]).includes(r)) setRange(r as RangeKey);
    const t = Number(params.get("target"));
    if (isValidTarget(t)) setSlaTarget(t); // invalid/missing/0 → keep default 99.9
    const service = params.get("service");
    if (service) setTypeFilter(service);
  }, []);

  useEffect(() => {
    if (!didInitURL.current) return;
    const params = new URLSearchParams();
    params.set("range", range);
    params.set("target", String(slaTarget));
    if (typeFilter !== "all") params.set("service", typeFilter);
    const qs = params.toString();
    if (typeof window !== "undefined") window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [range, slaTarget, typeFilter]);

  const visibleIncidents = useMemo(() => (selectedDay ? incidents.filter((incident) => incident.startedAt.startsWith(selectedDay)) : incidents), [incidents, selectedDay]);

  const exportFile = (kind: "pdf" | "csv") => {
    const rows = [
      ["Service", "Type", "Uptime", "Downtime", "Incidents", "SLA Target", "Status"],
      ...services.map((service) => [service.name, service.type, `${service.currentUptime.toFixed(2)}%`, `${Math.floor(service.downtimeSeconds / 60)}m ${service.downtimeSeconds % 60}s`, String(service.incidents), `${service.slaTarget.toFixed(2)}%`, service.currentUptime >= service.slaTarget ? "Met" : "Breached"]),
    ];
    const header = `Uptime & SLA Report — range ${range} target ${slaTarget}%`;
    if (kind === "csv") {
      const csv = [[header], ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `uptime-sla-report-${range}.csv`; a.click(); URL.revokeObjectURL(url);
      notify("CSV report downloaded.");
    } else {
      const body = [header, ...rows.map((row) => row.join(" · "))].join("\n");
      const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `uptime-sla-report-${range}.txt`; a.click(); URL.revokeObjectURL(url);
      notify("PDF report queued (demo action — downloaded as text).");
    }
  };

  if (isError) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Monitoring", "Uptime & SLA Reports"]} title="Uptime & SLA Reports" subtitle="SLA attainment, downtime and error budget across your infrastructure" demo />
        <section role="alert" className="grid min-h-[20rem] place-items-center rounded-xl border border-border bg-card p-6 text-center">
          <div className="flex max-w-md flex-col items-center gap-2">
            <p className="font-display text-base font-bold text-foreground">SLA data could not be loaded</p>
            <p className="text-sm text-muted-foreground">The report service failed for the requested window. Retry to reload it.</p>
            <Button onClick={reload} ><RotateCcw size={15} />Retry</Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Monitoring", "Uptime & SLA Reports"]}
        title="Uptime & SLA Reports"
        subtitle="SLA attainment, downtime and error budget across your infrastructure"
        onRefresh={reload}
        statusBadge={<SlaStatusBadge summary={summary} />}
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" onClick={() => exportFile("pdf")} ><FileText size={15} />PDF</Button>
              <Button variant="outline" onClick={() => exportFile("csv")} ><FileSpreadsheet size={15} />CSV</Button>
            </div>
            <Button onClick={() => setScheduleOpen(true)} ><CalendarDays size={15} />Schedule report</Button>
          </div>
        }
      />

      {/* Filter bar */}
      <section aria-label="Report filters" className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <div className="flex h-9 items-center rounded-lg border border-border p-0.5" role="group" aria-label="Time range">
          {RANGE_OPTIONS.map((option) => (
            <button key={option} type="button" aria-pressed={range === option} onClick={() => setRange(option)} className={cn("h-8 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", range === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>{option.toUpperCase()}</button>
          ))}
        </div>
        <Select value="all" onValueChange={() => notify("All services shown.")}>
          <SelectTrigger aria-label="Services" className="h-9 min-w-[8.75rem] rounded-lg text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            {services.map((service) => <SelectItem key={service.id} value={service.name}>{service.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger aria-label="Infrastructure type" className="h-9 min-w-[8.75rem] rounded-lg text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {["API", "Web", "Database", "VM", "Cache", "Network"].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(slaTarget)} onValueChange={(value) => { const parsed = Number(value); if (isValidTarget(parsed)) setSlaTarget(parsed); }}>
          <SelectTrigger aria-label="SLA target" className="h-9 min-w-[9.375rem] rounded-lg text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {VALID_TARGETS.map((target) => <SelectItem key={target} value={String(target)}>SLA {target}%</SelectItem>)}
          </SelectContent>
        </Select>
      </section>

      {isLoading ? (
        <section aria-busy="true" aria-label="Loading SLA report" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[6.5rem] animate-pulse rounded-xl bg-muted" />)}
        </section>
      ) : (
        <SlaKpiCards summary={summary} />
      )}

      {/* Uptime trend — full width */}
      <Panel title="Uptime Trend" className="flex min-w-0 flex-col rounded-xl p-5" titleClassName="text-[1rem] font-semibold" headerClassName="h-10" showOptions action={<span className="text-[0.75rem] text-muted-foreground">Target {slaTarget.toFixed(2)}% · {RANGE_TEXT[range]}</span>}>
        {isLoading ? <div className="h-[18.75rem] animate-pulse rounded-lg bg-muted" /> : <UptimeTrendChart daily={fleetDaily} target={slaTarget} />}
      </Panel>

      {/* Error budget + calendar */}
      <section className="grid items-stretch gap-4 xl:grid-cols-2">
        <Panel title="Error Budget" className="flex h-full min-w-0 flex-col rounded-xl p-5" titleClassName="text-[1rem] font-semibold" headerClassName="h-10" showOptions>
          {isLoading ? <div className="h-[9.375rem] animate-pulse rounded-lg bg-muted" /> : <ErrorBudgetCard budget={errorBudget} />}
        </Panel>
        <Panel title="Uptime Calendar" className="flex h-full min-w-0 flex-col rounded-xl p-5" titleClassName="text-[1rem] font-semibold" headerClassName="h-10" showOptions action={<span className="text-[0.75rem] text-muted-foreground">120 days</span>}>
          {isLoading ? <div className="h-[9.375rem] animate-pulse rounded-lg bg-muted" /> : <UptimeCalendar daily={fleetDaily} target={slaTarget} onSelectDay={(day) => setSelectedDay((current) => (current === day.iso ? null : day.iso))} />}
          {selectedDay && <p className="mt-2 text-[0.75rem] text-primary">Showing incidents for {new Date(selectedDay).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · <button onClick={() => setSelectedDay(null)} className="font-semibold hover:underline">Clear</button></p>}
        </Panel>
      </section>

      {/* Service table + incidents */}
      <section className="grid items-stretch gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Service Uptime" className="flex h-full min-w-0 flex-col rounded-xl p-5" titleClassName="text-[1rem] font-semibold" headerClassName="h-10" showOptions>
          <ServiceUptimeTable services={services} search={serviceSearch} onSearchChange={setServiceSearch} typeFilter={typeFilter} onTypeFilterChange={setTypeFilter} />
        </Panel>
        <Panel title="Downtime Incidents" className="flex h-full min-w-0 flex-col rounded-xl p-5" titleClassName="text-[1rem] font-semibold" headerClassName="h-10" showOptions action={<span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[0.75rem] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">{visibleIncidents.length} {visibleIncidents.length === 1 ? "incident" : "incidents"}</span>}>
          {isLoading ? <div className="h-[12.5rem] animate-pulse rounded-lg bg-muted" /> : <DowntimeIncidentsTable incidents={visibleIncidents} />}
        </Panel>
      </section>

      {/* SLA by type */}
      <Panel title="SLA Compliance by Type" className="flex h-full min-w-0 flex-col rounded-xl p-5" titleClassName="text-[1rem] font-semibold" headerClassName="h-10" showOptions action={<span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Target {slaTarget.toFixed(1)}%</span>}>
        {isLoading ? <div className="h-[11.25rem] animate-pulse rounded-lg bg-muted" /> : <SlaByType entries={types} target={slaTarget} onSelectType={(type) => setTypeFilter((current) => (current === type ? "all" : type))} />}
      </Panel>

      {toast && <div role="status" className="fixed bottom-4 right-4 z-[1300] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg">{toast}</div>}

      {/* Schedule report modal */}
      {scheduleOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="schedule-title" className="fixed inset-0 z-[1300] grid place-items-center bg-slate-950/40 p-4" onClick={() => setScheduleOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 id="schedule-title" className="font-display text-base font-bold text-foreground">Schedule report</h2>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">Email the SLA report to your team automatically.</p>
            <div className="mt-4 space-y-3">
              <label className="block space-y-1.5 text-[0.8125rem] font-medium text-foreground">Frequency
                <Select value={scheduleFreq} onValueChange={setScheduleFreq}>
                  <SelectTrigger aria-label="Frequency" className="h-10 w-full rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["daily", "weekly", "monthly"].map((option) => <SelectItem key={option} value={option}>{option[0].toUpperCase()}{option.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1.5 text-[0.8125rem] font-medium text-foreground">Format
                <Select value={scheduleFormat} onValueChange={setScheduleFormat}>
                  <SelectTrigger aria-label="Format" className="h-10 w-full rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pdf", "csv"].map((option) => <SelectItem key={option} value={option}>{option.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1.5 text-[0.8125rem] font-medium text-foreground">Recipients
                <input value={scheduleRecipients} onChange={(event) => setScheduleRecipients(event.target.value)} aria-label="Recipients" placeholder="sre@nexus.io, oncall@nexus.io" className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setScheduleOpen(false)} >Cancel</Button>
              <Button onClick={() => { setScheduleOpen(false); notify(`Report scheduled: ${scheduleFreq}, ${scheduleFormat.toUpperCase()} → ${scheduleRecipients}`); }} ><CheckCircle2 size={14} />Schedule</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
