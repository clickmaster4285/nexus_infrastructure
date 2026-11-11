"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Server as ServerIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LocationFlag, ProviderLogo } from "@/components/shared/provider-logo";
import { cn } from "@/lib/utils";
import { serverDetailsPath, type Server } from "@/data/mock/servers";
import {
  AgentCell,
  EnvironmentPill,
  NetworkCell,
  OperatingSystem,
  StatusPill,
  UsageCell,
} from "@/components/servers/server-cells";

interface AllServersTableProps {
  servers: Server[];
  totalFiltered: number;
  page: number;
  pageCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const columns: Array<{ key: string; label: string; widthClass: string }> = [
  { key: "name", label: "Server / Hostname", widthClass: "w-[145px]" },
  { key: "os", label: "Operating System", widthClass: "w-[130px]" },
  { key: "environment", label: "Environment", widthClass: "w-[96px]" },
  { key: "provider", label: "Provider / Location", widthClass: "w-[130px]" },
  { key: "cpu", label: "CPU", widthClass: "w-[72px]" },
  { key: "memory", label: "Memory", widthClass: "w-[72px]" },
  { key: "disk", label: "Disk", widthClass: "w-[72px]" },
  { key: "network", label: "Network", widthClass: "w-[88px]" },
  { key: "uptime", label: "Uptime", widthClass: "w-[70px]" },
  { key: "agent", label: "Agent / Heartbeat", widthClass: "w-[112px]" },
  { key: "health", label: "Health", widthClass: "w-[82px]" },
  { key: "alerts", label: "Alerts", widthClass: "w-[54px]" },
  { key: "actions", label: "Actions", widthClass: "w-[42px]" },
];

export function AllServersTable({
  servers,
  totalFiltered,
  page,
  pageCount,
  pageSize,
  onPageChange,
}: AllServersTableProps) {
  const router = useRouter();
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const start = totalFiltered === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalFiltered);

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, server: Server) => {
    if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      router.push(serverDetailsPath(server));
    }
  };

  return (
    <>
      {/* Scrollable table */}
      <div className="w-full overflow-x-auto [overscroll-behavior-x:contain] [scrollbar-width:thin] [scrollbar-color:#b8c7d9_transparent]">
        <table className="w-full min-w-[1160px] table-fixed border-separate border-spacing-0">
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} className={column.widthClass} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="sticky top-0 z-[1] border-b border-border bg-[#f7f9fc] px-2.5 py-3 text-left text-[11px] font-semibold leading-tight text-[#405b79] dark:bg-[#1b2a3e] dark:text-[#c6d2e1]"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servers.map((server) => {
              const detailsPath = serverDetailsPath(server);
              return (
                <tr
                  key={server.id}
                  tabIndex={0}
                  aria-label={`View details for ${server.name}`}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a, button, input")) return;
                    router.push(detailsPath);
                  }}
                  onKeyDown={(event) => handleRowKeyDown(event, server)}
                  className="cursor-pointer transition-colors hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#5ba4ed] dark:hover:bg-[#1c3047]"
                >
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle">
                    <Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="flex flex-col items-start gap-0.5 text-left">
                      <b className="text-[12px] font-semibold leading-tight text-[#204f82] hover:text-[#2563eb] hover:underline dark:text-[#82b9f1]">{server.name}</b>
                      <small className="text-[10px] leading-tight text-[#637b96] dark:text-[#9babc0]">{server.host}</small>
                      <small className="text-[10px] leading-tight text-[#8292a6] dark:text-[#8a9cb4]">{server.ip}</small>
                    </Link>
                  </td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle">
                    <Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><OperatingSystem os={server.os} readable /></Link>
                  </td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle">
                    <Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><EnvironmentPill environment={server.environment} readable /></Link>
                  </td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle">
                    <Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="flex flex-col gap-1">
                      <b className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-[#526984] dark:text-[#c6d2e1]">
                        <ProviderLogo provider={server.provider} />
                        {server.provider}
                      </b>
                      <small className="flex items-center gap-1.5 whitespace-nowrap text-[10px] text-[#8493a6] dark:text-[#9babc0]">
                        <LocationFlag location={server.location} />
                        {server.location.split(",")[0]}
                      </small>
                    </Link>
                  </td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><UsageCell value={server.cpu} readable /></Link></td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><UsageCell value={server.memory} tone="green" readable /></Link></td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><UsageCell value={server.disk} tone="amber" readable /></Link></td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><NetworkCell server={server} readable /></Link></td>
                  <td className="whitespace-nowrap border-b border-border/60 px-[7px] py-2 align-middle text-[11px] text-[#5b718c] dark:text-[#b7c4d5]"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block">{server.uptime}</Link></td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><AgentCell agent={server.agent} heartbeat={server.heartbeat} readable /></Link></td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><StatusPill status={server.health} readable /></Link></td>
                  <td className={cn("border-b border-border/60 px-[7px] py-2 text-center align-middle text-[11px] font-semibold text-[#617790] dark:text-[#b7c4d5]", server.alerts > 0 && "font-bold text-destructive")}>
                    <Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block">{server.alerts}</Link>
                  </td>
                  <td className="relative border-b border-border/60 px-[7px] py-2 text-center align-middle">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7 text-muted-foreground"
                      aria-label={`Actions for ${server.name}`}
                      aria-expanded={openActionsId === server.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenActionsId((current) => current === server.id ? null : server.id);
                      }}
                    >
                      <MoreVertical size={15} />
                    </Button>
                    {openActionsId === server.id && (
                      <div role="menu" aria-label={`${server.name} actions`} className="absolute right-2 top-9 z-20 min-w-36 rounded-md border border-border bg-popover p-1 text-left shadow-lg">
                        <Link role="menuitem" href={detailsPath} onClick={(event) => { event.stopPropagation(); setOpenActionsId(null); }} className="block rounded px-2 py-1.5 text-[12px] text-popover-foreground hover:bg-accent">View Details</Link>
                        <Link role="menuitem" href={`/logs-explorer?server=${encodeURIComponent(server.name)}`} onClick={(event) => { event.stopPropagation(); setOpenActionsId(null); }} className="block rounded px-2 py-1.5 text-[12px] text-popover-foreground hover:bg-accent">View Logs</Link>
                        <Link role="menuitem" href={`/metrics-explorer?server=${encodeURIComponent(server.name)}`} onClick={(event) => { event.stopPropagation(); setOpenActionsId(null); }} className="block rounded px-2 py-1.5 text-[12px] text-popover-foreground hover:bg-accent">View Metrics</Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {servers.length === 0 && (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <ServerIcon size={20} aria-hidden="true" />
            <b className="text-[13px] font-semibold text-[#435a75] dark:text-[#d1dceb]">No servers match these filters</b>
            <span className="text-[12px]">Change the search or filter selections.</span>
          </div>
        )}
      </div>

      {totalFiltered > pageSize && <div className="flex min-h-[48px] flex-wrap items-center justify-end gap-1 px-3 py-2 text-[11px] text-[#6e8198] dark:text-[#9babc0]">
          <span className="mr-1 hidden items-center gap-1.5 whitespace-nowrap sm:flex">
            Rows per page
            <span className="inline-grid h-[28px] min-w-9 place-items-center rounded border border-input bg-card px-1.5 text-[11px] text-[#536881]">{pageSize}</span>
          </span>
          <span className="mr-1 whitespace-nowrap">{start}-{end} of {totalFiltered}</span>
          <button type="button" aria-label="First page" disabled={page <= 1} onClick={() => onPageChange(1)} className="grid h-[24px] w-[24px] cursor-pointer place-items-center rounded border border-input bg-card text-[#637891] transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40"><ChevronFirst size={13} /></button>
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="grid h-[24px] w-[24px] cursor-pointer place-items-center rounded border border-input bg-card text-[#637891] transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40"><ChevronLeft size={13} /></button>
          <span aria-current="page" className="grid h-[24px] w-[24px] place-items-center rounded border border-primary bg-primary text-[9px] font-bold text-primary-foreground">{page}</span>
          <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="grid h-[24px] w-[24px] cursor-pointer place-items-center rounded border border-input bg-card text-[#637891] transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40"><ChevronRight size={13} /></button>
          <button type="button" aria-label="Last page" disabled={page >= pageCount} onClick={() => onPageChange(pageCount)} className="grid h-[24px] w-[24px] cursor-pointer place-items-center rounded border border-input bg-card text-[#637891] transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40"><ChevronLast size={13} /></button>
      </div>}
    </>
  );
}
