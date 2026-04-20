"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Application } from "@/types";

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search) params.set("search", search);
      const res = await api.get<{ items: Application[]; total: number }>(`/api/applications?${params}`);
      setApps(res.items);
      setTotal(res.total);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    const interval = window.setInterval(load, 10000);
    return () => {
      clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [search]);

  const handleDelete = async (appId: string, displayName: string) => {
    if (!confirm(`Delete application "${displayName}"?`)) return;

    setDeletingId(appId);
    try {
      await api.delete(`/api/applications/${appId}`);
      await load();
    } catch (err: any) {
      alert(err.message || "Failed to delete application");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppShell>
      <div className="page-header-panel mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow-label">Application Inventory</p>
          <h1 className="mt-2 text-3xl font-semibold">All Applications</h1>
          <p className="mt-2 text-sm text-slate-600">Global catalog of monitored applications with current health and response time visibility. ({total})</p>
        </div>
        <Link
          href="/applications/new"
          className="primary-button"
        >
          Add Application
        </Link>
      </div>

      <div className="surface-panel mb-6">
        <input
          type="text"
          placeholder="Search applications..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input max-w-md"
        />
      </div>

      {loading ? (
        <div className="surface-panel">
          <TableSkeleton cols={5} rows={5} />
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          title="No applications found"
          description={search ? "Try a different search term." : "Add your first application to get started."}
          actionLabel={search ? undefined : "Add Application"}
          onAction={search ? undefined : () => router.push("/applications/new")}
        />
      ) : (
        <div className="table-surface">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">URL</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Env</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Response</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {apps.map((app) => (
                <tr key={app.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-5 py-3.5">
                    <Link href={`/applications/${app.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                      {app.display_name}
                    </Link>
                    {app.is_maintenance && (
                      <span className="ml-2 rounded-full bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
                        Maintenance
                      </span>
                    )}
                  </td>
                  <td className="max-w-xs truncate px-5 py-3.5 text-sm text-slate-500">{app.base_url}</td>
                  <td className="px-5 py-3.5">
                    {app.environment ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                        {app.environment}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={app.status?.status || "UNKNOWN"} />
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">
                    {app.status?.last_response_time_ms != null ? `${app.status.last_response_time_ms}ms` : "-"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleDelete(app.id, app.display_name)}
                      disabled={deletingId === app.id}
                      className="rounded-xl px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      {deletingId === app.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-200/80 bg-slate-50/70 px-5 py-3 text-xs text-slate-500">
            Showing {apps.length} of {total} applications
          </div>
        </div>
      )}
    </AppShell>
  );
}
