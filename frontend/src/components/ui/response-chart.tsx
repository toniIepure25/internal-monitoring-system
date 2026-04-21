"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { HealthCheckEntry } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  UP: "hsl(160, 84%, 39%)",
  DOWN: "hsl(0, 84%, 60%)",
  SLOW: "hsl(38, 92%, 50%)",
  DEGRADED: "hsl(38, 92%, 50%)",
  UNKNOWN: "hsl(240, 4%, 46%)",
};

interface ResponseChartProps {
  checks: HealthCheckEntry[];
  slowThreshold?: number;
  height?: number;
  className?: string;
}

export function ResponseChart({ checks, slowThreshold = 1000, height = 160, className }: ResponseChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; check: HealthCheckEntry } | null>(null);
  const [width, setWidth] = useState(600);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const points = [...checks].reverse().filter((c) => c.response_time_ms != null);
  if (points.length < 2) return null;

  const values = points.map((p) => p.response_time_ms!);
  const maxVal = Math.max(...values, slowThreshold * 0.5);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const padTop = 12;
  const padBottom = 24;
  const padLeft = 40;
  const padRight = 8;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const coords = values.map((v, i) => ({
    x: padLeft + (i / (values.length - 1)) * chartW,
    y: padTop + chartH - ((v - minVal) / range) * chartH,
    value: v,
    check: points[i],
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const fillPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${padTop + chartH} L${coords[0].x.toFixed(1)},${padTop + chartH} Z`;

  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = minVal + (range / yTicks) * i;
    return { val: Math.round(val), y: padTop + chartH - (i / yTicks) * chartH };
  });

  const xLabelCount = Math.min(points.length, 5);
  const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
    const idx = Math.round((i / (xLabelCount - 1)) * (points.length - 1));
    const check = points[idx];
    const x = padLeft + (idx / (points.length - 1)) * chartW;
    const date = check.checked_at ? new Date(check.checked_at) : null;
    const label = date ? `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}` : "";
    return { x, label };
  });

  const slowY = padTop + chartH - ((slowThreshold - minVal) / range) * chartH;
  const showSlowLine = slowThreshold < maxVal;

  function getColor(ms: number): string {
    if (ms >= slowThreshold) return STATUS_COLORS.DOWN;
    if (ms >= slowThreshold * 0.7) return STATUS_COLORS.SLOW;
    return STATUS_COLORS.UP;
  }

  const lastStatus = points[points.length - 1]?.status || "UNKNOWN";
  const lineColor = STATUS_COLORS[lastStatus] || STATUS_COLORS.UNKNOWN;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    let closest = coords[0];
    let minDist = Infinity;
    for (const c of coords) {
      const d = Math.abs(c.x - mouseX);
      if (d < minDist) { minDist = d; closest = c; }
    }
    if (minDist < 30) {
      setTooltip({ x: closest.x, y: closest.y, check: closest.check });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="chart-fill-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>

        {yLabels.map((tick) => (
          <g key={tick.val}>
            <line x1={padLeft} y1={tick.y} x2={width - padRight} y2={tick.y} stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="3 3" />
            <text x={padLeft - 6} y={tick.y + 3} textAnchor="end" className="fill-fgSubtle text-[9px]">{tick.val}ms</text>
          </g>
        ))}

        {xLabels.map((tick, i) => (
          <text key={i} x={tick.x} y={height - 4} textAnchor="middle" className="fill-fgSubtle text-[9px]">{tick.label}</text>
        ))}

        {showSlowLine && (
          <>
            <line x1={padLeft} y1={slowY} x2={width - padRight} y2={slowY} stroke="hsl(38, 92%, 50%)" strokeWidth={0.5} strokeDasharray="4 4" opacity={0.5} />
            <text x={width - padRight} y={slowY - 3} textAnchor="end" className="fill-warning text-[8px]">slow</text>
          </>
        )}

        <motion.path
          d={fillPath}
          fill="url(#chart-fill-grad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />

        {tooltip && (
          <>
            <line x1={tooltip.x} y1={padTop} x2={tooltip.x} y2={padTop + chartH} stroke="hsl(var(--fg))" strokeWidth={0.5} opacity={0.3} />
            <circle cx={tooltip.x} cy={tooltip.y} r={4} fill={getColor(tooltip.check.response_time_ms || 0)} stroke="hsl(var(--canvas))" strokeWidth={2} />
          </>
        )}
      </svg>

      {tooltip && tooltip.check && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border border-border bg-surface px-3 py-2 shadow-lg"
          style={{
            left: Math.min(tooltip.x, width - 140),
            top: tooltip.y - 60,
          }}
        >
          <p className="text-[11px] font-medium tabular-nums text-fg">{tooltip.check.response_time_ms}ms</p>
          <p className="text-[10px] text-fgSubtle">
            HTTP {tooltip.check.http_status || "—"} · {tooltip.check.status}
          </p>
          {tooltip.check.checked_at && (
            <p className="text-[10px] text-fgMuted">{new Date(tooltip.check.checked_at).toLocaleTimeString()}</p>
          )}
        </div>
      )}
    </div>
  );
}
