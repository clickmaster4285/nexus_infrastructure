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
  LayoutTemplate,
  MapPin,
  GitMerge,
  OctagonAlert,
  PanelsTopLeft,
  TrendingUp,
  Radio,
  Router,
  ScrollText,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Workflow,
  Users,
} from "lucide-react";

export interface NavItem {    
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup{
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    icon: LayoutDashboard,
    items: [
      { label: "Executive Overview", href: "/overview/executive", icon: LayoutDashboard },
      { label: "Infrastructure Dashboard", href: "/overview/infrastructure", icon: PanelsTopLeft },
      { label: "Live Operations / NOC", href: "/overview/live-operations", icon: Radio },
      { label: "Global Health", href: "/overview/global-health", icon: Globe },
    ],
  },
  {
    title: "Infrastructure",
    icon: Boxes,
    items: [
      { label: "Server Sites", href: "/infrastructure/server-sites", icon: MapPin },
      { label: "All Servers", href: "/infrastructure/all-servers", icon: Server },
      { label: "Server Groups", href: "/infrastructure/server-groups", icon: Boxes },
      { label: "Network Devices", href: "/infrastructure/network-devices", icon: Router },
      { label: "Network Topology", href: "/infrastructure/network-topology", icon: Workflow },
      { label: "Containers & Docker", href: "/infrastructure/containers-and-docker", icon: Container },
      { label: "Cloud Accounts & Providers", href: "/infrastructure/cloud-accounts-and-providers", icon: Cloud },
      { label: "Dependencies", href: "/infrastructure/dependencies", icon: Workflow },
    ],
  },
  {
    title: "Monitoring",
    icon: Activity,
    items: [
      { label: "Metrics Explorer", href: "/monitoring/metrics-explorer", icon: ChartNoAxesCombined },
      { label: "CPU & Memory", href: "/monitoring/cpu-and-memory", icon: Cpu },
      { label: "Disk & Storage", href: "/monitoring/disk-and-storage", icon: Database },
      { label: "Network Monitoring", href: "/monitoring/network-monitoring", icon: Activity },
      { label: "Processes & Services", href: "/monitoring/processes-and-services", icon: Workflow },
      { label: "Website & API Monitoring", href: "/monitoring/website-and-api-monitoring", icon: Globe },
      { label: "Database Monitoring", href: "/monitoring/database-monitoring", icon: Database },
      { label: "Logs Explorer", href: "/monitoring/logs-explorer", icon: FileSearch },
      { label: "Event Explorer", href: "/monitoring/events-explorer", icon: CalendarDays },
      { label: "Uptime & SLA Reports", href: "/monitoring/uptime-and-sla-reports", icon: ChartNoAxesColumnIncreasing },
      { label: "Capacity Planning", href: "/monitoring/capacity-planning", icon: TrendingUp },
      { label: "Monitoring Templates", href: "/monitoring/templates", icon: LayoutTemplate },
    ],
  },
  {
    title: "Operations",
    icon: Settings2,
    items: [
      { label: "Alerts", href: "/operations/alerts", icon: Bell },
      { label: "Alert Rules", href: "/operations/alert-rules", icon: Settings2 },
      { label: "Alert Correlation", href: "/operations/alert-correlation", icon: GitMerge },
      { label: "Incidents", href: "/operations/incidents", icon: OctagonAlert },
      { label: "Maintenance Windows", href: "/operations/maintenance-windows", icon: CalendarClock },
      { label: "Scheduled Tasks", href: "/operations/scheduled-tasks", icon: CalendarCheck },
      { label: "Backups & Recovery", href: "/operations/backups-and-recovery", icon: HardDriveDownload },
      { label: "Runbooks", href: "/operations/runbooks", icon: BookOpen },
    ],
  },
  {
    title: "Members",
    icon: Users,
    items: [{ label: "Members", href: "/members", icon: Users }],
  },
  {
    title: "Security",
    icon: ShieldCheck,
    items: [
      { label: "Security Overview", href: "/security/security-overview", icon: ShieldCheck },
      { label: "Authentication Events", href: "/security/authentication-events", icon: Fingerprint },
      { label: "Audit Logs", href: "/security/audit-logs", icon: ScrollText },
      { label: "Configuration Changes", href: "/security/configuration-changes", icon: FileClock },
      { label: "Vulnerability & Patch Status", href: "/security/vulnerability-and-patch-status", icon: ShieldAlert },
      { label: "Certificates & Expiration", href: "/security/certificates-and-expiration", icon: BadgeCheck },
      { label: "Access Control", href: "/security/access-control", icon: KeyRound },
    ],
  },
];

const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

const hrefByLabel = new Map(ALL_NAV_ITEMS.map((item) => [item.label, item.href]));

/** Resolves a sidebar label to its route, e.g. "All Servers" -> "/infrastructure/all-servers". */
export function hrefForLabel(label: string): string {
  return hrefByLabel.get(label) ?? "/overview/executive";
}
