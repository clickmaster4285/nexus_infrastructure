'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import DonutPanel from './DonutPanel';
import MetricCard from './MetricCard';
import {
  AssetsEnvironmentPanel, InfrastructureEventsPanel, InfrastructureHealthPanel, TopologyPanel, UnmonitoredAssetsPanel,
} from './InfrastructurePanels';
import { infrastructureStats, providerDistribution } from '@/mockdata/infrastructure';

export default function InfrastructureDashboard() {
  const router = useRouter();
  const [environment, setEnvironment] = useState('All Environments');
  const [provider, setProvider] = useState('All Providers');
  const [groupBy, setGroupBy] = useState('Location');

  return (
    <>
      <div className="page-meta infra-page-meta">
        <div className="breadcrumb"><span>⌂</span><span>/</span><span>Infrastructure</span><span>/</span><span>Infrastructure Dashboard</span></div>
        <div className="updated"><span className="demo-badge">DEMO DATA</span><span>Last updated: Apr 23, 2025 14:32</span><button className="icon-btn" aria-label="Refresh timestamp"><RefreshCw size={13} /></button></div>
      </div>
      <div className="infra-page-title-row">
        <div className="page-heading"><h1>Infrastructure Dashboard</h1><p>Global infrastructure topology and resource health</p></div>
        <div className="infra-filters">
          <select aria-label="Filter by environment" value={environment} onChange={event => setEnvironment(event.target.value)}>
            <option>All Environments</option><option>Production</option><option>Staging</option><option>Development</option><option>Testing</option>
          </select>
          <select aria-label="Filter by provider" value={provider} onChange={event => setProvider(event.target.value)}>
            <option>All Providers</option><option>AWS</option><option>DigitalOcean</option><option>Hetzner</option><option>On-Prem</option>
          </select>
          <select aria-label="Group assets by" value={groupBy} onChange={event => setGroupBy(event.target.value)}>
            <option value="Location">Group by: Location</option><option value="Environment">Group by: Environment</option><option value="Provider">Group by: Provider</option><option value="Type">Group by: Type</option>
          </select>
        </div>
      </div>

      <section className="metrics-grid infra-metrics-grid">{infrastructureStats.map(item => <MetricCard item={item} key={item.label} />)}</section>

      <section className="infra-main-grid">
        <TopologyPanel />
        <InfrastructureHealthPanel onAlertSelect={severity => router.push(severity ? `/alerts?severity=${severity}` : '/alerts')} />
      </section>

      <section className="infra-bottom-grid">
        <AssetsEnvironmentPanel />
        <DonutPanel title="Provider Distribution" data={providerDistribution} total={48} totalLabel="Total Assets" className="provider-distribution-panel" />
        <InfrastructureEventsPanel />
        <UnmonitoredAssetsPanel />
      </section>
    </>
  );
}
