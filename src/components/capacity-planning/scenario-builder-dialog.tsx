"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Save, Siren, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createScenario, daysToThreshold, type CapacityResource,
} from "@/mocks/capacityPlanning";

const inputLabelClass = "block space-y-1.5 text-[0.8125rem] font-medium text-muted-foreground";

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fmtDays = (days: number) => Number.isFinite(days) ? `${Math.round(days)}d` : "No exhaustion";

export interface ScenarioBuilderResult {
  name: string;
  growthPct: number;
  addCapacity: number;
  addServers: number;
  workloadShiftPct: number;
  startDate: string;
  daysGained: number;
  newExhaustionDate: string | null;
  estimatedCost: number;
  utilizationAtHorizonPct: number;
  baselineDays: number;
  scenarioDays: number;
  baselineExhaustionDate: string | null;
}

export function ScenarioBuilderDialog({ open, onOpenChange, resource, onApply, onCreatePlan, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: CapacityResource | null;
  /** Push the scenario onto the main chart. */
  onApply: (result: ScenarioBuilderResult) => void;
  /** Open the plan dialog pre-filled from this scenario. */
  onCreatePlan: (result: ScenarioBuilderResult) => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [growthPct, setGrowthPct] = useState(25);
  const [addCapacity, setAddCapacity] = useState(5);
  const [capacityUnit, setCapacityUnit] = useState<"TB" | "GB" | "vCPU" | "servers">("TB");
  const [addServers, setAddServers] = useState(0);
  const [workloadShiftPct, setWorkloadShiftPct] = useState(0);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    setName(resource ? `${resource.name} · what-if` : "What-if scenario");
    setGrowthPct(25);
    setAddCapacity(resource?.metric === "Storage TB" ? 5 : 1);
    setCapacityUnit(resource?.metric === "Storage TB" ? "TB" : resource?.metric === "Storage GB" ? "GB" : "vCPU");
    setAddServers(0);
    setWorkloadShiftPct(0);
    setStartDate(new Date().toISOString().slice(0, 10));
  }, [open, resource]);

  const model = useMemo(() => {
    if (!resource) return null;
    const slopePerWeek = resource.growthPerWeek;
    const slopePerDay = slopePerWeek / 7;
    const baselineDays = daysToThreshold(resource.current, slopePerDay, resource.critThreshold);
    const relief = capacityUnit === "servers"
      ? (addServers * 10 * 100) / 100 // each server ≈ 10% headroom
      : Math.min(resource.current, (addCapacity / resource.capacity) * 100);
    const adjustedSlope = Math.max(0, slopePerDay * (1 + growthPct / 100 + workloadShiftPct / 100));
    const effectiveCurrent = Math.max(0, resource.current - relief);
    const scenarioDays = daysToThreshold(effectiveCurrent, adjustedSlope, resource.critThreshold);
    const horizon = 90;
    const baselineHorizon = Math.max(0, resource.current + slopePerDay * horizon);
    const scenarioHorizon = Math.max(0, effectiveCurrent + adjustedSlope * horizon);
    const utilizationAtHorizonPct = Math.min(100, (scenarioHorizon / resource.capacity) * 100);
    const costBase = capacityUnit === "servers" ? addServers * 500 : addCapacity * (resource.unitCostRate || 0);
    const estimatedCost = Math.round(costBase);
    const baseExhaustion = Number.isFinite(baselineDays) ? Date.now() + baselineDays * 86_400_000 : null;
    const newExhaustion = Number.isFinite(scenarioDays) ? Date.now() + scenarioDays * 86_400_000 : null;
    const daysGained = Number.isFinite(baselineDays) && Number.isFinite(scenarioDays) ? Math.round(scenarioDays - baselineDays) : Number.isFinite(scenarioDays) ? 365 : 0;
    return {
      baselineDays,
      scenarioDays,
      daysGained,
      newExhaustionDate: newExhaustion ? new Date(newExhaustion).toISOString() : null,
      baselineExhaustionDate: baseExhaustion ? new Date(baseExhaustion).toISOString() : null,
      utilizationAtHorizonPct: Math.round(utilizationAtHorizonPct * 10) / 10,
      baselineHorizonPct: Math.round(Math.min(100, (baselineHorizon / resource.capacity) * 100) * 10) / 10,
      adjustedSlopePerDay: adjustedSlope,
      effectiveCurrent,
      estimatedCost,
    };
  }, [resource, growthPct, addCapacity, capacityUnit, addServers, workloadShiftPct]);

  if (!resource) return null;

  const buildResult = (): ScenarioBuilderResult => ({
    name: name.trim() || `${resource.name} · what-if`,
    growthPct,
    addCapacity,
    addServers: capacityUnit === "servers" ? addServers : 0,
    workloadShiftPct,
    startDate,
    daysGained: model?.daysGained ?? 0,
    newExhaustionDate: model?.newExhaustionDate ?? null,
    estimatedCost: model?.estimatedCost ?? 0,
    utilizationAtHorizonPct: model?.utilizationAtHorizonPct ?? 0,
    baselineDays: model?.baselineDays ?? Number.POSITIVE_INFINITY,
    scenarioDays: model?.scenarioDays ?? Number.POSITIVE_INFINITY,
    baselineExhaustionDate: model?.baselineExhaustionDate ?? null,
  });

  const save = () => {
    if (!model) return;
    const result = buildResult();
    createScenario({
      name: result.name,
      resourceId: resource.id,
      resourceName: resource.name,
      adjustment: { growthPct, addCapacity: capacityUnit === "servers" ? 0 : addCapacity, addServers: capacityUnit === "servers" ? addServers : 0, workloadShiftPct, startDate },
      resultSummary: `${result.daysGained >= 0 ? "+" : ""}${result.daysGained}d gained · util @90d ${result.utilizationAtHorizonPct}%`,
      daysGained: result.daysGained,
      newExhaustionDate: result.newExhaustionDate,
      estimatedCost: result.estimatedCost,
      savedBy: "Ayesha Khan",
    });
    onSaved("Scenario saved");
    onOpenChange(false);
  };

  const apply = () => {
    if (!model) return;
    onApply(buildResult());
    onOpenChange(false);
  };

  const createPlan = () => {
    if (!model) return;
    onCreatePlan(buildResult());
    onOpenChange(false);
  };

  const baselineLabel = model ? fmtDays(model.baselineDays) : "—";
  const scenarioLabel = model ? fmtDays(model.scenarioDays) : "—";
  const reliefPct = model ? Math.min(resource.current, ((capacityUnit === "servers" ? addServers * 10 : addCapacity / resource.capacity * 100))) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(36rem,calc(100vw-2rem))]" aria-describedby="scenario-builder-desc">
        <DialogHeader>
          <DialogTitle>What-if scenario — {resource.name}</DialogTitle>
          <DialogDescription id="scenario-builder-desc">Test capacity changes before committing. Nothing is applied until you create a plan. All figures are estimates.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`${inputLabelClass} sm:col-span-2`}>
            Scenario name
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. S3 +5 TB with 25% growth" aria-label="Scenario name" autoComplete="off" className="h-10 text-[0.875rem]" />
          </label>

          <label className={inputLabelClass}>
            Growth adjustment <span className="tabular-nums text-foreground">{growthPct > 0 ? "+" : ""}{growthPct}%</span>
            <input type="range" min={-50} max={200} step={5} value={growthPct} onChange={(event) => setGrowthPct(Number(event.target.value))} aria-label="Growth adjustment" className="h-2 w-full cursor-pointer accent-[var(--primary)]" />
            <span className="flex justify-between text-[0.625rem] text-muted-foreground"><span>−50%</span><span>0</span><span>+200%</span></span>
          </label>

          <label className={inputLabelClass}>
            Workload shift <span className="tabular-nums text-foreground">{workloadShiftPct > 0 ? "+" : ""}{workloadShiftPct}%</span>
            <input type="range" min={-50} max={50} step={5} value={workloadShiftPct} onChange={(event) => setWorkloadShiftPct(Number(event.target.value))} aria-label="Workload shift" className="h-2 w-full cursor-pointer accent-[var(--primary)]" />
            <span className="flex justify-between text-[0.625rem] text-muted-foreground"><span>−50%</span><span>0</span><span>+50%</span></span>
          </label>

          <div className={inputLabelClass}>
            Add capacity
            <div className="flex gap-2">
              <Input type="number" min={0} value={addCapacity} onChange={(event) => setAddCapacity(Math.max(0, Number(event.target.value) || 0))} aria-label="Add capacity amount" className="h-10 flex-1 text-[0.875rem]" />
              <select value={capacityUnit} onChange={(event) => { const unit = event.target.value as typeof capacityUnit; setCapacityUnit(unit); if (unit === "servers") setAddCapacity(0); }} aria-label="Capacity unit" className="h-10 rounded-md border border-input bg-card px-2 text-[0.875rem] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="TB">TB</option>
                <option value="GB">GB</option>
                <option value="vCPU">vCPU</option>
                <option value="servers">servers</option>
              </select>
            </div>
            {capacityUnit === "servers" && <span className="text-[0.6875rem] text-muted-foreground">{addServers} × ~10% utilization offload each</span>}
          </div>
          {capacityUnit === "servers" && (
            <label className={inputLabelClass}>
              Servers to add
              <input type="number" min={0} value={addServers} onChange={(event) => setAddServers(Math.max(0, Number(event.target.value) || 0))} aria-label="Servers to add" className="h-10 w-full rounded-md border border-input bg-card px-2 text-[0.875rem] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
          )}

          <label className={inputLabelClass}>
            Start date
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Scenario start date" className="h-10 w-full rounded-md border border-input bg-card px-2 text-[0.875rem] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Baseline vs scenario · estimated</p>
          <div className="mt-2 grid grid-cols-3 gap-3 text-center">
            <div>
              <span className="block text-[0.625rem] uppercase text-muted-foreground">Days to threshold</span>
              <b className="mt-1 block text-lg tabular-nums text-foreground">{baselineLabel}</b>
              <span className="text-[0.625rem] text-muted-foreground">baseline</span>
            </div>
            <div>
              <span className="block text-[0.625rem] uppercase text-muted-foreground">Scenario</span>
              <b className={`mt-1 block text-lg tabular-nums ${(model?.daysGained ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{scenarioLabel}</b>
              <span className="text-[0.625rem] text-muted-foreground">{(model?.daysGained ?? 0) >= 0 ? `+${model?.daysGained ?? 0} days` : `${model?.daysGained ?? 0} days`}</span>
            </div>
            <div>
              <span className="block text-[0.625rem] uppercase text-muted-foreground">New exhaustion</span>
              <b className="mt-1 block text-[0.875rem] tabular-nums text-foreground">{model?.newExhaustionDate ? fmtDate(Date.parse(model.newExhaustionDate)) : "No exhaustion"}</b>
              <span className="text-[0.625rem] text-muted-foreground">Util @ 90d: {model ? `${model.utilizationAtHorizonPct}%` : "—"}</span>
            </div>
          </div>
          <p className="mt-2 border-t border-border pt-2 text-[0.75rem] text-muted-foreground">Relief <b className="text-foreground">~{Math.round(reliefPct)}%</b> headroom · adjusted growth <b className="text-foreground">{model ? `${((model.adjustedSlopePerDay * 7) / (resource.current || 1) * 100).toFixed(2)}%/wk` : "—"}</b> · est. cost <b className="text-foreground">${model?.estimatedCost ?? 0}/mo</b></p>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={save}><Save size={15} />Save scenario</Button>
          <Button type="button" variant="outline" onClick={apply}><Check size={15} />Apply to chart</Button>
          <Button type="button" onClick={createPlan}><Siren size={15} />Create plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
