export type DatabaseStatus = "Healthy" | "Warning" | "Offline";

export interface DatabaseRecord {
  name: string;
  engine: string;
  location: string;
  lat: number;
  lng: number;
  query: string;
  throughput: string;
  status: DatabaseStatus;
  health: number;
  sizeGb: number;
  issue?: string;
}

const databases = [
  { name: "my_app_db", engine: "PostgreSQL", location: "Virginia", lat: 38.95, lng: -77.45, query: "245 ms", throughput: "1,245 QPS", status: "Warning", health: 97.8, sizeGb: 96, issue: "Slow Query" },
  { name: "ecommerce_db", engine: "MySQL", location: "Virginia", lat: 38.95, lng: -77.45, query: "142 ms", throughput: "876 QPS", status: "Healthy", health: 99.2, sizeGb: 168 },
  { name: "analytics_db", engine: "PostgreSQL", location: "Frankfurt", lat: 50.11, lng: 8.68, query: "178 ms", throughput: "982 QPS", status: "Healthy", health: 99.4, sizeGb: 142 },
  { name: "hr_db", engine: "MySQL", location: "Karachi", lat: 24.86, lng: 67.01, query: "121 ms", throughput: "743 QPS", status: "Healthy", health: 99.1, sizeGb: 13 },
  { name: "reports_db", engine: "MongoDB", location: "Mumbai", lat: 19.08, lng: 72.88, query: "98 ms", throughput: "602 QPS", status: "Healthy", health: 99.7, sizeGb: 38, issue: "Replication lag high" },
  { name: "logs_db", engine: "Elasticsearch", location: "Singapore", lat: 1.35, lng: 103.82, query: "76 ms", throughput: "488 QPS", status: "Healthy", health: 99.6, sizeGb: 64 },
] satisfies DatabaseRecord[];

const times = ["12:00", "14:00", "16:00", "18:00", "20:00", "22:00", "00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00"];
const connectionHistory = [360, 378, 405, 390, 432, 418, 406, 420, 398, 437, 416, 428, 412];
const latencyHistory = [122, 135, 128, 142, 137, 151, 145, 132, 139, 158, 144, 148, 142];

export const databaseMonitoringData = {
  databases,
  history: times.map((time, index) => ({
    time,
    query: [232, 241, 278, 262, 281, 276, 269, 251, 263, 272, 251, 264, 245][index],
    connections: connectionHistory[index],
    throughput: [76, 82, 105, 120, 115, 98, 112, 101, 108, 116, 92, 103, 94][index],
    active: Math.min(connectionHistory[index], 382),
    idle: Math.max(0, connectionHistory[index] - Math.min(connectionHistory[index], 382)),
    latency: latencyHistory[index],
  })),
  storage: { usedGb: 521, freeGb: 203, dailyGrowthGb: 4.2, growthHistory: [492, 498, 501, 508, 513, 517, 521] },
  topDatabasesBySize: databases.map(({ name, sizeGb }) => ({ name, sizeGb })).sort((a, b) => b.sizeGb - a.sizeGb),
  eventsTotal: 24,
  connections: { active: 382, idle: 30, max: 600, history: connectionHistory },
  query: {
    averageMs: 142,
    averageTrendPercent: -8.1,
    qps: 1260,
    p95Ms: 386,
    p99Ms: 642,
    breakdown: [
      { name: "Fast", count: 1244, color: "#34d399" },
      { name: "Normal", count: 12, color: "#60a5fa" },
      { name: "Slow", count: 4, color: "#fbbf24" },
    ],
  },
  events: [
    { time: "12:38 PM", database: "my_app_db", event: "Slow Query", message: "Query took 2.8s", status: "Warning" },
    { time: "11:50 AM", database: "analytics_db", event: "Connection Loss", message: "Reconnected successfully", status: "Resolved" },
    { time: "10:26 AM", database: "ecommerce_db", event: "Backup Completed", message: "Backup size: 4.2 GB", status: "Info" },
    { time: "09:12 AM", database: "hr_db", event: "High CPU", message: "CPU usage reached 90%", status: "Resolved" },
    { time: "08:45 AM", database: "logs_db", event: "Maintenance", message: "Scheduled maintenance", status: "Info" },
    { time: "08:10 AM", database: "reports_db", event: "Replication lag high", message: "Replica is 0.4 seconds behind primary", status: "Warning" },
    { time: "07:42 AM", database: "ecommerce_db", event: "Deadlock detected", message: "Two transactions retried successfully", status: "Resolved" },
    { time: "07:15 AM", database: "analytics_db", event: "Vacuum Completed", message: "Reclaimed 3.1 GB", status: "Info" },
    { time: "06:50 AM", database: "hr_db", event: "Connection Spike", message: "140 connections in 1 min", status: "Resolved" },
    { time: "06:20 AM", database: "logs_db", event: "Index Rebuilt", message: "Completed in 4m 12s", status: "Info" },
  ].map((event) => ({ ...event, engine: databases.find((db) => db.name === event.database)?.engine ?? "Database" })),
  slowQueries: [
    { time: "12:38 PM", database: "my_app_db", engine: "PostgreSQL", query: "SELECT orders with customer details", duration: "2.8 s", calls: 42 },
    { time: "11:22 AM", database: "analytics_db", engine: "PostgreSQL", query: "Aggregation: monthly_revenue", duration: "1.9 s", calls: 18 },
    { time: "10:04 AM", database: "ecommerce_db", engine: "MySQL", query: "UPDATE inventory set reserved", duration: "1.4 s", calls: 27 },
    { time: "09:48 AM", database: "my_app_db", engine: "PostgreSQL", query: "SELECT session audit history", duration: "1.2 s", calls: 33 },
    { time: "08:16 AM", database: "logs_db", engine: "Elasticsearch", query: "Search: payment events", duration: "980 ms", calls: 12 },
    { time: "07:53 AM", database: "hr_db", engine: "MySQL", query: "SELECT employee directory", duration: "870 ms", calls: 9 },
    { time: "07:20 AM", database: "reports_db", engine: "MongoDB", query: "Aggregate replication status", duration: "610 ms", calls: 54 },
  ],
} as const;

export type DatabaseEvent = (typeof databaseMonitoringData.events)[number];
