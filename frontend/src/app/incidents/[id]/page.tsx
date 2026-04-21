"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeftIcon, ClockIcon } from "@heroicons/react/24/outline";
import { AppShell } from "@/components/layout/app-shell";
import { SeverityBadge, IncidentTypeBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTransition, SectionStagger, SectionItem } from "@/components/ui/motion";
import { api } from "@/lib/api";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Incident } from "@/types";

interface TimelineNode {
  label: string;
  description: string;
  time: string;
  color: string;
  dotColor: string;
}

function buildTimeline(inc: Incident): TimelineNode[] {
  const nodes: TimelineNode[] = [];

  nodes.push({
    label: "Incident started",
    description: `State changed from ${inc.previous_state} to ${inc.new_state}`,
    time: inc.started_at,
    color: inc.new_state === "DOWN" ? "border-danger" : "border-warning",
    dotColor: inc.new_state === "DOWN" ? "bg-danger" : "bg-warning",
  });

  if (inc.status === "RESOLVED" && inc.resolved_at) {
    const durationMs = new Date(inc.resolved_at).getTime() - new Date(inc.started_at).getTime();
    const durationStr = durationMs < 60_000
      ? `${Math.round(durationMs / 1000)}s`
      : durationMs < 3_600_000
        ? `${Math.round(durationMs / 60_000)}m`
        : `${Math.round(durationMs / 3_600_000)}h ${Math.round((durationMs % 3_600_000) / 60_000)}m`;

    nodes.push({
      label: "Resolved",
      description: `Incident resolved after ${durationStr}`,
      time: inc.resolved_at,
      color: "border-success",
      dotColor: "bg-success",
    });
  } else {
    nodes.push({
      label: "Ongoing",
      description: `Still ${inc.new_state} — ${formatDuration(inc.started_at)} elapsed`,
      time: new Date().toISOString(),
      color: "border-danger",
      dotColor: "bg-danger animate-pulse",
    });
  }

  return nodes;
}

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    async function load() {
      try {
        const inc = await api.get<Incident>(`/api/incidents/${params.id}`);
        setIncident(inc);
      } catch { /* noop */ }
      setLoading(false);
    }
    load();
    const interval = window.setInterval(load, 10000);
    return () => window.clearInterval(interval);
  }, [params.id]);

  if (loading) return <AppShell><p className="text-sm text-fgMuted">Loading…</p></AppShell>;
  if (!incident) return <AppShell><div className="rounded-lg bg-danger/10 px-4 py-3 text-[13px] text-danger">Incident not found</div></AppShell>;

  const timeline = buildTimeline(incident);
  const durationMs = (incident.resolved_at ? new Date(incident.resolved_at).getTime() : Date.now()) - new Date(incident.started_at).getTime();

  return (
    <AppShell>
      <PageTransition>
        <div className="mb-5">
          <button type="button" onClick={() => router.back()} className="mb-3 inline-flex items-center gap-1 text-xs text-fgMuted hover:text-fg">
            <ArrowLeftIcon className="h-3 w-3" /> Back
          </button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-fg">{incident.title}</h1>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${incident.status === "ONGOING" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                  {incident.status}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-fgMuted">
                {incident.application_name && (
                  <>
                    <Link href={`/applications/${incident.application_id}`} className="text-accent hover:underline">{incident.application_name}</Link>
                    {" · "}
                  </>
                )}
                Started {formatDate(incident.started_at)}
              </p>
            </div>
          </div>
        </div>

        <SectionStagger className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {/* Timeline */}
            <SectionItem><Card>
              <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
              <CardContent>
                <div className="relative ml-3">
                  <div className="absolute left-0 top-2 bottom-2 w-px bg-border" />
                  {timeline.map((node, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.15, ease }}
                      className="relative flex gap-4 pb-6 last:pb-0"
                    >
                      <div className="relative z-10 flex flex-col items-center">
                        <span className={`h-3 w-3 rounded-full ${node.dotColor} ring-4 ring-surface`} />
                      </div>
                      <div className="-mt-0.5 min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-fg">{node.label}</p>
                        <p className="mt-0.5 text-[12px] text-fgMuted">{node.description}</p>
                        <p className="mt-1 text-[11px] text-fgSubtle">{formatDate(node.time)}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card></SectionItem>
          </div>

          {/* Sidebar details */}
          <SectionItem><Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-3 text-[13px]">
                {[
                  ["Severity", <SeverityBadge key="sev" severity={incident.severity} />],
                  ["Type", <IncidentTypeBadge key="type" type={incident.incident_type} />],
                  ["Previous state", <span key="prev" className="rounded bg-surfaceRaised px-1.5 py-0.5 text-[11px] font-medium text-fgMuted">{incident.previous_state}</span>],
                  ["New state", <span key="new" className="rounded bg-surfaceRaised px-1.5 py-0.5 text-[11px] font-medium text-fgMuted">{incident.new_state}</span>],
                  ["Duration", (
                    <span key="dur" className="inline-flex items-center gap-1 text-fgMuted">
                      <ClockIcon className="h-3 w-3" />
                      {durationMs < 60_000
                        ? `${Math.round(durationMs / 1000)}s`
                        : durationMs < 3_600_000
                          ? `${Math.round(durationMs / 60_000)}m`
                          : `${Math.floor(durationMs / 3_600_000)}h ${Math.round((durationMs % 3_600_000) / 60_000)}m`
                      }
                    </span>
                  )],
                  ["Started", formatDate(incident.started_at)],
                  ...(incident.resolved_at ? [["Resolved", formatDate(incident.resolved_at)] as [string, string]] : []),
                  ...(incident.application_name
                    ? [["Application", <Link key="app" href={`/applications/${incident.application_id}`} className="text-accent hover:underline">{incident.application_name}</Link>] as [string, React.ReactNode]]
                    : []),
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-[11px] text-fgSubtle">{label}</dt>
                    <dd className="mt-0.5 font-medium text-fg">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card></SectionItem>
        </SectionStagger>
      </PageTransition>
    </AppShell>
  );
}
