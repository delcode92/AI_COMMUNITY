export interface SystemStats {
  uptime: number;
  cpuTotal: number;
  cpuPercent: number[];
  loadAvg: number[];
  ramTotal: number;
  ramUsed: number;
  ramPercent: number;
  swapTotal: number;
  swapUsed: number;
  swapPercent: number;
  networkSent: number;
  networkRecv: number;
  connections: number;
}

export interface UserStats {
  username: string;
  cpuPercent: number;
  ramGB: number;
  processCount: number;
  loggedIn: boolean;
}

export interface Job {
  id: string;
  name: string;
  owner: string;
  status: 'RUNNING' | 'QUEUED' | 'DONE' | 'FAILED';
  elapsedSec?: number;
}

export interface AgentLog {
  owner: string;
  message: string;
}

export interface Alert {
  level: 'error' | 'warn' | 'info';
  message: string;
}

export interface DashboardState {
  system: SystemStats;
  users: UserStats[];
  jobs: Job[];
  agentLog: AgentLog[];
  alerts: Alert[];
  cpuHistory: number[];
}