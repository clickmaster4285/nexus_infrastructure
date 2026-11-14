import type { ElementType } from "react";
import type { LucideIcon } from "lucide-react";
import { FaWindows } from "react-icons/fa";
import {
  Activity,
  Bell,
  BookOpen,
  Boxes,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChartNoAxesCombined,
  CircleAlert,
  Cloud,
  Container,
  Cpu,
  Database,
  Download,
  FileClock,
  FileSearch,
  Fingerprint,
  Flame,
  Globe,
  HardDriveDownload,
  KeyRound,
  LayoutDashboard,
  MapPin,
  MemoryStick,
  Network,
  OctagonAlert,
  PanelsTopLeft,
  Radio,
  Router,
  ScrollText,
  Server,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SquareTerminal,
  BadgeCheck,
  Terminal,
  Workflow,
} from "lucide-react";
import {
  SiApache,
  SiDocker,
  SiElasticsearch,
  SiKong,
  SiMongodb,
  SiMysql,
  SiNginx,
  SiNodedotjs,
  SiPostgresql,
  SiPrometheus,
  SiRabbitmq,
  SiRedis,
  SiGrafana,
} from "react-icons/si";

import { cn } from "@/lib/utils";

const icons: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "panels-top-left": PanelsTopLeft,
  radio: Radio,
  "globe-2": Globe,
  server: Server,
  boxes: Boxes,
  "square-terminal": SquareTerminal,
  "map-pin": MapPin,
  router: Router,
  container: Container,
  cloud: Cloud,
  workflow: Workflow,
  "chart-no-axes-combined": ChartNoAxesCombined,
  cpu: Cpu,
  database: Database,
  download: Download,
  activity: Activity,
  globe: Globe,
  "file-search": FileSearch,
  "calendar-days": CalendarDays,
  "chart-no-axes-column-increasing": ChartNoAxesColumnIncreasing,
  bell: Bell,
  "settings-2": Settings2,
  "octagon-alert": OctagonAlert,
  "calendar-clock": CalendarClock,
  "calendar-check": CalendarCheck,
  "hard-drive-download": HardDriveDownload,
  "book-open": BookOpen,
  "shield-check": ShieldCheck,
  fingerprint: Fingerprint,
  "scroll-text": ScrollText,
  "file-clock": FileClock,
  "shield-alert": ShieldAlert,
  "badge-check": BadgeCheck,
  "key-round": KeyRound,
  online: Activity,
  offline: CircleAlert,
  warning: CircleAlert,
  flame: Flame,
  memory: MemoryStick,
  storage: HardDriveDownload,
  network: Network,
  shield: Shield,
  pulse: Activity,
};

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className }: IconProps) {
  const Component = icons[name] ?? Activity;
  return <Component size={size} strokeWidth={1.8} className={className} aria-hidden="true" />;
}

export interface ServiceIconEntry {
  /** Brand or lucide icon component for the service. */
  icon: ElementType;
  /** Brand colour used for the icon and its 10% tinted background. */
  color: string;
}

/** Service name (lowercase) -> brand icon + brand colour. */
export const serviceIcons: Record<string, ServiceIconEntry> = {
  nginx: { icon: SiNginx, color: "oklch(0.5868 0.1712 147.69)" },
  mysql: { icon: SiMysql, color: "oklch(0.5565 0.0844 242.88)" },
  redis: { icon: SiRedis, color: "oklch(0.591 0.2022 28.73)" },
  docker: { icon: SiDocker, color: "oklch(0.6551 0.1613 247.55)" },
  ssh: { icon: Terminal, color: "oklch(0.4455 0.0374 257.28)" },
  postgres: { icon: SiPostgresql, color: "oklch(0.4973 0.0875 245.25)" },
  postgresql: { icon: SiPostgresql, color: "oklch(0.4973 0.0875 245.25)" },
  mongodb: { icon: SiMongodb, color: "oklch(0.636 0.1543 143.68)" },
  mongod: { icon: SiMongodb, color: "oklch(0.636 0.1543 143.68)" },
  apache: { icon: SiApache, color: "oklch(0.5561 0.2089 26.02)" },
  rabbitmq: { icon: SiRabbitmq, color: "oklch(0.6958 0.2043 43.49)" },
  elasticsearch: { icon: SiElasticsearch, color: "oklch(0.7244 0.1266 186.86)" },
  node: { icon: SiNodedotjs, color: "oklch(0.6425 0.1333 139.43)" },
  prometheus: { icon: SiPrometheus, color: "oklch(0.6342 0.1906 35.18)" },
  loki: { icon: SiGrafana, color: "oklch(0.6818 0.1924 45.78)" },
  "blackbox exporter": { icon: Radio, color: "oklch(0.5461 0.2152 262.88)" },
  "windows exporter": { icon: FaWindows, color: "oklch(0.5677 0.1665 251.31)" },
  "grafana agent": { icon: SiGrafana, color: "oklch(0.6818 0.1924 45.78)" },
  kong: { icon: SiKong, color: "oklch(0.2409 0.0238 270.23)" },
  java: { icon: Terminal, color: "oklch(0.6726 0.1752 51.04)" },
  python: { icon: Terminal, color: "oklch(0.5489 0.1053 246.67)" },
  mysqld: { icon: SiMysql, color: "oklch(0.5565 0.0844 242.88)" },
  cron: { icon: CalendarClock, color: "oklch(0.5544 0.0407 257.42)" },
  sshd: { icon: Terminal, color: "oklch(0.4455 0.0374 257.28)" },
};

/**
 * Normalises a service name or container image reference to a lookup key.
 * "nginx:1.25" / "library/node:18-alpine" -> "nginx" / "node".
 */
export function serviceKey(name: string): string {
  const withoutRegistry = name.trim().toLowerCase().split("/").pop() ?? "";
  const base = withoutRegistry.split(":")[0];
  return Object.keys(serviceIcons).find((key) => base === key || base.includes(key)) ?? base;
}

interface ServiceIconProps {
  /** Service name or container image reference; looked up case-insensitively. */
  name: string;
  /** Icon used when the service has no brand icon. */
  fallbackIcon?: ElementType;
  /** Fallback icon colour. */
  fallbackColor?: string;
  className?: string;
}

/**
 * Renders a service brand icon inside a 28x28 rounded box tinted with the
 * brand colour. Unknown services fall back to the generic server icon.
 */
export function ServiceIcon({ name, fallbackIcon = Server, fallbackColor, className }: ServiceIconProps) {
  const key = serviceKey(name);
  const entry = serviceIcons[key];
  const label = `${key} logo`;

  if (!entry) {
    const Fallback = fallbackIcon;
    return (
      <span
        className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md bg-blue-100 text-primary dark:bg-blue-950", className)}
        style={fallbackColor ? { backgroundColor: `${fallbackColor}1A`, color: fallbackColor } : undefined}
        title={`${name} logo`}
        role="img"
        aria-label={`${name} logo`}
      >
        <Fallback size={18} aria-hidden="true" />
      </span>
    );
  }

  const Icon = entry.icon;
  return (
    <span
      className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md", className)}
      style={{ backgroundColor: `${entry.color}1A` }}
      title={`${name} logo`}
      role="img"
      aria-label={`${name} logo`}
    >
      <Icon size={18} color={entry.color} aria-hidden="true" />
    </span>
  );
}

/**
 * Container image variant: renders the brand icon for the image's base
 * software (e.g. "postgres:15" -> PostgreSQL) and falls back to a generic
 * container icon for unknown images.
 */
export function ImageIcon({ name, className }: { name: string; className?: string }) {
  return <TechLogo name={name} className={className} fallbackIcon={Boxes} />;
}

/** Shared brand mark used beside container images, processes and services. */
export function TechLogo({ name, className, fallbackIcon = Terminal, fallbackColor = "oklch(0.5544 0.0407 257.42)" }: { name: string; className?: string; fallbackIcon?: ElementType; fallbackColor?: string }) {
  return <ServiceIcon name={name} fallbackIcon={fallbackIcon} fallbackColor={fallbackColor} className={className} />;
}
