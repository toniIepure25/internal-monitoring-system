import { cn } from "@/lib/utils";
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

interface DataTableShellProps {
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function DataTableShell({ children, footer, className }: DataTableShellProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-surface", className)}>
      <div className="overflow-x-auto">{children}</div>
      {footer && (
        <div className="border-t border-border px-4 py-2 text-xs text-fgSubtle">{footer}</div>
      )}
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn("whitespace-nowrap px-3 py-2.5 text-left text-2xs font-medium uppercase tracking-wider text-fgSubtle", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("whitespace-nowrap px-3 py-2.5 text-[13px]", className)}>{children}</td>;
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export function SortableTh({
  children,
  sortKey,
  sort,
  onSort,
  className,
}: {
  children: React.ReactNode;
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th
      className={cn(
        "cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-2xs font-medium uppercase tracking-wider transition-colors",
        active ? "text-fg" : "text-fgSubtle hover:text-fgMuted",
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className="inline-flex w-3 flex-col items-center">
          {active ? (
            sort.dir === "asc" ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />
          ) : (
            <ChevronUpIcon className="h-3 w-3 opacity-0 group-hover:opacity-30" />
          )}
        </span>
      </span>
    </th>
  );
}

export function toggleSort(prev: SortState | null, key: string): SortState | null {
  if (!prev || prev.key !== key) return { key, dir: "asc" };
  if (prev.dir === "asc") return { key, dir: "desc" };
  return null;
}
