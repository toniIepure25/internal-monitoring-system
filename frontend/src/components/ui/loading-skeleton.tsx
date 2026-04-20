import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-surfaceRaised", className)} />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full">
      <div className="flex gap-4 border-b border-border px-3 py-2.5">
        {Array.from({ length: cols }).map((_, i) => <Bone key={i} className="h-3 flex-1" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-border/50 px-3 py-3">
          {Array.from({ length: cols }).map((_, c) => <Bone key={c} className="h-3 flex-1" />)}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return <Bone className="h-[88px] rounded-lg" />;
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => <Bone key={i} className="h-4" />)}
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Bone className="h-3 w-24" />
          <Bone className="h-8" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Bone className="h-4 w-32" />
        <Bone className="h-3 w-64" />
      </div>
      <CardGridSkeleton />
    </div>
  );
}
