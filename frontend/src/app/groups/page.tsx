"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { PageTransition, StaggerList, StaggerItem } from "@/components/ui/motion";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import type { UserGroup, Application } from "@/types";

export default function GroupsPage() {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [allApps, setAllApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3B82F6");
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState("");
  const toast = useToast();
  const confirm = useConfirm();

  async function load() {
    try { const [g, a] = await Promise.all([api.get<{ items: UserGroup[] }>("/api/groups"), api.get<{ items: Application[] }>("/api/applications?limit=200")]); setGroups(g.items); setAllApps(a.items); } catch { /* noop */ }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.post("/api/groups", { name: newName, color: newColor }); setNewName(""); setShowCreate(false); toast.success("Group created"); await load(); } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({ title: `Delete group "${name}"?`, description: "Applications will be unlinked.", confirmLabel: "Delete", variant: "danger" });
    if (!ok) return;
    try { await api.delete(`/api/groups/${id}`); toast.success("Group deleted"); await load(); } catch { toast.error("Failed"); }
  };

  const handleAddApp = async (groupId: string) => {
    if (!selectedAppId) return;
    try { await api.post(`/api/groups/${groupId}/applications`, { application_id: selectedAppId }); setSelectedAppId(""); setAddingToGroup(null); toast.success("Application added"); await load(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to add"); }
  };

  const handleRemoveApp = async (groupId: string, appId: string) => {
    try { await api.delete(`/api/groups/${groupId}/applications/${appId}`); toast.success("Removed"); await load(); } catch { toast.error("Failed"); }
  };

  return (
    <AppShell>
      <PageTransition>
        <PageHeader eyebrow="Organization" title="Application groups" description="Organize applications into logical groups." actions={<Button onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cancel" : "New group"}</Button>} />

        {showCreate && (
          <form onSubmit={handleCreate} className="mt-4 flex items-end gap-2">
            <div className="flex-1"><TextField label="Group name" value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="e.g. Production" /></div>
            <div className="flex items-end gap-2 pb-0.5">
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-border bg-canvas" />
              <Button type="submit">Create</Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="mt-5"><LoadingSkeleton rows={3} /></div>
        ) : groups.length === 0 ? (
          <div className="mt-5 rounded-lg border border-border bg-surface"><EmptyState title="No groups" description="Create a group to organize your applications." actionLabel="New group" onAction={() => setShowCreate(true)} /></div>
        ) : (
          <StaggerList className="mt-5 space-y-3">
            {groups.map((group) => (
              <StaggerItem key={group.id}><Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {group.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.color }} />}
                    <CardTitle>{group.name}</CardTitle>
                    <span className="text-[11px] text-fgSubtle">{group.applications?.length || 0} apps</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="xs" onClick={() => setAddingToGroup(addingToGroup === group.id ? null : group.id)}>Add app</Button>
                    <Button variant="ghost" size="xs" onClick={() => handleDelete(group.id, group.name)} className="text-fgSubtle hover:text-danger">Delete</Button>
                  </div>
                </CardHeader>
                {addingToGroup === group.id && (
                  <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                    <select value={selectedAppId} onChange={(e) => setSelectedAppId(e.target.value)} className="filter-input flex-1"><option value="">Select app…</option>{allApps.filter((a) => !group.applications?.some((ga) => ga.id === a.id)).map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}</select>
                    <Button size="xs" onClick={() => handleAddApp(group.id)} disabled={!selectedAppId}>Add</Button>
                  </div>
                )}
                {group.applications && group.applications.length > 0 ? (
                  <div className="divide-y divide-border">
                    {group.applications.map((app) => (
                      <div key={app.id} className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-2"><span className="text-[13px] font-medium text-fg">{app.display_name}</span><StatusBadge status={app.status?.status || "UNKNOWN"} /></div>
                        <button type="button" onClick={() => handleRemoveApp(group.id, app.id)} className="text-[11px] text-fgSubtle hover:text-danger">Remove</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <CardContent className="text-xs text-fgMuted">No applications in this group</CardContent>
                )}
              </Card></StaggerItem>
            ))}
          </StaggerList>
        )}
      </PageTransition>
    </AppShell>
  );
}
