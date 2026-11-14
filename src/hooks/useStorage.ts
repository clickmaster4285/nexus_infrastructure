"use client";

import { useMemo } from "react";

import { STORAGE_POOLS, poolCapacityBytes, poolUsedBytes, type StoragePool } from "@/mocks/storageLocations";
import { daysToFull, pctUsed } from "@/utils/storageForecast";
import { formatBytes } from "@/utils/storageForecast";

export interface StorageView extends StoragePool {
  pctUsed: number;
  usedLabel: string;
  capacityLabel: string;
  /** Used in TB (one decimal) - convenient for summary strips. */
  usedTB: number;
  capacityTB: number;
  availableTB: number;
  daysToFull: number | null;
}

export interface StorageTotals {
  capacityBytes: number;
  usedBytes: number;
  availableBytes: number;
  utilizationPct: number;
}

const BYTES_PER_TB = 1024 ** 4;

/** Pool capacity model + derived fill percentages and days-to-full projections. */
export function useStorage(): { locations: StorageView[]; totalGrowthBytes: number; soonestFullDays: number | null; totals: StorageTotals } {
  return useMemo(() => {
    const locations = STORAGE_POOLS.map((pool) => {
      const capacityBytes = poolCapacityBytes(pool);
      const usedBytes = poolUsedBytes(pool);
      const growthBytes = pool.growthGBPerWeek * 1024 ** 3;
      return {
        ...pool,
        pctUsed: pctUsed(usedBytes, capacityBytes),
        usedLabel: formatBytes(usedBytes, 1),
        capacityLabel: formatBytes(capacityBytes, 0),
        usedTB: pool.usedTB,
        capacityTB: pool.capacityTB,
        availableTB: Math.max(0, Math.round((pool.capacityTB - pool.usedTB) * 10) / 10),
        daysToFull: daysToFull(usedBytes, capacityBytes, growthBytes),
      };
    });
    const totalGrowthBytes = locations.reduce((sum, location) => sum + location.growthGBPerWeek * 1024 ** 3, 0);
    const capacityBytes = locations.reduce((sum, location) => sum + poolCapacityBytes(location), 0);
    const usedBytes = locations.reduce((sum, location) => sum + poolUsedBytes(location), 0);
    const availableBytes = Math.max(0, capacityBytes - usedBytes);
    const utilizationPct = capacityBytes > 0 ? Math.round((usedBytes / capacityBytes) * 1000) / 10 : 0;
    const finite = locations.map((location) => location.daysToFull).filter((value): value is number => value != null);
    const soonestFullDays = finite.length > 0 ? Math.min(...finite) : null;
    return { locations, totalGrowthBytes, soonestFullDays, totals: { capacityBytes, usedBytes, availableBytes, utilizationPct } };
  }, []);
}
