// data.js – runtime helpers for the TUI monitoring dashboard
// This file is the compiled JavaScript output of the TypeScript source (data.ts).
// It provides functions that generate mock system data and formatting utilities
// used by the dashboard UI. The functions are intentionally deterministic enough
// for a demo but random enough to look realistic.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchDashboardState = fetchDashboardState;
exports.formatUptime = formatUptime;
exports.formatBytes = formatBytes;
exports.formatElapsed = formatElapsed;

// ---------- Internal state ----------
// cpuHistory stores a rolling window of the overall CPU usage percentage.
// It is used to render the sparkline showing recent CPU trends.
let cpuHistory = [];


// ---------- Utility random generators ----------
// getRandomInt returns an integer between min and max (inclusive).
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
// getRandomFloat returns a floating‑point number in the half‑open interval [min, max).
function getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

// ---------- Mock data generators ----------
// generateSystemStats creates a fake system snapshot.
// It randomly populates CPU, memory, swap, network, and load‑average values.
function generateSystemStats() {
    // Try to fetch real system metrics via the Python helper.
    // If the helper fails (missing psutil, runtime error, etc.) we fall back to mock data.
    const { execSync } = require('child_process');
    try {
        const raw = execSync('python3 metrics.py', { encoding: 'utf8' }).trim();
        const real = JSON.parse(raw);
        // Preserve historical CPU history for the sparkline.
        const cpuTotal = Math.round(real.cpuTotal);
        cpuHistory.push(cpuTotal);
        if (cpuHistory.length > 60) cpuHistory.shift();
        return {
            uptime: real.uptime,
            cpuTotal,
            cpuPercent: real.cpuPercent,
            loadAvg: real.loadAvg,
            ramTotal: real.ramTotal,
            ramUsed: real.ramUsed,
            ramPercent: real.ramPercent,
            swapTotal: real.swapTotal,
            swapUsed: real.swapUsed,
            swapPercent: real.swapPercent,
            networkSent: real.networkSent,
            networkRecv: real.networkRecv,
            connections: real.connections,
        };
    } catch (e) {
        // Fallback to the original mock generator if anything goes wrong.
        const cpus = 8;
        const cpuPercents = Array.from({ length: cpus }, () => getRandomInt(5, 95));
        const cpuTotal = Math.round(cpuPercents.reduce((a, b) => a + b, 0) / cpus);
        cpuHistory.push(cpuTotal);
        if (cpuHistory.length > 60) cpuHistory.shift();
        return {
            uptime: Math.floor(Math.random() * 1000000),
            cpuTotal,
            cpuPercent: cpuPercents,
            loadAvg: [getRandomFloat(0, 4), getRandomFloat(0, 4), getRandomFloat(0, 4)],
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
}

// generateUsers returns a list of mock user statistics.
function generateUsers() {
    return [
        { username: 'admin', cpuPercent: getRandomInt(10, 90), ramGB: getRandomFloat(2, 8), processCount: getRandomInt(10, 50), loggedIn: true },
        { username: 'dev01', cpuPercent: getRandomInt(5, 50), ramGB: getRandomFloat(1, 4), processCount: getRandomInt(5, 20), loggedIn: true },
        { username: 'dev02', cpuPercent: getRandomInt(5, 40), ramGB: getRandomFloat(1, 3), processCount: getRandomInt(3, 15), loggedIn: true },
    ];
}

// generateJobs creates a set of fake background jobs with random owners and statuses.
function generateJobs() {
    const statuses = ['RUNNING', 'QUEUED', 'DONE', 'FAILED'];
    const jobNames = ['build-service', 'test-suite', 'deploy-prod', 'data-pipeline', 'model-train'];
    const owners = ['admin', 'dev01', 'dev02'];
    return Array.from({ length: 12 }, (_, i) => ({
        id: `job-${i}`,
        name: jobNames[getRandomInt(0, jobNames.length - 1)],
        owner: owners[getRandomInt(0, owners.length - 1)],
        status: statuses[getRandomInt(0, statuses.length - 1)],
        elapsedSec: getRandomInt(0, 3600),
    }));
}

// generateAgentLog builds a short activity log for the AI agent component.
function generateAgentLog() {
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

// generateAlerts produces a few sample alerts of varying severity.
function generateAlerts() {
    return [
        { level: 'error', message: 'CPU threshold exceeded on node-03' },
        { level: 'warn', message: 'Memory usage above 80% for 5min' },
        { level: 'info', message: 'New user logged in' },
    ];
}

// ---------- Public API ----------
// fetchDashboardState is the entry point used by the UI.
// It aggregates all generated data into a single object.
function fetchDashboardState() {
    return {
        system: generateSystemStats(),
        users: generateUsers(),
        jobs: generateJobs(),
        agentLog: generateAgentLog(),
        alerts: generateAlerts(),
        cpuHistory,
    };
}

// formatUptime converts a raw second count into a human‑readable string.
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
}

// formatBytes turns a byte count into a GB string with one decimal place.
function formatBytes(bytes) {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)}GB`;
}

// formatElapsed formats a duration in seconds as M:SS.
function formatElapsed(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

