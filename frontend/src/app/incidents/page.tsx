"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SeverityBadge, IncidentTypeBadge } from "@/components/ui/status-badge";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTableShell, SortableTh, Td, type SortState, toggleSort } from "@/components/ui/data-table-shell";
import { Pagination } from "@/components/ui/pagination";
import { FilterChipGroup } from "@/components/ui/filter-chip-group";
import { PageTransition } from "@/components/ui/motion";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Incident } from "@/types";

const PAGE_SIZE = 20;

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);

  async function load() {
    const qs = new URLSearchParams({ limit: "200" });
    if (status) qs.set("status", status);
    if (incidentType) qs.set("incident_type", incidentType);
    try { const res = await api.get<{ items: Incident[]; total: number }>(`/api/incidents?${qs}`); setIncidents(res.items); setTotal(res.total); } catch { /* noop */ }
    setLoading(false);
  }

  useEffect(() => { load(); const i = window.setInterval(load, 10000); return () => window.clearInterval(i); }, [status, incidentType]);

  const sorted = useMemo(() => {
    if (!sort) return incidents;
    return [...incidents].sort((a, b) => {
      let va: string = "", vb: string = "";
      switch (sort.key) {
        case "title": va = a.title.toLowerCase(); vb = b.title.toLowerCase(); break;
        case "type": va = a.incident_type; vb = b.incident_type; break;
        case "severity": va = a.severity; vb = b.severity; break;
        case "status": va = a.status; vb = b.status; break;
        case "started": va = a.started_at; vb = b.started_at; break;
      }
      if (va < vb) return sort.dir === "asc" ? -1 : 1;
      if (va > vb) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [incidents, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const clamped = Math.min(page, totalPages);
  const paginated = sorted.slice((clamped - 1) * PAGE_SIZE, clamped * PAGE_SIZE);

  return (
    <AppShell>
      <PageTransition>
        <PageHeader eyebrow="Operations" title="Incidents" description={`${total} total incidents`} />
        <div className="mt-4 mb-3 flex flex-wrap items-center gap-3">
          <FilterChipGroup label="Status" options={[{ value: "", label: "All" }, { value: "ONGOING", label: "Ongoing" }, { value: "RESOLVED", label: "Resolved" }]} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
          <FilterChipGroup label="Type" options={[{ value: "", label: "All" }, { value: "APPLICATION", label: "Application" }, { value: "HOST", label: "Host" }, { value: "HOST_CAUSED", label: "Host-caused" }]} value={incidentType} onChange={(v) => { setIncidentType(v); setPage(1); }} />
        </div>
        {loading ? (
          <DataTableShell><TableSkeleton cols={5} rows={6} /></DataTableShell>
        ) : incidents.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface"><EmptyState title="No incidents" description={status || incidentType ? "Try adjusting filters." : "No incidents recorded."} /></div>
        ) : (
          <DataTableShell footer={<div className="flex items-center justify-between"><span>Showing {(clamped - 1) * PAGE_SIZE + 1}–{Math.min(clamped * PAGE_SIZE, sorted.length)} of {sorted.length}</span><Pagination page={clamped} totalPages={totalPages} onPageChange={setPage} /></div>}>
            <table className="w-full min-w-[600px]">
              <thead><tr className="border-b border-border">
                <SortableTh sortKey="title" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Title</SortableTh>
                <SortableTh sortKey="type" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Type</SortableTh>
                <SortableTh sortKey="severity" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Severity</SortableTh>
                <SortableTh sortKey="status" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Status</SortableTh>
                <SortableTh sortKey="started" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Started</SortableTh>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {paginated.map((inc) => (
                  <tr key={inc.id} className="transition-colors hover:bg-surfaceRaised/40">
                    <Td className="max-w-[240px]">
                      <Link href={`/incidents/${inc.id}`} className="truncate font-medium text-fg hover:text-accent">{inc.title}</Link>
                      {inc.application_name && <p className="truncate text-[11px] text-fgSubtle">{inc.application_name}</p>}
                    </Td>
                    <Td><IncidentTypeBadge type={inc.incident_type} /></Td>
                    <Td><SeverityBadge severity={inc.severity} /></Td>
                    <Td><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${inc.status === "ONGOING" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>{inc.status}</span></Td>
                    <Td className="text-fgMuted">{formatDate(inc.started_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        )}
      </PageTransition>
    </AppShell>
  );
}
