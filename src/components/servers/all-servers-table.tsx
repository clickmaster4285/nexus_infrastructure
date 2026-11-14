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
import { isServerInMaintenance } from "@/mocks/maintenanceWindows";
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
  { key: "name", label: "Server / Hostname", widthClass: "w-[9.0625rem]" },
  { key: "os", label: "Operating System", widthClass: "w-[8.125rem]" },
  { key: "environment", label: "Environment", widthClass: "w-[6rem]" },
  { key: "provider", label: "Provider / Location", widthClass: "w-[8.125rem]" },
  { key: "cpu", label: "CPU", widthClass: "w-[4.5rem]" },
  { key: "memory", label: "Memory", widthClass: "w-[4.5rem]" },
  { key: "disk", label: "Disk", widthClass: "w-[4.5rem]" },
  { key: "network", label: "Network", widthClass: "w-[5.5rem]" },
  { key: "uptime", label: "Uptime", widthClass: "w-[4.375rem]" },
  { key: "agent", label: "Agent / Heartbeat", widthClass: "w-[7rem]" },
  { key: "health", label: "Health", widthClass: "w-[5.125rem]" },
  { key: "alerts", label: "Alerts", widthClass: "w-[3.375rem]" },
  { key: "actions", label: "Actions", widthClass: "w-[2.625rem]" },
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
      <div className="w-full overflow-x-auto [overscroll-behavior-x:contain] [scrollbar-width:thin] [scrollbar-color:oklch(0.8239_0.0302_252.98)_transparent]">
        <table className="w-full min-w-[72.5rem] table-fixed border-separate border-spacing-0">
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
                  className="sticky top-0 z-[1] border-b border-border bg-[oklch(0.9814_0.0045_258.32)] px-2.5 py-3 text-left text-[0.6875rem] font-semibold leading-tight text-[oklch(0.4626_0.0589_251.71)] dark:bg-[oklch(0.2817_0.0424_255.89)] dark:text-[oklch(0.8592_0.0246_253.97)]"
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
                  className="cursor-pointer transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[oklch(0.7027_0.1304_250.18)] dark:hover:bg-[oklch(0.3039_0.0493_252.82)]"
                >
                  <td className="border-b border-border/60 px-[0.4375rem] py-2 align-middle">
                    <Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="flex flex-col items-start gap-0.5 text-left">
                      <b className="text-[0.75rem] font-semibold leading-tight text-[oklch(0.4222_0.0993_252.83)] hover:text-blue-600 hover:underline dark:text-[oklch(0.769_0.0993_249.66)]">{server.name}</b>
                      <small className="text-[0.625rem] leading-tight text-[oklch(0.5742_0.0504_251.68)] dark:text-muted-foreground">{server.host}</small>
                      <small className="text-[0.625rem] leading-tight text-[oklch(0.6541_0.0351_254.08)] dark:text-[oklch(0.6869_0.041_255.66)]">{server.ip}</small>
                    </Link>
                  </td>
                  <td className="border-b border-border/60 px-[0.4375rem] py-2 align-middle">
                    <Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><OperatingSystem os={server.os} readable /></Link>
                  </td>
                  <td className="border-b border-border/60 px-[0.4375rem] py-2 align-middle">
                    <Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><EnvironmentPill environment={server.environment} readable /></Link>
                  </td>
                  <td className="border-b border-border/60 px-[0.4375rem] py-2 align-middle">
                    <Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="flex flex-col gap-1">
                      <b className="flex items-center gap-1.5 whitespace-nowrap text-[0.6875rem] font-medium text-[oklch(0.5131_0.0511_252.79)] dark:text-[oklch(0.8592_0.0246_253.97)]">
                        <ProviderLogo provider={server.provider} />
                        {server.provider}
                      </b>
                      <small className="flex items-center gap-1.5 whitespace-nowrap text-[0.625rem] text-[oklch(0.6577_0.0332_254.39)] dark:text-muted-foreground">
                        <LocationFlag location={server.location} />
                        {server.location.split(",")[0]}
                      </small>
                    </Link>
                  </td>
                  <td className="border-b border-border/60 px-[0.4375rem] py-2 align-middle"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><UsageCell value={server.cpu} readable /></Link></td>
                  <td className="border-b border-border/60 px-[0.4375rem] py-2 align-middle"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><UsageCell value={server.memory} tone="green" readable /></Link></td>
                  <td className="border-b border-border/60 px-[0.4375rem] py-2 align-middle"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><UsageCell value={server.disk} tone="amber" readable /></Link></td>
                  <td className="border-b border-border/60 px-[0.4375rem] py-2 align-middle"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><NetworkCell server={server} readable /></Link></td>
                  <td className="whitespace-nowrap border-b border-border/60 px-[0.4375rem] py-2 align-middle text-[0.6875rem] text-[oklch(0.5414_0.0499_253.81)] dark:text-[oklch(0.8156_0.0279_255.11)]"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block">{server.uptime}</Link></td>
                  <td className="border-b border-border/60 px-[0.4375rem] py-2 align-middle"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block"><AgentCell agent={server.agent} heartbeat={server.heartbeat} readable /></Link></td>
                  <td className="border-b border-border/60 px-[0.4375rem] py-2 align-middle"><Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block">{isServerInMaintenance(server.name) ? <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-violet-100 px-1.5 py-1 text-[0.5rem] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><span aria-hidden="true" className="h-[0.3125rem] w-[0.3125rem] rounded-full bg-current" />In Maintenance</span> : <StatusPill status={server.health} readable />}</Link></td>
                  <td className={cn("border-b border-border/60 px-[0.4375rem] py-2 text-center align-middle text-[0.6875rem] font-semibold text-[oklch(0.5611_0.0468_251.9)] dark:text-[oklch(0.8156_0.0279_255.11)]", server.alerts > 0 && "font-bold text-destructive")}>
                    <Link href={detailsPath} onClick={(event) => event.stopPropagation()} className="block">{server.alerts}</Link>
                  </td>
                  <td className="relative border-b border-border/60 px-[0.4375rem] py-2 text-center align-middle">
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
                        <Link role="menuitem" href={detailsPath} onClick={(event) => { event.stopPropagation(); setOpenActionsId(null); }} className="block rounded px-2 py-1.5 text-[0.75rem] text-popover-foreground hover:bg-accent">View Details</Link>
                        <Link role="menuitem" href={`/logs-explorer?server=${encodeURIComponent(server.name)}`} onClick={(event) => { event.stopPropagation(); setOpenActionsId(null); }} className="block rounded px-2 py-1.5 text-[0.75rem] text-popover-foreground hover:bg-accent">View Logs</Link>
                        <Link role="menuitem" href={`/metrics-explorer?server=${encodeURIComponent(server.name)}`} onClick={(event) => { event.stopPropagation(); setOpenActionsId(null); }} className="block rounded px-2 py-1.5 text-[0.75rem] text-popover-foreground hover:bg-accent">View Metrics</Link>
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
          <div className="flex min-h-[11.25rem] flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <ServerIcon size={20} aria-hidden="true" />
            <b className="text-[0.8125rem] font-semibold text-[oklch(0.4602_0.0524_252.89)] dark:text-[oklch(0.8907_0.0238_256.11)]">No servers match these filters</b>
            <span className="text-[0.75rem]">Change the search or filter selections.</span>
          </div>
        )}
      </div>

      {totalFiltered > pageSize && <div className="flex min-h-[3rem] flex-wrap items-center justify-end gap-1 px-3 py-2 text-[0.6875rem] text-[oklch(0.5964_0.0417_253.37)] dark:text-muted-foreground">
          <span className="mr-1 hidden items-center gap-1.5 whitespace-nowrap sm:flex">
            Rows per page
            <span className="inline-grid h-[1.75rem] min-w-9 place-items-center rounded border border-input bg-card px-1.5 text-[0.6875rem] text-[oklch(0.5101_0.0473_253.09)]">{pageSize}</span>
          </span>
          <span className="mr-1 whitespace-nowrap">{start}-{end} of {totalFiltered}</span>
          <button type="button" aria-label="First page" disabled={page <= 1} onClick={() => onPageChange(1)} className="grid h-[1.5rem] w-[1.5rem] cursor-pointer place-items-center rounded border border-input bg-card text-[oklch(0.5653_0.0461_253.02)] transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40"><ChevronFirst size={13} /></button>
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="grid h-[1.5rem] w-[1.5rem] cursor-pointer place-items-center rounded border border-input bg-card text-[oklch(0.5653_0.0461_253.02)] transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40"><ChevronLeft size={13} /></button>
          <span aria-current="page" className="grid h-[1.5rem] w-[1.5rem] place-items-center rounded border border-primary bg-primary text-[0.5625rem] font-bold text-primary-foreground">{page}</span>
          <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="grid h-[1.5rem] w-[1.5rem] cursor-pointer place-items-center rounded border border-input bg-card text-[oklch(0.5653_0.0461_253.02)] transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40"><ChevronRight size={13} /></button>
          <button type="button" aria-label="Last page" disabled={page >= pageCount} onClick={() => onPageChange(pageCount)} className="grid h-[1.5rem] w-[1.5rem] cursor-pointer place-items-center rounded border border-input bg-card text-[oklch(0.5653_0.0461_253.02)] transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40"><ChevronLast size={13} /></button>
      </div>}
    </>
  );
}

