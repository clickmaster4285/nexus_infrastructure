"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, HardDrive, Info, Lock, Server, X } from "lucide-react";

import { SegmentedControl } from "@/components/logs/primitives";
import { ToggleSwitch } from "@/components/alert-rules/toggle-switch";
import { LocationCell } from "@/components/backups/location-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { BackupJob, BackupType, CreateBackupJobInput } from "@/mocks/backups";
import { BACKUP_ASSET_TYPES, BACKUP_ENVIRONMENTS, BACKUP_OWNERS, BACKUP_PROTECTABLE_HOSTS } from "@/mocks/backups";
import { STORAGE_POOLS, poolCapacityBytes, poolUsedBytes } from "@/mocks/storageLocations";
import { readMaintenanceWindowStore, scopeHosts } from "@/mocks/maintenanceWindows";
import { SCHEDULE_TIME_ZONES, WEEKDAY_LABELS, formatSchedule, validateCron, type TaskSchedule } from "@/utils/formatSchedule";
import { nextRuns } from "@/utils/nextRun";
import { daysToFull } from "@/utils/storageForecast";
import type { PolicyInput } from "@/hooks/useBackups";

const DAY_CHIP_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

interface BackupPolicyDrawerProps {
  job: BackupJob | null;
  /** "create" renders the new-job form (target host, asset type, environment, owner) instead of edit mode. */
  mode?: "edit" | "create";
  onClose: () => void;
  onSave: (jobId: string, input: PolicyInput, saveAndEnable: boolean) => void;
  /** Called instead of onSave when mode === "create". */
  onCreate?: (input: CreateBackupJobInput, enable: boolean) => void;
}

function parseTime(value: string): { hour: number; minute: number } {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return {
    hour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 0,
    minute: Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0,
  };
}

/** Policy editor drawer (basics, schedule with live next-runs preview, retention, storage, notifications). Also serves the Create Backup flow. */
export function BackupPolicyDrawer({ job, mode = "edit", onClose, onSave, onCreate }: BackupPolicyDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<BackupType>("incremental");
  const [kind, setKind] = useState<"daily" | "weekly" | "cron">("daily");
  const [time, setTime] = useState("02:00");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]);
  const [cron, setCron] = useState("0 2 * * *");
  const [timeZone, setTimeZone] = useState<string>("Asia/Karachi");
  const [retentionDays, setRetentionDays] = useState(30);
  const [poolId, setPoolId] = useState("pool-nas");
  const [immutability, setImmutability] = useState(false);
  const [notificationsOnFailure, setNotificationsOnFailure] = useState(true);
  const [channels, setChannels] = useState<string[]>(["Email"]);
  const [host, setHost] = useState<string>(BACKUP_PROTECTABLE_HOSTS[0]);
  const [assetType, setAssetType] = useState<string>("Database");
  const [environment, setEnvironment] = useState<BackupJob["environment"]>("production");
  const [owner, setOwner] = useState<string>(BACKUP_OWNERS[0]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const initialRef = useRef<string>("");

  // Re-seed the form whenever a different job (or create vs edit mode) is opened.
  useEffect(() => {
    if (mode === "create") {
      setName("");
      setType("incremental");
      setKind("daily");
      setTime("02:00");
      setDaysOfWeek([1]);
      setCron("0 2 * * *");
      setTimeZone("Asia/Karachi");
      setRetentionDays(30);
      setPoolId("pool-nas");
      setImmutability(false);
      setNotificationsOnFailure(true);
      setChannels(["Email"]);
      setHost(BACKUP_PROTECTABLE_HOSTS[0]);
      setAssetType("Database");
      setEnvironment("production");
      setOwner(BACKUP_OWNERS[0]);
      setConfirmDiscard(false);
      initialRef.current = JSON.stringify({ name: "", type: "incremental", kind: "daily", time: "2:0", daysOfWeek: [1], cron: "0 2 * * *", timeZone: "Asia/Karachi", retentionDays: 30, poolId: "pool-nas", immutability: false, notificationsOnFailure: true, channels: ["Email"], host: BACKUP_PROTECTABLE_HOSTS[0], assetType: "Database", environment: "production", owner: BACKUP_OWNERS[0] });
      return;
    }
    if (!job) return;
    setName(job.name);
    setType(job.type);
    setKind(job.schedule.kind === "monthly" || job.schedule.kind === "daily" ? "daily" : job.schedule.kind);
    setTime(`${String(job.schedule.hour).padStart(2, "0")}:${String(job.schedule.minute).padStart(2, "0")}`);
    setDaysOfWeek(job.schedule.daysOfWeek?.length ? job.schedule.daysOfWeek : [1]);
    setCron(job.schedule.cron ?? "0 2 * * *");
    setTimeZone(job.schedule.timeZone);
    setRetentionDays(job.retentionDays);
    setPoolId(job.poolId);
    setImmutability(job.immutable);
    setNotificationsOnFailure(job.notifications.onFailure);
    setChannels(job.notifications.channels);
    setConfirmDiscard(false);
    initialRef.current = JSON.stringify({ name: job.name, type: job.type, kind: job.schedule.kind, time: `${job.schedule.hour}:${job.schedule.minute}`, daysOfWeek: job.schedule.daysOfWeek, cron: job.schedule.cron, timeZone: job.schedule.timeZone, retentionDays: job.retentionDays, poolId: job.poolId, immutability: job.immutable, notificationsOnFailure: job.notifications.onFailure, channels: job.notifications.channels });
  }, [job, mode]);

  // Escape close + Tab focus trap with unsaved-changes guard.
  useEffect(() => {
    if (!job && mode !== "create") return;
    const getFocusable = () => {
      if (!drawerRef.current) return [] as HTMLElement[];
      return Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown, true);
    const target = drawerRef.current?.querySelector<HTMLElement>("[data-autofocus]");
    target?.focus();
    return () => document.removeEventListener("keydown", onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, mode]);

  const cronError = kind === "cron" ? validateCron(cron) : null;

  const schedule: TaskSchedule = useMemo(() => {
    const { hour, minute } = parseTime(time);
    if (kind === "weekly") return { kind: "weekly", hour, minute, daysOfWeek: [...daysOfWeek].sort((a, b) => a - b), timeZone };
    if (kind === "cron") return { kind: "cron", hour, minute, cron: cron.trim(), timeZone };
    return { kind: "daily", hour, minute, timeZone };
  }, [kind, time, daysOfWeek, cron, timeZone]);

  const nextRunsPreview = useMemo(() => {
    if (cronError) return [] as number[];
    try {
      return nextRuns(schedule, Date.now(), 5);
    } catch {
      return [] as number[];
    }
  }, [schedule, cronError]);

  // Conflict check: active/upcoming maintenance covering this host around the next run (+/- 2h).
  const conflict = useMemo(() => {
    const conflictHost = mode === "create" ? host : job?.host;
    if (!conflictHost) return null;
    const next = nextRunsPreview[0];
    if (next == null) return null;
    const windowMs = 2 * 60 * 60 * 1000;
    return readMaintenanceWindowStore().find((window) => {
      if (window.status === "Cancelled") return false;
      const start = Date.parse(window.start);
      const end = Date.parse(window.end);
      if (!(start < next + windowMs && end > next - windowMs)) return false;
      return scopeHosts(window.scope).includes(conflictHost);
    }) ?? null;
  }, [job, nextRunsPreview, mode, host]);

  if (!job && mode !== "create") return null;

  const baseFingerprint = { name, type, kind, time: `${parseTime(time).hour}:${parseTime(time).minute}`, daysOfWeek, cron, timeZone, retentionDays, poolId, immutability, notificationsOnFailure, channels };
  const currentFingerprint = JSON.stringify(mode === "create" ? { ...baseFingerprint, host, assetType, environment, owner } : baseFingerprint);
  const dirty = currentFingerprint !== initialRef.current;

  const requestClose = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const buildInput = (): PolicyInput => ({
    name: name.trim() || job?.name || "Backup job",
    type,
    schedule,
    retentionDays: Math.min(3650, Math.max(1, Math.round(retentionDays) || 1)),
    poolId,
    immutability,
    notificationsOnFailure,
    notificationChannels: channels,
  });

  const save = (saveAndEnable: boolean) => {
    if (cronError || !job) return;
    onSave(job.id, buildInput(), saveAndEnable);
  };

  const create = (enable: boolean) => {
    if (cronError || !onCreate || !name.trim()) return;
    onCreate({
      name: name.trim(),
      host,
      assetType,
      environment,
      owner,
      type,
      schedule,
      retentionDays: Math.min(3650, Math.max(1, Math.round(retentionDays) || 1)),
      poolId,
      immutability,
      notificationsOnFailure,
      notificationChannels: channels,
      enabled: enable,
    }, enable);
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((days) => {
      const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
      return next.length === 0 ? days : next;
    });
  };

  const toggleChannel = (channel: string) => {
    setChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]);
  };

  return createPortal(
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[1290] bg-slate-950/40" onClick={requestClose} />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-policy-title"
        className="fixed inset-y-0 right-0 z-[1300] flex w-full flex-col border-l border-border bg-card shadow-2xl sm:max-w-[35rem]"
      >
        <header className="flex items-center gap-2 border-b border-border p-5">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{mode === "create" ? "new job · policy editor" : `${job?.id} · policy editor`}</p>
            <h2 id="backup-policy-title" className="font-display text-base font-bold leading-snug tracking-tight text-foreground">{mode === "create" ? "Create backup job" : "Edit backup policy"}</h2>
          </div>
          <button
            type="button"
            onClick={requestClose}
            data-autofocus
            aria-label="Close policy editor"
            className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* Basics */}
          <section aria-label="Basics">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"><Info size={11} aria-hidden="true" />Basics</h3>
            <label className="mt-1.5 block text-xs font-medium text-muted-foreground" htmlFor="policy-name">Name</label>
            <Input id="policy-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={mode === "create" ? "e.g. Nightly database backup" : undefined} className="mt-1 h-9 text-sm" />
            {mode === "create" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-muted-foreground" htmlFor="policy-host">
                  Target host
                  <Select value={host} onValueChange={setHost}>
                    <SelectTrigger id="policy-host" className="mt-1 h-9 w-full font-mono text-xs" aria-label="Target host"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BACKUP_PROTECTABLE_HOSTS.map((target) => <SelectItem key={target} value={target}>{target}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-xs font-medium text-muted-foreground" htmlFor="policy-asset-type">
                  Asset type
                  <Select value={assetType} onValueChange={setAssetType}>
                    <SelectTrigger id="policy-asset-type" className="mt-1 h-9 w-full text-xs" aria-label="Asset type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BACKUP_ASSET_TYPES.map((target) => <SelectItem key={target} value={target}>{target}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-xs font-medium text-muted-foreground" htmlFor="policy-environment">
                  Environment
                  <Select value={environment} onValueChange={(value) => setEnvironment(value as BackupJob["environment"])}>
                    <SelectTrigger id="policy-environment" className="mt-1 h-9 w-full text-xs capitalize" aria-label="Environment"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BACKUP_ENVIRONMENTS.map((target) => <SelectItem key={target} value={target} className="capitalize">{target}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="block text-xs font-medium text-muted-foreground" htmlFor="policy-owner">
                  Owner
                  <Select value={owner} onValueChange={setOwner}>
                    <SelectTrigger id="policy-owner" className="mt-1 h-9 w-full text-xs" aria-label="Owner"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BACKUP_OWNERS.map((target) => <SelectItem key={target} value={target}>{target}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
              </div>
            )}
            <span className="mt-2.5 block text-xs font-medium text-muted-foreground">Backup type</span>
            <div className="mt-1">
              <SegmentedControl value={type} options={["full", "incremental", "differential", "snapshot"]} onChange={(value) => setType(value as BackupType)} buttonClassName="h-8 px-3 text-xs capitalize" />
            </div>
          </section>

          {/* Schedule */}
          <section aria-label="Schedule" className="mt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"><CalendarClock size={11} aria-hidden="true" />Schedule</h3>
            <div className="mt-1.5">
              <SegmentedControl value={kind} options={["daily", "weekly", "cron"]} onChange={(value) => setKind(value as "daily" | "weekly" | "cron")} buttonClassName="h-8 px-3 text-xs capitalize" />
            </div>
            {kind !== "cron" && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  At
                  <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-9 w-[7.5rem] text-sm" aria-label="Backup time" />
                </label>
                {kind === "weekly" && (
                  <div className="flex items-center gap-1" role="group" aria-label="Days of week">
                    {DAY_CHIP_ORDER.map((day) => {
                      const active = daysOfWeek.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          aria-pressed={active}
                          className={cn(
                            "h-8 w-8 rounded-md border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent",
                          )}
                        >
                          {WEEKDAY_LABELS[day].slice(0, 1)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {kind === "cron" && (
              <div className="mt-2">
                <label className="block text-xs font-medium text-muted-foreground" htmlFor="policy-cron">Cron expression</label>
                <Input
                  id="policy-cron"
                  value={cron}
                  onChange={(event) => setCron(event.target.value)}
                  className={cn("mt-1 h-9 font-mono text-[0.8125rem]", cronError && "border-red-600 focus-visible:ring-red-600/40")}
                  aria-invalid={Boolean(cronError)}
                  aria-describedby={cronError ? "policy-cron-error" : undefined}
                  spellCheck={false}
                  autoComplete="off"
                />
                {cronError
                  ? <p id="policy-cron-error" className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"><AlertTriangle size={11} aria-hidden="true" />{cronError}</p>
                  : <p className="mt-1 text-xs text-muted-foreground">Five fields: minute hour day-of-month month day-of-week.</p>}
              </div>
            )}
            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              Timezone
              <Select value={timeZone} onValueChange={setTimeZone}>
                <SelectTrigger className="h-9 w-[11.25rem] text-xs" aria-label="Timezone"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCHEDULE_TIME_ZONES.map((zone) => <SelectItem key={zone} value={zone}>{zone}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <div className="mt-2 rounded-lg border border-border bg-muted/40 p-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next 5 runs &middot; {formatSchedule(schedule)}</p>
              <ol className="mt-1 flex flex-col gap-0.5 text-xs tabular-nums text-foreground">
                {nextRunsPreview.length > 0
                  ? nextRunsPreview.map((ms) => (
                    <li key={ms} className="flex items-center gap-2">
                      <CheckCircle2 size={11} aria-hidden="true" className="text-green-600" />
                      {new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(ms)}
                    </li>
                  ))
                  : <li className="text-muted-foreground">Fix the cron expression to preview runs.</li>}
              </ol>
            </div>
            {conflict && (
              <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>Next run overlaps maintenance window &ldquo;{conflict.title}&rdquo; ({conflict.id}) covering {mode === "create" ? host : job?.host} - the backup will be skipped.</span>
              </p>
            )}
          </section>

          {/* Retention */}
          <section aria-label="Retention" className="mt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"><Server size={11} aria-hidden="true" />Retention</h3>
            <label className="mt-1.5 block text-xs font-medium text-muted-foreground" htmlFor="policy-retention">Keep backups for (days)</label>
            <Input id="policy-retention" type="number" min={1} max={3650} value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))} className="mt-1 h-9 w-[8.75rem] text-sm" />
            <p className="mt-1 text-xs text-muted-foreground">Oldest full backups beyond this window are pruned first; daily verification snapshots expire sooner.</p>
          </section>

          {/* Storage */}
          <section aria-label="Storage and encryption" className="mt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"><HardDrive size={11} aria-hidden="true" />Storage</h3>
            <div className="mt-1.5 flex flex-col gap-1.5" role="radiogroup" aria-label="Destination pool">
              {STORAGE_POOLS.map((pool) => {
                const active = poolId === pool.id;
                const capacity = poolCapacityBytes(pool);
                const used = poolUsedBytes(pool);
                const pct = Math.round((used / capacity) * 100);
                const full = daysToFull(used, capacity, pool.growthGBPerWeek * 1024 * 1024 * 1024);
                return (
                  <button
                    key={pool.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPoolId(pool.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-primary ring-1 ring-primary" : "border-border hover:bg-accent",
                    )}
                  >
                    <LocationCell poolId={pool.id} className="min-w-0 flex-1" />
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{pct}% full{full != null && ` · ~${full}d`}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 font-mono text-[0.6875rem] font-semibold text-foreground"><Lock size={11} aria-hidden="true" />AES-256 (managed)</span>
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                Immutability (WORM)
                <ToggleSwitch checked={immutability} onChange={setImmutability} label="Toggle immutability" size="sm" />
              </span>
            </div>
          </section>

          {/* Notifications */}
          <section aria-label="Notifications" className="mt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Bell size={11} aria-hidden="true" />Notifications
            </h3>
            <div className="mt-1.5 flex items-center gap-3 text-xs">
              <span className="text-foreground">Notify on failure</span>
              <ToggleSwitch checked={notificationsOnFailure} onChange={setNotificationsOnFailure} label="Notify on failure" size="sm" />
            </div>
            <div className={cn("mt-1.5 flex items-center gap-2", !notificationsOnFailure && "pointer-events-none opacity-50")}>
              {["Email", "Slack"].map((channel) => {
                const active = channels.includes(channel);
                return (
                  <button
                    key={channel}
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    onClick={() => toggleChannel(channel)}
                    className={cn(
                      "h-8 rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {channel}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-4">
          <Button variant="outline" className="h-9 rounded-lg px-4 text-[0.8125rem]" onClick={requestClose}>Cancel</Button>
          {mode === "create" ? (
            <>
              <Button variant="outline" className="h-9 rounded-lg px-4 text-[0.8125rem]" onClick={() => create(false)} disabled={Boolean(cronError) || !name.trim()}>Create paused</Button>
              <Button className="h-9 rounded-lg px-4 text-[0.8125rem] font-semibold" onClick={() => create(true)} disabled={Boolean(cronError) || !name.trim()}>Create &amp; Enable</Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="h-9 rounded-lg px-4 text-[0.8125rem]" onClick={() => save(false)} disabled={Boolean(cronError)}>Save</Button>
              <Button className="h-9 rounded-lg px-4 text-[0.8125rem] font-semibold" onClick={() => save(true)} disabled={Boolean(cronError)}>Save &amp; Enable</Button>
            </>
          )}
        </footer>
      </aside>

      {/* Discard unsaved changes */}
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>Your edits to this backup policy have not been saved. Closing now will lose them.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-9 rounded-lg px-4 text-[0.8125rem]" onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button className="h-9 rounded-lg bg-red-600 px-4 text-[0.8125rem] font-semibold text-white hover:bg-red-700" onClick={() => { setConfirmDiscard(false); onClose(); }}>Discard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>,
    document.body,
  );
}
