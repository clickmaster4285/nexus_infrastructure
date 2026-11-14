"use client";

import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Legend, Panel } from "@/components/shared/panel";
import {
  healthTrend,
  serverAvailability,
  storageTrend,
  traffic,
  usageTrend,
} from "@/data/mock/dashboard";

const tooltip = {
  contentStyle: {
    border: "0.0625rem solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    boxShadow: "0 0.25rem 0.875rem oklch(0.2779 0.0632 258.88 / 0.07)",
  },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 4 },
};

const axis = {
  tick: { fill: "var(--muted-foreground)", fontSize: 12 },
  axisLine: { stroke: "var(--border)" },
  tickLine: false,
};

interface TrendChartProps {
  data: Record<string, unknown>[];
  keys: string[];
  colors: string[];
}

function TrendChart({ data, keys, colors }: TrendChartProps) {
  return (
    <div className="min-h-0 w-full flex-1 pt-1.5">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 5, left: -16, bottom: 0 }}>
          <defs>
            {keys.map((key, index) => (
              <linearGradient id={`fill-${key}`} key={key} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[index]} stopOpacity={0.13} />
                <stop offset="100%" stopColor={colors[index]} stopOpacity={0.01} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="time" tickCount={7} interval={1} {...axis} />
          <YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} ticks={[0, 25, 50, 75, 100]} {...axis} />
          <Tooltip {...tooltip} />
          {keys.map((key, index) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[index]}
              strokeWidth={2}
              fill={`url(#fill-${key})`}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HealthTrendPanel({ className }: { className?: string }) {
  const colors = ["oklch(0.6958 0.1561 156.66)", "oklch(0.808 0.161 83.12)", "oklch(0.6406 0.2075 21.05)"];
  return (
    <Panel size="lg" title="Infrastructure Health Trend" range="24h" className={className}>
      <TrendChart data={healthTrend as unknown as Record<string, unknown>[]} keys={["healthy", "warning", "critical"]} colors={colors} />
      <Legend items={[{ name: "Healthy", color: colors[0] }, { name: "Warning", color: colors[1] }, { name: "Critical", color: colors[2] }]} />
    </Panel>
  );
}

export function UsagePanel({ className }: { className?: string }) {
  const colors = ["oklch(0.6311 0.1762 253.47)", "oklch(0.598 0.234 307.76)"];
  return (
    <Panel size="lg" title="CPU & Memory Usage" range="24h" className={className}>
      <TrendChart data={usageTrend as unknown as Record<string, unknown>[]} keys={["cpu", "memory"]} colors={colors} />
      <Legend items={[{ name: "CPU Usage", color: colors[0] }, { name: "Memory Usage", color: colors[1] }]} />
    </Panel>
  );
}

export function StoragePanel({ className }: { className?: string }) {
  return (
    <Panel size="lg" title="Disk Usage & Storage Growth" range="7d" className={className}>
      <div className="min-h-0 w-full flex-1 pt-1.5">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={storageTrend} margin={{ top: 6, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis yAxisId="left" domain={[0, 8]} ticks={[0, 2, 4, 6, 8]} tickFormatter={(value: number) => `${value} TB`} {...axis} />
            <YAxis yAxisId="right" orientation="right" hide domain={[0, 8]} />
            <Tooltip {...tooltip} />
            <Bar yAxisId="left" dataKey="used" fill="oklch(0.6397 0.1698 255.17)" radius={[2, 2, 0, 0]} barSize={15} />
            <Line yAxisId="right" dataKey="growth" stroke="oklch(0.7122 0.1608 156.39)" strokeWidth={1.7} dot={{ r: 2.5, fill: "oklch(0.7122 0.1608 156.39)" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Legend items={[{ name: "Used Space", color: "oklch(0.6311 0.1762 253.47)" }, { name: "Growth", color: "oklch(0.7122 0.1608 156.39)" }]} />
    </Panel>
  );
}

export function NetworkTrafficPanel({ className }: { className?: string }) {
  return (
    <Panel size="lg" title="Network Traffic" range="24h" className={className}>
      <div className="min-h-0 w-full flex-1 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={traffic} margin={{ top: 5, right: 18, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="inbound" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.6311 0.1762 253.47)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="oklch(0.6311 0.1762 253.47)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="outbound" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.598 0.234 307.76)" stopOpacity={0.13} />
                <stop offset="100%" stopColor="oklch(0.598 0.234 307.76)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="time" tickCount={7} interval={1} {...axis} />
            <YAxis width={68} domain={[0, 150]} ticks={[0, 50, 100, 150]} tickFormatter={(value: number) => `${value} Mbps`} {...axis} />
            <Tooltip {...tooltip} />
            <Area type="monotone" dataKey="inbound" stroke="oklch(0.6311 0.1762 253.47)" fill="url(#inbound)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="outbound" stroke="oklch(0.598 0.234 307.76)" fill="url(#outbound)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <Legend items={[{ name: "Inbound", color: "oklch(0.6311 0.1762 253.47)" }, { name: "Outbound", color: "oklch(0.598 0.234 307.76)" }]} />
    </Panel>
  );
}

const segmentColors = ["oklch(0.7395 0.1592 157.98)", "oklch(0.7981 0.1404 157.39)", "oklch(0.7835 0.1473 74.85)", "oklch(0.587 0.2241 308.42)", "oklch(0.5462 0.2048 299.14)"];

export function AvailabilityPanel({ className }: { className?: string }) {
  return (
    <Panel size="lg" title="Server Availability" range="24h" className={className}>
      <div className="flex flex-1 flex-col gap-3 pt-2">
        {serverAvailability.map((server) => (
          <div key={server.name} className="grid min-h-[1.5625rem] grid-cols-[minmax(6.25rem,1fr)_2.625rem_minmax(5.625rem,1.2fr)] items-center gap-2 text-xs text-[oklch(0.5082_0.0495_256.03)] dark:text-[oklch(0.7879_0.0377_252.13)]">
            <span className="truncate">{server.name}</span>
            <span className="whitespace-nowrap text-right tabular-nums">{server.count}</span>
            <div className="flex h-2.5 overflow-hidden rounded-sm bg-muted" aria-hidden="true">
              {server.segments.map((value, index) => (
                <span key={index} style={{ width: `${value}%`, background: segmentColors[index] }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-[minmax(6.25rem,1fr)_2.625rem_minmax(5.625rem,1.2fr)] gap-2 text-[0.5625rem] text-muted-foreground" aria-hidden="true">
        <span />
        <span />
        <span className="flex justify-between">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </span>
      </div>
    </Panel>
  );
}
