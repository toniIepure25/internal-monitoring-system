"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CubeTransparentIcon, ServerIcon, ExclamationTriangleIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge, HostStatusBadge, IncidentTypeBadge, SeverityBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { CardGridSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition, SectionStagger, SectionItem } from "@/components/ui/motion";
import { ResponseSparkline } from "@/components/ui/response-sparkline";
import { api } from "@/lib/api";
import { formatDate, formatDuration } from "@/lib/utils";
import type { UserGroup, Application, Incident, Host, HealthCheckEntry } from "@/types";

export default function DashboardPage() {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [healthHistory, setHealthHistory] = useState<Record<string, HealthCheckEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const [groupsRes, incidentsRes, appsRes, hostsRes, subsRes] = await Promise.all([
          api.get<{ items: UserGroup[] }>("/api/groups"),
          api.get<{ items: Incident[] }>("/api/incidents?limit=10"),
          api.get<{ items: Application[]; total: number }>("/api/applications?limit=50"),
          api.get<{ items: Host[]; total: number }>("/api/hosts?limit=50").catch(() => ({ items: [], total: 0 })),
          api.get<{ items: unknown[]; total: number }>("/api/subscriptions").catch(() => ({ items: [], total: 0 })),
        ]);
        setGroups(groupsRes.items);
        setRecentIncidents(incidentsRes.items);
        setApps(appsRes.items);
        setHosts(hostsRes.items);
        setSubscriptionCount(subsRes.total || subsRes.items.length);

        const visible = appsRes.items.slice(0, 8);
        const historyResults = await Promise.all(
          visible.map((a) =>
            api.get<{ items: HealthCheckEntry[] }>(`/api/applications/${a.id}/health-history?limit=30`).catch(() => ({ items: [] }))
          )
        );
        const historyMap: Record<string, HealthCheckEntry[]> = {};
        visible.forEach((a, i) => { historyMap[a.id] = historyResults[i].items; });
        setHealthHistory(historyMap);
      } catch { /* partial */ }
      setLoading(false);
    }
    load();
    const interval = window.setInterval(load, 10000);
    return () => window.clearInterval(interval);
  }, []);

  const appsUp = apps.filter((a) => a.status?.status === "UP").length;
  const appsDown = apps.filter((a) => a.status?.status === "DOWN").length;
  const hostsOnline = hosts.filter((h) => h.status?.status === "ONLINE").length;
  const hostsOffline = hosts.filter((h) => h.status?.status === "OFFLINE").length;
  const activeIncidents = recentIncidents.filter((i) => i.status === "ONGOING").length;

  return (
    <AppShell>
      <PageTransition>
        <PageHeader eyebrow="Overview" title="Dashboard" description="Health, incidents, and operational status at a glance." />

        {loading ? (
          <div className="mt-5"><CardGridSkeleton /></div>
        ) : (
          <SectionStagger className="mt-5 space-y-6">
            {/* Metrics */}
            <SectionItem className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={CubeTransparentIcon} label="Applications" value={apps.length} subtext={`${appsUp} up · ${appsDown} down`} color={appsDown > 0 ? "red" : "green"} delay={0} />
              <StatCard icon={ServerIcon} label="Hosts" value={hosts.length} subtext={`${hostsOnline} online · ${hostsOffline} offline`} color={hostsOffline > 0 ? "red" : hosts.length > 0 ? "green" : "gray"} delay={0.04} />
              <StatCard icon={ExclamationTriangleIcon} label="Active incidents" value={activeIncidents} subtext={activeIncidents > 0 ? "Requires attention" : "All clear"} color={activeIncidents > 0 ? "red" : "green"} delay={0.08} />
              <StatCard icon={SparklesIcon} label="Subscriptions" value={subscriptionCount} subtext="Notification-enabled" color="cyan" delay={0.12} />
            </SectionItem>

            {/* Two-column body */}
            <SectionItem className={`grid grid-cols-1 gap-4 ${hosts.length > 0 || groups.length > 0 ? "lg:grid-cols-3" : ""}`}>
              {/* Left: Incidents + Apps */}
              <div className={`space-y-4 ${hosts.length > 0 || groups.length > 0 ? "lg:col-span-2" : ""}`}>
                {/* Recent incidents */}
                <section className="rounded-lg border border-border bg-surface">
                  <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                    <h2 className="text-[13px] font-medium text-fg">Recent incidents</h2>
                    <Link href="/incidents" className="text-xs text-fgMuted hover:text-accent">View all →</Link>
                  </div>
                  {recentIncidents.length > 0 ? (
                    <div className="divide-y divide-border">
                      {recentIncidents.slice(0, 6).map((inc) => (
                        <div key={inc.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-fg">{inc.title}</p>
                            <p className="text-[11px] text-fgSubtle">{formatDate(inc.started_at)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <SeverityBadge severity={inc.severity} />
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${inc.status === "ONGOING" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>{inc.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No incidents" description="Incidents appear here when state changes are detected." className="py-8" />
                  )}
                </section>

                {/* Applications */}
                <section className="rounded-lg border border-border bg-surface">
                  <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                    <h2 className="text-[13px] font-medium text-fg">Applications</h2>
                    <Link href="/applications" className="text-xs text-fgMuted hover:text-accent">View catalog →</Link>
                  </div>
                  {apps.length > 0 ? (
                    <div className="divide-y divide-border">
                      {apps.slice(0, 8).map((app) => (
                        <Link key={app.id} href={`/applications/${app.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surfaceRaised/40">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-fg">{app.display_name}</p>
                            <p className="truncate text-[11px] text-fgSubtle">
                              {app.base_url}
                              {app.status?.current_state_since && (
                                <span className="ml-2 text-fgMuted">· {app.status.status === "UP" ? "up" : app.status.status === "DOWN" ? "down" : app.status.status.toLowerCase()} for {formatDuration(app.status.current_state_since)}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {healthHistory[app.id]?.length > 1 && <ResponseSparkline checks={healthHistory[app.id]} width={80} height={24} />}
                            {app.status?.last_response_time_ms != null && <span className="text-[11px] tabular-nums text-fgSubtle">{app.status.last_response_time_ms}ms</span>}
                            <StatusBadge status={app.status?.status || "UNKNOWN"} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No applications" description="Add your first application to start monitoring." actionLabel="Add application" onAction={() => router.push("/applications/new")} className="py-8" />
                  )}
                </section>
              </div>

              {/* Right: Hosts + Groups */}
              <div className="space-y-4">
                {/* Hosts */}
                {hosts.length > 0 && (
                  <section className="rounded-lg border border-border bg-surface">
                    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                      <h2 className="text-[13px] font-medium text-fg">Hosts</h2>
                      <Link href="/hosts" className="text-xs text-fgMuted hover:text-accent">View all →</Link>
                    </div>
                    <div className="divide-y divide-border">
                      {hosts.slice(0, 5).map((host) => (
                        <Link key={host.id} href={`/hosts/${host.id}`} className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-surfaceRaised/40">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-fg">{host.display_name}</p>
                            <p className="text-[11px] text-fgSubtle">{host.hostname}</p>
                          </div>
                          <HostStatusBadge status={host.status?.status || "UNKNOWN"} />
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* Groups */}
                {groups.length > 0 && (
                  <section className="rounded-lg border border-border bg-surface">
                    <div className="border-b border-border px-4 py-2.5">
                      <h2 className="text-[13px] font-medium text-fg">Groups</h2>
                    </div>
                    <div className="divide-y divide-border">
                      {groups.map((group) => (
                        <div key={group.id} className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {group.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} />}
                            <span className="text-[13px] font-medium text-fg">{group.name}</span>
                            <span className="ml-auto text-[11px] text-fgSubtle">{group.applications?.length || 0} apps</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </SectionItem>
          </SectionStagger>
        )}
      </PageTransition>
    </AppShell>
  );
}
