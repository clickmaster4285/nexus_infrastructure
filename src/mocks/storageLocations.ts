/**
 * Storage pools mock data for Backups & Recovery (3-2-1-1 strategy).
 * Capacities/usage are stored in absolute units so the UI can derive fill
 * percentages and days-to-full projections per pool. Deterministic - no
 * randomness. Same single-source-of-truth pattern as the other mocks.
 */

export type StorageTier = "on-prem" | "cloud" | "offsite";

export interface StoragePool {
  /** "pool-nas" | "pool-s3" | "pool-vault" */
  id: string;
  /** Display name, e.g. "Local NAS". */
  name: string;
  tier: StorageTier;
  capacityTB: number;
  usedTB: number;
  growthGBPerWeek: number;
  /** True for WORM / immutable vault copies. */
  immutable: boolean;
}

const TB = 1024 * 1024 * 1024 * 1024;

export const STORAGE_POOLS: StoragePool[] = [
  { id: "pool-nas", name: "Local NAS", tier: "on-prem", capacityTB: 20, usedTB: 13.4, growthGBPerWeek: 120, immutable: false },
  { id: "pool-s3", name: "AWS S3", tier: "cloud", capacityTB: 25, usedTB: 22.6, growthGBPerWeek: 500, immutable: true },
  { id: "pool-vault", name: "Offsite Vault", tier: "offsite", capacityTB: 40, usedTB: 12.2, growthGBPerWeek: 6, immutable: true },
];

export const STORAGE_POOL_LABELS: Record<string, string> = Object.fromEntries(STORAGE_POOLS.map((pool) => [pool.id, pool.name]));

export function poolById(id: string): StoragePool | null {
  return STORAGE_POOLS.find((pool) => pool.id === id) ?? null;
}

/** Absolute byte helpers derived from TB specs. */
export const poolCapacityBytes = (pool: StoragePool) => pool.capacityTB * TB;
export const poolUsedBytes = (pool: StoragePool) => pool.usedTB * TB;
