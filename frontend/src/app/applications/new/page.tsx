"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { getDefaultMonitoringInterval } from "@/lib/monitoring-settings";

export default function NewApplicationPage() {
  const [displayName, setDisplayName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [healthUrl, setHealthUrl] = useState("");
  const [environment, setEnvironment] = useState("");
  const [monitoringInterval, setMonitoringInterval] = useState(60);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMonitoringInterval(getDefaultMonitoringInterval());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body: Record<string, string> = {
        display_name: displayName,
        base_url: baseUrl,
      };
      if (healthUrl) body.health_url = healthUrl;
      if (environment) body.environment = environment;
      body.monitoring_interval_seconds = String(monitoringInterval);

      const app = await api.post<{ id: string }>("/api/applications", body);
      router.push(`/applications/${app.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create application");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Add Application</h1>
        <p className="text-sm text-gray-500 mb-8">
          Add a new application to the global monitoring catalog. The system will attempt to
          automatically discover the health endpoint if you don&apos;t specify one.
        </p>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Payment Service"
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base URL *</label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="e.g. https://api.payments.internal"
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
              required
            />
            <p className="mt-1 text-xs text-gray-400">The base URL of the application. The system will probe common health paths.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Health URL (optional)</label>
            <input
              type="url"
              value={healthUrl}
              onChange={(e) => setHealthUrl(e.target.value)}
              placeholder="e.g. https://api.payments.internal/health"
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">If provided, discovery will be skipped and this URL will be used directly.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
            >
              <option value="">Select environment</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monitoring Interval (seconds)</label>
            <input
              type="number"
              min={10}
              max={3600}
              value={monitoringInterval}
              onChange={(e) => setMonitoringInterval(parseInt(e.target.value, 10) || 60)}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">The first check runs immediately after creation, then repeats on this interval.</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-brand-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating..." : "Add Application"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
