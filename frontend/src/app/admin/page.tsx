"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge, HostStatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { TableSkeleton, CardSkeleton } from "@/components/ui/loading-skeleton";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Application, User, Host } from "@/types";

export default function AdminPage() {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [systemInfo, setSystemInfo] = useState<any>(null);
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
        setApps(appsRes.items);
        setUsers(usersRes.items);
        setSystemInfo(sysRes);
        setHosts(hostsRes.items);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const handleToggleMaintenance = async (appId: string, value: boolean) => {
    try {
      await api.patch(`/api/admin/applications/${appId}?is_maintenance=${value}`);
      setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, is_maintenance: value } : a)));
    } catch {}
  };

  const handleToggleActive = async (appId: string, value: boolean) => {
    try {
      await api.patch(`/api/admin/applications/${appId}?is_active=${value}`);
      setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, is_active: value } : a)));
    } catch {}
  };

  if (user?.role !== "admin") {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v.01M12 12V9m-6.938 8h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-900">Access Restricted</p>
          <p className="mt-1 text-sm text-gray-500">This page is only available to administrators.</p>
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="mt-1 text-sm text-gray-500">System management and configuration</p>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <TableSkeleton cols={5} rows={4} />
        </div>
      ) : (
        <>
          {activeTab === "apps" && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Active</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Maintenance</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {apps.map((app) => (
                    <tr key={app.id} className="transition hover:bg-gray-50/50">
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{app.display_name}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={app.status?.status || "UNKNOWN"} /></td>
                      <td className="px-5 py-3.5">
                        <label className="flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={app.is_active}
                            onChange={(e) => handleToggleActive(app.id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          />
                        </label>
                      </td>
                      <td className="px-5 py-3.5">
                        <label className="flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={app.is_maintenance}
                            onChange={(e) => handleToggleMaintenance(app.id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-orange-600"
                          />
                        </label>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{formatDate(app.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "hosts" && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {hosts.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">No hosts registered</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Host</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Env</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Active</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Last Heartbeat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {hosts.map((host) => (
                      <tr key={host.id} className="transition hover:bg-gray-50/50">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-gray-900">{host.display_name}</p>
                          <p className="text-xs text-gray-400">{host.hostname}</p>
                        </td>
                        <td className="px-5 py-3.5"><HostStatusBadge status={host.status?.status || "UNKNOWN"} /></td>
                        <td className="px-5 py-3.5 text-sm text-gray-500">{host.environment || "-"}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            host.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                          }`}>
                            {host.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-500">
                          {host.status?.last_heartbeat_at ? new Date(host.status.last_heartbeat_at).toLocaleString() : "Never"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "users" && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((u) => (
                    <tr key={u.id} className="transition hover:bg-gray-50/50">
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{u.display_name}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "system" && systemInfo && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <StatCard label="Applications" value={systemInfo.total_applications} color="blue" />
                <StatCard label="Hosts" value={systemInfo.total_hosts || 0} color="blue" />
                <StatCard label="Hosts Online" value={systemInfo.hosts_online || 0} color="green" />
                <StatCard label="Active Incidents" value={systemInfo.active_incidents || 0} color={systemInfo.active_incidents > 0 ? "red" : "green"} />
                <StatCard label="Users" value={systemInfo.total_users} color="gray" />
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">System Status</h2>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="text-sm font-medium capitalize text-gray-900">{systemInfo.status}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
