import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-2xs font-medium uppercase tracking-wider text-fgSubtle">{eyebrow}</p>}
        <h1 className="text-lg font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-fgMuted">{description}</p>}
      </div>
      {actions && <div className="mt-2 flex shrink-0 items-center gap-2 sm:mt-0">{actions}</div>}
    </div>
  );
}
