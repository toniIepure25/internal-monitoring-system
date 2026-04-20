"use client";

const appStatusStyles: Record<string, string> = {
  UP: "bg-green-100 text-green-800 border-green-300",
  DOWN: "bg-red-100 text-red-800 border-red-300",
  DEGRADED: "bg-yellow-100 text-yellow-800 border-yellow-300",
  SLOW: "bg-orange-100 text-orange-800 border-orange-300",
  UNKNOWN: "bg-gray-100 text-gray-600 border-gray-300",
};

const appStatusDots: Record<string, string> = {
  UP: "bg-green-500",
  DOWN: "bg-red-500",
  DEGRADED: "bg-yellow-500",
  SLOW: "bg-orange-500",
  UNKNOWN: "bg-gray-400",
};

export function StatusBadge({ status }: { status: string }) {
  const style = appStatusStyles[status] || appStatusStyles.UNKNOWN;
  const dot = appStatusDots[status] || appStatusDots.UNKNOWN;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

const hostStatusStyles: Record<string, string> = {
  ONLINE: "bg-green-100 text-green-800 border-green-300",
  OFFLINE: "bg-red-100 text-red-800 border-red-300",
  DEGRADED: "bg-yellow-100 text-yellow-800 border-yellow-300",
  UNKNOWN: "bg-gray-100 text-gray-600 border-gray-300",
};

const hostStatusDots: Record<string, string> = {
  ONLINE: "bg-green-500",
  OFFLINE: "bg-red-500",
  DEGRADED: "bg-yellow-500",
  UNKNOWN: "bg-gray-400",
};

export function HostStatusBadge({ status }: { status: string }) {
  const style = hostStatusStyles[status] || hostStatusStyles.UNKNOWN;
  const dot = hostStatusDots[status] || hostStatusDots.UNKNOWN;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

const severityStyles: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-300",
  WARNING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  INFO: "bg-blue-100 text-blue-800 border-blue-300",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const style = severityStyles[severity] || severityStyles.INFO;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {severity}
    </span>
  );
}

const incidentTypeStyles: Record<string, string> = {
  APPLICATION: "bg-blue-50 text-blue-700 border-blue-200",
  HOST: "bg-purple-50 text-purple-700 border-purple-200",
  HOST_CAUSED: "bg-red-50 text-red-700 border-red-200",
};

export function IncidentTypeBadge({ type }: { type: string }) {
  const style = incidentTypeStyles[type] || incidentTypeStyles.APPLICATION;
  const label = type === "HOST_CAUSED" ? "Host-Caused" : type === "HOST" ? "Host" : "App";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
