export type ServiceState = 'starting' | 'running' | 'unhealthy' | 'restarting' | 'failed';

export interface ServiceHealth {
  state: ServiceState;
  lastOkAt: number | null;
  restartCount: number;
  lastError: string | null;
}

export interface HealthResponse {
  status: string;
  version: string;
  uptime_seconds: number;
}
