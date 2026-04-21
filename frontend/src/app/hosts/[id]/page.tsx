"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, KeyIcon, LinkIcon } from "@heroicons/react/24/outline";
import { AppShell } from "@/components/layout/app-shell";
import { HostStatusBadge } from "@/components/ui/status-badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTableShell, Th, Td } from "@/components/ui/data-table-shell";
import { Button } from "@/components/ui/button";
import { PageTransition, SectionStagger, SectionItem } from "@/components/ui/motion";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { HostDetail, Application } from "@/types";

export default function HostDetailPage() {
  const params = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const [host, setHost] = useState<HostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editingEnv, setEditingEnv] = useState(false);
  const [envDraft, setEnvDraft] = useState("");
  const [savingEnv, setSavingEnv] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [allApps, setAllApps] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState("");

  useEffect(() => {
    async function load() {
      try { setHost(await api.get<HostDetail>(`/api/hosts/${params.id}`)); }
      catch { setError(true); }
      setLoading(false);
    }
    if (!params.id) return;
    load();
    const interval = window.setInterval(load, 10000);
    return () => window.clearInterval(interval);
  }, [params.id]);

  const handleSaveEnv = async () => {
    if (!host) return;
    setSavingEnv(true);
    try {
      await api.patch(`/api/hosts/${host.id}`, { environment: envDraft || null });
      setHost({ ...host, environment: envDraft || null });
      setEditingEnv(false);
      toast.success("Environment updated");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
    setSavingEnv(false);
  };

  const handleRegenerate = async () => {
    if (!host) return;
    const ok = await confirm({ title: "Regenerate API key?", description: "The old key will stop working immediately.", confirmLabel: "Regenerate", variant: "danger" });
    if (!ok) return;
    setRegenerating(true);
    try {
      const res = await api.post<{ api_key: string }>(`/api/hosts/${host.id}/regenerate-key`);
      setNewApiKey(res.api_key);
      toast.success("API key regenerated");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
    setRegenerating(false);
  };

  const openLinkApps = async () => {
    try { const res = await api.get<{ items: Application[] }>("/api/applications?limit=200"); setAllApps(res.items); } catch { /* noop */ }
    setLinking(true);
  };

  const handleLinkApp = async () => {
    if (!host || !selectedAppId) return;
    try {
      await api.post(`/api/hosts/${host.id}/applications`, { application_id: selectedAppId });
      toast.success("Application linked");
      setSelectedAppId("");
      setLinking(false);
      setHost(await api.get<HostDetail>(`/api/hosts/${host.id}`));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const handleUnlinkApp = async (appId: string, appName: string) => {
    if (!host) return;
    const ok = await confirm({ title: `Unlink ${appName}?`, description: "The application will no longer be associated with this host.", confirmLabel: "Unlink", variant: "danger" });
    if (!ok) return;
    try {
      await api.delete(`/api/hosts/${host.id}/applications/${appId}`);
      toast.success("Application unlinked");
      setHost(await api.get<HostDetail>(`/api/hosts/${host.id}`));
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  if (loading) return <AppShell><div className="space-y-4"><div className="h-6 w-48 animate-pulse rounded bg-surfaceRaised" /><div className="h-[160px] animate-pulse rounded-lg bg-surfaceRaised" /><div className="h-[120px] animate-pulse rounded-lg bg-surfaceRaised" /></div></AppShell>;
  if (error || !host) {
    return (
      <AppShell>
        <div className="rounded-lg bg-danger/10 px-4 py-3 text-[13px] text-danger">
          Host not found. <Link href="/hosts" className="underline">Back to hosts</Link>
        </div>
      </AppShell>
    );
  }

  const linkedAppIds = new Set(host.applications?.map((a) => a.id) || []);

  return (
    <AppShell>
      <PageTransition>
        <div className="mb-5">
          <Link href="/hosts" className="mb-3 inline-flex items-center gap-1 text-xs text-fgMuted hover:text-fg">
            <ArrowLeftIcon className="h-3 w-3" /> Hosts
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-fg">{host.display_name}</h1>
                <HostStatusBadge status={host.status?.status || "UNKNOWN"} />
              </div>
              <p className="mt-0.5 text-xs text-fgMuted">{host.hostname}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" size="sm" onClick={handleRegenerate} disabled={regenerating}>
                <KeyIcon className="mr-1 h-3.5 w-3.5" />{regenerating ? "…" : "Regenerate key"}
              </Button>
            </div>
          </div>
        </div>

        {newApiKey && (
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
            <p className="text-[11px] font-medium text-accent">New API key (copy it now, it won't be shown again):</p>
            <code className="mt-1 block break-all rounded bg-canvas px-2 py-1 font-mono text-[12px] text-fg">{newApiKey}</code>
          </div>
        )}

        <SectionStagger className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <SectionItem><Card>
              <CardHeader><CardTitle>Details</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] md:grid-cols-3">
                  <div>
                    <dt className="text-[11px] text-fgSubtle">Environment</dt>
                    <dd className="mt-0.5 font-medium text-fg">
                      {editingEnv ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={envDraft}
                            onChange={(e) => setEnvDraft(e.target.value)}
                            placeholder="e.g. production"
                            className="w-28 rounded border border-border bg-canvas px-2 py-0.5 text-[12px] text-fg outline-none focus:border-accent"
                          />
                          <Button size="xs" onClick={handleSaveEnv} disabled={savingEnv}>{savingEnv ? "…" : "Save"}</Button>
                          <Button size="xs" variant="secondary" onClick={() => setEditingEnv(false)}>Cancel</Button>
                        </div>
                      ) : (
                        <span className="group inline-flex items-center gap-1.5">
                          {host.environment || "—"}
                          <button type="button" onClick={() => { setEnvDraft(host.environment || ""); setEditingEnv(true); }} className="text-[10px] text-fgSubtle opacity-0 transition-opacity hover:text-accent group-hover:opacity-100">Edit</button>
                        </span>
                      )}
                    </dd>
                  </div>
                  {[
                    ["Last heartbeat", host.status?.last_heartbeat_at ? formatDate(host.status.last_heartbeat_at) : "Never"],
                    ["Registered", formatDate(host.created_at)],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-[11px] text-fgSubtle">{label}</dt>
                      <dd className="mt-0.5 font-medium text-fg">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card></SectionItem>

            <SectionItem><Card>
              <CardHeader>
                <CardTitle>Linked applications</CardTitle>
                <Button variant="ghost" size="xs" onClick={openLinkApps}><LinkIcon className="mr-1 h-3 w-3" />Link app</Button>
              </CardHeader>
              {linking && (
                <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                  <select value={selectedAppId} onChange={(e) => setSelectedAppId(e.target.value)} className="filter-input flex-1">
                    <option value="">Select app…</option>
                    {allApps.filter((a) => !linkedAppIds.has(a.id)).map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                  </select>
                  <Button size="xs" onClick={handleLinkApp} disabled={!selectedAppId}>Add</Button>
                  <Button size="xs" variant="secondary" onClick={() => setLinking(false)}>Cancel</Button>
                </div>
              )}
              {host.applications && host.applications.length > 0 ? (
                <div className="divide-y divide-border">
                  {host.applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-surfaceRaised/40">
                      <Link href={`/applications/${app.id}`} className="text-[13px] font-medium text-fg hover:text-accent">{app.display_name}</Link>
                      <button type="button" onClick={() => handleUnlinkApp(app.id, app.display_name)} className="text-[11px] text-fgSubtle hover:text-danger">Unlink</button>
                    </div>
                  ))}
                </div>
              ) : (
                <CardContent className="text-center text-xs text-fgMuted">No linked applications</CardContent>
              )}
            </Card></SectionItem>
          </div>

          <SectionItem><Card>
            <CardHeader><CardTitle>Recent heartbeats</CardTitle></CardHeader>
            {host.recent_heartbeats && host.recent_heartbeats.length > 0 ? (
              <div className="max-h-80 overflow-y-auto">
                <DataTableShell>
                  <table className="w-full">
                    <thead><tr className="border-b border-border"><Th>Time</Th><Th>IP</Th><Th>Uptime</Th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {host.recent_heartbeats.map((hb, i) => (
                        <tr key={i}>
                          <Td className="text-fgMuted">{hb.received_at ? formatDate(hb.received_at) : "—"}</Td>
                          <Td className="text-fgMuted">{hb.ip_address || "—"}</Td>
                          <Td className="tabular-nums text-fgMuted">{hb.uptime_seconds != null ? `${Math.round(hb.uptime_seconds / 3600)}h` : "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTableShell>
              </div>
            ) : (
              <CardContent><EmptyState title="No heartbeats" description="Heartbeats appear once the host agent begins reporting." className="py-6" /></CardContent>
            )}
          </Card></SectionItem>
        </SectionStagger>
      </PageTransition>
    </AppShell>
  );
}
