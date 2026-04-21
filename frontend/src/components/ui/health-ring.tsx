"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Segment {
  label: string;
  count: number;
  color: string;
}

interface HealthRingProps {
  up: number;
  down: number;
  degraded: number;
  unknown: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function HealthRing({ up, down, degraded, unknown, size = 64, strokeWidth = 6, className }: HealthRingProps) {
  const total = up + down + degraded + unknown;
  if (total === 0) return null;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const segments: Segment[] = [
    { label: "UP", count: up, color: "hsl(160, 84%, 39%)" },
    { label: "DOWN", count: down, color: "hsl(0, 84%, 60%)" },
    { label: "DEGRADED", count: degraded, color: "hsl(38, 92%, 50%)" },
    { label: "UNKNOWN", count: unknown, color: "hsl(240, 4%, 46%)" },
  ].filter((s) => s.count > 0);

  const healthPct = total > 0 ? Math.round((up / total) * 100) : 0;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const pct = seg.count / total;
    const dashLen = pct * circumference;
    const gap = circumference - dashLen;
    const arc = { ...seg, dashLen, gap, offset };
    offset += dashLen;
    return arc;
  });

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} opacity={0.3} />
        {arcs.map((arc) => (
          <motion.circle
            key={arc.label}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arc.dashLen} ${arc.gap}`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: -arc.offset }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="text-sm font-bold tabular-nums text-fg"
        >
          {healthPct}%
        </motion.span>
      </div>
    </div>
  );
}
