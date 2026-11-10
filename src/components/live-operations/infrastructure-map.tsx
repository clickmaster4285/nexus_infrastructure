"use client";

import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { Expand, LocateFixed, Minimize2, X } from "lucide-react";

import "leaflet/dist/leaflet.css";

import { cn } from "@/lib/utils";
import { nocMarkers, type MarkerStatus, type NocMarker } from "@/data/mock/live-operations";

const statusColors: Record<MarkerStatus, string> = {
  healthy: "#22c55e",
  warning: "#f59e0b",
  critical: "#ef4444",
};

// Esri World Canvas — free basemap, no API key (attribution shown on the map).
const TILES = {
  dark: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    background: "#0b1220",
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, HERE, MapmyIndia &mdash; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>',
  },
  light: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    background: "#eef2f7",
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, HERE, MapmyIndia &mdash; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>',
  },
} as const;

export interface MapLegendCounts {
  healthy?: number;
  warning?: number;
  critical?: number;
}

type MapVariant = keyof typeof TILES;

export type InfrastructureMapMarker = NocMarker;

function NocMap({
  zoom = 2,
  variant = "dark",
  markers = nocMarkers,
  center = [31, 15],
}: {
  zoom?: number;
  variant?: MapVariant;
  markers?: InfrastructureMapMarker[];
  center?: [number, number];
}) {
  const tiles = TILES[variant];
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      zoomControl={false}
      minZoom={2}
      maxZoom={12}
      scrollWheelZoom={false}
      className="h-full w-full"
      style={{ background: tiles.background }}
    >
      <MapZoomControls center={center} zoom={zoom} light={variant === "light"} />
      <TileLayer url={tiles.url} attribution={tiles.attribution} maxZoom={16} />
      {markers.flatMap((marker) => [
        <CircleMarker
          key={`${marker.name}-glow`}
          center={[marker.lat, marker.lng]}
          radius={13}
          pathOptions={{ color: "transparent", weight: 0, fillColor: statusColors[marker.status], fillOpacity: 0.22 }}
        />,
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
        >
          <Tooltip direction="top" offset={[0, -6]} opacity={0.97}>
            <div className="text-[11px] leading-snug">
              <b>{marker.name}</b>
              <br />
              <span className="text-slate-500">{marker.role}</span>
            </div>
          </Tooltip>
          <Popup>
            <div className="min-w-[120px] text-[11px] leading-snug">
              <b>{marker.name}</b>
              <br />
              <span>{marker.role}</span>
            </div>
          </Popup>
        </CircleMarker>,
      ])}
    </MapContainer>
  );
}

function MapZoomControls({ center, zoom, light }: { center: [number, number]; zoom: number; light: boolean }) {
  const map = useMap();
  const buttonTone = light
    ? "border-[#d8e2ef] bg-white/95 text-[#284466] hover:bg-[#eff6ff] focus-visible:ring-[#3788f3]"
    : "border-white/15 bg-slate-950/85 text-slate-100 hover:bg-slate-800 focus-visible:ring-cyan-400";
  return (
    <div className="absolute left-2 top-2 z-[500] flex flex-col overflow-hidden rounded-md border border-white/30 shadow-md shadow-slate-900/15 backdrop-blur-sm" role="group" aria-label="Map navigation">
      <button type="button" onClick={() => map.zoomIn()} aria-label="Zoom in" title="Zoom in" className={cn("grid h-7 w-7 cursor-pointer place-items-center border-b text-base font-medium leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset", buttonTone)}>+</button>
      <button type="button" onClick={() => map.zoomOut()} aria-label="Zoom out" title="Zoom out" className={cn("grid h-7 w-7 cursor-pointer place-items-center text-base font-medium leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset", buttonTone)}>−</button>
      <button type="button" onClick={() => map.setView(center, zoom, { animate: true })} aria-label="Reset map view" title="Reset map view" className={cn("grid h-6 w-7 cursor-pointer place-items-center border-t transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset", buttonTone)}><LocateFixed size={12} /></button>
    </div>
  );
}

const darkLegend = (counts?: MapLegendCounts) => (
  <div className="pointer-events-none absolute bottom-2 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-3 rounded-md bg-slate-950/70 px-3 py-1.5 text-[9px] font-medium text-slate-100 backdrop-blur-sm">
    {(["healthy", "warning", "critical"] as const).map((status) => (
      <span key={status} className="flex items-center gap-1.5 capitalize">
        <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ background: statusColors[status] }} />
        {counts?.[status] != null ? <b className="tabular-nums text-slate-100">{counts[status]} {status}</b> : status}
      </span>
    ))}
  </div>
);

const lightLegendLabel: Record<MarkerStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
};

const lightLegend = (counts?: MapLegendCounts) => (
  <div className="flex flex-none items-center justify-center gap-5 border-t border-[#e3e9f1] bg-[#f5f7fb] px-2 py-1.5">
    {(["healthy", "warning", "critical"] as const).map((status) => {
      return (
        <span key={status} className="flex items-center gap-1.5 whitespace-nowrap text-[10px] font-medium text-[#52637a]">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: statusColors[status] }} />
          {lightLegendLabel[status]}
          {counts?.[status] != null && <b className="tabular-nums text-[#15243b]">{counts[status]}</b>}
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
}: {
  variant?: MapVariant;
  legendCounts?: MapLegendCounts;
  markers?: InfrastructureMapMarker[];
  center?: [number, number];
  title?: string;
  description?: string;
  zoom?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLight = variant === "light";

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
          ? "border-[#e3e9f1] bg-white/85 text-[#52637a] hover:bg-white"
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
            <b className="font-display text-[12px] font-bold text-slate-100">{title}</b>
            <p className="text-[9px] text-slate-400">{description}</p>
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
          <NocMap zoom={Math.max(zoom, 3)} variant={variant} markers={markers} center={center} />
          {!isLight && darkLegend(legendCounts)}
        </div>
        {isLight && lightLegend(legendCounts)}
      </div>
    );
  }

  if (isLight) {
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-md border border-[#e3e9f1]">
        <div className="relative min-h-0 flex-1 [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-[#eef2f7] [&_.leaflet-control-attribution]:!rounded [&_.leaflet-control-attribution]:!bg-white/85 [&_.leaflet-control-attribution]:!px-1.5 [&_.leaflet-control-attribution]:!py-0.5 [&_.leaflet-control-attribution]:!text-[8px] [&_.leaflet-control-attribution]:!text-slate-500 [&_.leaflet-control-attribution_a]:!text-slate-600 [&_.leaflet-tile]:transition-opacity [&_.leaflet-tile]:duration-300">
          <NocMap zoom={zoom} variant="light" markers={markers} center={center} />
          {expandButton}
        </div>
        {lightLegend(legendCounts)}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-white/10 [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-[#0b1220] [&_.leaflet-control-attribution]:!rounded [&_.leaflet-control-attribution]:!bg-slate-950/60 [&_.leaflet-control-attribution]:!px-1.5 [&_.leaflet-control-attribution]:!py-0.5 [&_.leaflet-control-attribution]:!text-[7px] [&_.leaflet-control-attribution]:!text-slate-400 [&_.leaflet-control-attribution_a]:!text-slate-300">
      <NocMap zoom={zoom} variant="dark" markers={markers} center={center} />
      {expandButton}
      {darkLegend(legendCounts)}
    </div>
  );
}
