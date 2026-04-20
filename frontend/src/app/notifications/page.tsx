"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { NotificationLogEntry } from "@/types";

function channelLabel(channel: NotificationLogEntry["channel_type"]) {
  if (channel === "browser_push") return "Browser";
  if (channel === "telegram") return "Telegram";
  return "Email";
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.get<{ items: NotificationLogEntry[]; total: number }>("/api/notifications/log?limit=100");
        setNotifications(res.items);
      } catch {}
      setLoading(false);
    }

    load();
    const interval = window.setInterval(load, 10000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">Notification delivery history, including browser alerts sent to this account.</p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <TableSkeleton cols={5} rows={6} />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="Notifications will appear here after status changes or test sends."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Notification</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Channel</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Target</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {notifications.map((entry) => (
                <tr key={entry.id} className="transition-colors hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-gray-900">{entry.title || "Notification"}</p>
                    {entry.error_message && (
                      <p className="mt-0.5 text-xs text-red-500">{entry.error_message}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{channelLabel(entry.channel_type)}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        entry.status === "SENT"
                          ? "bg-green-50 text-green-700"
                          : entry.status === "FAILED"
                            ? "bg-red-50 text-red-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">
                    {entry.application_name || entry.host_name || "-"}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">
                    <p>{formatDate(entry.created_at)}</p>
                    {entry.sent_at && <p className="text-xs text-gray-400">Sent: {formatDate(entry.sent_at)}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
