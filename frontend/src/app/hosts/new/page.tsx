"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Host } from "@/types";
import { AppShell } from "@/components/layout/app-shell";

export default function RegisterHostPage() {
  const router = useRouter();
  const [hostname, setHostname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [environment, setEnvironment] = useState("");
  const [interval, setInterval] = useState(30);
  const [timeout, setTimeoutVal] = useState(90);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdHost, setCreatedHost] = useState<Host | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const host = await api.post<Host>("/api/hosts", {
        hostname,
        display_name: displayName,
        environment: environment || undefined,
        heartbeat_interval_seconds: interval,
        heartbeat_timeout_seconds: timeout,
      });
      setCreatedHost(host);
    } catch (e: any) {
      setError(e.message || "Failed to register host");
    } finally {
      setLoading(false);
    }
  }

  if (createdHost) {
    return (
      <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Host Registered</h1>

        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <h2 className="text-lg font-semibold text-green-900">
            {createdHost.display_name} has been registered.
          </h2>
          <p className="mt-2 text-sm text-green-700">
            Save the API key below. You&apos;ll need it to configure the host agent.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">Host ID</label>
            <code className="mt-1 block rounded bg-gray-100 px-3 py-2 text-sm font-mono text-gray-800">
              {createdHost.id}
            </code>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">API Key</label>
            <code className="mt-1 block rounded bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm font-mono text-gray-800 break-all">
              {createdHost.api_key}
            </code>
            <p className="mt-1 text-xs text-gray-400">Store this securely. It cannot be retrieved later.</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Install the Agent</h3>
          <p className="mt-2 text-sm text-gray-600">On the target Mac, run:</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 px-4 py-3 text-sm text-green-400">
{`MONITOR_SERVER_URL=http://your-server:8000 \\
MONITOR_API_KEY=${createdHost.api_key} \\
bash install.sh`}
          </pre>
          <p className="mt-3 text-xs text-gray-500">
            See <code>host-agent/README.md</code> for full installation instructions.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/hosts/${createdHost.id}`)}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            View Host
          </button>
          <button
            onClick={() => router.push("/hosts")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            All Hosts
          </button>
        </div>
      </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Register New Host</h1>
        <p className="mt-1 text-sm text-gray-500">
          Register a deployment machine to monitor its status via heartbeats.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Hostname</label>
          <input
            type="text"
            required
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder="e.g. mac-deploy-01"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">Machine hostname (must be unique)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Display Name</label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Mac Deploy 01"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Environment</label>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select environment...</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Heartbeat Interval (s)</label>
            <input
              type="number"
              min={10}
              max={600}
              value={interval}
              onChange={(e) => setInterval(parseInt(e.target.value) || 30)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Heartbeat Timeout (s)</label>
            <input
              type="number"
              min={30}
              max={1800}
              value={timeout}
              onChange={(e) => setTimeoutVal(parseInt(e.target.value) || 90)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Registering..." : "Register Host"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/hosts")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
    </AppShell>
  );
}
