import { siDebian } from "simple-icons";

import { cn } from "@/lib/utils";
import { serverNetworkTrends, type Server } from "@/data/mock/servers";

const statusToneStyles: Record<string, string> = {
  green: "bg-[oklch(0.9608_0.0222_160.23)] text-[oklch(0.6293_0.1353_158.85)]",
  amber: "bg-[oklch(0.968_0.0305_81.76)] text-[oklch(0.6995_0.1434_70.01)]",
  red: "bg-[oklch(0.9566_0.0219_10.6)] text-[oklch(0.6031_0.194_21.23)]",
  blue: "bg-[oklch(0.9609_0.0188_255.53)] text-[oklch(0.5887_0.1419_252.46)]",
};

function statusTone(status: string): keyof typeof statusToneStyles {
  if (status === "Healthy" || status === "Online") return "green";
  if (status === "Degraded") return "amber";
  if (status === "Offline") return "red";
  return "blue";
}

export function StatusPill({ status, readable = false }: { status: string; readable?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-1 font-semibold", readable ? "text-[0.625rem]" : "text-[0.5rem]", statusToneStyles[statusTone(status)])}>
      <span aria-hidden="true" className="h-[0.3125rem] w-[0.3125rem] rounded-full bg-current" />
      {status}
    </span>
  );
}

const usageBarStyles = {
  blue: "bg-[oklch(0.641_0.1696_254.29)]",
  green: "bg-[oklch(0.7127_0.1432_159.53)]",
  amber: "bg-[oklch(0.7792_0.1474_69.31)]",
} as const;

export function UsageCell({ value, tone = "blue", readable = false }: { value: number; tone?: keyof typeof usageBarStyles; readable?: boolean }) {
  return (
    <div className={cn("flex min-w-[3.25rem] flex-col gap-1", readable ? "w-14" : "w-12")}>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-[oklch(0.9523_0.0103_247.93)] dark:bg-[oklch(0.3287_0.0431_255.49)]" aria-hidden="true">
        <span className={cn("block h-full rounded-full", usageBarStyles[tone])} style={{ width: `${value}%` }} />
      </span>
      <small className={cn("text-right leading-none text-[oklch(0.5626_0.0456_254.2)] dark:text-muted-foreground", readable ? "text-[0.625rem]" : "text-[0.5rem]")}>{value}%</small>
    </div>
  );
}

export function NetworkCell({ server, readable = false }: { server: Server; readable?: boolean }) {
  const values = serverNetworkTrends[server.id] ?? serverNetworkTrends["srv-01"];
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 38},${13 - value}`).join(" ");
  return (
    <span className="flex flex-col items-start gap-0.5">
      <svg viewBox="0 0 38 14" className="block h-[0.875rem] w-[2.375rem] overflow-visible" role="img" aria-label={`${server.name} network trend`}>
        <polyline points={points} fill="none" stroke="oklch(0.6335 0.1512 251.71)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <small className={cn("leading-none text-[oklch(0.5554_0.0477_253.99)] dark:text-muted-foreground", readable ? "text-[0.625rem]" : "text-[0.5rem]")}>{server.network}</small>
    </span>
  );
}

export function EnvironmentPill({ environment, readable = false }: { environment: string; readable?: boolean }) {
  const tone = environment.toLowerCase();
  const styles =
    tone === "production"
      ? "bg-[oklch(0.9594_0.0239_163.15)] text-[oklch(0.635_0.1367_158.66)]"
      : tone === "staging"
        ? "bg-[oklch(0.9575_0.0205_254.91)] text-[oklch(0.5925_0.1411_252.85)]"
        : tone === "development" || tone === "testing"
          ? "bg-[oklch(0.9468_0.0305_302.31)] text-[oklch(0.5694_0.1826_301.64)]"
          : "bg-[oklch(0.9579_0.0029_264.54)] text-slate-500 dark:bg-[oklch(0.3287_0.0431_255.49)] dark:text-[oklch(0.8156_0.0279_255.11)]";
  return <span className={cn("inline-block whitespace-nowrap rounded-full px-2 py-1 font-medium", readable ? "text-[0.625rem]" : "text-[0.5rem]", styles)}>{environment}</span>;
}

type OsType = "windows" | "debian" | "ubuntu";

export function OperatingSystem({ os, readable = false }: { os: string; readable?: boolean }) {
  const type: OsType = os.startsWith("Windows") ? "windows" : os.startsWith("Debian") ? "debian" : "ubuntu";
  return (
    <span className={cn("flex max-w-[7.8125rem] items-center gap-1.5 leading-snug text-[oklch(0.4921_0.0516_252.83)] dark:text-[oklch(0.8156_0.0279_255.11)]", readable ? "text-[0.6875rem]" : "text-[0.5625rem]")}>
      <OperatingSystemLogo type={type} />
      <span>{os}</span>
    </span>
  );
}

function OperatingSystemLogo({ type }: { type: OsType }) {
  if (type === "windows") {
    return (
      <svg className="h-[1.1875rem] w-[1.1875rem] shrink-0 text-[oklch(0.6048_0.1556_248)]" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 5.1 10.6 3.9v7.8H2V5.1Zm10.1-1.4L22 2v9.7h-9.9V3.7ZM2 12.9h8.6v7.8L2 19.5v-6.6Zm10.1 0H22v9.7l-9.9-1.7v-8Z" fill="currentColor" />
      </svg>
    );
  }
  if (type === "debian") {
    return (
      <svg className="h-[1.1875rem] w-[1.1875rem] shrink-0 text-[oklch(0.4769_0.1723_19.23)]" viewBox="0 0 24 24" aria-hidden="true">
        <path d={siDebian.path} fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className="h-[1.1875rem] w-[1.1875rem] shrink-0 text-[oklch(0.6405_0.1941_37.76)]" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <circle cx="12" cy="12" r="5.2" fill="none" stroke="oklch(1 0 89.88)" strokeWidth="1.7" />
      <path d="M12 6.8v2.2m4.5 2.6-1.9 1.1m-8.1-1.1 1.9 1.1" fill="none" stroke="oklch(1 0 89.88)" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="4.4" r="1.6" fill="oklch(1 0 89.88)" />
      <circle cx="18.6" cy="15.8" r="1.6" fill="oklch(1 0 89.88)" />
      <circle cx="5.4" cy="15.8" r="1.6" fill="oklch(1 0 89.88)" />
    </svg>
  );
}

const agentTone: Record<string, string> = {
  online: "text-[oklch(0.6457_0.1413_158.11)]",
  offline: "text-[oklch(0.6219_0.1898_20.33)]",
  pending: "text-[oklch(0.6013_0.1454_252.02)]",
};

const agentDot: Record<string, string> = {
  online: "bg-[oklch(0.6906_0.1512_158.8)]",
  offline: "bg-[oklch(0.6219_0.1898_20.33)]",
  pending: "bg-[oklch(0.6013_0.1454_252.02)]",
};

export function AgentCell({ agent, heartbeat, readable = false }: { agent: string; heartbeat: string; readable?: boolean }) {
  const key = agent.toLowerCase();
  return (
    <div className={cn("grid grid-cols-[7px_auto] items-center gap-x-1.5 gap-y-0.5", readable ? "text-[0.6875rem]" : "text-[0.5625rem]", agentTone[key] ?? agentTone.pending)}>
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", agentDot[key] ?? agentDot.pending)} />
      <span>{agent}</span>
      <small className={cn("col-start-2 whitespace-nowrap text-muted-foreground", readable ? "text-[0.5625rem]" : "text-[0.4375rem]")}>{heartbeat}</small>
    </div>
  );
}
