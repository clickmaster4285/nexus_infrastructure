import type { DonutDatum, MetricStat } from "./dashboard";

export const infrastructureStats: MetricStat[] = [
  { label: 'Total Assets', value: '48', change: '2 new', trend: 'up', tone: 'blue', icon: 'boxes', detail: 'Healthy  91%', detailTone: 'green' },
  { label: 'Servers', value: '12', change: '2 new', trend: 'up', tone: 'blue', icon: 'server', detail: 'Healthy  83%', detailTone: 'green' },
  { label: 'Containers', value: '26', change: '1 new', trend: 'up', tone: 'blue', icon: 'container', detail: 'Healthy  88%', detailTone: 'green' },
  { label: 'Network Devices', value: '6', change: 'No change', trend: 'flat', tone: 'blue', icon: 'network', detail: 'Healthy  100%', detailTone: 'green' },
  { label: 'Databases', value: '4', change: '1 new', trend: 'up', tone: 'green', icon: 'database', detail: 'Healthy  75%', detailTone: 'green' },
  { label: 'Services', value: '18', change: '1 new', trend: 'up', tone: 'blue', icon: 'settings-2', detail: 'Healthy  94%', detailTone: 'green' },
];

export const infrastructureHealth = { healthy: 38, degraded: 8, offline: 2 };

export interface ResourceUtilization { label: string; value: number; icon: string; tone: "blue" | "purple" | "teal" }
export const resourceUtilization: ResourceUtilization[] = [
  { label: 'CPU Usage', value: 42, icon: 'cpu', tone: 'blue' },
  { label: 'Memory Usage', value: 56, icon: 'memory', tone: 'purple' },
  { label: 'Storage Usage', value: 48, icon: 'storage', tone: 'teal' },
  { label: 'Network Usage', value: 28, icon: 'network', tone: 'blue' },
];

export interface CloudProvider { name: string; status: string; assets: number; icon: string; tone: "orange" | "blue" | "red" }
export const cloudProviders: CloudProvider[] = [
  { name: 'AWS', status: 'Healthy', assets: 12, icon: 'cloud', tone: 'orange' },
  { name: 'DigitalOcean', status: 'Healthy', assets: 6, icon: 'cloud', tone: 'blue' },
  { name: 'Hetzner', status: 'Degraded', assets: 4, icon: 'cloud', tone: 'red' },
];

export interface InfrastructureNode {
  name: string;
  status: string;
  detail?: string;
  icon: string;
  tone: "green" | "purple" | "blue" | "red";
}

export interface InfrastructureNodes {
  environments: InfrastructureNode[];
  platforms: InfrastructureNode[];
  databases: InfrastructureNode[];
}

export const infrastructureNodes: InfrastructureNodes = {
  environments: [
    { name: 'Production VPC', status: 'Healthy', detail: '5 servers  |  3 subnets', icon: 'vpc', tone: 'green' },
    { name: 'Staging', status: 'Healthy', detail: '3 servers  |  2 subnets', icon: 'staging-cloud', tone: 'purple' },
    { name: 'On-Prem Office', status: 'Healthy', detail: '2 servers  |  1 location', icon: 'on-prem', tone: 'blue' },
  ],
  platforms: [
    { name: 'Kubernetes / Docker', status: 'Healthy', detail: '8 nodes  |  26 containers', icon: 'kubernetes', tone: 'blue' },
    { name: 'Web / API Services', status: 'Healthy', detail: '4 services  |  3 domains', icon: 'web-services', tone: 'blue' },
  ],
  databases: [
    { name: 'MySQL', status: 'Healthy', icon: 'mysql', tone: 'blue' },
    { name: 'PostgreSQL', status: 'Healthy', icon: 'postgresql', tone: 'blue' },
    { name: 'Redis', status: 'Healthy', icon: 'redis', tone: 'red' },
  ],
};

export const providerDistribution: DonutDatum[] = [
  { name: 'AWS', value: 22, color: '#f49a24' },
  { name: 'DigitalOcean', value: 12, color: '#2684f5' },
  { name: 'Hetzner', value: 6, color: '#ef4655' },
  { name: 'On-Prem', value: 4, color: '#974be8' },
  { name: 'Others', value: 4, color: '#95a7bd' },
];

export interface AssetsByEnvironment { name: string; total: number; segments: number[] }
export const assetsByEnvironment: AssetsByEnvironment[] = [
  { name: 'Servers', total: 12, segments: [58, 14, 12, 16] },
  { name: 'Containers', total: 26, segments: [44, 18, 17, 21] },
  { name: 'Databases', total: 4, segments: [50, 25, 0, 25] },
  { name: 'Network Devices', total: 6, segments: [52, 15, 16, 17] },
  { name: 'Services', total: 18, segments: [42, 18, 20, 20] },
];

export interface InfrastructureEvent {
  title: string;
  date: string;
  icon: string;
  tone: "green" | "blue" | "amber";
  environment: string;
}

export const infrastructureEvents: InfrastructureEvent[] = [
  { title: 'Server added: web-frontend-01', date: 'Apr 23, 14:21', icon: 'server', tone: 'green', environment: 'Production' },
  { title: 'Container restarted: api-worker-02', date: 'Apr 23, 13:56', icon: 'container', tone: 'blue', environment: 'Production' },
  { title: 'Database backup completed', date: 'Apr 23, 12:42', icon: 'database', tone: 'blue', environment: 'Production' },
  { title: 'High CPU usage: db-primary', date: 'Apr 23, 11:18', icon: 'cpu', tone: 'amber', environment: 'Staging' },
  { title: 'Network device config changed', date: 'Apr 23, 09:32', icon: 'router', tone: 'blue', environment: 'Office' },
];

export interface UnmonitoredAsset { name: string; type: string; reason: string; action: string; tone: "red" | "amber" }
export const unmonitoredAssets: UnmonitoredAsset[] = [
  { name: 'legacy-db-01', type: 'Server', reason: 'No agent', action: 'Setup', tone: 'red' },
  { name: 'dev-vps-02', type: 'Server', reason: 'Offline', action: 'Setup', tone: 'amber' },
  { name: 'test-container-03', type: 'Container', reason: 'No metrics', action: 'Setup', tone: 'red' },
  { name: 'switch-01', type: 'Network Device', reason: 'SNMP not configured', action: 'Configure', tone: 'amber' },
  { name: 'internal-api', type: 'Service', reason: 'No endpoint check', action: 'Setup', tone: 'red' },
];
