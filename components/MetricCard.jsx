import { ArrowDown, ArrowUp } from 'lucide-react';
import Icon from './Icon';

export default function MetricCard({ item }) {
  const down = item.trend === 'down';
  return (
    <article className="metric-card">
      <div className={`metric-icon ${item.tone}`}><Icon name={item.icon} size={20} /></div>
      <div className="metric-copy">
        <div className="metric-label">{item.label}</div>
        <div className="metric-value">{item.value}</div>
        <div className={`metric-change ${item.trend}`}>
          {item.trend !== 'flat' && (down ? <ArrowDown size={12} /> : <ArrowUp size={12} />)} {item.change}
        </div>
        {item.detail && <div className={`metric-detail ${item.detailTone || ''}`}><i />{item.detail}</div>}
      </div>
    </article>
  );
}
