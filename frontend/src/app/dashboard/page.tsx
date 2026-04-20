"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge, HostStatusBadge, IncidentTypeBadge, SeverityBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserGroup, Application, Incident, Host } from "@/types";

export default function DashboardPage() {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
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
      } catch {}
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Overview of monitored applications, hosts, and recent activity</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Applications"
              value={apps.length}
              subtext={`${appsUp} up, ${appsDown} down`}
              color={appsDown > 0 ? "red" : "green"}
            />
            <StatCard
              label="Hosts"
              value={hosts.length}
              subtext={`${hostsOnline} online, ${hostsOffline} offline`}
              color={hostsOffline > 0 ? "red" : hosts.length > 0 ? "green" : "gray"}
            />
            <StatCard
              label="Active Incidents"
              value={activeIncidents}
              subtext={activeIncidents > 0 ? "Requires attention" : "All clear"}
              color={activeIncidents > 0 ? "red" : "green"}
            />
            <StatCard
              label="My Subscriptions"
              value={subscriptionCount}
              subtext="Notification-enabled"
              color="blue"
            />
          </div>

          {/* Host Status Summary */}
          {hosts.length > 0 && (
            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Host Status</h2>
                <Link href="/hosts" className="text-sm text-blue-600 hover:text-blue-700">View all hosts</Link>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {hosts.slice(0, 6).map((host) => (
                  <Link
                    key={host.id}
                    href={`/hosts/${host.id}`}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition hover:shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{host.display_name}</p>
                      <p className="text-xs text-gray-400">{host.hostname}</p>
                    </div>
                    <HostStatusBadge status={host.status?.status || "UNKNOWN"} />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Personal Groups */}
          {groups.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">My Groups</h2>
              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
                      {group.color && (
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                      )}
                      <h3 className="font-medium text-gray-900">{group.name}</h3>
                      <span className="ml-auto text-xs text-gray-400">{group.applications?.length || 0} apps</span>
                    </div>
                    {group.applications && group.applications.length > 0 ? (
                      <div className="divide-y divide-gray-50">
                        {group.applications.map((app) => (
                          <Link
                            key={app.id}
                            href={`/applications/${app.id}`}
                            className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-gray-50"
                          >
                            <div>
                              <span className="text-sm font-medium text-gray-900">{app.display_name}</span>
                              {app.environment && (
                                <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                                  {app.environment}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={app.status?.status || "UNKNOWN"} />
                              {app.status?.last_response_time_ms != null && (
                                <span className="text-xs text-gray-400">{app.status.last_response_time_ms}ms</span>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="px-5 py-4 text-sm text-gray-400">No applications in this group</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent Incidents */}
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Incidents</h2>
              <Link href="/incidents" className="text-sm text-blue-600 hover:text-blue-700">View all</Link>
            </div>
            {recentIncidents.length > 0 ? (
              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
                {recentIncidents.map((inc) => (
                  <div key={inc.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-gray-900">{inc.title}</p>
                        <IncidentTypeBadge type={inc.incident_type || "APPLICATION"} />
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">{formatDate(inc.started_at)}</p>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <SeverityBadge severity={inc.severity} />
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          inc.status === "ONGOING"
                            ? "bg-red-50 text-red-700"
                            : "bg-green-50 text-green-700"
                        }`}
                      >
                        {inc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No incidents recorded" description="Incidents will appear here when application or host state changes are detected." />
            )}
          </section>

          {/* All Applications */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">All Applications</h2>
              <Link href="/applications" className="text-sm text-blue-600 hover:text-blue-700">
                View catalog
              </Link>
            </div>
            {apps.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {apps.map((app) => (
                  <Link
                    key={app.id}
                    href={`/applications/${app.id}`}
                    className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="truncate pr-2 text-sm font-medium text-gray-900">{app.display_name}</h3>
                      <StatusBadge status={app.status?.status || "UNKNOWN"} />
                    </div>
                    <p className="truncate text-xs text-gray-400">{app.base_url}</p>
                    {app.status?.last_checked_at && (
                      <p className="mt-1 text-xs text-gray-400">
                        Checked: {formatDate(app.status.last_checked_at)}
                        {app.status.last_response_time_ms != null && ` (${app.status.last_response_time_ms}ms)`}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No applications yet"
                description="Add your first application to start monitoring."
                actionLabel="Add Application"
                onAction={() => router.push("/applications")}
              />
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
