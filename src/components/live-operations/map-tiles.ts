/**
 * Shared basemap tile configuration for every Leaflet map in NEXUS.
 *
 * The Data Centers & Locations page (and Global Health / Network Devices) already run these
 * Esri World Canvas tiles, so the NOC live map reuses the same configuration instead of
 * introducing a second provider. No API key is required and labels stay in English.
 */
export const MAP_TILES = {
  dark: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    background: "#3f3f41",
    ocean: "#3f3f41",
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, HERE, MapmyIndia &mdash; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>',
  },
  light: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    background: "#eaeaea",
    ocean: "#eaeaea",
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, HERE, MapmyIndia &mdash; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>',
  },
} as const;

export type MapTileVariant = keyof typeof MAP_TILES;

/**
 * Web Mercator limits the tile grid to +/-85.0511 degrees latitude.
 * Constraining the tile layer to this extent stops Leaflet from requesting tiles outside the
 * world (Esri answers those with a "Map data not available" placeholder image).
 */
export const MAP_TILE_BOUNDS: [[number, number], [number, number]] = [
  [-85.0511, -180],
  [85.0511, 180],
];
