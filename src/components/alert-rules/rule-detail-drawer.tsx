"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { BellOff, BookOpen, CheckCircle2, Copy, Mail, MessageSquare, PenLine, ShieldOff, Webhook, X, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AlertRule, NotificationChannel, RuleSeverity, RuleStatus, RuleType } from "@/mocks/alertRules";
import { maintenanceWindowMutingRule } from "@/mocks/maintenanceWindows";
import { getRunbookForRule } from "@/mocks/runbooks";
import { formatCondition } from "@/utils/formatCondition";
import { formatDateTime } from "@/utils/alertStats";
import { timeAgo } from "@/mocks/logs";
import { cn } from "@/lib/utils";

interface RuleDetailDrawerProps {
  rule: AlertRule | null;
  onClose: () => void;
  onEdit: (rule: AlertRule) => void;
  onToggle: (rule: AlertRule) => void;
  onCopyLink: (rule: AlertRule) => void;
}

const SEVERITY_BADGE: Record<RuleSeverity, string> = {
  Critical: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  Warning: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  Info: "bg-blue-100 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400",
};

const STATUS_BADGE: Record<RuleStatus, { label: string; icon: typeof Zap; className: string }> = {
  Enabled: { label: "Enabled", icon: CheckCircle2, className: "bg-green-600/10 text-green-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
  Muted: { label: "Muted", icon: BellOff, className: "bg-slate-200/70 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
  Disabled: { label: "Disabled", icon: ShieldOff, className: "bg-slate-200/70 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
};

const TYPE_BADGE: Record<RuleType, string> = {
  Threshold: "bg-[oklch(0.9595_0.008_253.85)] text-[oklch(0.3753_0.0501_263.06)] dark:bg-slate-500/15 dark:text-slate-300",
  Anomaly: "bg-purple-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  Composite: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

const CHANNEL_ICON: Record<NotificationChannel, { icon: typeof Zap; label: string }> = {
  Email: { icon: Mail, label: "Email" },
  Slack: { icon: MessageSquare, label: "Slack" },
  PagerDuty: { icon: Zap, label: "PagerDuty" },
  Webhook: { icon: Webhook, label: "Webhook" },
};

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-[0.75rem] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[0.8125rem] font-medium text-foreground">{children}</dd>
    </div>
  );
}

/** Right-side rule detail drawer (35rem, full-screen on mobile). */
export function RuleDetailDrawer({ rule, onClose, onEdit, onToggle, onCopyLink }: RuleDetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const open = rule != null;

  useEffect(() => {
    if (!open) return;
    drawerRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusables = drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, rule?.id, onClose]);

  if (!rule || typeof document === "undefined") return null;

  const statusMeta = STATUS_BADGE[rule.status];
  const StatusIcon = statusMeta.icon;
  const history = rule.fireHistory.map((fires, index) => ({ hour: `${String(index).padStart(2, "0")}:00`, fires }));
  const conditionText = formatCondition(rule.condition);

  return createPortal(
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[1290] bg-slate-950/40" onClick={onClose} />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rule-detail-title"
        className="animate-drawer-in fixed inset-y-0 right-0 z-[1300] flex w-full flex-col border-l border-border bg-card shadow-2xl sm:w-[35rem]"
      >
        {/* Header */}
        <header className="flex flex-col gap-3 border-b border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("gap-1 border-transparent px-2 py-0.5 text-[0.625rem] font-semibold", SEVERITY_BADGE[rule.severity])}>{rule.severity}</Badge>
              <Badge variant="outline" className={cn("gap-1 border-transparent px-2 py-0.5 text-[0.625rem] font-semibold", TYPE_BADGE[rule.type])}>{rule.type}</Badge>
              <Badge variant="outline" className={cn("gap-1 border-transparent px-2 py-0.5 text-[0.625rem] font-semibold", statusMeta.className)}>
                <StatusIcon size={11} aria-hidden="true" />
                {statusMeta.label}
              </Badge>
            </div>
            <button
              type="button"
              data-autofocus
              onClick={onClose}
              aria-label="Close rule details"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="min-w-0">
            <h2 id="rule-detail-title" className="truncate font-display text-[1.0625rem] font-bold tracking-tight text-foreground">{rule.name}</h2>
            <button
              type="button"
              onClick={() => onCopyLink(rule)}
              className="mt-0.5 inline-flex items-center gap-1 rounded text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Copy link to rule ${rule.id}`}
            >
              {rule.id}
              <Copy size={11} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => onEdit(rule)} >
              <PenLine size={13} aria-hidden="true" />Edit
            </Button>
            <Button variant="outline" onClick={() => onToggle(rule)} >
              {rule.status === "Enabled" ? <ShieldOff size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
              {rule.status === "Enabled" ? "Disable" : "Enable"}
            </Button>
            {rule.status === "Muted" && rule.mutedUntil && (
              <span className="inline-flex items-center gap-1 text-[0.75rem] text-muted-foreground">
                <BellOff size={12} aria-hidden="true" />Muted until {formatDateTime(new Date(rule.mutedUntil).getTime())}
              </span>
            )}
            {(() => { const mutedBy = maintenanceWindowMutingRule(rule.id); return mutedBy ? <Link href={`/maintenance-windows/${mutedBy}`} className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-violet-600 hover:underline dark:text-violet-400"><BellOff size={12} aria-hidden="true" />Muted by {mutedBy}</Link> : null; })()}
          </div>
        </header>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="text-[0.8125rem] leading-relaxed text-foreground">{rule.description}</p>

          <h3 className="mt-5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Condition</h3>
          <p className="mt-1 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 font-mono text-[0.75rem] leading-snug text-foreground">{conditionText}</p>
          <dl className="mt-2 divide-y divide-border/70">
            <SummaryRow label="Evaluation interval">{rule.condition.evaluationInterval ?? "30s"}</SummaryRow>
            <SummaryRow label="Target">{rule.target} · {rule.targetType}{rule.environment ? ` · ${rule.environment}` : ""}</SummaryRow>
            {rule.exclude && rule.exclude.length > 0 && <SummaryRow label="Excluded">{rule.exclude.join(", ")}</SummaryRow>}
            <SummaryRow label="Tags">{rule.tags.length > 0 ? rule.tags.join(", ") : "—"}</SummaryRow>
            <SummaryRow label="Last fired">{rule.lastFiredAt ? `${timeAgo(new Date(rule.lastFiredAt).getTime())} (${formatDateTime(new Date(rule.lastFiredAt).getTime())})` : "Never"}</SummaryRow>
          </dl>

          <h3 className="mt-5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Fire history · last 24h</h3>
          <div className="mt-2 h-[7.5rem] w-full" aria-label={`Fire history chart, ${rule.fired24h} fires in the last 24 hours`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barCategoryGap={1}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" interval={5} tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} width={30} tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ border: "0.0625rem solid var(--border)", borderRadius: 8, fontSize: 11, background: "var(--popover)" }} />
                <Bar dataKey="fires" name="Fires" fill="oklch(0.6658 0.1574 58.32)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3 className="mt-5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Notification policy</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {rule.notifications.channels.map((channel) => {
              const meta = CHANNEL_ICON[channel];
              return (
                <span key={channel} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-[0.75rem] font-medium text-foreground">
                  <meta.icon size={12} aria-hidden="true" />
                  {meta.label}
                </span>
              );
            })}
          </div>
          <dl className="mt-2 divide-y divide-border/70">
            <SummaryRow label="Recipients">{rule.notifications.recipients.join(", ")}</SummaryRow>
            <SummaryRow label="Escalation">{rule.notifications.escalationMinutes > 0 ? `after ${rule.notifications.escalationMinutes}m unacknowledged` : "None"}</SummaryRow>
            <SummaryRow label="Repeat interval">every {rule.notifications.repeatInterval}</SummaryRow>
            <SummaryRow label="Quiet hours">{rule.notifications.respectQuietHours ? "Respected" : "Ignored"}</SummaryRow>
          </dl>

          <h3 className="mt-5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Runbook</h3>
          {(() => {
            const linked = getRunbookForRule(rule.id);
            return linked ? (
              <p className="mt-1.5 text-[0.8125rem]">
                <Link href={`/runbooks/${linked.id}`} className="inline-flex max-w-full items-center gap-1.5 rounded font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <BookOpen size={13} aria-hidden="true" className="shrink-0" />
                  <span className="truncate">{linked.id} · {linked.title}</span>
                </Link>
              </p>
            ) : (
              <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
                No runbook linked.{" "}
                <Link href={`/runbooks/new?rule=${rule.id}`} className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Create one →</Link>
              </p>
            );
          })()}

          <h3 className="mt-5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Recent alerts</h3>
          {rule.recentFires.length === 0 ? (
            <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">No alerts fired in the last 24h.</p>
          ) : (
            <ul className="mt-1.5 divide-y divide-border/70">
              {rule.recentFires.map((fire) => (
                <li key={fire.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0">
                    <Link href={`/alerts?alert=${fire.id}`} className="text-[0.8125rem] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                      {fire.id}
                    </Link>
                    <span className="block truncate text-[0.75rem] text-muted-foreground">{fire.detail}</span>
                  </span>
                  <span className="shrink-0 text-[0.6875rem] text-muted-foreground" title={formatDateTime(fire.epochMs)}>{timeAgo(fire.epochMs)}</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Audit log</h3>
          <ol className="mt-1.5 space-y-0" aria-label="Rule audit log">
            {rule.audit.map((entry, index) => (
              <li key={entry.id} className="relative flex gap-3 pb-3 last:pb-0">
                {index < rule.audit.length - 1 && <span aria-hidden="true" className="absolute left-[0.25rem] top-3 h-full w-px bg-border" />}
                <span aria-hidden="true" className="relative mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-400 ring-2 ring-card" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] font-medium text-foreground">{entry.action}</span>
                  <span className="block text-[0.6875rem] text-muted-foreground">{entry.actor} · {formatDateTime(entry.epochMs)}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[0.6875rem] text-muted-foreground">Last updated by {rule.updatedBy} · {rule.updatedAt}</p>
        </div>
      </aside>
    </>,
    document.body,
  );
}
