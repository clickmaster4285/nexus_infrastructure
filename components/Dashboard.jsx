'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import DonutPanel from './DonutPanel';
import AllServersDashboard from './AllServersDashboard';
import Header from './Header';
import InfrastructureDashboard from './InfrastructureDashboard';
import MetricCard from './MetricCard';
import ServerTable from './ServerTable';
import Sidebar from './Sidebar';
import { AvailabilityPanel, HealthTrendPanel, NetworkTrafficPanel, StoragePanel, UsagePanel } from './ChartPanels';
import { alertSeverity, backupServers, cpuServers, incidentStatus, latency, memoryServers, navGroups, stats } from '@/mockdata/dashboard';

function routeSlug(label) {
  return label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const dashboardPages = [
  'Executive Overview',
  ...navGroups.flatMap(group => group.items.map(([label]) => label)),
];

export default function Dashboard() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const currentSlug = pathname.split('/').filter(Boolean).at(-1) || routeSlug('Executive Overview');
  const active = dashboardPages.find(label => routeSlug(label) === currentSlug) || 'Executive Overview';

  function navigate(label) {
    router.push(`/${routeSlug(label)}`);
    setMobileOpen(false);
  }

  return (
    <div className={`dashboard ${dark ? 'dark-mode' : ''}`}>
      <Sidebar active={active} onNavigate={navigate} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="main-area">
        <Header onMenu={() => setMobileOpen(true)} dark={dark} onThemeToggle={() => setDark(value => !value)} />
        <main className="content">
          {active === 'Infrastructure Dashboard' ? <InfrastructureDashboard /> : active === 'All Servers' ? <AllServersDashboard onNavigate={navigate} /> : <>
            <div className="page-meta">
              <div className="breadcrumb"><span>⌂</span><span>/</span><span>Overview</span></div>
              <div className="updated"><span className="demo-badge">DEMO DATA</span><span>Last updated: Apr 23, 2025 14:32</span><button className="icon-btn" aria-label="Refresh timestamp"><RefreshCw size={13} /></button></div>
            </div>
            <div className="page-heading"><h1>{active}</h1><p>Complete view of your infrastructure health and performance</p></div>

            <section className="metrics-grid">{stats.map(item => <MetricCard item={item} key={item.label} />)}</section>
            <section className="charts-grid"><HealthTrendPanel /><UsagePanel /><StoragePanel /></section>
            <section className="secondary-grid">
              <NetworkTrafficPanel /><AvailabilityPanel />
              <DonutPanel title="Alerts by Severity" data={alertSeverity} total={23} />
              <DonutPanel title="Incidents by Status" data={incidentStatus} total={4} range="7d" />
            </section>
            <section className="tables-grid">
              <ServerTable title="Top CPU Consuming Servers" rows={cpuServers} kind="metric" />
              <ServerTable title="Top Memory Consuming Servers" rows={memoryServers} kind="metric" />
              <ServerTable title="Lowest Backup Capacity" rows={backupServers} kind="backup" />
              <ServerTable title="Highest Response Latency" rows={latency} kind="latency" />
            </section>
          </>}
          <footer className="footer"><span>© 2025 Nexus Infrastructure Monitor</span><span>All systems operational <i /></span></footer>
        </main>
      </div>
    </div>
  );
}
