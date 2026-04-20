"use client";

import { cn } from "@/lib/utils";

interface FilterChipGroupProps {
  label?: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}

export function FilterChipGroup({ label, options, value, onChange }: FilterChipGroupProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {label && <span className="mr-1 text-2xs font-medium text-fgSubtle">{label}</span>}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
            o.value === value
              ? "bg-accent/10 text-accent"
              : "text-fgMuted hover:bg-surfaceRaised hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
