"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, ShieldAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  appendMaintenanceWindowToStore, makeTimelineEntry, nextMaintenanceWindowId,
} from "@/mocks/maintenanceWindows";
import { MEMBERS } from "@/mocks/members";
import {
  capacityResources, createCapacityPlan, createForecastAlertRule, daysToThreshold, resourceForecast,
} from "@/mocks/capacityPlanning";
import type { PlanAction } from "@/mocks/capacityPlanning";

const inputLabelClass = "block space-y-1.5 text-[0.8125rem] font-medium text-muted-foreground";
const dateOnly = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const PLAN_ACTIONS: PlanAction[] = ["Expand storage", "Add server", "Right-size", "Migrate", "Cleanup", "Upgrade link"];

export interface PlanPrefill {
  resourceId: string;
  action: PlanAction;
  title: string;
  estimatedCost: number;
  targetDate: string;
  orderByDate: string;
}

export function NewCapacityPlanDialog({ open, onOpenChange, prefill, onCreated, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill: PlanPrefill | null;
  onCreated: () => void;
  onSaved: (message: string) => void;
}) {
  const [resourceId, setResourceId] = useState<string>(capacityResources[0].id);
  const [action, setAction] = useState<PlanAction>("Expand storage");
  const [targetDate, setTargetDate] = useState(() => dateOnly(Date.now() + 14 * 86_400_000));
  const [owner, setOwner] = useState(MEMBERS[0]?.fullName ?? "Ayesha Khan");
  const [estimatedCost, setEstimatedCost] = useState(230);
  const [changeTicket, setChangeTicket] = useState("");
  const [scheduleMaintenance, setScheduleMaintenance] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    const resource = capacityResources.find((item) => item.id === (prefill?.resourceId ?? capacityResources[0].id)) ?? capacityResources[0];
    setResourceId(resource.id);
    const preset = prefill?.action ?? (resource.recommendedAction === "Add capacity" ? "Add server" : resource.recommendedAction);
    setAction(PLAN_ACTIONS.includes(preset as PlanAction) ? preset as PlanAction : "Expand storage");
    setTargetDate(prefill?.targetDate ?? dateOnly(Date.now() + Math.max(1, Math.round(resourceForecast(resource, "auto").daysToCrit || 30)) * 86_400_000));
    setOwner(MEMBERS[0]?.fullName ?? "Ayesha Khan");
    setEstimatedCost(prefill?.estimatedCost ?? resource.estimatedCost ?? 0);
    setChangeTicket("");
    setScheduleMaintenance(true);
    setNotes("");
  }, [open, prefill]);

  const resource = capacityResources.find((item) => item.id === resourceId) ?? capacityResources[0];
  const orderByDate = useMemo(() => {
    const forecast = resourceForecast(resource, "auto");
    if (!Number.isFinite(forecast.daysToCrit)) return dateOnly(Date.now() + 30 * 86_400_000);
    return dateOnly(Date.now() + Math.max(0, forecast.daysToCrit - resource.leadTimeDays) * 86_400_000);
  }, [resource]);
  const orderByMs = Date.parse(orderByDate);
  const targetMs = Date.parse(targetDate);
  const overdue = orderByMs < Date.now();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const forecast = resourceForecast(resource, "auto");
    const targetIso = new Date(`${targetDate}T09:00:00`).toISOString();
    let maintenanceWindowId: string | null = null;
    if (scheduleMaintenance) {
      const start = new Date(`${targetDate}T09:00:00`);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const windowId = nextMaintenanceWindowId();
      appendMaintenanceWindowToStore({
        id: windowId,
        title: `Draft: ${action} — ${resource.name}`,
        description: `Capacity plan (auto-drafted from Capacity Planning): ${action} for ${resource.name}.`,
        type: "Planned",
        status: "Scheduled",
        start: start.toISOString(),
        end: end.toISOString(),
        timeZone: "Asia/Karachi",
        recurrence: { kind: "none", days: [], until: null },
        scope: { servers: resource.linkedAssetId ? [resource.linkedAssetId] : [], groups: [], services: resource.linkedPoolId ? [resource.linkedPoolId] : [], tags: ["capacity"], exclude: [] },
        alertBehavior: { muteAlerts: true, suppressIncidents: true, allowCritical: true, mutedRuleIds: [], autoEnd: true },
        owner,
        approver: null,
        approvalStatus: "Pending",
        changeTicket: changeTicket.trim() || null,
        notifyChannels: ["Slack"],
        impact: "Capacity work — service remains available.",
        createdBy: "Ayesha Khan",
        createdAt: new Date().toISOString(),
        timeline: [makeTimelineEntry("created", "Ayesha Khan", `Draft window for capacity plan on ${resource.name}.`)],
        summary: null,
      });
      maintenanceWindowId = windowId;
    }
    createCapacityPlan({
      title: `${action} — ${resource.name}`,
      resourceId: resource.id,
      resourceName: resource.name,
      action,
      status: "Proposed",
      owner,
      targetDate: targetIso,
      orderByDate: new Date(orderByMs).toISOString(),
      estimatedCost,
      changeTicket: changeTicket.trim() || null,
      maintenanceWindowId,
      notes: notes.trim() || `Order by ${new Date(orderByMs).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — ${Math.round(forecast.daysToCrit)} days to crit (est.).`,
    });
    onCreated();
    onSaved(maintenanceWindowId ? `Plan created · maintenance draft ${maintenanceWindowId} scheduled` : "Capacity plan proposed");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(32rem,calc(100vw-2rem))]" aria-describedby="new-plan-desc">
        <DialogHeader>
          <DialogTitle>New capacity plan</DialogTitle>
          <DialogDescription id="new-plan-desc">Creates a plan proposal. Attach a maintenance window to draft it into Maintenance Windows.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`${inputLabelClass} sm:col-span-2`}>
              Resource
              <Select value={resourceId} onValueChange={setResourceId}>
                <SelectTrigger aria-label="Resource" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {capacityResources.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className={inputLabelClass}>
              Action
              <Select value={action} onValueChange={(value) => setAction(value as PlanAction)}>
                <SelectTrigger aria-label="Action" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_ACTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className={inputLabelClass}>
              Owner
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger aria-label="Owner" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-48">
                  {MEMBERS.map((member) => <SelectItem key={member.id} value={member.fullName}>{member.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className={inputLabelClass}>
              Target date
              <Input type="date" required value={targetDate} onChange={(event) => setTargetDate(event.target.value)} aria-label="Target date" className="h-10 text-[0.875rem]" />
            </label>
            <label className={inputLabelClass}>
              Est. cost ($/mo)
              <Input type="number" value={estimatedCost} onChange={(event) => setEstimatedCost(Number(event.target.value) || 0)} aria-label="Estimated cost per month" className="h-10 text-[0.875rem]" />
            </label>
            <label className={`${inputLabelClass} sm:col-span-2`}>
              Change ticket (optional)
              <Input value={changeTicket} onChange={(event) => setChangeTicket(event.target.value)} placeholder="CHG-2204" aria-label="Change ticket" autoComplete="off" className="h-10 text-[0.875rem]" />
            </label>
          </div>

          <div className={`rounded-xl border px-3 py-2.5 text-[0.75rem] ${overdue ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" : "border-border bg-muted/40 text-muted-foreground"}`}>
            <span className="font-semibold text-foreground">Order by {new Date(orderByMs).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
            {" "}· lead time {resource.leadTimeDays}d from exhaustion ({Math.round(resourceForecast(resource, "auto").daysToCrit)}d · est.)
            {overdue && <span className="block pt-0.5 font-semibold">Lead time exceeded — this plan is overdue for ordering.</span>}
          </div>

          <label className={inputLabelClass}>
            Notes
            <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} aria-label="Plan notes" placeholder="Context, links, rollback plan…" className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-[0.875rem] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem] text-foreground">
            <input type="checkbox" checked={scheduleMaintenance} onChange={(event) => setScheduleMaintenance(event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" aria-label="Create maintenance window draft" />
            <span>Schedule maintenance window <span className="text-[0.75rem] text-muted-foreground">(drafts a 2h window in Maintenance Windows)</span></span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit"><Plus size={15} />Create plan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ForecastAlertDialog({ open, onOpenChange, resourceName, metric, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceName: string;
  metric: string;
  onCreated: (message: string) => void;
}) {
  const [threshold, setThreshold] = useState(90);
  const [windowDays, setWindowDays] = useState(14);
  const [severity, setSeverity] = useState<"Critical" | "Warning" | "Info">("Warning");
  const [channels, setChannels] = useState<string[]>(["Email", "Slack"]);

  useEffect(() => {
    if (!open) return;
    setThreshold(90);
    setWindowDays(14);
    setSeverity("Warning");
    setChannels(["Email", "Slack"]);
  }, [open]);

  const toggleChannel = (channel: string) => setChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rule = createForecastAlertRule({ resourceName, metric, threshold, windowDays, severity });
    onCreated(`Forecast alert ${rule.id} created for ${resourceName} (${threshold}% within ${windowDays}d)`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(28rem,calc(100vw-2rem))]" aria-describedby="forecast-alert-desc">
        <DialogHeader>
          <DialogTitle>Create forecast alert</DialogTitle>
          <DialogDescription id="forecast-alert-desc">Fires when {metric} is forecast to reach the threshold within the selected window. Added to Alert Rules as an Anomaly rule.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={inputLabelClass}>
              Threshold
              <Select value={String(threshold)} onValueChange={(value) => setThreshold(Number(value))}>
                <SelectTrigger aria-label="Threshold" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="85">85% (warn)</SelectItem>
                  <SelectItem value="90">90% (crit)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className={inputLabelClass}>
              Within
              <Select value={String(windowDays)} onValueChange={(value) => setWindowDays(Number(value))}>
                <SelectTrigger aria-label="Window in days" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[7, 14, 30].map((days) => <SelectItem key={days} value={String(days)}>{days} days</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className={inputLabelClass}>
              Severity
              <Select value={severity} onValueChange={(value) => setSeverity(value as typeof severity)}>
                <SelectTrigger aria-label="Severity" className="h-10 text-[0.875rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Critical", "Warning", "Info"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-[0.8125rem] font-medium text-muted-foreground">Notify channels</legend>
            <div className="flex flex-wrap gap-2">
              {["Email", "Slack", "PagerDuty", "Webhook"].map((channel) => (
                <label key={channel} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[0.8125rem] text-foreground">
                  <input type="checkbox" checked={channels.includes(channel)} onChange={() => toggleChannel(channel)} className="h-4 w-4 accent-[var(--primary)]" aria-label={`Notify via ${channel}`} />
                  {channel}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[0.75rem] leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <ShieldAlert size={13} className="mr-1 inline" aria-hidden="true" />Forecasts are estimates. The rule fires on projected values, not measured ones — tune the window to your change cadence.
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Create alert rule</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
