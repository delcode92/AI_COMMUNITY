"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const blessed_1 = __importDefault(require("blessed"));
const blessed_contrib_1 = __importDefault(require("blessed-contrib"));
const data_1 = require("./data");
const theme_1 = require("./theme");
// ─── SCREEN SETUP ─────────────────────────────────────────────────────────
const screen = new blessed_1.default.screen({
    smartCSR: true,
    fullUnicode: true,
    title: 'CYBERLAB // MISSION CONTROL',
});
screen.key(['q', 'C-c'], () => process.exit(0));
// ─── LAYOUT GRID (blessed-contrib) ────────────────────────────────────────
const grid = new blessed_contrib_1.default.grid({ rows: 12, cols: 12, screen });
// ─── HELPERS ──────────────────────────────────────────────────────────────
const boxStyle = {
    border: { type: 'line', fg: theme_1.THEME.borderFg },
    style: {
        fg: 'white',
        bg: theme_1.THEME.bg,
        border: { fg: theme_1.THEME.borderFg },
        label: { fg: theme_1.THEME.info, bold: true },
    },
};
function barGauge(pct, width = 16) {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    const color = pct > 80 ? '\x1b[31m' : pct > 60 ? '\x1b[33m' : '\x1b[36m';
    return `${color}${'█'.repeat(filled)}\x1b[90m${'░'.repeat(empty)}\x1b[0m`;
}
function padR(s, n) {
    return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}
function padL(s, n) {
    return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s;
}
function jobStatusTag(status) {
    switch (status) {
        case 'RUNNING': return `{green-fg}${theme_1.ICONS.running}{/green-fg}`;
        case 'QUEUED': return `{yellow-fg}${theme_1.ICONS.queued}{/yellow-fg}`;
        case 'DONE': return `{cyan-fg}${theme_1.ICONS.done}{/cyan-fg}`;
        case 'FAILED': return `{red-fg}${theme_1.ICONS.failed}{/red-fg}`;
        default: return '?';
    }
}
// ─── PANEL 1: HEADER BAR (row 0, full width) ──────────────────────────────
const header = grid.set(0, 0, 1, 12, blessed_1.default.box, {
    tags: true,
    style: { fg: 'black', bg: 'cyan', bold: true },
});
// ─── PANEL 2: SYSTEM OVERVIEW (row 1-3, col 0-5) ─────────────────────────
const sysBox = grid.set(1, 0, 3, 6, blessed_1.default.box, {
    label: '  SYSTEM  ',
    tags: true,
    padding: { left: 1 },
    ...boxStyle,
});
// ─── PANEL 3: CPU SPARKLINE (row 1-3, col 6-11) ──────────────────────────
const cpuSpark = grid.set(1, 6, 3, 6, blessed_contrib_1.default.sparkline, {
    label: '  CPU HISTORY  ',
    tags: true,
    style: {
        fg: theme_1.THEME.sparkline,
        titleFg: theme_1.THEME.sparklineLbl,
        border: { fg: theme_1.THEME.borderFg },
    },
});
// ─── PANEL 4: USERS (row 4-6, col 0-5) ───────────────────────────────────
const usersBox = grid.set(4, 0, 3, 5, blessed_1.default.box, {
    label: '  USERS  ',
    tags: true,
    padding: { left: 1 },
    ...boxStyle,
});
// ─── PANEL 5: JOB QUEUE (row 4-6, col 5-11) ──────────────────────────────
const jobsBox = grid.set(4, 5, 3, 7, blessed_1.default.box, {
    label: '  JOB QUEUE  ',
    tags: true,
    padding: { left: 1 },
    ...boxStyle,
});
// ─── PANEL 6: AI AGENT LOG (row 7-9, col 0-7) ────────────────────────────
const agentBox = grid.set(7, 0, 3, 7, blessed_1.default.box, {
    label: '  AI AGENT LOG  ',
    tags: true,
    padding: { left: 1 },
    ...boxStyle,
});
// ─── PANEL 7: ALERTS (row 7-9, col 7-11) ─────────────────────────────────
const alertsBox = grid.set(7, 7, 3, 5, blessed_1.default.box, {
    label: '  ALERTS  ',
    tags: true,
    padding: { left: 1 },
    ...boxStyle,
});
// ─── PANEL 8: NETWORK (row 10-11, col 0-5) ───────────────────────────────
const netBox = grid.set(10, 0, 2, 5, blessed_1.default.box, {
    label: '  NETWORK  ',
    tags: true,
    padding: { left: 1 },
    ...boxStyle,
});
// ─── PANEL 9: STATUS BAR (row 10-11, col 5-11) ───────────────────────────
const statusBar = grid.set(10, 5, 2, 7, blessed_1.default.box, {
    label: '  QUICK STATS  ',
    tags: true,
    padding: { left: 1 },
    ...boxStyle,
});
// ─── RENDER FUNCTION ──────────────────────────────────────────────────────
function render(state) {
    const { system: sys, users, jobs, agentLog, alerts } = state;
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    // ── HEADER ────────────────────────────────────────────────────────────
    const uptime = (0, data_1.formatUptime)(sys.uptime);
    header.setContent(`  ⬡ CYBERLAB // MISSION CONTROL` +
        `    uptime: ${uptime}` +
        `    ${now} UTC` +
        `    [q] quit`);
    // ── SYSTEM ────────────────────────────────────────────────────────────
    const cpuColor = sys.cpuTotal > 80 ? 'red' : sys.cpuTotal > 60 ? 'yellow' : 'cyan';
    const ramColor = sys.ramPercent > 80 ? 'red' : sys.ramPercent > 60 ? 'yellow' : 'cyan';
    const coreLines = sys.cpuPercent.map((c, i) => `  {cyan-fg}cpu${i}{/cyan-fg}  ${barGauge(c, 14)}  {${cpuColor}-fg}${padL(String(c), 2)}%{/${cpuColor}-fg}`).join('\n');
    sysBox.setContent(`{cyan-fg}CPU{/cyan-fg}  {bold}{${cpuColor}-fg}${sys.cpuTotal}%{/${cpuColor}-fg}{/bold}   load: {white-fg}${sys.loadAvg.join('  ')}{/white-fg}\n` +
        coreLines + '\n\n' +
        `{cyan-fg}RAM{/cyan-fg}  ${barGauge(sys.ramPercent, 20)}  ` +
        `{${ramColor}-fg}${sys.ramUsed}GB{/${ramColor}-fg}{white-fg} / ${sys.ramTotal}GB{/white-fg}\n` +
        `{cyan-fg}SWP{/cyan-fg}  ${barGauge(sys.swapPercent, 20)}  ` +
        `{white-fg}${sys.swapUsed}GB / ${sys.swapTotal}GB{/white-fg}`);
    // ── CPU SPARKLINE ─────────────────────────────────────────────────────
    cpuSpark.setData(['CPU %'], [state.cpuHistory]);
    // ── USERS ─────────────────────────────────────────────────────────────
    const USER_COLORS = ['cyan', 'magenta', 'yellow'];
    const userLines = users.map((u, i) => {
        const c = USER_COLORS[i % USER_COLORS.length];
        const cpuC = u.cpuPercent > 60 ? 'red' : u.cpuPercent > 40 ? 'yellow' : 'green';
        const ramC = (u.ramGB / sys.ramTotal * 100) > 60 ? 'yellow' : 'green';
        const running = jobs.filter(j => j.owner === u.username && j.status === 'RUNNING').length;
        const queued = jobs.filter(j => j.owner === u.username && j.status === 'QUEUED').length;
        return (`  {${c}-fg}${theme_1.ICONS.bullet} ${padR(u.username, 8)}{/${c}-fg}` +
            `  cpu {${cpuC}-fg}${padL(String(u.cpuPercent), 3)}%{/${cpuC}-fg}` +
            `  ram {${ramC}-fg}${u.ramGB}G{/${ramC}-fg}` +
            `  proc {white-fg}${u.processCount}{/white-fg}` +
            `  jobs {green-fg}${running}▶{/green-fg}{yellow-fg}${queued}⧗{/yellow-fg}`);
    }).join('\n');
    usersBox.setContent('\n' + userLines);
    // ── JOB QUEUE ─────────────────────────────────────────────────────────
    const jobLines = jobs.slice(0, 8).map((j) => {
        const ownerC = users.findIndex(u => u.username === j.owner);
        const oc = USER_COLORS[ownerC % USER_COLORS.length] || 'white';
        const elapsed = j.elapsedSec ? `{white-fg}${(0, data_1.formatElapsed)(j.elapsedSec)}{/white-fg}` : '';
        return (`  ${jobStatusTag(j.status)}  ` +
            `{${oc}-fg}${padR(j.owner, 7)}{/${oc}-fg}` +
            `  {white-fg}${padR(j.name, 22)}{/white-fg}` +
            `  ${elapsed}`);
    }).join('\n');
    jobsBox.setContent('\n' + jobLines);
    // ── AI AGENT LOG ──────────────────────────────────────────────────────
    const agentLines = agentLog.map(e => {
        const i = users.findIndex(u => u.username === e.owner);
        const oc = USER_COLORS[i % USER_COLORS.length] || 'white';
        return `  {${oc}-fg}[${padR(e.owner, 5)}]{/${oc}-fg}  {white-fg}${e.message}{/white-fg}`;
    }).join('\n');
    agentBox.setContent('\n' + agentLines + '\n\n  {cyan-fg}[agent]{/cyan-fg}  {white-fg}Polling queue...{/white-fg}');
    // ── ALERTS ────────────────────────────────────────────────────────────
    const alertLines = alerts.map(a => {
        const [icon, col] = a.level === 'error' ? [theme_1.ICONS.error, 'red'] :
            a.level === 'warn' ? [theme_1.ICONS.warn, 'yellow'] :
                [theme_1.ICONS.ok, 'green'];
        return `  {${col}-fg}${icon}{/${col}-fg}  {white-fg}${a.message}{/white-fg}`;
    }).join('\n');
    alertsBox.setContent('\n' + alertLines);
    // ── NETWORK ───────────────────────────────────────────────────────────
    netBox.setContent(`\n  {cyan-fg}${theme_1.ICONS.up}{/cyan-fg}  {white-fg}${(0, data_1.formatBytes)(sys.networkSent)}{/white-fg}` +
        `   {cyan-fg}${theme_1.ICONS.down}{/cyan-fg}  {white-fg}${(0, data_1.formatBytes)(sys.networkRecv)}{/white-fg}\n\n` +
        `  {cyan-fg}CONN{/cyan-fg}  {white-fg}${sys.connections} active{/white-fg}\n` +
        `  {cyan-fg}IFACE{/cyan-fg} {white-fg}eth0{/white-fg}`);
    // ── QUICK STATS ───────────────────────────────────────────────────────
    const runCount = jobs.filter(j => j.status === 'RUNNING').length;
    const queueCount = jobs.filter(j => j.status === 'QUEUED').length;
    const loggedIn = users.filter(u => u.loggedIn).map(u => u.username).join('  ');
    statusBar.setContent(`\n  {cyan-fg}RUNNING{/cyan-fg}  {green-fg}${runCount}{/green-fg}` +
        `   {cyan-fg}QUEUED{/cyan-fg}  {yellow-fg}${queueCount}{/yellow-fg}` +
        `   {cyan-fg}USERS{/cyan-fg}  {white-fg}${users.length}{/white-fg}\n\n` +
        `  {cyan-fg}ONLINE{/cyan-fg}  {white-fg}${loggedIn}{/white-fg}`);
    screen.render();
}
// ─── MAIN LOOP ────────────────────────────────────────────────────────────
function start() {
    render((0, data_1.fetchDashboardState)());
    setInterval(() => {
        render((0, data_1.fetchDashboardState)());
    }, 1000);
}
start();
