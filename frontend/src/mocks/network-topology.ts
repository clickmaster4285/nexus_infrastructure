import { networkDevices, networkDeviceSites, NETWORK_OFFLINE, NETWORK_ONLINE, NETWORK_TOTAL, NETWORK_WARNING } from "@/mocks/network-devices";

export type TopologyStatus = "Up" | "Degraded" | "Down" | "Maintenance" | "Unknown";
export type TopologyNode = {
  id: string; name: string; type: string; vendor: string; model: string; ip: string; site: string;
  vlan: string; tier: number; status: TopologyStatus; managed: boolean; alertCount: number;
  cpu: number; mem: number; uptime: string; lastSeenAt: string;
};
export type TopologyLink = {
  id: string; source: string; target: string; sourcePort: string; targetPort: string;
  type: "Fiber" | "Copper" | "Wireless" | "WAN" | "VPN"; speedMbps: number;
  utilizationPct: number; status: TopologyStatus; latencyMs: number; errorsPct: number;
};
export type TopologySite = { id: string; name: string; lat: number; lng: number };
export type TopologyChange = { id: string; at: string; type: string; subject: string; detail: string };

const SITE_COORDS: Record<string, [number, number]> = {
  Karachi: [24.8607, 67.0011], Islamabad: [33.6844, 73.0479], Lahore: [31.5204, 74.3587],
  Rawalpindi: [33.5651, 73.0169], Peshawar: [34.0151, 71.5249], Dubai: [25.2048, 55.2708],
};

const maintenanceIds = new Set(["sw-11", "ap-10"]);

export const topologySites: TopologySite[] = networkDeviceSites.map((site) => {
  const [lat, lng] = SITE_COORDS[site.name] ?? [25, 67];
  return { id: site.name.toLowerCase(), name: site.name, lat, lng };
});

const seededNodes: TopologyNode[] = networkDevices.map((device, index) => {
  const status: TopologyStatus = maintenanceIds.has(device.id) ? "Maintenance" : device.status === "Offline" ? "Down" : device.status === "Warning" ? "Degraded" : "Up";
  return {
    id: device.id, name: device.name, type: device.type, vendor: device.maker,
    model: `${device.maker} ${device.type === "Switch" ? "Catalyst 9300" : device.type === "Router" ? "MX204" : device.type === "Firewall" ? "FortiGate 100F" : "Aironet 2800"}`,
    ip: device.ip, site: device.location, vlan: `VLAN ${10 + (index % 8)}`, tier: 0, status,
    managed: !["fw-04", "ap-08"].includes(device.id), alertCount: status === "Down" ? 2 : status === "Degraded" ? 1 : 0,
    cpu: Math.min(96, Math.round(24 + device.latencyMs * 0.82)), mem: Math.min(94, Math.round(38 + device.latencyMs * 0.6)),
    uptime: `${Math.floor(device.uptime / 10)}d ${Math.round(device.uptime % 24)}h`,
    // Store an absolute timestamp; format relative time in the client to avoid hydration differences.
    lastSeenAt: new Date(Date.now() - (device.status === "Offline" ? 14 : 1) * 60_000).toISOString(),
  };
});

const FLAGSHIP = new Set(["RTR-EDGE-01", "FW-01"]);
function layerAssignment(nodes: TopologyNode[]): Map<string, number> {
  const tier = new Map<string, number>();
  const switches = nodes.filter((node) => node.type === "Switch");
  for (const node of nodes) if (node.name.toUpperCase().includes("CORE")) tier.set(node.id, 0);
  for (const node of nodes) if (!tier.has(node.id) && (node.name.toUpperCase().includes("DIST") || FLAGSHIP.has(node.name))) tier.set(node.id, 1);
  const bySite = new Map<string, TopologyNode[]>();
  for (const sw of switches) { const list = bySite.get(sw.site) ?? []; list.push(sw); bySite.set(sw.site, list); }
  for (const list of bySite.values()) { const pick = list.find((node) => !tier.has(node.id)); if (pick) tier.set(pick.id, 1); }
  for (const sw of switches) if (!tier.has(sw.id)) tier.set(sw.id, 2);
  for (const node of nodes) if (!tier.has(node.id)) tier.set(node.id, 3);
  return tier;
}

const tierMap = layerAssignment(seededNodes);
export const topologyNodes: TopologyNode[] = seededNodes.map((node) => ({ ...node, tier: tierMap.get(node.id) ?? 3 }));

const groupBySite = (nodes: TopologyNode[]) => {
  const map = new Map<string, TopologyNode[]>();
  for (const node of nodes) { const list = map.get(node.site) ?? []; list.push(node); map.set(node.site, list); }
  return map;
};
const fewestChildren = (pool: TopologyNode[], counts: Map<string, number>) => pool.reduce((best, candidate) => ((counts.get(candidate.id) ?? 0) < (counts.get(best.id) ?? 0) ? candidate : best), pool[0]);

function buildTree(nodes: TopologyNode[]): Array<[string, TopologyNode]> {
  const root = nodes.find((node) => node.tier === 0) ?? nodes[0];
  const distribution = nodes.filter((node) => node.tier === 1);
  const access = nodes.filter((node) => node.tier === 2);
  const endpoints = nodes.filter((node) => node.tier === 3);
  const accessBySite = groupBySite(access);
  const distributionBySite = groupBySite(distribution);
  const pairs: Array<[string, TopologyNode]> = [];
  const counts = new Map<string, number>();
  const attach = (parentId: string, node: TopologyNode) => { pairs.push([parentId, node]); counts.set(parentId, (counts.get(parentId) ?? 0) + 1); };
  for (const dist of distribution) attach(root.id, dist);
  for (const [site, siteAccess] of accessBySite) {
    const pool = distributionBySite.get(site) ?? [root];
    for (const sw of siteAccess) attach(fewestChildren(pool, counts).id, sw);
  }
  for (const endpoint of endpoints) {
    const pool = accessBySite.get(endpoint.site);
    if (pool && pool.length) attach(fewestChildren(pool, counts).id, endpoint);
    else { const distPool = distributionBySite.get(endpoint.site) ?? [root]; attach(fewestChildren(distPool, counts).id, endpoint); }
  }
  return pairs;
}

export const topologyLinks: TopologyLink[] = buildTree(topologyNodes).map(([parentId, node], index) => {
  const hot = index === 0 ? 92.3 : index === 1 ? 78.6 : index === 2 ? 65.1 : 18 + ((index * 17) % 58);
  return {
    id: `link-${parentId}-${node.id}`, source: parentId, target: node.id,
    sourcePort: index === 0 ? "eth0" : `Gi1/0/${(index % 48) + 1}`,
    targetPort: index === 1 ? "ge-0/0/1" : `eth${index % 4}`,
    type: index % 13 === 0 ? "Wireless" : index % 17 === 0 ? "VPN" : index % 9 === 0 ? "WAN" : "Fiber",
    speedMbps: index % 5 === 0 ? 10_000 : 1_000, utilizationPct: hot,
    status: node.status === "Down" ? "Down" : hot > 85 ? "Degraded" : "Up",
    latencyMs: 4 + (index * 7) % 68, errorsPct: Number(((index * 0.013) % 0.4).toFixed(2)),
  };
});

export const topologyChanges: TopologyChange[] = [
  { id: "change-1", at: new Date(Date.now() - 2 * 60_000).toISOString(), type: "Link flapping", subject: "SW-03", detail: "Uplink flapped 4 times in 10 minutes" },
  { id: "change-2", at: new Date(Date.now() - 19 * 60_000).toISOString(), type: "Config change", subject: "FW-01", detail: "Firewall policy updated" },
  { id: "change-3", at: new Date(Date.now() - 48 * 60_000).toISOString(), type: "Device added", subject: "RTR-EDGE-01", detail: "Device discovered by LLDP" },
  { id: "change-4", at: new Date(Date.now() - 3 * 3_600_000).toISOString(), type: "Link down", subject: "AP-01", detail: "Access point uplink is unavailable" },
  { id: "change-5", at: new Date(Date.now() - 5 * 3_600_000).toISOString(), type: "Rogue detected", subject: "Unmanaged AP", detail: "New wireless device detected" },
  { id: "change-6", at: new Date(Date.now() - 8 * 3_600_000).toISOString(), type: "Link up", subject: "SW-DIST-02", detail: "Redundant uplink restored" },
  { id: "change-7", at: new Date(Date.now() - 12 * 3_600_000).toISOString(), type: "Device removed", subject: "RTR-06", detail: "Device removed from inventory" },
  { id: "change-8", at: new Date(Date.now() - 18 * 3_600_000).toISOString(), type: "Config change", subject: "SW-CORE-01", detail: "VLAN configuration synchronized" },
];

export const topologyDiscovery = { lastRunAt: new Date(Date.now() - 42 * 60_000).toISOString(), nextRunAt: new Date(Date.now() + 18 * 60 * 60_000).toISOString(), protocol: "LLDP / CDP / SNMP", devicesFound: NETWORK_TOTAL, newDevices: 3, unmanagedDevices: 2 };
export const topologyTotals = { devices: NETWORK_TOTAL, healthy: NETWORK_ONLINE, warning: NETWORK_WARNING, offline: NETWORK_OFFLINE };

// One module-level store keeps list, graph, and inspector reads consistent during mock mutations.
let knownDevices = new Set<string>();
let runtimeChanges = [...topologyChanges];
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export async function loadTopology(): Promise<{ nodes: TopologyNode[]; links: TopologyLink[]; sites: TopologySite[]; changes: TopologyChange[] }> {
  await wait(200 + Math.floor(Math.random() * 201));
  return { nodes: topologyNodes.map((node) => knownDevices.has(node.id) ? { ...node, managed: true } : node), links: topologyLinks, sites: topologySites, changes: runtimeChanges };
}
export function markTopologyDeviceKnown(id: string): void {
  knownDevices.add(id);
  runtimeChanges = [{ id: `change-${Date.now()}`, at: new Date().toISOString(), type: "Device added", subject: id, detail: "Device marked as known" }, ...runtimeChanges];
}
export function addTopologyDiscoveryChange(): void {
  runtimeChanges = [{ id: `change-${Date.now()}`, at: new Date().toISOString(), type: "Device added", subject: "Newly discovered device", detail: "LLDP / CDP / SNMP discovery completed" }, ...runtimeChanges];
}

export function downstreamFrom(id: string, links: TopologyLink[] = topologyLinks): string[] {
  const seen = new Set<string>([id]);
  const queue = [id];
  while (queue.length) {
    const current = queue.shift()!;
    for (const link of links) if (link.source === current && !seen.has(link.target)) { seen.add(link.target); queue.push(link.target); }
  }
  return [...seen].filter((item) => item !== id);
}
export function shortestPath(from: string, to: string): TopologyLink[] {
  const distances = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, TopologyLink>();
  const pending = new Set(topologyNodes.map((node) => node.id));
  while (pending.size) {
    let current: string | undefined;
    for (const candidate of pending) if (current === undefined || (distances.get(candidate) ?? Infinity) < (distances.get(current) ?? Infinity)) current = candidate;
    if (current === undefined || !Number.isFinite(distances.get(current)) || current === to) break;
    pending.delete(current);
    for (const link of topologyLinks.filter((entry) => entry.source === current || entry.target === current)) {
      const next = link.source === current ? link.target : link.source;
      const distance = (distances.get(current) ?? Infinity) + link.latencyMs;
      if (distance < (distances.get(next) ?? Infinity)) { distances.set(next, distance); previous.set(next, link); }
    }
  }
  const result: TopologyLink[] = [];
  let cursor = to;
  while (cursor !== from) { const link = previous.get(cursor); if (!link) return []; result.unshift(link); cursor = link.source === cursor ? link.target : link.source; }
  return result;
}
