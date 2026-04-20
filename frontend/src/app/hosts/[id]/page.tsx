"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { HostDetail } from "@/types";
import { HostStatusBadge, StatusBadge } from "@/components/ui/status-badge";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AppShell } from "@/components/layout/app-shell";

export default function HostDetailPage() {
  const params = useParams();
  const hostId = params.id as string;
  const [host, setHost] = useState<HostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadHost();
    const interval = window.setInterval(loadHost, 10000);
    return () => window.clearInterval(interval);
  }, [hostId]);

  async function loadHost() {
    try {
      const data = await api.get<HostDetail>(`/api/hosts/${hostId}`);
      setHost(data);
    } catch (e: any) {
      setError(e.message || "Failed to load host");
    } finally {
      setLoading(false);
    }
  }

  function formatTime(iso: string | null | undefined): string {
    if (!iso) return "Never";
    return new Date(iso).toLocaleString();
  }

  function formatUptime(seconds: number | null | undefined): string {
    if (!seconds) return "-";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    return `${hours}h ${mins}m`;
  }

  if (loading) {
    return (
      <AppShell>
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <LoadingSkeleton rows={5} />
        </div>
      </div>
      </AppShell>
    );
  }

  if (error || !host) {
    return (
      <AppShell>
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{error || "Host not found"}</p>
        <Link href="/hosts" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
          Back to Hosts
        </Link>
      </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{host.display_name}</h1>
            <HostStatusBadge status={host.status?.status || "UNKNOWN"} />
          </div>
          <p className="mt-1 text-sm text-gray-500">{host.hostname}</p>
        </div>
        <Link href="/hosts" className="text-sm text-gray-500 hover:text-gray-700">
          Back to Hosts
        </Link>
      </div>

      {/* Host Info Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Last Heartbeat</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{formatTime(host.status?.last_heartbeat_at)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Uptime</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{formatUptime(host.status?.uptime_seconds)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">IP Address</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{host.status?.ip_address || "-"}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">OS Version</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{host.status?.os_version || "-"}</p>
        </div>
      </div>

      {/* Host Details Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Details</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Environment</dt>
            <dd className="mt-1 text-sm text-gray-900">{host.environment || "Not set"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Active</dt>
            <dd className="mt-1 text-sm text-gray-900">{host.is_active ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Heartbeat Interval</dt>
            <dd className="mt-1 text-sm text-gray-900">{host.heartbeat_interval_seconds}s</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Heartbeat Timeout</dt>
            <dd className="mt-1 text-sm text-gray-900">{host.heartbeat_timeout_seconds}s</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Consecutive Heartbeats</dt>
            <dd className="mt-1 text-sm text-gray-900">{host.status?.consecutive_heartbeats || 0}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Consecutive Misses</dt>
            <dd className="mt-1 text-sm text-gray-900">{host.status?.consecutive_misses || 0}</dd>
          </div>
        </dl>
      </div>

      {/* Linked Applications */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Linked Applications</h2>
        {host.applications.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No linked applications" description="Link applications to this host to track host-caused outages." />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {host.applications.map((app) => (
              <Link
                key={app.id}
                href={`/applications/${app.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-4 transition hover:border-gray-200 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{app.display_name}</p>
                  <p className="text-xs text-gray-500">{app.base_url}</p>
                </div>
                {app.environment && (
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                    {app.environment}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Heartbeats */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Recent Heartbeats</h2>
        {host.recent_heartbeats.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No heartbeats received" description="Heartbeats will appear here once the host agent starts sending them." />
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Received</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">IP</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">OS</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-gray-500">Uptime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {host.recent_heartbeats.map((hb) => (
                  <tr key={hb.id} className="text-sm text-gray-600">
                    <td className="px-4 py-2.5">{formatTime(hb.received_at)}</td>
                    <td className="px-4 py-2.5">{hb.ip_address || "-"}</td>
                    <td className="px-4 py-2.5">{hb.os_version || "-"}</td>
                    <td className="px-4 py-2.5">{formatUptime(hb.uptime_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </AppShell>
  );
}
