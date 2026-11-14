"use client";

import { useMemo, useState } from "react";

import { PageHeading } from "@/components/layout/page-heading";
import { PageMeta } from "@/components/layout/page-meta";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/shared/metric-card";
import { AddServerDialog } from "@/components/servers/add-server-dialog";
import { AllServersTable } from "@/components/servers/all-servers-table";
import { ServerToolbar, defaultServerFilters, type ServerFilters } from "@/components/servers/server-toolbar";
import {
  serverGroupName,
  serverStats,
  servers as initialServers,
  type Server,
} from "@/data/mock/servers";

const PAGE_SIZE = 20;

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

const csvHeaders = ["Server", "Hostname", "OS", "Environment", "Provider", "Location", "CPU", "Memory", "Disk", "Network", "Uptime", "Agent", "Health", "Alerts"];

const serverToCsvRow = (server: Server) => [
  server.name,
  server.host,
  server.os,
  server.environment,
  server.provider,
  server.location,
  `${server.cpu}%`,
  `${server.memory}%`,
  `${server.disk}%`,
  server.network,
  server.uptime,
  server.agent,
  server.health,
  String(server.alerts),
];

export function AllServersDashboard() {
  const [servers, setServers] = useState<Server[]>(initialServers);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ServerFilters>(defaultServerFilters);
  const [page, setPage] = useState(1);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const filteredServers = useMemo(
    () =>
      servers.filter((server) => {
        const term = search.trim().toLowerCase();
        const matchesSearch =
          !term || [server.name, server.host, server.ip, server.publicIp].some((value) => value?.toLowerCase().includes(term));
        const matchesStatus =
          filters.status === "All" ||
          (filters.status === "Online"
            ? server.agent === "Online"
            : filters.status === "Offline"
              ? server.health === "Offline"
              : server.health === filters.status);
        const matchesOs = filters.os === "All" || server.os === filters.os;
        const matchesEnvironment = filters.environment === "All" || server.environment === filters.environment;
        const matchesProvider = filters.provider === "All" || server.provider === filters.provider;
        const group = serverGroupName(server);
        const matchesGroup = filters.group === "All" || group === filters.group;
        const matchesAgent = filters.agent === "All" || server.agent === filters.agent;
        return matchesSearch && matchesStatus && matchesOs && matchesEnvironment && matchesProvider && matchesGroup && matchesAgent;
      }),
    [servers, search, filters],
  );

  const pageCount = Math.max(1, Math.ceil(filteredServers.length / PAGE_SIZE));
  const visibleServers = filteredServers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onlineCount = servers.filter((server) => server.agent === "Online").length;
  const offlineCount = servers.filter((server) => server.health === "Offline").length;
  const degradedCount = servers.filter((server) => server.health === "Degraded").length;
  const pendingCount = servers.filter((server) => server.agent === "Pending").length;
  const healthyPercent = servers.length ? Math.round((onlineCount / servers.length) * 100) : 0;
  const pendingPercent = servers.length ? Math.round((pendingCount / servers.length) * 100) : 0;

  const metricCards = serverStats.map((item) => ({
    ...item,
    ...(item.label === "Total Servers" ? { value: String(servers.length) } : {}),
    ...(item.label === "Online Servers" ? { value: String(onlineCount), change: `${healthyPercent}% of total` } : {}),
    ...(item.label === "Offline Servers" ? { value: String(offlineCount), change: `${servers.length ? Math.round((offlineCount / servers.length) * 100) : 0}% of total` } : {}),
    ...(item.label === "Degraded Servers" ? { value: String(degradedCount), change: `${servers.length ? Math.round((degradedCount / servers.length) * 100) : 0}% of total` } : {}),
    ...(item.label === "Agent Healthy" ? { value: `${onlineCount} / ${servers.length}`, change: `${healthyPercent}% healthy` } : {}),
    ...(item.label === "Pending Enrollment" ? { value: String(pendingCount), change: `${pendingPercent}% pending` } : {}),
  }));

  function updateFilter(key: keyof ServerFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function exportCsv() {
    downloadCsv("nexus-servers.csv", [csvHeaders, ...filteredServers.map(serverToCsvRow)]);
  }

  function addServer(name: string, environment: string) {
    const template = initialServers[0];
    const created: Server = {
      ...template,
      id: `srv-${Date.now()}`,
      name,
      host: `${name}.example.com`,
      ip: "10.10.9.10",
      publicIp: "Pending",
      environment,
      provider: "AWS",
      location: "Frankfurt, Germany",
      uptime: "—",
      agent: "Pending",
      heartbeat: "Not enrolled",
      cpu: 0,
      memory: 0,
      disk: 0,
      network: "—",
      health: "Pending",
      alerts: 0,
      tags: [environment.toLowerCase(), "new"],
    };
    setServers((current) => [created, ...current]);
    setSearch("");
    setFilters(defaultServerFilters);
    setPage(1);
    setAddDialogOpen(false);
  }

  return (
    <>
      <div className="min-w-0">
          <PageMeta breadcrumbs={["Infrastructure", "All Servers"]} />
          <PageHeading title="All Servers" description="Monitor and manage your infrastructure fleet" />

          <section aria-label="Fleet summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 xl:grid-cols-6">
            {metricCards.map((item) => (
              <MetricCard key={item.label} item={item} className="h-[5.375rem]" labelClassName="text-[0.6875rem]" trendClassName="text-[0.625rem]" />
            ))}
          </section>

          <Card className="mt-2.5 overflow-hidden">
            <ServerToolbar
              search={search}
              filters={filters}
              onSearchChange={updateSearch}
              onFilterChange={updateFilter}
              onAddServer={() => setAddDialogOpen(true)}
              onExport={exportCsv}
            />
            <AllServersTable
              servers={visibleServers}
              totalFiltered={filteredServers.length}
              page={page}
              pageCount={pageCount}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </Card>
      </div>

      <AddServerDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdd={addServer} />
    </>
  );
}
