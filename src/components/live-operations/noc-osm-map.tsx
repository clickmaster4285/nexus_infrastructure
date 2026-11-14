"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { divIcon, latLngBounds, type DivIcon, type Map as LeafletMap } from "leaflet";
import { AlertTriangle, CircleAlert, Expand, LocateFixed, Minus, Plus, Server, X } from "lucide-react";

import "leaflet/dist/leaflet.css";

import { cn } from "@/lib/utils";
import { MAP_TILE_BOUNDS } from "@/components/live-operations/map-tiles";
import {
  NOC_MAP_STATUS_COLOR,
  NOC_MAP_STATUS_LABEL,
  nocMapSites,
  type NocMapServer,
  type NocMapSite,
  type NocMapStatus,
} from "@/data/mock/noc-map";

const STATUS_ORDER: NocMapStatus[] = ["online", "warning", "critical"];

/**
 * OpenStreetMap standard tiles - free basemap, no API key.
 * Light mode renders OSM as-is; dark mode applies an invert-based filter (see globals.css)
 * so the NEXUS dark theme is not blinded by the light basemap.
 * Attribution shown on the map is required by the OSM tile usage policy.
 */
const OSM_TILES = {
  light: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    background: "#aad3df",
    ocean: "#aad3df",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  },
  dark: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    background: "#101826",
    ocean: "#101826",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  },
} as const;

/** Zoom used when the caller passes an explicit center but no zoom. */
const EXPLICIT_CENTER_ZOOM = 13;

/** Severity ranking - a cluster is coloured by its worst member. */
const STATUS_WEIGHT: Record<NocMapStatus, number> = { online: 0, warning: 1, critical: 2 };

/** Matching names used by the Infrastructure Health panel so both read the same. */
const HEALTH_PANEL_LABEL: Record<NocMapStatus, string> = {
  online: "Healthy",
  warning: "Degraded",
  critical: "Offline",
};

/** Pixel radius within which nearby sites are grouped into one cluster. */
const CLUSTER_RADIUS_PX = 52;

/** Zoom level from which the site code labels are shown under each marker. */
const LABEL_ZOOM = 3;

const BUILDING_GLYPH = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/></svg>';

export interface NocMapCluster {
  id: string;
  lat: number;
  lng: number;
  status: NocMapStatus;
  sites: NocMapSite[];
  servers: NocMapServer[];
}

/** Reads the NEXUS theme so the basemap follows the header light/dark toggle. */
function useNexusDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => {
      const rootDark = document.documentElement.classList.contains("dark");
      const shellDark = document.body.querySelector(".dark") !== null;
      setDark(rootDark || shellDark);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"], subtree: true });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function worstStatus(statuses: NocMapStatus[]): NocMapStatus {
  return statuses.reduce<NocMapStatus>(
    (worst, status) => (STATUS_WEIGHT[status] > STATUS_WEIGHT[worst] ? status : worst),
    "online",
  );
}

/** 2rem round marker with a building glyph, status colour and an optional server count badge. */
function buildSiteIcon(site: NocMapSite, selected: boolean): DivIcon {
  const color = NOC_MAP_STATUS_COLOR[site.status];
  const pulse = site.status === "warning" || site.status === "critical" ? " nexus-noc-site--pulse" : "";
  const active = selected ? " nexus-noc-site--selected" : "";
  const badge = site.servers.length >= 2 ? `<span class="nexus-noc-site__badge">${site.servers.length}</span>` : "";
  return divIcon({
    className: "nexus-noc-icon",
    html: `<span class="nexus-noc-site${pulse}${active}" style="--noc-color:${color}"><span class="nexus-noc-site__ring"></span><span class="nexus-noc-site__disc">${BUILDING_GLYPH}</span>${badge}<span class="nexus-noc-site__code">${site.code}</span></span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -17],
    tooltipAnchor: [0, -15],
  });
}

/** Small square marking an individual server next to its data center. */
function buildServerIcon(server: NocMapServer, index: number, total: number): DivIcon {
  const color = NOC_MAP_STATUS_COLOR[server.status];
  const radius = total > 1 ? 18 : 16;
  const angle = total > 1 ? -Math.PI / 2 + (Math.PI * 2 * index) / total : Math.PI / 4;
  const dx = Math.cos(angle) * radius;
  const dy = Math.sin(angle) * radius;
  return divIcon({
    className: "nexus-noc-icon",
    html: `<span class="nexus-noc-server" style="--noc-color:${color}"></span>`,
    iconSize: [10, 10],
    iconAnchor: [5 - dx, 5 - dy],
    popupAnchor: [0, -7],
    tooltipAnchor: [0, -5],
  });
}

/** 2.25rem round cluster bubble coloured by the worst status it contains. */
function buildClusterIcon(cluster: NocMapCluster): DivIcon {
  const color = NOC_MAP_STATUS_COLOR[cluster.status];
  const pulse = cluster.status === "warning" || cluster.status === "critical" ? " nexus-noc-cluster--pulse" : "";
  const count = cluster.sites.length + cluster.servers.length;
  return divIcon({
    className: "nexus-noc-icon",
    html: `<span class="nexus-noc-cluster${pulse}" style="--noc-color:${color}"><span class="nexus-noc-cluster__disc">${count}</span></span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -19],
    tooltipAnchor: [0, -17],
  });
}

function StatusPill({ status }: { status: NocMapStatus }) {
  const color = NOC_MAP_STATUS_COLOR[status];
  const Icon = status === "online" ? null : status === "warning" ? AlertTriangle : CircleAlert;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[0.75rem] font-semibold"
      style={{ color, borderColor: `${color}59`, backgroundColor: `${color}1f` }}
    >
      {Icon ? <Icon size={12} aria-hidden="true" /> : null}
      {NOC_MAP_STATUS_LABEL[status]}
    </span>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const color = value >= 90 ? "#ef4444" : value >= 75 ? "#f59e0b" : "#22c55e";
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-12 shrink-0 text-[0.75rem] text-muted-foreground">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, value))}%`, backgroundColor: color }} />
      </span>
      <b className="w-9 shrink-0 text-right text-[0.75rem] tabular-nums text-foreground">{value}%</b>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-[0.75rem] text-muted-foreground">{label}</span>
      <b className="block truncate text-[0.75rem] font-medium text-foreground" title={value}>{value}</b>
    </div>
  );
}

function SitePopup({ site, onFocus }: { site: NocMapSite; onFocus: (site: NocMapSite) => void }) {
  return (
    <div className="p-3">
      <div className="flex items-start justify-between gap-2 border-b border-border pb-2">
        <div className="min-w-0">
          <b className="block truncate text-[0.8125rem] font-semibold text-foreground">{site.code} · {site.city}</b>
          <span className="block truncate text-[0.75rem] text-muted-foreground">{site.country} · {site.region}</span>
        </div>
        <StatusPill status={site.status} />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-border py-2">
        <Detail label="Provider" value={site.provider} />
        <Detail label="Facility" value={site.facility} />
        <Detail label="Throughput" value={site.throughput} />
        <Detail label="Active alerts" value={`${site.alerts}`} />
        <Detail label="Uptime" value={site.uptime} />
        <Detail label="Last check" value={site.lastCheck} />
      </div>

      <div className="flex items-center gap-2 border-b border-border py-2">
        <span className="w-12 shrink-0 text-[0.75rem] text-muted-foreground">Health</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${Math.max(2, Math.min(100, site.health))}%`,
              backgroundColor: site.health >= 99 ? "#22c55e" : site.health >= 98 ? "#f59e0b" : "#ef4444",
            }}
          />
        </span>
        <b className="w-10 shrink-0 text-right text-[0.75rem] tabular-nums text-foreground">{site.health}%</b>
      </div>

      <div className="pt-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <b className="text-[0.75rem] font-semibold text-foreground">Servers ({site.servers.length})</b>
          <span className="text-[0.75rem] text-muted-foreground">Click to focus site</span>
        </div>
        <ul className="flex flex-col gap-1">
          {site.servers.map((server) => {
            const color = NOC_MAP_STATUS_COLOR[server.status];
            return (
              <li key={server.hostname}>
                <button
                  type="button"
                  onClick={() => onFocus(site)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-[0.125rem]" style={{ backgroundColor: color }} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[0.75rem] font-medium text-foreground">{server.hostname}</b>
                    <span className="block truncate text-[0.75rem] text-muted-foreground">{server.role} · {server.ip}</span>
                  </span>
                  <span className="shrink-0 text-right text-[0.75rem] tabular-nums text-muted-foreground">{server.cpu}%</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ServerPopup({ server, site }: { server: NocMapServer; site: NocMapSite }) {
  return (
    <div className="p-3">
      <div className="flex items-start justify-between gap-2 border-b border-border pb-2">
        <div className="min-w-0">
          <b className="block truncate text-[0.8125rem] font-semibold text-foreground">{server.hostname}</b>
          <span className="block truncate text-[0.75rem] text-muted-foreground">{server.role}</span>
        </div>
        <StatusPill status={server.status} />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-border py-2">
        <Detail label="IP address" value={server.ip} />
        <Detail label="Uptime" value={server.uptime} />
        <Detail label="Operating system" value={server.os} />
        <Detail label="Last check" value={server.lastCheck} />
        <Detail label="Site" value={`${site.code} · ${site.city}`} />
        <Detail label="Provider" value={site.provider} />
      </div>

      <div className="flex flex-col gap-1.5 pt-2">
        <Meter label="CPU" value={server.cpu} />
        <Meter label="Memory" value={server.memory} />
      </div>
    </div>
  );
}

function ClusterPopup({ cluster, onSelect }: { cluster: NocMapCluster; onSelect: (site: NocMapSite) => void }) {
  return (
    <div className="p-3">
      <div className="flex items-start justify-between gap-2 border-b border-border pb-2">
        <div className="min-w-0">
          <b className="block truncate text-[0.8125rem] font-semibold text-foreground">{cluster.sites.length} locations</b>
          <span className="block truncate text-[0.75rem] text-muted-foreground">{cluster.servers.length} servers grouped</span>
        </div>
        <StatusPill status={cluster.status} />
      </div>
      <ul className="flex flex-col gap-1 pt-2">
        {cluster.sites.map((site) => (
          <li key={site.id}>
            <button
              type="button"
              onClick={() => onSelect(site)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: NOC_MAP_STATUS_COLOR[site.status] }} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[0.75rem] font-medium text-foreground">{site.code} · {site.city}</b>
                <span className="block truncate text-[0.75rem] text-muted-foreground">{site.servers.length} servers · {site.health}%</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MapReady({ onReady }: { onReady: (map: LeafletMap | null) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
    return () => onReady(null);
  }, [map, onReady]);
  return null;
}

/**
 * Fits every site into the viewport once, on mount. Used when no explicit center is passed.
 * The leaflet instance is created before layout settles (dynamic import + flex parents), so a
 * one-shot fit on mount can run against a zero-size container and clamp to maxZoom. Wait for a
 * non-zero size (flex/grid parents, dynamic chunk) via ResizeObserver before fitting.
 */
function FitOnMount({ sites, padding = FIT_PADDING }: { sites: NocMapSite[]; padding?: number | [number, number] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    const container = map.getContainer();
    const tryFit = () => {
      if (fitted.current) return true;
      if (container.clientWidth <= 0 || container.clientHeight <= 0) return false;
      fitted.current = true;
      fitAllSites(map, sites, padding, false);
      return true;
    };
    if (tryFit()) return undefined;
    const observer = new ResizeObserver(() => {
      if (tryFit()) observer.disconnect();
    });
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

/**
 * Fits every site into the viewport with the given padding.
 *
 * The declared floor is zoom 2, but a narrow card physically cannot show a global fleet at
 * that zoom (226 degrees of longitude needs more room than the card has), so the floor is
 * lowered for the duration of the fit. Afterwards the floor becomes min(2, fitted zoom) so the
 * world view stays reachable without any marker ever being clipped.
 */
function fitAllSites(map: LeafletMap, sites: NocMapSite[], padding: number | [number, number] = FIT_PADDING, animate = false) {
  const points = (sites ?? [])
    .filter((site) => site && Number.isFinite(site.lat) && Number.isFinite(site.lng))
    .map((site) => [site.lat, site.lng] as [number, number]);
  if (!points.length) return;
  const bounds = latLngBounds(points);
  if (!bounds.isValid()) return;
  const declaredFloor = map.options.minZoom ?? 2;
  try {
    map.options.minZoom = 0;
    map.fitBounds(bounds, { padding: Array.isArray(padding) ? padding : [padding, padding], maxZoom: 4, animate });
    const fitted = map.getZoom();
    map.options.minZoom = Math.min(declaredFloor, fitted);
  } catch (error) {
    map.options.minZoom = declaredFloor;
    console.warn("[NocOsmMap] fitBounds skipped:", error);
  }
}

/** Keeps the map sized to its container. The current view (default: ISB street level) is preserved. */
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        map.invalidateSize({ pan: false });
      });
    });
    observer.observe(map.getContainer());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

/** Re-clusters the markers whenever the zoom level changes. */
function ClusterWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });
  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);
  return null;
}

/**
 * Distance based grouping of nearby markers.
 * Groups sites whose pixel distance at the current zoom falls inside the cluster radius.
 */
function buildClusters(sites: NocMapSite[], map: LeafletMap | null, zoom: number): NocMapCluster[] {
  if (!map) return sites.map((site) => ({ id: site.id, lat: site.lat, lng: site.lng, status: site.status, sites: [site], servers: site.servers }));
  const groups: Array<{ lat: number; lng: number; sites: NocMapSite[] }> = [];
  sites.forEach((site) => {
    const point = map.project([site.lat, site.lng], zoom);
    const match = groups.find((group) => {
      const centre = map.project([group.lat, group.lng], zoom);
      return centre.distanceTo(point) <= CLUSTER_RADIUS_PX;
    });
    if (match) {
      match.sites.push(site);
      match.lat = match.sites.reduce((sum, item) => sum + item.lat, 0) / match.sites.length;
      match.lng = match.sites.reduce((sum, item) => sum + item.lng, 0) / match.sites.length;
      return;
    }
    groups.push({ lat: site.lat, lng: site.lng, sites: [site] });
  });
  return groups.map((group) => {
    const servers = group.sites.flatMap((site) => site.servers);
    return {
      id: group.sites.map((site) => site.id).join("-"),
      lat: group.lat,
      lng: group.lng,
      status: worstStatus(group.sites.map((site) => site.status)),
      sites: group.sites,
      servers,
    };
  });
}

const FIT_PADDING: [number, number] = [40, 40];
const COMPACT_WIDTH_PX = 360;

/** Single-row legend pill. White background, radius 62.4375rem, bottom-left inside the map; rendered below the map when the map is narrower than 22.5rem. */
function MapLegend({ siteCounts, serverTotal, below }: { siteCounts: Record<NocMapStatus, number>; serverTotal: number; below?: boolean }) {
  const pill = (
    <ul
      className="flex w-max max-w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-full border border-black/5 bg-white/95 px-2.5 py-1.5 text-[0.75rem] font-medium text-slate-800 shadow-md backdrop-blur-sm dark:border-white/10 dark:bg-slate-800/95 dark:text-slate-100"
      aria-label="Site status counts"
    >
      {STATUS_ORDER.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: NOC_MAP_STATUS_COLOR[status] }} />
          <span>{HEALTH_PANEL_LABEL[status]}</span>
          <b className="tabular-nums">{siteCounts[status]}</b>
        </li>
      ))}
      {serverTotal > 0 ? (
        <li className="flex items-center gap-1.5 border-l border-slate-200 pl-3 dark:border-slate-700">
          <Server size={12} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          <span>Servers</span>
          <b className="tabular-nums">{serverTotal}</b>
        </li>
      ) : null}
    </ul>
  );
  if (below) {
    return <div className="flex shrink-0 items-center px-1 pb-1 pt-2">{pill}</div>;
  }
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[500]">
      {pill}
    </div>
  );
}

function MapControls({ onZoomIn, onZoomOut, onReset }: { onZoomIn: () => void; onZoomOut: () => void; onReset: () => void }) {
  const buttonTone = "grid h-8 w-8 cursor-pointer place-items-center text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
  return (
    <div className="absolute left-4 top-4 z-[500] flex flex-col overflow-hidden rounded-lg border border-border bg-card/95 shadow-md backdrop-blur-sm" role="group" aria-label="Map navigation">
      <button type="button" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in" className={cn(buttonTone, "border-b border-border")}>
        <Plus size={14} />
      </button>
      <button type="button" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out" className={cn(buttonTone, "border-b border-border")}>
        <Minus size={14} />
      </button>
      <button type="button" onClick={onReset} aria-label="Reset view" title="Reset view" className={buttonTone}>
        <LocateFixed size={14} />
      </button>
    </div>
  );
}

/** Shown when the basemap tiles cannot be reached (offline / blocked network). */
function MapFallback({ sites, siteCounts, serverTotal }: { sites: NocMapSite[]; siteCounts: Record<NocMapStatus, number>; serverTotal: number }) {
  return (
    <div className="absolute inset-0 z-[520] overflow-y-auto bg-muted/90 p-4" role="status" aria-label="Map tiles unavailable; location list fallback">
      <p className="mb-3 text-[0.75rem] font-semibold text-foreground">Map tiles unavailable</p>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {sites.map((site) => (
          <li key={site.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-card px-2.5 py-1.5 text-[0.75rem] shadow-sm">
            <span className="flex min-w-0 items-center gap-2 truncate">
              <i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: NOC_MAP_STATUS_COLOR[site.status] }} />
              {site.code} · {site.city}
            </span>
            <b className="shrink-0 tabular-nums text-foreground">{site.health}%</b>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.75rem] text-muted-foreground">
        {siteCounts.online} Healthy · {siteCounts.warning} Degraded · {siteCounts.critical} Offline{serverTotal > 0 ? ` · ${serverTotal} servers` : ""}
      </p>
    </div>
  );
}

/**
 * Live Leaflet view of the NEXUS fleet.
 * Opens fit to the whole world by default so the global fleet is always visible.
 * Pass `center` (and optionally `initialZoom`) to open on a specific location instead - e.g.
 * `center={[33.69, 73.06]}` for the ISB data center. Data center pins carry their hosted
 * servers and are colour coded by status.
 */
export function NocOsmMap({
  sites = nocMapSites,
  filterStatuses = null,
  selectedSiteId = null,
  onSelectSite,
  className,
  center,
  initialZoom,
}: {
  sites?: NocMapSite[];
  /** When set, only sites with one of these statuses are rendered on the map. */
  filterStatuses?: NocMapStatus[] | null;
  selectedSiteId?: string | null;
  onSelectSite?: (site: NocMapSite) => void;
  className?: string;
  /** Optional initial center, e.g. [33.69, 73.06] for the ISB (NEXUS DC-2) data center. When omitted the map fits the whole fleet on mount. */
  center?: [number, number];
  /** Optional initial zoom. Defaults to 13 when `center` is set; derived from the fit otherwise. */
  initialZoom?: number;
}) {
  const dark = useNexusDarkMode();
  const [expanded, setExpanded] = useState(false);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [zoom, setZoom] = useState(initialZoom ?? 1);
  const [tilesFailed, setTilesFailed] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const node = surfaceRef.current;
    if (!node) return undefined;
    const update = () => setCompact(node.clientWidth < COMPACT_WIDTH_PX);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // OpenStreetMap standard tiles - light in light mode, invert-filtered in dark mode.
  const tiles = OSM_TILES[dark ? "dark" : "light"];
  const visibleSites = useMemo(
    () => (filterStatuses ? sites.filter((site) => filterStatuses.includes(site.status)) : sites),
    [sites, filterStatuses],
  );
  const siteIcons = useMemo(() => new Map(sites.map((site) => [site.id, buildSiteIcon(site, site.id === selectedSiteId)])), [sites, selectedSiteId]);
  const serverIcons = useMemo(() => {
    const icons = new Map<string, DivIcon>();
    sites.forEach((site) => {
      site.servers.forEach((server, index) => {
        icons.set(`${site.id}:${server.hostname}`, buildServerIcon(server, index, site.servers.length));
      });
    });
    return icons;
  }, [sites]);
  const siteCounts = useMemo(
    () =>
      sites.reduce<Record<NocMapStatus, number>>((counts, site) => {
        counts[site.status] += 1;
        return counts;
      }, { online: 0, warning: 0, critical: 0 }),
    [sites],
  );
  const serverTotal = useMemo(() => sites.reduce((total, site) => total + site.servers.length, 0), [sites]);
  const clusters = useMemo(() => buildClusters(visibleSites, map, zoom), [visibleSites, map, zoom]);

  const resetView = useCallback(() => {
    if (!map) return;
    if (center) {
      map.setView(center, initialZoom ?? EXPLICIT_CENTER_ZOOM, { animate: true });
      return;
    }
    fitAllSites(map, visibleSites, 40, true);
  }, [map, center, initialZoom, visibleSites]);

  const focusSite = useCallback(
    (site: NocMapSite) => {
      onSelectSite?.(site);
      if (!map) return;
      map.flyTo([site.lat, site.lng], Math.max(map.getZoom(), 6), { duration: 0.6 });
    },
    [map, onSelectSite],
  );

  /** Clicking a cluster zooms the map into the grouped locations. */
  const zoomIntoCluster = useCallback(
    (cluster: NocMapCluster) => {
      if (!map) return;
      const bounds = latLngBounds(cluster.sites.map((site) => [site.lat, site.lng] as [number, number]));
      map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 12, duration: 0.6 });
    },
    [map],
  );

  useEffect(() => {
    if (!expanded) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  // The expanded map is mounted into a portal, so its size is only known after layout.
  useEffect(() => {
    if (!expanded || !map) return;
    map.invalidateSize({ pan: false });
  }, [expanded, map]);

  const surface = (
    <div ref={surfaceRef} className={cn("relative flex h-full w-full flex-col overflow-hidden bg-card", className)}>
      <div className="relative min-h-0 w-full flex-1">
      <MapContainer
        center={center ?? [25, 20]}
        zoom={center ? initialZoom ?? EXPLICIT_CENTER_ZOOM : 1}
        minZoom={2}
        maxZoom={18}
        zoomControl={false}
        scrollWheelZoom={expanded}
        worldCopyJump={false}
        maxBounds={[[-60, -180], [85, 180]]}
        maxBoundsViscosity={1}
        className={cn("nexus-noc-map h-full w-full", zoom >= LABEL_ZOOM && "nexus-noc-map--labels")}
        style={{ background: tiles.ocean }}
      >
        <TileLayer
          url={tiles.url}
          attribution={tiles.attribution}
          maxZoom={19}
          noWrap
          bounds={MAP_TILE_BOUNDS}
          eventHandlers={{ tileerror: () => setTilesFailed(true) }}
        />
        <MapReady onReady={setMap} />
        <ClusterWatcher onZoom={setZoom} />
        {!center && <FitOnMount sites={visibleSites} />}
        <MapResizer />

        {clusters.map((cluster) =>
          cluster.sites.length > 1 ? (
            <Marker
              key={`cluster-${cluster.id}`}
              position={[cluster.lat, cluster.lng]}
              icon={buildClusterIcon(cluster)}
              eventHandlers={{ click: () => zoomIntoCluster(cluster) }}
            >
              <Tooltip direction="top" offset={[0, -17]} opacity={1}>
                <div className="text-[0.75rem] leading-snug">
                  <b>{cluster.sites.length} locations</b>
                  <br />
                  <span className="text-muted-foreground">{cluster.servers.length} servers · {NOC_MAP_STATUS_LABEL[cluster.status]}</span>
                </div>
              </Tooltip>
              <Popup minWidth={200} maxWidth={260}>
                <ClusterPopup cluster={cluster} onSelect={focusSite} />
              </Popup>
            </Marker>
          ) : (
            cluster.sites.map((site) => (
              <Marker
                key={`site-${site.id}`}
                position={[site.lat, site.lng]}
                icon={siteIcons.get(site.id)}
                title={`${site.code} · ${site.city}`}
                eventHandlers={{ click: () => onSelectSite?.(site) }}
              >
                <Tooltip direction="top" offset={[0, -15]} opacity={1}>
                  <div className="text-[0.75rem] leading-snug">
                    <b>{site.code} · {site.city}</b>
                    <br />
                    <span className="text-muted-foreground">
                      {NOC_MAP_STATUS_LABEL[site.status]} · {site.servers.length} servers · {site.uptime} uptime · checked {site.lastCheck}
                    </span>
                  </div>
                </Tooltip>
                <Popup minWidth={240} maxWidth={280}>
                  <SitePopup site={site} onFocus={focusSite} />
                </Popup>
              </Marker>
            ))
          ),
        )}

        {clusters.map((cluster) =>
          cluster.sites.length > 1
            ? null
            : cluster.sites.flatMap((site) =>
                site.servers.map((server) => (
                  <Marker
                    key={`server-${site.id}-${server.hostname}`}
                    position={[site.lat, site.lng]}
                    icon={serverIcons.get(`${site.id}:${server.hostname}`)}
                    title={`${server.hostname} · ${site.code}`}
                    zIndexOffset={400}
                  >
                    <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                      <div className="text-[0.75rem] leading-snug">
                        <b>{server.hostname}</b>
                        <br />
                        <span className="text-muted-foreground">{server.role} · {NOC_MAP_STATUS_LABEL[server.status]}</span>
                      </div>
                    </Tooltip>
                    <Popup minWidth={220} maxWidth={260}>
                      <ServerPopup server={server} site={site} />
                    </Popup>
                  </Marker>
                )),
              ),
        )}
      </MapContainer>

      <MapControls onZoomIn={() => map?.zoomIn()} onZoomOut={() => map?.zoomOut()} onReset={resetView} />
      {!compact && <MapLegend siteCounts={siteCounts} serverTotal={serverTotal} />}
      {tilesFailed && <MapFallback sites={sites} siteCounts={siteCounts} serverTotal={serverTotal} />}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Expand map"
          title="Expand map"
          className="absolute right-4 top-4 z-[500] grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-border bg-card/95 text-muted-foreground shadow-md backdrop-blur-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Expand size={14} />
        </button>
      )}
      </div>
      {compact && <MapLegend siteCounts={siteCounts} serverTotal={serverTotal} below />}
    </div>
  );

  if (expanded && typeof document !== "undefined") {
    return createPortal(
      <div className="fixed inset-0 z-[1200] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Infrastructure map - expanded">
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <b className="block truncate font-display text-[0.8125rem] font-bold text-foreground">Infrastructure Map</b>
              <p className="truncate text-[0.75rem] text-muted-foreground">Global data center and server locations</p>
            </div>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[0.75rem] font-medium text-foreground">
              {sites.length} sites{serverTotal > 0 ? ` · ${serverTotal} servers` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Close expanded map"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground shadow-md transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={16} />
          </button>
        </div>
        <div className="relative min-h-0 flex-1 p-4">{surface}</div>
      </div>,
      document.body,
    );
  }

  return surface;
}
