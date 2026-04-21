"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge, SeverityBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition, SectionStagger, SectionItem } from "@/components/ui/motion";
import { ResponseSparkline } from "@/components/ui/response-sparkline";
import { UptimeBar } from "@/components/ui/uptime-bar";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Application, HealthCandidate, Incident, Subscription, HealthCheckEntry } from "@/types";

interface AppDetail extends Application { health_candidates: HealthCandidate[]; }

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [app, setApp] = useState<AppDetail | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [rediscovering, setRediscovering] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [healthHistory, setHealthHistory] = useState<HealthCheckEntry[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [appRes, incRes, subsRes, histRes] = await Promise.all([
          api.get<AppDetail>(`/api/applications/${params.id}`),
          api.get<{ items: Incident[] }>(`/api/incidents?application_id=${params.id}&limit=20`),
          api.get<{ items: Subscription[]; total: number }>(`/api/subscriptions?limit=200`),
          api.get<{ items: HealthCheckEntry[] }>(`/api/applications/${params.id}/health-history?limit=50`).catch(() => ({ items: [] })),
        ]);
        setApp(appRes); setIncidents(incRes.items);
        setSubscription(subsRes.items.find((s) => s.application_id === params.id) || null);
        setHealthHistory(histRes.items);
      } catch { /* noop */ }
      setLoading(false);
    }
    if (!params.id) return;
    load();
    const interval = window.setInterval(load, 10000);
    return () => window.clearInterval(interval);
  }, [params.id]);

  const handleSubscribe = async () => {
    if (!app) return;
    setSubscribing(true);
    try {
      if (subscription) { await api.delete(`/api/subscriptions/${subscription.id}`); setSubscription(null); toast.success("Unsubscribed"); }
      else { const s = await api.post<Subscription>("/api/subscriptions", { application_id: app.id }); setSubscription(s); toast.success("Subscribed"); }
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
    setSubscribing(false);
  };

  const handleRediscover = async () => {
    if (!app) return;
    setRediscovering(true);
    try { await api.post(`/api/applications/${app.id}/rediscover`); toast.info("Discovery started"); } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
    setRediscovering(false);
  };

  const handleSetHealthUrl = async (url: string) => {
    if (!app) return;
    try {
      const updated = await api.patch<AppDetail>(`/api/applications/${app.id}/health-url`, { health_url: url });
      setApp({ ...app, ...updated, health_candidates: app.health_candidates });
      toast.success("Health URL updated");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  if (loading) return <AppShell><p className="text-sm text-fgMuted">Loading…</p></AppShell>;
  if (!app) return <AppShell><div className="rounded-lg bg-danger/10 px-4 py-3 text-[13px] text-danger">Application not found</div></AppShell>;

  return (
    <AppShell>
      <PageTransition>
        <div className="mb-5">
          <button type="button" onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1 text-xs text-fgMuted hover:text-fg">
            <ArrowLeftIcon className="h-3 w-3" /> Back
          </button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-fg">{app.display_name}</h1>
                <StatusBadge status={app.status?.status || "UNKNOWN"} />
                {app.is_maintenance && <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-warning">Maintenance</span>}
              </div>
              <p className="mt-0.5 text-xs text-fgMuted">{app.base_url}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button onClick={handleSubscribe} disabled={subscribing}>{subscribing ? "…" : subscription ? "Unsubscribe" : "Subscribe"}</Button>
              <Button variant="secondary" onClick={handleRediscover} disabled={rediscovering}>{rediscovering ? "…" : "Re-discover"}</Button>
            </div>
          </div>
        </div>

        <SectionStagger className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <SectionItem><Card>
              <CardHeader><CardTitle>Monitoring status</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] md:grid-cols-4">
                  {[
                    ["Health URL", app.health_url || "Not set"],
                    ["Detection", app.detection_source],
                    ["Interval", `${app.monitoring_interval_seconds}s`],
                    ["Last checked", app.status?.last_checked_at ? formatDate(app.status.last_checked_at) : "Never"],
                    ["Response", app.status?.last_response_time_ms != null ? `${app.status.last_response_time_ms}ms` : "—"],
                    ["HTTP status", app.status?.last_http_status || "—"],
                    ["In current state", app.status?.current_state_since ? formatDuration(app.status.current_state_since) : "—"],
                    ["Created", formatDate(app.created_at)],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-[11px] text-fgSubtle">{label}</dt>
                      <dd className="mt-0.5 truncate font-medium text-fg">{value}</dd>
                    </div>
                  ))}
                </dl>
                {healthHistory.length > 1 && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div>
                      <p className="text-[11px] text-fgSubtle">Response time trend</p>
                      <ResponseSparkline checks={healthHistory} width={320} height={40} className="mt-1" />
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] text-fgSubtle">Uptime</p>
                      <UptimeBar checks={healthHistory} slots={40} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card></SectionItem>

            <SectionItem><Card>
              <CardHeader><CardTitle>Incident history</CardTitle></CardHeader>
              {incidents.length > 0 ? (
                <div className="divide-y divide-border">
                  {incidents.map((inc) => (
                    <div key={inc.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-fg">{inc.title}</p>
                        <p className="text-[11px] text-fgSubtle">{formatDate(inc.started_at)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <SeverityBadge severity={inc.severity} />
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${inc.status === "ONGOING" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>{inc.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <CardContent className="text-center text-xs text-fgMuted">No incidents recorded</CardContent>
              )}
            </Card></SectionItem>
          </div>

          <SectionItem><Card>
            <CardHeader><CardTitle>Health candidates</CardTitle></CardHeader>
            {app.health_candidates.length > 0 ? (
              <div className="divide-y divide-border">
                {app.health_candidates.sort((a, b) => b.score - a.score).map((c) => (
                  <div key={c.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[11px] text-fgMuted">{c.url.replace(app.base_url, "")}</span>
                      <span className={`text-[11px] font-semibold tabular-nums ${c.score >= 50 ? "text-success" : c.score > 0 ? "text-warning" : "text-fgSubtle"}`}>{c.score}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-fgSubtle">
                      {c.http_status && <span>HTTP {c.http_status}</span>}
                      {c.response_time_ms != null && <span className="tabular-nums">{c.response_time_ms}ms</span>}
                      {c.is_json && <span className="text-accent">JSON</span>}
                      {c.has_health_indicators && <span className="text-success">Health</span>}
                      {c.is_selected && <span className="rounded bg-accent/10 px-1 text-accent">Selected</span>}
                    </div>
                    {!c.is_selected && c.score > 0 && (
                      <button type="button" onClick={() => handleSetHealthUrl(c.url)} className="mt-1 text-[11px] font-medium text-accent hover:underline">Use this endpoint</button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <CardContent className="text-center text-xs text-fgMuted">No candidates probed yet.</CardContent>
            )}
          </Card></SectionItem>
        </SectionStagger>
      </PageTransition>
    </AppShell>
  );
}
