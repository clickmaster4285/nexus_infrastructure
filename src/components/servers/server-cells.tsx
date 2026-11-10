import { siDebian } from "simple-icons";

import { cn } from "@/lib/utils";
import { serverNetworkTrends, type Server } from "@/data/mock/servers";

const statusToneStyles: Record<string, string> = {
  green: "bg-[#e6f7ed] text-[#22a16a]",
  amber: "bg-[#fff3de] text-[#d68c1e]",
  red: "bg-[#ffebed] text-[#dd3f4b]",
  blue: "bg-[#eaf3ff] text-[#347fce]",
};

function statusTone(status: string): keyof typeof statusToneStyles {
  if (status === "Healthy" || status === "Online") return "green";
  if (status === "Degraded") return "amber";
  if (status === "Offline") return "red";
  return "blue";
}

export function StatusPill({ status, readable = false }: { status: string; readable?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-1 font-semibold", readable ? "text-[10px]" : "text-[8px]", statusToneStyles[statusTone(status)])}>
      <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-current" />
      {status}
    </span>
  );
}

const usageBarStyles = {
  blue: "bg-[#368df0]",
  green: "bg-[#39bd82]",
  amber: "bg-[#f3a43c]",
} as const;

export function UsageCell({ value, tone = "blue", readable = false }: { value: number; tone?: keyof typeof usageBarStyles; readable?: boolean }) {
  return (
    <div className={cn("flex min-w-[52px] flex-col gap-1", readable ? "w-14" : "w-12")}>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-[#eaf0f6] dark:bg-[#26364b]" aria-hidden="true">
        <span className={cn("block h-full rounded-full", usageBarStyles[tone])} style={{ width: `${value}%` }} />
      </span>
      <small className={cn("text-right leading-none text-[#637790] dark:text-[#9babc0]", readable ? "text-[10px]" : "text-[8px]")}>{value}%</small>
    </div>
  );
}

export function NetworkCell({ server, readable = false }: { server: Server; readable?: boolean }) {
  const values = serverNetworkTrends[server.id] ?? serverNetworkTrends["srv-01"];
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 38},${13 - value}`).join(" ");
  return (
    <span className="flex flex-col items-start gap-0.5">
      <svg viewBox="0 0 38 14" className="block h-[14px] w-[38px] overflow-visible" role="img" aria-label={`${server.name} network trend`}>
        <polyline points={points} fill="none" stroke="#398de2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <small className={cn("leading-none text-[#60758f] dark:text-[#9babc0]", readable ? "text-[10px]" : "text-[8px]")}>{server.network}</small>
    </span>
  );
}

export function EnvironmentPill({ environment, readable = false }: { environment: string; readable?: boolean }) {
  const tone = environment.toLowerCase();
  const styles =
    tone === "production"
      ? "bg-[#e4f7ed] text-[#23a36b]"
      : tone === "staging"
        ? "bg-[#e8f2ff] text-[#3780cf]"
        : tone === "development" || tone === "testing"
          ? "bg-[#f1e9ff] text-[#8c55cf]"
          : "bg-[#f0f1f3] text-[#64748b] dark:bg-[#26364b] dark:text-[#b7c4d5]";
  return <span className={cn("inline-block whitespace-nowrap rounded-full px-2 py-1 font-medium", readable ? "text-[10px]" : "text-[8px]", styles)}>{environment}</span>;
}

type OsType = "windows" | "debian" | "ubuntu";

export function OperatingSystem({ os, readable = false }: { os: string; readable?: boolean }) {
  const type: OsType = os.startsWith("Windows") ? "windows" : os.startsWith("Debian") ? "debian" : "ubuntu";
  return (
    <span className={cn("flex max-w-[125px] items-center gap-1.5 leading-snug text-[#4c637e] dark:text-[#b7c4d5]", readable ? "text-[11px]" : "text-[9px]")}>
      <OperatingSystemLogo type={type} />
      <span>{os}</span>
    </span>
  );
}

function OperatingSystemLogo({ type }: { type: OsType }) {
  if (type === "windows") {
    return (
      <svg className="h-[19px] w-[19px] shrink-0 text-[#1686d9]" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 5.1 10.6 3.9v7.8H2V5.1Zm10.1-1.4L22 2v9.7h-9.9V3.7ZM2 12.9h8.6v7.8L2 19.5v-6.6Zm10.1 0H22v9.7l-9.9-1.7v-8Z" fill="currentColor" />
      </svg>
    );
  }
  if (type === "debian") {
    return (
      <svg className="h-[19px] w-[19px] shrink-0 text-[#a81d33]" viewBox="0 0 24 24" aria-hidden="true">
        <path d={siDebian.path} fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className="h-[19px] w-[19px] shrink-0 text-[#e95420]" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <circle cx="12" cy="12" r="5.2" fill="none" stroke="#fff" strokeWidth="1.7" />
      <path d="M12 6.8v2.2m4.5 2.6-1.9 1.1m-8.1-1.1 1.9 1.1" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="4.4" r="1.6" fill="#fff" />
      <circle cx="18.6" cy="15.8" r="1.6" fill="#fff" />
      <circle cx="5.4" cy="15.8" r="1.6" fill="#fff" />
    </svg>
  );
}

const agentTone: Record<string, string> = {
  online: "text-[#22a76c]",
  offline: "text-[#e24854]",
  pending: "text-[#3483d4]",
};

const agentDot: Record<string, string> = {
  online: "bg-[#22b778]",
  offline: "bg-[#e24854]",
  pending: "bg-[#3483d4]",
};

export function AgentCell({ agent, heartbeat, readable = false }: { agent: string; heartbeat: string; readable?: boolean }) {
  const key = agent.toLowerCase();
  return (
    <div className={cn("grid grid-cols-[7px_auto] items-center gap-x-1.5 gap-y-0.5", readable ? "text-[11px]" : "text-[9px]", agentTone[key] ?? agentTone.pending)}>
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", agentDot[key] ?? agentDot.pending)} />
      <span>{agent}</span>
      <small className={cn("col-start-2 whitespace-nowrap text-muted-foreground", readable ? "text-[9px]" : "text-[7px]")}>{heartbeat}</small>
    </div>
  );
}
