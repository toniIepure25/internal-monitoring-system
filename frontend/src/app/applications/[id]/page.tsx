"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge, SeverityBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Application, HealthCandidate, Incident, Subscription } from "@/types";

interface AppDetail extends Application {
  health_candidates: HealthCandidate[];
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [app, setApp] = useState<AppDetail | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [rediscovering, setRediscovering] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [appRes, incRes, subsRes] = await Promise.all([
          api.get<AppDetail>(`/api/applications/${params.id}`),
          api.get<{ items: Incident[] }>(`/api/incidents?application_id=${params.id}&limit=20`),
          api.get<{ items: Subscription[]; total: number }>(`/api/subscriptions?limit=200`),
        ]);
        setApp(appRes);
        setIncidents(incRes.items);
        setSubscription(subsRes.items.find((item) => item.application_id === params.id) || null);
      } catch {}
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
      if (subscription) {
        await api.delete(`/api/subscriptions/${subscription.id}`);
        setSubscription(null);
        alert("Unsubscribed successfully!");
      } else {
        const created = await api.post<Subscription>("/api/subscriptions", { application_id: app.id });
        setSubscription(created);
        alert("Subscribed successfully!");
      }
    } catch (err: any) {
      alert(err.message || `Failed to ${subscription ? "unsubscribe" : "subscribe"}`);
    }
    setSubscribing(false);
  };

  const handleRediscover = async () => {
    if (!app) return;
    setRediscovering(true);
    try {
      await api.post(`/api/applications/${app.id}/rediscover`);
      alert("Discovery started. The status will update automatically.");
    } catch {}
    setRediscovering(false);
  };

  const handleSetHealthUrl = async (url: string) => {
    if (!app) return;
    try {
      const updated = await api.patch<AppDetail>(`/api/applications/${app.id}/health-url`, { health_url: url });
      setApp({ ...app, ...updated, health_candidates: app.health_candidates });
    } catch {}
  };

  if (loading) {
    return <AppShell><div className="text-gray-500 text-sm">Loading...</div></AppShell>;
  }

  if (!app) {
    return <AppShell><div className="text-red-500">Application not found</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-3 inline-block">&larr; Back</button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{app.display_name}</h1>
              <StatusBadge status={app.status?.status || "UNKNOWN"} />
              {app.is_maintenance && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Maintenance</span>}
            </div>
            <p className="text-sm text-gray-500 mt-1">{app.base_url}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {subscribing ? "Working..." : subscription ? "Unsubscribe" : "Subscribe"}
            </button>
            <button
              onClick={handleRediscover}
              disabled={rediscovering}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
            >
              Re-discover
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Monitoring Status</h2>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Health URL</dt>
                <dd className="font-medium text-gray-900 truncate">{app.health_url || "Not set"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Detection</dt>
                <dd className="font-medium text-gray-900">{app.detection_source}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Interval</dt>
                <dd className="font-medium text-gray-900">{app.monitoring_interval_seconds}s</dd>
              </div>
              <div>
                <dt className="text-gray-500">Last Checked</dt>
                <dd className="font-medium text-gray-900">{app.status?.last_checked_at ? formatDate(app.status.last_checked_at) : "Never"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Response Time</dt>
                <dd className="font-medium text-gray-900">{app.status?.last_response_time_ms != null ? `${app.status.last_response_time_ms}ms` : "-"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">HTTP Status</dt>
                <dd className="font-medium text-gray-900">{app.status?.last_http_status || "-"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Environment</dt>
                <dd className="font-medium text-gray-900">{app.environment || "-"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd className="font-medium text-gray-900">{formatDate(app.created_at)}</dd>
              </div>
            </dl>
          </div>

          {/* Incidents */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Incident History</h2>
            </div>
            {incidents.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {incidents.map((inc) => (
                  <div key={inc.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{inc.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(inc.started_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={inc.severity} />
                      <span className={`text-xs px-2 py-0.5 rounded ${inc.status === "ONGOING" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                        {inc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No incidents recorded</p>
            )}
          </div>
        </div>

        {/* Discovery Candidates */}
        <div>
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Health Candidates</h2>
            </div>
            {app.health_candidates.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {app.health_candidates
                  .sort((a, b) => b.score - a.score)
                  .map((c) => (
                    <div key={c.id} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-gray-600 truncate flex-1 mr-2">
                          {c.url.replace(app.base_url, "")}
                        </span>
                        <span className={`text-xs font-bold ${c.score >= 50 ? "text-green-600" : c.score > 0 ? "text-yellow-600" : "text-gray-400"}`}>
                          {c.score}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {c.http_status && <span>HTTP {c.http_status}</span>}
                        {c.response_time_ms != null && <span>{c.response_time_ms}ms</span>}
                        {c.is_json && <span className="text-blue-500">JSON</span>}
                        {c.has_health_indicators && <span className="text-green-500">Health</span>}
                        {c.is_selected && <span className="bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded">Selected</span>}
                      </div>
                      {!c.is_selected && c.score > 0 && (
                        <button
                          onClick={() => handleSetHealthUrl(c.url)}
                          className="text-xs text-brand-600 hover:text-brand-700 mt-1"
                        >
                          Use this endpoint
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <p className="px-5 py-6 text-center text-sm text-gray-400">
                No candidates probed yet. Discovery may still be running.
              </p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
