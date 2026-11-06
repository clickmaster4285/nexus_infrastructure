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
import type { Server } from "@/data/mock/servers";
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
  selectedRows: string[];
  activeServerId: string | null;
  page: number;
  pageCount: number;
  pageSize: number;
  onToggleRow: (id: string) => void;
  onToggleAllOnPage: () => void;
  onOpenDetails: (id: string) => void;
  onPageChange: (page: number) => void;
}

const columns: Array<{ key: string; label: string; widthClass: string }> = [
  { key: "select", label: "", widthClass: "w-[28px]" },
  { key: "name", label: "Server / Hostname", widthClass: "w-[125px]" },
  { key: "os", label: "Operating System", widthClass: "w-[110px]" },
  { key: "environment", label: "Environment", widthClass: "w-[84px]" },
  { key: "provider", label: "Provider / Location", widthClass: "w-[110px]" },
  { key: "cpu", label: "CPU", widthClass: "w-[62px]" },
  { key: "memory", label: "Memory", widthClass: "w-[62px]" },
  { key: "disk", label: "Disk", widthClass: "w-[62px]" },
  { key: "network", label: "Network", widthClass: "w-[76px]" },
  { key: "uptime", label: "Uptime", widthClass: "w-[58px]" },
  { key: "agent", label: "Agent / Heartbeat", widthClass: "w-[95px]" },
  { key: "health", label: "Health", widthClass: "w-[72px]" },
  { key: "alerts", label: "Alerts", widthClass: "w-[46px]" },
  { key: "actions", label: "Actions", widthClass: "w-[38px]" },
];

export function AllServersTable({
  servers,
  totalFiltered,
  selectedRows,
  activeServerId,
  page,
  pageCount,
  pageSize,
  onToggleRow,
  onToggleAllOnPage,
  onOpenDetails,
  onPageChange,
}: AllServersTableProps) {
  const selectedOnPage = servers.length > 0 && servers.every((server) => selectedRows.includes(server.id));
  const start = totalFiltered === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalFiltered);

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenDetails(id);
    }
  };

  return (
    <>
      {/* Scrollable table */}
      <div className="w-full overflow-x-auto [overscroll-behavior-x:contain] [scrollbar-width:thin] [scrollbar-color:#b8c7d9_transparent]">
        <table className="w-full min-w-[1000px] table-fixed border-separate border-spacing-0">
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} className={column.widthClass} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="sticky top-0 z-[1] border-b border-border bg-[#f7f9fc] px-[7px] py-[9px] text-center dark:bg-[#1b2a3e]">
                <input
                  type="checkbox"
                  aria-label="Select all visible servers"
                  checked={selectedOnPage}
                  onChange={onToggleAllOnPage}
                  className="h-[14px] w-[14px] cursor-pointer align-middle accent-[#287cf0]"
                />
              </th>
              {columns.slice(1).map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="sticky top-0 z-[1] border-b border-border bg-[#f7f9fc] px-[7px] py-[9px] text-left text-[9px] font-bold leading-tight text-[#405b79] dark:bg-[#1b2a3e] dark:text-[#c6d2e1]"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servers.map((server) => {
              const isActive = activeServerId === server.id;
              return (
                <tr
                  key={server.id}
                  tabIndex={0}
                  aria-selected={isActive}
                  onClick={() => onOpenDetails(server.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, server.id)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-[#f8fbff] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#5ba4ed] dark:hover:bg-[#1c3047]",
                    isActive && "bg-[#f0f7ff] dark:bg-[#1c3047]",
                  )}
                >
                  <td className="border-b border-border/60 px-[7px] py-2 text-center align-middle" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${server.name}`}
                      checked={selectedRows.includes(server.id)}
                      onChange={() => onToggleRow(server.id)}
                      className="h-[14px] w-[14px] cursor-pointer align-middle accent-[#287cf0]"
                    />
                  </td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenDetails(server.id);
                      }}
                      className="flex cursor-pointer flex-col items-start gap-0.5 text-left"
                    >
                      <b className="text-[11px] font-bold leading-tight text-[#204f82] dark:text-[#82b9f1]">{server.name}</b>
                      <small className="text-[8px] leading-tight text-[#637b96] dark:text-[#9babc0]">{server.host}</small>
                      <small className="text-[8px] leading-tight text-[#8292a6] dark:text-[#8a9cb4]">{server.ip}</small>
                    </button>
                  </td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle">
                    <OperatingSystem os={server.os} />
                  </td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle">
                    <EnvironmentPill environment={server.environment} />
                  </td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle">
                    <div className="flex flex-col gap-1">
                      <b className="flex items-center gap-1.5 whitespace-nowrap text-[10px] font-medium text-[#526984] dark:text-[#c6d2e1]">
                        <ProviderLogo provider={server.provider} />
                        {server.provider}
                      </b>
                      <small className="flex items-center gap-1.5 whitespace-nowrap text-[8px] text-[#8493a6] dark:text-[#9babc0]">
                        <LocationFlag location={server.location} />
                        {server.location.split(",")[0]}
                      </small>
                    </div>
                  </td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle"><UsageCell value={server.cpu} /></td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle"><UsageCell value={server.memory} tone="green" /></td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle"><UsageCell value={server.disk} tone="amber" /></td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle"><NetworkCell server={server} /></td>
                  <td className="whitespace-nowrap border-b border-border/60 px-[7px] py-2 align-middle text-[9px] text-[#5b718c] dark:text-[#b7c4d5]">{server.uptime}</td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle"><AgentCell agent={server.agent} heartbeat={server.heartbeat} /></td>
                  <td className="border-b border-border/60 px-[7px] py-2 align-middle"><StatusPill status={server.health} /></td>
                  <td className={cn("border-b border-border/60 px-[7px] py-2 text-center align-middle text-[10px] font-semibold text-[#617790] dark:text-[#b7c4d5]", server.alerts > 0 && "font-bold text-destructive")}>
                    {server.alerts}
                  </td>
                  <td className="border-b border-border/60 px-[7px] py-2 text-center align-middle" onClick={(event) => event.stopPropagation()}>
                    <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" aria-label={`Actions for ${server.name}`}>
                      <MoreVertical size={15} />
                    </Button>
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
            <b className="text-[11px] font-semibold text-[#435a75] dark:text-[#d1dceb]">No servers match these filters</b>
            <span className="text-[9px]">Change the search or filter selections.</span>
          </div>
        )}
      </div>

      {/* Footer: selection + pagination */}
      <div className="flex min-h-[42px] flex-wrap items-center gap-2 px-2.5 py-1.5 text-[9px] text-[#6e8198] dark:text-[#9babc0]">
        <span>{selectedRows.length} of {totalFiltered} selected</span>
        <select
          aria-label="Bulk actions"
          disabled={selectedRows.length === 0}
          defaultValue=""
          className="h-[25px] cursor-pointer rounded border border-input bg-card px-1.5 text-[9px] text-[#536881] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Bulk Actions</option>
          <option>Export selected</option>
          <option>Clear selection</option>
        </select>

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 hidden items-center gap-1.5 whitespace-nowrap sm:flex">
            Rows per page
            <select defaultValue={pageSize} aria-label="Rows per page" disabled className="h-[22px] rounded border border-input bg-card px-1 text-[9px] text-[#536881]">
              <option value={pageSize}>{pageSize}</option>
            </select>
          </span>
          <span className="mr-1 whitespace-nowrap">
            {start}-{end} of {totalFiltered}
          </span>
          <button type="button" aria-label="First page" disabled={page <= 1} onClick={() => onPageChange(1)} className="grid h-[24px] w-[24px] cursor-pointer place-items-center rounded border border-input bg-card text-[#637891] transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40">
            <ChevronFirst size={13} />
          </button>
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="grid h-[24px] w-[24px] cursor-pointer place-items-center rounded border border-input bg-card text-[#637891] transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40">
            <ChevronLeft size={13} />
          </button>
          <span aria-current="page" className="grid h-[24px] w-[24px] place-items-center rounded border border-primary bg-primary text-[9px] font-bold text-primary-foreground">
            {page}
          </span>
          <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="grid h-[24px] w-[24px] cursor-pointer place-items-center rounded border border-input bg-card text-[#637891] transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40">
            <ChevronRight size={13} />
          </button>
          <button type="button" aria-label="Last page" disabled={page >= pageCount} onClick={() => onPageChange(pageCount)} className="grid h-[24px] w-[24px] cursor-pointer place-items-center rounded border border-input bg-card text-[#637891] transition-colors hover:bg-accent disabled:cursor-default disabled:opacity-40">
            <ChevronLast size={13} />
          </button>
        </div>
      </div>
    </>
  );
}
