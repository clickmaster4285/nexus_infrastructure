import type { InfrastructureMapMarker, MapLegendCounts } from "@/components/live-operations/infrastructure-map";

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
