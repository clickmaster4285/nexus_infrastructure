import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import Panel from './Panel';

export default function ServerTable({ title, rows, kind }) {
  const metricLabel = title.includes('CPU') ? 'CPU Usage' : 'Memory Usage';
  const linkLabel = kind === 'metric' ? 'servers' : kind === 'backup' ? 'backups' : 'collectors';

  return (
    <Panel title={title} className="table-panel">
      <table className={`server-table ${kind}`}><thead><tr>
        {kind === 'metric' ? <><th>Server</th><th>{metricLabel}</th><th className="trend-col">Trend</th></> : kind === 'backup' ? <><th>Server</th><th>Free Space</th><th>Usage</th></> : <><th>Service</th><th>Latency</th><th className="trend-col">Trend</th></>}
      </tr></thead><tbody>{rows.map(row => (
        <tr key={row.name}>
          <td className="name-col"><span className={`status-dot ${row.color}`} />{row.name}</td>
          {kind === 'metric' ? <><td className={`metric-col ${row.color}`}>{row.usage}%</td><td className="trend-col trend-indicator"><span className={`trend-arrow ${row.trend === '↑' ? 'up' : row.trend === '↓' ? 'down' : 'stable'}`} aria-label={row.trend === '→' ? 'Stable' : row.trend === '↑' ? 'Increasing' : 'Decreasing'}>{row.trend === '↑' ? <ArrowUp size={15} strokeWidth={2.6} /> : row.trend === '↓' ? <ArrowDown size={15} strokeWidth={2.6} /> : <span className="trend-stable" aria-hidden="true"><ArrowRight size={16} strokeWidth={2.6} /></span>}</span></td></>
            : kind === 'backup' ? <><td className="metric-col">{row.free}</td><td className={`usage-col ${row.color}`}>{row.usage}%</td></>
              : <><td className={`metric-col ${row.color === 'green' || row.color === 'teal' ? 'green-text' : row.color === 'amber' ? 'amber-text' : 'blue-text'}`}>{row.latency}</td><td className="trend-col trend-note">{row.trend}</td></>}
        </tr>
      ))}</tbody></table>
      <button className="table-link">View all {linkLabel} <ArrowRight size={13} /></button>
    </Panel>
  );
}
