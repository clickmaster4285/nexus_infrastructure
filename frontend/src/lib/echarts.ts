/**
 * ECharts wrapper with oklch() color support.
 *
 * zrender's color parser only understands hex / rgb(a) / hsl(a) / named
 * colors — passing oklch() strings (as this codebase does everywhere) makes
 * every series paint invisible or black. This wrapper re-exports all of
 * `echarts` and wraps `init()` so every `setOption` call deep-converts
 * `oklch(...)` colors to `rgba(...)` before they reach the renderer.
 * Option shape and types are unchanged.
 */

import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

/* --------------------------- oklch -> rgba math --------------------------- */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function oklchToRgba(body: string, alphaFromSuffix: number | null): string {
  const rawParts = body.trim().split(/[\s/]+/).filter(Boolean);
  if (rawParts.length < 3) return "rgba(0, 0, 0, 1)";
  const parseValue = (token: string, scale: number) => token.endsWith("%") ? (parseFloat(token) / 100) * scale : parseFloat(token);
  const L = Number.isFinite(parseValue(rawParts[0], 1)) ? clamp01(parseValue(rawParts[0], 1)) : 0;
  // Chroma: CSS percentages are relative to 0.4
  const C = rawParts[1].endsWith("%") ? (parseFloat(rawParts[1]) / 100) * 0.4 : parseFloat(rawParts[1]);
  const H = (parseFloat((rawParts[2] ?? "0").replace(/deg$/i, "")) || 0) * (Math.PI / 180);
  const a = Number.isFinite(C) ? C * Math.cos(H) : 0;
  const b = Number.isFinite(C) ? C * Math.sin(H) : 0;

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541729 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  const toByte = (c: number) => Math.round(clamp01(gamma(c)) * 255);

  let alpha = 1;
  const alphaToken = rawParts[3];
  if (alphaToken !== undefined) {
    alpha = alphaToken.endsWith("%") ? clamp01(parseFloat(alphaToken) / 100) : clamp01(parseFloat(alphaToken));
  } else if (alphaFromSuffix !== null) {
    alpha = alphaFromSuffix;
  }

  return `rgba(${toByte(rLin)}, ${toByte(gLin)}, ${toByte(bLin)}, ${Math.round(alpha * 1000) / 1000})`;
}

const OKLCH_RE = /oklch\(([^()]+)\)([0-9a-fA-F]{2})?/g;

function convertOklchString(value: string): string {
  if (!value.includes("oklch(")) return value;
  return value.replace(OKLCH_RE, (_, body: string, hexAlpha: string | undefined) => {
    const alphaFromSuffix = hexAlpha ? parseInt(hexAlpha, 16) / 255 : null;
    return oklchToRgba(body, alphaFromSuffix);
  });
}

/** Recursively rewrites every oklch() string inside an option tree. */
function deepConvert(node: unknown): unknown {
  if (node === null || node === undefined) return node;
  if (typeof node === "string") return convertOklchString(node);
  if (typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(deepConvert);
  if (node instanceof echarts.graphic.LinearGradient) {
    node.colorStops?.forEach((stop) => {
      stop.color = convertOklchString(stop.color);
    });
    return node;
  }
  if (node instanceof echarts.graphic.RadialGradient) {
    node.colorStops?.forEach((stop) => {
      stop.color = convertOklchString(stop.color);
    });
    return node;
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(node)) {
    out[key] = deepConvert((node as Record<string, unknown>)[key]);
  }
  return out;
}

type SetOptionArgs = [option: EChartsOption, notMerge?: boolean | object, lazyUpdate?: boolean];

function withColorConversion(chart: echarts.ECharts): echarts.ECharts {
  const original = chart.setOption.bind(chart);
  chart.setOption = ((option: EChartsOption, notMerge?: boolean | object, lazyUpdate?: boolean) => {
    const converted = deepConvert(option) as EChartsOption;
    return original(converted, notMerge as boolean, lazyUpdate);
  }) as echarts.ECharts["setOption"];
  return chart;
}

export function init(...args: Parameters<typeof echarts.init>): echarts.ECharts {
  return withColorConversion(echarts.init(...args));
}

export * from "echarts";
export { echarts };
export default echarts;
