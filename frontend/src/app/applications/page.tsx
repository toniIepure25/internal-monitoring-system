"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTableShell, SortableTh, Td, type SortState, toggleSort } from "@/components/ui/data-table-shell";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { PageTransition, FadeIn } from "@/components/ui/motion";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import type { Application } from "@/types";

const PAGE_SIZE = 20;

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (search) params.set("search", search);
      const res = await api.get<{ items: Application[]; total: number }>(`/api/applications?${params}`);
      setApps(res.items);
      setTotal(res.total);
    } catch { /* noop */ }
    setLoading(false);
  }

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    const interval = window.setInterval(load, 10000);
    return () => { clearTimeout(timeout); window.clearInterval(interval); };
  }, [search]);

  const sorted = useMemo(() => {
    if (!sort) return apps;
    return [...apps].sort((a, b) => {
      let va: string | number | null = null, vb: string | number | null = null;
      switch (sort.key) {
        case "name": va = a.display_name.toLowerCase(); vb = b.display_name.toLowerCase(); break;
        case "url": va = a.base_url; vb = b.base_url; break;
        case "env": va = a.environment || ""; vb = b.environment || ""; break;
        case "status": va = a.status?.status || ""; vb = b.status?.status || ""; break;
        case "response": va = a.status?.last_response_time_ms ?? 999999; vb = b.status?.last_response_time_ms ?? 999999; break;
      }
      if (va == null || vb == null) return 0;
      if (va < vb) return sort.dir === "asc" ? -1 : 1;
      if (va > vb) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [apps, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const clamped = Math.min(page, totalPages);
  const paginated = sorted.slice((clamped - 1) * PAGE_SIZE, clamped * PAGE_SIZE);

  const handleDelete = async (appId: string, displayName: string) => {
    const ok = await confirm({ title: `Delete "${displayName}"?`, description: "This action cannot be undone.", confirmLabel: "Delete", variant: "danger" });
    if (!ok) return;
    setDeletingId(appId);
    try { await api.delete(`/api/applications/${appId}`); toast.success(`Deleted ${displayName}`); await load(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to delete"); }
    finally { setDeletingId(null); }
  };

  return (
    <AppShell>
      <PageTransition>
        <PageHeader eyebrow="Catalog" title="Applications" description={`${total} monitored applications`} actions={<Button onClick={() => router.push("/applications/new")}>Add application</Button>} />

        <FadeIn delay={0.1} className="mt-4 mb-3">
          <input type="text" placeholder="Search applications…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="filter-input max-w-xs" />
        </FadeIn>

        {loading ? (
          <DataTableShell><TableSkeleton cols={5} rows={5} /></DataTableShell>
        ) : apps.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState title="No applications found" description={search ? "Try a different search term." : "Add your first application to get started."} actionLabel={search ? undefined : "Add application"} onAction={search ? undefined : () => router.push("/applications/new")} />
          </div>
        ) : (
          <DataTableShell footer={
            <div className="flex items-center justify-between">
              <span>Showing {(clamped - 1) * PAGE_SIZE + 1}–{Math.min(clamped * PAGE_SIZE, sorted.length)} of {sorted.length}</span>
              <Pagination page={clamped} totalPages={totalPages} onPageChange={setPage} />
            </div>
          }>
            <table className="w-full min-w-[640px]">
              <thead><tr className="border-b border-border">
                <SortableTh sortKey="name" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Name</SortableTh>
                <SortableTh sortKey="url" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>URL</SortableTh>
                <SortableTh sortKey="env" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Env</SortableTh>
                <SortableTh sortKey="status" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Status</SortableTh>
                <SortableTh sortKey="response" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Response</SortableTh>
                <Td className="text-right text-2xs font-medium uppercase tracking-wider text-fgSubtle">Actions</Td>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {paginated.map((app) => (
                  <tr key={app.id} className="transition-colors hover:bg-surfaceRaised/40">
                    <Td>
                      <Link href={`/applications/${app.id}`} className="font-medium text-fg hover:text-accent">{app.display_name}</Link>
                      {app.is_maintenance && <span className="ml-1.5 rounded bg-warning/10 px-1 py-0.5 text-[10px] font-medium text-warning">Maintenance</span>}
                    </Td>
                    <Td className="max-w-[180px] truncate text-fgMuted">{app.base_url}</Td>
                    <Td>{app.environment ? <span className="rounded bg-surfaceRaised px-1.5 py-0.5 text-[11px] font-medium text-fgMuted">{app.environment}</span> : <span className="text-fgSubtle">—</span>}</Td>
                    <Td><StatusBadge status={app.status?.status || "UNKNOWN"} /></Td>
                    <Td className="tabular-nums text-fgMuted">{app.status?.last_response_time_ms != null ? `${app.status.last_response_time_ms}ms` : "—"}</Td>
                    <Td className="text-right">
                      <button type="button" onClick={() => handleDelete(app.id, app.display_name)} disabled={deletingId === app.id} className="rounded px-1.5 py-0.5 text-[11px] font-medium text-fgSubtle transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50">
                        {deletingId === app.id ? "…" : "Delete"}
                      </button>
                    </Td>
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
