"use client";

import { useState, useEffect, useCallback } from "react";
import { EnvelopeIcon, ChatBubbleLeftIcon, BellAlertIcon } from "@heroicons/react/24/outline";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { SelectField } from "@/components/ui/select-field";
import { PageTransition, SectionStagger, SectionItem } from "@/components/ui/motion";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { NotificationChannel } from "@/types";
import { getDefaultMonitoringInterval, setDefaultMonitoringInterval } from "@/lib/monitoring-settings";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(Array.from(rawData, (char) => char.charCodeAt(0)));
}

const channelIcons: Record<string, React.ElementType> = { email: EnvelopeIcon, telegram: ChatBubbleLeftIcon, browser_push: BellAlertIcon };
const channelLabels: Record<string, string> = { email: "Email", telegram: "Telegram", browser_push: "Browser Push" };

export default function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [channelType, setChannelType] = useState("email");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [defaultInterval, setDefaultIntervalState] = useState(60);
  const [applyingInterval, setApplyingInterval] = useState(false);

  const load = useCallback(async () => {
    try { setChannels(await api.get<NotificationChannel[]>("/api/notifications/channels")); } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setDefaultIntervalState(getDefaultMonitoringInterval()); }, []);

  const upsertBrowserPush = useCallback(async (sub: PushSubscriptionJSON) => {
    const existing = channels.find((c) => c.channel_type === "browser_push");
    const payload = { channel_type: "browser_push", config: { subscription: sub }, is_enabled: true };
    if (existing) await api.patch(`/api/notifications/channels/${existing.id}`, { config: payload.config, is_enabled: true });
    else await api.post("/api/notifications/channels", payload);
  }, [channels]);

  const handleBrowserPush = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) { toast.error("Browser doesn't support push"); return; }
    if (!VAPID_PUBLIC_KEY) { toast.error("Push not configured on server"); return; }
    setSubscribing(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast.error("Permission denied"); setSubscribing(false); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      await upsertBrowserPush(sub.toJSON());
      setShowAdd(false);
      await load();
      toast.success("Browser push enabled");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
    setSubscribing(false);
  }, [load, upsertBrowserPush, toast]);

  const hasValidPush = (ch: NotificationChannel) => Boolean((ch.config as { subscription?: { endpoint?: string } })?.subscription?.endpoint);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (channelType === "browser_push") { await handleBrowserPush(); return; }
      await api.post("/api/notifications/channels", { channel_type: channelType, config });
      setShowAdd(false); setConfig({}); toast.success("Channel added"); load();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try { await api.patch(`/api/notifications/channels/${id}`, { is_enabled: enabled }); setChannels((p) => p.map((c) => c.id === id ? { ...c, is_enabled: enabled } : c)); toast.success(enabled ? "Enabled" : "Disabled"); } catch { toast.error("Failed"); }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try { const r = await api.post<{ status: string; error?: string }>("/api/notifications/test", { channel_id: id }); r.status === "sent" ? toast.success("Test sent!") : toast.error(`Failed: ${r.error}`); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Test failed"); }
    setTestingId(null);
  };

  const handleSaveDefault = () => { setDefaultMonitoringInterval(defaultInterval); toast.success("Default interval saved"); };

  const handleApplyAll = async () => {
    setApplyingInterval(true);
    try {
      const res = await api.get<{ items: { id: string }[] }>("/api/applications?limit=200");
      await Promise.all(res.items.map((a) => api.patch(`/api/applications/${a.id}`, { monitoring_interval_seconds: defaultInterval })));
      setDefaultMonitoringInterval(defaultInterval);
      toast.success(`Applied to ${res.items.length} applications`);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
    setApplyingInterval(false);
  };

  return (
    <AppShell>
      <PageTransition>
        <PageHeader eyebrow="Workspace" title="Settings" description="Profile, monitoring defaults, and notification channels." />

        <SectionStagger className="mt-5 space-y-4">
          <SectionItem><Card>
            <CardHeader><div><CardTitle>Profile</CardTitle><CardDescription>Identity and access.</CardDescription></div></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                {[["Name", user?.display_name], ["Email", user?.email], ["Role", user?.role], ["Joined", user?.created_at ? formatDate(user.created_at) : "—"]].map(([l, v]) => (
                  <div key={l as string}><dt className="text-[11px] text-fgSubtle">{l}</dt><dd className="mt-0.5 font-medium text-fg">{v}</dd></div>
                ))}
              </dl>
            </CardContent>
          </Card></SectionItem>

          <SectionItem><Card>
            <CardHeader><div><CardTitle>Monitoring defaults</CardTitle><CardDescription>Default interval for new applications.</CardDescription></div></CardHeader>
            <CardContent className="space-y-3">
              <div className="max-w-[200px]"><TextField label="Interval (seconds)" type="number" min={10} max={3600} value={defaultInterval} onChange={(e) => setDefaultIntervalState(parseInt(e.target.value, 10) || 60)} /></div>
              <div className="flex gap-2"><Button onClick={handleSaveDefault}>Save</Button><Button variant="secondary" onClick={handleApplyAll} loading={applyingInterval}>Apply to all</Button></div>
            </CardContent>
          </Card></SectionItem>

          <SectionItem><Card>
            <CardHeader>
              <div><CardTitle>Notification channels</CardTitle><CardDescription>Configure how you receive alerts.</CardDescription></div>
              <Button size="sm" onClick={() => setShowAdd(true)}>Add channel</Button>
            </CardHeader>
            {showAdd && (
              <form onSubmit={handleAdd} className="space-y-3 border-b border-border bg-canvas px-4 py-3">
                <SelectField label="Type" value={channelType} onChange={(e) => { setChannelType(e.target.value); setConfig({}); }} options={[{ value: "email", label: "Email" }, { value: "telegram", label: "Telegram" }, { value: "browser_push", label: "Browser Push" }]} />
                {channelType === "email" && <TextField label="Email" type="email" value={config.email || ""} onChange={(e) => setConfig({ ...config, email: e.target.value })} required />}
                {channelType === "telegram" && <TextField label="Chat ID" value={config.chat_id || ""} onChange={(e) => setConfig({ ...config, chat_id: e.target.value })} placeholder="Send /start to the bot" required />}
                {channelType === "browser_push" && <p className="text-xs text-fgMuted">We'll request permission and register this browser.</p>}
                <div className="flex gap-2"><Button type="submit" loading={subscribing}>{channelType === "browser_push" ? "Enable push" : "Add"}</Button><Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button></div>
              </form>
            )}
            {loading ? (
              <div className="p-4"><LoadingSkeleton rows={2} /></div>
            ) : channels.length === 0 ? (
              <div className="p-4"><EmptyState title="No channels" description="Add one to receive alerts." actionLabel="Add channel" onAction={() => setShowAdd(true)} /></div>
            ) : (
              <div className="divide-y divide-border">
                {channels.map((ch) => {
                  const Icon = channelIcons[ch.channel_type] || EnvelopeIcon;
                  return (
                    <div key={ch.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surfaceRaised"><Icon className="h-4 w-4 text-fgMuted" /></div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-fg">{channelLabels[ch.channel_type] || ch.channel_type}</p>
                          <p className="truncate text-[11px] text-fgSubtle">
                            {ch.channel_type === "email" && (ch.config as { email?: string })?.email}
                            {ch.channel_type === "telegram" && `Chat: ${(ch.config as { chat_id?: string })?.chat_id}`}
                            {ch.channel_type === "browser_push" && (hasValidPush(ch) ? "Connected" : "Needs setup")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {ch.channel_type === "browser_push" && <Button variant="ghost" size="xs" onClick={handleBrowserPush} loading={subscribing}>{hasValidPush(ch) ? "Reconnect" : "Connect"}</Button>}
                        <label className="flex items-center gap-1.5"><input type="checkbox" checked={ch.is_enabled} onChange={(e) => handleToggle(ch.id, e.target.checked)} className="h-3 w-3 rounded border-border bg-canvas text-accent focus:ring-accent/30" /><span className="text-[11px] text-fgMuted">On</span></label>
                        <Button variant="secondary" size="xs" onClick={() => handleTest(ch.id)} disabled={testingId === ch.id || (ch.channel_type === "browser_push" && !hasValidPush(ch))}>{testingId === ch.id ? "…" : "Test"}</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card></SectionItem>
        </SectionStagger>
      </PageTransition>
    </AppShell>
  );
}
