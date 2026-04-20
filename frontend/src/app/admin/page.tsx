"use client";

import { useState, useEffect } from "react";
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
                        <Td className="font-medium text-fg">{app.display_name}</Td>
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
                            <p className="font-medium text-fg">{h.display_name}</p>
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

            {activeTab === "system" && systemInfo && (
              <SectionStagger className="space-y-4">
                <SectionItem className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  <StatCard icon={CubeTransparentIcon} label="Applications" value={Number(systemInfo.total_applications) || 0} color="blue" delay={0} />
                  <StatCard icon={ServerIcon} label="Hosts" value={Number(systemInfo.total_hosts) || 0} color="blue" delay={0.04} />
                  <StatCard icon={SignalIcon} label="Online" value={Number(systemInfo.hosts_online) || 0} color="green" delay={0.08} />
                  <StatCard icon={ExclamationTriangleIcon} label="Incidents" value={Number(systemInfo.active_incidents) || 0} color={Number(systemInfo.active_incidents) > 0 ? "red" : "green"} delay={0.12} />
                  <StatCard icon={UserGroupIcon} label="Users" value={Number(systemInfo.total_users) || 0} color="cyan" delay={0.16} />
                </SectionItem>
                <SectionItem className="rounded-lg border border-border bg-surface px-4 py-3">
                  <p className="text-2xs font-medium uppercase tracking-wider text-fgSubtle">System status</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <PulseIndicator color="bg-success" active />
                    <span className="text-[13px] font-medium capitalize text-fg">{String(systemInfo.status ?? "")}</span>
                  </div>
                </SectionItem>
              </SectionStagger>
            )}
          </>
        )}
      </PageTransition>
    </AppShell>
  );
}
