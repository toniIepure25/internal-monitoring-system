"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Application, NotificationLogEntry } from "@/types";

function channelLabel(channel: NotificationLogEntry["channel_type"]) {
  if (channel === "browser_push") return "Browser";
  if (channel === "telegram") return "Telegram";
  return "Email";
}

function buildNotificationParams(filters: {
  search: string;
  channelType: string;
  status: string;
  applicationId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const params = new URLSearchParams({ limit: "100" });

  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.channelType) params.set("channel_type", filters.channelType);
  if (filters.status) params.set("status", filters.status);
  if (filters.applicationId) params.set("application_id", filters.applicationId);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);

  return params.toString();
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationLogEntry[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [search, setSearch] = useState("");
  const [channelType, setChannelType] = useState("");
  const [status, setStatus] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const hasLoadedRef = useRef(false);

  async function load(showLoader = false) {
    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const params = buildNotificationParams({
        search,
        channelType,
        status,
        applicationId,
        dateFrom,
        dateTo,
      });
      const res = await api.get<{ items: NotificationLogEntry[]; total: number }>(`/api/notifications/log?${params}`);
      setNotifications(res.items);
      setTotal(res.total);
    } catch {
      setNotifications([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasLoadedRef.current = true;
    }
  }

  useEffect(() => {
    async function loadApplications() {
      try {
        const res = await api.get<{ items: Application[]; total: number }>("/api/applications?limit=200");
        setApplications(res.items);
      } catch {
        setApplications([]);
      }
    }

    loadApplications();
  }, []);

  useEffect(() => {
    load(!hasLoadedRef.current);
    const interval = window.setInterval(() => {
      load(false);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [search, channelType, status, applicationId, dateFrom, dateTo]);

  const hasActiveFilters = Boolean(
    search.trim() || channelType || status || applicationId || dateFrom || dateTo,
  );

  const handleClearNotifications = async () => {
    const scopeLabel = hasActiveFilters ? "matching notifications" : "all notifications";
    if (!confirm(`Clear ${scopeLabel} from your history?`)) return;

    setClearing(true);
    try {
      const params = buildNotificationParams({
        search,
        channelType,
        status,
        applicationId,
        dateFrom,
        dateTo,
      });
      await api.delete<{ deleted: number }>(`/api/notifications/log?${params}`);
      await load(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clear notifications";
      alert(message);
    } finally {
      setClearing(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setChannelType("");
    setStatus("");
    setApplicationId("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <AppShell>
      <div className="page-header-panel mb-6">
        <div>
          <p className="eyebrow-label">Delivery Center</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">My Notifications</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Review browser alerts, email sends, and delivery failures in one place. Filters are applied live and refresh every 10 seconds.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 md:mt-0">
          <div className="status-chip">
            <span className="status-chip-dot bg-emerald-500" />
            {total} in view
          </div>
          <div className="status-chip">
            <span className={`status-chip-dot ${refreshing ? "bg-amber-500" : "bg-sky-500"}`} />
            {refreshing ? "Refreshing" : "Auto-refresh on"}
          </div>
          <button
            onClick={() => load(false)}
            className="secondary-button"
            type="button"
          >
            Refresh now
          </button>
          <button
            onClick={handleClearNotifications}
            disabled={total === 0 || clearing}
            className="danger-button"
            type="button"
          >
            {clearing ? "Clearing..." : hasActiveFilters ? "Clear filtered" : "Clear all"}
          </button>
        </div>
      </div>

      <section className="surface-panel mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Filters</h2>
            <p className="text-sm text-slate-500">Narrow by application, date range, delivery state, or channel.</p>
          </div>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="text-sm font-medium text-slate-600 transition hover:text-slate-900" type="button">
              Reset filters
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="filter-field xl:col-span-2">
            <span className="filter-label">Search</span>
            <input
              type="text"
              placeholder="Alert title or error message"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="filter-input"
            />
          </label>

          <label className="filter-field">
            <span className="filter-label">Application</span>
            <select value={applicationId} onChange={(e) => setApplicationId(e.target.value)} className="filter-input">
              <option value="">All applications</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.display_name}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span className="filter-label">Channel</span>
            <select value={channelType} onChange={(e) => setChannelType(e.target.value)} className="filter-input">
              <option value="">All channels</option>
              <option value="browser_push">Browser</option>
              <option value="email">Email</option>
              <option value="telegram">Telegram</option>
            </select>
          </label>

          <label className="filter-field">
            <span className="filter-label">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="filter-input">
              <option value="">All statuses</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
              <option value="PENDING">Pending</option>
            </select>
          </label>

          <label className="filter-field">
            <span className="filter-label">From</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="filter-input" />
          </label>

          <label className="filter-field">
            <span className="filter-label">To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="filter-input" />
          </label>
        </div>
      </section>

      {loading ? (
        <div className="surface-panel">
          <TableSkeleton cols={5} rows={6} />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications match this view"
          description={hasActiveFilters ? "Try widening the filters or wait for the next delivery event." : "Notifications will appear here after test sends or status changes."}
        />
      ) : (
        <div className="surface-panel overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Notification</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Target</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Channel</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notifications.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-900">{entry.title || "Notification"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.incident_id ? `Incident ${entry.incident_id.slice(0, 8)}` : "Manual test notification"}
                      </p>
                      {entry.error_message && (
                        <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                          {entry.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">{entry.application_name || entry.host_name || "General notification"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.application_name ? "Application event" : entry.host_name ? "Host event" : "Account-level delivery"}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{channelLabel(entry.channel_type)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          entry.status === "SENT"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                            : entry.status === "FAILED"
                              ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
                              : "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <p>Created {formatDate(entry.created_at)}</p>
                      {entry.sent_at ? (
                        <p className="mt-1 text-xs text-slate-500">Sent {formatDate(entry.sent_at)}</p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">Awaiting delivery timestamp</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/70 px-6 py-3 text-xs text-slate-500">
            <span>Showing {notifications.length} of {total} notifications</span>
            <span>Live refresh every 10 seconds</span>
          </div>
        </div>
      )}
    </AppShell>
  );
}
