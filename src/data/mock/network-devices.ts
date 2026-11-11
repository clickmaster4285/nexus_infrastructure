/**
 * Single mock source for the Network Devices page.
 * Every displayed number (stats strip, donut, trend, worst sites, device types,
 * manufacturers, alerts) derives from the `networkDevices` array - nothing is hardcoded in JSX.
 *
 * Fleet layout: Karachi 24 · Islamabad 22 · Lahore 12 · Rawalpindi 14 · Peshawar 8 · Dubai 6 = 86.
 * Status mix: 78 Online · 5 Warning · 3 Offline.
 */

export type NetworkDeviceStatus = "Online" | "Warning" | "Offline";
export type NetworkDeviceType = "Switch" | "Router" | "Firewall" | "Access Point";

export interface NetworkDevice {
  id: string;
  name: string;
  ip: string;
  type: NetworkDeviceType;
  maker: string;
  location: string;
  status: NetworkDeviceStatus;
  uptime: number;
  latencyMs: number;
  seen: string;
}

const SITE_PLANS: Array<{ name: string; types: Record<NetworkDeviceType, number> }> = [
  { name: "Karachi", types: { Switch: 9, Router: 8, Firewall: 4, "Access Point": 3 } },
  { name: "Islamabad", types: { Switch: 8, Router: 7, Firewall: 4, "Access Point": 3 } },
  { name: "Lahore", types: { Switch: 5, Router: 4, Firewall: 2, "Access Point": 1 } },
  { name: "Rawalpindi", types: { Switch: 5, Router: 5, Firewall: 2, "Access Point": 2 } },
  { name: "Peshawar", types: { Switch: 3, Router: 3, Firewall: 1, "Access Point": 1 } },
  { name: "Dubai", types: { Switch: 3, Router: 2, Firewall: 1, "Access Point": 0 } },
];

const TYPE_PREFIX: Record<NetworkDeviceType, string> = { Switch: "SW", Router: "RTR", Firewall: "FW", "Access Point": "AP" };

/** Deterministic PRNG so the fleet is stable between reloads. */
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Interleave the maker pool deterministically so manufacturers are spread across the fleet. */
const MAKERS: string[] = (() => {
  const pool: string[] = [
    ...Array(28).fill("Cisco"),
    ...Array(24).fill("HP"),
    ...Array(17).fill("Juniper"),
    ...Array(10).fill("Huawei"),
    ...Array(7).fill("Others"),
  ];
  return pool
    .map((maker, index) => ({ maker, key: (index * 41) % 86 }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.maker);
})();

const overrides: Record<string, { status: NetworkDeviceStatus; health: number }> = {
  "SW-01": { status: "Offline", health: 96.8 },
  "SW-11": { status: "Offline", health: 97.2 },
  "AP-10": { status: "Offline", health: 97.6 },
  "SW-03": { status: "Warning", health: 98.4 },
  "SW-24": { status: "Warning", health: 98.9 },
  "AP-05": { status: "Warning", health: 98.6 },
  "FW-05": { status: "Warning", health: 98.1 },
  "RTR-18": { status: "Warning", health: 98.7 },
};

const HERO_RENAMES: Record<string, string> = {
  "SW-01": "SW-CORE-01",
  "RTR-09": "RTR-EDGE-01",
  "FW-05": "FW-01",
  "AP-10": "AP-01",
  "SW-24": "SW-DIST-02",
};

const counters: Record<NetworkDeviceType, number> = { Switch: 0, Router: 0, Firewall: 0, "Access Point": 0 };
const rand = mulberry32(42);

export const networkDevices: NetworkDevice[] = SITE_PLANS.flatMap((site, siteIndex) =>
  (Object.keys(site.types) as NetworkDeviceType[]).flatMap((type) => {
    const count = site.types[type];
    return Array.from({ length: count }, () => {
      counters[type] += 1;
      const seq = counters[type];
      const rawName = `${TYPE_PREFIX[type]}-${String(seq).padStart(2, "0")}`;
      const override = overrides[rawName];
      const status: NetworkDeviceStatus = override?.status ?? "Online";
      const uptime =
        override?.health ??
        Number((99 + rand() * 0.9 + (rand() > 0.5 ? 0 : 0.05)).toFixed(1));
      const seen = status === "Online" ? `${Math.floor(rand() * 50) + 2}s ago` : `${Math.floor(rand() * 58) + 1}m ago`;
      const device: NetworkDevice = {
        id: rawName.toLowerCase(),
        name: HERO_RENAMES[rawName] ?? rawName,
        ip: `192.168.${10 + siteIndex}.${20 + seq}`,
        type,
        maker: MAKERS[counters.Switch + counters.Router + counters.Firewall + counters["Access Point"] - 1],
        location: site.name,
        status,
        uptime,
        latencyMs: status === "Online" ? Math.round(3 + rand() * 18) : status === "Warning" ? Math.round(18 + rand() * 22) : Math.round(45 + rand() * 80),
        seen,
      };
      return device;
    });
  }),
);

const countBy = (status: NetworkDeviceStatus) => networkDevices.filter((device) => device.status === status).length;

export const NETWORK_TOTAL = networkDevices.length;
export const NETWORK_ONLINE = countBy("Online");
export const NETWORK_WARNING = countBy("Warning");
export const NETWORK_OFFLINE = countBy("Offline");
export const NETWORK_AVG_UPTIME = Number((networkDevices.reduce((sum, device) => sum + device.uptime, 0) / NETWORK_TOTAL).toFixed(2));
export const NETWORK_AVG_LATENCY = Math.round(networkDevices.reduce((sum, device) => sum + device.latencyMs, 0) / NETWORK_TOTAL);
export const NETWORK_HEALTH_PCT = Number(((NETWORK_ONLINE / NETWORK_TOTAL) * 100).toFixed(1));

export const networkWarningDevices = networkDevices.filter((device) => device.status === "Warning");
export const networkOfflineDevices = networkDevices.filter((device) => device.status === "Offline");

export interface NetworkDeviceSiteRow {
  name: string;
  devices: number;
  health: number;
  status: "healthy" | "warning" | "critical";
}

export const networkDeviceSites: NetworkDeviceSiteRow[] = SITE_PLANS.map((site) => {
  const siteDevices = networkDevices.filter((device) => device.location === site.name);
  const health = Number(Math.min(...siteDevices.map((device) => device.uptime)).toFixed(1));
  const status: NetworkDeviceSiteRow["status"] = health >= 99 ? "healthy" : health >= 95 ? "warning" : "critical";
  return { name: site.name, devices: siteDevices.length, health, status };
});

/** Worst sites first (lowest health). */
export const networkWorstSites = [...networkDeviceSites].sort((a, b) => a.health - b.health).slice(0, 3);

export const networkDeviceTypes = ([
  { key: "Switch" as const, name: "Switches", color: "#288af0" },
  { key: "Router" as const, name: "Routers", color: "#34D399" },
  { key: "Firewall" as const, name: "Firewalls", color: "#A78BFA" },
  { key: "Access Point" as const, name: "Access Points", color: "#FBBF24" },
]).map((entry) => {
  const count = networkDevices.filter((device) => device.type === entry.key).length;
  return { ...entry, count, percent: `${((count / NETWORK_TOTAL) * 100).toFixed(1)}%`, width: Math.round((count / NETWORK_TOTAL) * 100) };
});

export const networkManufacturers = (["Cisco", "HP", "Juniper", "Huawei", "Others"] as const).map((name) => {
  const count = networkDevices.filter((device) => device.maker === name).length;
  const percent = Number(((count / NETWORK_TOTAL) * 100).toFixed(1));
  return { name, count, percent, width: `${percent}%` };
});

export interface NetworkAlert {
  id: string;
  title: string;
  device: string;
  site: string;
  time: string;
  tone: "critical" | "warning" | "info";
}

export const networkAlerts: NetworkAlert[] = [
  { id: "sw-core-01-offline", title: "Switch SW-CORE-01 is offline", device: "SW-CORE-01", site: "Karachi", time: "2m ago", tone: "critical" },
  { id: "rtr-02-cpu", title: "High CPU on Router RTR-02", device: "RTR-02", site: "Karachi", time: "5m ago", tone: "warning" },
  { id: "sw-03-flapping", title: "Interface flapping on SW-03", device: "SW-03", site: "Karachi", time: "12m ago", tone: "warning" },
  { id: "fw-01-latency", title: "High latency on FW-01", device: "FW-01", site: "Lahore", time: "3h ago", tone: "info" },
];
export const NETWORK_OPEN_ALERTS = networkAlerts.length;

/** 49 points every 30 minutes, healthy/warning/offline in percent (sums to 100). Latest point equals the donut (78/5/3 → 90.7/5.8/3.5). */
const trendTimes = Array.from({ length: 49 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const wobble = (i: number, base: number, amp: number, phase: number) => Math.max(0, base + Math.sin(i / 4 + phase) * amp + Math.sin(i / 9 + phase) * amp * 0.35);

function buildTrend(baseHealth: number, baseWarning: number, healthAmp: number, phase: number) {
  const points = trendTimes.map((time, i) => {
    const healthy = Number(Math.min(100, Math.max(70, wobble(i, baseHealth, healthAmp, phase))).toFixed(1));
    const warning = Number(Math.max(0, wobble(i, baseWarning, 1.4, phase + 1.7)).toFixed(1));
    const offline = Number(Math.max(0, 100 - healthy - warning).toFixed(1));
    return { time, healthy, warning, offline };
  });
  const last = points[points.length - 1];
  last.healthy = NETWORK_HEALTH_PCT;
  last.warning = Number(((NETWORK_WARNING / NETWORK_TOTAL) * 100).toFixed(1));
  last.offline = Number(((NETWORK_OFFLINE / NETWORK_TOTAL) * 100).toFixed(1));
  return points;
}

export const networkHealthTrend: Record<"24H" | "7D" | "30D", Array<{ time: string; healthy: number; warning: number; offline: number }>> = {
  "24H": buildTrend(NETWORK_HEALTH_PCT, (NETWORK_WARNING / NETWORK_TOTAL) * 100, 2.6, 0.6),
  "7D": buildTrend(NETWORK_HEALTH_PCT, (NETWORK_WARNING / NETWORK_TOTAL) * 100, 3.4, 2.1),
  "30D": buildTrend(NETWORK_HEALTH_PCT, (NETWORK_WARNING / NETWORK_TOTAL) * 100, 4.2, 4.4),
};
