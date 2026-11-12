"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlarmClock, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Clock,
  ClipboardCopy, FileText, ShieldAlert, Wrench,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EVENT_RECORDS, relativeTime, type EventRecord, type EventStatus, type EventSeverity } from "@/data/mock/events";

const SEVERITY_BADGE: Record<EventSeverity, string> = {
  Critical: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  Warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  Info: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  Debug: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};
const STATUS_META: Record<EventStatus, { icon: typeof Clock; className: string }> = {
  Open: { icon: CircleAlert, className: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
  Investigating: { icon: AlarmClock, className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  Acknowledged: { icon: Clock, className: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" },
  Resolved: { icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
};

/** 500ms mock fetch so the loading skeleton is exercised; replace with a real API call. */
function useMockEvent(id: string | undefined) {
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => {
      setEvent(id ? EVENT_RECORDS.find((item) => item.id === id) ?? null : null);
      setLoading(false);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [id]);
  return { event, loading };
}

export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const { event, loading } = useMockEvent(params.eventId);
  const [status, setStatus] = useState<EventStatus | null>(null);
  const [toast, setToast] = useState("");

  const currentStatus = status ?? event?.status ?? "Open";
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };

  useEffect(() => { if (event) setStatus(event.status); }, [event]);

  const index = event ? EVENT_RECORDS.findIndex((item) => item.id === event.id) : -1;
  const previous = index > 0 ? EVENT_RECORDS[index - 1] : null;
  const next = index >= 0 && index < EVENT_RECORDS.length - 1 ? EVENT_RECORDS[index + 1] : null;
  const related = event ? EVENT_RECORDS.filter((item) => item.id !== event.id && (item.category === event.category || item.host === event.host)).slice(0, 3) : [];

  if (loading) {
    return (
      <div className="space-y-4 pb-4" aria-busy="true" aria-label="Loading event details">
        <div className="h-9 w-80 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Monitoring", "Event Explorer", "Not found"]} title="Event not found" subtitle="No event matches that identifier." icon={<CircleAlert size={19} />} actions={<Button variant="outline" onClick={() => router.back()} className="h-10 rounded-lg px-3 text-sm"><ChevronLeft size={15} />Back</Button>} />
        <section className="grid place-items-center rounded-xl border border-border bg-card p-10 text-center">
          <div className="flex max-w-md flex-col items-center gap-2">
            <p className="text-sm font-semibold text-foreground">We could not find <code className="font-mono">{params.eventId}</code></p>
            <p className="text-[13px] text-muted-foreground">The event may have been purged from the retention window, or the link may be incorrect.</p>
            <Button asChild className="mt-1 h-9 rounded-lg px-4 text-sm">
              <Link href="/events-explorer"><ChevronLeft size={15} />Event Explorer</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const StatusIcon = STATUS_META[currentStatus].icon;
  const severityBadge = SEVERITY_BADGE[event.severity];
  const timelineSteps: Array<{ label: string; done: boolean; time?: string }> = [
    { label: "Created", done: true, time: relativeTime(event.epochMs) },
    { label: "Acknowledged", done: currentStatus !== "Open", time: currentStatus !== "Open" ? "ack." : undefined },
    { label: "Resolved", done: currentStatus === "Resolved", time: currentStatus === "Resolved" ? "done" : undefined },
  ];

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Monitoring", "Event Explorer", event.id]}
        title={event.message}
        subtitle="Full details, timeline and related events for this infrastructure event."
        statusBadge={
          <span className="flex shrink-0 items-center gap-1.5">
            <span className={cn("inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold", severityBadge)}>{event.severity}</span>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", STATUS_META[currentStatus].className)}><StatusIcon size={11} aria-hidden="true" />{currentStatus}</span>
          </span>
        }
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => router.back()} className="h-10 gap-1.5 rounded-lg px-3 text-sm"><ChevronLeft size={15} />Back</Button>
            {currentStatus !== "Acknowledged" && currentStatus !== "Resolved" && <Button variant="outline" onClick={() => { setStatus("Acknowledged"); notify("Event acknowledged."); }} className="h-10 gap-1.5 rounded-lg px-3 text-sm">Acknowledge</Button>}
            {currentStatus !== "Resolved" && <Button variant="outline" onClick={() => { setStatus("Resolved"); notify("Event marked resolved."); }} className="h-10 gap-1.5 rounded-lg px-3 text-sm">Resolve</Button>}
            <Button variant="outline" onClick={() => notify("Assignment flow is a mock action.")} className="h-10 gap-1.5 rounded-lg px-3 text-sm"><Wrench size={15} />Assign</Button>
            <Button onClick={() => notify("Alert rule created from this event (mock).")} className="h-10 gap-1.5 rounded-lg px-3 text-sm"><ShieldAlert size={15} />Create Alert Rule</Button>
          </div>
        }
      />

      <section className="grid items-stretch gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Overview" className="flex h-full min-w-0 flex-col rounded-xl p-4" titleClassName="text-[16px] font-semibold">
          <dl className="grid flex-1 grid-cols-[110px_minmax(0,1fr)] gap-y-2 pt-1 text-[13px]">
            <dt className="text-muted-foreground">Event ID</dt><dd className="font-mono text-foreground">{event.id}</dd>
            <dt className="text-muted-foreground">Time</dt><dd className="tabular-nums text-foreground">{new Date(event.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</dd>
            <dt className="text-muted-foreground">Source</dt><dd className="text-foreground">{event.source}</dd>
            <dt className="text-muted-foreground">Host</dt><dd className="text-foreground">{event.host}</dd>
            <dt className="text-muted-foreground">Location</dt><dd className="text-foreground">{event.location}</dd>
            <dt className="text-muted-foreground">Category</dt><dd className="text-foreground">{event.category}</dd>
            <dt className="text-muted-foreground">Infrastructure</dt><dd className="text-foreground">{event.infrastructure}</dd>
            <dt className="text-muted-foreground">Severity</dt><dd><span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", severityBadge)}>{event.severity}</span></dd>
            <dt className="text-muted-foreground">Status</dt><dd><span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_META[currentStatus].className)}><StatusIcon size={11} aria-hidden="true" />{currentStatus}</span></dd>
            <dt className="text-muted-foreground">Duration</dt><dd className="text-foreground">{event.mttrMinutes ? `${event.mttrMinutes}m (MTTR ${event.mttrMinutes}m)` : "Ongoing"}</dd>
            <dt className="text-muted-foreground">Occurrences</dt><dd className="tabular-nums text-foreground">×{event.count}</dd>
            {event.assignee && <><dt className="text-muted-foreground">Assignee</dt><dd className="text-foreground">{event.assignee}</dd></>}
          </dl>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <Link href="/logs-explorer" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"><FileText size={14} aria-hidden="true" />View in Logs</Link>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}/events-explorer/${event.id}`).catch(() => undefined); notify("Link copied."); }} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"><ClipboardCopy size={14} aria-hidden="true" />Copy link</button>
          </div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Description" className="flex min-w-0 flex-col rounded-xl p-4" titleClassName="text-[16px] font-semibold">
            <p className="pt-1 text-[13px] leading-6 text-foreground">{event.description}</p>
          </Panel>
          <Panel title="Timeline" className="flex min-w-0 flex-col rounded-xl p-4" titleClassName="text-[16px] font-semibold">
            <ol className="flex flex-1 flex-col justify-between gap-3 pt-1" aria-label="Resolution timeline">
              {timelineSteps.map((step, index) => (
                <li key={step.label} className="flex items-center gap-3 text-[13px]">
                  <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border", step.done ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "border-border bg-card text-muted-foreground")}>{step.done ? <CheckCircle2 size={14} aria-hidden="true" /> : <span className="text-[10px] font-bold">{index + 1}</span>}</span>
                  <span className={cn("font-medium", step.done ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
                  {step.time && <span className="ml-auto text-[12px] text-muted-foreground">{step.time}</span>}
                </li>
              ))}
            </ol>
            {currentStatus === "Resolved" && (
              <div className="mt-auto flex items-center gap-2 border-t border-border pt-3 text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={16} aria-hidden="true" />Event resolved · MTTR {event.mttrMinutes ?? "—"}m
              </div>
            )}
          </Panel>
        </div>
      </section>

      <Panel title="Related Events" className="flex min-w-0 flex-col rounded-xl p-4" titleClassName="text-[16px] font-semibold" action={<Link href="/events-explorer" className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">View all <ArrowRight size={14} aria-hidden="true" /></Link>}>
        <ul className="flex flex-1 flex-col divide-y divide-border/60 pt-1">
          {related.map((item) => {
            const RelatedStatusIcon = STATUS_META[item.status].icon;
            return (
              <li key={item.id}>
                <Link href={`/events-explorer/${item.id}`} className="grid h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", SEVERITY_BADGE[item.severity])}>{item.severity}</span>
                  <span className="min-w-0 truncate text-[13px] text-foreground" title={item.message}>{item.message}</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold", STATUS_META[item.status].className)}><RelatedStatusIcon size={11} aria-hidden="true" />{item.status}</span>
                </Link>
              </li>
            );
          })}
          {related.length === 0 && <li className="py-4 text-center text-[13px] text-muted-foreground">No related events in the current retention window.</li>}
        </ul>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[13px]">
          <span>
            {previous ? <button type="button" onClick={() => router.push(`/events-explorer/${previous.id}`)} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"><ChevronLeft size={14} aria-hidden="true" />Previous event</button> : <span className="text-muted-foreground">First event</span>}
          </span>
          <span>
            {next ? <button type="button" onClick={() => router.push(`/events-explorer/${next.id}`)} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">Next event<ChevronRight size={14} aria-hidden="true" /></button> : <span className="text-muted-foreground">Last event</span>}
          </span>
        </div>
      </Panel>

      {toast && <div role="status" className="fixed bottom-4 right-4 z-[1300] rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-lg">{toast}</div>}
    </div>
  );
}
