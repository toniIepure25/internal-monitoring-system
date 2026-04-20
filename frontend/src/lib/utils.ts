import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "UP":
      return "text-success bg-success/10";
    case "DOWN":
      return "text-danger bg-danger/10";
    case "DEGRADED":
      return "text-warning bg-warning/10";
    case "SLOW":
      return "text-warning bg-warning/10";
    default:
      return "text-fgMuted bg-fgSubtle/10";
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "text-danger bg-danger/10";
    case "WARNING":
      return "text-warning bg-warning/10";
    case "INFO":
      return "text-accent bg-accent/10";
    default:
      return "text-fgMuted bg-fgSubtle/10";
  }
}
