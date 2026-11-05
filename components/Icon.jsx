import {
  Activity, Bell, BookOpen, Boxes, CalendarCheck, CalendarClock, CalendarDays, ChartNoAxesColumnIncreasing,
  ChartNoAxesCombined, Cloud, Container, Cpu, Database, FileClock, FileSearch, Fingerprint, Flame, Globe,
  HardDriveDownload, KeyRound, LayoutDashboard, MapPin, Network, OctagonAlert, PanelsTopLeft, Radio, Router,
  Server, Settings2, Shield, ShieldAlert, ShieldCheck, SquareTerminal, ScrollText, BadgeCheck, Workflow,
  MemoryStick, CircleAlert,
} from 'lucide-react';

const icons = {
  'layout-dashboard': LayoutDashboard, 'panels-top-left': PanelsTopLeft, radio: Radio, 'globe-2': Globe,
  server: Server, boxes: Boxes, 'square-terminal': SquareTerminal, 'map-pin': MapPin, router: Router,
  container: Container, cloud: Cloud, workflow: Workflow, 'chart-no-axes-combined': ChartNoAxesCombined,
  cpu: Cpu, database: Database, activity: Activity, globe: Globe, 'file-search': FileSearch,
  'calendar-days': CalendarDays, 'chart-no-axes-column-increasing': ChartNoAxesColumnIncreasing,
  bell: Bell, 'settings-2': Settings2, 'octagon-alert': OctagonAlert, 'calendar-clock': CalendarClock,
  'calendar-check': CalendarCheck, 'hard-drive-download': HardDriveDownload, 'book-open': BookOpen,
  'shield-check': ShieldCheck, fingerprint: Fingerprint, 'scroll-text': ScrollText, 'file-clock': FileClock,
  'shield-alert': ShieldAlert, 'badge-check': BadgeCheck, 'key-round': KeyRound, online: Activity,
  offline: CircleAlert, warning: CircleAlert, flame: Flame, memory: MemoryStick, storage: HardDriveDownload,
  network: Network, shield: Shield, pulse: Activity,
};

export default function Icon({ name, size = 16, ...props }) {
  const Component = icons[name] || Activity;
  return <Component size={size} strokeWidth={1.8} {...props} />;
}
