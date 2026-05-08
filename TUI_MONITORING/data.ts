import { DashboardState, SystemStats, UserStats, Job, AgentLog, Alert } from './types';

let cpuHistory: number[] = [];

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateSystemStats(): SystemStats {
  const cpus = 8;
  const cpuPercents = Array.from({ length: cpus }, () => getRandomInt(5, 95));
  const cpuTotal = Math.round(cpuPercents.reduce((a, b) => a + b, 0) / cpus);
  
  cpuHistory.push(cpuTotal);
  if (cpuHistory.length > 60) cpuHistory.shift();
  
  return {
    uptime: Math.floor(Math.random() * 1000000),
    cpuTotal,
    cpuPercent: cpuPercents,
    loadAvg: [getRandomFloat(0, 4).toFixed(2), getRandomFloat(0, 4).toFixed(2), getRandomFloat(0, 4).toFixed(2)].map(Number),
    ramTotal: 32,
    ramUsed: parseFloat((getRandomFloat(16, 30)).toFixed(1)),
    ramPercent: getRandomInt(40, 95),
    swapTotal: 8,
    swapUsed: parseFloat((getRandomFloat(0, 6)).toFixed(1)),
    swapPercent: getRandomInt(0, 80),
    networkSent: getRandomInt(1000000, 100000000),
    networkRecv: getRandomInt(1000000, 100000000),
    connections: getRandomInt(50, 500),
  };
}

function generateUsers(): UserStats[] {
  return [
    { username: 'admin', cpuPercent: getRandomInt(10, 90), ramGB: getRandomFloat(2, 8), processCount: getRandomInt(10, 50), loggedIn: true },
    { username: 'dev01', cpuPercent: getRandomInt(5, 50), ramGB: getRandomFloat(1, 4), processCount: getRandomInt(5, 20), loggedIn: true },
    { username: 'dev02', cpuPercent: getRandomInt(5, 40), ramGB: getRandomFloat(1, 3), processCount: getRandomInt(3, 15), loggedIn: true },
  ];
}

function generateJobs(): Job[] {
  const statuses: Job['status'][] = ['RUNNING', 'QUEUED', 'DONE', 'FAILED'];
  const jobNames = ['build-service', 'test-suite', 'deploy-prod', 'data-pipeline', 'model-train'];
  const owners = ['admin', 'dev01', 'dev02'];
  
  return Array.from({ length: 12 }, (_, i) => ({
    id: `job-${i}`,
    name: jobNames[getRandomInt(0, jobNames.length - 1)],
    owner: owners[getRandomInt(0, owners.length - 1)],
    status: statuses[getRandomInt(0, statuses.length - 1)] as Job['status'],
    elapsedSec: getRandomInt(0, 3600),
  }));
}

function generateAgentLog(): AgentLog[] {
  const messages = [
    'Queued analysis job',
    'Job completed successfully',
    'Resource allocation updated',
    'Monitoring threshold exceeded',
    'Auto-healing triggered',
  ];
  const owners = ['admin', 'dev01', 'dev02', 'SYSTEM'];
  
  return Array.from({ length: 8 }, (_, i) => ({
    owner: owners[getRandomInt(0, owners.length - 1)],
    message: messages[getRandomInt(0, messages.length - 1)],
  }));
}

function generateAlerts(): Alert[] {
  return [
    { level: 'error', message: 'CPU threshold exceeded on node-03' },
    { level: 'warn', message: 'Memory usage above 80% for 5min' },
    { level: 'info', message: 'New user logged in' },
  ];
}

export function fetchDashboardState(): DashboardState {
  return {
    system: generateSystemStats(),
    users: generateUsers(),
    jobs: generateJobs(),
    agentLog: generateAgentLog(),
    alerts: generateAlerts(),
    cpuHistory,
  };
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${mins}m`;
}

export function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)}GB`;
}

export function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}