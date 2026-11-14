"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Legend } from "@/components/shared/panel";
import { Panel } from "@/components/shared/panel";
import type { AlertStats } from "@/utils/alertStats";

interface AlertsTrendCardProps {
  trend: AlertStats["trend"];
  total24h: number;
}

/** 24h stacked bars (Critical red, Warning amber, Info blue) on oklch(0.9276 0.0058 264.53) gridlines. */
export function AlertsTrendCard({ trend, total24h }: AlertsTrendCardProps) {
  const peak = trend.reduce((best, bucket) => (bucket.total > best.total ? bucket : best), trend[0]);
  return (
    <Panel
      title="Alerts Trend"
      className="flex h-full min-w-0 flex-col rounded-xl p-5"
      titleClassName="text-[1rem] font-semibold"
      headerClassName="h-10"
      showOptions
      action={<span className="text-[0.75rem] text-muted-foreground">Last 24h · per 2h</span>}
    >
      <div className="h-[14.75rem] min-w-0" aria-label="Alerts triggered over the last 24 hours, stacked by severity">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trend} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "var(--accent)", opacity: 0.5 }}
              contentStyle={{ border: "0.0625rem solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }}
            />
            <Bar dataKey="critical" name="Critical" stackId="alerts" fill="oklch(0.5771 0.2152 27.33)" radius={[0, 0, 0, 0]} maxBarSize={26} />
            <Bar dataKey="warning" name="Warning" stackId="alerts" fill="oklch(0.6658 0.1574 58.32)" maxBarSize={26} />
            <Bar dataKey="info" name="Info" stackId="alerts" fill="oklch(0.6231 0.188 259.81)" radius={[3, 3, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-auto border-t border-border pt-2">
        <Legend
          items={[
            { name: "Critical", color: "oklch(0.5771 0.2152 27.33)" },
            { name: "Warning", color: "oklch(0.6658 0.1574 58.32)" },
            { name: "Info", color: "oklch(0.6231 0.188 259.81)" },
          ]}
        />
        <p className="mt-1.5 text-center text-[0.75rem] text-muted-foreground">
          {total24h} alerts in 24h · peak {peak.label} ({peak.total})
        </p>
      </div>
    </Panel>
  );
}
