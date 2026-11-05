export const stats = [
  { label: 'Total Servers', value: '12', change: '2 new', trend: 'up', tone: 'blue', icon: 'server' },
  { label: 'Online Servers', value: '10', change: '83% of total', trend: 'flat', tone: 'green', icon: 'online' },
  { label: 'Offline Servers', value: '1', change: '8% of total', trend: 'flat', tone: 'red', icon: 'offline' },
  { label: 'Degraded Servers', value: '1', change: '8% of total', trend: 'flat', tone: 'amber', icon: 'warning' },
  { label: 'Critical Alerts', value: '5', change: '2 new', trend: 'up', tone: 'red', icon: 'bell' },
  { label: 'Active Incidents', value: '2', change: '1 new', trend: 'up', tone: 'red', icon: 'flame' },
  { label: 'Avg. CPU Usage', value: '34%', change: '12%', trend: 'down', tone: 'blue', icon: 'cpu' },
  { label: 'Avg. Memory Usage', value: '56%', change: '8%', trend: 'down', tone: 'blue', icon: 'memory' },
  { label: 'Storage Utilization', value: '48%', change: '5%', trend: 'down', tone: 'blue', icon: 'storage' },
  { label: 'Network Throughput', value: '124 Mbps', change: '18%', trend: 'up', tone: 'blue', icon: 'network' },
  { label: 'Service Availability', value: '99.82%', change: '0.12%', trend: 'up', tone: 'green', icon: 'shield' },
  { label: 'Monitoring Coverage', value: '96%', change: '1%', trend: 'up', tone: 'blue', icon: 'pulse' },
];

const hours = ['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00','24:00'];
export const healthTrend = hours.map((time, i) => ({ time, healthy: [88,87,89,88,86,87,88,87,86,87,89,90,91][i], warning: [19,20,18,19,19,20,19,18,19,20,19,20,21][i], critical: [4,5,4,4,5,4,5,4,4,5,4,5,5][i] }));
export const usageTrend = hours.map((time, i) => ({ time, cpu: [48,55,52,59,53,61,57,63,78,65,59,64,58][i], memory: [38,41,40,44,42,45,43,47,58,49,42,44,43][i] }));
export const storageTrend = [
  {day:'Apr 16',used:5.2,growth:2.2},{day:'Apr 17',used:5.6,growth:3.5},{day:'Apr 18',used:5.7,growth:3.2},{day:'Apr 19',used:6.1,growth:3.4},
  {day:'Apr 20',used:6.3,growth:4.2},{day:'Apr 21',used:6.1,growth:4.1},{day:'Apr 22',used:6.4,growth:4.0},{day:'Apr 23',used:7.3,growth:5.7},
];
export const traffic = usageTrend.map(({ time, cpu, memory }) => ({ time, inbound: cpu * 1.45, outbound: memory * 0.7 }));
export const serverAvailability = [
  {name:'Web Servers', count:'5/6', segments:[75,8,7,6,4]}, {name:'Database Servers',count:'2/2',segments:[83,5,4,5,3]},
  {name:'Application Servers',count:'3/3',segments:[72,10,7,6,5]}, {name:'Cache Servers',count:'1/1',segments:[85,5,4,3,3]},
  {name:'Other Servers',count:'2/2',segments:[68,12,8,7,5]},
];
export const alertSeverity = [{name:'Critical',value:5,color:'#f04452'},{name:'High',value:7,color:'#fa9238'},{name:'Medium',value:6,color:'#f4c83d'},{name:'Low',value:3,color:'#2684f5'},{name:'Info',value:2,color:'#16b8a2'}];
export const incidentStatus = [{name:'Open',value:1,color:'#f04452'},{name:'Investigating',value:1,color:'#fa9238'},{name:'Monitoring',value:1,color:'#2684f5'},{name:'Resolved',value:1,color:'#1fba79'}];
export const cpuServers = [
  {name:'prod-api-01',usage:82,color:'red',trend:'↑'},{name:'db-primary',usage:67,color:'amber',trend:'↑'},{name:'app-worker-02',usage:54,color:'yellow',trend:'→'},{name:'web-frontend-01',usage:43,color:'green',trend:'↓'},{name:'dev-vps-01',usage:32,color:'green',trend:'↓'},
];
export const memoryServers = [
  {name:'db-primary',usage:91,color:'red',trend:'↑'},{name:'prod-api-01',usage:78,color:'red',trend:'↑'},{name:'app-worker-02',usage:65,color:'yellow',trend:'→'},{name:'web-frontend-01',usage:52,color:'green',trend:'↓'},{name:'dev-vps-01',usage:38,color:'green',trend:'↓'},
];
export const backupServers = [
  {name:'prod-api-01',usage:92,free:'12 GB',color:'green'},{name:'db-primary',usage:87,free:'28 GB',color:'amber'},{name:'web-frontend-01',usage:76,free:'64 GB',color:'orange'},{name:'app-worker-02',usage:68,free:'82 GB',color:'green'},{name:'local-office',usage:54,free:'120 GB',color:'blue'},
];
export const latency = [
  {name:'api.example.com',latency:'8421 ms',trend:'↑ 1 min ago',color:'green'},{name:'payment-api',latency:'4321 ms',trend:'↑ 2 min ago',color:'blue'},{name:'user-service',latency:'4181 ms',trend:'→ 1 min ago',color:'amber'},{name:'web-frontend',latency:'Warning',trend:'5 min ago',color:'green'},{name:'internal-api',latency:'Healthy',trend:'1 min ago',color:'teal'},
];

export const navGroups = [
  {title:'Overview',items:[['Executive Overview','layout-dashboard'],['Infrastructure Dashboard','panels-top-left'],['Live Operations / NOC','radio'],['Global Health','globe-2']]},
  {title:'Infrastructure',items:[['All Servers','server'],['Server Groups','boxes'],['Server Details','square-terminal'],['Data Centers & Locations','map-pin'],['Network Devices','router'],['Containers & Docker','container'],['Cloud Accounts & Providers','cloud'],['Dependencies','workflow']]},
  {title:'Monitoring',items:[['Metrics Explorer','chart-no-axes-combined'],['CPU & Memory','cpu'],['Disk & Storage','database'],['Network Monitoring','activity'],['Processes & Services','workflow'],['Website & API Monitoring','globe'],['Database Monitoring','database'],['Logs Explorer','file-search'],['Events Explorer','calendar-days'],['Uptime & SLA Reports','chart-no-axes-column-increasing']]},
  {title:'Operations',items:[['Alerts','bell'],['Alert Rules','settings-2'],['Incidents','octagon-alert'],['Maintenance Windows','calendar-clock'],['Scheduled Tasks','calendar-check'],['Backups & Recovery','hard-drive-download'],['Runbooks','book-open']]},
  {title:'Security',items:[['Security Overview','shield-check'],['Authentication Events','fingerprint'],['Audit Logs','scroll-text'],['Configuration Changes','file-clock'],['Vulnerability & Patch Status','shield-alert'],['Certificates & Expiration','badge-check'],['Access Control','key-round']]},
];
