'use client';

import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Panel, { Legend } from './Panel';
import { healthTrend, serverAvailability, storageTrend, traffic, usageTrend } from '@/mockdata/dashboard';

const tooltip = { contentStyle: { border: '1px solid #e5eaf2', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 14px #14284712' }, labelStyle: { color: '#64748b', marginBottom: 4 } };
const axis = { tick: { fill: '#718198', fontSize: 10 }, axisLine: { stroke: '#e5eaf2' }, tickLine: false };

function TrendChart({ data, keys, colors }) {
  return <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 6, right: 5, left: -16, bottom: 0 }}>
    <defs>{keys.map((key, index) => <linearGradient id={`fill-${key}`} key={key} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors[index]} stopOpacity={.13} /><stop offset="100%" stopColor={colors[index]} stopOpacity={.01} /></linearGradient>)}</defs>
    <CartesianGrid stroke="#edf0f5" vertical={false} /><XAxis dataKey="time" tickCount={7} interval={1} {...axis} /><YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} ticks={[0, 25, 50, 75, 100]} {...axis} /><Tooltip {...tooltip} />
    {keys.map((key, index) => <Area key={key} type="monotone" dataKey={key} stroke={colors[index]} strokeWidth={2} fill={`url(#fill-${key})`} dot={false} activeDot={{ r: 3 }} />)}
  </AreaChart></ResponsiveContainer></div>;
}

export function HealthTrendPanel() {
  const colors = ['#27b974', '#f2b51c', '#f04452'];
  return <Panel title="Infrastructure Health Trend" range="24h"><TrendChart data={healthTrend} keys={['healthy', 'warning', 'critical']} colors={colors} /><Legend items={[{ name: 'Healthy', color: colors[0] }, { name: 'Warning', color: colors[1] }, { name: 'Critical', color: colors[2] }]} /></Panel>;
}

export function UsagePanel() {
  const colors = ['#288af0', '#a647e8'];
  return <Panel title="CPU & Memory Usage" range="24h"><TrendChart data={usageTrend} keys={['cpu', 'memory']} colors={colors} /><Legend items={[{ name: 'CPU Usage', color: colors[0] }, { name: 'Memory Usage', color: colors[1] }]} /></Panel>;
}

export function StoragePanel() {
  return <Panel title="Disk Usage & Storage Growth" range="7d">
    <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={storageTrend} margin={{ top: 6, right: 4, left: -16, bottom: 0 }}>
      <CartesianGrid stroke="#edf0f5" vertical={false} /><XAxis dataKey="day" tick={{ fill: '#718198', fontSize: 9 }} axisLine={{ stroke: '#e5eaf2' }} tickLine={false} />
      <YAxis yAxisId="left" domain={[0, 8]} ticks={[0, 2, 4, 6, 8]} tickFormatter={value => `${value} TB`} {...axis} /><YAxis yAxisId="right" orientation="right" hide domain={[0, 8]} />
      <Tooltip {...tooltip} /><Bar yAxisId="left" dataKey="used" fill="#398cf0" radius={[2, 2, 0, 0]} barSize={15} /><Line yAxisId="right" dataKey="growth" stroke="#28bf77" strokeWidth={1.7} dot={{ r: 2.5, fill: '#28bf77' }} />
    </ComposedChart></ResponsiveContainer></div>
    <Legend items={[{ name: 'Used Space', color: '#288af0' }, { name: 'Growth', color: '#28bf77' }]} />
  </Panel>;
}

export function NetworkTrafficPanel() {
  return <Panel title="Network Traffic" range="24h">
    <div className="chart-wrap small-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={traffic} margin={{ top: 5, right: 4, left: -16, bottom: 0 }}>
      <defs><linearGradient id="inbound" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#288af0" stopOpacity={.15} /><stop offset="100%" stopColor="#288af0" stopOpacity={0} /></linearGradient><linearGradient id="outbound" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a647e8" stopOpacity={.13} /><stop offset="100%" stopColor="#a647e8" stopOpacity={0} /></linearGradient></defs>
      <CartesianGrid stroke="#edf0f5" vertical={false} /><XAxis dataKey="time" tickCount={7} interval={1} {...axis} /><YAxis domain={[0, 150]} ticks={[0, 50, 100, 150]} tickFormatter={value => `${value} Mbps`} {...axis} /><Tooltip {...tooltip} />
      <Area type="monotone" dataKey="inbound" stroke="#288af0" fill="url(#inbound)" strokeWidth={2} dot={false} /><Area type="monotone" dataKey="outbound" stroke="#a647e8" fill="url(#outbound)" strokeWidth={2} dot={false} />
    </AreaChart></ResponsiveContainer></div>
    <Legend items={[{ name: 'Inbound', color: '#288af0' }, { name: 'Outbound', color: '#a647e8' }]} />
  </Panel>;
}

export function AvailabilityPanel() {
  const segmentColors = ['#31c883', '#63d899', '#efa937', '#a247df', '#8448d4'];
  return <Panel title="Server Availability" range="24h">
    <div className="availability-list">{serverAvailability.map(server => <div className="availability-row" key={server.name}>
      <span>{server.name}</span><span className="availability-count">{server.count}</span><div className="stacked-bar">{server.segments.map((value, index) => <i key={index} style={{ width: `${value}%`, background: segmentColors[index] }} />)}</div>
    </div>)}</div>
    <div className="axis-caption"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
  </Panel>;
}
