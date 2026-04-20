"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageTransition, StaggerList, StaggerItem } from "@/components/ui/motion";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import type { Subscription } from "@/types";

const toggleFields = [
  { key: "notify_on_down" as const, label: "Down" },
  { key: "notify_on_up" as const, label: "Up" },
  { key: "notify_on_degraded" as const, label: "Degraded" },
  { key: "notify_on_slow" as const, label: "Slow" },
];

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const confirm = useConfirm();

  async function load() {
    try { setSubs((await api.get<{ items: Subscription[] }>("/api/subscriptions?limit=100")).items); } catch { /* noop */ }
    setLoading(false);
  }

  useEffect(() => { load(); const i = window.setInterval(load, 10000); return () => window.clearInterval(i); }, []);

  const handleToggle = async (sub: Subscription, field: keyof Pick<Subscription, "notify_on_down" | "notify_on_up" | "notify_on_degraded" | "notify_on_slow">) => {
    try { await api.patch(`/api/subscriptions/${sub.id}`, { [field]: !sub[field] }); toast.success("Updated"); await load(); } catch { toast.error("Failed to update"); }
  };

  const handleUnsubscribe = async (sub: Subscription) => {
    const name = sub.application?.display_name || sub.application_id;
    const ok = await confirm({ title: `Unsubscribe from ${name}?`, confirmLabel: "Unsubscribe", variant: "danger" });
    if (!ok) return;
    try { await api.delete(`/api/subscriptions/${sub.id}`); toast.success("Unsubscribed"); await load(); } catch { toast.error("Failed"); }
  };

  return (
    <AppShell>
      <PageTransition>
        <PageHeader eyebrow="Monitoring" title="Subscriptions" description={`${subs.length} active subscriptions`} />
        {loading ? (
          <div className="mt-5"><LoadingSkeleton rows={3} /></div>
        ) : subs.length === 0 ? (
          <div className="mt-5 rounded-lg border border-border bg-surface">
            <EmptyState title="No subscriptions" description="Subscribe to applications to receive notifications." action={<Link href="/applications"><Button>Browse applications</Button></Link>} />
          </div>
        ) : (
          <StaggerList className="mt-5 space-y-2">
            {subs.map((sub) => (
              <StaggerItem key={sub.id}><Card>
                <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/applications/${sub.application_id}`} className="truncate text-[13px] font-medium text-fg hover:text-accent">{sub.application?.display_name || sub.application_id}</Link>
                      {sub.application?.status?.status && <StatusBadge status={sub.application.status.status} />}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {toggleFields.map((f) => (
                      <label key={f.key} className="flex items-center gap-1.5 text-[11px] text-fgMuted">
                        <input type="checkbox" checked={sub[f.key]} onChange={() => handleToggle(sub, f.key)} className="h-3 w-3 rounded border-border bg-canvas text-accent focus:ring-accent/30" />
                        {f.label}
                      </label>
                    ))}
                    <Button variant="ghost" size="xs" onClick={() => handleUnsubscribe(sub)} className="text-fgSubtle hover:text-danger">Unsubscribe</Button>
                  </div>
                </div>
              </Card></StaggerItem>
            ))}
          </StaggerList>
        )}
      </PageTransition>
    </AppShell>
  );
}
