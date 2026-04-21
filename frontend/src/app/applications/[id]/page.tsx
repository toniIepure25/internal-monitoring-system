"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, ArrowPathIcon, CommandLineIcon } from "@heroicons/react/24/outline";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge, SeverityBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition, SectionStagger, SectionItem } from "@/components/ui/motion";
import { ResponseChart } from "@/components/ui/response-chart";
import { UptimeBar } from "@/components/ui/uptime-bar";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Application, HealthCandidate, Incident, Subscription, HealthCheckEntry, ContainerDiscovery, ContainerLogs, ContainerInfo } from "@/types";

interface AppDetail extends Application { health_candidates: HealthCandidate[]; }

export default function ApplicationDetailPage() {
  const params = useParams();
  const toast = useToast();
  const [app, setApp] = useState<AppDetail | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [rediscovering, setRediscovering] = useState(false);
  const [checking, setChecking] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [healthHistory, setHealthHistory] = useState<HealthCheckEntry[]>([]);
  const [editingConfig, setEditingConfig] = useState(false);
  const [configDraft, setConfigDraft] = useState({ timeout_seconds: 0, slow_threshold_ms: 0, consecutive_failures_threshold: 0, consecutive_recovery_threshold: 0, monitoring_interval_seconds: 0 });
  const [savingConfig, setSavingConfig] = useState(false);

  // Container logs state
  const [logTab, setLogTab] = useState<"backend" | "frontend">("backend");
  const [logTail, setLogTail] = useState(200);
  const [logs, setLogs] = useState<ContainerLogs | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [containerDiscovery, setContainerDiscovery] = useState<ContainerDiscovery | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [editingContainer, setEditingContainer] = useState(false);
  const [containerDraft, setContainerDraft] = useState({ frontend_container: "", backend_container: "" });
  const [savingContainer, setSavingContainer] = useState(false);
  const [showAllContainers, setShowAllContainers] = useState(false);
  const [containerSearch, setContainerSearch] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  const reload = async () => {
    try {
      const [appRes, incRes, subsRes, histRes] = await Promise.all([
        api.get<AppDetail>(`/api/applications/${params.id}`),
        api.get<{ items: Incident[] }>(`/api/incidents?application_id=${params.id}&limit=20`),
        api.get<{ items: Subscription[]; total: number }>(`/api/subscriptions?limit=200`),
        api.get<{ items: HealthCheckEntry[] }>(`/api/applications/${params.id}/health-history?limit=100`).catch(() => ({ items: [] })),
      ]);
      setApp(appRes); setIncidents(incRes.items);
      setSubscription(subsRes.items.find((s) => s.application_id === params.id) || null);
      setHealthHistory(histRes.items);
    } catch { /* noop */ }
    setLoading(false);
  };

  useEffect(() => {
    if (!params.id) return;
    reload();
    const interval = window.setInterval(reload, 10000);
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
    try {
      await api.post(`/api/applications/${app.id}/rediscover`);
      toast.info("Discovering endpoints…");
      await new Promise((r) => setTimeout(r, 3000));
      await reload();
      toast.success("Discovery complete");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
    setRediscovering(false);
  };

  const startEditConfig = () => {
    if (!app) return;
    setConfigDraft({
      timeout_seconds: app.timeout_seconds,
      slow_threshold_ms: app.slow_threshold_ms,
      consecutive_failures_threshold: app.consecutive_failures_threshold,
      consecutive_recovery_threshold: app.consecutive_recovery_threshold,
      monitoring_interval_seconds: app.monitoring_interval_seconds,
    });
    setEditingConfig(true);
  };

  const handleSaveConfig = async () => {
    if (!app) return;
    setSavingConfig(true);
    try {
      await api.patch<AppDetail>(`/api/applications/${app.id}`, configDraft);
      toast.success("Configuration updated");
      setEditingConfig(false);
      await reload();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to save"); }
    setSavingConfig(false);
  };

  const handleCheckNow = async () => {
    if (!app) return;
    setChecking(true);
    try {
      await api.post(`/api/applications/${app.id}/check-now`);
      toast.info("Checking…");
      await new Promise((r) => setTimeout(r, 2000));
      await reload();
      toast.success("Health check complete");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
    setChecking(false);
  };

  const handleTogglePref = async (key: "notify_on_down" | "notify_on_up" | "notify_on_degraded" | "notify_on_slow") => {
    if (!subscription) return;
    const newVal = !subscription[key];
    setSubscription({ ...subscription, [key]: newVal });
    try {
      await api.patch<Subscription>(`/api/subscriptions/${subscription.id}`, { [key]: newVal });
    } catch {
      setSubscription({ ...subscription, [key]: !newVal });
      toast.error("Failed to update preference");
    }
  };

  const handleSetHealthUrl = async (url: string) => {
    if (!app) return;
    try {
      await api.patch<AppDetail>(`/api/applications/${app.id}/health-url`, { health_url: url });
      toast.success("Health URL updated");
      await reload();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const fetchLogs = useCallback(async (type?: "backend" | "frontend", tail?: number) => {
    if (!app) return;
    const t = type ?? logTab;
    const containerName = t === "frontend" ? app.frontend_container : app.backend_container;
    if (!containerName) { setLogs(null); return; }
    setLogsLoading(true);
    try {
      const res = await api.get<ContainerLogs>(`/api/applications/${app.id}/logs/${t}?tail=${tail ?? logTail}`);
      setLogs(res);
      setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch { setLogs(null); }
    setLogsLoading(false);
  }, [app, logTab, logTail]);

  const handleDiscoverContainers = async () => {
    if (!app) return;
    setDiscovering(true);
    try {
      const res = await api.get<ContainerDiscovery>(`/api/applications/${app.id}/containers`);
      setContainerDiscovery(res);

      if ((res.frontend || res.backend) && !app.frontend_container && !app.backend_container) {
        await api.patch(`/api/applications/${app.id}/containers`, {
          frontend_container: res.frontend || undefined,
          backend_container: res.backend || undefined,
        });
        await reload();
        toast.success("Containers linked");
      }
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Discovery failed"); }
    setDiscovering(false);
  };

  const handleSaveContainers = async () => {
    if (!app) return;
    setSavingContainer(true);
    try {
      await api.patch(`/api/applications/${app.id}/containers`, {
        frontend_container: containerDraft.frontend_container || null,
        backend_container: containerDraft.backend_container || null,
      });
      toast.success("Containers updated");
      setEditingContainer(false);
      await reload();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to save"); }
    setSavingContainer(false);
  };

  const handlePickContainer = async (name: string, role: "frontend" | "backend") => {
    if (!app) return;
    try {
      await api.patch(`/api/applications/${app.id}/containers`, {
        [`${role}_container`]: name,
      });
      toast.success(`${role} container set to ${name}`);
      setShowAllContainers(false);
      await reload();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  if (loading) return <AppShell><div className="space-y-4"><div className="h-6 w-48 animate-pulse rounded bg-surfaceRaised" /><div className="h-[200px] animate-pulse rounded-lg bg-surfaceRaised" /><div className="h-[120px] animate-pulse rounded-lg bg-surfaceRaised" /></div></AppShell>;
  if (!app) return <AppShell><div className="rounded-lg bg-danger/10 px-4 py-3 text-[13px] text-danger">Application not found</div></AppShell>;

  return (
    <AppShell>
      <PageTransition>
        <div className="mb-5">
          <Link href="/applications" className="mb-3 inline-flex items-center gap-1 text-xs text-fgMuted hover:text-fg">
            <ArrowLeftIcon className="h-3 w-3" /> Applications
          </Link>
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
              <Button onClick={handleCheckNow} disabled={checking} variant="secondary">{checking ? "…" : "Check now"}</Button>
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
                    [app.status?.status === "UP" ? "Uptime" : app.status?.status === "DOWN" ? "Down for" : "In state for", "__uptime__"],
                    ["Created", formatDate(app.created_at)],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-[11px] text-fgSubtle">{label}</dt>
                      <dd className="mt-0.5 truncate font-medium text-fg">
                        {value === "__uptime__" ? (
                          app.status?.current_state_since ? (
                            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                              app.status?.status === "UP" ? "bg-success/10 text-success" :
                              app.status?.status === "DOWN" ? "bg-danger/10 text-danger" :
                              "bg-warning/10 text-warning"
                            }`}>
                              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none"><path d={app.status?.status === "DOWN" ? "M6 2v8M3 7l3 3 3-3" : "M6 10V2M3 5l3-3 3 3"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              {formatDuration(app.status.current_state_since)}
                            </span>
                          ) : "—"
                        ) : value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {healthHistory.length > 1 && (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div>
                      <p className="text-[11px] text-fgSubtle">Response time trend</p>
                      <ResponseChart
                        checks={healthHistory}
                        slowThreshold={app.slow_threshold_ms}
                        height={160}
                        className="mt-1"
                      />
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
                    <Link key={inc.id} href={`/incidents/${inc.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surfaceRaised/40">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-fg">{inc.title}</p>
                        <p className="text-[11px] text-fgSubtle">{formatDate(inc.started_at)}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <SeverityBadge severity={inc.severity} />
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${inc.status === "ONGOING" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>{inc.status}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <CardContent className="text-center text-xs text-fgMuted">No incidents recorded</CardContent>
              )}
            </Card></SectionItem>

            {/* Container Logs */}
            <SectionItem><Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CommandLineIcon className="h-4 w-4 text-fgSubtle" />
                  <CardTitle>Container logs</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {(app.frontend_container || app.backend_container) && (
                    <button type="button" onClick={() => {
                      setContainerDraft({ frontend_container: app.frontend_container || "", backend_container: app.backend_container || "" });
                      setEditingContainer(!editingContainer);
                    }} className="text-[11px] font-medium text-accent hover:underline">
                      {editingContainer ? "Cancel" : "Edit"}
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!app.frontend_container && !app.backend_container && !editingContainer ? (
                  <div className="space-y-3 text-center">
                    <p className="text-[12px] text-fgMuted">No containers linked to this application.</p>
                    <div className="flex justify-center gap-2">
                      <Button variant="secondary" size="xs" onClick={handleDiscoverContainers} disabled={discovering}>
                        {discovering ? "Searching…" : "Auto-discover"}
                      </Button>
                      <Button variant="secondary" size="xs" onClick={() => {
                        setContainerDraft({ frontend_container: "", backend_container: "" });
                        setEditingContainer(true);
                      }}>Set manually</Button>
                    </div>

                    {containerDiscovery && !containerDiscovery.frontend && !containerDiscovery.backend && (
                      <div className="mt-3 rounded-md bg-surfaceRaised px-3 py-2 text-left">
                        <p className="text-[11px] font-medium text-fgMuted">No matching containers found.</p>
                        {containerDiscovery.all_containers.length > 0 && (
                          <div className="mt-2">
                            <button type="button" onClick={() => setShowAllContainers(!showAllContainers)} className="text-[11px] font-medium text-accent hover:underline">
                              {showAllContainers ? "Hide" : "Show"} all {containerDiscovery.all_containers.length} containers
                            </button>
                            {showAllContainers && (
                              <div className="mt-2">
                                <input
                                  type="text"
                                  placeholder="Search containers…"
                                  value={containerSearch}
                                  onChange={(e) => setContainerSearch(e.target.value)}
                                  className="mb-2 w-full rounded border border-border bg-canvas px-2 py-1.5 font-mono text-[11px] text-fg placeholder:text-fgSubtle outline-none focus:border-accent"
                                />
                                <div className="max-h-48 space-y-1 overflow-y-auto">
                                  {containerDiscovery.all_containers
                                    .filter((c) => {
                                      if (!containerSearch) return true;
                                      const q = containerSearch.toLowerCase();
                                      return c.name.toLowerCase().includes(q) || c.image.toLowerCase().includes(q);
                                    })
                                    .map((c) => (
                                    <div key={c.name} className="flex items-center justify-between rounded px-2 py-1.5 text-[11px] hover:bg-surface">
                                      <div className="min-w-0">
                                        <p className="truncate font-mono font-medium text-fg">{c.name}</p>
                                        <p className="truncate text-fgSubtle">{c.image}</p>
                                      </div>
                                      <div className="flex shrink-0 gap-1">
                                        <button type="button" onClick={() => handlePickContainer(c.name, "backend")} className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20">BE</button>
                                        <button type="button" onClick={() => handlePickContainer(c.name, "frontend")} className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20">FE</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : editingContainer ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-fgSubtle">Backend container</label>
                      <input type="text" value={containerDraft.backend_container} onChange={(e) => setContainerDraft((d) => ({ ...d, backend_container: e.target.value }))} placeholder="e.g. myapp-backend-1" className="mt-0.5 w-full rounded border border-border bg-canvas px-2 py-1.5 font-mono text-[11px] text-fg outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-[11px] text-fgSubtle">Frontend container</label>
                      <input type="text" value={containerDraft.frontend_container} onChange={(e) => setContainerDraft((d) => ({ ...d, frontend_container: e.target.value }))} placeholder="e.g. myapp-frontend-1" className="mt-0.5 w-full rounded border border-border bg-canvas px-2 py-1.5 font-mono text-[11px] text-fg outline-none focus:border-accent" />
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <Button variant="secondary" size="xs" onClick={handleDiscoverContainers} disabled={discovering}>
                        {discovering ? "…" : "Auto-discover"}
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="xs" onClick={() => setEditingContainer(false)}>Cancel</Button>
                        <Button size="xs" onClick={handleSaveContainers} disabled={savingContainer}>{savingContainer ? "Saving…" : "Save"}</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Tab bar */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1 rounded-md bg-surfaceRaised p-0.5">
                        {(["backend", "frontend"] as const).map((tab) => {
                          const name = tab === "frontend" ? app.frontend_container : app.backend_container;
                          return (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => { setLogTab(tab); setLogs(null); }}
                              className={`rounded px-3 py-1 text-[11px] font-medium transition-colors ${logTab === tab ? "bg-surface text-fg shadow-sm" : "text-fgMuted hover:text-fg"} ${!name ? "opacity-40" : ""}`}
                              disabled={!name}
                            >
                              {tab === "backend" ? "Backend" : "Frontend"}
                              {!name && <span className="ml-1 text-[10px]">(none)</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <select value={logTail} onChange={(e) => setLogTail(Number(e.target.value))} className="rounded border border-border bg-canvas px-1.5 py-0.5 text-[11px] text-fgMuted outline-none">
                          {[50, 200, 500, 1000].map((n) => <option key={n} value={n}>{n} lines</option>)}
                        </select>
                        <button type="button" onClick={() => fetchLogs()} disabled={logsLoading} className="rounded p-1 text-fgMuted transition-colors hover:bg-surfaceRaised hover:text-fg" title="Refresh">
                          <ArrowPathIcon className={`h-3.5 w-3.5 ${logsLoading ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                    </div>

                    {/* Container info */}
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-fgSubtle">Container:</span>
                      <code className="rounded bg-surfaceRaised px-1.5 py-0.5 font-mono text-fg">
                        {logTab === "frontend" ? app.frontend_container : app.backend_container}
                      </code>
                    </div>

                    {/* Log output */}
                    {!logs && !logsLoading ? (
                      <div className="rounded-md bg-[#0d1117] px-3 py-6 text-center">
                        <p className="text-[11px] text-[#8b949e]">Click refresh to load logs</p>
                        <button type="button" onClick={() => fetchLogs()} className="mt-2 rounded bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent hover:bg-accent/20">
                          Load logs
                        </button>
                      </div>
                    ) : (
                      <div className="relative max-h-[400px] overflow-y-auto rounded-md bg-[#0d1117] p-3">
                        {logsLoading && !logs && (
                          <div className="flex items-center gap-2 py-4 text-center text-[11px] text-[#8b949e]">
                            <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> Loading logs…
                          </div>
                        )}
                        {logs && (
                          <>
                            {logs.success ? (
                              <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-[#c9d1d9]">
                                {logs.lines || "(empty)"}
                              </pre>
                            ) : (
                              <p className="text-[11px] text-red-400">{logs.error || "Failed to fetch logs"}</p>
                            )}
                            {logs.success && <p className="mt-2 border-t border-[#21262d] pt-2 text-[10px] text-[#484f58]">{logs.line_count} lines · {logs.container_name}</p>}
                          </>
                        )}
                        <div ref={logEndRef} />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card></SectionItem>
          </div>

          <div className="space-y-4">
            {app.health_candidates.filter((c) => c.score > 0).length > 0 && (
              <SectionItem><Card>
                <CardHeader><CardTitle>Health candidates</CardTitle></CardHeader>
                <div className="divide-y divide-border">
                  {app.health_candidates
                    .filter((c) => c.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .map((c) => (
                    <div key={c.id} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[11px] text-fgMuted">{c.url.replace(app.base_url, "") || "/"}</span>
                        <div className="flex items-center gap-1.5">
                          {c.is_selected && <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">Active</span>}
                          <div className="flex h-1.5 w-12 overflow-hidden rounded-full bg-surfaceRaised">
                            <div className={`h-full rounded-full ${c.score >= 60 ? "bg-success" : c.score >= 30 ? "bg-warning" : "bg-fgSubtle"}`} style={{ width: `${c.score}%` }} />
                          </div>
                          <span className={`text-[10px] font-semibold tabular-nums ${c.score >= 60 ? "text-success" : c.score >= 30 ? "text-warning" : "text-fgSubtle"}`}>{c.score}</span>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-fgSubtle">
                        {c.http_status && <span className="rounded bg-surfaceRaised px-1 py-px">HTTP {c.http_status}</span>}
                        {c.response_time_ms != null && <span className="rounded bg-surfaceRaised px-1 py-px tabular-nums">{c.response_time_ms}ms</span>}
                        {c.is_json && <span className="rounded bg-accent/10 px-1 py-px text-accent">JSON</span>}
                        {c.has_health_indicators && <span className="rounded bg-success/10 px-1 py-px text-success">Health data</span>}
                      </div>
                      {!c.is_selected && (
                        <button type="button" onClick={() => handleSetHealthUrl(c.url)} className="mt-1.5 text-[11px] font-medium text-accent hover:underline">Use this endpoint</button>
                      )}
                    </div>
                  ))}
                </div>
              </Card></SectionItem>
            )}

            <SectionItem><Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                {!editingConfig && (
                  <button type="button" onClick={startEditConfig} className="text-[11px] font-medium text-accent hover:underline">Edit</button>
                )}
              </CardHeader>
              <CardContent>
                {editingConfig ? (
                  <div className="space-y-3">
                    {([
                      { label: "Timeout (s)", key: "timeout_seconds" as const, min: 1, max: 60 },
                      { label: "Slow threshold (ms)", key: "slow_threshold_ms" as const, min: 100, max: 30000 },
                      { label: "Failures before DOWN", key: "consecutive_failures_threshold" as const, min: 1, max: 20 },
                      { label: "Successes before UP", key: "consecutive_recovery_threshold" as const, min: 1, max: 10 },
                      { label: "Check interval (s)", key: "monitoring_interval_seconds" as const, min: 10, max: 3600 },
                    ] as const).map((field) => (
                      <div key={field.key} className="flex items-center justify-between gap-2">
                        <label className="text-[11px] text-fgSubtle">{field.label}</label>
                        <input
                          type="number"
                          min={field.min}
                          max={field.max}
                          value={configDraft[field.key]}
                          onChange={(e) => setConfigDraft((d) => ({ ...d, [field.key]: parseInt(e.target.value, 10) || 0 }))}
                          className="w-20 rounded border border-border bg-canvas px-2 py-1 text-right text-[11px] font-medium tabular-nums text-fg outline-none focus:border-accent"
                        />
                      </div>
                    ))}
                    <div className="flex justify-end gap-2 border-t border-border pt-3">
                      <Button variant="secondary" size="xs" onClick={() => setEditingConfig(false)}>Cancel</Button>
                      <Button size="xs" onClick={handleSaveConfig} disabled={savingConfig}>{savingConfig ? "Saving…" : "Save"}</Button>
                    </div>
                  </div>
                ) : (
                  <dl className="space-y-3 text-[13px]">
                    {[
                      ["Timeout", `${app.timeout_seconds}s`],
                      ["Slow threshold", `${app.slow_threshold_ms}ms`],
                      ["Failures before DOWN", `${app.consecutive_failures_threshold} checks`],
                      ["Successes before UP", `${app.consecutive_recovery_threshold} checks`],
                      ["Check interval", `${app.monitoring_interval_seconds}s`],
                      ["Consecutive failures", `${app.status?.consecutive_failures ?? 0}`],
                      ["Consecutive successes", `${app.status?.consecutive_successes ?? 0}`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between">
                        <dt className="text-[11px] text-fgSubtle">{label}</dt>
                        <dd className="rounded bg-surfaceRaised px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-fgMuted">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardContent>
            </Card></SectionItem>

            {subscription && (
              <SectionItem><Card>
                <CardHeader><CardTitle>Notification preferences</CardTitle></CardHeader>
                <CardContent>
                  <p className="mb-2.5 text-[11px] text-fgSubtle">Toggle which events trigger notifications for this app.</p>
                  <div className="space-y-2">
                    {([
                      { key: "notify_on_down" as const, label: "Down", desc: "App becomes unreachable" },
                      { key: "notify_on_up" as const, label: "Recovery", desc: "App comes back online" },
                      { key: "notify_on_degraded" as const, label: "Degraded", desc: "App is partially impaired" },
                      { key: "notify_on_slow" as const, label: "Slow", desc: "Response time exceeds threshold" },
                    ] as const).map((n) => (
                      <button
                        key={n.key}
                        type="button"
                        onClick={() => handleTogglePref(n.key)}
                        className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surfaceRaised/50"
                      >
                        <div>
                          <p className="text-[12px] font-medium text-fg">{n.label}</p>
                          <p className="text-[10px] text-fgSubtle">{n.desc}</p>
                        </div>
                        <div className={`h-4 w-7 rounded-full transition-colors ${subscription[n.key] ? "bg-accent" : "bg-border"}`}>
                          <div className={`mt-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${subscription[n.key] ? "translate-x-3.5" : "translate-x-0.5"}`} />
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card></SectionItem>
            )}
          </div>
        </SectionStagger>
      </PageTransition>
    </AppShell>
  );
}
