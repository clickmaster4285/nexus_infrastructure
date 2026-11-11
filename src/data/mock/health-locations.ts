import type { InfrastructureMapMarker, MapLegendCounts } from "@/components/live-operations/infrastructure-map";
import type { NocMapSite, NocMapStatus } from "@/data/mock/noc-map";

export interface HealthLocation extends InfrastructureMapMarker { health: number }

/** Shared mock fleet location status used by Global Health and Data Centers. */
export const healthLocations: HealthLocation[] = [
  { name: "New York", lat: 40.7128, lng: -74.006, status: "healthy", role: "North America", health: 99.4 },
  { name: "Toronto", lat: 43.6532, lng: -79.3832, status: "healthy", role: "North America", health: 99.2 },
  { name: "San Francisco", lat: 37.7749, lng: -122.4194, status: "healthy", role: "North America", health: 99.3 },
  { name: "São Paulo", lat: -23.5505, lng: -46.6333, status: "healthy", role: "South America", health: 99.1 },
  { name: "London", lat: 51.5072, lng: -0.1276, status: "healthy", role: "Europe", health: 99.6 },
  { name: "Frankfurt", lat: 50.1109, lng: 8.6821, status: "healthy", role: "Europe", health: 99.3 },
  { name: "Paris", lat: 48.8566, lng: 2.3522, status: "healthy", role: "Europe", health: 99.2 },
  { name: "Singapore", lat: 1.3521, lng: 103.8198, status: "healthy", role: "Asia Pacific", health: 99.1 },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503, status: "healthy", role: "Asia Pacific", health: 99.4 },
  { name: "Sydney", lat: -33.8688, lng: 151.2093, status: "healthy", role: "Asia Pacific", health: 99.0 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708, status: "warning", role: "Middle East", health: 98.7 },
  { name: "Cape Town", lat: -33.9249, lng: 18.4241, status: "critical", role: "Africa", health: 97.6 },
];

export const healthLocationCounts: MapLegendCounts = healthLocations.reduce<MapLegendCounts>((counts, location) => {
  counts[location.status] = (counts[location.status] ?? 0) + 1;
  return counts;
}, { healthy: 0, warning: 0, critical: 0 });

/** Global Health fleet: shared locations plus the NEXUS Islamabad (DC-2) site so both maps open on Islamabad, like the live NOC map. */
export const healthMapLocations = [
  ...healthLocations,
  { name: "Islamabad", lat: 33.69, lng: 73.06, status: "healthy" as const, role: "South Asia", health: 99.7 },
];

/** Adapts the fleet locations (including Islamabad) to the NOC map's site model. Shared by Global Health and Data Centers. */
export const healthMapSites: NocMapSite[] = healthMapLocations.map((location) => {
  const status: NocMapStatus = location.status === "healthy" ? "online" : location.status;
  const code = location.name.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
  return {
    id: location.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    code,
    city: location.name,
    country: location.role,
    region: location.role,
    provider: "—",
    facility: "—",
    lat: location.lat,
    lng: location.lng,
    status,
    health: location.health,
    throughput: "—",
    alerts: status === "critical" ? 3 : status === "warning" ? 1 : 0,
    uptime: "—",
    lastCheck: "just now",
    servers: [],
  };
});
