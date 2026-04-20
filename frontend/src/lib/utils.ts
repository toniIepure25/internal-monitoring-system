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
      return "text-green-700 bg-green-50 border-green-200";
    case "DOWN":
      return "text-red-700 bg-red-50 border-red-200";
    case "DEGRADED":
      return "text-yellow-700 bg-yellow-50 border-yellow-200";
    case "SLOW":
      return "text-orange-700 bg-orange-50 border-orange-200";
    default:
      return "text-gray-700 bg-gray-50 border-gray-200";
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "text-red-700 bg-red-50";
    case "WARNING":
      return "text-yellow-700 bg-yellow-50";
    case "INFO":
      return "text-blue-700 bg-blue-50";
    default:
      return "text-gray-700 bg-gray-50";
  }
}
