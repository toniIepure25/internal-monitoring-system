"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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

export default function SettingsPage() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [channelType, setChannelType] = useState("email");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [defaultMonitoringInterval, setDefaultMonitoringIntervalState] = useState(60);
  const [applyingInterval, setApplyingInterval] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<NotificationChannel[]>("/api/notifications/channels");
      setChannels(res);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setDefaultMonitoringIntervalState(getDefaultMonitoringInterval());
  }, []);

  const upsertBrowserPushChannel = useCallback(async (subscription: PushSubscriptionJSON) => {
    const existing = channels.find((channel) => channel.channel_type === "browser_push");
    const payload = {
      channel_type: "browser_push",
      config: { subscription },
      is_enabled: true,
    };

    if (existing) {
      await api.patch(`/api/notifications/channels/${existing.id}`, {
        config: payload.config,
        is_enabled: true,
      });
      return;
    }

    await api.post("/api/notifications/channels", payload);
  }, [channels]);

  const handleBrowserPushSetup = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("This browser does not support push notifications");
    }
    if (!VAPID_PUBLIC_KEY) {
      throw new Error("Browser push is not configured on the server yet");
    }

    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission was not granted");
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await upsertBrowserPushChannel(subscription.toJSON());
      setShowAdd(false);
      await load();
      alert("Browser push is enabled for this browser.");
    } finally {
      setSubscribing(false);
    }
  }, [load, upsertBrowserPushChannel]);

  const hasValidBrowserPushConfig = (channel: NotificationChannel) =>
    Boolean((channel.config as { subscription?: { endpoint?: string } })?.subscription?.endpoint);

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (channelType === "browser_push") {
        await handleBrowserPushSetup();
        return;
      }

      await api.post("/api/notifications/channels", {
        channel_type: channelType,
        config,
      });
      setShowAdd(false);
      setConfig({});
      load();
    } catch (err: any) {
      alert(err.message || "Failed to add channel");
    }
  };

  const handleToggle = async (chId: string, enabled: boolean) => {
    try {
      await api.patch(`/api/notifications/channels/${chId}`, { is_enabled: enabled });
      setChannels((prev) => prev.map((c) => (c.id === chId ? { ...c, is_enabled: enabled } : c)));
    } catch {}
  };

  const handleTest = async (chId: string) => {
    setTestingId(chId);
    try {
      const res = await api.post<{ status: string; error?: string }>("/api/notifications/test", { channel_id: chId });
      alert(res.status === "sent" ? "Test notification sent!" : `Failed: ${res.error}`);
    } catch (err: any) {
      alert(err.message || "Test failed");
    }
    setTestingId(null);
  };

  const handleSaveMonitoringDefaults = () => {
    setDefaultMonitoringInterval(defaultMonitoringInterval);
    alert("Default monitoring interval saved.");
  };

  const handleApplyMonitoringInterval = async () => {
    setApplyingInterval(true);
    try {
      const res = await api.get<{ items: { id: string }[]; total: number }>("/api/applications?limit=200");
      await Promise.all(
        res.items.map((app) =>
          api.patch(`/api/applications/${app.id}`, { monitoring_interval_seconds: defaultMonitoringInterval }),
        ),
      );
      setDefaultMonitoringInterval(defaultMonitoringInterval);
      alert("Monitoring interval updated across the application catalog.");
    } catch (err: any) {
      alert(err.message || "Failed to update application intervals");
    }
    setApplyingInterval(false);
  };

  const channelLabels: Record<string, string> = {
    email: "Email",
    telegram: "Telegram",
    browser_push: "Browser Push",
  };

  const channelIcons: Record<string, string> = {
    email: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    telegram: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
    browser_push: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mb-8 text-sm text-gray-500">Manage your profile and notification channels</p>

        {/* Profile */}
        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Profile</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Name</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{user?.display_name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Role</dt>
              <dd className="mt-0.5">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  user?.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"
                }`}>
                  {user?.role}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Member since</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{user?.created_at ? formatDate(user.created_at) : ""}</dd>
            </div>
          </dl>
        </section>

        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Monitoring Defaults</h2>
          <div className="max-w-sm space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Default Health Check Interval (seconds)</label>
              <input
                type="number"
                min={10}
                max={3600}
                value={defaultMonitoringInterval}
                onChange={(e) => setDefaultMonitoringIntervalState(parseInt(e.target.value, 10) || 60)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">Used as the default interval when you add a new application.</p>
            </div>
            <button
              onClick={handleSaveMonitoringDefaults}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Save Monitoring Default
            </button>
            <button
              onClick={handleApplyMonitoringInterval}
              disabled={applyingInterval}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {applyingInterval ? "Applying..." : "Apply To All Applications"}
            </button>
          </div>
        </section>

        {/* Notification Channels */}
        <section className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Notification Channels</h2>
              <p className="mt-0.5 text-xs text-gray-400">Configure how you receive alerts</p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              + Add Channel
            </button>
          </div>

          {showAdd && (
            <form onSubmit={handleAddChannel} className="space-y-3 border-b border-gray-100 bg-gray-50 px-6 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Channel Type</label>
                <select
                  value={channelType}
                  onChange={(e) => { setChannelType(e.target.value); setConfig({}); }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="email">Email</option>
                  <option value="telegram">Telegram</option>
                  <option value="browser_push">Browser Push</option>
                </select>
              </div>

              {channelType === "email" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email Address</label>
                  <input
                    type="email"
                    value={config.email || ""}
                    onChange={(e) => setConfig({ ...config, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              {channelType === "telegram" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Telegram Chat ID</label>
                  <input
                    type="text"
                    value={config.chat_id || ""}
                    onChange={(e) => setConfig({ ...config, chat_id: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Send /start to our bot to get your Chat ID"
                    required
                  />
                </div>
              )}

              {channelType === "browser_push" && (
                <div className="space-y-2 text-sm text-gray-500">
                  <p>We will ask your browser for notification permission and save this browser as a push destination.</p>
                  <p>If notifications are blocked in the browser, enable them for `localhost` and try again.</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={subscribing}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {channelType === "browser_push" ? (subscribing ? "Connecting..." : "Enable Browser Push") : "Add"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="p-6">
              <LoadingSkeleton rows={2} />
            </div>
          ) : channels.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No channels configured"
                description="Add a notification channel to receive alerts."
                actionLabel="Add Channel"
                onAction={() => setShowAdd(true)}
              />
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {channels.map((ch) => (
                <div key={ch.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                      <svg className="h-4.5 w-4.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={channelIcons[ch.channel_type] || channelIcons.email} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{channelLabels[ch.channel_type] || ch.channel_type}</p>
                      <p className="text-xs text-gray-400">
                        {ch.channel_type === "email" && (ch.config as any)?.email}
                        {ch.channel_type === "telegram" && `Chat: ${(ch.config as any)?.chat_id}`}
                        {ch.channel_type === "browser_push" && (hasValidBrowserPushConfig(ch) ? "Web Push connected" : "Web Push needs reconnection")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {ch.channel_type === "browser_push" && (
                      <button
                        onClick={handleBrowserPushSetup}
                        disabled={subscribing}
                        className="rounded-lg px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                      >
                        {subscribing ? "Connecting..." : hasValidBrowserPushConfig(ch) ? "Reconnect" : "Connect"}
                      </button>
                    )}
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={ch.is_enabled}
                        onChange={(e) => handleToggle(ch.id, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-500">Enabled</span>
                    </label>
                    <button
                      onClick={() => handleTest(ch.id)}
                      disabled={testingId === ch.id || (ch.channel_type === "browser_push" && !hasValidBrowserPushConfig(ch))}
                      className="rounded-lg px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
                    >
                      {testingId === ch.id ? "Sending..." : "Test"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
