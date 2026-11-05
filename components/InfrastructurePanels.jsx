'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CircleAlert, Expand, Minimize2, Minus, Plus, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import Icon from './Icon';
import Panel from './Panel';
import { OnPremIcon, ProviderLogo } from './ProviderLogo';
import { siKubernetes } from 'simple-icons';
import {
  assetsByEnvironment, cloudProviders, infrastructureEvents, infrastructureHealth, infrastructureNodes,
  resourceUtilization, unmonitoredAssets,
} from '@/mockdata/infrastructure';

function HealthBadge({ status }) {
  return <span className={`infra-health ${status === 'Degraded' ? 'degraded' : 'healthy'}`}><i />{status}</span>;
}

const brandIconAssets = {
  mysql: '/icons/mysql-original.svg',
  postgresql: '/icons/postgresql-original.svg',
  redis: '/icons/redis-original.svg',
};

function TopologyIcon({ name, size, tone }) {
  if (name === 'on-prem') return <OnPremIcon className="topology-onprem-icon" />;
  const brandAsset = brandIconAssets[name];
  if (brandAsset) return <img className={`topology-brand-icon ${name}`} src={brandAsset} width={size} height={size} alt="" />;
  const brand = name === 'kubernetes' ? siKubernetes : null;
  if (brand) return <svg className="topology-brand-icon" style={{ color: `#${brand.hex}` }} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d={brand.path} fill="currentColor" /></svg>;
  if (name === 'vpc') return <svg className="topology-brand-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="5" cy="6" r="2" fill="currentColor"/><circle cx="19" cy="6" r="2" fill="currentColor"/><circle cx="5" cy="18" r="2" fill="currentColor"/><circle cx="19" cy="18" r="2" fill="currentColor"/><path d="m6.7 7.4 3.1 3m7.5-3-3.1 3m-7.5 7.2 3.1-3m7.5 3-3.1-3" stroke="currentColor" strokeWidth="1.5"/></svg>;
  if (name === 'staging-cloud') return <svg className="topology-brand-icon" style={{ color: tone === 'purple' ? '#9252df' : '#2685e7' }} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d="M7.1 19.5a5.1 5.1 0 0 1-.4-10.2A6.1 6.1 0 0 1 18.4 8a5.8 5.8 0 0 1-.2 11.5H7.1Z" fill="currentColor" /></svg>;
  if (name === 'web-services') return <svg className="topology-brand-icon" style={{ color: '#2685e7' }} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d="M4 6.2A2.2 2.2 0 0 1 6.2 4h11.6A2.2 2.2 0 0 1 20 6.2v3.1H4zm0 5.8h16v5.8a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 17.8z" fill="currentColor"/><circle cx="7" cy="7.7" r=".8" fill="white"/><circle cx="9.5" cy="7.7" r=".8" fill="white"/><path d="M7 14h10m-10 2.5h6" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>;
  return <Icon name={name} size={size} />;
}

function nodeKey(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function TopologyHandles({ nodeId }) {
  return ['left', 'right', 'top', 'bottom'].map(side => <span key={side} id={`${nodeId}-${side}-handle`} className={`topology-handle ${side}`} data-handle={side} aria-hidden="true" />);
}

function TopologyNode({ node, compact = false, position, size, handlePrefix = 'card', dragHandlers }) {
  const style = position ? { left: position.x, top: position.y, width: size.width, height: size.height } : undefined;
  const key = nodeKey(node.name);
  return <article data-topology-node={key} data-handles="left right top bottom" className={`topology-node ${compact ? 'compact' : ''}`} style={style} {...dragHandlers}>
    <div className={`topology-icon ${node.tone}`}><TopologyIcon name={node.icon} size={compact ? 16 : 19} tone={node.tone} /></div>
    <div className="topology-node-copy">
      <b>{node.name}</b>
      {!compact && <><HealthBadge status={node.status} /><small><Icon name="workflow" size={9} /> {node.detail}</small></>}
    </div>
    {compact && <HealthBadge status={node.status} />}
    <TopologyHandles nodeId={`${handlePrefix}-${key}`} />
  </article>;
}

const initialTopologyLayout = {
  'cloud-providers': { x: 0, y: 0, width: 175, height: 185 },
  'production-vpc': { x: 220, y: 0, width: 185, height: 79 },
  staging: { x: 220, y: 91, width: 185, height: 79 },
  'on-prem-office': { x: 220, y: 182, width: 185, height: 79 },
  'kubernetes-docker': { x: 450, y: 0, width: 200, height: 99 },
  'web-api-services': { x: 450, y: 112, width: 200, height: 94 },
  'external-endpoints': { x: 660, y: 200, width: 170, height: 70 },
  databases: { x: 690, y: 0, width: 205, height: 145 },
};

const TOPOLOGY_WIDTH = 895;
const TOPOLOGY_HEIGHT = 270;

function alignTopologyRows(source, targets) {
  if (!source || targets.some(target => !target) || !targets.length) return targets;
  const center = targets[0];
  const sourceCenter = center.y + center.height / 2;
  const targetCenter = targets.reduce((sum, target) => sum + target.y + target.height / 2, 0) / targets.length;
  const shift = Math.max(-4, Math.min(4, Math.round((targetCenter - sourceCenter) / 5) * 5));
  return targets.map((target, index) => {
    const vertical = index === 1 ? 0 : shift;
    const y = Math.max(0, Math.min(TOPOLOGY_HEIGHT - target.height, target.y - vertical));
    return y === target.y ? target : { ...target, y };
  });
}
// Keeps the default layout optically centered: the environment column is
// balanced against the provider card, the platform pair against that column,
// and the External Endpoints card is centered under the Web/API node.
function autoAlignedTopologyLayout(layout) {
  const next = structuredClone(layout);
  const providers = next['cloud-providers'];
  const environmentIds = ['production-vpc', 'staging', 'on-prem-office'];
  const [production, staging, onPrem] = alignTopologyRows(providers, environmentIds.map(id => next[id]));
  next['production-vpc'] = production;
  next.staging = staging;
  next['on-prem-office'] = onPrem;
  const platformIds = ['kubernetes-docker', 'web-api-services'];
  const environmentsCenter = environmentIds.reduce((sum, id) => sum + next[id].y + next[id].height / 2, 0) / environmentIds.length;
  const platformEdges = platformIds.map(id => next[id]);
  const platformCenter = (platformEdges[0].y + platformEdges[1].y + platformEdges[1].height) / 2;
  const shift = Math.max(-6, Math.min(6, Math.round((platformCenter - environmentsCenter) / 5) * 5));
  platformIds.forEach(id => {
    const node = next[id];
    node.y = Math.max(0, Math.min(TOPOLOGY_HEIGHT - node.height, node.y - shift));
  });
  const web = next['web-api-services'];
  const endpoint = next['external-endpoints'];
  const webCenter = web.y + web.height / 2;
  const endpointY = Math.round((webCenter - endpoint.height / 2) / 5) * 5;
  next['external-endpoints'] = { ...endpoint, y: Math.max(0, Math.min(TOPOLOGY_HEIGHT - endpoint.height, endpointY)) };
  return next;
}

function roundOrthogonalPath(points, radius = 8) {
  let path = `M${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const incomingLength = Math.hypot(current.x - previous.x, current.y - previous.y);
    const outgoingLength = Math.hypot(next.x - current.x, next.y - current.y);
    if (!incomingLength || !outgoingLength) continue;
    const amount = Math.min(radius, incomingLength / 2, outgoingLength / 2);
    const before = {
      x: current.x - ((current.x - previous.x) / incomingLength) * amount,
      y: current.y - ((current.y - previous.y) / incomingLength) * amount,
    };
    const after = {
      x: current.x + ((next.x - current.x) / outgoingLength) * amount,
      y: current.y + ((next.y - current.y) / outgoingLength) * amount,
    };
    path += ` L${before.x} ${before.y} Q${current.x} ${current.y} ${after.x} ${after.y}`;
  }
  const end = points[points.length - 1];
  return `${path} L${end.x} ${end.y}`;
}

function rightToLeftPath(source, target) {
  const start = { x: source.x + source.width, y: source.y + source.height / 2 };
  const end = { x: target.x, y: target.y + target.height / 2 };
  const bendX = start.x + (end.x - start.x) / 2;
  return roundOrthogonalPath([start, { x: bendX, y: start.y }, { x: bendX, y: end.y }, end]);
}

function rightToLeftPathAt(source, targetPoint) {
  const start = { x: source.x + source.width, y: source.y + source.height / 2 };
  const bendX = start.x + (targetPoint.x - start.x) / 2;
  return roundOrthogonalPath([start, { x: bendX, y: start.y }, { x: bendX, y: targetPoint.y }, targetPoint]);
}

function topologyEdgePaths(layout) {
  const provider = layout['cloud-providers'];
  const environmentIds = ['production-vpc', 'staging', 'on-prem-office'];
  const environmentCenters = environmentIds.map(id => layout[id].y + layout[id].height / 2);
  const branchY = Math.round((Math.min(...environmentCenters) + Math.max(...environmentCenters)) / 2);
  const providerSource = { x: provider.x + provider.width, y: provider.y + 125 };
  const branchX = providerSource.x + 23;
  const providerEdges = environmentIds.map(id => {
    const target = layout[id];
    const targetPoint = { x: target.x, y: target.y + target.height / 2 };
    return roundOrthogonalPath([providerSource, { x: branchX, y: providerSource.y }, { x: branchX, y: targetPoint.y }, targetPoint]);
  });

  const kube = layout['kubernetes-docker'];
  const web = layout['web-api-services'];
  const endpoint = layout['external-endpoints'];
  const databases = layout.databases;
  const directPlatformPath = (source, target) => rightToLeftPath(layout[source], layout[target]);
  const kubeToWeb = roundOrthogonalPath([
    { x: kube.x + kube.width / 2, y: kube.y + kube.height },
    { x: web.x + web.width / 2, y: web.y },
  ]);
  const webToEndpoint = roundOrthogonalPath([
    { x: web.x + web.width / 2, y: web.y + web.height },
    { x: web.x + web.width / 2, y: endpoint.y + endpoint.height / 2 },
    { x: endpoint.x, y: endpoint.y + endpoint.height / 2 },
  ]);
  const kubeToDatabase = rightToLeftPathAt(kube, { x: databases.x, y: databases.y + 64.5 });
  const webToDatabase = rightToLeftPathAt(web, { x: databases.x, y: databases.y + 99.5 });

  return {
    providerEdges,
    connections: [
      directPlatformPath('production-vpc', 'kubernetes-docker'),
      directPlatformPath('production-vpc', 'web-api-services'),
      directPlatformPath('staging', 'web-api-services'),
      directPlatformPath('on-prem-office', 'kubernetes-docker'),
      kubeToWeb,
      kubeToDatabase,
      webToDatabase,
      webToEndpoint,
    ],
    branch: { x: branchX, y: branchY },
  };
}

const TopologyCanvas = forwardRef(function TopologyCanvas({ fitPadding = 0.05, idPrefix = 'card' }, ref) {
  const [zoom, setZoom] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [layout, setLayout] = useState(() => autoAlignedTopologyLayout(initialTopologyLayout));
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const arrowId = `topology-arrow-${idPrefix}`;
  const edges = topologyEdgePaths(layout);

  const dragHandlers = id => ({
    onPointerDown: event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { id, pointerId: event.pointerId, origin: layout[id], startX: event.clientX, startY: event.clientY };
    },
    onPointerMove: event => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const nextX = Math.round((drag.origin.x + (event.clientX - drag.startX) / zoom) / 5) * 5;
      const nextY = Math.round((drag.origin.y + (event.clientY - drag.startY) / zoom) / 5) * 5;
      const maxX = 895 - drag.origin.width;
      const maxY = 270 - drag.origin.height;
      setLayout(current => ({ ...current, [id]: { ...current[id], x: Math.max(0, Math.min(maxX, nextX)), y: Math.max(0, Math.min(maxY, nextY)) } }));
    },
    onPointerUp: event => {
      if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    },
    onPointerCancel: () => { dragRef.current = null; },
  });

  const resetLayout = () => {
    setLayout(autoAlignedTopologyLayout(initialTopologyLayout));
    fitView();
  };

  const handlePanStart = event => {
    if (event.button !== 0 || event.target.closest?.('[data-topology-node]')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: canvasOffset };
  };

  const handlePanMove = event => {
    const pan = panRef.current;
    const viewport = viewportRef.current;
    if (!pan || pan.pointerId !== event.pointerId || !viewport) return;
    const visibleMargin = 72;
    const width = 895 * zoom;
    const height = 270 * zoom;
    const minX = Math.min(0, visibleMargin - width);
    const maxX = Math.max(0, viewport.clientWidth - visibleMargin);
    const minY = Math.min(0, visibleMargin - height);
    const maxY = Math.max(0, viewport.clientHeight - visibleMargin);
    setCanvasOffset({
      x: Math.max(minX, Math.min(maxX, pan.origin.x + event.clientX - pan.startX)),
      y: Math.max(minY, Math.min(maxY, pan.origin.y + event.clientY - pan.startY)),
    });
  };

  const handlePanEnd = event => {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  };

  const handleWheelZoom = event => {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const nextZoom = Math.min(1.2, Math.max(0.5, zoom * (event.deltaY < 0 ? 1.08 : 0.92)));
    if (nextZoom === zoom) return;
    const contentX = (pointerX - canvasOffset.x) / zoom;
    const contentY = (pointerY - canvasOffset.y) / zoom;
    setZoom(nextZoom);
    setCanvasOffset({ x: pointerX - contentX * nextZoom, y: pointerY - contentY * nextZoom });
  };

  const fitView = ({ padding = fitPadding } = {}) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextZoom = Math.min(1.2, (viewport.clientWidth * (1 - padding * 2)) / 895, (viewport.clientHeight * (1 - padding * 2)) / 270);
    const fittedZoom = Math.max(0.5, nextZoom || 1);
    setZoom(fittedZoom);
    setCanvasOffset({ x: Math.max(0, (viewport.clientWidth - 895 * fittedZoom) / 2), y: Math.max(0, (viewport.clientHeight - 270 * fittedZoom) / 2) });
  };

  const zoomBy = amount => {
    const nextZoom = Math.min(1.2, Math.max(0.5, Number((zoom + amount).toFixed(2))));
    setZoom(nextZoom);
    const viewport = viewportRef.current;
    if (viewport) setCanvasOffset({ x: Math.max(0, (viewport.clientWidth - 895 * nextZoom) / 2), y: Math.max(0, (viewport.clientHeight - 270 * nextZoom) / 2) });
  };

  useImperativeHandle(ref, () => ({
    fitView,
    resetLayout,
    zoomIn: () => zoomBy(0.06),
    zoomOut: () => zoomBy(-0.06),
  }), [fitPadding, zoom, layout]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    fitView();
    const observer = new ResizeObserver(() => fitView());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => fitView(), 50);
    return () => window.clearTimeout(timer);
  }, []);

  return <div className="topology-viewport" ref={viewportRef} onPointerDown={handlePanStart} onPointerMove={handlePanMove} onPointerUp={handlePanEnd} onPointerCancel={handlePanEnd} onWheel={handleWheelZoom}>
      <div className="topology-canvas" style={{ left: canvasOffset.x, top: canvasOffset.y, transform: `scale(${zoom})` }}>
      <svg className="topology-connectors" viewBox="0 0 895 270" aria-hidden="true">
        <defs><marker id={arrowId} markerWidth="9" markerHeight="9" refX="9" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L9,4.5 L0,9 z" fill="#8fb8ee" /></marker></defs>
        <g fill="none" stroke="#8fb8ee" strokeWidth="1" strokeOpacity="0.9" strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${arrowId})`}>
          {edges.providerEdges.map((path, index) => <path key={`provider-${index}`} d={path} />)}
          {edges.connections.map((path, index) => <path key={`connection-${index}`} d={path} />)}
          <circle cx={edges.branch.x} cy={edges.branch.y} r="2.4" fill="#8fb8ee" stroke="none" markerEnd="none" />
        </g>
      </svg>
      <div className="topology-grid">
        <section data-topology-node="cloud-providers" data-handles="left right top bottom" className="topology-column providers-column" style={{ left: layout['cloud-providers'].x, top: layout['cloud-providers'].y, width: layout['cloud-providers'].width, height: layout['cloud-providers'].height }} {...dragHandlers('cloud-providers')}>
          <div className="topology-column-title"><span className="topology-icon blue"><Icon name="cloud" size={17} /></span><b>Cloud Providers</b></div>
          {cloudProviders.map(provider => <div className="provider-row" key={provider.name}>
            <span className={`provider-logo topology-provider-logo ${provider.tone}`}><ProviderLogo provider={provider.name} variant="topology" /></span>
            <div><b>{provider.name}</b><HealthBadge status={provider.status} /></div>
            <small>{provider.assets} instances</small>
          </div>)}
          <TopologyHandles nodeId={`${idPrefix}-cloud-providers`} />
        </section>
        {infrastructureNodes.environments.map(node => { const position = layout[nodeKey(node.name)]; return <TopologyNode key={node.name} node={node} position={position} size={position} handlePrefix={idPrefix} dragHandlers={dragHandlers(nodeKey(node.name))} />; })}
        {infrastructureNodes.platforms.map(node => { const position = layout[nodeKey(node.name)]; return <TopologyNode key={node.name} node={node} position={position} size={position} handlePrefix={idPrefix} dragHandlers={dragHandlers(nodeKey(node.name))} />; })}
        <article data-topology-node="external-endpoints" data-handles="left right top bottom" className="topology-node endpoint-node" style={{ left: layout['external-endpoints'].x, top: layout['external-endpoints'].y, width: layout['external-endpoints'].width, height: layout['external-endpoints'].height }} {...dragHandlers('external-endpoints')}><div className="topology-icon blue"><Icon name="globe" size={17} /></div><div className="topology-node-copy"><b>External Endpoints</b><HealthBadge status="Healthy" /><small><Icon name="workflow" size={9} /> 3 endpoints</small></div><TopologyHandles nodeId={`${idPrefix}-external-endpoints`} /></article>
        <section data-topology-node="databases" data-handles="left right top bottom" className="topology-column database-column" style={{ left: layout.databases.x, top: layout.databases.y, width: layout.databases.width, height: layout.databases.height }} {...dragHandlers('databases')}>
          <div className="topology-column-title"><span className="topology-icon blue"><Icon name="database" size={17} /></span><b>Databases</b></div>
          {infrastructureNodes.databases.map(node => <TopologyNode key={node.name} node={node} compact handlePrefix={idPrefix} />)}
          <TopologyHandles nodeId={`${idPrefix}-databases`} />
        </section>
      </div>
      </div>
    </div>;
});

function TopologyToolbar({ canvasRef, onExpand, isExpanded = false, modal = false }) {
  return <div className={`topology-toolbar${modal ? ' topology-modal-toolbar' : ''}`}>
    <button type="button" onClick={() => canvasRef.current?.resetLayout()}><Icon name="workflow" size={13} />Auto Layout</button>
    <button type="button" aria-label="Zoom out" onClick={() => canvasRef.current?.zoomOut()}><Minus size={13} /></button>
    <button type="button" aria-label="Zoom in" onClick={() => canvasRef.current?.zoomIn()}><Plus size={13} /></button>
    {isExpanded
      ? <button type="button" aria-label="Minimize topology" onClick={onExpand}><Minimize2 size={13} /></button>
      : <button type="button" aria-label="Expand topology" onClick={onExpand}><Expand size={13} /></button>}
  </div>;
}

function TopologyModal({ onClose }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    const timer = window.setTimeout(() => canvasRef.current?.fitView({ padding: 0.08 }), 50);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(timer);
    };
  }, [onClose]);

  return createPortal(<div className="topology-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="topology-modal" role="dialog" aria-modal="true" aria-labelledby="topology-modal-title">
      <header className="topology-modal-header">
        <div className="topology-modal-heading"><h2 id="topology-modal-title">Infrastructure Topology</h2><p>Interactive view of your infrastructure and dependencies</p></div>
        <TopologyToolbar canvasRef={canvasRef} onExpand={onClose} isExpanded modal />
        <button className="topology-modal-close" type="button" aria-label="Close topology" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="topology-modal-body"><TopologyCanvas ref={canvasRef} fitPadding={0.08} idPrefix="modal" /></div>
    </section>
  </div>, document.body);
}

export function TopologyPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const canvasRef = useRef(null);
  const closeModal = useCallback(() => setIsExpanded(false), []);
  return <>
    <Panel title="Infrastructure Topology" className="topology-panel">
      <div className="topology-subheading">Interactive view of your infrastructure and dependencies</div>
      <TopologyToolbar canvasRef={canvasRef} onExpand={() => setIsExpanded(true)} />
      <TopologyCanvas ref={canvasRef} fitPadding={0.05} idPrefix="card" />
    </Panel>
    {isExpanded && <TopologyModal onClose={closeModal} />}
  </>;
}

export function InfrastructureHealthPanel({ onAlertSelect }) {
  const healthItems = [
    { label: 'Healthy', value: infrastructureHealth.healthy, percent: 79, icon: ShieldCheck, tone: 'green', color: '#22c55e' },
    { label: 'Degraded', value: infrastructureHealth.degraded, percent: 17, icon: TriangleAlert, tone: 'amber', color: '#f59e0b' },
    { label: 'Offline', value: infrastructureHealth.offline, percent: 4, icon: CircleAlert, tone: 'red', color: '#ef4444' },
  ];
  return <Panel title="Infrastructure Health" className="infra-health-panel">
    <div className="health-summary-block">
      <div className="overall-health">{healthItems.map(item => <div className="overall-health-item" key={item.label}>
        <item.icon size={17} className={item.tone} /><b>{item.value}</b><span>{item.label}</span>
      </div>)}</div>
      <div className="health-distribution" role="img" aria-label="Health distribution: Healthy 79% (38), Degraded 17% (8), Offline 4% (2)">
        {healthItems.map(item => <span key={item.label} title={`${item.label} ${item.percent}% (${item.value})`} style={{ flexGrow: item.value, backgroundColor: item.color }} />)}
      </div>
    </div>
    <div className="resource-heading"><b>Resource Utilization</b><button type="button">View Details <ArrowRight size={12} /></button></div>
    <div className="resource-list">{resourceUtilization.map(resource => <div className="resource-row" key={resource.label}>
      <span className={`resource-icon ${resource.tone}`}><Icon name={resource.icon} size={14} /></span>
      <div className="resource-data"><div><span>{resource.label}</span><b>{resource.value}%</b></div><div className="resource-track"><i className={resource.tone} style={{ width: `${resource.value}%` }} /></div></div>
    </div>)}</div>
    <div className="health-alerts-footer">
      <div className="health-alerts-heading"><b>Active Alerts</b><button type="button" onClick={() => onAlertSelect?.()} className="health-alerts-view-all">View all <ArrowRight size={12} /></button></div>
      <div className="health-alert-chips">
        <button type="button" className="health-alert-chip critical" onClick={() => onAlertSelect?.('critical')}>3 Critical</button>
        <button type="button" className="health-alert-chip warning" onClick={() => onAlertSelect?.('warning')}>5 Warning</button>
        <button type="button" className="health-alert-chip info" onClick={() => onAlertSelect?.('info')}>2 Info</button>
      </div>
    </div>
  </Panel>;
}

export function AssetsEnvironmentPanel() {
  const envColors = ['#368cf0', '#8c54dd', '#39c38a', '#f2a33b'];
  return <Panel title="Assets by Environment" className="assets-environment-panel">
    <div className="environment-legend">{['Production', 'Staging', 'Development', 'Testing'].map((name, index) => <span key={name}><i style={{ background: envColors[index] }} />{name}</span>)}</div>
    <div className="environment-bars">{assetsByEnvironment.map(asset => <div className="environment-bar-row" key={asset.name}>
      <span>{asset.name}</span><div className="environment-stacked-bar">{asset.segments.map((value, index) => value > 0 && <i key={index} style={{ width: `${value}%`, background: envColors[index] }} />)}</div><b>{asset.total}</b>
    </div>)}</div>
  </Panel>;
}

export function InfrastructureEventsPanel() {
  const action = <button className="panel-link" type="button">View All <ArrowRight size={12} /></button>;
  return <Panel title="Recent Infrastructure Events" className="infra-events-panel" action={action}>
    <div className="infra-events-list">{infrastructureEvents.map(event => <div className="infra-event-row" key={event.title}>
      <span className={`event-icon ${event.tone}`}><Icon name={event.icon} size={15} /></span>
      <div className="infra-event-copy"><b>{event.title}</b><small>{event.date}</small></div>
      <span className={`environment-tag ${event.environment.toLowerCase()}`}><i />{event.environment}</span>
    </div>)}</div>
  </Panel>;
}

export function UnmonitoredAssetsPanel() {
  const action = <button className="panel-link" type="button">View All <ArrowRight size={12} /></button>;
  return <Panel title="Unmonitored Assets" className="unmonitored-panel" action={action}>
    <div className="unmonitored-table-wrap"><table className="unmonitored-table"><thead><tr><th>Asset</th><th>Type</th><th>Reason</th><th>Action</th></tr></thead>
      <tbody>{unmonitoredAssets.map(asset => <tr key={asset.name}><td>{asset.name}</td><td>{asset.type}</td><td><span className={`reason-dot ${asset.tone}`} />{asset.reason}</td><td><button type="button" className="asset-action">{asset.action}</button></td></tr>)}</tbody>
    </table></div>
  </Panel>;
}
