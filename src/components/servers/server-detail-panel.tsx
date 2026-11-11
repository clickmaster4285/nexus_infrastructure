"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  ChevronDown,
  Clock3,
  FileText,
  MoreVertical,
  Pencil,
  Server as ServerIcon,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/servers/server-cells";
import { hrefForLabel } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { Server } from "@/data/mock/servers";

interface ServerDetailPanelProps {
  server: Server | null;
  onClose: () => void;
  onExport: (server: Server) => void;
}

const quickActions = [
  { label: "View Logs", icon: FileText, target: "Logs Explorer" },
  { label: "View Alerts", icon: Bell, target: "Alerts", showAlertCount: true },
  { label: "View Services", icon: Workflow, target: "Processes & Services" },
  { label: "Open Incidents", icon: Activity, target: "Incidents" },
  { label: "Edit Server", icon: Pencil, target: "Server Details" },
] as const;

export function ServerDetailPanel({ server, onClose, onExport }: ServerDetailPanelProps) {
  const router = useRouter();
  const [view, setView] = useState<"details" | "metrics">("details");
  const [message, setMessage] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOptionsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOptionsOpen(false);
        onClose();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!server) return null;

  async function copyServerName() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(server!.name);
      setMessage(`Copied ${server!.name}`);
    } catch {
      setMessage("Clipboard access is unavailable");
    }
    setOptionsOpen(false);
  }

  const optionsMenu = (
    <div className="relative flex items-center" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon-sm"
        className="h-7 w-7 text-muted-foreground"
        aria-label="Server details options"
        aria-haspopup="menu"
        aria-expanded={optionsOpen}
        onClick={() => setOptionsOpen((value) => !value)}
      >
        <MoreVertical size={16} />
      </Button>
      {optionsOpen && (
        <div role="menu" className="absolute right-0 top-[calc(100%+5px)] z-10 min-w-[150px] rounded-md border border-border bg-popover p-1 shadow-lg">
          <button type="button" role="menuitem" onClick={copyServerName} className="block w-full cursor-pointer rounded px-2 py-2 text-left text-xs text-[#405b79] outline-none hover:bg-accent focus-visible:bg-accent dark:text-[#c6d2e1]">
            Copy server name
          </button>
          <button type="button" role="menuitem" onClick={() => { onExport(server); setOptionsOpen(false); }} className="block w-full cursor-pointer rounded px-2 py-2 text-left text-xs text-[#405b79] outline-none hover:bg-accent focus-visible:bg-accent dark:text-[#c6d2e1]">
            Export server
          </button>
          <button type="button" role="menuitem" onClick={() => { onClose(); setOptionsOpen(false); }} className="block w-full cursor-pointer rounded px-2 py-2 text-left text-xs text-[#405b79] outline-none hover:bg-accent focus-visible:bg-accent dark:text-[#c6d2e1]">
            Close panel
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Card className="sticky top-2.5 h-fit max-h-[calc(100vh-3.125rem)] min-w-0 animate-drawer-in overflow-y-auto p-3">
      {/* Header */}
      <div className="flex h-7 items-center justify-between gap-2 border-b border-transparent">
        <h2 className="font-display text-base font-bold text-[#183653] dark:text-[#d1dceb]">Server Details</h2>
        <div className="flex shrink-0 items-center gap-0.5">
          {optionsMenu}
          <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground" onClick={onClose} aria-label="Close server details">
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Identity */}
      <div className="flex items-center gap-2.5 border-b border-border py-3">
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ffede5] text-[#d75135]">
          <ServerIcon size={19} />
        </span>
        <div className="min-w-0">
          <b className="block truncate text-sm font-bold text-[#24496e] dark:text-[#d1dceb]">{server.name}</b>
          <small className="mt-0.5 block truncate text-xs text-muted-foreground">{server.host}</small>
        </div>
      </div>
      <div className="border-b border-border py-2">
        <StatusPill status={server.agent === "Online" ? "Online" : server.agent} readable />
      </div>

      {/* Tabs */}
      <Tabs value={view} onValueChange={(value) => { setView(value as "details" | "metrics"); setMessage(""); }}>
        <TabsList aria-label="Server information" className="gap-4">
          <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
          <TabsTrigger value="metrics" className="text-xs">Metrics</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "details" ? (
        <>
          {/* Facts */}
          <dl className="my-3 flex flex-col gap-3">
            {[
              ["OS", server.os],
              ["Environment", server.environment],
              ["Provider", server.provider],
              ["Location", server.location],
              ["Uptime", server.uptime],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[82px_minmax(0,1fr)] gap-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="m-0 text-xs leading-relaxed text-[#435a74] dark:text-[#c6d2e1]">{value}</dd>
              </div>
            ))}
            <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-2">
              <dt className="text-xs text-muted-foreground">Agent</dt>
              <dd className="m-0 text-xs leading-relaxed text-[#435a74] dark:text-[#c6d2e1]">
                {server.agent} <small className="text-[11px] text-muted-foreground">({server.heartbeat})</small>
              </dd>
            </div>
            <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-2">
              <dt className="text-xs text-muted-foreground">IP Addresses</dt>
              <dd className="m-0 text-xs leading-relaxed text-[#435a74] dark:text-[#c6d2e1] [overflow-wrap:anywhere]">
                {server.ip} (private)
                <br />
                {server.publicIp} (public)
              </dd>
            </div>
          </dl>

          {/* Health row */}
          <div className="flex items-center justify-between border-y border-border py-2">
            <span className="flex items-center gap-2.5">
              <b className="text-xs text-[#60738c] dark:text-[#a9bcd2]">Health Status</b>
              <StatusPill status={server.health} readable />
            </span>
            <button
              type="button"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((value) => !value)}
              className="flex cursor-pointer items-center gap-1 text-xs text-[#71839a] transition-colors hover:text-foreground"
            >
              History
              <ChevronDown size={12} aria-hidden="true" className={cn("transition-transform duration-200", historyOpen && "rotate-180")} />
            </button>
          </div>
          {historyOpen && (
            <div className="grid gap-1.5 border-b border-border py-2 text-xs text-[#607791] dark:text-[#a9bcd2]">
              <span>Current status: <b className="text-[#345574] dark:text-[#d1dceb]">{server.health}</b></span>
              <span>Last heartbeat: {server.heartbeat}</span>
              <span>Uptime: {server.uptime}</span>
            </div>
          )}

          {/* Tags */}
          <div className="py-3">
            <b className="text-xs text-[#60738c] dark:text-[#a9bcd2]">Tags</b>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {server.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="rounded-full bg-[#edf4fb] px-2 py-1 text-[11px] text-[#536f8e] dark:bg-[#20344b] dark:text-[#b7cbe0]">
                  {tag}
                </span>
              ))}
              {server.tags.length > 2 && (
                <span className="rounded-full bg-[#edf4fb] px-2 py-1 text-[11px] text-[#536f8e] dark:bg-[#20344b] dark:text-[#b7cbe0]">
                  +{server.tags.length - 2}
                </span>
              )}
            </div>
          </div>

          {/* Primary actions */}
          <div className="flex flex-col gap-2">
            <Button className="h-9 text-xs">View Details</Button>
            <Button variant="outline" className="h-9 text-xs text-[#526b87] dark:text-[#c6d2e1]" onClick={() => setView("metrics")}>
              View Metrics
            </Button>
          </div>

          {/* Quick actions */}
          <div className="mt-4 border-t border-border pt-3">
            <h3 className="mb-2 font-display text-xs font-bold text-[#536780] dark:text-[#a9bcd2]">Quick Actions</h3>
            <div className="flex flex-col">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => router.push(hrefForLabel(action.target))}
                  className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 text-left text-xs text-[#627791] transition-colors hover:bg-[#f2f7fc] hover:text-[#2878bd] dark:text-[#a9bcd2] dark:hover:bg-[#1c3047]"
                >
                  <action.icon size={15} aria-hidden="true" className="shrink-0" />
                  {action.label}
                  {"showAlertCount" in action && action.showAlertCount && <span className="text-[#8594a7]">({server.alerts})</span>}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setOptionsOpen((value) => !value)}
                className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 text-left text-xs text-[#627791] transition-colors hover:bg-[#f2f7fc] hover:text-[#2878bd] dark:text-[#a9bcd2] dark:hover:bg-[#1c3047]"
              >
                <MoreVertical size={15} aria-hidden="true" className="shrink-0" />
                More Actions
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4 py-4">
          <DetailMetric label="CPU Usage" value={`${server.cpu}%`} percent={server.cpu} barClassName="bg-[#388cf0]" />
          <DetailMetric label="Memory Usage" value={`${server.memory}%`} percent={server.memory} barClassName="bg-[#9856e6]" />
          <DetailMetric label="Disk Usage" value={`${server.disk}%`} percent={server.disk} barClassName="bg-[#f2a339]" />
          <div className="text-xs text-[#496684] dark:text-[#a9bcd2]">
            <div className="flex items-center justify-between gap-2">
              <span>Network</span>
              <b className="text-[#24496e] dark:text-[#d1dceb]">{server.network}</b>
            </div>
            <small className="mt-1 block text-[11px] text-muted-foreground">Latest throughput</small>
          </div>
          <div className="text-xs text-[#496684] dark:text-[#a9bcd2]">
            <div className="flex items-center justify-between gap-2">
              <span>Uptime</span>
              <b className="text-[#24496e] dark:text-[#d1dceb]">{server.uptime}</b>
            </div>
            <small className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock3 size={11} aria-hidden="true" /> Last heartbeat {server.heartbeat}
            </small>
          </div>
          <div className="flex items-center gap-2 rounded bg-[#eaf8f0] p-2.5 text-xs text-[#269d6b] dark:bg-[#123a2a] dark:text-[#4fd69a]">
            <ShieldCheck size={14} aria-hidden="true" />
            {server.health} health status
          </div>
        </div>
      )}

      {message && (
        <div role="status" className="mt-2 rounded bg-[#edf5ff] p-2 text-xs text-[#3c78b5] dark:bg-[#17385c] dark:text-[#9bc9f4] [overflow-wrap:anywhere]">
          {message}
        </div>
      )}
    </Card>
  );
}

function DetailMetric({ label, value, percent, barClassName }: { label: string; value: string; percent: number; barClassName: string }) {
  return (
    <div className="text-xs text-[#496684] dark:text-[#a9bcd2]">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <b className="text-[#24496e] dark:text-[#d1dceb]">{value}</b>
      </div>
      <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn("h-full rounded-full", barClassName)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
