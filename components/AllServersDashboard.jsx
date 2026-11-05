'use client';

import { useMemo, useState } from 'react';
import { Download, Plus, Search, Server, MoreVertical, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { siDebian } from 'simple-icons';
import MetricCard from './MetricCard';
import Panel from './Panel';
import { LocationFlag, ProviderLogo } from './ProviderLogo';
import ServerDetailPanel from './ServerDetailPanel';
import { serverFilterOptions, serverNetworkTrends, serverStats, servers as initialServers } from '@/mockdata/servers';

const PAGE_SIZE = 8;

function StatusPill({ status }) {
  const tone = status === 'Healthy' ? 'green' : status === 'Degraded' ? 'amber' : status === 'Offline' ? 'red' : 'blue';
  return <span className={`server-status-pill ${tone}`}><i />{status}</span>;
}

function UsageCell({ value, tone = 'blue' }) {
  return <div className="server-usage-cell"><span className={`server-usage-bar ${tone}`}><i style={{ width: `${value}%` }} /></span><small>{value}%</small></div>;
}

function NetworkCell({ server }) {
  const values = serverNetworkTrends[server.id] || serverNetworkTrends['srv-01'];
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 38},${13 - value}`).join(' ');
  return <span className="network-cell"><svg viewBox="0 0 38 14" role="img" aria-label={`${server.name} network trend`}><polyline points={points} /></svg><small>{server.network}</small></span>;
}

function OperatingSystem({ os }) {
  const type = os.startsWith('Windows') ? 'windows' : os.startsWith('Debian') ? 'debian' : 'ubuntu';
  return <span className="server-os"><OperatingSystemLogo type={type} /><span>{os}</span></span>;
}

function OperatingSystemLogo({ type }) {
  if (type === 'windows') return <svg className="server-os-logo windows" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 5.1 10.6 3.9v7.8H2V5.1Zm10.1-1.4L22 2v9.7h-9.9V3.7ZM2 12.9h8.6v7.8L2 19.5v-6.6Zm10.1 0H22v9.7l-9.9-1.7v-8Z" fill="currentColor" /></svg>;
  if (type === 'debian') return <svg className="server-os-logo debian" viewBox="0 0 24 24" aria-hidden="true"><path d={siDebian.path} fill="currentColor" /></svg>;
  return <svg className="server-os-logo ubuntu" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="white" strokeWidth="1.7"/><path d="M12 6.8v2.2m4.5 2.6-1.9 1.1m-8.1-1.1 1.9 1.1" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round"/><circle cx="12" cy="4.4" r="1.6" fill="white"/><circle cx="18.6" cy="15.8" r="1.6" fill="white"/><circle cx="5.4" cy="15.8" r="1.6" fill="white"/></svg>;
}

export default function AllServersDashboard({ onNavigate }) {
  const [servers, setServers] = useState(initialServers);
  const [activeServerId, setActiveServerId] = useState(initialServers[0].id);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: 'All', os: 'All', environment: 'All', provider: 'All', group: 'All', agent: 'All' });
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newEnvironment, setNewEnvironment] = useState('Production');

  const filteredServers = useMemo(() => servers.filter(server => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [server.name, server.host, server.ip, server.publicIp].some(value => value?.toLowerCase().includes(term));
    const matchesStatus = filters.status === 'All' || (filters.status === 'Online' ? server.agent === 'Online' : filters.status === 'Offline' ? server.health === 'Offline' : server.health === filters.status);
    const matchesOs = filters.os === 'All' || server.os === filters.os;
    const matchesEnvironment = filters.environment === 'All' || server.environment === filters.environment;
    const matchesProvider = filters.provider === 'All' || server.provider === filters.provider;
    const group = server.name.startsWith('web-') ? 'Web Servers' : server.name.startsWith('db-') ? 'Database Servers' : /api|app|worker/.test(server.name) ? 'Application Servers' : 'Infrastructure';
    const matchesGroup = filters.group === 'All' || group === filters.group;
    const matchesAgent = filters.agent === 'All' || server.agent === filters.agent;
    return matchesSearch && matchesStatus && matchesOs && matchesEnvironment && matchesProvider && matchesGroup && matchesAgent;
  }), [servers, search, filters]);

  const pageCount = Math.max(1, Math.ceil(filteredServers.length / PAGE_SIZE));
  const visibleServers = filteredServers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeServer = detailsOpen ? (servers.find(server => server.id === activeServerId) || filteredServers[0] || null) : null;
  const selectedOnPage = visibleServers.length > 0 && visibleServers.every(server => selectedRows.includes(server.id));
  const onlineCount = servers.filter(server => server.agent === 'Online').length;
  const offlineCount = servers.filter(server => server.health === 'Offline').length;
  const degradedCount = servers.filter(server => server.health === 'Degraded').length;
  const pendingCount = servers.filter(server => server.agent === 'Pending').length;
  const healthyPercent = servers.length ? Math.round(onlineCount / servers.length * 100) : 0;
  const pendingPercent = servers.length ? Math.round(pendingCount / servers.length * 100) : 0;
  const metricCards = serverStats.map(item => ({
    ...item,
    ...(item.label === 'Total Servers' ? { value: String(servers.length) } : {}),
    ...(item.label === 'Online Servers' ? { value: String(onlineCount), change: `${healthyPercent}% of total` } : {}),
    ...(item.label === 'Offline Servers' ? { value: String(offlineCount), change: `${servers.length ? Math.round(offlineCount / servers.length * 100) : 0}% of total` } : {}),
    ...(item.label === 'Degraded Servers' ? { value: String(degradedCount), change: `${servers.length ? Math.round(degradedCount / servers.length * 100) : 0}% of total` } : {}),
    ...(item.label === 'Agent Healthy' ? { value: `${onlineCount} / ${servers.length}`, change: `${healthyPercent}% healthy` } : {}),
    ...(item.label === 'Pending Enrollment' ? { value: String(pendingCount), change: `${pendingPercent}% pending` } : {}),
  }));

  function updateFilter(key, value) {
    setFilters(current => ({ ...current, [key]: value }));
    setPage(1);
  }

  function toggleSelected(id) {
    setSelectedRows(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  function openServerDetails(id) {
    setActiveServerId(id);
    setDetailsOpen(true);
  }

  function exportCsv() {
    const headers = ['Server', 'Hostname', 'OS', 'Environment', 'Provider', 'Location', 'CPU', 'Memory', 'Disk', 'Network', 'Uptime', 'Agent', 'Health', 'Alerts'];
    const rows = filteredServers.map(server => [server.name, server.host, server.os, server.environment, server.provider, server.location, `${server.cpu}%`, `${server.memory}%`, `${server.disk}%`, server.network, server.uptime, server.agent, server.health, server.alerts]);
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'nexus-servers.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportServerCsv(server) {
    const headers = ['Server', 'Hostname', 'OS', 'Environment', 'Provider', 'Location', 'CPU', 'Memory', 'Disk', 'Network', 'Uptime', 'Agent', 'Health', 'Alerts'];
    const row = [server.name, server.host, server.os, server.environment, server.provider, server.location, `${server.cpu}%`, `${server.memory}%`, `${server.disk}%`, server.network, server.uptime, server.agent, server.health, server.alerts];
    const csv = [headers, row].map(values => values.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `${server.name}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function addServer(event) {
    event.preventDefault();
    const name = newServerName.trim();
    if (!name) return;
    const template = initialServers[0];
    const created = { ...template, id: `srv-${Date.now()}`, name, host: `${name}.example.com`, ip: '10.10.9.10', publicIp: 'Pending', environment: newEnvironment, provider: 'AWS', location: 'Frankfurt, Germany', uptime: '—', agent: 'Pending', heartbeat: 'Not enrolled', cpu: 0, memory: 0, disk: 0, network: '—', health: 'Pending', alerts: 0, tags: [newEnvironment.toLowerCase(), 'new'] };
    setServers(current => [created, ...current]);
    setActiveServerId(created.id);
    setDetailsOpen(true);
    setSearch('');
    setFilters({ status: 'All', os: 'All', environment: 'All', provider: 'All', group: 'All', agent: 'All' });
    setPage(1);
    setShowAddForm(false);
    setNewServerName('');
  }

  function handleRowKey(event, id) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openServerDetails(id);
    }
  }

  return <>
    <div className={`all-servers-layout ${detailsOpen ? 'with-server-details' : ''}`}>
      <div className="all-servers-main">
    <div className="page-meta servers-page-meta">
      <div className="breadcrumb"><span>⌂</span><span>/</span><span>Infrastructure</span><span>/</span><span>All Servers</span></div>
      <div className="updated"><span className="demo-badge">DEMO DATA</span><span>Last updated: Apr 23, 2025 14:32</span></div>
    </div>
    <div className="page-heading"><h1>All Servers</h1><p>Monitor and manage your infrastructure fleet</p></div>

    <section className="metrics-grid server-metrics-grid">{metricCards.map(item => <MetricCard item={item} key={item.label} />)}</section>

    <section className="server-workspace">
      <Panel title="Servers" className="server-list-panel">
        <div className="server-toolbar">
          <label className="server-search"><Search size={15} /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search servers, hostnames or IP addresses..." /></label>
          <select aria-label="Filter by status" value={filters.status} onChange={event => updateFilter('status', event.target.value)}>{serverFilterOptions.status.map(value => <option key={value}>{value}</option>)}</select>
          <select aria-label="Filter by operating system" value={filters.os} onChange={event => updateFilter('os', event.target.value)}>{serverFilterOptions.operatingSystems.map(value => <option key={value} value={value}>{value === 'All' ? 'OS  All' : value}</option>)}</select>
          <select aria-label="Filter by environment" value={filters.environment} onChange={event => updateFilter('environment', event.target.value)}>{serverFilterOptions.environments.map(value => <option key={value} value={value}>{value === 'All' ? 'Environment  All' : value}</option>)}</select>
          <select aria-label="Filter by provider" value={filters.provider} onChange={event => updateFilter('provider', event.target.value)}>{serverFilterOptions.providers.map(value => <option key={value} value={value}>{value === 'All' ? 'Provider  All' : value}</option>)}</select>
          <select aria-label="Filter by server group" value={filters.group} onChange={event => updateFilter('group', event.target.value)}>{serverFilterOptions.groups.map(value => <option key={value} value={value}>{value === 'All' ? 'Server Group  All' : value}</option>)}</select>
          <select aria-label="Filter by agent" value={filters.agent} onChange={event => updateFilter('agent', event.target.value)}>{serverFilterOptions.agents.map(value => <option key={value} value={value}>{value === 'All' ? 'Agent  All' : value}</option>)}</select>
          <div className="server-toolbar-actions"><button className="add-server-button" type="button" onClick={() => setShowAddForm(true)}><Plus size={14} />Add Server</button><button className="export-server-button" type="button" onClick={exportCsv}><Download size={14} />Export</button></div>
        </div>

        <div className="server-table-scroll"><table className="all-servers-table"><colgroup><col className="server-col-select"/><col className="server-col-name"/><col className="server-col-os"/><col className="server-col-env"/><col className="server-col-provider"/><col className="server-col-metric"/><col className="server-col-metric"/><col className="server-col-metric"/><col className="server-col-network"/><col className="server-col-uptime"/><col className="server-col-agent"/><col className="server-col-health"/><col className="server-col-alerts"/><col className="server-col-actions"/></colgroup><thead><tr>
          <th><input aria-label="Select all visible servers" type="checkbox" checked={selectedOnPage} onChange={() => setSelectedRows(current => selectedOnPage ? current.filter(id => !visibleServers.some(server => server.id === id)) : [...new Set([...current, ...visibleServers.map(server => server.id)])])} /></th>
          <th>Server / Hostname</th><th>Operating System</th><th>Environment</th><th>Provider / Location</th><th>CPU</th><th>Memory</th><th>Disk</th><th>Network</th><th>Uptime</th><th>Agent / Heartbeat</th><th>Health</th><th>Alerts</th><th>Actions</th>
        </tr></thead><tbody>{visibleServers.map(server => <tr key={server.id} tabIndex={0} aria-selected={activeServer?.id === server.id} className={activeServer?.id === server.id ? 'active-server-row' : ''} onClick={() => openServerDetails(server.id)} onKeyDown={event => handleRowKey(event, server.id)}>
          <td onClick={event => event.stopPropagation()}><input aria-label={`Select ${server.name}`} type="checkbox" checked={selectedRows.includes(server.id)} onChange={() => toggleSelected(server.id)} /></td>
          <td><button type="button" className="server-name-button" onClick={event => { event.stopPropagation(); openServerDetails(server.id); }}><b>{server.name}</b><small>{server.host}</small><small>{server.ip}</small></button></td>
          <td><OperatingSystem os={server.os} /></td>
          <td><span className={`environment-pill ${server.environment.toLowerCase()}`}>{server.environment}</span></td>
          <td><div className="provider-location"><b><ProviderLogo provider={server.provider} />{server.provider}</b><small><LocationFlag location={server.location} />{server.location.split(',')[0]}</small></div></td>
          <td><UsageCell value={server.cpu} /></td><td><UsageCell value={server.memory} tone="green" /></td><td><UsageCell value={server.disk} tone="amber" /></td>
          <td><NetworkCell server={server} /></td><td className="uptime-cell">{server.uptime}</td>
          <td><div className={`agent-cell ${server.agent.toLowerCase()}`}><i />{server.agent}<small>{server.heartbeat}</small></div></td>
          <td><StatusPill status={server.health} /></td><td className={`alert-count ${server.alerts ? 'has-alerts' : ''}`}>{server.alerts}</td>
          <td onClick={event => event.stopPropagation()}><button className="icon-btn server-row-menu" aria-label={`Actions for ${server.name}`}><MoreVertical size={15} /></button></td>
        </tr>)}</tbody></table>{visibleServers.length === 0 && <div className="server-empty-state"><Server size={20} /><b>No servers match these filters</b><span>Change the search or filter selections.</span></div>}</div>

        <div className="server-table-footer"><span>{selectedRows.length} of {filteredServers.length} selected</span><select aria-label="Bulk actions" disabled={!selectedRows.length} defaultValue=""><option value="">Bulk Actions</option><option>Export selected</option><option>Clear selection</option></select><div className="server-pagination"><label>Rows per page <select value={PAGE_SIZE} aria-label="Rows per page" disabled><option value={PAGE_SIZE}>{PAGE_SIZE}</option></select></label><span>{filteredServers.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, filteredServers.length)} of {filteredServers.length}</span><button type="button" aria-label="First page" disabled={page <= 1} onClick={() => setPage(1)}><ChevronFirst size={14} /></button><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={14} /></button><b>{page}</b><button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}><ChevronRight size={14} /></button><button type="button" aria-label="Last page" disabled={page >= pageCount} onClick={() => setPage(pageCount)}><ChevronLast size={14} /></button></div></div>
      </Panel>
    </section>
      </div>
      {detailsOpen && <ServerDetailPanel server={activeServer} onClose={() => setDetailsOpen(false)} onNavigate={onNavigate} onExport={exportServerCsv} />}
    </div>

    {showAddForm && <div className="server-modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setShowAddForm(false); }}>
      <form className="server-add-modal" onSubmit={addServer} aria-labelledby="add-server-title"><button type="button" className="server-modal-close" onClick={() => setShowAddForm(false)} aria-label="Close"><X size={17} /></button><h2 id="add-server-title">Add Server</h2><p>Add a demo server to the mock inventory.</p><label>Server name<input autoFocus required value={newServerName} onChange={event => setNewServerName(event.target.value)} placeholder="e.g. prod-api-02" /></label><label>Environment<select value={newEnvironment} onChange={event => setNewEnvironment(event.target.value)}>{serverFilterOptions.environments.filter(value => value !== 'All').map(value => <option key={value}>{value}</option>)}</select></label><div><button type="button" onClick={() => setShowAddForm(false)}>Cancel</button><button type="submit">Add Server</button></div></form>
    </div>}
  </>;
}
