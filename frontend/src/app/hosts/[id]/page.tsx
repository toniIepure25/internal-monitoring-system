"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { AppShell } from "@/components/layout/app-shell";
import { HostStatusBadge } from "@/components/ui/status-badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTableShell, Th, Td } from "@/components/ui/data-table-shell";
import { PageTransition, SectionStagger, SectionItem } from "@/components/ui/motion";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { HostDetail } from "@/types";

export default function HostDetailPage() {
  const params = useParams();
  const [host, setHost] = useState<HostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try { setHost(await api.get<HostDetail>(`/api/hosts/${params.id}`)); }
      catch { setError(true); }
      setLoading(false);
    }
    if (!params.id) return;
    load();
    const interval = window.setInterval(load, 10000);
    return () => window.clearInterval(interval);
  }, [params.id]);

  if (loading) return <AppShell><div className="space-y-4"><div className="h-6 w-48 animate-pulse rounded bg-surfaceRaised" /><div className="h-[160px] animate-pulse rounded-lg bg-surfaceRaised" /><div className="h-[120px] animate-pulse rounded-lg bg-surfaceRaised" /></div></AppShell>;
  if (error || !host) {
    return (
      <AppShell>
        <div className="rounded-lg bg-danger/10 px-4 py-3 text-[13px] text-danger">
          Host not found. <Link href="/hosts" className="underline">Back to hosts</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <div className="mb-5">
          <Link href="/hosts" className="mb-3 inline-flex items-center gap-1 text-xs text-fgMuted hover:text-fg">
            <ArrowLeftIcon className="h-3 w-3" /> Hosts
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-fg">{host.display_name}</h1>
            <HostStatusBadge status={host.status?.status || "UNKNOWN"} />
          </div>
          <p className="mt-0.5 text-xs text-fgMuted">{host.hostname}</p>
        </div>

        <SectionStagger className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <SectionItem><Card>
              <CardHeader><CardTitle>Details</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] md:grid-cols-3">
                  {[
                    ["Environment", host.environment || "—"],
                    ["Last heartbeat", host.status?.last_heartbeat_at ? formatDate(host.status.last_heartbeat_at) : "Never"],
                    ["Registered", formatDate(host.created_at)],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <dt className="text-[11px] text-fgSubtle">{label}</dt>
                      <dd className="mt-0.5 font-medium text-fg">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card></SectionItem>

            <SectionItem><Card>
              <CardHeader><CardTitle>Linked applications</CardTitle></CardHeader>
              {host.applications && host.applications.length > 0 ? (
                <div className="divide-y divide-border">
                  {host.applications.map((app) => (
                    <Link key={app.id} href={`/applications/${app.id}`} className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-surfaceRaised/40">
                      <span className="text-[13px] font-medium text-fg">{app.display_name}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <CardContent className="text-center text-xs text-fgMuted">No linked applications</CardContent>
              )}
            </Card></SectionItem>
          </div>

          <SectionItem><Card>
            <CardHeader><CardTitle>Recent heartbeats</CardTitle></CardHeader>
            {host.recent_heartbeats && host.recent_heartbeats.length > 0 ? (
              <div className="max-h-80 overflow-y-auto">
                <DataTableShell>
                  <table className="w-full">
                    <thead><tr className="border-b border-border"><Th>Time</Th><Th>IP</Th><Th>Uptime</Th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {host.recent_heartbeats.map((hb, i) => (
                        <tr key={i}>
                          <Td className="text-fgMuted">{hb.received_at ? formatDate(hb.received_at) : "—"}</Td>
                          <Td className="text-fgMuted">{hb.ip_address || "—"}</Td>
                          <Td className="tabular-nums text-fgMuted">{hb.uptime_seconds != null ? `${Math.round(hb.uptime_seconds / 3600)}h` : "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTableShell>
              </div>
            ) : (
              <CardContent><EmptyState title="No heartbeats" description="Heartbeats appear once the host agent begins reporting." className="py-6" /></CardContent>
            )}
          </Card></SectionItem>
        </SectionStagger>
      </PageTransition>
    </AppShell>
  );
}
