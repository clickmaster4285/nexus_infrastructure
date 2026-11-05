import { MoreVertical } from 'lucide-react';

export default function Panel({ title, children, range, className = '', action, showOptions = true }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <h2>{title}</h2>
        <div className="panel-actions">
          {action}
          {range && <select className="range-select" defaultValue={range} aria-label={`${title} time range`}>
            <option>24h</option><option>7d</option><option>30d</option>
          </select>}
          {showOptions && <button className="icon-btn more" aria-label={`${title} options`}><MoreVertical size={16} /></button>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Legend({ items }) {
  return <div className="legend">{items.map(item => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}</div>;
}
