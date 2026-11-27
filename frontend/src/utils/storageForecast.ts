/**
 * Storage capacity helpers. Pure functions - all UI derives from
 * mocks/storageLocations.ts through these.
 */

const SECOND = 1000;
const WEEK = 7 * 24 * 60 * 60 * SECOND;

export function pctUsed(usedBytes: number, capacityBytes: number): number {
  if (capacityBytes <= 0) return 0;
  return Math.min(100, Math.round((usedBytes / capacityBytes) * 1000) / 10);
}

/** Days until the location hits capacity at its current weekly growth rate. null when growth <= 0. */
export function daysToFull(usedBytes: number, capacityBytes: number, weeklyGrowthBytes: number): number | null {
  if (weeklyGrowthBytes <= 0) return null;
  const remaining = capacityBytes - usedBytes;
  if (remaining <= 0) return 0;
  return Math.round((remaining / weeklyGrowthBytes) * 7);
}

export function bytesIn(value: number, unit: "GB" | "TB"): number {
  return unit === "TB" ? value * 1024 * 1024 * 1024 * 1024 : value * 1024 * 1024 * 1024;
}

/** "120 GB" / "1.36 TB" / "512 MB". */
export function formatBytes(bytes: number, decimals?: number): string {
  if (bytes <= 0) return "0 GB";
  const GB = 1024 * 1024 * 1024;
  const TB = 1024 * GB;
  if (bytes >= TB) {
    const value = bytes / TB;
    return `${value.toFixed(decimals ?? (value >= 10 ? 1 : 2))} TB`;
  }
  const gb = bytes / GB;
  return `${gb.toFixed(decimals ?? (gb >= 10 ? 1 : 2))} GB`;
}

/** "+120 GB this week" */
export function growthLabel(weeklyGrowthBytes: number): string {
  return `+${formatBytes(weeklyGrowthBytes, 0)} this week`;
}
