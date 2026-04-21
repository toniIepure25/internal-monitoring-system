"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldExclamationIcon,
  CubeTransparentIcon,
  ServerIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge, HostStatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { DataTableShell, Th, Td } from "@/components/ui/data-table-shell";
import { PageTransition, PulseIndicator, SectionStagger, SectionItem } from "@/components/ui/motion";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type { Application, User, Host } from "@/types";

export default function AdminPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [systemInfo, setSystemInfo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"apps" | "hosts" | "users" | "system">("apps");

  useEffect(() => {
    async function load() {
      try {
        const [appsRes, usersRes, sysRes, hostsRes] = await Promise.all([
          api.get<{ items: Application[] }>("/api/admin/applications?limit=100"),
          api.get<{ items: User[] }>("/api/admin/users?limit=100"),
          api.get("/api/admin/system"),
          api.get<{ items: Host[] }>("/api/hosts?limit=100").catch(() => ({ items: [] })),
        ]);
        setApps(appsRes.items); setUsers(usersRes.items);
        setSystemInfo(sysRes as Record<string, unknown>); setHosts(hostsRes.items);
      } catch { /* noop */ }
      setLoading(false);
    }
    load();
  }, []);

  const handleToggleMaintenance = async (id: string, v: boolean) => {
    try { await api.patch(`/api/admin/applications/${id}?is_maintenance=${v}`); setApps((p) => p.map((a) => a.id === id ? { ...a, is_maintenance: v } : a)); } catch { /* noop */ }
  };
  const handleToggleActive = async (id: string, v: boolean) => {
    try { await api.patch(`/api/admin/applications/${id}?is_active=${v}`); setApps((p) => p.map((a) => a.id === id ? { ...a, is_active: v } : a)); } catch { /* noop */ }
  };

  if (user?.role !== "admin") {
    return (
      <AppShell>
        <div className="flex flex-col items-center py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10">
            <ShieldExclamationIcon className="h-5 w-5 text-danger" />
          </div>
          <p className="mt-3 text-[13px] font-medium text-fg">Access restricted</p>
          <p className="mt-1 text-xs text-fgMuted">Admin privileges required.</p>
        </div>
      </AppShell>
    );
  }

  const tabs = [
    { id: "apps" as const, label: "Applications" },
    { id: "hosts" as const, label: "Hosts" },
    { id: "users" as const, label: "Users" },
    { id: "system" as const, label: "System" },
  ];

  return (
    <AppShell>
      <PageTransition>
        <PageHeader eyebrow="Administration" title="Admin" description="Platform management and system health." />

        <div className="mt-5 mb-4 flex gap-0.5 rounded-md border border-border bg-canvas p-0.5">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={cn("flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors", activeTab === t.id ? "bg-surfaceRaised text-fg" : "text-fgMuted hover:text-fg")}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <DataTableShell><TableSkeleton cols={5} rows={4} /></DataTableShell>
        ) : (
          <>
            {activeTab === "apps" && (
              <DataTableShell>
                <table className="w-full min-w-[560px]">
                  <thead><tr className="border-b border-border"><Th>Name</Th><Th>Status</Th><Th>Active</Th><Th>Maintenance</Th><Th>Created</Th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {apps.map((app) => (
                      <tr key={app.id} className="transition-colors hover:bg-surfaceRaised/40">
                        <Td><Link href={`/applications/${app.id}`} className="font-medium text-fg hover:text-accent">{app.display_name}</Link></Td>
                        <Td><StatusBadge status={app.status?.status || "UNKNOWN"} /></Td>
                        <Td><input type="checkbox" checked={app.is_active} onChange={(e) => handleToggleActive(app.id, e.target.checked)} className="h-3.5 w-3.5 rounded border-border bg-canvas text-accent focus:ring-accent/30" /></Td>
                        <Td><input type="checkbox" checked={app.is_maintenance} onChange={(e) => handleToggleMaintenance(app.id, e.target.checked)} className="h-3.5 w-3.5 rounded border-border bg-canvas text-warning focus:ring-warning/30" /></Td>
                        <Td className="text-fgMuted">{formatDate(app.created_at)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableShell>
            )}

            {activeTab === "hosts" && (
              <DataTableShell>
                {hosts.length === 0 ? (
                  <div className="py-10 text-center text-xs text-fgMuted">No hosts registered</div>
                ) : (
                  <table className="w-full min-w-[560px]">
                    <thead><tr className="border-b border-border"><Th>Host</Th><Th>Status</Th><Th>Active</Th><Th>Last heartbeat</Th></tr></thead>
                    <tbody className="divide-y divide-border">
                      {hosts.map((h) => (
                        <tr key={h.id} className="transition-colors hover:bg-surfaceRaised/40">
                          <Td>
                            <Link href={`/hosts/${h.id}`} className="font-medium text-fg hover:text-accent">{h.display_name}</Link>
                            <p className="text-[11px] text-fgSubtle">{h.hostname}</p>
                          </Td>
                          <Td><HostStatusBadge status={h.status?.status || "UNKNOWN"} /></Td>
                          <Td>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${h.is_active ? "bg-success/10 text-success" : "bg-fgSubtle/10 text-fgMuted"}`}>{h.is_active ? "Active" : "Inactive"}</span>
                          </Td>
                          <Td className="text-fgMuted">{h.status?.last_heartbeat_at ? formatDate(h.status.last_heartbeat_at) : "Never"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </DataTableShell>
            )}

            {activeTab === "users" && (
              <DataTableShell>
                <table className="w-full min-w-[480px]">
                  <thead><tr className="border-b border-border"><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Joined</Th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u) => (
                      <tr key={u.id} className="transition-colors hover:bg-surfaceRaised/40">
                        <Td className="font-medium text-fg">{u.display_name}</Td>
                        <Td className="text-fgMuted">{u.email}</Td>
                        <Td><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${u.role === "admin" ? "bg-accent/10 text-accent" : "bg-fgSubtle/10 text-fgMuted"}`}>{u.role}</span></Td>
                        <Td className="text-fgMuted">{formatDate(u.created_at)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableShell>
            )}

            {activeTab === "system" && systemInfo && (() => {
              const scheduler = systemInfo.scheduler as { running?: boolean; jobs?: number; job_details?: { id: string; name: string; next_run: string }[] } | undefined;
              const uptimeS = Number(systemInfo.process_uptime_seconds) || 0;
              const uptimeStr = uptimeS < 60 ? `${uptimeS}s`
                : uptimeS < 3600 ? `${Math.floor(uptimeS / 60)}m ${uptimeS % 60}s`
                : `${Math.floor(uptimeS / 3600)}h ${Math.floor((uptimeS % 3600) / 60)}m`;

              return (
                <SectionStagger className="space-y-4">
                  <SectionItem className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <StatCard icon={CubeTransparentIcon} label="Applications" value={Number(systemInfo.total_applications) || 0} color="blue" delay={0} />
                    <StatCard icon={ServerIcon} label="Hosts" value={Number(systemInfo.total_hosts) || 0} color="blue" delay={0.04} />
                    <StatCard icon={SignalIcon} label="Online" value={Number(systemInfo.hosts_online) || 0} color="green" delay={0.08} />
                    <StatCard icon={ExclamationTriangleIcon} label="Incidents" value={Number(systemInfo.active_incidents) || 0} color={Number(systemInfo.active_incidents) > 0 ? "red" : "green"} delay={0.12} />
                    <StatCard icon={UserGroupIcon} label="Users" value={Number(systemInfo.total_users) || 0} color="cyan" delay={0.16} />
                  </SectionItem>

                  <SectionItem className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* System status + runtime */}
                    <div className="rounded-lg border border-border bg-surface px-4 py-3">
                      <p className="text-2xs font-medium uppercase tracking-wider text-fgSubtle">System status</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <PulseIndicator color="bg-success" active />
                        <span className="text-[13px] font-medium capitalize text-fg">{String(systemInfo.status ?? "")}</span>
                      </div>
                      <dl className="mt-3 space-y-2 border-t border-border pt-3">
                        {[
                          ["Process uptime", uptimeStr],
                          ["Memory", systemInfo.memory_mb != null ? `${systemInfo.memory_mb} MB` : "—"],
                          ["Python", String(systemInfo.python_version ?? "—")],
                          ["OS", String(systemInfo.os ?? "—")],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between">
                            <dt className="text-[11px] text-fgSubtle">{label}</dt>
                            <dd className="rounded bg-surfaceRaised px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-fgMuted">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    {/* Database */}
                    <div className="rounded-lg border border-border bg-surface px-4 py-3">
                      <p className="text-2xs font-medium uppercase tracking-wider text-fgSubtle">Database</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <PulseIndicator color={systemInfo.db_latency_ms != null ? "bg-success" : "bg-danger"} active={systemInfo.db_latency_ms != null} />
                        <span className="text-[13px] font-medium text-fg">{systemInfo.db_latency_ms != null ? "Connected" : "Unreachable"}</span>
                      </div>
                      <dl className="mt-3 space-y-2 border-t border-border pt-3">
                        {[
                          ["Latency", systemInfo.db_latency_ms != null ? `${systemInfo.db_latency_ms}ms` : "—"],
                          ["Version", String(systemInfo.db_version ?? "—")],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between">
                            <dt className="text-[11px] text-fgSubtle">{label}</dt>
                            <dd className="max-w-[200px] truncate rounded bg-surfaceRaised px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-fgMuted">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </SectionItem>

                  {scheduler && (
                    <SectionItem className="rounded-lg border border-border bg-surface">
                      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                        <p className="text-2xs font-medium uppercase tracking-wider text-fgSubtle">Scheduler</p>
                        <div className="flex items-center gap-2">
                          <PulseIndicator color={scheduler.running ? "bg-success" : "bg-danger"} active={!!scheduler.running} />
                          <span className="text-[12px] font-medium text-fg">{scheduler.running ? "Running" : "Stopped"}</span>
                          <span className="text-[11px] text-fgSubtle">{scheduler.jobs ?? 0} jobs</span>
                        </div>
                      </div>
                      {scheduler.job_details && scheduler.job_details.length > 0 && (
                        <div className="max-h-64 overflow-y-auto">
                          <DataTableShell>
                            <table className="w-full">
                              <thead><tr className="border-b border-border"><Th>Job</Th><Th>Next run</Th></tr></thead>
                              <tbody className="divide-y divide-border">
                                {scheduler.job_details.map((job) => (
                                  <tr key={job.id} className="transition-colors hover:bg-surfaceRaised/40">
                                    <Td>
                                      <p className="text-[12px] font-medium text-fg">{job.name}</p>
                                      <p className="font-mono text-[10px] text-fgSubtle">{job.id}</p>
                                    </Td>
                                    <Td className="text-[12px] tabular-nums text-fgMuted">{job.next_run ? new Date(job.next_run).toLocaleString() : "—"}</Td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </DataTableShell>
                        </div>
                      )}
                    </SectionItem>
                  )}
                </SectionStagger>
              );
            })()}
          </>
        )}
      </PageTransition>
    </AppShell>
  );
}
