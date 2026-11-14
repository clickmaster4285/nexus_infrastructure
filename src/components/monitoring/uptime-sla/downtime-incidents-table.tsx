import { CheckCircle2, ChevronRight, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DowntimeIncident, IncidentSeverity, IncidentStatus } from "@/mocks/uptimeSla";

const SEVERITY_BAR: Record<IncidentSeverity, string> = { Critical: "oklch(0.5771 0.2152 27.33)", Warning: "oklch(0.6658 0.1574 58.32)", Info: "oklch(0.6231 0.188 259.81)" };
const SEVERITY_BADGE: Record<IncidentSeverity, string> = {
  Critical: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  Warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  Info: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
};
const STATUS_META: Record<IncidentStatus, string> = {
  Open: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  Investigating: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  Acknowledged: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  Resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
};

function formatStarted(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Downtime incidents — compact table with downtime analytics, severity split and insight strip. */
export function DowntimeIncidentsTable({ incidents }: { incidents: DowntimeIncident[] }) {
  const resolved = incidents.filter((incident) => incident.status === "Resolved");
  const totalMinutes = resolved.reduce((sum, incident) => sum + incident.durationMinutes, 0);
  const longest = incidents.length ? Math.max(...incidents.map((incident) => incident.durationMinutes)) : 0;
  const mttr = resolved.length ? Math.round(totalMinutes / resolved.length) : 0;

  // Downtime by service (desc)
  const byServiceMap = new Map<string, number>();
  for (const incident of incidents) byServiceMap.set(incident.serviceName, (byServiceMap.get(incident.serviceName) ?? 0) + incident.durationMinutes);
  const byService = [...byServiceMap.entries()].map(([service, minutes]) => ({ service, minutes })).sort((a, b) => b.minutes - a.minutes);
  const maxServiceMinutes = Math.max(...byService.map((row) => row.minutes), 1);

  // Severity split
  const bySeverity = (["Critical", "Warning", "Info"] as IncidentSeverity[]).map((severity) => ({
    severity,
    count: incidents.filter((incident) => incident.severity === severity).length,
  })).filter((row) => row.count > 0);
  const severityTotal = bySeverity.reduce((sum, row) => sum + row.count, 0);
  const severityBarWidth: Record<IncidentSeverity, string> = {
    Critical: severityTotal ? `${(bySeverity.find((r) => r.severity === "Critical")?.count ?? 0) / severityTotal * 100}%` : "0%",
    Warning: severityTotal ? `${(bySeverity.find((r) => r.severity === "Warning")?.count ?? 0) / severityTotal * 100}%` : "0%",
    Info: severityTotal ? `${(bySeverity.find((r) => r.severity === "Info")?.count ?? 0) / severityTotal * 100}%` : "0%",
  };

  // Most downtime service
  const topService = byService[0];
  const topShare = topService && totalMinutes > 0 ? Math.round((topService.minutes / totalMinutes) * 100) : 0;

  if (incidents.length === 0 || !topService) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
        <CheckCircle2 size={28} className="text-emerald-500" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">No downtime in this range</p>
        <p className="text-[0.75rem] text-muted-foreground">Every service stayed within its SLA for this window.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border text-[0.75rem] text-muted-foreground">
              <th scope="col" className="w-[5.75rem] whitespace-nowrap px-2 py-2 font-semibold">Started</th>
              <th scope="col" className="w-[4rem] whitespace-nowrap px-2 py-2 font-semibold">Duration</th>
              <th scope="col" className="px-2 py-2 font-semibold">Service</th>
              <th scope="col" className="hidden w-[5rem] whitespace-nowrap px-2 py-2 font-semibold sm:table-cell">Severity</th>
              <th scope="col" className="w-[1.5rem] px-1 py-2 text-right font-semibold" aria-label="Open in Event Explorer" />
            </tr>
          </thead>
          <tbody>
            {incidents.map((incident) => {
              const canOpen = incident.eventId != null;
              const content = (
                <>
                  <td className="w-[5.75rem] whitespace-nowrap px-2 py-3 align-middle tabular-nums text-foreground">{formatStarted(incident.startedAt)}</td>
                  <td className="w-[4rem] whitespace-nowrap px-2 py-3 align-middle tabular-nums text-foreground">{incident.durationMinutes}m</td>
                  <td className="max-w-0 px-2 py-3 align-middle">
                    <div className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{incident.serviceName}</span>
                      <span className="mt-0.5 block truncate text-[0.75rem] text-muted-foreground" title={incident.cause}>{incident.cause}</span>
                    </div>
                  </td>
                  <td className="hidden w-[5rem] whitespace-nowrap px-2 py-3 align-middle sm:table-cell">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", SEVERITY_BADGE[incident.severity])}>{incident.severity}</span>
                  </td>
                  <td className="w-[1.5rem] px-1 py-3 align-middle text-right"><ChevronRight size={15} className="text-muted-foreground" aria-hidden="true" /></td>
                </>
              );
              const rowClass = cn("border-b border-border/70 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors", canOpen && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring");
              const rowProps = canOpen
                ? { role: "link" as const, tabIndex: 0, onClick: () => { if (typeof window !== "undefined") window.location.assign(`/events-explorer/${incident.eventId}`); }, onKeyDown: (event: React.KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); window.location.assign(`/events-explorer/${incident.eventId}`); } }, "aria-label": `Open incident ${incident.id} in Event Explorer` }
                : {};
              return (
                <tr key={incident.id} className={rowClass} {...rowProps}>{content}</tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Downtime by service */}
      <div className="mt-3 border-t border-[oklch(0.9548_0.0058_264.53)] pt-3 dark:border-slate-700">
        <span className="mb-2 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Downtime by Service</span>
        <div className="space-y-1.5">
          {byService.map((row) => (
            <div key={row.service} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-[0.8125rem] font-medium text-foreground">{row.service}</span>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[oklch(0.9548_0.0058_264.53)] dark:bg-slate-700" aria-label={`${row.service} downtime ${row.minutes} minutes`}>
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${(row.minutes / maxServiceMinutes) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-[0.75rem] tabular-nums text-foreground">{row.minutes}m</span>
            </div>
          ))}
        </div>
      </div>

      {/* By severity split */}
      <div className="mt-3 border-t border-[oklch(0.9548_0.0058_264.53)] pt-3 dark:border-slate-700">
        <span className="mb-2 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">By Severity</span>
        <div className="flex h-2 w-full gap-[0.125rem] overflow-hidden rounded-full" role="img" aria-label={`Severity split: ${bySeverity.map((r) => `${r.severity} ${r.count}`).join(", ")}`}>
          {bySeverity.map((row) => (
            <span key={row.severity} className="h-full cursor-default first:rounded-l-full last:rounded-r-full" style={{ width: severityBarWidth[row.severity], backgroundColor: SEVERITY_BAR[row.severity] }} title={`${row.severity} ${row.count}`} aria-label={`${row.severity} ${row.count} incident${row.count === 1 ? "" : "s"}`} />
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-muted-foreground">
          {bySeverity.map((row) => (
            <span key={row.severity} className="flex items-center gap-1 whitespace-nowrap"><i aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: SEVERITY_BAR[row.severity] }} />{row.severity} <b className="text-foreground">{row.count}</b></span>
          ))}
        </div>
      </div>

      {/* Quick insight strip */}
      <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-[0.75rem] text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300" role="note">
        <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span className="min-w-0">Most downtime: <b>{topService.service}</b> ({topShare}% of total)</span>
      </div>

      {/* Footer pinned to bottom */}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[oklch(0.9548_0.0058_264.53)] pt-2 text-[0.75rem] text-muted-foreground dark:border-slate-700">
        <span>Total downtime: <b className="text-foreground">{totalMinutes}m</b></span>
        <span>Longest: <b className="text-foreground">{longest}m</b></span>
        <span>MTTR: <b className="text-foreground">{mttr}m</b></span>
      </div>
    </div>
  );
}
