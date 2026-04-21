"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTableShell, SortableTh, Td, type SortState, toggleSort } from "@/components/ui/data-table-shell";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/motion";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { NotificationLogEntry, Application } from "@/types";

const PAGE_SIZE = 20;
function channelLabel(c: string) { return { email: "Email", telegram: "Telegram", browser_push: "Push" }[c] || c; }

export default function NotificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [appFilter, setAppFilter] = useState(searchParams.get("app") || "");
  const [channel, setChannel] = useState(searchParams.get("channel") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") || "");
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (appFilter) params.set("app", appFilter);
    if (channel) params.set("channel", channel);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/notifications", { scroll: false });
  }, [search, appFilter, channel, dateFrom, dateTo, router]);

  function buildParams() {
    const p = new URLSearchParams({ limit: "200" });
    if (search) p.set("search", search); if (appFilter) p.set("application_id", appFilter);
    if (channel) p.set("channel_type", channel); if (dateFrom) p.set("date_from", dateFrom); if (dateTo) p.set("date_to", dateTo);
    return p;
  }

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [lr, ar] = await Promise.all([api.get<{ items: NotificationLogEntry[]; total: number }>(`/api/notifications/log?${buildParams()}`), api.get<{ items: Application[] }>("/api/applications?limit=200")]);
      setLogs(lr.items); setTotal(lr.total); setApps(ar.items);
    } catch { /* noop */ }
    setLoading(false); setRefreshing(false);
  }, [search, appFilter, channel, dateFrom, dateTo]);

  useEffect(() => { load(); const i = window.setInterval(() => load(true), 10000); return () => window.clearInterval(i); }, [load]);

  const handleClear = async (all = false) => {
    const ok = await confirm({ title: all ? "Clear all logs?" : "Clear filtered logs?", description: "This cannot be undone.", confirmLabel: "Clear", variant: "danger" });
    if (!ok) return;
    setClearing(true);
    try { await api.delete(`/api/notifications/log${all ? "" : `?${buildParams()}`}`); toast.success("Logs cleared"); await load(); } catch { toast.error("Failed to clear"); }
    setClearing(false);
  };

  const sorted = useMemo(() => {
    if (!sort) return logs;
    return [...logs].sort((a, b) => {
      let va: string = "", vb: string = "";
      switch (sort.key) { case "title": va = a.title || ""; vb = b.title || ""; break; case "app": va = a.application_name || ""; vb = b.application_name || ""; break; case "channel": va = a.channel_type; vb = b.channel_type; break; case "status": va = a.status; vb = b.status; break; case "date": va = a.created_at; vb = b.created_at; break; }
      if (va < vb) return sort.dir === "asc" ? -1 : 1; if (va > vb) return sort.dir === "asc" ? 1 : -1; return 0;
    });
  }, [logs, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const clamped = Math.min(page, totalPages);
  const paginated = sorted.slice((clamped - 1) * PAGE_SIZE, clamped * PAGE_SIZE);
  const reset = () => { setSearch(""); setAppFilter(""); setChannel(""); setDateFrom(""); setDateTo(""); setPage(1); };
  const hasFilters = search || appFilter || channel || dateFrom || dateTo;

  return (
    <AppShell>
      <PageTransition>
        <PageHeader eyebrow="Activity" title="Notification log" description={`${total} entries`} actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setRefreshing(true); load(); }} loading={refreshing}>Refresh</Button>
            {logs.length > 0 && (<>
              {hasFilters && <Button variant="ghost" onClick={() => handleClear(false)} loading={clearing}>Clear filtered</Button>}
              <Button variant="danger" size="sm" onClick={() => handleClear(true)} loading={clearing}>Clear all</Button>
            </>)}
          </div>
        } />
        <div className="mt-4 mb-3 flex flex-wrap items-center gap-2">
          <input type="text" placeholder="Search…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="filter-input w-40" />
          <select value={appFilter} onChange={(e) => { setAppFilter(e.target.value); setPage(1); }} className="filter-input w-36"><option value="">All apps</option>{apps.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}</select>
          <select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className="filter-input w-28"><option value="">All channels</option><option value="email">Email</option><option value="telegram">Telegram</option><option value="browser_push">Push</option></select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="filter-input w-32" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="filter-input w-32" />
          {hasFilters && <Button variant="ghost" size="xs" onClick={reset}>Reset</Button>}
        </div>
        {loading ? (
          <DataTableShell><TableSkeleton cols={5} rows={6} /></DataTableShell>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface"><EmptyState title="No notifications" description={hasFilters ? "Try different filters." : "Notifications appear here when sent."} /></div>
        ) : (
          <DataTableShell footer={<div className="flex items-center justify-between"><span>Showing {(clamped - 1) * PAGE_SIZE + 1}–{Math.min(clamped * PAGE_SIZE, sorted.length)} of {sorted.length}</span><Pagination page={clamped} totalPages={totalPages} onPageChange={setPage} /></div>}>
            <table className="w-full min-w-[640px]">
              <thead><tr className="border-b border-border">
                <SortableTh sortKey="title" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Subject</SortableTh>
                <SortableTh sortKey="app" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Application</SortableTh>
                <SortableTh sortKey="channel" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Channel</SortableTh>
                <SortableTh sortKey="status" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Status</SortableTh>
                <SortableTh sortKey="date" sort={sort} onSort={(k) => setSort(toggleSort(sort, k))}>Sent</SortableTh>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {paginated.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-surfaceRaised/40">
                    <Td className="max-w-[200px]"><p className="truncate font-medium text-fg">{log.title || "—"}</p></Td>
                    <Td className="text-fgMuted">{log.application_name || "—"}</Td>
                    <Td>{channelLabel(log.channel_type)}</Td>
                    <Td><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${log.status === "SENT" ? "bg-success/10 text-success" : log.status === "FAILED" ? "bg-danger/10 text-danger" : "bg-fgSubtle/10 text-fgMuted"}`}>{log.status}</span></Td>
                    <Td className="text-fgMuted">{formatDate(log.created_at)}</Td>
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
