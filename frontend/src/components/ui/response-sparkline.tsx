"use client";

import type { HealthCheckEntry } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  UP: "hsl(160, 84%, 39%)",
  DOWN: "hsl(0, 84%, 60%)",
  SLOW: "hsl(38, 92%, 50%)",
  DEGRADED: "hsl(38, 92%, 50%)",
  UNKNOWN: "hsl(240, 4%, 46%)",
};

interface ResponseSparklineProps {
  checks: HealthCheckEntry[];
  width?: number;
  height?: number;
  className?: string;
}

export function ResponseSparkline({ checks, width = 120, height = 32, className }: ResponseSparklineProps) {
  const points = [...checks].reverse().filter((c) => c.response_time_ms != null);
  if (points.length < 2) return null;

  const values = points.map((p) => p.response_time_ms!);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const padY = 2;
  const innerH = height - padY * 2;

  const coords = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: padY + innerH - ((v - min) / range) * innerH,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const fillPath = `${linePath} L${width},${height} L0,${height} Z`;

  const lastStatus = points[points.length - 1]?.status || "UNKNOWN";
  const strokeColor = STATUS_COLORS[lastStatus] || STATUS_COLORS.UNKNOWN;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-label="Response time trend"
    >
      <defs>
        <linearGradient id={`spark-fill-${lastStatus}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#spark-fill-${lastStatus})`} />
      <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
