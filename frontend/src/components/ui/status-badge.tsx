"use client";

import { cn } from "@/lib/utils";

type StatusVariant = "success" | "danger" | "warning" | "neutral" | "info";

const variantStyles: Record<StatusVariant, string> = {
  success: "bg-success/10 text-success",
  danger:  "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
  neutral: "bg-fgSubtle/10 text-fgMuted",
  info:    "bg-accent/10 text-accent",
};

const dotColors: Record<StatusVariant, string> = {
  success: "bg-success",
  danger:  "bg-danger",
  warning: "bg-warning",
  neutral: "bg-fgSubtle",
  info:    "bg-accent",
};

function Badge({ variant, label, className }: { variant: StatusVariant; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", variantStyles[variant], className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[variant])} />
      {label}
    </span>
  );
}

const statusMap: Record<string, StatusVariant> = {
  UP: "success", ONLINE: "success", HEALTHY: "success", active: "success", resolved: "success",
  DOWN: "danger", OFFLINE: "danger", UNHEALTHY: "danger", inactive: "danger",
  DEGRADED: "warning", MAINTENANCE: "warning", acknowledged: "warning", triggered: "danger",
  UNKNOWN: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={statusMap[status] || "neutral"} label={status} />;
}

export function HostStatusBadge({ status }: { status: string }) {
  return <Badge variant={statusMap[status] || "neutral"} label={status} />;
}

const severityMap: Record<string, StatusVariant> = {
  CRITICAL: "danger", critical: "danger",
  HIGH: "danger", high: "danger",
  MEDIUM: "warning", medium: "warning",
  LOW: "info", low: "info",
  INFO: "neutral", info: "neutral",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge variant={severityMap[severity] || "neutral"} label={severity} />;
}

const incidentTypeMap: Record<string, StatusVariant> = {
  APPLICATION: "neutral", HOST: "neutral", HOST_CAUSED: "warning",
  downtime: "danger", degraded: "warning", maintenance: "info",
};

export function IncidentTypeBadge({ type }: { type: string }) {
  return <Badge variant={incidentTypeMap[type] || "neutral"} label={type} />;
}
