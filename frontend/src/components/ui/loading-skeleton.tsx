"use client";

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <div className="h-10 w-10 rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="h-3 w-1/2 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
      <div className="h-3 w-24 rounded bg-gray-200" />
      <div className="mt-3 h-8 w-16 rounded bg-gray-200" />
      <div className="mt-2 h-3 w-32 rounded bg-gray-200" />
    </div>
  );
}

export function TableSkeleton({ cols = 4, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`h-${i}`} className="h-4 rounded bg-gray-200" />
        ))}
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div key={`c-${i}`} className="h-4 rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
