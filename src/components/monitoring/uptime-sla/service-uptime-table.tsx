"use client";

import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search, SearchX, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ServiceUptime, ServiceType } from "@/mocks/uptimeSla";
import { DOWNTIME_INCIDENTS } from "@/mocks/uptimeSla";
import { statusForUptime, type SlaStatus } from "@/lib/slaCalculations";

const SERVICE_TYPES: ServiceType[] = ["API", "Web", "Database", "VM", "Cache", "Network"];
const STATUS_META: Record<SlaStatus, { label: string; className: string }> = {
  met: { label: "Met", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  at_risk: { label: "At risk", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  breached: { label: "Breached", className: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
};

interface ServiceUptimeTableProps {
  services: ServiceUptime[];
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
}

function StatusPill({ status }: { status: SlaStatus }) {
  const meta = STATUS_META[status];
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.75rem] font-semibold", meta.className)}>{meta.label}</span>;
}

/** Mini 30-day sparkline for the expanded row — flat blue, no fill. */
function MiniSparkline({ values }: { values: number[] }) {
  const width = 280;
  const height = 60;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.01);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - 4 - ((value - min) / range) * (height - 8);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[3.75rem] w-full" preserveAspectRatio="none" role="img" aria-label="30-day uptime trend">
      <polyline points={points} fill="none" stroke="oklch(0.6231 0.188 259.81)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Kebab menu with portal, smart position and outside/scroll close. */
function KebabMenu({ serviceId, actions, openId, onToggle, onClose }: { serviceId: string; actions: Array<{ label: string; onClick: () => void }>; openId: string | null; onToggle: (id: string) => void; onClose: () => void }) {
  const menuId = useId();
  const open = openId === serviceId;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; openUp: boolean } | null>(null);

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const EST = 120;
    const openUp = window.innerHeight - rect.bottom < EST + 8 && rect.top > EST + 8;
    const top = openUp ? Math.max(8, rect.top - EST - 6) : Math.min(rect.bottom + 6, window.innerHeight - EST - 8);
    const left = Math.max(8, Math.min(rect.right - 192, window.innerWidth - 192 - 8));
    setPosition({ top, left, openUp });
    onToggle(serviceId);
  };

  useLayoutEffect(() => {
    if (!open || !position) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    const h = menu?.offsetHeight ?? 120;
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpNow = spaceBelow < h + 8 && rect.top > h + 8;
      const top = openUpNow ? Math.max(8, rect.top - h - 6) : Math.min(rect.bottom + 6, window.innerHeight - h - 8);
      setPosition((prev) => (prev && (prev.top !== top || prev.openUp !== openUpNow) ? { ...prev, top, openUp: openUpNow } : prev));
    }
    menu?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        buttonRef.current?.focus();
      }
    };
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const onResize = () => onClose();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, onClose]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(click) => { click.stopPropagation(); open ? onClose() : openMenu(); }}
        onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); open ? onClose() : openMenu(); } }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Actions for ${serviceId}`}
        title="Actions"
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal size={15} aria-hidden="true" />
      </button>
      {open && position && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Actions for ${serviceId}`}
          className="motion-menu-in fixed z-[1400] w-48 rounded-[0.625rem] border border-gray-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)] outline-none dark:border-border dark:bg-popover"
          style={{ top: position.top, left: position.left, transformOrigin: position.openUp ? "bottom right" : "top right", ["--menu-slide" as string]: position.openUp ? "0.25rem" : "-0.25rem" }}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onClick={() => { action.onClick(); onClose(); buttonRef.current?.focus(); }}
              className="flex h-9 w-full items-center rounded-md px-3 text-left text-[0.8125rem] text-foreground transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none dark:hover:bg-accent dark:focus-visible:bg-accent"
            >
              {action.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

/** Service uptime table — flat matte, footer stats, accordion rows, portal menu. */
export function ServiceUptimeTable({ services, search, onSearchChange, typeFilter, onTypeFilterChange }: ServiceUptimeTableProps) {
  const [sortKey, setSortKey] = useState<"name" | "uptime" | "downtime" | "incidents">("uptime");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
    return services.filter((service) => {
      if (typeFilter !== "all" && service.type !== typeFilter) return false;
      if (tokens.length === 0) return true;
      const haystack = `${service.name} ${service.type} ${statusForUptime(service.currentUptime, service.slaTarget)}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [services, search, typeFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const diff = sortKey === "name" ? a.name.localeCompare(b.name)
        : sortKey === "uptime" ? a.currentUptime - b.currentUptime
        : sortKey === "downtime" ? a.downtimeSeconds - b.downtimeSeconds
        : a.incidents - b.incidents;
      return sortDir === "asc" ? diff : -diff;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const stats = useMemo(() => {
    const meeting = services.filter((service) => statusForUptime(service.currentUptime, service.slaTarget) === "met").length;
    const avgUptime = services.length ? services.reduce((sum, service) => sum + service.currentUptime, 0) / services.length : 100;
    const incidents = services.reduce((sum, service) => sum + service.incidents, 0);
    const worst = services.length ? services.reduce((worst, service) => (service.currentUptime < worst.currentUptime ? service : worst), services[0]) : null;
    return { meeting, avgUptime, incidents, worst };
  }, [services]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((value) => (value === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortIcon = (key: typeof sortKey) => (
    <ChevronDown size={12} className={cn("transition-transform", sortKey === key && sortDir === "desc" && "rotate-180", sortKey !== key && "opacity-40")} aria-hidden="true" />
  );

  const toggleExpand = (id: string) => setExpandedId((current) => (current === id ? null : id));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <span className="relative block min-w-[12.5rem] max-w-xs flex-1">
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search services…" aria-label="Search services by name, type or status" className="h-9 rounded-lg pl-8 text-sm" />
        </span>
        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger aria-label="Filter by type" className="h-9 w-36 rounded-lg text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            {SERVICE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto">
        <table className="w-full text-left text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border text-[0.75rem] text-muted-foreground">
              <th scope="col" className="w-9 px-2 py-2" aria-hidden="true" />
              <th scope="col" className="px-2 py-2"><button type="button" onClick={() => toggleSort("name")} className="flex items-center gap-1 font-semibold hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Service {sortIcon("name")}</button></th>
              <th scope="col" className="px-2 py-2"><button type="button" onClick={() => toggleSort("uptime")} className="flex items-center gap-1 font-semibold hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Uptime {sortIcon("uptime")}</button></th>
              <th scope="col" className="hidden px-2 py-2 md:table-cell"><button type="button" onClick={() => toggleSort("downtime")} className="flex items-center gap-1 font-semibold hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Downtime {sortIcon("downtime")}</button></th>
              <th scope="col" className="hidden px-2 py-2 lg:table-cell"><button type="button" onClick={() => toggleSort("incidents")} className="flex items-center gap-1 font-semibold hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Incidents {sortIcon("incidents")}</button></th>
              <th scope="col" className="hidden px-2 py-2 text-[0.75rem] font-semibold md:table-cell">SLA</th>
              <th scope="col" className="hidden px-2 py-2 text-[0.75rem] font-semibold lg:table-cell">Status</th>
              <th scope="col" className="w-[7.5rem] px-2 py-2 text-[0.75rem] font-semibold">30 days</th>
              <th scope="col" className="w-12 px-2 py-2 text-right text-[0.75rem] font-semibold"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((service) => {
              const status = statusForUptime(service.currentUptime, service.slaTarget);
              const isExpanded = expandedId === service.id;
              const minBar = Math.min(...service.dailyUptime.slice(-30));
              const breachDays = service.dailyUptime.slice(-30).filter((value) => value < service.slaTarget).length;
              const serviceIncidents = DOWNTIME_INCIDENTS.filter((incident) => incident.serviceName === service.name);
              return (
                <Fragment key={service.id}>
                  <tr className={cn("border-b border-border/70 last:border-0 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60", status === "breached" && "border-l-4 border-l-rose-500", status === "at_risk" && "border-l-4 border-l-amber-400")}>
                    <td className="px-2 py-3 align-middle">
                      <button type="button" onClick={() => toggleExpand(service.id)} aria-expanded={isExpanded} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${service.name}`} className="grid h-6 w-6 place-items-center rounded-lg text-muted-foreground hover:bg-accent"><ChevronRight size={14} className={cn("transition-transform duration-150", isExpanded && "rotate-90")} aria-hidden="true" /></button>
                    </td>
                    <td className="px-2 py-3 align-middle">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="whitespace-nowrap text-[0.8125rem] font-semibold text-foreground">{service.name}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase text-muted-foreground">{service.type}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 align-middle tabular-nums">
                      <b className={cn(status === "breached" ? "text-rose-700 dark:text-rose-400" : status === "at_risk" ? "text-amber-700 dark:text-amber-300" : "text-foreground")}>{service.currentUptime.toFixed(2)}%</b>
                    </td>
                    <td className="hidden whitespace-nowrap px-2 py-3 align-middle tabular-nums md:table-cell">{Math.floor(service.downtimeSeconds / 60)}m {service.downtimeSeconds % 60}s</td>
                    <td className="hidden whitespace-nowrap px-2 py-3 align-middle tabular-nums lg:table-cell">{service.incidents}</td>
                    <td className="hidden whitespace-nowrap px-2 py-3 align-middle tabular-nums text-muted-foreground md:table-cell">{service.slaTarget.toFixed(2)}%</td>
                    <td className="hidden whitespace-nowrap px-2 py-3 align-middle lg:table-cell"><StatusPill status={status} /></td>
                    <td className="px-2 py-3 align-middle">
                      <div className="flex h-4 w-[7.5rem] items-center gap-[0.125rem]" role="img" aria-label={`30-day uptime history for ${service.name}`}>
                        {service.dailyUptime.slice(-30).map((value, index) => {
                          const date = new Date(); date.setDate(date.getDate() - (service.dailyUptime.length - 1 - index));
                          return <span key={index} className={cn("h-3.5 w-[0.1875rem] rounded-[0.0625rem]", value >= service.slaTarget ? "bg-emerald-500" : value >= service.slaTarget - 0.5 ? "bg-amber-400" : "bg-rose-500")} title={`${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · ${value.toFixed(2)}% · ${value < service.slaTarget ? "breach" : "met"}`} />;
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-3 align-middle">
                      <KebabMenu serviceId={service.id} openId={menuOpenId} onToggle={setMenuOpenId} onClose={() => setMenuOpenId(null)} actions={[
                        { label: "View incidents", onClick: () => { window.location.assign("/incidents"); } },
                        { label: "Download report", onClick: () => notifyDownload(service.name) },
                        { label: "Set SLA target", onClick: () => notifySlaTarget(service.name) },
                      ]} />
                    </td>
                  </tr>
                  <tr className={cn("border-b border-border/60 last:border-0", isExpanded ? "bg-muted/30" : "")}>
                    <td colSpan={9} className="p-0">
                      <div className="grid transition-[grid-template-rows] duration-150 ease-out" style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}>
                        <div className="overflow-hidden">
                          <div className="grid gap-3 border-t border-border/60 px-3 py-3 sm:grid-cols-[1.2fr_1fr]">
                            <div className="min-w-0 rounded-lg border border-border/70 bg-card p-3">
                              <div className="mb-2 flex items-center justify-between gap-2 text-[0.75rem] text-muted-foreground"><span className="font-semibold uppercase tracking-[0.06em]">30-day uptime</span><b className="tabular-nums text-foreground">{service.currentUptime.toFixed(2)}%</b></div>
                              <MiniSparkline values={service.dailyUptime} />
                            </div>
                            <div className="min-w-0 rounded-lg border border-border/70 bg-card p-3">
                              <div className="mb-2 flex items-center justify-between gap-2 text-[0.75rem] text-muted-foreground"><span className="font-semibold uppercase tracking-[0.06em]">Incidents</span><b className="tabular-nums text-foreground">{serviceIncidents.length}</b></div>
                              <ul className="flex flex-col gap-1.5 text-[0.75rem]">
                                {serviceIncidents.length === 0 && <li className="text-muted-foreground">No incidents in this window</li>}
                                {serviceIncidents.map((incident) => (
                                  <li key={incident.id}>
                                    <Link href={`/events-explorer/${incident.eventId}`} className="grid grid-cols-[auto_auto_1fr] items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                      <span className="tabular-nums text-foreground">{new Date(incident.startedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                                      <span className="tabular-nums text-muted-foreground">{incident.durationMinutes}m</span>
                                      <span className="min-w-0 truncate text-foreground">{incident.cause}</span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-[0.75rem] text-muted-foreground">
                                <span>Low: <b className="text-foreground">{minBar.toFixed(2)}%</b></span>
                                <span>Breach days: <b className="text-foreground">{breachDays}</b></span>
                                <span>MTTR: <b className="text-foreground">{service.mttrMinutes}m</b></span>
                                <Link href={`/events-explorer?q=${encodeURIComponent(service.name)}`} className="ml-auto font-medium text-primary hover:underline">View events →</Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={9} className="py-10 text-center"><div className="flex flex-col items-center gap-2"><SearchX size={24} className="text-muted-foreground" aria-hidden="true" /><p className="text-sm font-semibold text-foreground">No services match your search</p><p className="text-[0.75rem] text-muted-foreground">Clear search or change the type filter.</p><button type="button" onClick={() => { onSearchChange(""); onTypeFilterChange("all"); }} className="mt-1 text-sm font-medium text-primary hover:underline">Clear filters</button></div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table footer summary — 4 stats + worst performer */}
      <div className="grid grid-cols-2 gap-2 border-t border-border pt-2 pt-3 sm:grid-cols-4" aria-label="Service uptime summary">
        {[
          { label: "Services", value: String(services.length) },
          { label: "Meeting SLA", value: `${stats.meeting} / ${services.length}` },
          { label: "Avg Uptime", value: `${stats.avgUptime.toFixed(2)}%` },
          { label: "Total Incidents", value: String(stats.incidents) },
        ].map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{item.label}</span>
            <b className="text-[0.875rem] tabular-nums text-foreground">{item.value}</b>
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-[0.75rem] text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300" role="note">
        <Search size={13} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0">Worst performer: <b>{stats.worst?.name ?? "—"} ({stats.worst?.currentUptime.toFixed(2)}%)</b></span>
      </div>

      {/* Pagination / footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 pt-3">
        <p className="text-[0.75rem] text-muted-foreground">Showing <b className="text-foreground">1-{sorted.length}</b> of <b className="text-foreground">{sorted.length}</b> services</p>
        <Link href="/all-servers" className="inline-flex shrink-0 items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View all services →</Link>
      </div>
    </div>
  );
}

function notifyDownload(serviceName: string) {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(new Blob([`Service report: ${serviceName}\n`], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${serviceName}-report.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function notifySlaTarget(serviceName: string) {
  if (typeof window === "undefined") return;
  const current = window.prompt(`New SLA target for ${serviceName} (99.0 / 99.5 / 99.9 / 99.95 / 99.99):`, "99.9");
  if (current == null) return;
  const parsed = Number(current);
  if (![99.0, 99.5, 99.9, 99.95, 99.99].includes(parsed as 99.0 | 99.5 | 99.9 | 99.95 | 99.99)) {
    window.alert("Invalid target. Pick from 99.0 / 99.5 / 99.9 / 99.95 / 99.99.");
    return;
  }
  window.alert(`${serviceName} SLA target set to ${parsed}% (demo action).`);
}
