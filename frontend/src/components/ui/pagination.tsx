"use client";

import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-fgMuted transition-colors hover:bg-surfaceRaised hover:text-fg disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeftIcon className="h-3.5 w-3.5" />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="flex h-7 w-7 items-center justify-center text-xs text-fgSubtle">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={cn(
              "flex h-7 min-w-[28px] items-center justify-center rounded-md px-1 text-xs font-medium transition-colors",
              p === page ? "bg-accent/10 text-accent" : "text-fgMuted hover:bg-surfaceRaised hover:text-fg",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-fgMuted transition-colors hover:bg-surfaceRaised hover:text-fg disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

