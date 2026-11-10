"use client";

import { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Download, Network, Plus } from "lucide-react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { MetricStat } from "@/data/mock/dashboard";

const stats: MetricStat[] = [
  { label: "Total Interfaces", value: "128", change: "4 new", trend: "up", tone: "blue", icon: "network" },
  { label: "Up Interfaces", value: "112", change: "87.5%", trend: "flat", tone: "green", icon: "online" },
  { label: "Down Interfaces", value: "6", change: "4.7%", trend: "down", tone: "red", icon: "offline" },
  { label: "Avg Bandwidth Usage", value: "42.6%", change: "6.3%", trend: "up", tone: "purple", icon: "activity" },
  { label: "Total Traffic In", value: "2.45 TB", change: "12.4%", trend: "up", tone: "blue", icon: "download" },
  { label: "Total Traffic Out", value: "1.92 TB", change: "9.1%", trend: "up", tone: "green", icon: "network" },
  { label: "Network Alerts", value: "18", change: "2", trend: "down", tone: "amber", icon: "bell" },
];

const hours = ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00"];
const bandwidth = hours.map((time, index) => ({ time, inbound: [74, 69, 76, 80, 68, 73, 71, 77, 65, 72, 76, 70, 75][index], outbound: [42, 45, 50, 46, 48, 41, 44, 49, 43, 47, 51, 42, 46][index] }));
const traffic = hours.map((time, index) => ({ time, inbound: [390, 345, 410, 475, 390, 450, 365, 430, 385, 455, 420, 375, 445][index], outbound: [235, 250, 280, 265, 290, 235, 245, 295, 250, 275, 300, 240, 270][index] }));
const packets = hours.map((time, index) => ({ time, inbound: [14, 13, 15, 16, 14, 15, 14, 16, 15, 14, 15, 14, 13][index], outbound: [8, 8.5, 9.5, 9, 8, 8.5, 9, 9.5, 8.5, 9, 8, 8.5, 8][index] }));

const interfaces = [
  { name: "eth0", device: "core-switch-01", bandwidth: 92.3, inbound: 862.5, outbound: 745.3 },
  { name: "ge-0/0/1", device: "edge-router-01", bandwidth: 78.6, inbound: 612.4, outbound: 498.7 },
  { name: "eth1", device: "db-server-01", bandwidth: 65.1, inbound: 452.1, outbound: 321.3 },
  { name: "ge-0/0/2", device: "edge-router-02", bandwidth: 54.7, inbound: 312.6, outbound: 287.9 },
  { name: "eth0", device: "cache-server-01", bandwidth: 41.3, inbound: 210.3, outbound: 167.2 },
  { name: "eth2", device: "app-server-02", bandwidth: 38.8, inbound: 198.2, outbound: 143.5 },
  { name: "ge-0/0/3", device: "core-switch-02", bandwidth: 34.2, inbound: 178.4, outbound: 134.2 },
  { name: "eth1", device: "worker-01", bandwidth: 29.6, inbound: 142.6, outbound: 108.5 },
  { name: "ge-0/0/4", device: "edge-router-01", bandwidth: 24.7, inbound: 124.3, outbound: 96.2 },
  { name: "eth0", device: "backup-01", bandwidth: 19.2, inbound: 98.4, outbound: 75.6 },
];

const errorInterfaces = [
  { name: "eth3", device: "app-server-01", errorsIn: "12,345", errorsOut: "8,765", discards: "2,341" },
  { name: "ge-0/0/3", device: "edge-router-01", errorsIn: "9,876", errorsOut: "6,543", discards: "1,234" },
  { name: "eth1", device: "cache-server-01", errorsIn: "6,432", errorsOut: "2,987", discards: "987" },
  { name: "ge-0/0/1", device: "edge-router-02", errorsIn: "4,321", errorsOut: "2,123", discards: "643" },
  { name: "eth0", device: "backup-server-01", errorsIn: "3,210", errorsOut: "1,876", discards: "521" },
  { name: "eth2", device: "core-switch-02", errorsIn: "2,145", errorsOut: "1,258", discards: "312" },
];

const interfaceStates = [
  { name: "Up", value: 112, color: "#35b879", percent: "87.5%" },
  { name: "Warning", value: 10, color: "#f39a12", percent: "7.8%" },
  { name: "Down", value: 6, color: "#ed3346", percent: "4.7%" },
  { name: "Disabled", value: 0, color: "#aeb9c8", percent: "0%" },
];

const trafficDistribution = [
  { name: "Web Traffic", value: 1.62, label: "1.62 TB (37.1%)", color: "#2878ed" },
  { name: "DB Traffic", value: 1.15, label: "1.15 TB (26.3%)", color: "#35b879" },
  { name: "Streaming", value: 0.85, label: "0.85 TB (19.5%)", color: "#8a45df" },
  { name: "Other", value: 0.75, label: "0.75 TB (17.1%)", color: "#f39a12" },
];

const protocols = [
  { name: "TCP", value: 1.45, label: "1.45 TB (59.2%)", color: "#2878ed" },
  { name: "UDP", value: 0.68, label: "0.68 TB (27.8%)", color: "#35b879" },
  { name: "ICMP", value: 0.18, label: "0.18 TB (7.3%)", color: "#8a45df" },
  { name: "Other", value: 0.14, label: "0.14 TB (5.7%)", color: "#f39a12" },
];

const talkersByTraffic = [
  { address: "10.10.10.25", value: "652.4 GB", width: "100%", color: "bg-blue-500" },
  { address: "10.10.20.18", value: "521.7 GB", width: "80%", color: "bg-emerald-500" },
  { address: "192.168.1.45", value: "412.9 GB", width: "63%", color: "bg-violet-500" },
  { address: "172.16.5.22", value: "312.6 GB", width: "48%", color: "bg-amber-500" },
  { address: "10.10.30.11", value: "286.3 GB", width: "44%", color: "bg-cyan-500" },
];

const talkersByConnections = [
  { address: "10.10.10.25", value: "12,543", width: "100%", color: "bg-blue-500" },
  { address: "10.10.20.18", value: "9,876", width: "79%", color: "bg-emerald-500" },
  { address: "192.168.1.45", value: "7,854", width: "63%", color: "bg-violet-500" },
  { address: "172.16.5.22", value: "6,321", width: "50%", color: "bg-amber-500" },
  { address: "10.10.30.11", value: "5,432", width: "43%", color: "bg-cyan-500" },
];

const networkAlerts = [
  { alert: "High bandwidth usage", device: "core-switch-01", iface: "eth0", severity: "Critical", message: "Inbound bandwidth usage is 92% which is above the threshold (90%)", time: "2m ago" },
  { alert: "Interface down", device: "edge-router-02", iface: "ge-0/0/4", severity: "Warning", message: "Interface is down", time: "7m ago" },
  { alert: "High packet errors", device: "app-server-01", iface: "eth3", severity: "Warning", message: "High packet error rate detected (1.25%)", time: "12m ago" },
  { alert: "Interface up", device: "db-server-01", iface: "eth2", severity: "Info", message: "Interface is back up", time: "18m ago" },
  { alert: "High latency", device: "edge-router-01", iface: "ge-0/0/1", severity: "Warning", message: "Average latency is 125ms which is above the threshold (100ms)", time: "25m ago" },
];

function TrendChart({
  data,
  max,
  ticks,
  formatter,
  lines,
  area = false,
  bar = false,
}: {
  data: Record<string, string | number>[];
  max: number;
  ticks: number[];
  formatter?: (value: number) => string;
  lines: { key: string; name: string; color: string }[];
  area?: boolean;
  bar?: boolean;
}) {
  return (
    <div className="h-[165px] w-full pt-1">
      <ResponsiveContainer width="100%" height="100%">
        {bar ? (
          <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical />
            <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis width={48} domain={[0, max]} ticks={ticks} tickFormatter={formatter} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
            {lines.map((item) => <Bar key={item.key} dataKey={item.key} name={item.name} fill={item.color} radius={[3, 3, 0, 0]} maxBarSize={12} />)}
          </BarChart>
        ) : area ? (
          <AreaChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical />
            <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis width={48} domain={[0, max]} ticks={ticks} tickFormatter={formatter} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
            {lines.map((item) => <Area key={item.key} dataKey={item.key} name={item.name} type="monotone" stroke={item.color} strokeWidth={1.8} fill={item.color} fillOpacity={0.09} dot={false} />)}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical />
            <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis width={48} domain={[0, max]} ticks={ticks} tickFormatter={formatter} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, background: "var(--popover)" }} />
            {lines.map((item) => <Line key={item.key} dataKey={item.key} name={item.name} type="monotone" stroke={item.color} strokeWidth={2} dot={{ r: 2.2, strokeWidth: 1 }} activeDot={{ r: 4 }} />)}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function TrafficDonut({ data, total, unit }: { data: { name: string; value: number; label: string; color: string }[]; total: string; unit?: string }) {
  return (
    <div className="flex h-[158px] items-center gap-2.5">
      <div className="relative h-[140px] w-[45%] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="88%" paddingAngle={1} stroke="none">
              {data.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie><Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className="font-display text-[18px] font-extrabold leading-tight text-foreground">{total}</b>
          <span className="text-[12px] text-muted-foreground">{unit ?? "Total"}</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {data.map((item) => <div key={item.name} className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-1.5 text-[12px]"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate text-foreground">{item.name}</span><b className="whitespace-nowrap text-foreground">{item.label}</b></div>)}
      </div>
    </div>
  );
}

function TalkerList({ title, items, onViewAll }: { title: string; items: { address: string; value: string; width: string; color: string }[]; onViewAll?: () => void }) {
  return (
    <Panel title={title} className="min-w-0" action={onViewAll ? <button onClick={onViewAll} className="text-[12px] font-semibold text-primary">View All →</button> : undefined}>
      <div className="flex flex-1 items-center py-2">
        <div className="w-full space-y-3">
          {items.map((item) => <div key={item.address} className="grid grid-cols-[minmax(0,1fr)_minmax(45px,1.3fr)_auto] items-center gap-2 text-[12px]"><span className="truncate text-foreground">{item.address}</span><div className="h-[7px] rounded-full bg-muted"><div className={`h-full rounded-full ${item.color}`} style={{ width: item.width }} /></div><b className="text-right text-foreground">{item.value}</b></div>)}
          <div className="flex justify-between border-t border-border pt-2 text-[12px] font-semibold text-foreground"><span>Total</span><span>{items === talkersByTraffic ? "2.19 TB" : "41,626"}</span></div>
        </div>
      </div>
    </Panel>
  );
}

export function NetworkMonitoringDashboard() {
  const [notice, setNotice] = useState("");
  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const exportCsv = () => {
    const header = ["Alert", "Device", "Interface", "Severity", "Message", "Time"];
    const rows = networkAlerts.map((item) => [item.alert, item.device, item.iface, item.severity, item.message, item.time]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "network-monitoring-alerts.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast("Network alert report exported.");
  };
  const timeAction = (
    <div className="flex items-center gap-0.5">
      <select aria-label="Aggregation" className="h-6 rounded border border-border bg-card px-1 text-[11px] text-foreground"><option>Average</option><option>Maximum</option><option>Minimum</option></select>
      {["1H", "6H", "12H", "24H"].map((item) => <button key={item} onClick={() => toast(`${item} time range selected.`)} className={`rounded px-1.5 py-1 text-[11px] font-semibold ${item === "24H" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{item}</button>)}
    </div>
  );

  return (
    <div className="space-y-2.5 pb-3">
      <PageMeta breadcrumbs={["Monitoring", "Network Monitoring"]} showRefresh={false} variant="detail" />
      <PageHeading title="Network Monitoring" description="Real-time overview of your network performance, traffic, and connectivity." icon={<Network size={19} />} actionsAlign="top" variant="detail">
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Download size={15} />Export CSV</Button>
          <Button size="sm" onClick={() => toast("Add Widget is a mockup action.")} className="h-9 gap-1.5 whitespace-nowrap px-3 text-[12px]"><Plus size={15} />Add Widget</Button>
        </div>
      </PageHeading>

      <section aria-label="Network summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-7">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[82px]" labelClassName="text-[12px]" valueClassName="text-[24px]" trendClassName="text-[11px]" />)}
      </section>

      <section aria-label="Network traffic trends" className="grid gap-2.5 xl:grid-cols-3">
        <Panel title="Bandwidth Usage Over Time" className="min-w-0" action={timeAction}>
          <TrendChart data={bandwidth} max={100} ticks={[0, 25, 50, 75, 100]} formatter={(value) => `${value}%`} lines={[{ key: "inbound", name: "Inbound Usage", color: "#2878ed" }, { key: "outbound", name: "Outbound Usage", color: "#35b879" }]} area />
          <div className="flex justify-center gap-4 pt-1 text-[12px] text-muted-foreground">{[["Inbound Usage", "#2878ed"], ["Outbound Usage", "#35b879"]].map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>
        </Panel>
        <Panel title="Network Traffic (In/Out)" className="min-w-0" action={timeAction}>
          <TrendChart data={traffic} max={600} ticks={[0, 150, 300, 450, 600]} formatter={(value) => String(value)} lines={[{ key: "inbound", name: "Traffic In (Mbps)", color: "#2878ed" }, { key: "outbound", name: "Traffic Out (Mbps)", color: "#35b879" }]} bar />
          <div className="flex justify-center gap-4 pt-1 text-[12px] text-muted-foreground">{[["Traffic In (Mbps)", "#2878ed"], ["Traffic Out (Mbps)", "#35b879"]].map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>
        </Panel>
        <Panel title="Packets In/Out" className="min-w-0" action={timeAction}>
          <TrendChart data={packets} max={20} ticks={[0, 5, 10, 15, 20]} formatter={(value) => String(value)} lines={[{ key: "inbound", name: "Packets In (pps)", color: "#2878ed" }, { key: "outbound", name: "Packets Out (pps)", color: "#35b879" }]} />
          <div className="flex justify-center gap-4 pt-1 text-[12px] text-muted-foreground">{[["Packets In (pps)", "#2878ed"], ["Packets Out (pps)", "#35b879"]].map(([label, color]) => <span key={label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}</div>
        </Panel>
      </section>

      <section aria-label="Interface details" className="grid gap-2.5 xl:grid-cols-[1.14fr_1.04fr_0.82fr]">
        <Panel title="Top Interfaces by Bandwidth Usage" className="min-w-0" action={<button onClick={() => toast("Showing all interfaces by bandwidth.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[620px] text-left text-[12px]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Interface", "Device", "Bandwidth Usage", "In (Mbps)", "Out (Mbps)", "Trend"].map((heading) => <th key={heading} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{interfaces.slice(0, 5).map((item, index) => <tr key={`${item.device}-${item.name}`} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1 py-[5px] font-semibold text-foreground">{item.name}</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{item.device}</td><td className="px-1 py-[5px] text-foreground">{item.bandwidth.toFixed(1)}%</td><td className="px-1 py-[5px] text-foreground">{item.inbound.toFixed(1)}</td><td className="px-1 py-[5px] text-foreground">{item.outbound.toFixed(1)}</td><td className="px-1 py-[5px] text-emerald-600">Up <svg viewBox="0 0 42 14" className="ml-1 inline h-3 w-8" aria-hidden="true"><polyline points={`0,11 8,${7 + index % 4} 16,9 24,${4 + index % 5} 32,7 41,3`} fill="none" stroke="#35b879" strokeWidth="1.2" /></svg></td></tr>)}</tbody>
            </table>
          </div>
          <div className="flex justify-between pt-1 text-[11px] text-muted-foreground"><span>Showing 1-5 of 128 interfaces</span><span>Rows per page:　5　‹　<span className="rounded bg-primary px-1 text-white">1</span>　2　3　4　5　…　26　›</span></div>
        </Panel>

        <Panel title="Top Interfaces by Errors" className="min-w-0" action={<button onClick={() => toast("Showing all interfaces by errors.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[560px] text-left text-[12px]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Interface", "Device", "Errors In", "Errors Out", "Discards", "Status"].map((heading) => <th key={heading} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>{errorInterfaces.slice(0, 5).map((item) => <tr key={`${item.device}-${item.name}`} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{item.name}</td><td className="whitespace-nowrap px-1 py-[5px] text-foreground">{item.device}</td><td className="px-1 py-[5px] text-foreground">{item.errorsIn}</td><td className="px-1 py-[5px] text-foreground">{item.errorsOut}</td><td className="px-1 py-[5px] text-foreground">{item.discards}</td><td className="px-1 py-[5px]"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Up</span></td></tr>)}</tbody>
            </table>
          </div>
          <div className="pt-1 text-[11px] text-muted-foreground">Showing 1-5 of 128 interfaces</div>
        </Panel>

        <Panel title="Interface Summary" className="min-w-0">
          <div className="flex h-[150px] items-center gap-2">
            <div className="relative h-[130px] w-[45%] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={interfaceStates} dataKey="value" innerRadius="62%" outerRadius="88%" paddingAngle={1} stroke="none">{interfaceStates.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[22px] font-extrabold text-foreground">128</b><span className="text-[12px] text-muted-foreground">Total</span></div>
            </div>
            <div className="min-w-0 flex-1 space-y-3">{interfaceStates.map((item) => <div key={item.name} className="grid grid-cols-[8px_1fr_auto] items-center gap-1.5 text-[12px]"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-foreground">{item.name}</span><b className="text-foreground">{item.value} ({item.percent})</b></div>)}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-[12px]"><div><span className="text-muted-foreground">Avg Inbound Utilization</span><b className="mt-1 block text-[16px] text-foreground">42.6% <span className="text-[11px] text-success">↑ 6.3%</span></b></div><div><span className="text-muted-foreground">Avg Outbound Utilization</span><b className="mt-1 block text-[16px] text-foreground">38.2% <span className="text-[11px] text-success">↑ 5.2%</span></b></div></div>
        </Panel>
      </section>

      <section aria-label="Traffic analysis" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="Traffic Distribution" className="min-w-0"><TrafficDonut data={trafficDistribution} total="4.37 TB" /></Panel>
        <TalkerList title="Top Talkers (By Traffic)" items={talkersByTraffic} />
        <TalkerList title="Top Talkers (By Connections)" items={talkersByConnections} />
        <Panel title="Top Protocols" className="min-w-0"><TrafficDonut data={protocols} total="2.45 TB" /></Panel>
      </section>

      <Panel title="Recent Network Alerts" className="min-w-0" action={<button onClick={() => toast("Showing all network alerts.")} className="text-[12px] font-semibold text-primary">View All →</button>}>
        <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[960px] text-left text-[12px]">
            <thead><tr className="border-b border-border text-muted-foreground">{["Alert", "Device", "Interface", "Severity", "Message", "Time"].map((heading) => <th key={heading} className="whitespace-nowrap px-1.5 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
            <tbody>{networkAlerts.map((item) => <tr key={item.alert} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap px-1.5 py-[6px] font-semibold text-foreground"><i className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${item.severity === "Critical" ? "bg-rose-500" : item.severity === "Warning" ? "bg-amber-500" : "bg-blue-500"}`} />{item.alert}</td><td className="whitespace-nowrap px-1.5 py-[6px] text-foreground">{item.device}</td><td className="whitespace-nowrap px-1.5 py-[6px] text-foreground">{item.iface}</td><td className="px-1.5 py-[6px]"><span className={`rounded-full px-2 py-0.5 text-[11px] ${item.severity === "Critical" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : item.severity === "Warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"}`}>{item.severity}</span></td><td className="px-1.5 py-[6px] text-foreground">{item.message}</td><td className="whitespace-nowrap px-1.5 py-[6px] text-muted-foreground">{item.time}</td></tr>)}</tbody>
          </table>
        </div>
      </Panel>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}
