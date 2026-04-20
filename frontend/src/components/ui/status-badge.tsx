"use client";

const appStatusStyles: Record<string, string> = {
  UP: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  DOWN: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  DEGRADED: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  SLOW: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
  UNKNOWN: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

const hostStatusStyles: Record<string, string> = {
  ONLINE: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  OFFLINE: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  DEGRADED: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  UNKNOWN: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

const severityStyles: Record<string, string> = {
  CRITICAL: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  WARNING: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  INFO: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const style = severityStyles[severity] || severityStyles.INFO;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      {severity}
    </span>
  );
}

const incidentTypeStyles: Record<string, string> = {
  APPLICATION: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
  HOST: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
  HOST_CAUSED: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
};

export function IncidentTypeBadge({ type }: { type: string }) {
  const style = incidentTypeStyles[type] || incidentTypeStyles.APPLICATION;
  const label = type === "HOST_CAUSED" ? "Host-Caused" : type === "HOST" ? "Host" : "App";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
