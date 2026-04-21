"use client";

import { cn } from "@/lib/utils";
import type { HealthCheckEntry } from "@/types";

const segmentColor: Record<string, string> = {
  UP: "bg-success",
  DOWN: "bg-danger",
  SLOW: "bg-warning",
  DEGRADED: "bg-warning",
  UNKNOWN: "bg-fgSubtle",
};

interface UptimeBarProps {
  checks: HealthCheckEntry[];
  slots?: number;
  className?: string;
}

export function UptimeBar({ checks, slots = 30, className }: UptimeBarProps) {
  const ordered = [...checks].reverse();
  const segments = Array.from({ length: slots }, (_, i) => {
    const check = ordered[i];
    return check?.status || null;
  });

  const upCount = ordered.filter((c) => c.status === "UP").length;
  const pct = ordered.length > 0 ? ((upCount / ordered.length) * 100).toFixed(1) : "—";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-px" title={`${pct}% uptime over last ${ordered.length} checks`}>
        {segments.map((status, i) => (
          <div
            key={i}
            className={cn(
              "h-5 w-[3px] rounded-[1px] transition-colors",
              status ? segmentColor[status] || "bg-fgSubtle" : "bg-border",
            )}
          />
        ))}
      </div>
      <span className="text-[11px] tabular-nums text-fgMuted">{pct}%</span>
    </div>
  );
}
