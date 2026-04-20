"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Subscription } from "@/types";

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ items: Subscription[]; total: number }>("/api/subscriptions?limit=100");
      setSubs(res.items);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const interval = window.setInterval(load, 10000);
    return () => window.clearInterval(interval);
  }, [load]);

  const handleToggle = async (subId: string, field: string, value: boolean) => {
    try {
      await api.patch(`/api/subscriptions/${subId}`, { [field]: value });
      setSubs((prev) =>
        prev.map((s) => (s.id === subId ? { ...s, [field]: value } : s)),
      );
    } catch {}
  };

  const handleUnsubscribe = async (subId: string) => {
    if (!confirm("Unsubscribe from this application?")) return;
    try {
      await api.delete(`/api/subscriptions/${subId}`);
      setSubs((prev) => prev.filter((s) => s.id !== subId));
    } catch {}
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Subscriptions</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your notification preferences for subscribed applications</p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <LoadingSkeleton rows={4} />
        </div>
      ) : subs.length === 0 ? (
        <EmptyState
          title="No subscriptions yet"
          description="Subscribe to applications to receive notifications about their status."
          actionLabel="Browse Applications"
          onAction={() => router.push("/applications")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {subs.map((sub) => (
            <div key={sub.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <Link
                    href={`/applications/${sub.application_id}`}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {(sub.application as any)?.display_name || sub.application_id}
                  </Link>
                  <div className="mt-1.5 flex items-center gap-2">
                    <StatusBadge status={(sub.application as any)?.status?.status || "UNKNOWN"} />
                    <span className="truncate text-xs text-gray-400">{(sub.application as any)?.base_url}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleUnsubscribe(sub.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  Unsubscribe
                </button>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 pt-4">
                {[
                  { field: "notify_on_down", label: "DOWN", value: sub.notify_on_down },
                  { field: "notify_on_up", label: "Recovery", value: sub.notify_on_up },
                  { field: "notify_on_degraded", label: "Degraded", value: sub.notify_on_degraded },
                  { field: "notify_on_slow", label: "Slow", value: sub.notify_on_slow },
                ].map((toggle) => (
                  <label key={toggle.field} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={toggle.value}
                      onChange={(e) => handleToggle(sub.id, toggle.field, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{toggle.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
