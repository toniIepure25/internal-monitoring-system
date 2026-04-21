"use client";

import { useState, useEffect } from "react";
import { UptimeBar } from "@/components/ui/uptime-bar";
import { formatDate, formatDuration } from "@/lib/utils";
import type { AppState, HealthCheckEntry } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8090";

interface StatusApp {
  id: string;
  display_name: string;
  base_url: string;
  status: {
    status: AppState;
    last_checked_at: string | null;
    last_response_time_ms: number | null;
    last_http_status: number | null;
    current_state_since: string | null;
  } | null;
}

interface StatusIncident {
  id: string;
  title: string;
  status: string;
  severity: string;
  started_at: string | null;
  resolved_at: string | null;
}

interface PublicStatusData {
  overall_status: string;
  applications: StatusApp[];
  recent_incidents: StatusIncident[];
}

const OVERALL_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  OPERATIONAL:    { label: "All Systems Operational",  color: "text-success", bg: "bg-success/10", border: "border-success/20" },
  DEGRADED:       { label: "Degraded Performance",     color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
  PARTIAL_OUTAGE: { label: "Partial Outage",           color: "text-danger",  bg: "bg-danger/10",  border: "border-danger/20" },
  MAJOR_OUTAGE:   { label: "Major Outage",             color: "text-danger",  bg: "bg-danger/10",  border: "border-danger/20" },
  UNKNOWN:        { label: "Status Unknown",           color: "text-fgMuted", bg: "bg-fgSubtle/10", border: "border-border" },
};

const STATUS_DOT: Record<string, string> = {
  UP: "bg-success animate-status-pulse-success",
  DOWN: "bg-danger animate-status-pulse-danger",
  SLOW: "bg-warning animate-status-pulse-warning",
  DEGRADED: "bg-warning animate-status-pulse-warning",
  UNKNOWN: "bg-fgSubtle",
};

const STATUS_LABEL: Record<string, string> = {
  UP: "Operational",
  DOWN: "Down",
  SLOW: "Slow",
  DEGRADED: "Degraded",
  UNKNOWN: "Unknown",
};

const STATUS_TEXT_COLOR: Record<string, string> = {
  UP: "text-success",
  DOWN: "text-danger",
  SLOW: "text-warning",
  DEGRADED: "text-warning",
  UNKNOWN: "text-fgMuted",
};

async function fetchPublic<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export default function PublicStatusPage() {
  const [data, setData] = useState<PublicStatusData | null>(null);
  const [healthHistory, setHealthHistory] = useState<Record<string, HealthCheckEntry[]>>({});
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const status = await fetchPublic<PublicStatusData>("/api/public/status");
        setData(status);
        setError(false);

        const historyResults = await Promise.all(
          status.applications.map((a) =>
            fetchPublic<{ items: HealthCheckEntry[] }>(`/api/public/status/${a.id}/health-history?limit=30`).catch(() => ({ items: [] }))
          )
        );
        const map: Record<string, HealthCheckEntry[]> = {};
        status.applications.forEach((a, i) => { map[a.id] = historyResults[i].items; });
        setHealthHistory(map);
      } catch {
        setError(true);
      }
    }
    load();
    const interval = window.setInterval(load, 15000);
    return () => window.clearInterval(interval);
  }, []);

  const overall = data ? OVERALL_CONFIG[data.overall_status] || OVERALL_CONFIG.UNKNOWN : null;

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-8 text-center">
        <h1 className="text-xl font-semibold text-fg">System Status</h1>
        <p className="mt-1 text-xs text-fgMuted">Real-time operational status of our services</p>
      </header>

      {error && !data && (
        <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-center text-[13px] text-danger">
          Unable to load status data. Please try again later.
        </div>
      )}

      {data && (
        <>
          {/* Overall status banner */}
          <div className={`mb-6 rounded-lg border ${overall!.border} ${overall!.bg} px-5 py-4`}>
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${data.overall_status === "OPERATIONAL" ? "bg-success animate-status-pulse-success" : data.overall_status === "DEGRADED" ? "bg-warning animate-status-pulse-warning" : data.overall_status.includes("OUTAGE") ? "bg-danger animate-status-pulse-danger" : "bg-fgSubtle"}`} />
              <span className={`text-[15px] font-semibold ${overall!.color}`}>{overall!.label}</span>
            </div>
          </div>

          {/* Applications */}
          <section className="mb-6 rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-[13px] font-medium text-fg">Applications</h2>
            </div>
            <div className="divide-y divide-border">
              {data.applications.map((app) => {
                const s = app.status?.status || "UNKNOWN";
                return (
                  <div key={app.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-fg">{app.display_name}</p>
                        <p className="truncate text-[11px] text-fgSubtle">{app.base_url}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {app.status?.last_response_time_ms != null && (
                          <span className="text-[11px] tabular-nums text-fgSubtle">{app.status.last_response_time_ms}ms</span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s] || STATUS_DOT.UNKNOWN}`} />
                          <span className={`text-[11px] font-medium ${STATUS_TEXT_COLOR[s] || STATUS_TEXT_COLOR.UNKNOWN}`}>{STATUS_LABEL[s] || s}</span>
                          {app.status?.current_state_since && (
                            <span className="text-[11px] tabular-nums text-fgSubtle">{formatDuration(app.status.current_state_since)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {healthHistory[app.id]?.length > 0 && (
                      <div className="mt-2">
                        <UptimeBar checks={healthHistory[app.id]} slots={30} />
                      </div>
                    )}
                  </div>
                );
              })}
              {data.applications.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-fgMuted">No monitored applications.</p>
              )}
            </div>
          </section>

          {/* Recent incidents */}
          <section className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="text-[13px] font-medium text-fg">Recent incidents</h2>
            </div>
            {data.recent_incidents.length > 0 ? (
              <div className="divide-y divide-border">
                {data.recent_incidents.map((inc) => (
                  <div key={inc.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-fg">{inc.title}</p>
                      <p className="text-[11px] text-fgSubtle">{inc.started_at ? formatDate(inc.started_at) : "—"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${inc.severity === "CRITICAL" ? "bg-danger/10 text-danger" : inc.severity === "WARNING" ? "bg-warning/10 text-warning" : "bg-fgSubtle/10 text-fgMuted"}`}>{inc.severity}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${inc.status === "ONGOING" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>{inc.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-6 text-center text-xs text-fgMuted">No recent incidents.</p>
            )}
          </section>

          <footer className="mt-6 text-center text-[11px] text-fgSubtle">
            Updated every 15 seconds
          </footer>
        </>
      )}
    </div>
  );
}
