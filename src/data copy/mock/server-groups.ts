export interface ServerGroup {
  id: string;
  name: string;
  totalServers: number;
  healthy: number;
  warning: number;
  critical: number;
  health: number;
  load: number;
  location: string;
  icon: "server" | "database" | "cube" | "globe" | "layers" | "grid";
}

export const serverGroups: ServerGroup[] = [
  { id: "production", name: "Production Servers", totalServers: 5, healthy: 5, warning: 0, critical: 0, health: 100, load: 72.3, location: "DC – Islamabad", icon: "server" },
  { id: "database", name: "Database Servers", totalServers: 3, healthy: 2, warning: 1, critical: 0, health: 66.7, load: 81.6, location: "DC – Lahore", icon: "database" },
  { id: "application", name: "Application Servers", totalServers: 4, healthy: 4, warning: 0, critical: 0, health: 100, load: 30, location: "DC – Karachi", icon: "cube" },
  { id: "web", name: "Web Servers", totalServers: 6, healthy: 5, warning: 1, critical: 0, health: 83.3, load: 83.3, location: "DC – Rawalpindi", icon: "globe" },
  { id: "cache", name: "Cache Servers", totalServers: 2, healthy: 2, warning: 0, critical: 0, health: 100, load: 89, location: "DC – Multan", icon: "layers" },
  { id: "other", name: "Other Servers", totalServers: 1, healthy: 1, warning: 0, critical: 0, health: 100, load: 70, location: "DC – Peshawar", icon: "grid" },
  { id: "staging", name: "Staging Servers", totalServers: 3, healthy: 2, warning: 1, critical: 0, health: 66.7, load: 54.2, location: "DC – Islamabad", icon: "server" },
  { id: "development", name: "Development Servers", totalServers: 4, healthy: 4, warning: 0, critical: 0, health: 100, load: 38.7, location: "DC – Lahore", icon: "cube" },
  { id: "monitoring", name: "Monitoring Nodes", totalServers: 2, healthy: 1, warning: 0, critical: 1, health: 50, load: 91.4, location: "DC – Karachi", icon: "grid" },
  { id: "backup", name: "Backup Infrastructure", totalServers: 3, healthy: 3, warning: 0, critical: 0, health: 100, load: 42.8, location: "DC – Rawalpindi", icon: "database" },
  { id: "edge", name: "Edge Locations", totalServers: 5, healthy: 4, warning: 1, critical: 0, health: 80, load: 61.5, location: "Multi-region", icon: "globe" },
  { id: "internal", name: "Internal Services", totalServers: 2, healthy: 2, warning: 0, critical: 0, health: 100, load: 28.6, location: "DC – Islamabad", icon: "layers" },
];

export const serverGroupTrend = [
  { time: "00:00", healthy: 86, warning: 31, critical: 10 },
  { time: "02:00", healthy: 86, warning: 30, critical: 9 },
  { time: "04:00", healthy: 87, warning: 30, critical: 9 },
  { time: "06:00", healthy: 88, warning: 29, critical: 9 },
  { time: "08:00", healthy: 87, warning: 27, critical: 8 },
  { time: "10:00", healthy: 88, warning: 28, critical: 8 },
  { time: "12:00", healthy: 88, warning: 26, critical: 8 },
  { time: "14:00", healthy: 87, warning: 27, critical: 8 },
  { time: "16:00", healthy: 89, warning: 28, critical: 8 },
  { time: "18:00", healthy: 88, warning: 27, critical: 8 },
  { time: "20:00", healthy: 90, warning: 27, critical: 8 },
  { time: "22:00", healthy: 89, warning: 26, critical: 8 },
  { time: "24:00", healthy: 89, warning: 26, critical: 8 },
];

export const serverGroupActivity = [
  { group: "Production Servers", status: "Healthy", time: "2 min ago", tone: "green" },
  { group: "Database Servers", status: "Warning", time: "7 min ago", tone: "amber" },
  { group: "Web Servers", status: "New group created", time: "12 min ago", tone: "blue" },
];
