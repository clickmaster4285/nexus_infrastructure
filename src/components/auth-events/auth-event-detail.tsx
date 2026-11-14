"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertOctagon, AlertTriangle, ArrowLeft, ArrowRight, Ban, Bug, CheckCircle2, ChevronLeft, ChevronRight,
  CircleAlert, Globe, KeyRound, Laptop, Lock, LockOpen, MapPin, Moon, MoreVertical, Network,
  RotateCcw, ShieldCheck, SquareTerminal, UserRound, Users, Copy, Check, Server, AppWindow, SearchX,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartCard } from "@/components/logs/primitives";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { CountryFlag } from "@/components/shared/country-flag";
import {
  BlockIpDialog, LockAccountDialog, ForceResetDialog, RevokeSessionsDialog,
  MarkReviewedDialog, FalsePositiveDialog, CreateIncidentDialog, AuthToast, useAuthToast,
} from "@/components/auth-events/auth-actions";
import {
  ResultBadge, SeverityBadge, RiskScoreBar, FlagChips, timeAgo, fullTime, timeZoneLabel, targetHref, riskTone,
} from "@/components/auth-events/auth-shared";
import { AlertMenu } from "@/components/alerts/alert-menu";
import { cn } from "@/lib/utils";
import {
  AUTH_BRUTE_FORCE_SUSPECTS, AUTH_DETECTION_LABEL, getAuthSummary, isAuthAccountLocked, isAuthIpBlocked,
  loadAuthDetections, loadAuthEvents, type AuthDetection, type AuthEvent, type AuthRiskFlag,
} from "@/mocks/security";

interface AuthEventDetailProps {
  eventId: string;
}

const RISK_ICON: Record<AuthRiskFlag, typeof AlertOctagon> = {
  brute_force: Bug,
  password_spray: Users,
  impossible_travel: MapPin,
  new_location: Globe,
  new_device: Laptop,
  off_hours: Moon,
  privileged: ShieldCheck,
  mfa_fatigue: KeyRound,
  anonymizer: Network,
};

function riskReason(event: AuthEvent, flag: AuthRiskFlag): string {
  const suspect = AUTH_BRUTE_FORCE_SUSPECTS.find((entry) => entry.ip === event.ip);
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  switch (flag) {
    case "impossible_travel":
      return event.impossibleTravel
        ? `Impossible travel: ${event.impossibleTravel.fromCity} ${timeOf(event.impossibleTravel.fromTime)} to ${event.impossibleTravel.toCity} ${timeOf(event.impossibleTravel.toTime)} (~${event.impossibleTravel.distanceKm.toLocaleString()} km in ${event.impossibleTravel.minutes} min)`
        : "Two sign-ins too far apart to be physically plausible.";
    case "brute_force":
      return suspect
        ? `${suspect.attempts} failed attempts against ${suspect.usersTargeted} accounts from ${event.ip} in the last ${suspect.firstSeenHoursAgo}h.`
        : `Failed-login burst from ${event.ip} matches a brute-force pattern.`;
    case "password_spray":
      return `Slow spray from ${event.ip}: a few attempts per account across many accounts.`;
    case "mfa_fatigue":
      return "Multiple consecutive MFA prompts denied by the user - approval fatigue pattern.";
    case "new_location":
      return `First sign-in from ${event.city}, ${event.country} for this account in the last 30 days.`;
    case "new_device":
      return `Device "${event.device}" has not been seen on this account before.`;
    case "off_hours":
      return `Signed in at ${timeOf(event.time)} local time - outside the 06:00-22:00 business window.`;
    case "privileged":
      return "Administrator-level account - elevated blast radius if compromised.";
    case "anonymizer":
      return `Traffic via a known anonymizer/exit node (${event.ip}).`;
  }
}

/** Deterministic mock network origin for the source IP. */
function mockAsn(ip: string): { asn: string; org: string } {
  const asns = [
    { asn: "AS64512", org: "MockNet Hosting (sim)" },
    { asn: "AS13335", org: "Cloudflare-mock (sim)" },
    { asn: "AS16509", org: "Amazon-mock (sim)" },
    { asn: "AS16276", org: "OVH-mock (sim)" },
  ];
  const hash = [...ip].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return asns[hash % asns.length];
}

export function AuthEventDetail({ eventId }: AuthEventDetailProps) {
  const router = useRouter();
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [detections, setDetections] = useState<AuthDetection[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [copied, setCopied] = useState(false);
  const [blockIps, setBlockIps] = useState<string[] | null>(null);
  const [lockTarget, setLockTarget] = useState<{ user: string; locked: boolean } | null>(null);
  const [forceResetTarget, setForceResetTarget] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [markReviewedOpen, setMarkReviewedOpen] = useState(false);
  const [falsePositiveOpen, setFalsePositiveOpen] = useState(false);
  const [incidentPrefill, setIncidentPrefill] = useState<{ title: string; impact: string; hosts?: string[] } | null>(null);
  const { toast, notify, dismiss } = useAuthToast();

  const load = useCallback(() => {
    setStatus("loading");
    const forcedError = typeof window !== "undefined" && window.location.search.includes("authError=1");
    const timer = window.setTimeout(() => {
      if (forcedError) {
        setStatus("error");
        return;
      }
      Promise.all([loadAuthEvents(), loadAuthDetections()])
        .then(([loadedEvents, loadedDetections]) => {
          setEvents(loadedEvents);
          setDetections(loadedDetections);
          setStatus("success");
          setLastUpdated(new Date());
        })
        .catch(() => setStatus("error"));
    }, 220);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => load(), [load]);

  const event = useMemo(() => events.find((item) => item.id === eventId) ?? null, [events, eventId]);
  const ordered = useMemo(() => [...events].sort((a, b) => Date.parse(b.time) - Date.parse(a.time)), [events]);
  const eventIndex = ordered.findIndex((item) => item.id === eventId);
  const newerEvent = eventIndex > 0 ? ordered[eventIndex - 1] : null;
  const olderEvent = eventIndex >= 0 && eventIndex < ordered.length - 1 ? ordered[eventIndex + 1] : null;

  const userEvents = useMemo(() => (event ? ordered.filter((item) => item.user === event.user).slice(0, 10) : []), [ordered, event]);
  const relatedEvents = useMemo(() => {
    if (!event) return [];
    return ordered
      .filter((item) => item.id !== event.id && (item.user === event.user || item.ip === event.ip))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 8);
  }, [ordered, event]);
  const userProfile = useMemo(() => {
    if (!event) return { usualLocations: [] as Array<[string, number]>, usualDevices: [] as Array<[string, number]> };
    const locationCount = new Map<string, number>();
    const deviceCount = new Map<string, number>();
    for (const item of userEvents) {
      if (item.id === event.id) continue;
      locationCount.set(item.country, (locationCount.get(item.country) ?? 0) + 1);
      deviceCount.set(item.device, (deviceCount.get(item.device) ?? 0) + 1);
    }
    return {
      usualLocations: [...locationCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
      usualDevices: [...deviceCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2),
    };
  }, [userEvents, event]);
  const sourceSuspect = event ? AUTH_BRUTE_FORCE_SUSPECTS.find((entry) => entry.ip === event.ip) : undefined;
  const linkedDetection = useMemo(() => detections.find((item) => item.relatedEventIds.includes(eventId)) ?? null, [detections, eventId]);
  const asn = event ? mockAsn(event.ip) : null;
  const locked = event ? isAuthAccountLocked(event.user) : false;
  const ipBlocked = event ? isAuthIpBlocked(event.ip) : false;

  if (status === "loading") {
    return (
      <div className="space-y-4 pb-4" aria-busy="true">
        <div className="h-[6.875rem] animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8"><div className="h-64 animate-pulse rounded-xl bg-muted" /><div className="h-56 animate-pulse rounded-xl bg-muted" /><div className="h-64 animate-pulse rounded-xl bg-muted" /></div>
          <div className="space-y-4 xl:col-span-4"><div className="h-56 animate-pulse rounded-xl bg-muted" /><div className="h-56 animate-pulse rounded-xl bg-muted" /><div className="h-40 animate-pulse rounded-xl bg-muted" /></div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Security", "Authentication Events", eventId]} title="Event could not be loaded" subtitle="Authentication Events" />
        <Card className="grid min-h-[17.5rem] place-items-center rounded-xl p-6">
          <div className="text-center">
            <CircleAlert className="mx-auto text-rose-500" size={28} />
            <h2 className="mt-2 text-base font-semibold">Failed to load {eventId}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Retry to reload this event.</p>
            <Button className="mt-4" onClick={load}><RotateCcw size={15} />Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="space-y-4 pb-4">
        <PageHeader breadcrumbs={["Security", "Authentication Events", eventId]} title="Event not found" subtitle="This event does not exist in the 30-day retention window." />
        <Card className="grid min-h-[17.5rem] place-items-center rounded-xl p-6">
          <div className="text-center">
            <SearchX className="mx-auto text-muted-foreground" size={28} />
            <h2 className="mt-2 text-base font-semibold">No event matches "{eventId}"</h2>
            <p className="mt-1 text-sm text-muted-foreground">It may have aged out of the 30-day retention window, or the link is incorrect.</p>
            <Button className="mt-4" onClick={() => router.back()}><ArrowLeft size={15} />Back to events</Button>
          </div>
        </Card>
      </div>
    );
  }

  const summary = getAuthSummary();
  const targetLink = targetHref(event);
  const incidentPrefillForEvent = {
    title: `${event.result === "Failed" ? "Failed login" : "Suspicious login"}: ${event.user} from ${event.ip}`,
    impact: `Authentication anomaly on ${event.target} (${event.eventType} - ${event.method}, risk ${event.riskScore}/100).`,
    hosts: event.targetKind === "server" ? [event.target] : undefined,
  };
  const flagTone = riskTone(event.riskScore);
  const copyLink = async () => {
    const url = `${window.location.origin}/authentication-events/${event.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      notify({ message: "Clipboard unavailable in this context" });
    }
  };

  return (
    <div className="min-w-0 space-y-4 pb-4">
      <PageHeader
        breadcrumbs={["Security", "Authentication Events", event.id]}
        title={`${event.result === "Failed" || event.result === "Blocked" ? `${event.result} login` : "Login"}: ${event.user} from ${event.ip}`}
        subtitle={`${event.eventType} - ${event.method} - ${event.target} - ${fullTime(event.time)}`}
       
        lastUpdated={lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        onRefresh={load}
        statusBadge={<span className="flex items-center gap-1.5"><ResultBadge result={event.result} /><span className={cn("inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-semibold", flagTone.text)} title="Risk score"><AlertTriangle size={11} aria-hidden="true" />Risk {event.riskScore}</span></span>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline"  onClick={() => router.back()}><ArrowLeft size={15} />Back</Button>
            <Button variant="outline" className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => setBlockIps([event.ip])}><Ban size={15} />Block IP</Button>
            <Button variant="outline"  onClick={() => setLockTarget({ user: event.user, locked })}>{locked ? <LockOpen size={15} /> : <Lock size={15} />}{locked ? "Unlock" : "Lock"}</Button>
            <AlertMenu
              label="More actions"
              trigger={<Button variant="outline"  aria-label="More actions"><MoreVertical size={16} /></Button>}
              items={[
                { key: "reset", label: "Force password reset", onSelect: () => setForceResetTarget(event.user) },
                { key: "revoke", label: "Revoke sessions", danger: true, onSelect: () => setRevokeTarget(event.user) },
                { key: "review", label: "Mark reviewed", onSelect: () => setMarkReviewedOpen(true) },
                { key: "fp", label: "False positive", onSelect: () => setFalsePositiveOpen(true) },
                { key: "incident", label: "Create incident", onSelect: () => setIncidentPrefill(incidentPrefillForEvent) },
                { key: "copy", label: "Copy link", onSelect: () => { void copyLink(); } },
              ]}
            />
          </div>
        }
      />
      <p className="-mt-2 text-xs text-muted-foreground">Times in local time � {timeZoneLabel()} � {summary.total.toLocaleString()} events scanned in the last 24h</p>


      <div className="grid items-start gap-4 xl:grid-cols-12">
        {/* LEFT � overview / risk / activity / related */}
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-8">
          <Card className="flex flex-col rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Overview</h2>
              <ResultBadge result={event.result} />
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <DetailRow label="Time" value={<span>{fullTime(event.time)} <span className="text-muted-foreground">({timeAgo(event.time)})</span></span>} />
              <DetailRow label="Event ID" value={<span className="font-mono text-[0.8125rem]">{event.id}</span>} />
              <DetailRow label="User" value={<span className="flex items-center gap-2"><InitialsAvatar name={event.user.split("@")[0]} size={22} /><span className="font-medium text-foreground">{event.user}</span><span className="text-xs uppercase text-muted-foreground">{event.userType}</span></span>} />
              <DetailRow label="Method" value={event.method} />
              <DetailRow label="Event type" value={event.eventType} />
              <DetailRow label="Failure reason" value={event.failureReason ?? "-"} />
              <DetailRow label="Target" value={targetLink ? <Link href={targetLink} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">{event.targetKind === "server" ? <Server size={13} aria-hidden="true" /> : <AppWindow size={13} aria-hidden="true" />}{event.target}</Link> : <span className="inline-flex items-center gap-1.5 text-foreground">{event.targetKind === "server" ? <Server size={13} aria-hidden="true" /> : <AppWindow size={13} aria-hidden="true" />}{event.target}</span>} />
              <DetailRow label="Source" value={<span className="flex items-center gap-2"><CountryFlag code={event.countryCode} name={event.country} /><span className="font-mono text-[0.8125rem]">{event.ip}</span><span className="text-muted-foreground">� {event.city}</span></span>} />
              <DetailRow label="Device" value={<span className="flex items-center gap-2">{event.browser === "curl" || event.browser === "OpenSSH" ? <SquareTerminal size={14} aria-hidden="true" /> : <Laptop size={14} aria-hidden="true" />}{event.device}</span>} />
              <DetailRow label="MFA" value={event.mfaUsed ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400"><KeyRound size={13} aria-hidden="true" />Used</span> : <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400"><AlertTriangle size={13} aria-hidden="true" />Not used</span>} />
              <DetailRow label="Privileged" value={event.userType === "Admin" ? "Yes - administrator" : event.userType === "Service" ? "Service account" : "No"} />
              <DetailRow label="Review state" value={event.reviewState} />
            </dl>
          </Card>

          <ChartCard title="Risk assessment" actions={<span className="text-xs font-semibold text-muted-foreground">Score <b className="text-base tabular-nums text-foreground">{event.riskScore}</b>/100</span>}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <RiskScoreBar score={event.riskScore} className="flex-1" />
                <FlagChips flags={event.riskFlags} max={4} />
              </div>
              {event.riskFlags.length === 0 ? (
                <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"><ShieldCheck size={15} aria-hidden="true" />No risk flags raised for this event.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {event.riskFlags.map((flag) => {
                    const Icon = RISK_ICON[flag];
                    return (
                      <li key={flag} className="flex items-start gap-2.5 px-3 py-2.5">
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" aria-hidden="true"><Icon size={13} /></span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold uppercase tracking-wide text-orange-800 dark:text-orange-300">{flag.replace(/_/g, " ")}</span>
                          <span className="mt-0.5 block text-[0.8125rem] text-foreground">{riskReason(event, flag)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </ChartCard>

          <ChartCard title="User activity" actions={<span className="text-xs text-muted-foreground">Last {userEvents.length} events for {event.user}</span>}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usual for this user</p>
                <p className="mt-1.5 text-[0.8125rem] text-foreground"><b>Locations:</b> {userProfile.usualLocations.length ? userProfile.usualLocations.map(([name]) => name).join(", ") : "insufficient history"}</p>
                <p className="mt-1 text-[0.8125rem] text-foreground"><b>Devices:</b> {userProfile.usualDevices.length ? userProfile.usualDevices.map(([name]) => name).join(", ") : "insufficient history"}</p>
              </div>
              <div className={cn("rounded-lg border p-3", event.riskFlags.includes("new_location") || event.riskFlags.includes("new_device") ? "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10" : "border-border bg-muted/40")}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This event</p>
                <p className="mt-1.5 text-[0.8125rem] text-foreground"><b>Location:</b> {event.city}, {event.country}{event.riskFlags.includes("new_location") && <span className="ml-1.5 rounded bg-amber-200 px-1.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-500/25 dark:text-amber-200">unusual</span>}</p>
                <p className="mt-1 text-[0.8125rem] text-foreground"><b>Device:</b> {event.device}{event.riskFlags.includes("new_device") && <span className="ml-1.5 rounded bg-amber-200 px-1.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-500/25 dark:text-amber-200">new</span>}</p>
              </div>
            </div>
            <ol className="mt-3 max-h-64 space-y-0 overflow-y-auto border-l-2 border-border pl-4">
              {userEvents.map((item) => (
                <li key={item.id} className="relative pb-2.5 last:pb-0">
                  <span aria-hidden="true" className={cn("absolute -left-[1.3125rem] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-card", item.result === "Success" ? "bg-emerald-400" : item.result === "Failed" ? "bg-rose-400" : item.result === "Blocked" ? "bg-red-600" : "bg-amber-400")} />
                  <button type="button" onClick={() => router.push(`/authentication-events/${item.id}`)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
                    <b className="font-mono text-xs text-primary">{item.id}</b>
                    <span className="text-xs text-foreground">{item.method}</span>
                    <span className="text-xs text-muted-foreground">{item.target}</span>
                    <span className="text-xs text-muted-foreground">{item.city}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">{timeAgo(item.time)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </ChartCard>

          <ChartCard title="Related events" actions={<span className="text-xs text-muted-foreground">Same user or same IP � top 8 by risk</span>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[35rem] text-left text-[0.8125rem]">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-2 py-2 font-semibold">ID</th><th className="px-2 py-2 font-semibold">Result</th><th className="px-2 py-2 font-semibold">IP</th><th className="px-2 py-2 font-semibold">Target</th><th className="px-2 py-2 font-semibold">Risk</th><th className="px-2 py-2 font-semibold">When</th></tr>
                </thead>
                <tbody>
                  {relatedEvents.map((item) => (
                    <tr key={item.id} className="cursor-pointer border-b border-border/70 hover:bg-muted/40 focus-within:bg-muted/40" onClick={() => router.push(`/authentication-events/${item.id}`)}>
                      <td className="px-2 py-2"><Link href={`/authentication-events/${item.id}`} onClick={(clickEvent) => clickEvent.stopPropagation()} className="font-mono font-semibold text-primary hover:underline">{item.id}</Link></td>
                      <td className="px-2 py-2"><ResultBadge result={item.result} /></td>
                      <td className="px-2 py-2 font-mono text-xs">{item.ip}</td>
                      <td className="px-2 py-2 text-muted-foreground">{item.target}</td>
                      <td className="px-2 py-2"><RiskScoreBar score={item.riskScore} /></td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-muted-foreground">{timeAgo(item.time)}</td>
                    </tr>
                  ))}
                  {relatedEvents.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-sm text-muted-foreground">No related events in the retention window.</td></tr>}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>

        {/* RIGHT � source IP / account / linked */}
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <Card className="flex flex-col rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Network size={15} aria-hidden="true" />Source IP</h2>
              {ipBlocked
                ? <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300"><Ban size={11} aria-hidden="true" />Blocked</span>
                : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-500/20 dark:text-slate-300">Allowed</span>}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <CountryFlag code={event.countryCode} name={event.country} className="h-6 w-9" />
              <div className="min-w-0">
                <p className="break-all font-mono text-base font-bold text-foreground">{event.ip}</p>
                <p className="text-xs text-muted-foreground">{event.city}, {event.country} � {asn?.asn} � {asn?.org}</p>
              </div>
              <button type="button" onClick={() => { void copyLink(); }} aria-label="Copy event link" className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}</button>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted/50 p-2"><dt className="text-xs text-muted-foreground">Attempts (24h)</dt><dd className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{sourceSuspect ? sourceSuspect.attempts : 3 + ([...event.ip].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 38)}</dd></div>
              <div className="rounded-lg bg-muted/50 p-2"><dt className="text-xs text-muted-foreground">Users targeted</dt><dd className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{sourceSuspect ? sourceSuspect.usersTargeted : 1 + ([...event.ip].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 6)}</dd></div>
            </dl>
            {sourceSuspect?.anonymizer && <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"><AlertTriangle size={12} aria-hidden="true" />Known anonymizer / exit node</p>}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">Reputation: <b className={cn(sourceSuspect ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>{sourceSuspect ? "Hostile" : "Neutral"}</b></span>
              <Button variant={ipBlocked ? "outline" : "destructive"} className={cn("", !ipBlocked && "bg-red-600 text-white hover:bg-red-700")} onClick={() => setBlockIps([event.ip])}>{ipBlocked ? "Unblock IP" : "Block IP"}</Button>
            </div>
          </Card>

          <Card className="flex flex-col rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><UserRound size={15} aria-hidden="true" />Account</h2>
              <Link href={`/access-control?user=${encodeURIComponent(event.user)}`} className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Access Control ?</Link>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <InitialsAvatar name={event.user.split("@")[0]} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{event.user}</p>
                <p className="text-xs text-muted-foreground">{event.userType === "Service" ? "Service account" : event.userType === "Admin" ? "Administrator" : "Operations"}{event.userType === "Admin" ? " � privileged" : ""}</p>
              </div>
              {locked && <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"><Lock size={11} aria-hidden="true" />Locked</span>}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted/50 p-2"><dt className="text-xs text-muted-foreground">MFA</dt><dd className={cn("mt-0.5 font-semibold", event.mfaUsed || event.user !== "legacy@nexus.io" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{event.user === "legacy@nexus.io" ? "Not enrolled" : "Enrolled"}</dd></div>
              <div className="rounded-lg bg-muted/50 p-2"><dt className="text-xs text-muted-foreground">Password changed</dt><dd className="mt-0.5 font-semibold tabular-nums text-foreground">{12 + ([...event.user].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 150)}d ago</dd></div>
            </dl>
            <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
              <Button variant="outline"  onClick={() => setForceResetTarget(event.user)}>Force reset</Button>
              <Button variant="outline"  onClick={() => setLockTarget({ user: event.user, locked })}>{locked ? "Unlock" : "Lock"}</Button>
            </div>
          </Card>

          <Card className="flex flex-col rounded-xl p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><KeyRound size={15} aria-hidden="true" />Linked</h2>
            <ul className="mt-2 flex flex-col divide-y divide-border text-[0.8125rem]">
              <li className="flex items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-2"><Bug size={14} className="shrink-0 text-orange-500" aria-hidden="true" /><span className="min-w-0"><span className="block text-xs text-muted-foreground">Detection</span>{linkedDetection ? <Link href={`/authentication-events?tab=suspicious`} className="block truncate font-semibold text-primary hover:underline">{linkedDetection.id} � {AUTH_DETECTION_LABEL[linkedDetection.type]}</Link> : <span className="text-muted-foreground">None linked</span>}</span></span>
                {linkedDetection && <SeverityBadge severity={linkedDetection.severity} />}
              </li>
              <li className="flex items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-2"><AlertTriangle size={14} className="shrink-0 text-red-500" aria-hidden="true" /><span className="min-w-0"><span className="block text-xs text-muted-foreground">Incident</span><span className="text-muted-foreground">Not declared</span></span></span>
                <button type="button" onClick={() => setIncidentPrefill(incidentPrefillForEvent)} className="shrink-0 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">Create ?</button>
              </li>
              <li className="flex items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-2"><KeyRound size={14} className="shrink-0 text-blue-500" aria-hidden="true" /><span className="min-w-0"><span className="block text-xs text-muted-foreground">Alert rule</span><Link href="/alert-rules" className="text-primary hover:underline">RUL-1042 � Auth failure burst</Link></span></span>
              </li>
            </ul>
            <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button className="flex-1" onClick={() => setMarkReviewedOpen(true)}><CheckCircle2 size={14} />Mark reviewed</Button>
              <Button variant="outline" className="flex-1" onClick={() => setFalsePositiveOpen(true)}>False positive</Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Prev / Next */}
      <div className="flex items-center justify-between gap-3">
        {newerEvent
          ? <Button variant="outline"  onClick={() => router.push(`/authentication-events/${newerEvent.id}`)}><ChevronLeft size={15} />Newer � {newerEvent.id}</Button>
          : <span />}
        <span className="text-xs text-muted-foreground">{eventIndex >= 0 ? `${eventIndex + 1} of ${ordered.length}` : ""}</span>
        {olderEvent
          ? <Button variant="outline"  onClick={() => router.push(`/authentication-events/${olderEvent.id}`)}>{olderEvent.id} � Older<ChevronRight size={15} /></Button>
          : <span />}
      </div>

      {/* Dialogs + toast */}
      <BlockIpDialog open={blockIps != null} onOpenChange={(open) => { if (!open) setBlockIps(null); }} ips={blockIps ?? []} onDone={notify} />
      <LockAccountDialog open={lockTarget != null} onOpenChange={(open) => { if (!open) setLockTarget(null); }} user={lockTarget?.user ?? null} locked={lockTarget?.locked ?? false} onDone={notify} />
      <ForceResetDialog open={forceResetTarget != null} onOpenChange={(open) => { if (!open) setForceResetTarget(null); }} user={forceResetTarget} onDone={notify} />
      <RevokeSessionsDialog open={revokeTarget != null} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }} user={revokeTarget} onDone={notify} />
      <MarkReviewedDialog open={markReviewedOpen} onOpenChange={setMarkReviewedOpen} ids={[event.id]} onDone={(result) => { notify(result); setEvents((current) => current.map((item) => (item.id === event.id ? { ...item, reviewState: "Reviewed" } : item))); }} />
      <FalsePositiveDialog open={falsePositiveOpen} onOpenChange={setFalsePositiveOpen} ids={[event.id]} onDone={(result) => { notify(result); setEvents((current) => current.map((item) => (item.id === event.id ? { ...item, reviewState: "False positive" } : item))); }} />
      <CreateIncidentDialog open={incidentPrefill != null} onOpenChange={(open) => { if (!open) setIncidentPrefill(null); }} prefill={incidentPrefill ?? { title: "", impact: "" }} onDone={notify} />
      <AuthToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-[0.8125rem] text-foreground">{value}</dd>
    </div>
  );
}

