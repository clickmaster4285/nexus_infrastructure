import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  Bell,
  BookOpen,
  Boxes,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChartNoAxesCombined,
  Cloud,
  Container,
  Cpu,
  Database,
  FileClock,
  FileSearch,
  Fingerprint,
  Globe,
  HardDriveDownload,
  KeyRound,
  LayoutDashboard,
  MapPin,
  OctagonAlert,
  PanelsTopLeft,
  Radio,
  Router,
  ScrollText,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Workflow,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    icon: LayoutDashboard,
    items: [
      { label: "Executive Overview", href: "/executive-overview", icon: LayoutDashboard },
      { label: "Infrastructure Dashboard", href: "/infrastructure-dashboard", icon: PanelsTopLeft },
      { label: "Live Operations / NOC", href: "/live-operations-noc", icon: Radio },
      { label: "Global Health", href: "/global-health", icon: Globe },
    ],
  },
  {
    title: "Infrastructure",
    icon: Boxes,
    items: [
      { label: "Server Sites", href: "/server-sites", icon: MapPin },
      { label: "All Servers", href: "/all-servers", icon: Server },
      { label: "Server Groups", href: "/server-groups", icon: Boxes },
      { label: "Network Devices", href: "/network-devices", icon: Router },
      { label: "Containers & Docker", href: "/containers-and-docker", icon: Container },
      { label: "Cloud Accounts & Providers", href: "/cloud-accounts-and-providers", icon: Cloud },
      { label: "Dependencies", href: "/dependencies", icon: Workflow },
    ],
  },
  {
    title: "Monitoring",
    icon: Activity,
    items: [
      { label: "Metrics Explorer", href: "/metrics-explorer", icon: ChartNoAxesCombined },
      { label: "CPU & Memory", href: "/cpu-and-memory", icon: Cpu },
      { label: "Disk & Storage", href: "/disk-and-storage", icon: Database },
      { label: "Network Monitoring", href: "/network-monitoring", icon: Activity },
      { label: "Processes & Services", href: "/processes-and-services", icon: Workflow },
      { label: "Website & API Monitoring", href: "/website-and-api-monitoring", icon: Globe },
      { label: "Database Monitoring", href: "/database-monitoring", icon: Database },
      { label: "Logs Explorer", href: "/logs-explorer", icon: FileSearch },
      { label: "Event Explorer", href: "/events-explorer", icon: CalendarDays },
      { label: "Uptime & SLA Reports", href: "/uptime-and-sla-reports", icon: ChartNoAxesColumnIncreasing },
    ],
  },
  {
    title: "Operations",
    icon: Settings2,
    items: [
      { label: "Alerts", href: "/alerts", icon: Bell },
      { label: "Alert Rules", href: "/alert-rules", icon: Settings2 },
      { label: "Incidents", href: "/incidents", icon: OctagonAlert },
      { label: "Maintenance Windows", href: "/maintenance-windows", icon: CalendarClock },
      { label: "Scheduled Tasks", href: "/scheduled-tasks", icon: CalendarCheck },
      { label: "Backups & Recovery", href: "/backups-and-recovery", icon: HardDriveDownload },
      { label: "Runbooks", href: "/runbooks", icon: BookOpen },
    ],
  },
  {
    title: "Security",
    icon: ShieldCheck,
    items: [
      { label: "Security Overview", href: "/security-overview", icon: ShieldCheck },
      { label: "Authentication Events", href: "/authentication-events", icon: Fingerprint },
      { label: "Audit Logs", href: "/audit-logs", icon: ScrollText },
      { label: "Configuration Changes", href: "/configuration-changes", icon: FileClock },
      { label: "Vulnerability & Patch Status", href: "/vulnerability-and-patch-status", icon: ShieldAlert },
      { label: "Certificates & Expiration", href: "/certificates-and-expiration", icon: BadgeCheck },
      { label: "Access Control", href: "/access-control", icon: KeyRound },
    ],
  },
];

const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

const hrefByLabel = new Map(ALL_NAV_ITEMS.map((item) => [item.label, item.href]));

/** Resolves a sidebar label to its route, e.g. "All Servers" -> "/all-servers". */
export function hrefForLabel(label: string): string {
  return hrefByLabel.get(label) ?? "/executive-overview";
}
