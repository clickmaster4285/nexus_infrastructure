"use client";

import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { Check, Expand, Minimize2, TriangleAlert, OctagonAlert, X } from "lucide-react";

import "leaflet/dist/leaflet.css";

import { cn } from "@/lib/utils";
import { nocMarkers, type MarkerStatus } from "@/data/mock/live-operations";

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

function NocMap({ zoom = 2, variant = "dark" }: { zoom?: number; variant?: MapVariant }) {
  const tiles = TILES[variant];
  return (
    <MapContainer
      center={[31, 15]}
      zoom={zoom}
      minZoom={2}
      maxZoom={12}
      scrollWheelZoom={false}
      className="h-full w-full"
      style={{ background: tiles.background }}
    >
      <TileLayer url={tiles.url} attribution={tiles.attribution} maxZoom={16} />
      {nocMarkers.flatMap((marker) => [
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
        </CircleMarker>,
      ])}
    </MapContainer>
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

const lightLegendIcon: Record<MarkerStatus, typeof Check> = {
  healthy: Check,
  warning: TriangleAlert,
  critical: OctagonAlert,
};

const lightLegendLabel: Record<MarkerStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
};

const lightLegend = (counts?: MapLegendCounts) => (
  <div className="grid flex-none grid-cols-3 gap-2 border-t border-[#e3e9f1] bg-[#f5f7fb] p-2">
    {(["healthy", "warning", "critical"] as const).map((status) => {
      const Icon = lightLegendIcon[status];
      return (
        <div key={status} className="flex items-center justify-center gap-2 rounded-md border border-[#e3e9f1] bg-card px-2 py-1.5">
          <span
            aria-hidden="true"
            className="grid h-[22px] w-[22px] place-items-center rounded-full"
            style={{ background: `${statusColors[status]}26`, color: statusColors[status] }}
          >
            <Icon size={13} strokeWidth={2.6} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[8px] font-semibold uppercase tracking-wide text-[#738198]">{lightLegendLabel[status]}</span>
            <b className="mt-1 font-display text-[19px] font-extrabold tabular-nums text-[#15243b]">{counts?.[status] ?? 0}</b>
          </span>
        </div>
      );
    })}
  </div>
);

/** Dark or light world map of the fleet with one marker per monitored location. */
export function InfrastructureMap({ variant = "dark", legendCounts }: { variant?: MapVariant; legendCounts?: MapLegendCounts }) {
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
      <div className="fixed inset-0 z-[1000] flex flex-col bg-slate-950/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Infrastructure Map — expanded">
        <div className="flex h-14 flex-none items-center justify-between border-b border-white/10 px-4">
          <div>
            <b className="font-display text-[12px] font-bold text-slate-100">Infrastructure Map</b>
            <p className="text-[9px] text-slate-400">14 locations · live fleet status</p>
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
          <NocMap zoom={3} variant={variant} />
          {!isLight && darkLegend(legendCounts)}
        </div>
        {isLight && lightLegend(legendCounts)}
      </div>
    );
  }

  if (isLight) {
    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-md border border-[#e3e9f1]">
        <div className="relative min-h-0 flex-1 [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-[#eef2f7] [&_.leaflet-control-attribution]:!rounded [&_.leaflet-control-attribution]:!bg-white/80 [&_.leaflet-control-attribution]:!px-1.5 [&_.leaflet-control-attribution]:!py-0.5 [&_.leaflet-control-attribution]:!text-[7px] [&_.leaflet-control-attribution]:!text-slate-400 [&_.leaflet-control-attribution_a]:!text-slate-500">
          <NocMap zoom={2} variant="light" />
          {expandButton}
        </div>
        {lightLegend(legendCounts)}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-white/10 [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-[#0b1220] [&_.leaflet-control-attribution]:!rounded [&_.leaflet-control-attribution]:!bg-slate-950/60 [&_.leaflet-control-attribution]:!px-1.5 [&_.leaflet-control-attribution]:!py-0.5 [&_.leaflet-control-attribution]:!text-[7px] [&_.leaflet-control-attribution]:!text-slate-400 [&_.leaflet-control-attribution_a]:!text-slate-300">
      <NocMap zoom={2} variant="dark" />
      {expandButton}
      {darkLegend(legendCounts)}
    </div>
  );
}
