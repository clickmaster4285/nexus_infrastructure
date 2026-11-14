"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { latLngBounds } from "leaflet";
import { Expand, LocateFixed, Minimize2, X } from "lucide-react";

import "leaflet/dist/leaflet.css";

import { cn } from "@/lib/utils";
import { nocMarkers, type MarkerStatus, type NocMarker } from "@/data/mock/live-operations";
import { MAP_TILES } from "@/components/live-operations/map-tiles";

const statusColors: Record<MarkerStatus, string> = {
  healthy: "#22c55e",
  warning: "#f59e0b",
  critical: "#ef4444",
};

// Esri World Canvas — free basemap, no API key (attribution shown on the map).
const TILES = MAP_TILES;

export interface MapLegendCounts {
  healthy?: number;
  warning?: number;
  critical?: number;
}

type MapVariant = keyof typeof TILES;

export interface InfrastructureMapMarker {
  name: string;
  lat: number;
  lng: number;
  status: MarkerStatus;
  role: string;
  servers?: number;
  health?: number;
  /** Optional compact badge shown on aggregated location markers. */
  count?: number;
  /** Optional page-specific details shown in the marker tooltip and popup. */
  details?: string;
  /** Optional page-specific React content shared by the hover tooltip and popup. */
  content?: ReactNode;
}

function NocMap({
  zoom = 2,
  variant = "dark",
  markers = nocMarkers,
  center = [31, 15],
  fitMarkers = false,
  fitPadding = 28,
  minZoom = 2,
  criticalPulseOnly = false,
  onTileError,
  onMarkerClick,
}: {
  zoom?: number;
  variant?: MapVariant;
  markers?: InfrastructureMapMarker[];
  center?: [number, number];
  fitMarkers?: boolean;
  fitPadding?: number;
  minZoom?: number;
  criticalPulseOnly?: boolean;
  onTileError?: () => void;
  onMarkerClick?: (marker: InfrastructureMapMarker) => void;
}) {
  const tiles = TILES[variant];
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      zoomControl={false}
      minZoom={minZoom}
      maxZoom={12}
      scrollWheelZoom={false}
      className="h-full w-full"
      style={{ background: tiles.background }}
    >
      <MapZoomControls center={center} zoom={zoom} light={variant === "light"} fitMarkers={fitMarkers} markers={markers} fitPadding={fitPadding} />
      {fitMarkers && <FitMarkers markers={markers} padding={fitPadding} />}
      <TileLayer url={tiles.url} attribution={tiles.attribution} maxZoom={16} eventHandlers={{ tileerror: () => onTileError?.() }} />
      {markers.flatMap((marker) => [
        ...(criticalPulseOnly && marker.status !== "critical" ? [] : [<CircleMarker
          key={`${marker.name}-glow`}
          center={[marker.lat, marker.lng]}
          radius={marker.status === "critical" ? 15 : 13}
          pathOptions={{ color: "transparent", weight: 0, fillColor: statusColors[marker.status], fillOpacity: 0.22,           className: marker.status === "critical" && criticalPulseOnly ? "animate-noc-marker-pulse motion-reduce:animate-none" : undefined }}
        />]),
        <CircleMarker
          key={marker.name}
          center={[marker.lat, marker.lng]}
          radius={marker.status === "critical" ? 7.5 : 5.5}
          pathOptions={{
            color: "#ffffff",
            weight: 1.6,
            fillColor: statusColors[marker.status],
            fillOpacity: 0.95,
          }}
          eventHandlers={onMarkerClick ? { click: () => onMarkerClick(marker) } : undefined}
        >
          {marker.count != null && marker.count > 1 && <Tooltip permanent direction="center" className="!border-0 !bg-transparent !p-0 !shadow-none"><span className="grid h-4 min-w-4 place-items-center rounded-full border border-white bg-white px-1 text-[0.625rem] font-bold leading-none text-slate-800 shadow-sm">{marker.count}</span></Tooltip>}
          <Tooltip direction="top" offset={[0, -12]} opacity={0.97} permanent={false} sticky={false} className="!z-[450] !max-w-[16.25rem] !whitespace-normal !break-words !rounded-md !px-3 !py-2 !shadow-md">
            {marker.content ?? <div className="max-w-[14.75rem] whitespace-normal break-words text-[0.75rem] leading-snug"><b>{marker.name}</b><br /><span className="text-slate-500">{marker.details ?? `${marker.status} · ${marker.servers ?? "—"} servers · ${marker.health ?? 0}% health`}</span></div>}
          </Tooltip>
          <Popup>
            {marker.content ?? <div className="min-w-[7.5rem] max-w-[16.25rem] whitespace-normal break-words text-[0.75rem] leading-snug"><b>{marker.name}</b><br /><span>{marker.details ?? `${marker.role} · ${marker.servers ?? "—"} servers · ${marker.health ?? 0}% health`}</span></div>}
          </Popup>
        </CircleMarker>,
      ])}
    </MapContainer>
  );
}

function MapZoomControls({ center, zoom, light, fitMarkers, markers, fitPadding }: { center: [number, number]; zoom: number; light: boolean; fitMarkers: boolean; markers: InfrastructureMapMarker[]; fitPadding: number }) {
  const map = useMap();
  const resetView = () => {
    if (fitMarkers && markers.length) {
      const bounds = latLngBounds(markers.map(({ lat, lng }) => [lat, lng] as [number, number]));
      map.fitBounds(bounds, { padding: [fitPadding, fitPadding], maxZoom: 4, animate: true });
    } else {
      map.setView(center, zoom, { animate: true });
    }
  };
  const buttonTone = light
    ? "border-[#d8e2ef] bg-white/95 text-[#284466] hover:bg-blue-50 focus-visible:ring-[#3788f3]"
    : "border-white/15 bg-slate-950/85 text-slate-100 hover:bg-slate-800 focus-visible:ring-cyan-400";
  return (
    <div className="absolute left-2 top-2 z-[500] flex flex-col overflow-hidden rounded-md border border-white/30 shadow-md shadow-slate-900/15 backdrop-blur-sm" role="group" aria-label="Map navigation">
      <button type="button" onClick={() => map.zoomIn()} aria-label="Zoom in" title="Zoom in" className={cn("grid h-7 w-7 cursor-pointer place-items-center border-b text-base font-medium leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset", buttonTone)}>+</button>
      <button type="button" onClick={() => map.zoomOut()} aria-label="Zoom out" title="Zoom out" className={cn("grid h-7 w-7 cursor-pointer place-items-center text-base font-medium leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset", buttonTone)}>−</button>
      <button type="button" onClick={resetView} aria-label="Reset map view" title="Reset map view" className={cn("grid h-6 w-7 cursor-pointer place-items-center border-t transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset", buttonTone)}><LocateFixed size={12} /></button>
    </div>
  );
}

function FitMarkers({ markers, padding = 28 }: { markers: InfrastructureMapMarker[]; padding?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!markers.length) return;
    const bounds = latLngBounds(markers.map(({ lat, lng }) => [lat, lng] as [number, number]));
    map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 4, animate: false });
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, markers]);
  return null;
}

const darkLegend = (counts?: MapLegendCounts, position: "center" | "left" = "center", labels?: Partial<Record<MarkerStatus, string>>) => (
  <div className={cn("pointer-events-none absolute bottom-2 z-[500] flex items-center gap-3 max-w-[54%] flex-wrap rounded-md bg-slate-950/70 px-3 py-1.5 text-[0.75rem] font-medium text-slate-100 backdrop-blur-sm", position === "left" ? "left-2" : "left-1/2 -translate-x-1/2")}>
    {(["healthy", "warning", "critical"] as const).map((status) => (
      <span key={status} className="flex items-center gap-1.5 capitalize">
        <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: statusColors[status] }} />
        {counts?.[status] != null ? <b className="tabular-nums text-slate-100">{counts[status]} {labels?.[status] ?? status}</b> : labels?.[status] ?? status}
      </span>
    ))}
  </div>
);

const lightLegendLabel: Record<MarkerStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
};

const lightLegend = (counts?: MapLegendCounts, overlay = false, labels?: Partial<Record<MarkerStatus, string>>) => (
  <div className={cn("flex items-center justify-center gap-3 text-[0.75rem] font-medium", overlay ? "max-w-none flex-nowrap rounded-full bg-white/90 px-2.5 py-1.5 text-[#52637a] shadow-md backdrop-blur-sm" : "flex-none border-t border-border bg-[#f5f7fb] px-2 py-1.5 text-[#52637a]")}>
    {(["healthy", "warning", "critical"] as const).map((status) => {
      return (
        <span key={status} className="flex items-center gap-1.5 whitespace-nowrap text-[0.75rem] font-medium text-[#52637a]">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: statusColors[status] }} />
          {labels?.[status] ?? lightLegendLabel[status]}
          {counts?.[status] != null && <b className="tabular-nums text-foreground">{counts[status]}</b>}
        </span>
      );
    })}
  </div>
);

/** Dark or light world map of the fleet with one marker per monitored location. */
export function InfrastructureMap({
  variant = "dark",
  legendCounts,
  markers = nocMarkers,
  center = [31, 15],
  title = "Infrastructure Map",
  description = "14 locations · live fleet status",
  zoom = 2,
  fitMarkers = false,
  fitPadding = 28,
  minZoom = 2,
  criticalPulseOnly = false,
  legendPosition = "footer",
  legendLabels,
  fallbackOnTileError = false,
  onMarkerClick,
}: {
  variant?: MapVariant;
  legendCounts?: MapLegendCounts;
  markers?: InfrastructureMapMarker[];
  center?: [number, number];
  title?: string;
  description?: string;
  zoom?: number;
  fitMarkers?: boolean;
  fitPadding?: number;
  minZoom?: number;
  criticalPulseOnly?: boolean;
  legendPosition?: "footer" | "overlay-left";
  legendLabels?: Partial<Record<MarkerStatus, string>>;
  fallbackOnTileError?: boolean;
  onMarkerClick?: (marker: InfrastructureMapMarker) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tileFailed, setTileFailed] = useState(false);
  const isLight = variant === "light";
  const fallback = fallbackOnTileError && tileFailed ? <div className="absolute inset-0 z-[430] overflow-y-auto bg-[#eef2f7] p-3 text-slate-700" role="status" aria-label="Map tiles unavailable; location list fallback"><p className="mb-2 text-[0.75rem] font-semibold">Map tiles unavailable · Locations</p><ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{markers.map((marker) => <li key={marker.name} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-white/90 px-2.5 py-1.5 text-[0.75rem] shadow-sm"><span className="flex min-w-0 items-center gap-2 truncate"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusColors[marker.status] }} />{marker.name}</span><b className="shrink-0 tabular-nums">{marker.health ?? "—"}%</b></li>)}</ul></div> : null;

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

  const expandButton = (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      aria-label={expanded ? "Minimize map" : "Expand map"}
      className={cn(
        "absolute right-2 top-2 z-[500] grid h-7 w-7 cursor-pointer place-items-center rounded-md border backdrop-blur-sm transition-colors",
        isLight
          ? "border-border bg-white/85 text-[#52637a] hover:bg-white"
          : "border-white/10 bg-slate-950/70 text-slate-100 hover:bg-slate-800",
      )}
    >
      {expanded ? <Minimize2 size={13} /> : <Expand size={13} />}
    </button>
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-[1000] flex flex-col bg-slate-950/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${title} — expanded`}>
        <div className="flex h-14 flex-none items-center justify-between border-b border-white/10 px-4">
          <div>
            <b className="font-display text-[0.75rem] font-bold text-slate-100">{title}</b>
            <p className="text-[0.5625rem] text-slate-400">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Close map"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-md border border-white/10 text-slate-100 transition-colors hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>
        <div className="relative min-h-0 flex-1">
          <NocMap zoom={Math.max(zoom, minZoom)} variant={variant} markers={markers} center={center} fitMarkers={fitMarkers} fitPadding={fitPadding} minZoom={minZoom} criticalPulseOnly={criticalPulseOnly} onTileError={() => setTileFailed(true)} onMarkerClick={onMarkerClick} />
          {fallback}
          {!isLight && darkLegend(legendCounts, legendPosition === "overlay-left" ? "left" : "center", legendLabels)}
          {isLight && legendPosition === "overlay-left" && <div className="pointer-events-none absolute bottom-2 left-2 z-[500]">{lightLegend(legendCounts, true, legendLabels)}</div>}
        </div>
        {isLight && legendPosition === "footer" && lightLegend(legendCounts)}
      </div>
    );
  }

  if (isLight) {
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-md border border-border">
        <div className="relative min-h-0 flex-1 [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-[#eef2f7] [&_.leaflet-tooltip-pane]:!z-[450] [&_.leaflet-tooltip]:!max-w-[16.25rem] [&_.leaflet-tooltip]:!whitespace-normal [&_.leaflet-tooltip]:!break-words [&_.leaflet-control-attribution]:!rounded [&_.leaflet-control-attribution]:!bg-white/90 [&_.leaflet-control-attribution]:!px-1.5 [&_.leaflet-control-attribution]:!py-0.5 [&_.leaflet-control-attribution]:!max-w-none [&_.leaflet-control-attribution]:!whitespace-nowrap [&_.leaflet-control-attribution]:!text-right [&_.leaflet-control-attribution]:!text-[0.625rem] [&_.leaflet-control-attribution]:!text-slate-500 [&_.leaflet-control-attribution_a]:!text-slate-600 [&_.leaflet-tile]:transition-opacity [&_.leaflet-tile]:duration-300 [&_.leaflet-control-attribution]:!z-[450]">
          <NocMap zoom={zoom} variant="light" markers={markers} center={center} fitMarkers={fitMarkers} fitPadding={fitPadding} minZoom={minZoom} criticalPulseOnly={criticalPulseOnly} onTileError={() => setTileFailed(true)} onMarkerClick={onMarkerClick} />
          {fallback}
          {expandButton}
      {legendPosition === "overlay-left" && <div className="pointer-events-none absolute bottom-2 left-2 z-[500]">{lightLegend(legendCounts, true, legendLabels)}</div>}
        </div>
        {legendPosition === "footer" && lightLegend(legendCounts)}
      </div>
    );
  }

    return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-white/10 [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-[#0b1220] [&_.leaflet-control-attribution]:!rounded [&_.leaflet-control-attribution]:!bg-slate-950/70 [&_.leaflet-control-attribution]:!px-1.5 [&_.leaflet-control-attribution]:!py-0.5 [&_.leaflet-control-attribution]:!max-w-none [&_.leaflet-control-attribution]:!whitespace-nowrap [&_.leaflet-control-attribution]:!text-right [&_.leaflet-control-attribution]:!text-[0.625rem] [&_.leaflet-control-attribution]:!text-slate-400 [&_.leaflet-control-attribution_a]:!text-slate-300">
      <NocMap zoom={zoom} variant="dark" markers={markers} center={center} fitMarkers={fitMarkers} fitPadding={fitPadding} criticalPulseOnly={criticalPulseOnly} onMarkerClick={onMarkerClick} />
      {expandButton}
      {fallback}
      {darkLegend(legendCounts, legendPosition === "overlay-left" ? "left" : "center", legendLabels)}
    </div>
  );
}
