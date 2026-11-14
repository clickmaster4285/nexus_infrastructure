"use client";

import { useState } from "react";
import {
  ArrowRight, ArrowUp, Download, Plus, RefreshCw,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import type { MetricStat } from "@/data/mock/dashboard";

const stats: MetricStat[] = [
  { label: "Total Accounts", value: "8", change: "1 new", trend: "up", tone: "blue", icon: "cloud" },
  { label: "Active Accounts", value: "6", change: "1", trend: "up", tone: "green", icon: "online" },
  { label: "Inactive Accounts", value: "2", change: "1", trend: "down", tone: "amber", icon: "warning" },
  { label: "Total Providers", value: "4", change: "0", trend: "flat", tone: "purple", icon: "boxes" },
  { label: "Estimated Monthly Cost", value: "$12,450.60", change: "8.4%", trend: "up", tone: "blue", icon: "storage" },
  { label: "Total Resources", value: "1,243", change: "6.7%", trend: "up", tone: "red", icon: "pulse" },
];

const providerColors: Record<string, string> = {
  AWS: "oklch(0.7307 0.1673 59.98)",
  Azure: "oklch(0.5906 0.1926 258.69)",
  GCP: "oklch(0.698 0.1391 156.33)",
  DigitalOcean: "oklch(0.5625 0.2055 294.01)",
};

const providerData = [
  { name: "Amazon Web Services (AWS)", short: "AWS", value: 3, color: providerColors.AWS },
  { name: "Microsoft Azure", short: "Azure", value: 2, color: providerColors.Azure },
  { name: "Google Cloud Platform (GCP)", short: "GCP", value: 2, color: providerColors.GCP },
  { name: "DigitalOcean", short: "DigitalOcean", value: 1, color: providerColors.DigitalOcean },
];

const accountHealth = [
  { time: "12:00", healthy: 88 }, { time: "14:00", healthy: 83 }, { time: "16:00", healthy: 85 },
  { time: "18:00", healthy: 84 }, { time: "20:00", healthy: 90 }, { time: "22:00", healthy: 78 },
  { time: "00:00", healthy: 88 }, { time: "02:00", healthy: 80 }, { time: "04:00", healthy: 91 },
  { time: "06:00", healthy: 82 }, { time: "08:00", healthy: 85 }, { time: "10:00", healthy: 79 },
  { time: "12:00", healthy: 88 },
];

const costs = [
  { day: "Apr 17", value: 9400 }, { day: "Apr 18", value: 9100 }, { day: "Apr 19", value: 10400 },
  { day: "Apr 20", value: 11300 }, { day: "Apr 21", value: 10900 }, { day: "Apr 22", value: 12200 },
  { day: "Apr 23", value: 11800 }, { day: "Apr 24", value: 12500 }, { day: "Apr 25", value: 13200 },
  { day: "Apr 26", value: 13900 }, { day: "Apr 27", value: 13200 }, { day: "Apr 28", value: 14100 },
];

const accounts = [
  { name: "Production AWS", provider: "AWS", id: "123456789012", region: "us-east-1 (N. Virginia)", status: "Active", health: "Healthy", cost: "$5,240.30", resources: 452 },
  { name: "Dev AWS", provider: "AWS", id: "210987654321", region: "ap-south-1 (Mumbai)", status: "Active", health: "Healthy", cost: "$1,250.75", resources: 128 },
  { name: "Azure Production", provider: "Azure", id: "a1b2c3d4-e5f6-7890", region: "East US", status: "Active", health: "Warning", cost: "$3,180.20", resources: 316 },
  { name: "Azure Dev", provider: "Azure", id: "b1c2d3e4-f5g6-7890", region: "West Europe", status: "Inactive", health: "Critical", cost: "$620.10", resources: 48 },
  { name: "GCP Production", provider: "GCP", id: "my-gcp-project-prod", region: "us-central1 (Iowa)", status: "Active", health: "Healthy", cost: "$1,980.55", resources: 210 },
  { name: "GCP Staging", provider: "GCP", id: "my-gcp-project-stg", region: "asia-southeast1 (Singapore)", status: "Active", health: "Healthy", cost: "$780.40", resources: 62 },
  { name: "DigitalOcean Main", provider: "DigitalOcean", id: "17894532", region: "NYC3", status: "Active", health: "Healthy", cost: "$365.30", resources: 17 },
  { name: "DigitalOcean Backup", provider: "DigitalOcean", id: "19874563", region: "SFO2", status: "Inactive", health: "Warning", cost: "$33.00", resources: 10 },
];

const accountTotal = accounts.length;
const accountStatusData = [
  { name: "Active", value: accounts.filter((account) => account.status === "Active").length, color: "oklch(0.7049 0.1497 156.85)" },
  { name: "Inactive", value: accounts.filter((account) => account.status === "Inactive").length, color: "oklch(0.7307 0.1673 59.98)" },
  { name: "Suspended", value: accounts.filter((account) => account.status === "Suspended").length, color: "oklch(0.6199 0.2202 18.35)" },
  { name: "Pending", value: accounts.filter((account) => account.status === "Pending").length, color: "oklch(0.73 0.0349 256.79)" },
].map((item) => ({ ...item, percent: `${accountTotal ? ((item.value / accountTotal) * 100).toFixed(0) : 0}%` }));
const accountStatusSummary = [
  { label: "Healthy", value: `${accounts.filter((account) => account.health === "Healthy").length} / ${accountTotal}` },
  { label: "Warnings", value: String(accounts.filter((account) => account.health === "Warning").length) },
  { label: "Synced", value: `${accounts.filter((account) => account.status === "Active").length} / ${accountTotal}` },
];
const accountSyncInfo = { lastSync: "2m ago", providerCount: providerData.length };

const services = [
  { name: "EC2 Instances", provider: "AWS", cost: "$2,730.45" },
  { name: "Azure Virtual Machines", provider: "Azure", cost: "$1,850.20" },
  { name: "S3 Storage", provider: "AWS", cost: "$1,120.10" },
  { name: "Cloud SQL", provider: "GCP", cost: "$780.60" },
  { name: "Load Balancer", provider: "GCP", cost: "$645.30" },
  { name: "Azure Blob Storage", provider: "Azure", cost: "$420.75" },
  { name: "Cloud CDN", provider: "GCP", cost: "$310.20" },
  { name: "DigitalOcean Droplets", provider: "DigitalOcean", cost: "$250.00" },
];

const providerResources = [
  { name: "AWS", count: 590, color: providerColors.AWS },
  { name: "Azure", count: 364, color: providerColors.Azure },
  { name: "GCP", count: 272, color: providerColors.GCP },
  { name: "DigitalOcean", count: 17, color: providerColors.DigitalOcean },
];
const totalProviderResources = providerResources.reduce((total, provider) => total + provider.count, 0);
const maxProviderResources = Math.max(...providerResources.map((provider) => provider.count));
const providerResourcesWithMetrics = providerResources.map((provider) => ({
  ...provider,
  percent: totalProviderResources ? `${((provider.count / totalProviderResources) * 100).toFixed(1)}%` : "0.0%",
  width: maxProviderResources ? (provider.count / maxProviderResources) * 100 : 0,
}));
const topResourceProvider = [...providerResources].sort((a, b) => b.count - a.count)[0]?.name ?? "—";
const providerResourcesSummary = [
  { label: "Providers", value: String(providerResources.length) },
  { label: "Accounts", value: String(accountTotal) },
  { label: "Top Provider", value: topResourceProvider },
];
const providerResourcesUpdatedAt = "2m ago";

const regions = [
  { name: "us-east-1 (N. Virginia)", provider: "AWS", count: 342 },
  { name: "East US", provider: "Azure", count: 216 },
  { name: "us-central1 (Iowa)", provider: "GCP", count: 178 },
  { name: "ap-south-1 (Mumbai)", provider: "AWS", count: 132 },
  { name: "West Europe", provider: "Azure", count: 126 },
  { name: "asia-southeast1 (SG)", provider: "GCP", count: 94 },
  { name: "eu-west-1 (Ireland)", provider: "AWS", count: 78 },
  { name: "eu-central-1 (Frankfurt)", provider: "AWS", count: 54 },
  { name: "North Europe", provider: "Azure", count: 38 },
  { name: "NYC3", provider: "DigitalOcean", count: 17 },
  { name: "SFO2", provider: "DigitalOcean", count: 10 },
].sort((a, b) => b.count - a.count);
const maxRegionCount = Math.max(...regions.map((region) => region.count));

const events = [
  { text: "Account 'Production AWS' is healthy", ago: "2m ago", color: "bg-emerald-500" },
  { text: "High cost alert for Azure Production", ago: "12m ago", color: "bg-amber-500" },
  { text: "New account 'GCP Staging' added", ago: "24m ago", color: "bg-blue-500" },
  { text: "Account 'Azure Dev' is inactive", ago: "38m ago", color: "bg-rose-500" },
  { text: "Billing data updated for AWS", ago: "45m ago", color: "bg-emerald-500" },
  { text: "Account 'DigitalOcean Backup' warning", ago: "1h ago", color: "bg-amber-500" },
  { text: "Credentials synced for GCP Production", ago: "2h ago", color: "bg-blue-500" },
  { text: "Account 'Dev AWS' sync completed", ago: "3h ago", color: "bg-emerald-500" },
  { text: "New provider 'DigitalOcean' connected", ago: "4h ago", color: "bg-blue-500" },
  { text: "Cost forecast exceeded budget for AWS", ago: "5h ago", color: "bg-amber-500" },
  { text: "Resource inventory synced for Azure Production", ago: "6h ago", color: "bg-emerald-500" },
];

const healthStyles: Record<string, string> = {
  Healthy: "text-emerald-600",
  Warning: "text-amber-600",
  Critical: "text-rose-600",
};

function CloudProviderIcon({ provider }: { provider: string }) {
  const letter = provider === "DigitalOcean" ? "D" : provider === "Azure" ? "A" : provider === "GCP" ? "G" : "a";
  return <span aria-hidden="true" className="inline-grid h-3.5 w-3.5 place-items-center rounded-sm text-[0.75rem] font-extrabold" style={{ color: providerColors[provider] ?? "currentColor" }}>{letter}</span>;
}

function ProviderDonut() {
  return (
    <div className="flex min-h-[10.3125rem] flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
      <div className="relative h-[9.25rem] w-[9.25rem] shrink-0 aspect-square">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={providerData} dataKey="value" nameKey="name" innerRadius="72%" outerRadius="92%" paddingAngle={1} stroke="none">
              {providerData.map((provider) => <Cell key={provider.name} fill={provider.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className="font-display text-[1.625rem] font-extrabold leading-tight text-foreground">{providerData.reduce((total, provider) => total + provider.value, 0)}</b>
          <span className="whitespace-nowrap text-[0.75rem] text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="min-w-0 w-full flex-1 space-y-2.5 sm:w-auto">
        {providerData.map((provider) => (
          <div key={provider.name} className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2 text-[0.75rem]">
            <i className="h-2 w-2 rounded-full" style={{ backgroundColor: provider.color }} />
            <span className="truncate font-semibold text-foreground">{provider.name}</span>
            <span className="whitespace-nowrap text-muted-foreground">{provider.value} ({Math.round(provider.value / 8 * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDonut() {
  return (
    <div className="flex min-h-[8.625rem] items-center justify-center gap-3">
      <div className="relative h-[7.75rem] w-[7.75rem] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={accountStatusData.filter((item) => item.value > 0)} dataKey="value" innerRadius="62%" outerRadius="88%" paddingAngle={1} stroke="none">{accountStatusData.filter((item) => item.value > 0).map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><b className="font-display text-[1.25rem] font-extrabold leading-tight text-foreground">{accountTotal}</b><span className="text-[0.75rem] text-muted-foreground">Total</span></div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {accountStatusData.map((item) => <div key={item.name} className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-1.5 whitespace-nowrap text-[0.75rem]"><i className="h-2 w-2 rounded-full" style={{ background: item.color }} /><span className="text-foreground">{item.name}</span><b className="text-foreground">{item.value} ({item.percent})</b></div>)}
      </div>
    </div>
  );
}

function AccountStatusCard() {
  return (
    <div className="flex h-full flex-1 flex-col">
      <StatusDonut />
      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
        {accountStatusSummary.map((item) => (
          <div key={item.label} className="min-w-0 rounded-lg bg-[oklch(0.9819_0.0029_264.54)] p-2.5 dark:bg-muted/60">
            <div className="truncate text-[0.75rem] text-muted-foreground">{item.label}</div>
            <div className="mt-1 truncate text-[1rem] font-bold leading-5 tabular-nums text-foreground">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[0.75rem] text-muted-foreground">
        <span className="truncate">Last sync: {accountSyncInfo.lastSync} · {accountSyncInfo.providerCount} providers</span>
        <button type="button" className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap font-medium text-primary hover:underline">View all <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>
      </div>
    </div>
  );
}

function ProviderResourcesCard() {
  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-evenly pt-1">
        {providerResourcesWithMetrics.map((provider) => (
          <div key={provider.name} className="grid h-9 grid-cols-[84px_minmax(1.25rem,1fr)_5.625rem] items-center gap-2 text-[0.75rem]">
            <span className="whitespace-nowrap text-foreground">{provider.name}</span>
            <div className="h-[0.4375rem] min-w-0 rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${provider.width}%`, backgroundColor: provider.color }} />
            </div>
            <span className="whitespace-nowrap text-right">
              <b className="font-bold text-foreground">{provider.count.toLocaleString()}</b>{" "}
              <span className="text-muted-foreground">({provider.percent})</span>
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border py-2 text-[0.75rem]">
        <span className="text-muted-foreground">Total resources</span>
        <b className="font-bold tabular-nums text-foreground">{totalProviderResources.toLocaleString()}</b>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
        {providerResourcesSummary.map((item) => (
          <div key={item.label} className="min-w-0 rounded-lg bg-[oklch(0.9819_0.0029_264.54)] p-2.5 dark:bg-muted/60">
            <div className="truncate text-[0.75rem] text-muted-foreground">{item.label}</div>
            <div className="mt-1 truncate text-[1rem] font-bold leading-5 text-foreground">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-auto border-t border-border pt-2 text-[0.75rem] text-muted-foreground">
        Updated {providerResourcesUpdatedAt}
      </div>
    </div>
  );
}

export function CloudAccountsDashboard() {
  const [notice, setNotice] = useState("");
  const [updatedAt, setUpdatedAt] = useState("Just now");
  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const refresh = () => {
    setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    toast("Cloud account data refreshed.");
  };
  const exportCsv = () => {
    const header = ["Account Name", "Provider", "Account ID", "Region", "Status", "Health", "Monthly Cost", "Resources"];
    const rows = accounts.map((account) => [account.name, account.provider, account.id, account.region, account.status, account.health, account.cost, String(account.resources)]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cloud-accounts.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast("Cloud account list exported.");
  };

  return (
    <div className="space-y-2.5 pb-3">
      <PageHeader breadcrumbs={["Infrastructure", "Cloud Accounts & Providers"]} title="Cloud Accounts & Providers" subtitle="Monitor and manage your cloud accounts, usage, and provider health in real-time.">
        <Button variant="outline" onClick={refresh} ><RefreshCw size={15} />Refresh</Button>
        <Button variant="outline" onClick={exportCsv} ><Download size={15} />Export CSV</Button>
        <Button onClick={() => toast("Add Account is a mockup action.")} ><Plus size={15} />Add Account</Button
      </PageHeader>

      <section aria-label="Cloud account metrics" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        {stats.map((item) => <MetricCard key={item.label} item={item} className="h-[5.125rem]" labelClassName="text-[0.75rem]" valueClassName="text-[1.5rem]" trendClassName="text-[0.6875rem]" />)}
      </section>

      <section aria-label="Cloud account overview" className="grid gap-2.5 md:grid-cols-[1fr_1.24fr_0.96fr]">
        <Panel title="Cloud Accounts by Provider" className="min-w-0"><ProviderDonut /></Panel>
        <Panel title="Cloud Account Health Over Time" range="24h" className="min-w-0">
          <div className="h-[10rem] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={accountHealth} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" interval={1} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ border: "0.0625rem solid var(--border)", borderRadius: 8, fontSize: 11, background: "var(--popover)" }} />
                <Area dataKey="healthy" name="Healthy" type="monotone" stroke="oklch(0.6311 0.1762 253.47)" strokeWidth={1.8} fill="oklch(0.6311 0.1762 253.47)" fillOpacity={0.09} dot={{ r: 1.5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1 text-[0.75rem] text-muted-foreground">
            {[["Healthy", "oklch(0.698 0.1391 156.33)"], ["Warning", "oklch(0.7307 0.1673 59.98)"], ["Critical", "oklch(0.6199 0.2202 18.35)"], ["Unknown", "oklch(0.73 0.0349 256.79)"]].map(([label, color]) => <span key={label} className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}
          </div>
        </Panel>
        <Panel title="Cost Overview" action={<span className="rounded border border-border px-2 py-1 text-[0.6875rem] text-muted-foreground">Monthly⌄</span>} className="min-w-0">
          <div className="pt-1 text-[0.6875rem] text-muted-foreground">Total Estimated Cost</div>
          <div className="font-display text-[1.375rem] font-extrabold leading-tight text-foreground">$12,450.60</div>
          <div className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-success"><ArrowUp size={9} />8.4% <span className="text-muted-foreground">from last month</span></div>
          <div className="h-[7.5rem] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costs} margin={{ top: 5, right: 2, left: -24, bottom: 0 }}>
                <defs><linearGradient id="cloud-cost-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="oklch(0.6311 0.1762 253.47)" stopOpacity={0.2} /><stop offset="100%" stopColor="oklch(0.6311 0.1762 253.47)" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" interval={2} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, "Cost"]} contentStyle={{ border: "0.0625rem solid var(--border)", borderRadius: 8, fontSize: 11, background: "var(--popover)" }} />
                <Area dataKey="value" name="Cost" type="monotone" stroke="oklch(0.6311 0.1762 253.47)" strokeWidth={1.7} fill="url(#cloud-cost-fill)" dot={{ r: 1.5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </section>

      <section aria-label="Cloud accounts and services" className="grid gap-2.5 md:grid-cols-[2.15fr_0.95fr]">
        <Panel title="Cloud Accounts" className="min-w-0" action={<span className="text-[0.75rem] text-muted-foreground">Updated {updatedAt}</span>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[51.25rem] text-left text-[0.75rem]">
              <thead><tr className="border-b border-border text-muted-foreground">{["Account Name", "Provider", "Account ID", "Region / Default Region", "Status", "Health", "Monthly Cost", "Resources", "Actions"].map((heading) => <th key={heading} className="whitespace-nowrap px-1 pb-1.5 font-semibold">{heading}</th>)}</tr></thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.name} className="border-b border-border/70 last:border-0">
                    <td className="whitespace-nowrap px-1 py-[0.4375rem] font-semibold text-foreground"><span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${account.status === "Active" ? "bg-emerald-500" : "bg-amber-500"}`} />{account.name}</td>
                    <td className="whitespace-nowrap px-1 py-[0.4375rem] text-foreground"><CloudProviderIcon provider={account.provider} /> <span className="ml-0.5">{account.provider}</span></td>
                    <td className="whitespace-nowrap px-1 py-[0.4375rem] text-foreground">{account.id}</td>
                    <td className="whitespace-nowrap px-1 py-[0.4375rem] text-foreground">{account.region}</td>
                    <td className="px-1 py-[0.4375rem]"><span className={`rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold ${account.status === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"}`}>{account.status}</span></td>
                    <td className="px-1 py-[0.4375rem]"><span className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold ${healthStyles[account.health]}`}><i className={`h-1.5 w-1.5 rounded-full ${account.health === "Healthy" ? "bg-emerald-500" : account.health === "Warning" ? "bg-amber-500" : "bg-rose-500"}`} />{account.health}</span></td>
                    <td className="whitespace-nowrap px-1 py-[0.4375rem] text-foreground">{account.cost}</td>
                    <td className="px-1 py-[0.4375rem] text-foreground">{account.resources}</td>
                    <td className="px-1 py-[0.4375rem]"><button aria-label={`Actions for ${account.name}`} onClick={() => toast(`Actions for ${account.name} are a mockup action.`)} className="rounded-lg px-1 text-muted-foreground hover:bg-accent">⋮</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pt-1 text-[0.75rem] text-muted-foreground">Showing 1-8 of 8 accounts</div>
        </Panel>
        <Panel title="Top Services by Cost" className="min-w-0" action={<button onClick={() => toast("Showing all cloud services.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <div className="overflow-x-auto pt-1">
            <table className="w-full min-w-[17.5rem] text-left text-[0.75rem]">
              <thead><tr className="border-b border-border text-muted-foreground"><th className="pb-1.5">Service</th><th className="pb-1.5">Provider</th><th className="pb-1.5 text-right">Monthly Cost</th></tr></thead>
              <tbody>{services.map((service) => <tr key={service.name} className="border-b border-border/70 last:border-0"><td className="whitespace-nowrap py-[0.4375rem] text-foreground"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: providerColors[service.provider] }} />{service.name}</td><td className="whitespace-nowrap py-[0.4375rem] text-foreground"><CloudProviderIcon provider={service.provider} /> <span className="ml-0.5">{service.provider}</span></td><td className="whitespace-nowrap py-[0.4375rem] text-right text-foreground">{service.cost}</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section aria-label="Cloud account breakdown" className="grid items-stretch gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="Resources by Provider" className="flex h-full min-w-0 flex-col p-4" action={<button onClick={() => toast("Showing provider resource details.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <ProviderResourcesCard />
        </Panel>
        <Panel title="Accounts by Status" className="flex h-full min-w-0 flex-col p-4"><AccountStatusCard /></Panel>
        <Panel title="Top Regions by Resource Count" className="flex h-full min-w-0 flex-col" action={<button onClick={() => toast("Showing all cloud regions.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <div className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 flex-1 space-y-3 overflow-y-auto pt-2">{regions.map((region) => <div key={region.name} className="grid grid-cols-[minmax(0,1fr)_minmax(2.8125rem,0.8fr)_1.875rem] items-center gap-2 text-[0.75rem]"><span className="truncate text-foreground" title={region.name}>{region.name}</span><div className="h-[0.3125rem] rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(4, (region.count / maxRegionCount) * 100)}%`, backgroundColor: providerColors[region.provider] }} /></div><b className="text-right text-foreground">{region.count}</b></div>)}</div></div>
        </Panel>
        <Panel title="Recent Events" className="flex h-full min-w-0 flex-col" action={<button onClick={() => toast("Showing all cloud account events.")} className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap text-[0.75rem] font-semibold text-primary">View All <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>}>
          <div className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 flex-1 space-y-3 overflow-y-auto pt-2">{events.map((event) => <div key={event.text} className="grid grid-cols-[8px_minmax(0,1fr)_4rem] items-center gap-2 text-[0.75rem]"><i className={`h-2 w-2 rounded-full ${event.color}`} /><span className="truncate font-semibold text-foreground" title={event.text}>{event.text}</span><span className="whitespace-nowrap text-right text-muted-foreground">{event.ago}</span></div>)}</div></div>
        </Panel>
      </section>

      {notice && <div role="status" className="fixed bottom-4 right-4 z-[1100] rounded-lg border border-border bg-card px-3 py-2 text-[0.6875rem] text-foreground shadow-lg">{notice}</div>}
    </div>
  );
}