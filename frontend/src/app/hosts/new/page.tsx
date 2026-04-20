"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/motion";
import { api } from "@/lib/api";
import type { Host } from "@/types";

export default function NewHostPage() {
  const [displayName, setDisplayName] = useState("");
  const [hostname, setHostname] = useState("");
  const [environment, setEnvironment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdHost, setCreatedHost] = useState<(Host & { api_key?: string }) | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body: Record<string, string> = { display_name: displayName, hostname };
      if (environment) body.environment = environment;
      const host = await api.post<Host & { api_key?: string }>("/api/hosts", body);
      setCreatedHost(host);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register host");
    }
    setLoading(false);
  };

  if (createdHost) {
    return (
      <AppShell>
        <PageTransition>
          <PageHeader title="Host registered" description="Your host is ready. Install the monitoring agent." />
          <div className="mt-5 max-w-md space-y-4">
            <Card>
              <CardContent className="space-y-3 py-4">
                <div>
                  <p className="text-2xs font-medium text-fgSubtle">Host name</p>
                  <p className="text-[13px] font-medium text-fg">{createdHost.display_name}</p>
                </div>
                {createdHost.api_key && (
                  <div>
                    <p className="text-2xs font-medium text-fgSubtle">API key (shown once)</p>
                    <code className="mt-1 block break-all rounded bg-canvas px-2 py-1.5 font-mono text-xs text-accent">{createdHost.api_key}</code>
                  </div>
                )}
                <div>
                  <p className="text-2xs font-medium text-fgSubtle">Install snippet</p>
                  <pre className="mt-1 overflow-x-auto rounded bg-canvas p-2 font-mono text-[11px] text-fgMuted">
{`curl -fsSL https://monitor.example.com/install.sh | \\
  HOST_API_KEY="${createdHost.api_key || "<YOUR_KEY>"}" bash`}
                  </pre>
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-2">
              <Button onClick={() => router.push(`/hosts/${createdHost.id}`)}>View host</Button>
              <Button variant="secondary" onClick={() => router.push("/hosts")}>All hosts</Button>
            </div>
          </div>
        </PageTransition>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <PageHeader title="Register host" description="Add a server or device to monitor." />
        <form onSubmit={handleSubmit} className="mt-5 max-w-md space-y-4">
          <Card>
            <CardContent className="space-y-3 py-4">
              <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="e.g. production-server-01" />
              <TextField label="Hostname" value={hostname} onChange={(e) => setHostname(e.target.value)} required placeholder="e.g. server-01.example.com" />
              <SelectField label="Environment" value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="Select…" options={[
                { value: "production", label: "Production" },
                { value: "staging", label: "Staging" },
                { value: "development", label: "Development" },
              ]} />
            </CardContent>
          </Card>

          {error && <p className="rounded-md bg-danger/10 px-2.5 py-2 text-xs text-danger">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" loading={loading}>Register host</Button>
            <Button variant="secondary" type="button" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </PageTransition>
    </AppShell>
  );
}
