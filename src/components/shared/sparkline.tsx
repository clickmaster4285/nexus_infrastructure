interface SparklineProps {
  /** Series values; the line is normalized against the series max. */
  values: number[];
  color: string;
  label: string;
  className?: string;
}

/** Tiny inline trend line used beside KPI values (normalization by series max). */
export function Sparkline({ values, color, label, className = "block h-6 w-20" }: SparklineProps) {
  const width = 80;
  const height = 24;
  const max = Math.max(1, ...values);
  const step = width / Math.max(1, values.length - 1);
  const points = values.map((value, index) => {
    const x = (index * step).toFixed(1);
    const y = (height - 3 - (Math.max(0, value) / max) * (height - 6)).toFixed(1);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className={className}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
