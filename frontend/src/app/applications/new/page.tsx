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
import { getDefaultMonitoringInterval } from "@/lib/monitoring-settings";

export default function NewApplicationPage() {
  const [displayName, setDisplayName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [healthUrl, setHealthUrl] = useState("");
  const [environment, setEnvironment] = useState("");
  const [monitoringInterval, setMonitoringInterval] = useState(String(getDefaultMonitoringInterval()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body: Record<string, string> = { display_name: displayName, base_url: baseUrl, monitoring_interval_seconds: monitoringInterval };
      if (healthUrl) body.health_url = healthUrl;
      if (environment) body.environment = environment;
      const app = await api.post<{ id: string }>("/api/applications", body);
      router.push(`/applications/${app.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create application");
    }
    setLoading(false);
  };

  return (
    <AppShell>
      <PageTransition>
        <PageHeader title="Add application" description="Register a new application to begin monitoring." />

        <form onSubmit={handleSubmit} className="mt-5 max-w-md space-y-4">
          <Card>
            <CardContent className="space-y-3 py-4">
              <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="My API" />
              <TextField label="Base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required placeholder="https://api.example.com" type="url" />
              <TextField label="Health URL (optional)" value={healthUrl} onChange={(e) => setHealthUrl(e.target.value)} placeholder="https://api.example.com/health" type="url" hint="Leave blank to auto-discover" />
              <SelectField label="Environment" value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="Select…" options={[
                { value: "production", label: "Production" },
                { value: "staging", label: "Staging" },
                { value: "development", label: "Development" },
              ]} />
              <TextField label="Check interval (seconds)" value={monitoringInterval} onChange={(e) => setMonitoringInterval(e.target.value)} type="number" min={10} max={3600} />
            </CardContent>
          </Card>

          {error && <p className="rounded-md bg-danger/10 px-2.5 py-2 text-xs text-danger">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" loading={loading}>Create application</Button>
            <Button variant="secondary" type="button" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </PageTransition>
    </AppShell>
  );
}
