"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Check, Circle, CircleX, Clock3, Copy, Download, Expand, Filter, Focus, GitBranch, Globe2, HardDrive, Layers, LoaderCircle, MapPin, Minus, Network, Plus, RefreshCw, Router, Search, Server, Shield, Signal, Siren, Sparkles, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Panel } from "@/components/shared/panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { networkDeviceTypes } from "@/mocks/network-devices";
import { addTopologyDiscoveryChange, downstreamFrom, loadTopology, markTopologyDeviceKnown, shortestPath, topologyDiscovery, topologyTotals, type TopologyLink, type TopologyNode, type TopologySite } from "@/mocks/network-topology";
import { cn } from "@/lib/utils";
import type { NocMapSite, NocMapStatus } from "@/mocks/noc-map";


const NocOsmMap = dynamic(() => import("@/components/live-operations/noc-osm-map").then((mod) => mod.NocOsmMap), { ssr: false, loading: () => <div className="grid h-[30rem] place-items-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 animate-spin" size={18} />Loading map…</div> });

type View = "topology" | "map" | "list";
type Overlay = "status" | "utilization" | "latency" | "alerts";
const buttonBase = "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const statusClass: Record<TopologyNode["status"], string> = {
  Up: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Degraded: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Down: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  Maintenance: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  Unknown: "border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300",
};
function statusIcon(status: TopologyNode["status"]) {
  if (status === "Down") return <CircleX size={13} aria-hidden="true" />;
  if (status === "Degraded") return <AlertTriangle size={13} aria-hidden="true" />;
  if (status === "Maintenance") return <Clock3 size={13} aria-hidden="true" />;
  if (status === "Unknown") return <Circle size={13} aria-hidden="true" />;
  return <Check size={13} aria-hidden="true" />;
}
function LinkDots({ value }: { value: number }) { return <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", value > 85 ? "bg-rose-500" : value >= 70 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${value}%` }} /></div>; }
function timeAgo(iso: string): string {
  const delta = Math.max(0, Date.now() - new Date(iso).getTime());
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

const TIER_LABELS = ["Core", "Distribution", "Access", "Endpoints"] as const;
const CARD_W = 148;
const CARD_H = 56;
const COL_PITCH = CARD_W + 14;
const ROW_PITCH = CARD_H + 10;
const TIER_GAP = 110;
const SIDE_PAD = 56;
const TOP_PAD = 52;
const MAX_ROWS = 7;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.6;
const STATUS_COLOR: Record<TopologyNode["status"], string> = { Up: "#22c55e", Degraded: "#f59e0b", Down: "#ef4444", Maintenance: "#8b5cf6", Unknown: "#94a3b8" };

type CanvasPoint = { x: number; y: number };
interface TopologyGeometry { positions: Map<string, CanvasPoint>; width: number; height: number; tierBands: { tier: number; x: number; width: number; count: number }[] }

function nodeSort(a: TopologyNode, b: TopologyNode) { return a.site.localeCompare(b.site) || a.name.localeCompare(b.name); }

function hierarchicalGeometry(nodes: TopologyNode[]): TopologyGeometry {
  const tiers = [0, 1, 2, 3].map((tier) => nodes.filter((node) => node.tier === tier).sort(nodeSort));
  const rowsPerTier = tiers.map((group) => Math.min(group.length, MAX_ROWS));
  const tallest = Math.max(...rowsPerTier, 1);
  const canvasHeight = TOP_PAD + tallest * ROW_PITCH + 28;
  const positions = new Map<string, CanvasPoint>();
  const tierBands: TopologyGeometry["tierBands"] = [];
  let x = SIDE_PAD;
  tiers.forEach((group, tier) => {
    if (group.length === 0) return;
    const columns = Math.ceil(group.length / MAX_ROWS);
    tierBands.push({ tier, x, width: columns * COL_PITCH - 14, count: group.length });
    const offsetY = ((tallest - rowsPerTier[tier]) * ROW_PITCH) / 2;
    group.forEach((node, index) => {
      const col = Math.floor(index / MAX_ROWS);
      const row = index % MAX_ROWS;
      positions.set(node.id, { x: x + col * COL_PITCH, y: TOP_PAD + offsetY + row * ROW_PITCH });
    });
    x += columns * COL_PITCH + TIER_GAP;
  });
  return { positions, width: Math.max(x - TIER_GAP + SIDE_PAD, 640), height: canvasHeight, tierBands };
}

function radialGeometry(nodes: TopologyNode[]): TopologyGeometry {
  const tiers = [0, 1, 2, 3].map((tier) => nodes.filter((node) => node.tier === tier).sort(nodeSort));
  const radii = [0, 200, 430, 660];
  const size = 2 * (660 + CARD_W) + 60;
  const center = size / 2;
  const positions = new Map<string, CanvasPoint>();
  tiers.forEach((group, tier) => {
    if (tier === 0) { group.forEach((node, index) => positions.set(node.id, { x: center - CARD_W / 2, y: center - CARD_H / 2 + index * (CARD_H + 12) })); return; }
    const radius = radii[tier];
    group.forEach((node, index) => {
      const angle = (index / group.length) * Math.PI * 2 - Math.PI / 2;
      positions.set(node.id, { x: center + radius * Math.cos(angle) - CARD_W / 2, y: center + radius * Math.sin(angle) - CARD_H / 2 });
    });
  });
  return { positions, width: size, height: size, tierBands: [] };
}

function forceGeometry(nodes: TopologyNode[], links: TopologyLink[]): TopologyGeometry {
  const seed = radialGeometry(nodes);
  const sim = nodes.map((node) => { const p = seed.positions.get(node.id)!; return { id: node.id, x: p.x + CARD_W / 2, y: p.y + CARD_H / 2 }; });
  const indexById = new Map(sim.map((entry, index) => [entry.id, index]));
  const springs = links.flatMap((link) => {
    const source = indexById.get(link.source); const target = indexById.get(link.target);
    return source !== undefined && target !== undefined ? [{ source, target }] : [];
  });
  const REPULSION = 26000, SPRING = 0.012, REST = 230, GRAVITY = 0.006;
  for (let iteration = 0; iteration < 220; iteration += 1) {
    const fx = new Array<number>(sim.length).fill(0); const fy = new Array<number>(sim.length).fill(0);
    for (let i = 0; i < sim.length; i += 1) {
      for (let j = i + 1; j < sim.length; j += 1) {
        let dx = sim[i].x - sim[j].x, dy = sim[i].y - sim[j].y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 1) { dx = i - j || 1; dy = 0.5; distSq = dx * dx + dy * dy; }
        const dist = Math.sqrt(distSq); const force = REPULSION / distSq; const ux = dx / dist, uy = dy / dist;
        fx[i] += ux * force; fy[i] += uy * force; fx[j] -= ux * force; fy[j] -= uy * force;
      }
    }
    for (const spring of springs) {
      const dx = sim[spring.target].x - sim[spring.source].x, dy = sim[spring.target].y - sim[spring.source].y;
      const dist = Math.max(1, Math.hypot(dx, dy)); const force = (dist - REST) * SPRING; const ux = dx / dist, uy = dy / dist;
      fx[spring.source] += ux * force; fy[spring.source] += uy * force; fx[spring.target] -= ux * force; fy[spring.target] -= uy * force;
    }
    const cx = sim.reduce((sum, entry) => sum + entry.x, 0) / sim.length, cy = sim.reduce((sum, entry) => sum + entry.y, 0) / sim.length;
    for (let i = 0; i < sim.length; i += 1) { fx[i] += (cx - sim[i].x) * GRAVITY; fy[i] += (cy - sim[i].y) * GRAVITY; }
    const damping = 1 - (iteration / 220) * 0.75;
    for (let i = 0; i < sim.length; i += 1) { sim[i].x += Math.max(-40, Math.min(40, fx[i])) * damping; sim[i].y += Math.max(-40, Math.min(40, fy[i])) * damping; }
  }
  const minX = Math.min(...sim.map((entry) => entry.x)), maxX = Math.max(...sim.map((entry) => entry.x));
  const minY = Math.min(...sim.map((entry) => entry.y)), maxY = Math.max(...sim.map((entry) => entry.y));
  const positions = new Map<string, CanvasPoint>();
  sim.forEach((entry) => positions.set(entry.id, { x: entry.x - minX + SIDE_PAD, y: entry.y - minY + TOP_PAD }));
  return { positions, width: maxX - minX + CARD_W + SIDE_PAD * 2, height: maxY - minY + CARD_H + TOP_PAD + 28, tierBands: [] };
}

function edgeAnchors(source: CanvasPoint, target: CanvasPoint) {
  const horizontal = Math.abs(target.x - source.x) >= Math.abs(target.y - source.y);
  if (horizontal) { const forward = target.x >= source.x; return { sx: source.x + (forward ? CARD_W : 0), sy: source.y + CARD_H / 2, tx: target.x + (forward ? 0 : CARD_W), ty: target.y + CARD_H / 2, horizontal: true }; }
  const forward = target.y >= source.y; return { sx: source.x + CARD_W / 2, sy: source.y + (forward ? CARD_H : 0), tx: target.x + CARD_W / 2, ty: target.y + (forward ? 0 : CARD_H), horizontal: false };
}

function edgePath(sx: number, sy: number, tx: number, ty: number, horizontal: boolean): string {
  if (horizontal) { const bend = Math.max(48, Math.abs(tx - sx) / 2); const dir = Math.sign(tx - sx) || 1; return `M ${sx} ${sy} C ${sx + bend * dir} ${sy}, ${tx - bend * dir} ${ty}, ${tx} ${ty}`; }
  const bend = Math.max(48, Math.abs(ty - sy) / 2); const dir = Math.sign(ty - sy) || 1; return `M ${sx} ${sy} C ${sx} ${sy + bend * dir}, ${tx} ${ty - bend * dir}, ${tx} ${ty}`;
}

function TopologyTypeIcon({ type, size }: { type: string; size: number }) {
  const className = "shrink-0 text-[oklch(0.55_0.04_254)]";
  if (type.includes("Router")) return <Router size={size} className={className} aria-hidden="true" />;
  if (type.includes("Firewall")) return <Shield size={size} className={className} aria-hidden="true" />;
  if (type.includes("Server")) return <Server size={size} className={className} aria-hidden="true" />;
  if (type.includes("Access")) return <Signal size={size} className={className} aria-hidden="true" />;
  return <Network size={size} className={className} aria-hidden="true" />;
}

function TopologyCanvas({ nodes, links, selected, onSelect, overlay, layout, site, spotlight, onToast }: {
  nodes: TopologyNode[]; links: TopologyLink[]; selected: string | null; onSelect: (id: string) => void;
  overlay: Overlay; layout: string; site?: string; spotlight: string[]; onToast: (text: string) => void;
}) {
  const [showEndpoints, setShowEndpoints] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CanvasPoint>({ x: 0, y: 0 });
  const [overrides, setOverrides] = useState<Record<string, CanvasPoint>>({});
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; origin: CanvasPoint } | null>(null);
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; origin: CanvasPoint } | null>(null);
  const dragMovedRef = useRef(false);
  const dotsId = useId();
  const revealed = showEndpoints || Boolean(selected && nodes.some((node) => node.id === selected && node.tier >= 3));
  const visible = useMemo(() => nodes.filter((node) => (!site || node.site.toLowerCase() === site.toLowerCase()) && (revealed || node.tier < 3)), [nodes, site, revealed]);
  const hiddenCount = nodes.length - visible.length;
  const geometry = useMemo<TopologyGeometry>(() => (layout === "Force" ? forceGeometry(visible, links) : layout === "Radial" ? radialGeometry(visible) : hierarchicalGeometry(visible)), [visible, links, layout]);
  const positions = useMemo(() => { const merged = new Map(geometry.positions); for (const [id, point] of Object.entries(overrides)) if (merged.has(id)) merged.set(id, point); return merged; }, [geometry, overrides]);
  const visibleLinks = useMemo(() => links.filter((link) => positions.has(link.source) && positions.has(link.target)), [links, positions]);
  const adjacentToSelected = useMemo(() => { if (!selected) return null; const set = new Set<string>([selected]); for (const link of links) { if (link.source === selected) set.add(link.target); if (link.target === selected) set.add(link.source); } return set; }, [selected, links]);
  const linkColor = (link: TopologyLink) => overlay === "utilization" ? (link.utilizationPct > 85 ? "#ef4444" : link.utilizationPct >= 70 ? "#f59e0b" : "#a8b7c9") : overlay === "latency" ? (link.latencyMs > 60 ? "#ef4444" : link.latencyMs > 30 ? "#f59e0b" : "#a8b7c9") : link.status === "Up" ? "#a8b7c9" : STATUS_COLOR[link.status];
  const fitView = useCallback(() => {
    const viewport = viewportRef.current; if (!viewport) return;
    const scale = Math.min((viewport.clientWidth - 20) / geometry.width, (viewport.clientHeight - 20) / geometry.height);
    const nextZoom = Math.min(1.05, Math.max(MIN_ZOOM, scale));
    setZoom(nextZoom);
    setOffset({ x: (viewport.clientWidth - geometry.width * nextZoom) / 2, y: (viewport.clientHeight - geometry.height * nextZoom) / 2 });
  }, [geometry.width, geometry.height]);
  useLayoutEffect(() => { fitView(); }, [fitView]);
  useEffect(() => { const viewport = viewportRef.current; if (!viewport) return undefined; const observer = new ResizeObserver(() => fitView()); observer.observe(viewport); return () => observer.disconnect(); }, [fitView]);
  useEffect(() => {
    const viewport = viewportRef.current; if (!viewport) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (event.deltaY < 0 ? 1.09 : 0.92)));
      if (nextZoom === zoom) return;
      const content = { x: (pointer.x - offset.x) / zoom, y: (pointer.y - offset.y) / zoom };
      setZoom(nextZoom);
      setOffset({ x: pointer.x - content.x * nextZoom, y: pointer.y - content.y * nextZoom });
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [zoom, offset]);
  const zoomAboutCenter = (factor: number) => {
    const viewport = viewportRef.current; if (!viewport) return;
    const center = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    const content = { x: (center.x - offset.x) / zoom, y: (center.y - offset.y) / zoom };
    setZoom(nextZoom);
    setOffset({ x: center.x - content.x * nextZoom, y: center.y - content.y * nextZoom });
  };
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest?.("[data-topology-node],button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: offset };
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current; const viewport = viewportRef.current;
    if (!pan || pan.pointerId !== event.pointerId || !viewport) return;
    const maxX = viewport.clientWidth - 96, minX = 96 - geometry.width * zoom;
    const maxY = viewport.clientHeight - 96, minY = 96 - geometry.height * zoom;
    setOffset({ x: Math.min(maxX, Math.max(minX, pan.origin.x + event.clientX - pan.startX)), y: Math.min(maxY, Math.max(minY, pan.origin.y + event.clientY - pan.startY)) });
  };
  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => { if (panRef.current?.pointerId === event.pointerId) panRef.current = null; };
  const nodePointerDown = (node: TopologyNode) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: node.id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: positions.get(node.id)! };
    dragMovedRef.current = false;
  };
  const nodePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.startX) / zoom, dy = (event.clientY - drag.startY) / zoom;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragMovedRef.current = true;
    setOverrides((current) => ({ ...current, [drag.id]: { x: Math.round((drag.origin.x + dx) / 5) * 5, y: Math.round((drag.origin.y + dy) / 5) * 5 } }));
  };
  const nodePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; };
  const nodeContextMenu = (node: TopologyNode) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void navigator.clipboard?.writeText(node.ip);
    onToast(`${node.ip} copied`);
  };
  const nodeDimmed = (node: TopologyNode) => (adjacentToSelected ? !adjacentToSelected.has(node.id) : false) || (spotlight.length > 0 && !spotlight.includes(node.id) && node.id !== selected);
  return <div ref={viewportRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd}
    className="relative h-full min-h-[560px] touch-none select-none overflow-hidden rounded-xl border border-border bg-gradient-to-br from-slate-50 to-slate-100/70 dark:from-slate-950 dark:to-slate-900 [&::-webkit-scrollbar]:hidden"
    role="img" aria-label="Network topology graph. Select a device to inspect it; drag devices to reposition.">
    {visible.length > 0 && <div className="absolute left-0 top-0 will-change-transform" style={{ width: geometry.width, height: geometry.height, transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
      <svg className="absolute inset-0" width={geometry.width} height={geometry.height} aria-hidden="true">
        <defs>
          <pattern id={`${dotsId}-dots`} width={26} height={26} patternUnits="userSpaceOnUse"><circle cx={1.3} cy={1.3} r={1.3} fill="oklch(0.72 0.01 255 / 0.55)" /></pattern>
          {(["#a8b7c9", "#f59e0b", "#ef4444", "#94a3b8"] as const).map((color, index) => (
            <marker key={color} id={`${dotsId}-arrow-${index}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={color} /></marker>
          ))}
        </defs>
        <rect width={geometry.width} height={geometry.height} fill={`url(#${dotsId}-dots)`} />
        {visibleLinks.map((link) => {
          const source = positions.get(link.source)!, target = positions.get(link.target)!;
          const { sx, sy, tx, ty, horizontal } = edgeAnchors(source, target);
          const color = linkColor(link);
          const incident = Boolean(selected && (link.source === selected || link.target === selected));
          const spotlighted = spotlight.includes(link.source) || spotlight.includes(link.target);
          const dimmed = selected ? !incident : spotlight.length > 0 ? !spotlighted : false;
          const colorIndex = color === "#a8b7c9" ? 0 : color === "#f59e0b" ? 1 : color === "#ef4444" ? 2 : 3;
          const dashed = link.type === "Wireless" || link.type === "VPN" || link.status === "Down";
          return <path key={link.id} d={edgePath(sx, sy, tx, ty, horizontal)} fill="none" stroke={color} strokeOpacity={dimmed ? 0.1 : incident ? 0.95 : 0.4} strokeWidth={incident ? 2.4 : link.speedMbps > 1000 ? 1.8 : 1.3} strokeDasharray={dashed ? "6 5" : undefined} markerEnd={`url(#${dotsId}-arrow-${colorIndex})`} />;
        })}
      </svg>
      {geometry.tierBands.map((band) => <div key={band.tier} className="pointer-events-none absolute flex items-center gap-2" style={{ left: band.x, top: 10, width: band.width }}><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[oklch(0.55_0.04_254)]">{TIER_LABELS[band.tier]}</span><span className="rounded-full border border-border bg-card px-1.5 text-[9px] font-semibold tabular-nums text-muted-foreground">{band.count}</span></div>)}
      {visible.map((node) => {
        const point = positions.get(node.id)!;
        const dimmed = nodeDimmed(node);
        const isSelected = node.id === selected;
        return <button key={node.id} type="button" data-topology-node={node.id} aria-pressed={isSelected}
          onClick={() => { if (!dragMovedRef.current) onSelect(node.id); }}
          onContextMenu={nodeContextMenu(node)}
          onPointerDown={nodePointerDown(node)} onPointerMove={nodePointerMove} onPointerUp={nodePointerEnd} onPointerCancel={nodePointerEnd}
          className={cn("absolute cursor-grab touch-none select-none rounded-lg border bg-card px-2 py-1.5 text-left shadow-[0_1px_3px_rgba(15,23,42,0.10)] transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing", isSelected ? "z-10 border-primary ring-2 ring-primary/40" : "border-[oklch(0.92_0.018_250.6)] hover:border-primary/60", dimmed && "opacity-30")}
          style={{ left: point.x, top: point.y, width: CARD_W, height: CARD_H, borderLeft: `3px solid ${STATUS_COLOR[node.status]}` }}>
          <div className="flex items-center gap-1.5">
            <TopologyTypeIcon type={node.type} size={12} />
            <b title={node.name} className="truncate text-[11px] font-semibold leading-none text-[oklch(0.4_0.05_254)] dark:text-slate-100">{node.name}</b>
            {node.alertCount > 0 && <span className="ml-auto shrink-0 rounded-full bg-rose-500/10 px-1.5 text-[9px] font-bold tabular-nums text-rose-600 dark:text-rose-400">{node.alertCount}</span>}
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-1"><span className="font-mono text-[10px] tabular-nums text-muted-foreground">{node.ip}</span><span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: STATUS_COLOR[node.status] }}>{node.status}</span></div>
          <div className="mt-0.5 truncate text-[9px] font-medium text-muted-foreground/80">{node.site} · {node.type}</div>
        </button>;
      })}
    </div>}
    {visible.length === 0 && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">No devices match these filters.</div>}
    <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
      <button type="button" className={buttonBase} onClick={() => setShowEndpoints((value) => !value)}>{showEndpoints ? "Hide endpoints" : "Show endpoints"}</button>
      <span className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-sm">{hiddenCount > 0 ? `Core · Distribution · Access shown — ${hiddenCount} hidden` : "Full topology visible"}</span>
    </div>
    <div className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-3 rounded-full border border-border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <span className="font-semibold text-muted-foreground">Status</span>
      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />Healthy</span>
      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" />Degraded</span>
      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-rose-500" />Down</span>
      <span className="hidden text-muted-foreground sm:inline">·</span>
      <span className="hidden text-muted-foreground sm:inline">Edge color follows the selected overlay</span>
    </div>
    <div className="absolute bottom-3 right-3 z-20 flex gap-1">
      <button type="button" className={buttonBase} aria-label="Zoom in" onClick={() => zoomAboutCenter(1.25)}><Plus size={16} /></button>
      <button type="button" className={buttonBase} aria-label="Zoom out" onClick={() => zoomAboutCenter(0.8)}><Minus size={16} /></button>
      <button type="button" className={buttonBase} aria-label="Fit to screen" onClick={fitView}><Focus size={16} /></button>
      <button type="button" className={buttonBase} aria-label="Reset layout" onClick={() => { setOverrides({}); fitView(); }}><Globe2 size={16} /></button>
    </div>
  </div>;
}

export function NetworkTopologyDashboard() {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  const [nodes, setNodes] = useState<TopologyNode[]>([]); const [links, setLinks] = useState<TopologyLink[]>([]); const [sites, setSites] = useState<TopologySite[]>([]); const [changes, setChanges] = useState<{ id: string; at: string; type: string; subject: string; detail: string }[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading"); const [view, setView] = useState<View>((params.get("view") as View) || "topology"); const [overlay, setOverlay] = useState<Overlay>((params.get("overlay") as Overlay) || "status"); const [layout, setLayout] = useState("Hierarchical"); const [selected, setSelected] = useState<string | null>(params.get("node")); const [siteFilter, setSiteFilter] = useState(params.get("site") || "all"); const [typeFilter, setTypeFilter] = useState("all"); const [statusFilter, setStatusFilter] = useState("all"); const [query, setQuery] = useState(""); const [notice, setNotice] = useState(""); const [tab, setTab] = useState("Overview"); const [impact, setImpact] = useState<string[]>([]); const [trace, setTrace] = useState<TopologyLink[] | null>(null); const [discoveryOpen, setDiscoveryOpen] = useState(false); const [spofOn, setSpofOn] = useState(false);
  const refresh = useCallback(() => { setLoadState("loading"); void loadTopology().then((data) => { setNodes(data.nodes); setLinks(data.links); setSites(data.sites); setChanges(data.changes); setLoadState("ready"); }).catch(() => setLoadState("error")); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { const next = new URLSearchParams(params.toString()); next.set("view", view); next.set("overlay", overlay); if (selected) next.set("node", selected); else next.delete("node"); if (siteFilter !== "all") next.set("site", siteFilter); else next.delete("site"); router.replace(`${pathname}?${next.toString()}`, { scroll: false }); }, [view, overlay, selected, siteFilter, pathname, router]);
  const toast = useCallback((message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); }, []);
  const visibleNodes = useMemo(() => nodes.filter((node) => (!siteFilter || siteFilter === "all" || node.site.toLowerCase() === siteFilter.toLowerCase()) && (typeFilter === "all" || node.type === typeFilter) && (statusFilter === "all" || node.status === statusFilter) && `${node.name} ${node.ip} ${node.vendor} ${node.site}`.toLowerCase().includes(query.toLowerCase())), [nodes, siteFilter, typeFilter, statusFilter, query]);
  const selectedNode = nodes.find((node) => node.id === selected) ?? null;
  const topLinks = [...links].sort((a, b) => b.utilizationPct - a.utilizationPct).slice(0, 6);
  const congested = links.filter((link) => link.utilizationPct > 85).length;
  const unmanaged = nodes.filter((node) => !node.managed).length;
  const mapSites: NocMapSite[] = sites.map((site) => { const siteNodes = nodes.filter((node) => node.site === site.name); const worst: NocMapStatus = siteNodes.some((node) => node.status === "Down") ? "critical" : siteNodes.some((node) => node.status === "Degraded") ? "warning" : "online"; return { id: site.id, code: site.name.slice(0, 3).toUpperCase(), city: site.name, country: "Infrastructure site", region: "Network", provider: "—", facility: "—", lat: site.lat, lng: site.lng, status: worst, health: 99, throughput: "—", alerts: siteNodes.reduce((sum, node) => sum + node.alertCount, 0), uptime: "—", lastCheck: "just now", servers: [] }; });
  const chooseView = (value: View) => { setView(value); if (value === "list") setSelected(selected); };
  const openPath = () => { const target = nodes.find((node) => node.id !== selected)?.id; if (!selected || !target) return; const result = shortestPath(selected, target); setTrace(result); toast(result.length ? `${result.length} hop path found` : "No path between selected devices"); };
  const runDiscovery = () => { addTopologyDiscoveryChange(); refresh(); setDiscoveryOpen(false); toast("Discovery complete · 3 new devices found"); };
  const copyIp = () => { if (selectedNode) { void navigator.clipboard?.writeText(selectedNode.ip); toast(`${selectedNode.ip} copied`); } };
  const exportJson = () => { const blob = new Blob([JSON.stringify({ nodes, links, sites }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "network-topology.json"; anchor.click(); URL.revokeObjectURL(url); toast("Topology JSON exported"); };
  const doImpact = () => { if (!selected) return; const children = downstreamFrom(selected, links); setImpact(children); toast(`${children.length} downstream devices may be affected`); };
  const nodeIcon = (type: string) => type.includes("Router") ? <Router size={17} /> : type.includes("Firewall") ? <Shield size={17} /> : type.includes("Server") ? <Server size={17} /> : <Network size={17} />;

  return <div className="space-y-4 pb-4">
    <PageHeader breadcrumbs={["Infrastructure", "Network Topology"]} title="Network Topology" subtitle="Visualize how devices and sites connect, spot bottlenecks and see what breaks when a device fails." demo lastUpdated={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })} onRefresh={refresh} actions={<><button type="button" onClick={exportJson} className={buttonBase}><Download size={15} />Export</button><button type="button" onClick={() => setDiscoveryOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Sparkles size={15} />Run Discovery</button></>} />
    {topologyTotals.offline + congested + unmanaged > 0 ? <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200"><span className="flex items-center gap-2"><AlertTriangle size={17} />{topologyTotals.offline} devices down · {congested} links above 85% utilization · {spofOn ? 1 : 0} single points of failure · {unmanaged} unmanaged devices</span><button className="font-semibold underline underline-offset-2" onClick={() => { setStatusFilter("Down"); setView("topology"); }}>View issues</button></div> : <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">Network healthy, all devices reachable</div>}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Total Devices" value={String(topologyTotals.devices)} icon={<Router size={19} />} iconTone="bg-blue-500/10 text-blue-600" onClick={() => { setStatusFilter("all"); setView("topology"); }} />
      <StatCard label="Links" value={String(links.length)} detail="5 degraded" icon={<GitBranch size={19} />} iconTone="bg-violet-500/10 text-violet-600" onClick={() => setView("topology")} />
      <StatCard label="Sites" value={String(sites.length)} icon={<MapPin size={19} />} iconTone="bg-sky-500/10 text-sky-600" onClick={() => setView("map")} />
      <StatCard label="Devices Down" value={String(topologyTotals.offline)} goodDirection="down" icon={<CircleX size={19} />} iconTone="bg-rose-500/10 text-rose-600" onClick={() => setStatusFilter("Down")} />
      <StatCard label="Congested Links" value={String(congested)} detail="> 85% utilization" goodDirection="down" icon={<Activity size={19} />} iconTone="bg-amber-500/10 text-amber-600" onClick={() => setOverlay("utilization")} />
      <StatCard label="Unmanaged Devices" value={String(unmanaged)} goodDirection="down" icon={<Siren size={19} />} iconTone="bg-orange-500/10 text-orange-600" onClick={() => setStatusFilter("Unknown")} />
    </div>
    <Card className="rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-muted/50 p-0.5" role="tablist" aria-label="Topology view">{(["topology", "map", "list"] as View[]).map((item) => <button role="tab" aria-selected={view === item} key={item} onClick={() => chooseView(item)} className={cn("h-8 rounded-md px-3 text-sm capitalize", view === item ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground")}>{item === "topology" ? "Topology" : item}</button>)}</div>
        <Select value={layout} onValueChange={setLayout}><SelectTrigger className="h-9 w-36 text-sm"><SelectValue /></SelectTrigger><SelectContent>{["Hierarchical", "Force", "Radial"].map((item) => <SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select>
        <Select value={siteFilter} onValueChange={setSiteFilter}><SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="All sites" /></SelectTrigger><SelectContent><SelectItem value="all">All sites</SelectItem>{sites.map((site) => <SelectItem key={site.id} value={site.name.toLowerCase()}>{site.name}</SelectItem>)}</SelectContent></Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="All types" /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{[...new Set(nodes.map((node) => node.type))].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{["Up", "Degraded", "Down", "Maintenance", "Unknown"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
        <div className="relative min-w-[11rem] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find device… ( / )" className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" onKeyDown={(event) => { if (event.key === "Enter" && visibleNodes[0]) setSelected(visibleNodes[0].id); }} /></div>
        <div className="flex rounded-lg border border-border p-0.5" aria-label="Graph overlay">{(["status", "utilization", "latency", "alerts"] as Overlay[]).map((item) => <button key={item} onClick={() => setOverlay(item)} className={cn("h-8 rounded-md px-2.5 text-xs capitalize", overlay === item ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{item}</button>)}</div>
        <button className={cn(buttonBase, spofOn && "border-rose-500 text-rose-600")} onClick={() => setSpofOn(!spofOn)} aria-pressed={spofOn}><Filter size={15} />SPOF</button>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-9">
          {loadState === "loading" ? <div className="grid min-h-[560px] place-items-center rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground"><LoaderCircle className="mr-2 animate-spin" size={18} />Loading topology…</div> : loadState === "error" ? <div className="grid min-h-[560px] place-items-center rounded-xl border border-border text-sm"><div className="text-center"><p className="mb-3 text-muted-foreground">Topology could not be loaded.</p><button className={buttonBase} onClick={refresh}><RefreshCw size={15} />Retry</button></div></div> : view === "topology" ? <TopologyCanvas nodes={visibleNodes} links={links} selected={selected} onSelect={setSelected} overlay={overlay} layout={layout} spotlight={impact} onToast={toast} /> : view === "map" ? <div className="relative h-[560px] overflow-hidden rounded-xl border border-border"><NocOsmMap sites={mapSites} center={[33.69, 73.06]} initialZoom={5} onSelectSite={(site) => { setSiteFilter(site.city.toLowerCase()); setView("topology"); }} /></div> : <div className="max-h-[560px] overflow-auto rounded-xl border border-border"><table className="w-full min-w-[780px] text-left text-[13px]"><thead className="sticky top-0 bg-muted text-xs text-muted-foreground"><tr>{["Device", "Type", "Site", "Status", "IP address", "Links", "Alerts", "Last seen"].map((title) => <th className="px-3 py-3 font-semibold" key={title}>{title}</th>)}</tr></thead><tbody>{visibleNodes.map((node) => <tr key={node.id} onClick={() => { setSelected(node.id); setView("topology"); }} className="cursor-pointer border-t border-border hover:bg-muted/50"><td className="px-3 py-3 font-semibold">{node.name}</td><td className="px-3 py-3">{node.type}</td><td className="px-3 py-3">{node.site}</td><td className="px-3 py-3"><span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs", statusClass[node.status])}>{statusIcon(node.status)}{node.status}</span></td><td className="px-3 py-3 font-mono">{node.ip}</td><td className="px-3 py-3">{links.filter((link) => link.source === node.id || link.target === node.id).length}</td><td className="px-3 py-3">{node.alertCount}</td><td className="px-3 py-3 text-muted-foreground">{timeAgo(node.lastSeenAt)}</td></tr>)}</tbody></table></div>}
        </div>
        <aside className="min-w-0 xl:col-span-3">
          <Card className="flex h-full min-h-[560px] flex-col rounded-xl p-4">
            {selectedNode ? <><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">{nodeIcon(selectedNode.type)}</span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold">{selectedNode.name}</h2><p className="text-xs text-muted-foreground">{selectedNode.type} · {selectedNode.vendor}</p></div><span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs", statusClass[selectedNode.status])}>{statusIcon(selectedNode.status)}{selectedNode.status}</span></div><p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">This device has {links.filter((link) => link.source === selectedNode.id || link.target === selectedNode.id).length} connected link{links.filter((link) => link.source === selectedNode.id || link.target === selectedNode.id).length === 1 ? "" : "s"}. Connected devices are highlighted in the topology.</p>
              <div className="mt-4 flex border-b border-border text-sm" role="tablist">{["Overview", "Interfaces", "Neighbors", "Alerts"].map((label) => <button role="tab" aria-selected={tab === label} key={label} onClick={() => setTab(label)} className={cn("flex-1 border-b-2 px-1 pb-2 text-xs", tab === label ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground")}>{label}</button>)}</div>
              {tab === "Overview" ? <div className="flex-1 space-y-3 py-4 text-sm"><dl className="grid grid-cols-2 gap-y-3"><dt className="text-muted-foreground">IP address</dt><dd className="text-right font-mono text-xs">{selectedNode.ip}</dd><dt className="text-muted-foreground">Model</dt><dd className="text-right text-xs">{selectedNode.model}</dd><dt className="text-muted-foreground">Site</dt><dd className="text-right">{selectedNode.site}</dd><dt className="text-muted-foreground">VLAN</dt><dd className="text-right">{selectedNode.vlan}</dd><dt className="text-muted-foreground">Uptime</dt><dd className="text-right">{selectedNode.uptime}</dd><dt className="text-muted-foreground">Last seen</dt><dd className="text-right">{timeAgo(selectedNode.lastSeenAt)}</dd><dt className="text-muted-foreground">Management</dt><dd className="text-right">{selectedNode.managed ? "Managed" : "Unmanaged"}</dd></dl><div><div className="mb-1 flex justify-between text-xs"><span>CPU</span><span>{selectedNode.cpu}%</span></div><LinkDots value={selectedNode.cpu} /></div><div><div className="mb-1 flex justify-between text-xs"><span>Memory</span><span>{selectedNode.mem}%</span></div><LinkDots value={selectedNode.mem} /></div></div> : tab === "Interfaces" ? <div className="flex-1 space-y-3 py-4">{links.filter((link) => link.source === selectedNode.id || link.target === selectedNode.id).map((link) => <div className="rounded-lg border border-border p-3 text-xs" key={link.id}><div className="mb-2 flex justify-between font-semibold"><span>{link.source === selectedNode.id ? link.sourcePort : link.targetPort}</span><span>{link.speedMbps / 1000} Gbps</span></div><LinkDots value={link.utilizationPct} /><div className="mt-1 text-muted-foreground">{link.utilizationPct}% utilized</div></div>)}</div> : tab === "Neighbors" ? <div className="flex-1 space-y-2 py-4">{links.filter((link) => link.source === selectedNode.id || link.target === selectedNode.id).map((link) => { const neighborId = link.source === selectedNode.id ? link.target : link.source; const neighbor = nodes.find((entry) => entry.id === neighborId); return <button key={link.id} onClick={() => setSelected(neighborId)} className="flex w-full items-center justify-between rounded-lg border border-border p-2 text-left text-xs hover:bg-muted"><span className="font-semibold">{neighbor?.name}</span><span className={cn("rounded-full px-2 py-1", link.status === "Down" ? "text-rose-600" : "text-emerald-600")}>{link.utilizationPct}%</span></button>; })}</div> : <div className="flex-1 py-4 text-sm">{selectedNode.alertCount ? <div className="rounded-lg bg-amber-500/10 p-3 text-amber-800">{selectedNode.alertCount} linked alert{selectedNode.alertCount > 1 ? "s" : ""} · configuration drift detected</div> : <p className="text-muted-foreground">No active alerts for this device.</p>}<p className="mt-3 text-xs text-muted-foreground">Maintenance window: {selectedNode.status === "Maintenance" ? "MW-2026-014 · scheduled" : "None"}</p></div>}
              <div className="mt-auto grid grid-cols-2 gap-2"><button className={buttonBase} onClick={() => { if (selectedNode.id.startsWith("srv-")) router.push(`/infrastructure/server-details/${selectedNode.id}`); else { setView("list"); toast("Device selected in Network Devices inventory"); } }}>Open full details</button><button className={buttonBase} onClick={doImpact}><Activity size={14} />Impact</button><button className={buttonBase} onClick={openPath}><GitBranch size={14} />Trace path</button><button className={buttonBase} onClick={copyIp}><Copy size={14} />Copy IP</button></div>
            </> : <><h2 className="text-sm font-bold">Network overview</h2><p className="mt-1 text-xs text-muted-foreground">Select a device to inspect connections and health.</p><div className="mt-5 grid grid-cols-3 gap-2 text-center">{[["Up", topologyTotals.healthy, "text-emerald-600"], ["Warning", topologyTotals.warning, "text-amber-600"], ["Down", topologyTotals.offline, "text-rose-600"]].map(([label, value, color]) => <div key={String(label)} className="rounded-lg bg-muted/50 p-2"><b className={cn("block text-lg", String(color))}>{value}</b><span className="text-xs text-muted-foreground">{label}</span></div>)}</div><h3 className="mt-5 text-xs font-bold">Top congested links</h3><div className="mt-2 space-y-3">{topLinks.slice(0, 4).map((link) => <button key={link.id} onClick={() => setSelected(link.source)} className="block w-full rounded-lg border border-border p-2 text-left"><div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate">{nodes.find((node) => node.id === link.source)?.name} ↔ {nodes.find((node) => node.id === link.target)?.name}</span><b>{link.utilizationPct}%</b></div><LinkDots value={link.utilizationPct} /></button>)}</div><div className="mt-5 rounded-lg bg-muted/40 p-3 text-xs"><div className="font-semibold">Discovery status</div><div className="mt-1 text-muted-foreground">{topologyDiscovery.protocol} · {topologyDiscovery.devicesFound} devices</div></div></>}
          </Card>
        </aside>
      </div>
    </Card>
    {impact.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm"><Activity size={16} className="text-rose-600" /><b>If {selectedNode?.name} fails:</b><span>{impact.length} downstream devices may be affected</span><button className="ml-auto text-xs font-semibold underline" onClick={() => setImpact([])}>Clear impact</button></div>}
    {view === "topology" && <div className="grid items-stretch gap-4 xl:grid-cols-3"><Panel title="Top Utilized Links" className="min-w-0"><div className="flex-1 space-y-3">{topLinks.map((link) => <button key={link.id} onClick={() => setSelected(link.source)} className="grid w-full grid-cols-[minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1 text-left text-xs"><span className="truncate font-semibold">{nodes.find((node) => node.id === link.source)?.name} ↔ {nodes.find((node) => node.id === link.target)?.name}</span><b className="text-right">{link.utilizationPct}%</b><span className="text-muted-foreground">{link.sourcePort} · {link.speedMbps / 1000} Gbps</span><LinkDots value={link.utilizationPct} /></button>)}</div></Panel><Panel title="Single Points of Failure" className="min-w-0"><div className="flex flex-1 flex-col justify-center gap-3"><div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm"><AlertTriangle size={17} className="text-amber-600" /><span><b>SW-CORE-01</b> · {downstreamFrom(nodes[0]?.id ?? "", links).length || 14} downstream devices</span></div><p className="text-xs text-muted-foreground">Suggestion: add a redundant uplink to improve resilience.</p><button className={cn(buttonBase, "w-fit")} onClick={() => setSpofOn(!spofOn)}>{spofOn ? "Hide SPOF" : "Highlight SPOF"}</button></div></Panel><Panel title="Recent Topology Changes" className="min-w-0"><div className="flex-1 space-y-2">{changes.slice(0, 8).map((change) => <button key={change.id} onClick={() => { const match = nodes.find((node) => node.name === change.subject); if (match) setSelected(match.id); }} className="flex w-full items-start gap-2 text-left"><span className="mt-0.5 text-primary"><Activity size={14} /></span><span className="min-w-0 flex-1"><b className="block truncate text-xs">{change.subject} · {change.type}</b><span className="block truncate text-xs text-muted-foreground">{change.detail}</span></span><span className="shrink-0 text-xs text-muted-foreground">{timeAgo(change.at)}</span></button>)}</div><button className="mt-auto flex items-center gap-1 pt-2 text-xs font-semibold text-primary">View all <ArrowRight size={13} /></button></Panel></div>}
﻿    <div className="grid items-stretch gap-4 xl:grid-cols-3"><Panel title="Devices by Type" className="min-w-0"><div className="flex flex-1 flex-col gap-2 text-sm">{networkDeviceTypes.map((type) => <button key={type.key} onClick={() => { setTypeFilter(type.key); setView("topology"); }} className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="flex items-center gap-2 text-muted-foreground"><i className="h-2.5 w-2.5 rounded-full bg-primary" />{type.name}</span><b className="tabular-nums">{type.count}</b></button>)}<div className="mt-auto border-t border-border pt-2 text-center text-xs text-muted-foreground">{topologyTotals.devices} total devices</div></div></Panel><Panel title="Discovery" className="min-w-0"><div className="flex flex-1 flex-col gap-2 text-sm"><div className="flex items-center justify-between gap-3 px-2 py-1.5"><span className="text-muted-foreground">Last run</span><b className="text-xs tabular-nums">{timeAgo(topologyDiscovery.lastRunAt)}</b></div><div className="flex items-center justify-between gap-3 px-2 py-1.5"><span className="text-muted-foreground">Next run</span><b className="text-xs">In 18 hours</b></div><div className="flex items-center justify-between gap-3 px-2 py-1.5"><span className="text-muted-foreground">Protocol</span><b className="text-xs">{topologyDiscovery.protocol}</b></div><div className="flex items-center justify-between gap-3 px-2 py-1.5"><span className="text-muted-foreground">Devices found</span><b className="tabular-nums">{topologyDiscovery.devicesFound}</b></div><div className="flex items-center justify-between gap-3 px-2 py-1.5"><span className="text-muted-foreground">Unmanaged</span><b className="tabular-nums text-amber-600">{unmanaged}</b></div><div className="mt-auto flex gap-2 border-t border-border pt-3"><button className={buttonBase} onClick={() => { markTopologyDeviceKnown(nodes.find((node) => !node.managed)?.id ?? ""); refresh(); toast("Device marked as known"); }}>Mark as known</button><button className="text-sm font-semibold text-primary" onClick={() => setDiscoveryOpen(true)}>Run discovery</button></div></div></Panel><Panel title="Redundancy & Path Health" className="min-w-0"><div className="flex flex-1 flex-col gap-2 text-sm"><div className="flex items-center justify-between gap-3 px-2 py-1.5"><span className="text-muted-foreground">Redundant uplinks</span><b className="tabular-nums">86%</b></div><div className="flex items-center justify-between gap-3 px-2 py-1.5"><span className="text-muted-foreground">Single-uplink devices</span><b className="tabular-nums">{Math.max(1, nodes.length - links.length)}</b></div><div className="flex items-center justify-between gap-3 px-2 py-1.5"><span className="text-muted-foreground">Average path latency</span><b className="tabular-nums">{Math.round(links.reduce((sum, link) => sum + link.latencyMs, 0) / Math.max(1, links.length))} ms</b></div><div className="flex items-center justify-between gap-3 px-2 py-1.5"><span className="text-muted-foreground">Degraded LAG members</span><b className="tabular-nums">2</b></div><div className="mt-auto flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"><Signal size={14} />Path health is stable</div></div></Panel></div>
    {notice && <div role="status" className="fixed bottom-5 right-5 z-[1300] flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-lg"><Check size={16} className="text-emerald-600" />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={14} /></button></div>}
    {discoveryOpen && <div className="fixed inset-0 z-[1250] grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDiscoveryOpen(false); }}><div role="dialog" aria-modal="true" aria-labelledby="discovery-title" className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"><div className="flex items-center justify-between"><h2 id="discovery-title" className="text-base font-bold">Run network discovery</h2><button onClick={() => setDiscoveryOpen(false)} aria-label="Close dialog"><X size={17} /></button></div><p className="mt-2 text-sm text-muted-foreground">Scan all sites using LLDP, CDP, and SNMP. This mock run adds a discovery event to the shared topology store.</p><div className="mt-5 flex justify-end gap-2"><button className={buttonBase} onClick={() => setDiscoveryOpen(false)}>Cancel</button><button className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground" onClick={runDiscovery}><Sparkles size={15} />Start discovery</button></div></div></div>}
    {trace && <div className="fixed inset-0 z-[1250] grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTrace(null); }}><div role="dialog" aria-modal="true" aria-labelledby="trace-title" className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl"><div className="flex items-center justify-between"><h2 id="trace-title" className="text-base font-bold">Path trace</h2><button onClick={() => setTrace(null)} aria-label="Close dialog"><X size={17} /></button></div>{trace.length ? <div className="mt-4 max-h-80 overflow-auto"><table className="w-full text-left text-[13px]"><thead><tr className="text-xs text-muted-foreground"><th className="py-2">Hop</th><th>Device link</th><th>Latency</th><th>Utilization</th></tr></thead><tbody>{trace.map((link, index) => <tr key={link.id} className="border-t border-border"><td className="py-2">{index + 1}</td><td>{nodes.find((node) => node.id === link.source)?.name} → {nodes.find((node) => node.id === link.target)?.name}</td><td>{link.latencyMs} ms</td><td>{link.utilizationPct}%</td></tr>)}</tbody></table></div> : <p className="mt-4 rounded-lg bg-muted p-4 text-sm text-muted-foreground">No path found for these devices.</p>}<div className="mt-4 flex justify-end"><button className={buttonBase} onClick={() => setTrace(null)}>Close</button></div></div></div>}
  </div>;
}

