import { servers } from "./servers";
import { incidentStoreSnapshot } from "@/mocks/incidents";

const incidentsSnapshot = incidentStoreSnapshot();

export type TrendDirection = "up" | "down" | "flat";
export type MetricTone = "blue" | "green" | "red" | "amber" | "purple";

export interface MetricStat {
  label: string;
  value: string;
  change: string;
  trend: TrendDirection;
  tone: MetricTone;
  icon: string;
  detail?: string;
  detailTone?: string;
}

export const stats: MetricStat[] = [
  { label: 'Total Servers', value: '12', change: '2 new', trend: 'up', tone: 'blue', icon: 'server' },
  { label: 'Online Servers', value: '10', change: '83% of total', trend: 'flat', tone: 'green', icon: 'online' },
  { label: 'Offline Servers', value: '1', change: '8% of total', trend: 'flat', tone: 'red', icon: 'offline' },
  { label: 'Degraded Servers', value: '1', change: '8% of total', trend: 'flat', tone: 'amber', icon: 'warning' },
  { label: 'Critical Alerts', value: '5', change: '2 new', trend: 'up', tone: 'red', icon: 'bell' },
  { label: 'Active Incidents', value: `${incidentsSnapshot.open}`, change: '1 new', trend: 'up', tone: 'red', icon: 'flame' },
  { label: 'Avg. CPU Usage', value: '34%', change: '12%', trend: 'down', tone: 'blue', icon: 'cpu' },
  { label: 'Avg. Memory Usage', value: '56%', change: '8%', trend: 'down', tone: 'blue', icon: 'memory' },
  { label: 'Storage Utilization', value: '48%', change: '5%', trend: 'down', tone: 'blue', icon: 'storage' },
  { label: 'Network Throughput', value: '124 Mbps', change: '18%', trend: 'up', tone: 'blue', icon: 'network' },
  { label: 'Service Availability', value: '99.82%', change: '0.12%', trend: 'up', tone: 'green', icon: 'shield' },
  { label: 'Monitoring Coverage', value: '96%', change: '1%', trend: 'up', tone: 'blue', icon: 'pulse' },
];

const hours = ['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00','24:00'];

export interface HealthTrendPoint { time: string; healthy: number; warning: number; critical: number }
export const healthTrend: HealthTrendPoint[] = hours.map((time, i) => ({ time, healthy: [88,87,89,88,86,87,88,87,86,87,89,90,91][i], warning: [19,20,18,19,19,20,19,18,19,20,19,20,21][i], critical: [4,5,4,4,5,4,5,4,4,5,4,5,5][i] }));

export interface UsageTrendPoint { time: string; cpu: number; memory: number }
export const usageTrend: UsageTrendPoint[] = hours.map((time, i) => ({ time, cpu: [48,55,52,59,53,61,57,63,78,65,59,64,58][i], memory: [38,41,40,44,42,45,43,47,58,49,42,44,43][i] }));

export interface StorageTrendPoint { day: string; used: number; growth: number }
export const storageTrend: StorageTrendPoint[] = [
  {day:'Apr 16',used:5.2,growth:2.2},{day:'Apr 17',used:5.6,growth:3.5},{day:'Apr 18',used:5.7,growth:3.2},{day:'Apr 19',used:6.1,growth:3.4},
  {day:'Apr 20',used:6.3,growth:4.2},{day:'Apr 21',used:6.1,growth:4.1},{day:'Apr 22',used:6.4,growth:4.0},{day:'Apr 23',used:7.3,growth:5.7},
];

export interface TrafficPoint { time: string; inbound: number; outbound: number }
export const traffic: TrafficPoint[] = usageTrend.map(({ time, cpu, memory }) => ({ time, inbound: cpu * 1.45, outbound: memory * 0.7 }));

export interface AvailabilityGroup { name: string; count: string; segments: number[] }
export const serverAvailability: AvailabilityGroup[] = [
  {name:'Web Servers', count:'5/6', segments:[75,8,7,6,4]}, {name:'Database Servers',count:'2/2',segments:[83,5,4,5,3]},
  {name:'Application Servers',count:'3/3',segments:[72,10,7,6,5]}, {name:'Cache Servers',count:'1/1',segments:[85,5,4,3,3]},
  {name:'Other Servers',count:'2/2',segments:[68,12,8,7,5]},
];

export interface DonutDatum { name: string; value: number; color: string }
export const alertSeverity: DonutDatum[] = [{name:'Critical',value:5,color:'#f04452'},{name:'High',value:7,color:'#fa9238'},{name:'Medium',value:6,color:'#f4c83d'},{name:'Low',value:3,color:'#2684f5'},{name:'Info',value:2,color:'#16b8a2'}];
export const incidentStatus: DonutDatum[] = [{name:'Open',value:1,color:'#f04452'},{name:'Investigating',value:1,color:'#fa9238'},{name:'Monitoring',value:1,color:'#2684f5'},{name:'Resolved',value:1,color:'#1fba79'}];

export interface MetricTableRow { name: string; usage: number; color: string; trend: string }
function serverMetricRows(metric: "cpu" | "memory"): MetricTableRow[] {
  return [...servers]
    .sort((left, right) => right[metric] - left[metric])
    .slice(0, 5)
    .map((server) => ({
      name: server.name,
      usage: server[metric],
      color: server[metric] >= 80 ? "red" : server[metric] >= 60 ? "amber" : server[metric] >= 40 ? "yellow" : "green",
      trend: server[metric] >= 70 ? "↑" : server[metric] <= 35 ? "↓" : "→",
    }));
}
export const cpuServers = serverMetricRows("cpu");
export const memoryServers = serverMetricRows("memory");

export interface BackupTableRow { name: string; usage: number; free: string; color: string }
export const backupServers: BackupTableRow[] = [
  {name:'prod-api-01',usage:92,free:'12 GB',color:'green'},{name:'db-primary',usage:87,free:'28 GB',color:'amber'},{name:'web-frontend-01',usage:76,free:'64 GB',color:'orange'},{name:'app-worker-02',usage:68,free:'82 GB',color:'green'},{name:'local-office',usage:54,free:'120 GB',color:'blue'},
];

export interface LatencyTableRow { name: string; latency: string; trend: string; color: string }
export const latency: LatencyTableRow[] = [
  {name:'api.example.com',latency:'8421 ms',trend:'↑ 1 min ago',color:'green'},{name:'payment-api',latency:'4321 ms',trend:'↑ 2 min ago',color:'blue'},{name:'user-service',latency:'4181 ms',trend:'→ 1 min ago',color:'amber'},{name:'web-frontend',latency:'Warning',trend:'5 min ago',color:'green'},{name:'internal-api',latency:'Healthy',trend:'1 min ago',color:'teal'},
];
