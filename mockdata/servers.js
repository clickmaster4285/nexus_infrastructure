export const serverStats = [
  { label: 'Total Servers', value: '12', change: '2 new', trend: 'up', tone: 'blue', icon: 'server' },
  { label: 'Online Servers', value: '10', change: '83% of total', trend: 'flat', tone: 'green', icon: 'online' },
  { label: 'Offline Servers', value: '1', change: '8% of total', trend: 'flat', tone: 'red', icon: 'offline' },
  { label: 'Degraded Servers', value: '1', change: '8% of total', trend: 'flat', tone: 'amber', icon: 'warning' },
  { label: 'Agent Healthy', value: '10 / 12', change: '83% healthy', trend: 'flat', tone: 'green', icon: 'shield' },
  { label: 'Pending Enrollment', value: '2', change: '17% pending', trend: 'flat', tone: 'blue', icon: 'pulse' },
];

export const servers = [
  { id:'srv-01', name:'prod-api-01', host:'api-01.example.com', ip:'10.10.1.10', publicIp:'54.210.12.34', os:'Ubuntu 22.04 LTS', environment:'Production', provider:'AWS', location:'Frankfurt, Germany', uptime:'14d 6h', agent:'Online', heartbeat:'2 min ago', cpu:24, memory:48, disk:62, network:'12.4 Mbps', health:'Healthy', alerts:0, tags:['api','production','backend'] },
  { id:'srv-02', name:'db-primary', host:'db-01.example.com', ip:'10.10.2.20', publicIp:'54.210.12.35', os:'Ubuntu 22.04 LTS', environment:'Production', provider:'Hetzner', location:'Helsinki, Finland', uptime:'21d 3h', agent:'Online', heartbeat:'1 min ago', cpu:18, memory:42, disk:55, network:'8.7 Mbps', health:'Healthy', alerts:0, tags:['database','production','primary'] },
  { id:'srv-03', name:'web-frontend-01', host:'web-01.example.com', ip:'10.10.1.15', publicIp:'54.210.12.41', os:'Ubuntu 22.04 LTS', environment:'Production', provider:'DigitalOcean', location:'London, UK', uptime:'7d 12h', cpu:36, memory:68, disk:47, network:'15.2 Mbps', agent:'Online', heartbeat:'2 min ago', health:'Healthy', alerts:1, tags:['web','production','frontend'] },
  { id:'srv-04', name:'app-worker-02', host:'worker-02.example.com', ip:'10.10.3.30', publicIp:'54.210.12.50', os:'Ubuntu 22.04 LTS', environment:'Staging', provider:'AWS', location:'Frankfurt, Germany', uptime:'5d 8h', cpu:42, memory:71, disk:73, network:'9.6 Mbps', agent:'Online', heartbeat:'3 min ago', health:'Degraded', alerts:2, tags:['worker','staging','queue'] },
  { id:'srv-05', name:'dev-vps-01', host:'dev-01.example.com', ip:'10.10.4.10', publicIp:'54.210.12.61', os:'Debian 12', environment:'Development', provider:'Hetzner', location:'Helsinki, Finland', uptime:'3d 2h', cpu:28, memory:54, disk:41, network:'6.3 Mbps', agent:'Online', heartbeat:'4 min ago', health:'Healthy', alerts:0, tags:['development','test'] },
  { id:'srv-06', name:'win-app-01', host:'win-app-01.example.com', ip:'10.10.5.50', publicIp:'54.210.12.70', os:'Windows Server 2022', environment:'Production', provider:'On-prem', location:'Islamabad, Pakistan', uptime:'12d 17h', cpu:22, memory:61, disk:58, network:'11.8 Mbps', agent:'Online', heartbeat:'2 min ago', health:'Healthy', alerts:1, tags:['windows','production'] },
  { id:'srv-07', name:'cache-server-01', host:'cache-01.example.com', ip:'10.10.1.25', publicIp:'54.210.12.76', os:'Ubuntu 22.04 LTS', environment:'Production', provider:'AWS', location:'Frankfurt, Germany', uptime:'18d 4h', cpu:15, memory:38, disk:33, network:'5.1 Mbps', agent:'Online', heartbeat:'3 min ago', health:'Healthy', alerts:0, tags:['cache','redis','production'] },
  { id:'srv-08', name:'local-office-01', host:'office-01.local', ip:'192.168.1.25', publicIp:'—', os:'Windows Server 2019', environment:'Office', provider:'On-prem', location:'Islamabad, Pakistan', uptime:'36d 9h', cpu:12, memory:36, disk:28, network:'2.4 Mbps', agent:'Offline', heartbeat:'1 hour ago', health:'Offline', alerts:3, tags:['office','file-server'] },
  { id:'srv-09', name:'test-runner-01', host:'runner-01.example.com', ip:'10.10.6.10', publicIp:'54.210.12.82', os:'Debian 12', environment:'Testing', provider:'DigitalOcean', location:'London, UK', uptime:'2d 11h', cpu:31, memory:46, disk:35, network:'4.9 Mbps', agent:'Online', heartbeat:'2 min ago', health:'Healthy', alerts:0, tags:['ci','testing'] },
  { id:'srv-10', name:'api-staging-01', host:'api-stg-01.example.com', ip:'10.10.3.11', publicIp:'54.210.12.90', os:'Ubuntu 22.04 LTS', environment:'Staging', provider:'AWS', location:'Frankfurt, Germany', uptime:'8d 1h', cpu:33, memory:58, disk:44, network:'7.2 Mbps', agent:'Online', heartbeat:'1 min ago', health:'Healthy', alerts:0, tags:['api','staging'] },
  { id:'srv-11', name:'monitor-node-01', host:'monitor-01.example.com', ip:'10.10.7.10', publicIp:'54.210.12.99', os:'Ubuntu 24.04 LTS', environment:'Production', provider:'DigitalOcean', location:'London, UK', uptime:'26d 5h', cpu:19, memory:40, disk:39, network:'3.8 Mbps', agent:'Pending', heartbeat:'Not enrolled', health:'Pending', alerts:0, tags:['monitoring','production'] },
  { id:'srv-12', name:'backup-node-02', host:'backup-02.example.com', ip:'10.10.8.12', publicIp:'54.210.12.110', os:'Ubuntu 22.04 LTS', environment:'Production', provider:'Hetzner', location:'Helsinki, Finland', uptime:'—', cpu:0, memory:0, disk:0, network:'—', agent:'Pending', heartbeat:'Not enrolled', health:'Pending', alerts:0, tags:['backup','production'] },
];

export const serverFilterOptions = {
  status: ['All', 'Online', 'Offline', 'Degraded', 'Pending'],
  operatingSystems: ['All', 'Ubuntu 22.04 LTS', 'Ubuntu 24.04 LTS', 'Debian 12', 'Windows Server 2022', 'Windows Server 2019'],
  environments: ['All', 'Production', 'Staging', 'Development', 'Testing', 'Office'],
  providers: ['All', 'AWS', 'Hetzner', 'DigitalOcean', 'On-prem'],
  groups: ['All', 'Web Servers', 'Application Servers', 'Database Servers', 'Infrastructure'],
  agents: ['All', 'Online', 'Offline', 'Pending'],
};

const serverNetworkPatterns = [
  [3, 5, 4, 7, 5, 6, 10, 7, 5, 8, 6, 9],
  [2, 4, 3, 5, 4, 8, 5, 7, 4, 6, 3, 7],
  [4, 6, 5, 9, 6, 8, 5, 10, 7, 8, 6, 9],
  [2, 3, 6, 4, 7, 5, 9, 6, 8, 5, 7, 10],
];

export const serverNetworkTrends = Object.fromEntries(
  servers.map((server, index) => [server.id, serverNetworkPatterns[index % serverNetworkPatterns.length]]),
);
