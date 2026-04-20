"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Host } from "@/types";
import { HostStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";

export default function HostsPage() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadHosts();
    const interval = window.setInterval(loadHosts, 10000);
    return () => window.clearInterval(interval);
  }, []);

  async function loadHosts() {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const data = await api.get<{ items: Host[]; total: number }>(`/api/hosts${params}`);
      setHosts(data.items);
      setTotal(data.total);
    } catch (e) {
      console.error("Failed to load hosts", e);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(iso: string | null | undefined): string {
    if (!iso) return "Never";
    const d = new Date(iso);
    return d.toLocaleString();
  }

  function formatUptime(seconds: number | null | undefined): string {
    if (!seconds) return "-";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }

  return (
    <AppShell>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hosts</h1>
          <p className="mt-1 text-sm text-gray-500">Monitored machines and their status</p>
        </div>
        <Link
          href="/hosts/new"
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          Register Host
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search hosts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadHosts()}
          className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={loadHosts}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Search
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <TableSkeleton cols={5} rows={4} />
        </div>
      ) : hosts.length === 0 ? (
        <EmptyState
          title="No hosts registered"
          description="Register a host to start monitoring machine status and heartbeats."
          actionLabel="Register Host"
          onAction={() => router.push("/hosts/new")}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Host</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Last Heartbeat</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Uptime</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Environment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hosts.map((host) => (
                <tr key={host.id} className="transition hover:bg-gray-50/50">
                  <td className="px-5 py-4">
                    <Link href={`/hosts/${host.id}`} className="group">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">{host.display_name}</p>
                      <p className="text-xs text-gray-500">{host.hostname}</p>
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <HostStatusBadge status={host.status?.status || "UNKNOWN"} />
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {formatTime(host.status?.last_heartbeat_at)}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {formatUptime(host.status?.uptime_seconds)}
                  </td>
                  <td className="px-5 py-4">
                    {host.environment ? (
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                        {host.environment}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 text-xs text-gray-500">
            {total} host{total !== 1 ? "s" : ""} total
          </div>
        </div>
      )}
    </div>
    </AppShell>
  );
}
