"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Info, Mail, MessageSquare, Webhook, Zap, AlertTriangle, BellOff, CheckCircle2, Ban } from "lucide-react";

import { AlertMenu, type AlertMenuItem } from "@/components/alerts/alert-menu";
import { maintenanceWindowMutingRule } from "@/mocks/maintenanceWindows";
import { getRunbookForRule } from "@/mocks/runbooks";
import { ToggleSwitch } from "@/components/alert-rules/toggle-switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AlertRule, RuleSeverity, RuleStatus, RuleType, NotificationChannel } from "@/mocks/alertRules";
import { formatCondition } from "@/utils/formatCondition";
import { formatLastFired } from "@/utils/ruleStats";
import { cn } from "@/lib/utils";

export interface RulesTableColumns {
  type: boolean;
  notifications: boolean;
  activity: boolean;
}

export type RulesTableDensity = "comfortable" | "compact";

interface RulesTableProps {
  rules: AlertRule[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  columns?: RulesTableColumns;
  density?: RulesTableDensity;
  onToggle: (rule: AlertRule) => void;
  onEdit: (rule: AlertRule) => void;
  onDuplicate: (rule: AlertRule) => void;
  onMute: (ids: string[], hours: number) => void;
  onUnmute: (rule: AlertRule) => void;
  onDelete: (rule: AlertRule) => void;
  onViewAlerts: (rule: AlertRule) => void;
  onOpenDetail: (rule: AlertRule) => void;
}

type SortKey = "severity" | "name" | "type" | "fired24h" | "lastFiredAt";

const SEVERITY_RANK: Record<RuleSeverity, number> = { Critical: 0, Warning: 1, Info: 2 };
const PAGE_SIZES = [10, 20, 50];

const SEVERITY_BADGE: Record<RuleSeverity, { icon: typeof Zap; className: string }> = {
  Critical: { icon: AlertTriangle, className: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400" },
  Warning: { icon: AlertTriangle, className: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
  Info: { icon: Info, className: "bg-blue-100 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400" },
};

const TYPE_BADGE: Record<RuleType, string> = {
  Threshold: "bg-[oklch(0.9595_0.008_253.85)] text-[oklch(0.3753_0.0501_263.06)] dark:bg-slate-500/15 dark:text-slate-300",
  Anomaly: "bg-purple-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  Composite: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

const STATUS_CHIP: Record<RuleStatus, { icon: typeof Zap; className: string }> = {
  Enabled: { icon: CheckCircle2, className: "text-green-600" },
  Muted: { icon: BellOff, className: "text-slate-400" },
  Disabled: { icon: Ban, className: "text-slate-400" },
};

const CHANNEL_ICON: Record<NotificationChannel, { icon: typeof Mail; label: string }> = {
  Email: { icon: Mail, label: "Email" },
  Slack: { icon: MessageSquare, label: "Slack" },
  PagerDuty: { icon: Zap, label: "PagerDuty" },
  Webhook: { icon: Webhook, label: "Webhook" },
};

function SeverityBadge({ severity }: { severity: RuleSeverity }) {
  const meta = SEVERITY_BADGE[severity];
  return (
    <Badge variant="outline" className={cn("gap-1 border-transparent px-2 py-0.5 text-[0.625rem] font-semibold", meta.className)}>
      <meta.icon size={11} aria-hidden="true" />
      {severity}
    </Badge>
  );
}

function TypeBadge({ type }: { type: RuleType }) {
  return (
    <Badge variant="outline" className={cn("border-transparent px-2 py-0.5 text-[0.625rem] font-semibold", TYPE_BADGE[type])}>
      {type}
    </Badge>
  );
}

function FireSparkline({ history, fired24h }: { history: number[]; fired24h: number }) {
  const max = Math.max(1, ...history);
  return (
    <span className="flex items-end gap-[0.125rem]" title={`${fired24h} fires in the last 24h (hourly)`} aria-label={`${fired24h} fires in the last 24 hours`}>
      {history.map((value, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn("w-[0.1875rem] rounded-[0.0625rem]", value > 0 ? "bg-amber-600 dark:bg-amber-500" : "bg-slate-200 dark:bg-slate-700")}
          style={{ height: `${value > 0 ? Math.max(3, Math.round((value / max) * 18)) : 2}px` }}
        />
      ))}
    </span>
  );
}

function ChannelIcons({ channels }: { channels: NotificationChannel[] }) {
  return (
    <span className="flex items-center gap-1.5" aria-label={`Notify via ${channels.join(", ")}`}>
      {channels.map((channel) => {
        const meta = CHANNEL_ICON[channel];
        return (
          <span key={channel} title={meta.label} className="grid h-6 w-6 place-items-center rounded-md border border-border bg-muted/50 text-muted-foreground">
            <meta.icon size={12} aria-hidden="true" />
          </span>
        );
      })}
    </span>
  );
}

function kebabItemsFor(rule: AlertRule, actions: Pick<RulesTableProps, "onEdit" | "onDuplicate" | "onMute" | "onUnmute" | "onDelete" | "onViewAlerts">, navigate: (href: string) => void): AlertMenuItem[] {
  const linked = getRunbookForRule(rule.id);
  const items: AlertMenuItem[] = [
    { key: "runbook", label: linked ? `Open runbook ${linked.id}` : "Create runbook", onSelect: () => navigate(linked ? `/runbooks/${linked.id}` : `/runbooks/new?rule=${rule.id}`) },
    { key: "edit", label: "Edit rule", onSelect: () => actions.onEdit(rule) },
    { key: "duplicate", label: "Duplicate", onSelect: () => actions.onDuplicate(rule) },
  ];
  if (rule.status === "Muted") {
    items.push({ key: "unmute", label: "Unmute rule", onSelect: () => actions.onUnmute(rule) });
  } else {
    items.push({
      key: "mute",
      label: "Mute",
      items: [1, 4, 24].map((hours) => ({ key: String(hours), label: hours === 1 ? "1 hour" : `${hours} hours`, onSelect: () => actions.onMute([rule.id], hours) })),
    });
  }
  items.push(
    { key: "view", label: "View fired alerts", onSelect: () => actions.onViewAlerts(rule) },
    { key: "divider", label: "", divider: true },
    { key: "delete", label: "Delete", danger: true, onSelect: () => actions.onDelete(rule) },
  );
  return items;
}

/** Rules table: priority columns (secondary hidden on small screens), sorting, pagination, bulk select. */
export function RulesTable(props: RulesTableProps) {
  const { rules, selectedIds, onSelectionChange, columns = { type: true, notifications: true, activity: true }, density = "comfortable", onToggle, onOpenDetail, ...actions } = props;
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const maxPage = Math.max(1, Math.ceil(rules.length / pageSize));

  useEffect(() => {
    if (page > maxPage) setPage(1);
  }, [page, maxPage]);

  const sorted = useMemo(() => {
    const copy = [...rules];
    copy.sort((a, b) => {
      const diff =
        sortKey === "severity" ? SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
        : sortKey === "name" ? a.name.localeCompare(b.name)
        : sortKey === "type" ? a.type.localeCompare(b.type)
        : sortKey === "fired24h" ? a.fired24h - b.fired24h
        : (a.lastFiredAt ? new Date(a.lastFiredAt).getTime() : 0) - (b.lastFiredAt ? new Date(b.lastFiredAt).getTime() : 0);
      return sortDir === "asc" ? diff : -diff;
    });
    return copy;
  }, [rules, sortKey, sortDir]);

  const safePage = Math.min(page, maxPage);
  const start = (safePage - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "fired24h" || key === "lastFiredAt" ? "desc" : "asc");
    }
  };

  const allVisibleSelected = visible.length > 0 && visible.every((rule) => selected.has(rule.id));

  const toggleAll = () => {
    if (allVisibleSelected) onSelectionChange(selectedIds.filter((id) => !visible.some((rule) => rule.id === id)));
    else onSelectionChange([...new Set([...selectedIds, ...visible.map((rule) => rule.id)])]);
  };

  const toggleRow = (rule: AlertRule) => {
    onSelectionChange(selected.has(rule.id) ? selectedIds.filter((id) => id !== rule.id) : [...selectedIds, rule.id]);
  };

  const sortIndicator = (key: SortKey) =>
    sortKey === key
      ? sortDir === "asc"
        ? <ArrowUp size={12} aria-hidden="true" className="text-primary" />
        : <ArrowDown size={12} aria-hidden="true" className="text-primary" />
      : <ArrowUpDown size={12} aria-hidden="true" className="opacity-0 transition-opacity group-hover:opacity-50" />;

  const header = (key: SortKey, label: string, className?: string) => (
    <th scope="col" aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : undefined} className={cn("whitespace-nowrap px-3 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground", className)}>
      <button type="button" onClick={() => toggleSort(key)} className="group inline-flex items-center gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {label}
        {sortIndicator(key)}
      </button>
    </th>
  );

  if (visible.length === 0) return null;

  return (
    <div className={cn(density === "compact" && "[&_td]:py-1 [&_th]:py-1.5")}>
      <table className="w-full caption-bottom text-sm">
        <caption className="sr-only">Alert rules. Use the row checkbox to select a rule, then apply a bulk action.</caption>
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th scope="col" className="w-9 px-3 py-2">
              <input
                type="checkbox"
                aria-label="Select all rows on this page"
                checked={allVisibleSelected}
                onChange={toggleAll}
                className="h-4 w-4 cursor-pointer rounded border-input accent-[oklch(0.5855_0.1885_255.72)]"
              />
            </th>
            <th scope="col" className="w-[4.5rem] px-3 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Enabled</th>
            {header("name", "Rule", "min-w-[12.5rem]")}
            {header("type", "Type", columns.type ? "hidden sm:table-cell" : "hidden")}
            {header("severity", "Severity", "hidden md:table-cell")}
            <th scope="col" className="hidden px-3 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">Target</th>
            <th scope="col" className={cn("hidden px-3 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground", columns.notifications && "xl:table-cell")}>Notify</th>
            {header("lastFiredAt", "Last fired", "hidden md:table-cell")}
            {header("fired24h", "Fired 24h", columns.activity ? "hidden sm:table-cell" : "hidden")}
            <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((rule) => {
            const isSelected = selected.has(rule.id);
            const conditionText = formatCondition(rule.condition);
            const statusMeta = STATUS_CHIP[rule.status];
            const StatusIcon = statusMeta.icon;
            const mutedByWindow = maintenanceWindowMutingRule(rule.id);
            return (
              <tr
                key={rule.id}
                data-rule-id={rule.id}
                onClick={() => onOpenDetail(rule)}
                aria-selected={isSelected}
                className={cn(
                  "relative cursor-pointer border-b border-border/70 outline-none transition-colors",
                  "hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring dark:hover:bg-accent",
                  isSelected && "bg-primary/[0.06] dark:bg-primary/10",
                  rule.severity === "Critical" && rule.status === "Enabled" && "shadow-[inset_3px_0_0_oklch(0.5771_0.2152_27.33)]",
                )}
              >
                <td className="px-3 py-2.5 align-middle" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select rule ${rule.id}`}
                    checked={isSelected}
                    onChange={() => toggleRow(rule)}
                    className="h-4 w-4 cursor-pointer rounded border-input accent-[oklch(0.5855_0.1885_255.72)]"
                  />
                </td>
                <td className="px-3 py-2.5 align-middle" onClick={(event) => event.stopPropagation()}>
                  <div className="flex flex-col items-start gap-1">
                    <ToggleSwitch
                      size="sm"
                      checked={rule.status === "Enabled"}
                      onChange={() => onToggle(rule)}
                      label={`${rule.status === "Enabled" ? "Disable" : "Enable"} rule ${rule.name}`}
                    />
                    <span className={cn("inline-flex items-center gap-1 text-[0.625rem] font-semibold", statusMeta.className)}>
                      <StatusIcon size={10} aria-hidden="true" />
                      {rule.status}
                    </span>
                    {mutedByWindow && <a href={`/maintenance-windows/${mutedByWindow}`} className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-violet-600 hover:underline dark:text-violet-400" onClick={(event) => event.stopPropagation()}>by {mutedByWindow}</a>}
                  </div>
                </td>
                <td className="min-w-0 max-w-[20rem] px-3 py-2.5 align-middle">
                  <p className="truncate text-[0.8125rem] font-semibold text-foreground">{rule.name}</p>
                  <p className="truncate text-[0.75rem] text-muted-foreground" title={conditionText}>{conditionText}</p>
                </td>
                <td className={cn("hidden px-3 py-2.5 align-middle", columns.type && "sm:table-cell")}><TypeBadge type={rule.type} /></td>
                <td className="hidden px-3 py-2.5 align-middle md:table-cell"><SeverityBadge severity={rule.severity} /></td>
                <td className="hidden px-3 py-2.5 align-middle lg:table-cell">
                  <p className="text-[0.8125rem] text-foreground">{rule.target}</p>
                  <p className="text-[0.6875rem] text-muted-foreground">{rule.targetType}</p>
                </td>
                <td className={cn("hidden px-3 py-2.5 align-middle", columns.notifications && "xl:table-cell")}><ChannelIcons channels={rule.notifications.channels} /></td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 align-middle text-[0.75rem] text-foreground md:table-cell" title={rule.lastFiredAt ? new Date(rule.lastFiredAt).toLocaleString() : "Never fired"}>
                  {formatLastFired(rule)}
                </td>
                <td className={cn("hidden whitespace-nowrap px-3 py-2.5 align-middle", columns.activity && "sm:table-cell")}>
                  <span className="flex items-center gap-2">
                    <FireSparkline history={rule.fireHistory} fired24h={rule.fired24h} />
                    <span className="text-[0.75rem] font-semibold tabular-nums text-foreground">{rule.fired24h}</span>
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right align-middle" onClick={(event) => event.stopPropagation()}>
                  <AlertMenu
                    label={`Actions for ${rule.id}`}
                    items={kebabItemsFor(rule, actions, (href) => router.push(href))}
                    trigger={
                      <button
                        type="button"
                        aria-label={`Actions for rule ${rule.id}`}
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
        <p className="text-[0.75rem] text-muted-foreground" aria-live="polite">
          Showing {start + 1}-{start + visible.length} of {rules.length}
        </p>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
            <SelectTrigger aria-label="Rows per page" className="h-8 w-[6.875rem] rounded-lg text-[0.75rem]"><SelectValue /></SelectTrigger>
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
          <span className="min-w-[4rem] text-center text-[0.75rem] font-medium text-foreground">Page {safePage} / {maxPage}</span>
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

