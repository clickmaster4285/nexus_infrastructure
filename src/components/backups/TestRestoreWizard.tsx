"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArchiveRestore, CheckCircle2, ChevronLeft, ChevronRight, FlaskConical, ShieldAlert } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BackupTypeBadge, VerifiedBadge } from "@/components/backups/backup-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { timeAgo } from "@/mocks/logs";
import type { RestorePoint } from "@/mocks/restorePoints";
import type { BackupJob } from "@/mocks/backups";
import { formatBytes } from "@/utils/storageForecast";
import { cn } from "@/lib/utils";

export type RestoreTarget = "sandbox" | "in-place";

export interface TestRestoreResult {
  host: string;
  assetName: string | null;
  durationMin: number;
  rtoTargetMin: number;
  result: "Passed" | "Failed";
}

interface TestRestoreWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselect this point (e.g. from Restore Points tab). */
  initialPointId: string | null;
  /** Filter asset/points to one host (e.g. from job drawer). */
  defaultHost: string | null;
  points: RestorePoint[];
  jobsById: Map<string, BackupJob>;
  onComplete: (result: TestRestoreResult) => void;
}

const STEP_LABELS = ["Asset & point", "Target", "Options", "Review"] as const;
const RTO_TARGET_MIN = 60;
const IN_PLACE_CONFIRM = "IN-PLACE";

function estimateDurationMin(): number {
  // Mock rehearsal duration: realistic VM restore window, deterministic-ish per session.
  return 30 + Math.floor(Math.random() * 40);
}

/** 4-step Test Restore wizard: asset+point -> target (sandbox default, in-place with type-to-confirm) -> options -> review + start. */
export function TestRestoreWizard({ open, onOpenChange, initialPointId, defaultHost, points, jobsById, onComplete }: TestRestoreWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [target, setTarget] = useState<RestoreTarget>("sandbox");
  const [confirmText, setConfirmText] = useState("");
  const [verifyIntegrity, setVerifyIntegrity] = useState(true);
  const [smokeTest, setSmokeTest] = useState(true);
  const [autoCleanup, setAutoCleanup] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const progressTimer = useRef<number | null>(null);

  const visiblePoints = useMemo(() => {
    const filtered = defaultHost ? points.filter((point) => point.host === defaultHost) : points;
    return filtered.slice(0, 8);
  }, [points, defaultHost]);

  const assetsWithPoints = useMemo(() => [...new Set(visiblePoints.map((point) => point.host))], [visiblePoints]);
  const [selectedHost, setSelectedHost] = useState<string | null>(null);

  const scopedPoints = useMemo(
    () => (selectedHost ? visiblePoints.filter((point) => point.host === selectedHost) : visiblePoints),
    [visiblePoints, selectedHost],
  );
  const selectedPoint = useMemo(
    () => points.find((point) => point.id === selectedPointId) ?? null,
    [points, selectedPointId],
  );
  const selectedJob = selectedPoint ? jobsById.get(selectedPoint.jobId) ?? null : null;
  const propertyTitle = selectedPoint?.jobName ?? selectedPoint?.host ?? "";
  const isInPlace = target === "in-place";
  const inPlaceConfirmed = !isInPlace || confirmText === (selectedPoint?.host ?? "");

  // Seed state when opened.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTarget("sandbox");
    setConfirmText("");
    setVerifyIntegrity(true);
    setSmokeTest(true);
    setAutoCleanup(true);
    setProgress(null);
    const initial = initialPointId ?? visiblePoints[0]?.id ?? null;
    setSelectedPointId(initial);
    setSelectedHost((initialPointId && points.find((point) => point.id === initialPointId)?.host) ?? defaultHost ?? assetsWithPoints[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => { if (progressTimer.current) window.clearInterval(progressTimer.current); }, []);

  const canContinue =
    step === 1 ? selectedPoint != null
    : step === 2 ? inPlaceConfirmed
    : step === 3 ? true
    : selectedPoint != null;

  const restoring = progress != null;

  const start = () => {
    if (!canContinue || restoring) return;
    setProgress(3);
    progressTimer.current = window.setInterval(() => {
      setProgress((current) => {
        if (current == null) return current;
        const next = current + 11 + Math.random() * 13;
        if (next >= 100) {
          if (progressTimer.current) window.clearInterval(progressTimer.current);
          if (selectedPoint) {
            const durationMin = estimateDurationMin();
            onComplete({
              host: selectedPoint.host,
              assetName: propertyTitle,
              durationMin,
              rtoTargetMin: RTO_TARGET_MIN,
              result: durationMin <= RTO_TARGET_MIN ? "Passed" : "Failed",
            });
          }
          onOpenChange(false);
          return 100;
        }
        return Math.floor(next);
      });
    }, 320);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (restoring) return; onOpenChange(next); }}>
      <DialogContent className="w-[min(35rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} aria-hidden="true" className="text-primary" />
            <DialogTitle className="text-sm font-bold">Test restore</DialogTitle>
          </div>
          <DialogDescription className="mt-0.5 text-xs">
            Rehearse a recovery end-to-end. The rehearsal counts toward your RTO and is logged as a DR drill.
          </DialogDescription>
          <ol className="mt-3 flex items-center gap-1.5" aria-label="Wizard steps">
            {STEP_LABELS.map((label, index) => {
              const value = (index + 1) as 1 | 2 | 3 | 4;
              const state = step > value ? "done" : step === value ? "active" : "todo";
              return (
                <li key={label} className="flex items-center gap-1.5">
                  <span className={cn(
                    "grid h-5 w-5 place-items-center rounded-full text-[0.625rem] font-bold",
                    state === "done" && "bg-green-600 text-white",
                    state === "active" && "bg-primary text-primary-foreground",
                    state === "todo" && "border border-border text-muted-foreground",
                  )}>
                    {state === "done" ? <CheckCircle2 size={12} aria-hidden="true" /> : value}
                  </span>
                  <span className={cn("text-xs font-medium", state === "active" ? "text-foreground" : "text-muted-foreground")}>{label}</span>
                  {index < STEP_LABELS.length - 1 && <ChevronRight size={11} aria-hidden="true" className="text-border" />}
                </li>
              );
            })}
          </ol>
        </DialogHeader>

        <div className="max-h-[min(28.75rem,60vh)] min-h-[13.75rem] overflow-y-auto px-5 py-4">
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <label className="block text-xs font-medium text-muted-foreground" htmlFor="wizard-asset">
                Asset
                <Select value={selectedHost ?? ""} onValueChange={(value) => { setSelectedHost(value); const first = points.find((point) => point.host === value); setSelectedPointId(first?.id ?? null); }}>
                  <SelectTrigger id="wizard-asset" className="mt-1 h-9 w-full font-mono text-xs" aria-label="Asset"><SelectValue placeholder="Select asset" /></SelectTrigger>
                  <SelectContent>
                    {[...new Set(points.map((point) => point.host))].sort().map((host) => <SelectItem key={host} value={host}>{host}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <div role="radiogroup" aria-label="Restore point" className="flex flex-col gap-1.5">
                {scopedPoints.map((point) => {
                  const active = point.id === selectedPointId;
                  return (
                    <button
                      key={point.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelectedPointId(point.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "border-primary ring-1 ring-primary" : "border-border hover:bg-accent",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{point.id}</span>
                          <BackupTypeBadge type={point.type} />
                          <VerifiedBadge verified={point.verified} />
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{timeAgo(point.epochMs)} · {formatBytes(point.sizeBytes)} · {point.host}</span>
                      </span>
                    </button>
                  );
                })}
                {scopedPoints.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No restore points for this asset — points are created only by successful runs.</p>}
              </div>
            </div>
          )}

          {step === 2 && selectedPoint && (
            <div role="radiogroup" aria-label="Restore target" className="flex flex-col gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={target === "sandbox"}
                onClick={() => setTarget("sandbox")}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  target === "sandbox" ? "border-primary ring-1 ring-primary" : "border-border hover:bg-accent",
                )}
              >
                <span className="flex items-center gap-2 text-[0.8125rem] font-semibold text-foreground">Sandbox instance <span className="rounded bg-emerald-50 px-1.5 text-[0.625rem] font-semibold uppercase text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">recommended</span></span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Spins up a scratch VM from this restore point, verifies it, then disposes of it. Production traffic is untouched.</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={target === "in-place"}
                onClick={() => setTarget("in-place")}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  target === "in-place" ? "border-red-600 ring-1 ring-red-600" : "border-border hover:bg-accent",
                )}
              >
                <span className="flex items-center gap-2 text-[0.8125rem] font-semibold text-red-600 dark:text-red-400"><ShieldAlert size={14} aria-hidden="true" />In-place restore</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Overwrites production data on <span className="font-mono">{selectedPoint.host}</span> with the selected point.</span>
              </button>
              {isInPlace && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
                  <p className="flex items-start gap-1.5 text-xs font-semibold text-red-900 dark:text-red-200"><AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />In-place restore will overwrite current data on {selectedPoint.host}. Type the asset name to confirm.</p>
                  <Input
                    className="mt-2 h-9 border-red-300 bg-white font-mono text-[0.8125rem] dark:border-red-500/40 dark:bg-red-950/40"
                    placeholder={selectedPoint.host}
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    aria-label="Type the asset name to confirm in-place restore"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-2">
              {[
                { id: "verify", label: "Verify integrity after restore", detail: "Checksums and catalog consistency are validated before the test VM is accepted.", checked: verifyIntegrity, set: setVerifyIntegrity },
                { id: "smoke", label: "Run smoke test", detail: "Boots the sandbox and probes service health (ports, HTTP 200, DB connectivity).", checked: smokeTest, set: setSmokeTest },
                { id: "cleanup", label: "Auto-cleanup sandbox after 24h", detail: "The scratch VM is destroyed after 24h; the restore point is untouched.", checked: autoCleanup, set: setAutoCleanup },
              ].map((option) => (
                <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 transition-colors hover:bg-accent">
                  <input type="checkbox" checked={option.checked} onChange={(event) => option.set(event.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer rounded border-input accent-[#1479e8]" />
                  <span>
                    <span className="block text-[0.8125rem] font-semibold text-foreground">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{option.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {step === 4 && selectedPoint && (
            <div className="flex flex-col gap-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border p-3 text-xs">
                <dt className="text-muted-foreground">Asset</dt><dd className="text-right font-mono text-foreground">{selectedPoint.host}</dd>
                <dt className="text-muted-foreground">Point</dt><dd className="text-right font-mono text-muted-foreground">{selectedPoint.id}</dd>
                <dt className="text-muted-foreground">Size</dt><dd className="text-right tabular-nums text-foreground">{formatBytes(selectedPoint.sizeBytes)}</dd>
                <dt className="text-muted-foreground">Created</dt><dd className="text-right text-foreground">{timeAgo(selectedPoint.epochMs)}</dd>
                <dt className="text-muted-foreground">Target</dt><dd className="text-right text-foreground">{isInPlace ? "In-place (production)" : "Sandbox VM (recommended)"}</dd>
                <dt className="text-muted-foreground">RTO target</dt><dd className="text-right text-foreground">{RTO_TARGET_MIN}m</dd>
                <dt className="text-muted-foreground">Options</dt><dd className="text-right text-foreground">{[verifyIntegrity && "verify", smokeTest && "smoke", autoCleanup && "cleanup"].filter(Boolean).join(", ") || "none"}</dd>
              </dl>
              <p role="alert" className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                The rehearsal restores data to a scratch copy. Production data is not modified. Duration counts toward your RTO.
              </p>
              {restoring && (
                <div>
                  <p className="flex items-center justify-between text-xs font-medium text-muted-foreground"><span>Restoring into sandbox...</span><span className="tabular-nums">{progress}%</span></p>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Restore progress">
                    <div className="h-full rounded-full bg-blue-500 transition-[width] duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between border-t border-border px-5 py-3">
          <Button variant="ghost" className="h-9 gap-1 rounded-lg px-3 text-[0.8125rem]" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))} disabled={step === 1 || restoring}>
            <ChevronLeft size={14} aria-hidden="true" />Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9 rounded-lg px-4 text-[0.8125rem]" onClick={() => onOpenChange(false)} disabled={restoring}>Cancel</Button>
            {step < 4 ? (
              <Button className="h-9 gap-1 rounded-lg px-4 text-[0.8125rem] font-semibold" onClick={() => setStep((s) => (s < 4 ? ((s + 1) as 2 | 3 | 4) : s))} disabled={!canContinue}>
                Continue<ChevronRight size={14} aria-hidden="true" />
              </Button>
            ) : (
              <Button className="h-9 gap-1.5 rounded-lg bg-primary px-4 text-[0.8125rem] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50" onClick={start} disabled={!canContinue || restoring}>
                <ArchiveRestore size={14} aria-hidden="true" />{restoring ? `Starting ${progress}%` : "Start restore"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
