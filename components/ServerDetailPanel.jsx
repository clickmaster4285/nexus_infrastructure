import { useEffect, useRef, useState } from 'react';
import { Activity, Bell, ChevronDown, Clock3, FileText, MoreVertical, Pencil, Server, ShieldCheck, Workflow, X } from 'lucide-react';
import Panel from './Panel';

function StatusPill({ status }) {
  const tone = status === 'Healthy' || status === 'Online' ? 'green' : status === 'Degraded' ? 'amber' : status === 'Offline' ? 'red' : 'blue';
  return <span className={`server-status-pill ${tone}`}><i />{status}</span>;
}

export default function ServerDetailPanel({ server, onClose, onNavigate, onExport }) {
  const [view, setView] = useState('Details');
  const [message, setMessage] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) setOptionsOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOptionsOpen(false);
        onClose?.();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  function chooseView(nextView) {
    setView(nextView);
    setMessage('');
  }

  if (!server) return null;

  const menu = <div className="server-detail-menu-wrap" ref={menuRef}>
    <button type="button" className="icon-btn more" aria-label="Server details options" aria-haspopup="menu" aria-expanded={optionsOpen} onClick={() => setOptionsOpen(value => !value)}><MoreVertical size={16} /></button>
    {optionsOpen && <div className="server-detail-menu" role="menu">
      <button type="button" role="menuitem" onClick={async () => { try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(server.name); setMessage(`Copied ${server.name}`); } catch { setMessage('Clipboard access is unavailable'); } setOptionsOpen(false); }}>Copy server name</button>
      <button type="button" role="menuitem" onClick={() => { onExport?.(server); setOptionsOpen(false); }}>Export server</button>
      <button type="button" role="menuitem" onClick={() => { onClose?.(); setOptionsOpen(false); }}>Close panel</button>
    </div>}
  </div>;
  return <Panel title="Server Details" className="server-detail-panel" showOptions={false} action={<>{menu}<button type="button" className="server-detail-close" onClick={onClose} aria-label="Close server details"><X size={16} /></button></>}>
    <div className="server-detail-identity"><span className="detail-server-icon"><Server size={19} /></span><div><b>{server.name}</b><small>{server.host}</small></div></div>
    <div className="server-detail-online"><StatusPill status={server.agent === 'Online' ? 'Online' : server.agent} /></div>
    <div className="server-detail-tabs" role="tablist" aria-label="Server information"><button type="button" role="tab" aria-selected={view === 'Details'} className={view === 'Details' ? 'active' : ''} onClick={() => chooseView('Details')}>Details</button><button type="button" role="tab" aria-selected={view === 'Metrics'} className={view === 'Metrics' ? 'active' : ''} onClick={() => chooseView('Metrics')}>Metrics</button></div>

    {view === 'Details' ? <>
      <dl className="server-facts">
        <div><dt>OS</dt><dd>{server.os}</dd></div>
        <div><dt>Environment</dt><dd>{server.environment}</dd></div>
        <div><dt>Provider</dt><dd>{server.provider}</dd></div>
        <div><dt>Location</dt><dd>{server.location}</dd></div>
        <div><dt>Uptime</dt><dd>{server.uptime}</dd></div>
        <div><dt>Agent</dt><dd>{server.agent} <small>({server.heartbeat})</small></dd></div>
        <div><dt>IP Addresses</dt><dd>{server.ip} (private)<br />{server.publicIp} (public)</dd></div>
      </dl>
      <div className="server-health-row"><span><b>Health Status</b><StatusPill status={server.health} /></span><button type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen(value => !value)}>History <ChevronDown size={12} /></button></div>
      {historyOpen && <div className="server-health-history"><span>Current status: <b>{server.health}</b></span><span>Last heartbeat: {server.heartbeat}</span><span>Uptime: {server.uptime}</span></div>}
      <div className="server-tags-row"><b>Tags</b><div>{server.tags.map(tag => <span key={tag}>{tag}</span>)}{server.tags.length > 2 && <span>+{server.tags.length - 2}</span>}</div></div>
      <div className="server-primary-actions"><button type="button" onClick={() => chooseView('Details')}>View Details</button><button type="button" onClick={() => chooseView('Metrics')}>View Metrics</button></div>
      <div className="quick-actions"><h3>Quick Actions</h3>
        <button type="button" onClick={() => onNavigate?.('Logs Explorer')}><FileText size={13} />View Logs</button>
        <button type="button" onClick={() => onNavigate?.('Alerts')}><Bell size={13} />View Alerts <span>({server.alerts})</span></button>
        <button type="button" onClick={() => onNavigate?.('Processes & Services')}><Workflow size={13} />View Services</button>
        <button type="button" onClick={() => onNavigate?.('Incidents')}><Activity size={13} />Open Incidents</button>
        <button type="button" onClick={() => onNavigate?.('Server Details')}><Pencil size={13} />Edit Server</button>
        <button type="button" onClick={() => setOptionsOpen(value => !value)}><MoreVertical size={13} />More Actions</button>
      </div>
    </> : <div className="detail-metrics">
      <div className="detail-metric"><span>CPU Usage</span><b>{server.cpu}%</b><i><em style={{ width: `${server.cpu}%` }} /></i></div>
      <div className="detail-metric"><span>Memory Usage</span><b>{server.memory}%</b><i><em className="purple" style={{ width: `${server.memory}%` }} /></i></div>
      <div className="detail-metric"><span>Disk Usage</span><b>{server.disk}%</b><i><em className="amber" style={{ width: `${server.disk}%` }} /></i></div>
      <div className="detail-metric"><span>Network</span><b>{server.network}</b><small>Latest throughput</small></div>
      <div className="detail-metric"><span>Uptime</span><b>{server.uptime}</b><small><Clock3 size={12} /> Last heartbeat {server.heartbeat}</small></div>
      <div className="server-health-note"><ShieldCheck size={14} />{server.health} health status</div>
    </div>}
    {message && <div className="server-action-message" role="status">{message}</div>}
  </Panel>;
}
