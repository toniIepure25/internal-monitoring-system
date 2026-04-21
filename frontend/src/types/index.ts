export type UserRole = "admin" | "user";
export type AppState = "UP" | "DOWN" | "DEGRADED" | "SLOW" | "UNKNOWN";
export type HostState = "ONLINE" | "OFFLINE" | "DEGRADED" | "UNKNOWN";
export type DetectionSource = "auto" | "manual";
export type IncidentStatus = "ONGOING" | "RESOLVED";
export type IncidentSeverity = "CRITICAL" | "WARNING" | "INFO";
export type IncidentType = "APPLICATION" | "HOST" | "HOST_CAUSED";
export type ChannelType = "email" | "browser_push" | "telegram";
export type DeliveryStatus = "PENDING" | "SENT" | "FAILED";

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Application {
  id: string;
  display_name: string;
  base_url: string;
  normalized_url: string;
  health_url: string | null;
  detection_source: DetectionSource;
  environment: string | null;
  is_active: boolean;
  is_maintenance: boolean;
  created_by: string;
  monitoring_interval_seconds: number;
  timeout_seconds: number;
  consecutive_failures_threshold: number;
  consecutive_recovery_threshold: number;
  slow_threshold_ms: number;
  frontend_container: string | null;
  backend_container: string | null;
  created_at: string;
  updated_at: string;
  status?: ApplicationStatusInfo;
  creator?: User;
}

export interface ContainerInfo {
  name: string;
  image: string;
  status: string;
  ports: string;
}

export interface ContainerDiscovery {
  frontend: string | null;
  backend: string | null;
  current_frontend: string | null;
  current_backend: string | null;
  all_matches: ContainerInfo[];
  all_containers: ContainerInfo[];
}

export interface ContainerLogs {
  container_name: string;
  container_type: string;
  lines: string;
  line_count: number;
  success: boolean;
  error: string | null;
}

export interface ApplicationStatusInfo {
  status: AppState;
  last_checked_at: string | null;
  last_response_time_ms: number | null;
  last_http_status: number | null;
  consecutive_failures: number;
  consecutive_successes: number;
  current_state_since: string | null;
}

export interface HealthCandidate {
  id: string;
  url: string;
  http_status: number | null;
  response_time_ms: number | null;
  is_json: boolean;
  has_health_indicators: boolean;
  score: number;
  is_selected: boolean;
  probed_at: string | null;
}

export interface Host {
  id: string;
  hostname: string;
  display_name: string;
  environment: string | null;
  tags: Record<string, unknown>;
  os_info: string | null;
  is_active: boolean;
  heartbeat_interval_seconds: number;
  heartbeat_timeout_seconds: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  status?: HostStatusInfo;
  api_key?: string;
}

export interface HostStatusInfo {
  status: HostState;
  last_heartbeat_at: string | null;
  consecutive_misses: number;
  consecutive_heartbeats: number;
  ip_address: string | null;
  os_version: string | null;
  uptime_seconds: number | null;
}

export interface HostDetail extends Host {
  applications: {
    id: string;
    display_name: string;
    base_url: string;
    health_url: string | null;
    environment: string | null;
    is_active: boolean;
  }[];
  recent_heartbeats: {
    id: string;
    received_at: string | null;
    ip_address: string | null;
    os_version: string | null;
    uptime_seconds: number | null;
  }[];
}

export interface Incident {
  id: string;
  application_id: string | null;
  host_id: string | null;
  incident_type: IncidentType;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  previous_state: string;
  new_state: string;
  started_at: string;
  resolved_at: string | null;
  created_at: string;
  application_name?: string | null;
  host_name?: string | null;
  application?: Application;
}

export interface Subscription {
  id: string;
  user_id: string;
  application_id: string;
  notify_on_down: boolean;
  notify_on_up: boolean;
  notify_on_degraded: boolean;
  notify_on_slow: boolean;
  created_at: string;
  application?: Application;
}

export interface NotificationChannel {
  id: string;
  channel_type: ChannelType;
  is_enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
}

export interface NotificationLogEntry {
  id: string;
  user_id: string;
  channel_type: ChannelType;
  status: DeliveryStatus;
  title?: string | null;
  application_id?: string | null;
  application_name?: string | null;
  host_name?: string | null;
  error_message?: string | null;
  sent_at: string | null;
  created_at: string;
  incident_id?: string | null;
}

export interface UserGroup {
  id: string;
  name: string;
  display_order: number;
  color: string | null;
  applications?: Application[];
}

export interface HealthCheckEntry {
  id: string;
  status: AppState;
  http_status: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  checked_at: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
