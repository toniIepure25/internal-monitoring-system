"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { HostStatusBadge } from "@/components/ui/status-badge";
import { TableSkeleton, ContentTransition } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTableShell, SortableTh, Td, type SortState, toggleSort } from "@/components/ui/data-table-shell";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/motion";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Host } from "@/types";

const PAGE_SIZE = 20;

export default function HostsPage() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);
  const router = useRouter();

  async function load() {
    try { const qs = search ? `?search=${encodeURIComponent(search)}` : ""; const res = await api.get<{ items: Host[]; total: number }>(`/api/hosts${qs}`); setHosts(res.items); setTotal(res.total); } catch { /* noop */ }
    setLoading(false);
  }

  useEffect(() => { load(); const i = window.setInterval(load, 10000); return () => window.clearInterval(i); }, []);

  const sorted = useMemo(() => {
    if (!sort) return hosts;
    return [...hosts].sort((a, b) => {
      let va: string = "", vb: string = "";
      switch (sort.key) {
        case "name": va = a.display_name.toLowerCase(); vb = b.display_name.toLowerCase(); break;
        case "hostname": va = a.hostname; vb = b.hostname; break;
        case "status": va = a.status?.status || ""; vb = b.status?.status || ""; break;
        case "heartbeat": va = a.status?.last_heartbeat_at || ""; vb = b.status?.last_heartbeat_at || ""; break;
      }
      if (va < vb) return sort.dir === "asc" ? -1 : 1;
      if (va > vb) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [hosts, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const clamped = Math.min(page, totalPages);
  const paginated = sorted.slice((clamped - 1) * PAGE_SIZE, clamped * PAGE_SIZE);

  return (
    <AppShell>
      <PageTransition>
        <PageHeader eyebrow="Infrastructure" title="Hosts" description={`${total} registered hosts`} actions={<Button onClick={() => router.push("/hosts/new")}>Register host</Button>} />
        <div className="mt-4 mb-3 flex items-center gap-2">
          <input type="text" placeholder="Search hosts…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="filter-input max-w-xs" />
          <Button variant="secondary" onClick={load}>Search</Button>
        </div>
        {loading ? (
          <DataTableShell><TableSkeleton cols={4} rows={5} /></DataTableShell>
        ) : hosts.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface"><EmptyState title="No hosts found" description="Register a host to monitor your infrastructure." actionLabel="Register host" onAction={() => router.push("/hosts/new")} /></div>
        ) : (
          <DataTableShell footer={<div className="flex items-center justify-between"><span>Showing {(clamped - 1) * PAGE_SIZE + 1}–{Math.min(clamped * PAGE_SIZE, sorted.length)} of {sorted.length}</span><Pagination page={clamped} totalPages={totalPages} onPageChange={setPage} /></div>}>
            <table className="w-full min-w-[480px]">
              <thead><tr className="border-b border-border">
                <SortableTh sortKey="name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Name</SortableTh>
                <SortableTh sortKey="hostname" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Hostname</SortableTh>
                <SortableTh sortKey="status" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Status</SortableTh>
                <SortableTh sortKey="heartbeat" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Last heartbeat</SortableTh>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {paginated.map((h) => (
                  <tr key={h.id} className="transition-colors hover:bg-surfaceRaised/40">
                    <Td><Link href={`/hosts/${h.id}`} className="font-medium text-fg hover:text-accent">{h.display_name}</Link></Td>
                    <Td className="text-fgMuted">{h.hostname}</Td>
                    <Td><HostStatusBadge status={h.status?.status || "UNKNOWN"} /></Td>
                    <Td className="text-fgMuted">{h.status?.last_heartbeat_at ? formatDate(h.status.last_heartbeat_at) : "—"}</Td>
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
