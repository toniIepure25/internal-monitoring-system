import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function formatDuration(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  if (ms < 0) return "just now";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ${hours % 24}h`;
  const months = Math.floor(days / 30);
  return `${months}mo ${days % 30}d`;
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
