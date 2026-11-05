'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import Panel from './Panel';

const tooltipStyle = { contentStyle: { border: '1px solid #e5eaf2', borderRadius: 8, fontSize: 12 } };

export default function DonutPanel({ title, data, total, range, totalLabel = 'Total', action, className = '' }) {
  return (
    <Panel title={title} range={range} action={action} className={className}>
      <div className="donut-content">
        <div className="donut-chart">
          <ResponsiveContainer width="100%" height="100%"><PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="63%" outerRadius="88%" paddingAngle={1} stroke="none">
              {data.map(item => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart></ResponsiveContainer>
          <div className="donut-center"><b>{total}</b><span>{totalLabel}</span></div>
        </div>
        <div className="donut-legend">{data.map(item => (
          <div className="legend-row" key={item.name}><i style={{ background: item.color }} /><span>{item.name}</span><span>{item.value} <em>({Math.round(item.value / total * 100)}%)</em></span></div>
        ))}</div>
      </div>
    </Panel>
  );
}
