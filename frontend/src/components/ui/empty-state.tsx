import { InboxIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surfaceRaised">
        <Icon className="h-5 w-5 text-fgSubtle" />
      </div>
      <p className="mt-3 text-[13px] font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-fgMuted">{description}</p>}
      {(action || actionLabel) && (
        <div className="mt-4">
          {action || (actionLabel && onAction && <Button variant="secondary" size="sm" onClick={onAction}>{actionLabel}</Button>)}
        </div>
      )}
    </div>
  );
}
