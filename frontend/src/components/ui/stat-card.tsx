"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/ui/motion";

type Color = "gray" | "green" | "red" | "yellow" | "blue" | "cyan";

interface StatCardProps {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string | number;
  subtext?: string;
  color?: Color;
  delay?: number;
}

const subtleAccents: Record<Color, string> = {
  gray:   "text-fgSubtle",
  green:  "text-success/70",
  red:    "text-danger/70",
  yellow: "text-warning/70",
  blue:   "text-accent/70",
  cyan:   "text-info/70",
};

const dotColors: Record<Color, string> = {
  gray:   "bg-fgSubtle",
  green:  "bg-success",
  red:    "bg-danger",
  yellow: "bg-warning",
  blue:   "bg-accent",
  cyan:   "bg-info",
};

export function StatCard({ icon: Icon, label, value, subtext, color = "blue", delay = 0 }: StatCardProps) {
  const numericValue = typeof value === "number" ? value : parseInt(String(value), 10);
  const isNumeric = !isNaN(numericValue);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }}
      className="rounded-lg border border-border/60 bg-surface px-4 py-3 transition-shadow hover:shadow-md hover:shadow-canvas/50"
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[color])} />
        <p className="text-[11px] font-medium uppercase tracking-wider text-fgSubtle">{label}</p>
        {Icon && <Icon className="ml-auto h-3.5 w-3.5 text-fgSubtle/50" />}
      </div>
      <p className="mt-1.5 text-lg font-semibold tabular-nums tracking-tight text-fg">
        {isNumeric ? <AnimatedNumber value={numericValue} /> : value}
      </p>
      {subtext && <p className={cn("mt-0.5 text-[11px]", subtleAccents[color])}>{subtext}</p>}
    </motion.div>
  );
}
