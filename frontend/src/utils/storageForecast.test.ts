import { describe, expect, it } from "vitest";

import { bytesIn, daysToFull, formatBytes, growthLabel, pctUsed } from "@/utils/storageForecast";

const GB = 1024 ** 3;
const TB = 1024 ** 4;

describe("pctUsed", () => {
  it("rounds to one decimal place", () => {
    expect(pctUsed(1, 3)).toBe(33.3);
  });

  it("caps at 100%", () => {
    expect(pctUsed(150, 100)).toBe(100);
  });

  it("returns 0 for zero capacity", () => {
    expect(pctUsed(10, 0)).toBe(0);
  });
});

describe("daysToFull", () => {
  it("projects days from weekly growth", () => {
    // 700 GB free, growing 100 GB/week -> 7 weeks -> 49 days
    expect(daysToFull(300 * GB, 1000 * GB, 100 * GB)).toBe(49);
  });

  it("is null when storage is not growing", () => {
    expect(daysToFull(300 * GB, 1000 * GB, 0)).toBeNull();
  });

  it("is 0 when already full", () => {
    expect(daysToFull(1000 * GB, 1000 * GB, 10 * GB)).toBe(0);
  });
});

describe("bytesIn / formatBytes", () => {
  it("converts GB and TB to bytes", () => {
    expect(bytesIn(2, "GB")).toBe(2 * GB);
    expect(bytesIn(1.5, "TB")).toBe(1.5 * TB);
  });

  it.each([
    [0, "0 GB"],
    [512 * GB, "512.0 GB"],
    [5 * GB, "5.00 GB"],
    [1.36 * TB, "1.36 TB"],
    [12 * TB, "12.0 TB"],
  ])("formats %d bytes as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it("builds the weekly growth label", () => {
    expect(growthLabel(120 * GB)).toBe("+120 GB this week");
  });
});
