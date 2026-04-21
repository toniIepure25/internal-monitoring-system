"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingDownIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

export interface ActivityItem {
  type: string;
  id: string;
  timestamp: string;
  title: string;
  severity: string;
  status: string;
  new_state: string;
  previous_state: string;
  application_name: string | null;
  application_id: string | null;
}

const stateIcons: Record<string, { icon: React.ElementType; color: string }> = {
  DOWN: { icon: ExclamationTriangleIcon, color: "text-danger bg-danger/10" },
  UP: { icon: CheckCircleIcon, color: "text-success bg-success/10" },
  SLOW: { icon: ArrowTrendingDownIcon, color: "text-warning bg-warning/10" },
  DEGRADED: { icon: ArrowTrendingDownIcon, color: "text-warning bg-warning/10" },
};

const fallback = { icon: ArrowPathIcon, color: "text-fgSubtle bg-surfaceRaised" };

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function ActivityFeed({ items, className }: { items: ActivityItem[]; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      <AnimatePresence initial={false}>
        {items.map((item, i) => {
          const meta = stateIcons[item.new_state] || fallback;
          const Icon = meta.icon;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex items-start gap-3 py-2 pl-1"
            >
              <div className={cn("relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", meta.color)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-[13px] font-medium text-fg">{item.title}</p>
                <p className="text-[11px] text-fgSubtle">
                  {item.application_name && <span className="text-fgMuted">{item.application_name}</span>}
                  {item.application_name && " · "}
                  {timeAgo(item.timestamp)}
                </p>
              </div>
              <span className={cn(
                "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                item.status === "ONGOING" ? "bg-danger/10 text-danger" : "bg-success/10 text-success",
              )}>
                {item.status}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {items.length === 0 && (
        <p className="py-6 text-center text-xs text-fgSubtle">No recent activity</p>
      )}
    </div>
  );
}
