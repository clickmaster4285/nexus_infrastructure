"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, BellOff, CheckCheck, CheckCircle2, ChevronLeft, ChevronRight, Info, Zap, AlertTriangle } from "lucide-react";

import { AlertMenu, type AlertMenuItem } from "@/components/alerts/alert-menu";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALERT_ASSIGNEES, type Alert, type AlertSeverity, type AlertStatus } from "@/mocks/alerts";
import { alertDuration, formatDateTime } from "@/utils/alertStats";
import { timeAgo } from "@/mocks/logs";
import { isServerInMaintenance } from "@/mocks/maintenanceWindows";
import { cn } from "@/lib/utils";

interface AlertsTableProps {
  alerts: Alert[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onOpenDrawer: (alert: Alert) => void;
  onAcknowledge: (ids: string[]) => void;
  onResolve: (ids: string[]) => void;
  onAssign: (ids: string[], user: string | null) => void;
  onSilence: (ids: string[], hours: number) => void;
  onCreateRule: (alert: Alert) => void;
  onCopyLink: (alert: Alert) => void;
}

type SortKey = "severity" | "name" | "host" | "status" | "triggered" | "duration";

const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
const STATUS_RANK: Record<AlertStatus, number> = { firing: 0, acknowledged: 1, silenced: 2, resolved: 3 };

const PAGE_SIZES = [10, 20, 50];

const SEVERITY_BADGE: Record<AlertSeverity, { label: string; icon: typeof Zap; className: string }> = {
  critical: { label: "Critical", icon: AlertTriangle, className: "bg-[#FEE2E2] text-[#DC2626] dark:bg-red-500/15 dark:text-red-400" },
  warning: { label: "Warning", icon: AlertTriangle, className: "bg-[#FEF3C7] text-[#D97706] dark:bg-amber-500/15 dark:text-amber-400" },
  info: { label: "Info", icon: Info, className: "bg-[#DBEAFE] text-[#3B82F6] dark:bg-blue-500/15 dark:text-blue-400" },
};

const STATUS_BADGE: Record<AlertStatus, { label: string; icon: typeof Zap; className: string }> = {
  firing: { label: "Firing", icon: Zap, className: "bg-[#DC2626]/10 text-[#DC2626] dark:bg-red-500/15 dark:text-red-400" },
  acknowledged: { label: "Acknowledged", icon: CheckCheck, className: "bg-[#D97706]/10 text-[#D97706] dark:bg-amber-500/15 dark:text-amber-400" },
  silenced: { label: "Silenced", icon: BellOff, className: "bg-slate-200/70 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
  resolved: { label: "Resolved", icon: CheckCircle2, className: "bg-[#16A34A]/10 text-[#16A34A] dark:bg-emerald-500/15 dark:text-emerald-400" },
};

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const meta = SEVERITY_BADGE[severity];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 border-transparent px-2 py-0.5 text-[10px] font-semibold", meta.className)}>
      <Icon size={11} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: AlertStatus }) {
  const meta = STATUS_BADGE[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 border-transparent px-2 py-0.5 text-[10px] font-semibold", meta.className)}>
      <Icon size={11} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

const AVATAR_TONES = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700"];

function initialsFor(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase();
}

function AssigneeCell({ assignee }: { assignee: string | null }) {
  if (!assignee) return <span className="text-[12px] text-muted-foreground">Unassigned</span>;
  const toneIndex = [...assignee].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TONES.length;
  return (
    <span className="flex items-center gap-2" title={assignee}>
      <span aria-hidden="true" className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold", AVATAR_TONES[toneIndex])}>
        {initialsFor(assignee)}
      </span>
      <span className="hidden truncate text-[12px] text-foreground xl:inline">{assignee}</span>
    </span>
  );
}

function kebabItemsFor(
  alert: Alert,
  actions: Pick<AlertsTableProps, "onAcknowledge" | "onResolve" | "onAssign" | "onSilence" | "onCreateRule" | "onCopyLink">,
): AlertMenuItem[] {
  return [
    { key: "ack", label: "Acknowledge", disabled: alert.status !== "firing", onSelect: () => actions.onAcknowledge([alert.id]) },
    {
      key: "assign",
      label: "Assign",
      items: [
        ...ALERT_ASSIGNEES.map((user) => ({ key: user, label: user, disabled: alert.assignee === user, onSelect: () => actions.onAssign([alert.id], user) })),
        { key: "unassign", label: "Unassign", disabled: !alert.assignee, onSelect: () => actions.onAssign([alert.id], null) },
      ],
    },
    {
      key: "silence",
      label: "Silence",
      items: [1, 4, 24].map((hours) => ({ key: String(hours), label: hours === 1 ? "1 hour" : `${hours} hours`, onSelect: () => actions.onSilence([alert.id], hours) })),
    },
    { key: "resolve", label: "Resolve", disabled: alert.status === "resolved", onSelect: () => actions.onResolve([alert.id]) },
    { key: "rule", label: "Create alert rule", onSelect: () => actions.onCreateRule(alert) },
    { key: "copy", label: "Copy link", onSelect: () => actions.onCopyLink(alert) },
  ];
}

/** Alerts table: sticky-free, priority columns (secondary hide on small screens),
 *  sorting, pagination, bulk-select and keyboard navigation (J/K, A, R, Enter). */
export function AlertsTable(props: AlertsTableProps) {
  const { alerts, selectedIds, onSelectionChange, onOpenDrawer, ...actions } = props;
  const [sortKey, setSortKey] = useState<SortKey>("triggered");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const nowRef = useRef(Date.now());
  const tableRef = useRef<HTMLTableElement | null>(null);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const maxPage = Math.max(1, Math.ceil(alerts.length / pageSize));

  useEffect(() => {
    if (page > maxPage) setPage(1);
  }, [page, maxPage]);

  const sorted = useMemo(() => {
    const copy = [...alerts];
    copy.sort((a, b) => {
      const diff =
        sortKey === "severity" ? SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
        : sortKey === "name" ? a.name.localeCompare(b.name)
        : sortKey === "host" ? a.host.localeCompare(b.host)
        : sortKey === "status" ? STATUS_RANK[a.status] - STATUS_RANK[b.status]
        : sortKey === "duration" ? ((b.resolvedAt ? new Date(b.resolvedAt).getTime() : nowRef.current) - b.epochMs) - ((a.resolvedAt ? new Date(a.resolvedAt).getTime() : nowRef.current) - a.epochMs)
        : b.epochMs - a.epochMs;
      return sortDir === "asc" ? -diff : diff;
    });
    return copy;
  }, [alerts, sortKey, sortDir]);

  const safePage = Math.min(page, maxPage);
  const start = (safePage - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "triggered" || key === "severity" || key === "duration" ? "desc" : "asc");
    }
  };

  const allVisibleSelected = visible.length > 0 && visible.every((alert) => selected.has(alert.id));

  const toggleAll = () => {
    if (allVisibleSelected) onSelectionChange(selectedIds.filter((id) => !visible.some((alert) => alert.id === id)));
    else onSelectionChange([...new Set([...selectedIds, ...visible.map((alert) => alert.id)])]);
  };

  const toggleRow = (alert: Alert) => {
    onSelectionChange(selected.has(alert.id) ? selectedIds.filter((id) => id !== alert.id) : [...selectedIds, alert.id]);
  };

  const moveFocus = (delta: number) => {
    if (visible.length === 0) return;
    const currentIndex = visible.findIndex((alert) => alert.id === focusedId);
    const nextIndex = currentIndex === -1 ? (delta > 0 ? 0 : visible.length - 1) : Math.max(0, Math.min(visible.length - 1, currentIndex + delta));
    setFocusedId(visible[nextIndex].id);
    requestAnimationFrame(() => {
      tableRef.current?.querySelector<HTMLElement>(`tr[data-alert-id="${visible[nextIndex].id}"]`)?.focus();
    });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const tag = (event.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    const focused = visible.find((alert) => alert.id === focusedId);
    if (event.key === "j" || event.key === "J") { event.preventDefault(); moveFocus(1); }
    else if (event.key === "k" || event.key === "K") { event.preventDefault(); moveFocus(-1); }
    else if ((event.key === "a" || event.key === "A") && focused) { event.preventDefault(); actions.onAcknowledge([focused.id]); }
    else if ((event.key === "r" || event.key === "R") && focused) { event.preventDefault(); actions.onResolve([focused.id]); }
    else if ((event.key === "Enter" || event.key === "o") && focused) { event.preventDefault(); onOpenDrawer(focused); }
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key
      ? sortDir === "asc"
        ? <ArrowUp size={12} aria-hidden="true" className="text-primary" />
        : <ArrowDown size={12} aria-hidden="true" className="text-primary" />
      : <ArrowUpDown size={12} aria-hidden="true" className="opacity-0 transition-opacity group-hover:opacity-50" />;

  const header = (key: SortKey, label: string, className?: string) => (
    <th scope="col" aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : undefined} className={cn("whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", className)}>
      <button type="button" onClick={() => toggleSort(key)} className="group inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {label}
        {sortIndicator(key)}
      </button>
    </th>
  );

  if (visible.length === 0) return null;

  return (
    <div onKeyDown={onKeyDown}>
      <table ref={tableRef} className="w-full caption-bottom text-sm">
        <caption className="sr-only">Alerts list. Use J and K to move between rows, A to acknowledge, R to resolve, Enter to open details.</caption>
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th scope="col" className="w-9 px-3 py-2">
              <input
                type="checkbox"
                aria-label="Select all rows on this page"
                checked={allVisibleSelected}
                onChange={toggleAll}
                className="h-4 w-4 cursor-pointer rounded border-input accent-[#1479e8]"
              />
            </th>
            {header("severity", "Severity", "hidden sm:table-cell")}
            <th scope="col" className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Alert</th>
            {header("host", "Host / Service", "hidden lg:table-cell")}
            {header("status", "Status", "hidden md:table-cell")}
            {header("triggered", "Triggered")}
            {header("duration", "Duration", "hidden xl:table-cell")}
            <th scope="col" className="hidden px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:table-cell">Assignee</th>
            <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((alert) => {
            const isSelected = selected.has(alert.id);
            return (
              <tr
                key={alert.id}
                data-alert-id={alert.id}
                tabIndex={0}
                onFocus={() => setFocusedId(alert.id)}
                onClick={() => onOpenDrawer(alert)}
                onKeyDown={(event) => { if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "INPUT") onOpenDrawer(alert); }}
                aria-selected={isSelected}
                className={cn(
                  "relative cursor-pointer border-b border-border/70 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  "hover:bg-[#F8FAFC] dark:hover:bg-accent",
                  isSelected && "bg-primary/[0.06] dark:bg-primary/10",
                  alert.severity === "critical" && alert.status === "firing" && "shadow-[inset_3px_0_0_#DC2626]",
                )}
              >
                <td className="px-3 py-2.5 align-middle" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select alert ${alert.id}`}
                    checked={isSelected}
                    onChange={() => toggleRow(alert)}
                    className="h-4 w-4 cursor-pointer rounded border-input accent-[#1479e8]"
                  />
                </td>
                <td className="hidden px-3 py-2.5 align-middle sm:table-cell"><SeverityBadge severity={alert.severity} /></td>
                <td className="min-w-0 max-w-[340px] px-3 py-2.5 align-middle">
                  <p className="truncate text-[13px] font-semibold text-foreground">{alert.name}</p>
                  <p className="truncate text-[12px] text-muted-foreground" title={alert.message}>{alert.message}</p>
                </td>
                <td className="hidden px-3 py-2.5 align-middle lg:table-cell">
                  <p className="text-[13px] text-foreground">{alert.host}</p>
                  <p className="text-[12px] text-muted-foreground">{alert.service}</p>
                  {isServerInMaintenance(alert.host) && <span className="mt-0.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-violet-100 px-1.5 py-0.5 text-[12px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-violet-500" />Suppressed</span>}
                </td>
                <td className="hidden px-3 py-2.5 align-middle md:table-cell"><StatusBadge status={alert.status} /></td>
                <td className="whitespace-nowrap px-3 py-2.5 align-middle">
                  <span className="text-[12px] text-foreground">{timeAgo(alert.epochMs)}</span>
                  <span className="sr-only">{formatDateTime(alert.epochMs)}</span>
                  <p className="hidden text-[11px] text-muted-foreground" aria-hidden="true">{formatDateTime(alert.epochMs)}</p>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 align-middle text-[12px] tabular-nums text-muted-foreground xl:table-cell">
                  {alertDuration(alert, nowRef.current)}
                </td>
                <td className="hidden px-3 py-2.5 align-middle sm:table-cell"><AssigneeCell assignee={alert.assignee} /></td>
                <td className="px-2 py-2.5 text-right align-middle" onClick={(event) => event.stopPropagation()}>
                  <AlertMenu
                    label={`Actions for ${alert.id}`}
                    items={kebabItemsFor(alert, actions)}
                    trigger={
                      <button
                        type="button"
                        aria-label={`Actions for alert ${alert.id}`}
                        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
                      </button>
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Pagination footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <p className="text-[12px] text-muted-foreground" aria-live="polite">
          Showing {start + 1}-{start + visible.length} of {alerts.length}
        </p>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
            <SelectTrigger aria-label="Rows per page" className="h-8 w-[110px] rounded-lg text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>{size} / page</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={safePage <= 1}
            aria-label="Previous page"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <span className="min-w-[64px] text-center text-[12px] font-medium text-foreground">Page {safePage} / {maxPage}</span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(maxPage, current + 1))}
            disabled={safePage >= maxPage}
            aria-label="Next page"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

