"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge, SeverityBadge, HostStatusBadge, IncidentTypeBadge } from "@/components/ui/status-badge";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Incident } from "@/types";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (statusFilter) params.set("status", statusFilter);
        if (typeFilter) params.set("incident_type", typeFilter);
        const res = await api.get<{ items: Incident[]; total: number }>(`/api/incidents?${params}`);
        setIncidents(res.items);
        setTotal(res.total);
      } catch {}
      setLoading(false);
    }
    load();
    const interval = window.setInterval(load, 10000);
    return () => window.clearInterval(interval);
  }, [statusFilter, typeFilter]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Incidents</h1>
        <p className="mt-1 text-sm text-gray-500">
          History of state transitions and alerts ({total} total)
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex gap-2">
          <span className="flex items-center text-xs font-medium text-gray-500">Status:</span>
          {["", "ONGOING", "RESOLVED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <span className="flex items-center text-xs font-medium text-gray-500">Type:</span>
          {["", "APPLICATION", "HOST", "HOST_CAUSED"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                typeFilter === t
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t === "" ? "All" : t === "HOST_CAUSED" ? "Host-Caused" : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <TableSkeleton cols={6} rows={5} />
        </div>
      ) : incidents.length === 0 ? (
        <EmptyState
          title="No incidents found"
          description="Adjust your filters or wait for state transitions to create incidents."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Incident</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Severity</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Transition</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {incidents.map((inc) => (
                <tr key={inc.id} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-gray-900">{inc.title}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {inc.application_name || inc.host_name || "-"}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <IncidentTypeBadge type={inc.incident_type || "APPLICATION"} />
                  </td>
                  <td className="px-5 py-3.5">
                    <SeverityBadge severity={inc.severity} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-xs">
                      {inc.incident_type === "HOST" || inc.incident_type === "HOST_CAUSED" ? (
                        <>
                          <HostStatusBadge status={inc.previous_state} />
                          <span className="text-gray-400">&rarr;</span>
                          <HostStatusBadge status={inc.new_state} />
                        </>
                      ) : (
                        <>
                          <StatusBadge status={inc.previous_state} />
                          <span className="text-gray-400">&rarr;</span>
                          <StatusBadge status={inc.new_state} />
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        inc.status === "ONGOING"
                          ? "bg-red-50 text-red-700"
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      {inc.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm text-gray-600">{formatDate(inc.started_at)}</p>
                    {inc.resolved_at && (
                      <p className="text-xs text-gray-400">Resolved: {formatDate(inc.resolved_at)}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-3 text-xs text-gray-500">
            Showing {incidents.length} of {total} incidents
          </div>
        </div>
      )}
    </AppShell>
  );
}
