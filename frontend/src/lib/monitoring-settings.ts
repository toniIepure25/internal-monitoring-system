const DEFAULT_MONITORING_INTERVAL_SECONDS = 60;
const MONITORING_INTERVAL_STORAGE_KEY = "default_monitoring_interval_seconds";

export function getDefaultMonitoringInterval(): number {
  if (typeof window === "undefined") return DEFAULT_MONITORING_INTERVAL_SECONDS;

  const raw = window.localStorage.getItem(MONITORING_INTERVAL_STORAGE_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_MONITORING_INTERVAL_SECONDS;
  if (Number.isNaN(parsed)) return DEFAULT_MONITORING_INTERVAL_SECONDS;
  return Math.min(Math.max(parsed, 10), 3600);
}

export function setDefaultMonitoringInterval(value: number) {
  if (typeof window === "undefined") return;
  const normalized = Math.min(Math.max(value, 10), 3600);
  window.localStorage.setItem(MONITORING_INTERVAL_STORAGE_KEY, String(normalized));
}

export { DEFAULT_MONITORING_INTERVAL_SECONDS };
