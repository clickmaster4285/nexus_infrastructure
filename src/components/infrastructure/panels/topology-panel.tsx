"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Expand,
  Minus,
  Plus,
  Workflow,
  X,
} from "lucide-react";
import { siKubernetes } from "simple-icons";

import { Icon } from "@/components/shared/icon";
import { OnPremIcon, ProviderLogo } from "@/components/shared/provider-logo";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  cloudProviders,
  infrastructureNodes,
  type InfrastructureNode,
} from "@/data/mock/infrastructure";

const TOPOLOGY_WIDTH = 895;
const TOPOLOGY_HEIGHT = 270;
const TOPOLOGY_MODAL_FIT_OPTIONS = { padding: 0.04, minZoom: 0.4, maxZoom: 2.5, duration: 300 };

const compactButton =
  "flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 text-[11px] font-medium text-[#516680] transition-colors hover:border-[#a9c8eb] hover:text-[#176dbb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-[#c6d2e1]";

function HealthBadge({ status }: { status: string }) {
  const degraded = status === "Degraded";
  return (
    <span className="flex items-center gap-1 whitespace-nowrap text-[11px] text-[#61758e] dark:text-[#a9bcd2]">
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full bg-[#20b475]", degraded && "bg-[#f0a02d]")} />
      {status}
    </span>
  );
}

const brandIconAssets: Record<string, string> = {
  mysql: "/icons/mysql-original.svg",
  postgresql: "/icons/postgresql-original.svg",
  redis: "/icons/redis-original.svg",
};

function TopologyIcon({ name, size, tone }: { name: string; size: number; tone?: string }) {
  if (name === "on-prem") return <OnPremIcon className="h-[17px] w-[17px]" />;
  const brandAsset = brandIconAssets[name];
  if (brandAsset) {
    // Static brand SVG served from /public — plain img is intentional (no next/image optimization needed for 1-2 KB icons).
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="shrink-0 object-contain" src={brandAsset} width={size} height={size} alt="" />;
  }
  if (name === "kubernetes") {
    return (
      <svg className="shrink-0" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ color: `#${siKubernetes.hex}` }}>
        <path d={siKubernetes.path} fill="currentColor" />
      </svg>
    );
  }
  if (name === "vpc") {
    return (
      <svg className="shrink-0 text-[#2782df]" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <circle cx="12" cy="12" r="3" fill="currentColor" />
        <circle cx="5" cy="6" r="2" fill="currentColor" />
        <circle cx="19" cy="6" r="2" fill="currentColor" />
        <circle cx="5" cy="18" r="2" fill="currentColor" />
        <circle cx="19" cy="18" r="2" fill="currentColor" />
        <path d="m6.7 7.4 3.1 3m7.5-3-3.1 3m-7.5 7.2 3.1-3m7.5 3-3.1-3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (name === "staging-cloud") {
    return (
      <svg className="shrink-0" style={{ color: tone === "purple" ? "#9252df" : "#2685e7" }} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path d="M7.1 19.5a5.1 5.1 0 0 1-.4-10.2A6.1 6.1 0 0 1 18.4 8a5.8 5.8 0 0 1-.2 11.5H7.1Z" fill="currentColor" />
      </svg>
    );
  }
  if (name === "web-services") {
    return (
      <svg className="shrink-0 text-[#2685e7]" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path d="M4 6.2A2.2 2.2 0 0 1 6.2 4h11.6A2.2 2.2 0 0 1 20 6.2v3.1H4zm0 5.8h16v5.8a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 17.8z" fill="currentColor" />
        <circle cx="7" cy="7.7" r=".8" fill="#fff" />
        <circle cx="9.5" cy="7.7" r=".8" fill="#fff" />
        <path d="M7 14h10m-10 2.5h6" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return <Icon name={name} size={size} />;
}

const nodeKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const initialTopologyLayout: Record<string, LayoutRect> = {
  "cloud-providers": { x: 0, y: 0, width: 175, height: 185 },
  "production-vpc": { x: 220, y: 0, width: 185, height: 79 },
  staging: { x: 220, y: 91, width: 185, height: 79 },
  "on-prem-office": { x: 220, y: 182, width: 185, height: 79 },
  "kubernetes-docker": { x: 450, y: 0, width: 200, height: 99 },
  "web-api-services": { x: 450, y: 112, width: 200, height: 94 },
  "external-endpoints": { x: 660, y: 200, width: 170, height: 70 },
  databases: { x: 690, y: 0, width: 205, height: 145 },
};

function alignTopologyRows(source: LayoutRect | undefined, targets: (LayoutRect | undefined)[]): (LayoutRect | undefined)[] {
  if (!source || targets.some((target) => !target) || !targets.length) return targets;
  const sourceCenter = targets[0]!.y + targets[0]!.height / 2;
  const targetCenter = targets.reduce((sum, target) => sum + target!.y + target!.height / 2, 0) / targets.length;
  const shift = Math.max(-4, Math.min(4, Math.round((targetCenter - sourceCenter) / 5) * 5));
  return targets.map((target, index) => {
    const vertical = index === 1 ? 0 : shift;
    const y = Math.max(0, Math.min(TOPOLOGY_HEIGHT - target!.height, target!.y - vertical));
    return y === target!.y ? target : { ...target!, y };
  });
}

// Keeps the default layout optically centered: the environment column is
// balanced against the provider card, the platform pair against that column,
// while External Endpoints stays in the clear lane below the database card.
function autoAlignedTopologyLayout(layout: Record<string, LayoutRect>): Record<string, LayoutRect> {
  const next = structuredClone(layout);
  const providers = next["cloud-providers"];
  const environmentIds = ["production-vpc", "staging", "on-prem-office"];
  const [production, staging, onPrem] = alignTopologyRows(providers, environmentIds.map((id) => next[id]));
  next["production-vpc"] = production!;
  next.staging = staging!;
  next["on-prem-office"] = onPrem!;
  const platformIds = ["kubernetes-docker", "web-api-services"];
  const environmentsCenter = environmentIds.reduce((sum, id) => sum + next[id].y + next[id].height / 2, 0) / environmentIds.length;
  const platformEdges = platformIds.map((id) => next[id]);
  const platformCenter = (platformEdges[0].y + platformEdges[1].y + platformEdges[1].height) / 2;
  const shift = Math.max(-6, Math.min(6, Math.round((platformCenter - environmentsCenter) / 5) * 5));
  platformIds.forEach((id) => {
    const node = next[id];
    node.y = Math.max(0, Math.min(TOPOLOGY_HEIGHT - node.height, node.y - shift));
  });
  return next;
}

interface Point {
  x: number;
  y: number;
}

function roundOrthogonalPath(points: Point[], radius = 8): string {
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

function rightToLeftPath(source: LayoutRect, target: LayoutRect): string {
  const start = { x: source.x + source.width, y: source.y + source.height / 2 };
  const end = { x: target.x, y: target.y + target.height / 2 };
  const bendX = start.x + (end.x - start.x) / 2;
  return roundOrthogonalPath([start, { x: bendX, y: start.y }, { x: bendX, y: end.y }, end]);
}

function rightToLeftPathAt(source: LayoutRect, targetPoint: Point): string {
  const start = { x: source.x + source.width, y: source.y + source.height / 2 };
  const bendX = start.x + (targetPoint.x - start.x) / 2;
  return roundOrthogonalPath([start, { x: bendX, y: start.y }, { x: bendX, y: targetPoint.y }, targetPoint]);
}

function topologyEdgePaths(layout: Record<string, LayoutRect>) {
  const provider = layout["cloud-providers"];
  const environmentIds = ["production-vpc", "staging", "on-prem-office"];
  const environmentCenters = environmentIds.map((id) => layout[id].y + layout[id].height / 2);
  const branchY = Math.round((Math.min(...environmentCenters) + Math.max(...environmentCenters)) / 2);
  const providerSource = { x: provider.x + provider.width, y: provider.y + 125 };
  const branchX = providerSource.x + 23;
  const providerEdges = environmentIds.map((id) => {
    const target = layout[id];
    const targetPoint = { x: target.x, y: target.y + target.height / 2 };
    return roundOrthogonalPath([providerSource, { x: branchX, y: providerSource.y }, { x: branchX, y: targetPoint.y }, targetPoint]);
  });

  const kube = layout["kubernetes-docker"];
  const web = layout["web-api-services"];
  const endpoint = layout["external-endpoints"];
  const databases = layout.databases;
  const directPlatformPath = (source: string, target: string) => rightToLeftPath(layout[source], layout[target]);
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
      directPlatformPath("production-vpc", "kubernetes-docker"),
      directPlatformPath("production-vpc", "web-api-services"),
      directPlatformPath("staging", "web-api-services"),
      directPlatformPath("on-prem-office", "kubernetes-docker"),
      kubeToWeb,
      kubeToDatabase,
      webToDatabase,
      webToEndpoint,
    ],
    branch: { x: branchX, y: branchY },
  };
}

interface TopologyCanvasHandle {
  fitView: (options?: { padding?: number; minZoom?: number; maxZoom?: number; duration?: number }) => void;
  resetLayout: (options?: { padding?: number; minZoom?: number; maxZoom?: number; duration?: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

const iconToneStyles: Record<string, string> = {
  blue: "bg-[#e6f2ff] text-[#2685e7]",
  green: "bg-[#e6f8ef] text-[#24ad72]",
  purple: "bg-[#f1eaff] text-[#9252df]",
  teal: "bg-[#e5f8f5] text-[#24aa9c]",
};

const handleIds = ["left", "right", "top", "bottom"] as const;

function TopologyHandles({ nodeId }: { nodeId: string }) {
  return (
    <>
      {handleIds.map((side) => (
        <span
          key={side}
          id={`${nodeId}-${side}-handle`}
          data-handle={side}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute h-px w-px opacity-0",
            side === "left" && "left-0 top-1/2",
            side === "right" && "right-0 top-1/2",
            side === "top" && "left-1/2 top-0",
            side === "bottom" && "bottom-0 left-1/2",
          )}
        />
      ))}
    </>
  );
}

interface DragHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
}

interface TopologyNodeProps {
  node: InfrastructureNode;
  compact?: boolean;
  position?: LayoutRect;
  handlePrefix?: string;
  dragHandlers?: DragHandlers;
}

function TopologyNode({ node, compact = false, position, handlePrefix = "card", dragHandlers }: TopologyNodeProps) {
  const key = nodeKey(node.name);
  const style = position
    ? { left: position.x, top: position.y, width: position.width, height: position.height }
    : undefined;
  return (
    <article
      data-topology-node={key}
      className={cn(
        "flex min-w-0 touch-none select-none items-start gap-2 rounded-[7px] border border-[#dce6f1] bg-card p-2.5 shadow-[0_1px_3px_#19395b08] dark:border-[#29394e]",
        !compact && "absolute",
        compact && "relative h-[35px] w-full shrink-0 items-center gap-1.5 border-0 border-b border-[#eff2f6] bg-transparent px-2 py-1.5 shadow-none last:border-b-0 dark:border-[#29394e]",
        dragHandlers && "cursor-grab active:cursor-grabbing",
      )}
      style={compact ? undefined : style}
      {...dragHandlers}
    >
      <span className={cn("grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full", iconToneStyles[node.tone] ?? iconToneStyles.blue)}>
        <TopologyIcon name={node.icon} size={compact ? 16 : 19} tone={node.tone} />
      </span>
      <div className={cn("flex min-w-0 flex-col items-start gap-1", compact && "flex-1 flex-row items-center justify-between gap-2")}>
        <b className="max-w-full truncate text-[11px] font-bold text-[#536b87] dark:text-[#c4d1e1]">{node.name}</b>
        {!compact && (
          <>
            <HealthBadge status={node.status} />
            <small className="flex items-center gap-1 whitespace-nowrap text-[11px] text-[#8393a8] dark:text-[#9babc0]">
              <Icon name="workflow" size={9} /> {node.detail}
            </small>
          </>
        )}
      </div>
      {compact && <HealthBadge status={node.status} />}
      <TopologyHandles nodeId={`${handlePrefix}-${key}`} />
    </article>
  );
}

const TopologyCanvas = forwardRef<TopologyCanvasHandle, { fitPadding?: number; fitMinZoom?: number; fitAnimationDuration?: number; idPrefix?: string; bleed?: boolean; minZoom?: number; maxZoom?: number }>(function TopologyCanvas(
  { fitPadding = 0.05, fitMinZoom, fitAnimationDuration = 200, idPrefix = "card", bleed = false, minZoom = 0.5, maxZoom = 1.2 },
  ref,
) {
  const [zoom, setZoom] = useState(1);
  const [fitDuration, setFitDuration] = useState(200);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [layout, setLayout] = useState<Record<string, LayoutRect>>(() => autoAlignedTopologyLayout(initialTopologyLayout));
  const minimumFitZoom = fitMinZoom ?? minZoom;
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number; origin: LayoutRect; startX: number; startY: number } | null>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; origin: { x: number; y: number } } | null>(null);
  const arrowId = `topology-arrow-${idPrefix}`;
  const edges = topologyEdgePaths(layout);

  const dragHandlers = (id: string): DragHandlers => ({
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { id, pointerId: event.pointerId, origin: layout[id], startX: event.clientX, startY: event.clientY };
    },
    onPointerMove: (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const nextX = Math.round((drag.origin.x + (event.clientX - drag.startX) / zoom) / 5) * 5;
      const nextY = Math.round((drag.origin.y + (event.clientY - drag.startY) / zoom) / 5) * 5;
      const maxX = TOPOLOGY_WIDTH - drag.origin.width;
      const maxY = TOPOLOGY_HEIGHT - drag.origin.height;
      setLayout((current) => ({
        ...current,
        [id]: { ...current[id], x: Math.max(0, Math.min(maxX, nextX)), y: Math.max(0, Math.min(maxY, nextY)) },
      }));
    },
    onPointerUp: (event) => {
      if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    },
    onPointerCancel: () => {
      dragRef.current = null;
    },
  });

  const fitView = useCallback(
    ({ padding = fitPadding, minZoom: requestedMinZoom = minimumFitZoom, maxZoom: fitMaxZoom = maxZoom, duration = fitAnimationDuration }: { padding?: number; minZoom?: number; maxZoom?: number; duration?: number } = {}) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const nextZoom = Math.min(fitMaxZoom, maxZoom, (viewport.clientWidth * (1 - padding * 2)) / TOPOLOGY_WIDTH, (viewport.clientHeight * (1 - padding * 2)) / TOPOLOGY_HEIGHT);
      const fittedZoom = Math.max(requestedMinZoom, nextZoom || 1);
      setFitDuration(duration);
      setZoom(fittedZoom);
      setCanvasOffset({
        x: Math.max(0, (viewport.clientWidth - TOPOLOGY_WIDTH * fittedZoom) / 2),
        y: Math.max(0, (viewport.clientHeight - TOPOLOGY_HEIGHT * fittedZoom) / 2),
      });
    },
    [fitPadding, minimumFitZoom, fitAnimationDuration, maxZoom],
  );

  const zoomBy = useCallback((amount: number) => {
    setZoom((current) => {
      const nextZoom = Math.min(maxZoom, Math.max(minZoom, Number((current + amount).toFixed(2))));
      const viewport = viewportRef.current;
      if (viewport) {
        setCanvasOffset({
          x: Math.max(0, (viewport.clientWidth - TOPOLOGY_WIDTH * nextZoom) / 2),
          y: Math.max(0, (viewport.clientHeight - TOPOLOGY_HEIGHT * nextZoom) / 2),
        });
      }
      return nextZoom;
    });
  }, [maxZoom, minZoom]);

  const resetLayout = useCallback((options?: { padding?: number; minZoom?: number; maxZoom?: number; duration?: number }) => {
    setLayout(autoAlignedTopologyLayout(initialTopologyLayout));
    fitView(options);
  }, [fitView]);

  useImperativeHandle(
    ref,
    () => ({
      fitView,
      resetLayout,
      zoomIn: () => zoomBy(0.06),
      zoomOut: () => zoomBy(-0.06),
    }),
    [fitView, resetLayout, zoomBy],
  );

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    fitView();
    const observer = new ResizeObserver(() => fitView());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitView]);

  useEffect(() => {
    const timer = window.setTimeout(() => fitView(), 50);
    return () => window.clearTimeout(timer);
  }, [fitView]);

  const handlePanStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest?.("[data-topology-node]")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: canvasOffset };
  };

  const handlePanMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    const viewport = viewportRef.current;
    if (!pan || pan.pointerId !== event.pointerId || !viewport) return;
    const visibleMargin = 72;
    const width = TOPOLOGY_WIDTH * zoom;
    const height = TOPOLOGY_HEIGHT * zoom;
    const minX = Math.min(0, visibleMargin - width);
    const maxX = Math.max(0, viewport.clientWidth - visibleMargin);
    const minY = Math.min(0, visibleMargin - height);
    const maxY = Math.max(0, viewport.clientHeight - visibleMargin);
    setCanvasOffset({
      x: Math.max(minX, Math.min(maxX, pan.origin.x + event.clientX - pan.startX)),
      y: Math.max(minY, Math.min(maxY, pan.origin.y + event.clientY - pan.startY)),
    });
  };

  const handlePanEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  };

  const handleWheelZoom = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const nextZoom = Math.min(maxZoom, Math.max(minZoom, zoom * (event.deltaY < 0 ? 1.08 : 0.92)));
    if (nextZoom === zoom) return;
    const contentX = (pointerX - canvasOffset.x) / zoom;
    const contentY = (pointerY - canvasOffset.y) / zoom;
    setZoom(nextZoom);
    setCanvasOffset({ x: pointerX - contentX * nextZoom, y: pointerY - contentY * nextZoom });
  };

  return (
    <div
      ref={viewportRef}
      onPointerDown={handlePanStart}
      onPointerMove={handlePanMove}
      onPointerUp={handlePanEnd}
      onPointerCancel={handlePanEnd}
      onWheel={handleWheelZoom}
      className={cn(
        "relative cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        bleed ? "mt-1 h-[420px] min-h-[420px] w-[calc(100%+24px)] -mx-3 -mb-2.5 flex-none" : "h-full min-h-0 w-full",
      )}
    >
      <div className="absolute h-[270px] w-[895px] origin-top-left transition-transform" style={{ left: canvasOffset.x, top: canvasOffset.y, transform: `scale(${zoom})`, transitionDuration: `${fitDuration}ms` }}>
        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" viewBox="0 0 895 270" aria-hidden="true">
          <defs>
            <marker id={arrowId} markerWidth="9" markerHeight="9" refX="9" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L9,4.5 L0,9 z" fill="#8fb8ee" />
            </marker>
          </defs>
          <g fill="none" stroke="#8fb8ee" strokeWidth="1" strokeOpacity="0.9" strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${arrowId})`}>
            {edges.providerEdges.map((path, index) => (
              <path key={`provider-${index}`} d={path} />
            ))}
            {edges.connections.map((path, index) => (
              <path key={`connection-${index}`} d={path} />
            ))}
            <circle cx={edges.branch.x} cy={edges.branch.y} r="2.4" fill="#8fb8ee" stroke="none" markerEnd="none" />
          </g>
        </svg>

        <div className="absolute inset-0 z-[1] h-full w-full">
          {/* Cloud providers column */}
          <section
            data-topology-node="cloud-providers"
            className="absolute min-w-0 cursor-grab touch-none select-none overflow-hidden rounded-[7px] border border-[#dce6f1] bg-white/85 shadow-[0_1px_3px_#19395b08] active:cursor-grabbing dark:border-[#29394e] dark:bg-[#152236]"
            style={{ left: layout["cloud-providers"].x, top: layout["cloud-providers"].y, width: layout["cloud-providers"].width, height: layout["cloud-providers"].height }}
            {...dragHandlers("cloud-providers")}
          >
            <div className="flex h-[39px] items-center gap-2 border-b border-[#e8edf4] px-2 text-[11px] font-medium text-[#526882] dark:border-[#29394e] dark:text-[#c4d1e1]">
              <span className={cn("grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full", iconToneStyles.blue)}>
                <Icon name="cloud" size={17} />
              </span>
              <b>Cloud Providers</b>
            </div>
            {cloudProviders.map((provider) => (
              <div key={provider.name} className="grid h-[48px] grid-cols-[27px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#f0f3f7] px-2 py-1 last:border-b-0 dark:border-[#29394e]">
                <span
                  className={cn(
                    "grid h-[25px] w-[25px] place-items-center rounded-full",
                    provider.tone === "orange" && "bg-[#f49a24] text-white",
                    provider.tone === "blue" && "bg-[#2684f5] text-white",
                    provider.tone === "red" && "rounded-[5px] bg-[#d7193f] text-white",
                  )}
                >
                  <ProviderLogo provider={provider.name} className="h-[17px] w-[17px] text-white" />
                </span>
                <div className="min-w-0">
                  <b className="block truncate text-[11px] font-semibold leading-tight text-[#536b87] dark:text-[#c4d1e1]">{provider.name}</b>
                  <HealthBadge status={provider.status} />
                </div>
                <small className="whitespace-nowrap text-[11px] text-[#8695a8] dark:text-[#9babc0]">{provider.assets} instances</small>
              </div>
            ))}
            <TopologyHandles nodeId={`${idPrefix}-cloud-providers`} />
          </section>

          {/* Environment nodes */}
          {infrastructureNodes.environments.map((node) => {
            const key = nodeKey(node.name);
            return <TopologyNode key={node.name} node={node} position={layout[key]} handlePrefix={idPrefix} dragHandlers={dragHandlers(key)} />;
          })}

          {/* Platform nodes */}
          {infrastructureNodes.platforms.map((node) => {
            const key = nodeKey(node.name);
            return <TopologyNode key={node.name} node={node} position={layout[key]} handlePrefix={idPrefix} dragHandlers={dragHandlers(key)} />;
          })}

          {/* External endpoints */}
          <article
            data-topology-node="external-endpoints"
            className="absolute flex min-w-0 cursor-grab touch-none select-none items-start gap-2 rounded-[7px] border border-[#dce6f1] bg-card p-2.5 shadow-[0_1px_3px_#19395b08] active:cursor-grabbing dark:border-[#29394e]"
            style={{ left: layout["external-endpoints"].x, top: layout["external-endpoints"].y, width: layout["external-endpoints"].width, height: layout["external-endpoints"].height }}
            {...dragHandlers("external-endpoints")}
          >
            <span className={cn("grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full", iconToneStyles.blue)}>
              <Icon name="globe" size={17} />
            </span>
            <div className="flex min-w-0 flex-col items-start gap-1">
              <b className="whitespace-nowrap text-[11px] font-bold text-[#536b87] dark:text-[#c4d1e1]">External Endpoints</b>
              <HealthBadge status="Healthy" />
              <small className="flex items-center gap-1 whitespace-nowrap text-[11px] text-[#8393a8] dark:text-[#9babc0]">
                <Icon name="workflow" size={9} /> 3 endpoints
              </small>
            </div>
            <TopologyHandles nodeId={`${idPrefix}-external-endpoints`} />
          </article>

          {/* Databases column */}
          <section
            data-topology-node="databases"
            className="absolute min-w-0 cursor-grab touch-none select-none overflow-hidden rounded-[7px] border border-[#dce6f1] bg-white/85 shadow-[0_1px_3px_#19395b08] active:cursor-grabbing dark:border-[#29394e] dark:bg-[#152236]"
            style={{ left: layout.databases.x, top: layout.databases.y, width: layout.databases.width, height: layout.databases.height }}
            {...dragHandlers("databases")}
          >
            <div className="flex h-[39px] items-center gap-2 border-b border-[#e8edf4] px-2 text-[11px] font-medium text-[#526882] dark:border-[#29394e] dark:text-[#c4d1e1]">
              <span className={cn("grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full", iconToneStyles.blue)}>
                <Icon name="database" size={17} />
              </span>
              <b>Databases</b>
            </div>
            <div className="flex flex-col">
              {infrastructureNodes.databases.map((node) => (
                <TopologyNode key={node.name} node={node} compact handlePrefix={idPrefix} />
              ))}
            </div>
            <TopologyHandles nodeId={`${idPrefix}-databases`} />
          </section>
        </div>
      </div>
    </div>
  );
});

interface TopologyToolbarProps {
  canvasRef: React.RefObject<TopologyCanvasHandle | null>;
  onExpand: () => void;
  onAutoLayout?: () => void;
  modal?: boolean;
  hideExpand?: boolean;
  hideZoomButtons?: boolean;
}

function TopologyToolbar({ canvasRef, onExpand, onAutoLayout, modal = false, hideExpand = false, hideZoomButtons = false }: TopologyToolbarProps) {
  const buttonClass = cn(compactButton, modal && "select-none");
  return (
    <div className={cn("absolute right-[35px] top-2.5 z-[3] flex gap-1.5", modal && "static inset-auto z-auto m-0 ml-auto")}>
      <button type="button" className={buttonClass} onClick={() => (onAutoLayout ? onAutoLayout() : canvasRef.current?.resetLayout())}>
        <Workflow size={13} aria-hidden="true" />Auto Layout
      </button>
      {!hideZoomButtons && (
        <>
          <button type="button" className={buttonClass} aria-label="Zoom out" onClick={() => canvasRef.current?.zoomOut()}>
            <Minus size={13} />
          </button>
          <button type="button" className={buttonClass} aria-label="Zoom in" onClick={() => canvasRef.current?.zoomIn()}>
            <Plus size={13} />
          </button>
        </>
      )}
      {!hideExpand && (
        <button type="button" className={buttonClass} aria-label="Expand topology" onClick={onExpand}>
          <Expand size={13} />
        </button>
      )}
    </div>
  );
}

function TopologyModal({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<TopologyCanvasHandle>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const fitAfterResize = () => canvasRef.current?.fitView(TOPOLOGY_MODAL_FIT_OPTIONS);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", fitAfterResize);
    const timer = window.setTimeout(fitAfterResize, 150);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", fitAfterResize);
      window.clearTimeout(timer);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="topology-overlay-enter fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(15,23,42,0.55)] p-4 backdrop-blur-[3px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Infrastructure Topology"
        className="topology-modal-enter flex h-[92vh] max-h-[1000px] w-[96vw] max-w-[1800px] flex-col overflow-hidden rounded-[14px] border border-[#e2e8f0] bg-card shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
      >
        <header className="flex h-14 min-h-14 items-center gap-3 border-b border-[#e2e8f0] px-5">
          <TopologyToolbar
            canvasRef={canvasRef}
            onExpand={onClose}
            onAutoLayout={() => canvasRef.current?.resetLayout(TOPOLOGY_MODAL_FIT_OPTIONS)}
            modal
            hideExpand
            hideZoomButtons
          />
          <button
            type="button"
            aria-label="Close topology"
            onClick={onClose}
            className="grid h-[27px] w-[28px] shrink-0 cursor-pointer select-none place-items-center rounded-md border border-border bg-card text-[#516680] transition-colors hover:bg-accent"
          >
            <X size={16} />
          </button>
        </header>
        <div className="relative min-h-0 w-full flex-1 overflow-hidden">
          <TopologyCanvas ref={canvasRef} fitPadding={0.04} fitMinZoom={0.4} fitAnimationDuration={300} idPrefix="modal" minZoom={0.3} maxZoom={2.5} />
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function TopologyPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const canvasRef = useRef<TopologyCanvasHandle>(null);
  const closeModal = useCallback(() => setIsExpanded(false), []);

  return (
    <>
      <Card className="relative flex h-[472px] min-w-0 flex-col overflow-hidden p-2.5">
        <TopologyToolbar canvasRef={canvasRef} onExpand={() => setIsExpanded(true)} />
        <TopologyCanvas ref={canvasRef} fitPadding={0.05} idPrefix="card" bleed />
      </Card>
      {isExpanded && <TopologyModal onClose={closeModal} />}
    </>
  );
}
