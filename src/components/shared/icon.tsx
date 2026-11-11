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
  nginx: { icon: SiNginx, color: "#009639" },
  mysql: { icon: SiMysql, color: "#4479A1" },
  redis: { icon: SiRedis, color: "#DC382D" },
  docker: { icon: SiDocker, color: "#2496ED" },
  ssh: { icon: Terminal, color: "#475569" },
  postgres: { icon: SiPostgresql, color: "#336791" },
  postgresql: { icon: SiPostgresql, color: "#336791" },
  mongodb: { icon: SiMongodb, color: "#47A248" },
  mongod: { icon: SiMongodb, color: "#47A248" },
  apache: { icon: SiApache, color: "#D22128" },
  rabbitmq: { icon: SiRabbitmq, color: "#FF6600" },
  elasticsearch: { icon: SiElasticsearch, color: "#00BFB3" },
  node: { icon: SiNodedotjs, color: "#5FA04E" },
  prometheus: { icon: SiPrometheus, color: "#E6522C" },
  loki: { icon: SiGrafana, color: "#F46800" },
  "blackbox exporter": { icon: Radio, color: "#2563EB" },
  "windows exporter": { icon: FaWindows, color: "#0078D4" },
  "grafana agent": { icon: SiGrafana, color: "#F46800" },
  kong: { icon: SiKong, color: "#1B1F2B" },
  java: { icon: Terminal, color: "#E76F00" },
  python: { icon: Terminal, color: "#3776AB" },
  mysqld: { icon: SiMysql, color: "#4479A1" },
  cron: { icon: CalendarClock, color: "#64748B" },
  sshd: { icon: Terminal, color: "#475569" },
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
export function TechLogo({ name, className, fallbackIcon = Terminal }: { name: string; className?: string; fallbackIcon?: ElementType }) {
  return <ServiceIcon name={name} fallbackIcon={fallbackIcon} fallbackColor="#64748b" className={className} />;
}
