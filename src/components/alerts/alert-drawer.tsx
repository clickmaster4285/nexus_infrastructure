"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  BellOff, BookOpen, CheckCircle2, Copy, ExternalLink, X,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALERT_ASSIGNEES, type Alert, type AlertSeverity, type AlertStatus } from "@/mocks/alerts";
import { alertDuration, formatDateTime } from "@/utils/alertStats";
import { timeAgo } from "@/mocks/logs";
import { cn } from "@/lib/utils";

interface AlertDrawerProps {
  alert: Alert | null;
  onClose: () => void;
  onAcknowledge: (id: string) => void;
  onAssign: (id: string, user: string | null) => void;
  onResolve: (id: string) => void;
  onAddNote: (id: string, note: string) => void;
  onCopyLink: (alert: Alert) => void;
}

const SEVERITY_BADGE: Record<AlertSeverity, { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-[#FEE2E2] text-[#DC2626] dark:bg-red-500/15 dark:text-red-400" },
  warning: { label: "Warning", className: "bg-[#FEF3C7] text-[#D97706] dark:bg-amber-500/15 dark:text-amber-400" },
  info: { label: "Info", className: "bg-[#DBEAFE] text-[#3B82F6] dark:bg-blue-500/15 dark:text-blue-400" },
};

const STATUS_BADGE: Record<AlertStatus, { label: string; className: string }> = {
  firing: { label: "Firing", className: "bg-[#DC2626]/10 text-[#DC2626] dark:bg-red-500/15 dark:text-red-400" },
  acknowledged: { label: "Acknowledged", className: "bg-[#D97706]/10 text-[#D97706] dark:bg-amber-500/15 dark:text-amber-400" },
  silenced: { label: "Silenced", className: "bg-slate-200/70 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300" },
  resolved: { label: "Resolved", className: "bg-[#16A34A]/10 text-[#16A34A] dark:bg-emerald-500/15 dark:text-emerald-400" },
};

const LINE_COLOR: Record<AlertSeverity, string> = { critical: "#DC2626", warning: "#D97706", info: "#3B82F6" };

const TIMELINE_DOT: Record<string, string> = {
  triggered: "bg-[#DC2626]",
  notified: "bg-[#3B82F6]",
  acknowledged: "bg-[#D97706]",
  assigned: "bg-[#874fe0]",
  silenced: "bg-slate-400",
  resolved: "bg-[#16A34A]",
  note: "bg-slate-400",
};

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-[12px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[13px] font-medium text-foreground">{children}</dd>
    </div>
  );
}

/** Right-side alert detail drawer (480px, full-screen on mobile). */
export function AlertDrawer({ alert, onClose, onAcknowledge, onAssign, onResolve, onAddNote, onCopyLink }: AlertDrawerProps) {
  const [note, setNote] = useState("");
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const open = alert != null;

  useEffect(() => {
    if (!open) return;
    setNote("");
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
  }, [open, alert?.id, onClose]);

  if (!alert || typeof document === "undefined") return null;

  const severityMeta = SEVERITY_BADGE[alert.severity];
  const statusMeta = STATUS_BADGE[alert.status];

  return createPortal(
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[1290] bg-slate-950/40" onClick={onClose} />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-drawer-title"
        className="animate-drawer-in fixed inset-y-0 right-0 z-[1300] flex w-full flex-col border-l border-border bg-card shadow-2xl sm:w-[480px]"
      >
        {/* Header */}
        <header className="flex flex-col gap-3 border-b border-border p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("border-transparent px-2 py-0.5 text-[10px] font-semibold", severityMeta.className)}>{severityMeta.label}</Badge>
              <Badge variant="outline" className={cn("border-transparent px-2 py-0.5 text-[10px] font-semibold", statusMeta.className)}>{statusMeta.label}</Badge>
            </div>
            <button
              type="button"
              data-autofocus
              onClick={onClose}
              aria-label="Close alert details"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="min-w-0">
            <h2 id="alert-drawer-title" className="truncate font-display text-[17px] font-bold tracking-tight text-foreground">{alert.name}</h2>
            <button
              type="button"
              onClick={() => onCopyLink(alert)}
              className="mt-0.5 inline-flex items-center gap-1 rounded text-[12px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Copy link to alert ${alert.id}`}
            >
              {alert.id}
              <Copy size={11} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onAcknowledge(alert.id)} disabled={alert.status !== "firing"} className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px]">
              <CheckCircle2 size={13} aria-hidden="true" />Acknowledge
            </Button>
            <Select value={alert.assignee ?? "none"} onValueChange={(value) => onAssign(alert.id, value === "none" ? null : value)}>
              <SelectTrigger aria-label="Assign alert" className="h-8 w-[150px] rounded-lg text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {ALERT_ASSIGNEES.map((user) => (
                  <SelectItem key={user} value={user}>{user}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => onResolve(alert.id)} disabled={alert.status === "resolved"} className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px]">
              Resolve
            </Button>
          </div>
        </header>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="text-[13px] leading-relaxed text-foreground">{alert.message}</p>

          <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Summary</h3>
          <dl className="mt-1 divide-y divide-border/70">
            <SummaryRow label="Host">{alert.host}</SummaryRow>
            <SummaryRow label="Service">{alert.service}</SummaryRow>
            <SummaryRow label="Rule">{alert.ruleId} · {alert.ruleName}</SummaryRow>
            <SummaryRow label="Source">{alert.source}</SummaryRow>
            <SummaryRow label="Triggered">{formatDateTime(alert.epochMs)}</SummaryRow>
            <SummaryRow label="Duration">{alertDuration(alert, Date.now())}</SummaryRow>
            <SummaryRow label="Occurrences">{alert.occurrences}</SummaryRow>
            <SummaryRow label="Assignee">{alert.assignee ?? "Unassigned"}</SummaryRow>
          </dl>

          <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Metric snapshot · last 2h</h3>
          <div className="mt-2 h-[150px] w-full" aria-label={`${alert.severity === "info" ? "Metric" : "Threshold metric"} history`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={alert.metric} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" interval={5} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis domain={["auto", "auto"]} width={38} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
                <ReferenceLine
                  y={alert.threshold}
                  stroke="#64748b"
                  strokeDasharray="5 4"
                  label={{ value: `Threshold ${alert.threshold}${alert.unit}`, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 10 }}
                />
                <Line dataKey="value" name="Observed" type="monotone" stroke={LINE_COLOR[alert.severity]} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h3>
          <ol className="mt-2 space-y-0" aria-label="Alert timeline">
            {alert.timeline.map((item, index) => (
              <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                {index < alert.timeline.length - 1 && <span aria-hidden="true" className="absolute left-[4.5px] top-3.5 h-full w-px bg-border" />}
                <span aria-hidden="true" className={cn("relative mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-card", TIMELINE_DOT[item.kind] ?? "bg-slate-400")} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground">
                    {item.label}
                    {item.user && <span className="ml-1.5 font-normal text-muted-foreground">· {item.user}</span>}
                  </p>
                  {item.detail && <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{item.detail}</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground" title={formatDateTime(item.epochMs)}>{timeAgo(item.epochMs)}</p>
                </div>
              </li>
            ))}
          </ol>

          <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Related</h3>
          <div className="mt-2 flex flex-col gap-2">
            <Link
              href={`/events-explorer/${alert.eventId}`}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ExternalLink size={14} aria-hidden="true" className="text-muted-foreground" />
              Related event · {alert.eventId}
            </Link>
            <Link
              href="/runbooks"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BookOpen size={14} aria-hidden="true" className="text-muted-foreground" />
              Runbook · {alert.runbook}
            </Link>
            {alert.silencedUntil && (
              <p className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
                <BellOff size={13} aria-hidden="true" />
                Silenced until {formatDateTime(new Date(alert.silencedUntil).getTime())}
              </p>
            )}
          </div>

          <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
          <form
            className="mt-2 flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = note.trim();
              if (!trimmed) return;
              onAddNote(alert.id, trimmed);
              setNote("");
            }}
          >
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add an investigation note…"
              aria-label="Add note"
              className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" size="sm" disabled={!note.trim()} className="h-9 rounded-lg px-3 text-[12px]">Add</Button>
          </form>
        </div>
      </aside>
    </>,
    document.body,
  );
}
