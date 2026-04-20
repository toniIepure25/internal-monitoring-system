"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import type { UserGroup, Application } from "@/types";

export default function GroupsPage() {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [allApps, setAllApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState("");

  const load = useCallback(async () => {
    try {
      const [groupsRes, appsRes] = await Promise.all([
        api.get<{ items: UserGroup[] }>("/api/groups"),
        api.get<{ items: Application[] }>("/api/applications?limit=200"),
      ]);
      setGroups(groupsRes.items);
      setAllApps(appsRes.items);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/groups", { name: newName, color: newColor });
      setNewName("");
      setShowCreate(false);
      load();
    } catch {}
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Delete this group?")) return;
    try {
      await api.delete(`/api/groups/${groupId}`);
      load();
    } catch {}
  };

  const handleAddApp = async (groupId: string) => {
    if (!selectedAppId) return;
    try {
      await api.post(`/api/groups/${groupId}/applications`, { application_id: selectedAppId });
      setAddingToGroup(null);
      setSelectedAppId("");
      load();
    } catch (err: any) {
      alert(err.message || "Failed to add");
    }
  };

  const handleRemoveApp = async (groupId: string, appId: string) => {
    try {
      await api.delete(`/api/groups/${groupId}/applications/${appId}`);
      load();
    } catch {}
  };

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Groups</h1>
          <p className="mt-1 text-sm text-gray-500">Organize applications into personal collections</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          New Group
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreateGroup} className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Group Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Color</label>
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-9 w-16 rounded border border-gray-300"
              />
            </div>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <LoadingSkeleton rows={4} />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create a group to organize your applications into personal collections."
          actionLabel="New Group"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                <div className="flex items-center gap-2">
                  {group.color && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />}
                  <h3 className="font-medium text-gray-900">{group.name}</h3>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    {group.applications?.length || 0}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAddingToGroup(addingToGroup === group.id ? null : group.id)}
                    className="rounded-lg px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                  >
                    + Add App
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    className="rounded-lg px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {addingToGroup === group.id && (
                <div className="flex gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3">
                  <select
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select application...</option>
                    {allApps.map((app) => (
                      <option key={app.id} value={app.id}>{app.display_name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAddApp(group.id)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              )}

              {group.applications && group.applications.length > 0 ? (
                <div className="divide-y divide-gray-50">
                  {group.applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between px-5 py-3 transition hover:bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">{app.display_name}</span>
                        <StatusBadge status={app.status?.status || "UNKNOWN"} />
                      </div>
                      <button
                        onClick={() => handleRemoveApp(group.id, app.id)}
                        className="text-xs text-gray-400 transition hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-4 text-sm text-gray-400">No applications in this group</p>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
