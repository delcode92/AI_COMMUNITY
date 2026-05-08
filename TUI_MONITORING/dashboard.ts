import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { fetchDashboardState, formatUptime, formatBytes, formatElapsed } from './data';
import { DashboardState, UserStats, Job } from './types';
import { THEME, ICONS } from './theme';

// ─── SCREEN SETUP ─────────────────────────────────────────────────────────
const screen = new blessed.screen({
  smartCSR: true,
  fullUnicode: true,
  title: 'CYBERLAB // MISSION CONTROL',
});

screen.key(['q', 'C-c'], () => process.exit(0));

// ─── LAYOUT GRID (blessed-contrib) ────────────────────────────────────────
const grid = new contrib.grid({ rows: 12, cols: 12, screen });

// ─── HELPERS ──────────────────────────────────────────────────────────────
const boxStyle = {
  border: { type: 'line', fg: THEME.borderFg },
  style: {
    fg: 'white',
    bg: THEME.bg,
    border: { fg: THEME.borderFg },
    label: { fg: THEME.info, bold: true },
  },
};

function barGauge(pct: number, width = 16): string {
  const filled = Math.round((pct / 100) * width);
  const empty  = width - filled;
  const color  = pct > 80 ? '\x1b[31m' : pct > 60 ? '\x1b[33m' : '\x1b[36m';
  return `${color}${'█'.repeat(filled)}\x1b[90m${'░'.repeat(empty)}\x1b[0m`;
}

function padR(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}
function padL(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s;
}

function jobStatusTag(status: string): string {
  switch (status) {
    case 'RUNNING': return `{green-fg}${ICONS.running}{/green-fg}`;
    case 'QUEUED':  return `{yellow-fg}${ICONS.queued}{/yellow-fg}`;
    case 'DONE':    return `{cyan-fg}${ICONS.done}{/cyan-fg}`;
    case 'FAILED':  return `{red-fg}${ICONS.failed}{/red-fg}`;
    default:        return '?';
  }
}

// ─── PANEL 1: HEADER BAR (row 0, full width) ──────────────────────────────
const header = grid.set(0, 0, 1, 12, blessed.box, {
  tags: true,
  style: { fg: 'black', bg: 'cyan', bold: true },
});

// ─── PANEL 2: SYSTEM OVERVIEW (row 1-3, col 0-5) ─────────────────────────
const sysBox = grid.set(1, 0, 3, 6, blessed.box, {
  label: '  SYSTEM  ',
  tags: true,
  padding: { left: 1 },
  ...boxStyle,
});

// ─── PANEL 3: CPU SPARKLINE (row 1-3, col 6-11) ──────────────────────────
const cpuSpark = grid.set(1, 6, 3, 6, contrib.sparkline, {
  label: '  CPU HISTORY  ',
  tags: true,
  style: {
    fg: THEME.sparkline,
    titleFg: THEME.sparklineLbl,
    border: { fg: THEME.borderFg },
  },
});

// ─── PANEL 4: USERS (row 4-6, col 0-5) ───────────────────────────────────
const usersBox = grid.set(4, 0, 3, 5, blessed.box, {
  label: '  USERS  ',
  tags: true,
  padding: { left: 1 },
  ...boxStyle,
});

// ─── PANEL 5: JOB QUEUE (row 4-6, col 5-11) ──────────────────────────────
const jobsBox = grid.set(4, 5, 3, 7, blessed.box, {
  label: '  JOB QUEUE  ',
  tags: true,
  padding: { left: 1 },
  ...boxStyle,
});

// ─── PANEL 6: AI AGENT LOG (row 7-9, col 0-7) ────────────────────────────
const agentBox = grid.set(7, 0, 3, 7, blessed.box, {
  label: '  AI AGENT LOG  ',
  tags: true,
  padding: { left: 1 },
  ...boxStyle,
});

// ─── PANEL 7: ALERTS (row 7-9, col 7-11) ─────────────────────────────────
const alertsBox = grid.set(7, 7, 3, 5, blessed.box, {
  label: '  ALERTS  ',
  tags: true,
  padding: { left: 1 },
  ...boxStyle,
});

// ─── PANEL 8: NETWORK (row 10-11, col 0-5) ───────────────────────────────
const netBox = grid.set(10, 0, 2, 5, blessed.box, {
  label: '  NETWORK  ',
  tags: true,
  padding: { left: 1 },
  ...boxStyle,
});

// ─── PANEL 9: STATUS BAR (row 10-11, col 5-11) ───────────────────────────
const statusBar = grid.set(10, 5, 2, 7, blessed.box, {
  label: '  QUICK STATS  ',
  tags: true,
  padding: { left: 1 },
  ...boxStyle,
});

// ─── RENDER FUNCTION ──────────────────────────────────────────────────────
function render(state: DashboardState) {
  const { system: sys, users, jobs, agentLog, alerts } = state;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // ── HEADER ────────────────────────────────────────────────────────────
  const uptime = formatUptime(sys.uptime);
  header.setContent(
    `  ⬡ CYBERLAB // MISSION CONTROL` +
    `    uptime: ${uptime}` +
    `    ${now} UTC` +
    `    [q] quit`
  );

  // ── SYSTEM ────────────────────────────────────────────────────────────
  const cpuColor = sys.cpuTotal > 80 ? 'red' : sys.cpuTotal > 60 ? 'yellow' : 'cyan';
  const ramColor = sys.ramPercent > 80 ? 'red' : sys.ramPercent > 60 ? 'yellow' : 'cyan';

  const coreLines = sys.cpuPercent.map((c, i) =>
    `  {cyan-fg}cpu${i}{/cyan-fg}  ${barGauge(c, 14)}  {${cpuColor}-fg}${padL(String(c), 2)}%{/${cpuColor}-fg}`
  ).join('\n');

  sysBox.setContent(
    `{cyan-fg}CPU{/cyan-fg}  {bold}{${cpuColor}-fg}${sys.cpuTotal}%{/${cpuColor}-fg}{/bold}   load: {white-fg}${sys.loadAvg.join('  ')}{/white-fg}\n` +
    coreLines + '\n\n' +
    `{cyan-fg}RAM{/cyan-fg}  ${barGauge(sys.ramPercent, 20)}  ` +
    `{${ramColor}-fg}${sys.ramUsed}GB{/${ramColor}-fg}{white-fg} / ${sys.ramTotal}GB{/white-fg}\n` +
    `{cyan-fg}SWP{/cyan-fg}  ${barGauge(sys.swapPercent, 20)}  ` +
    `{white-fg}${sys.swapUsed}GB / ${sys.swapTotal}GB{/white-fg}`
  );

  // ── CPU SPARKLINE ─────────────────────────────────────────────────────
  cpuSpark.setData(
    ['CPU %'],
    [state.cpuHistory]
  );

  // ── USERS ─────────────────────────────────────────────────────────────
  const USER_COLORS = ['cyan', 'magenta', 'yellow'];
  const userLines = users.map((u: UserStats, i: number) => {
    const c = USER_COLORS[i % USER_COLORS.length];
    const cpuC = u.cpuPercent > 60 ? 'red' : u.cpuPercent > 40 ? 'yellow' : 'green';
    const ramC = (u.ramGB / sys.ramTotal * 100) > 60 ? 'yellow' : 'green';
    const running = jobs.filter(j => j.owner === u.username && j.status === 'RUNNING').length;
    const queued  = jobs.filter(j => j.owner === u.username && j.status === 'QUEUED').length;
    return (
      `  {${c}-fg}${ICONS.bullet} ${padR(u.username, 8)}{/${c}-fg}` +
      `  cpu {${cpuC}-fg}${padL(String(u.cpuPercent), 3)}%{/${cpuC}-fg}` +
      `  ram {${ramC}-fg}${u.ramGB}G{/${ramC}-fg}` +
      `  proc {white-fg}${u.processCount}{/white-fg}` +
      `  jobs {green-fg}${running}▶{/green-fg}{yellow-fg}${queued}⧗{/yellow-fg}`
    );
  }).join('\n');

  usersBox.setContent('\n' + userLines);

  // ── JOB QUEUE ─────────────────────────────────────────────────────────
  const jobLines = jobs.slice(0, 8).map((j: Job) => {
    const ownerC = users.findIndex(u => u.username === j.owner);
    const oc = USER_COLORS[ownerC % USER_COLORS.length] || 'white';
    const elapsed = j.elapsedSec ? `{white-fg}${formatElapsed(j.elapsedSec)}{/white-fg}` : '';
    return (
      `  ${jobStatusTag(j.status)}  ` +
      `{${oc}-fg}${padR(j.owner, 7)}{/${oc}-fg}` +
      `  {white-fg}${padR(j.name, 22)}{/white-fg}` +
      `  ${elapsed}`
    );
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
    const [icon, col] =
      a.level === 'error' ? [ICONS.error, 'red'] :
      a.level === 'warn'  ? [ICONS.warn,  'yellow'] :
                            [ICONS.ok,    'green'];
    return `  {${col}-fg}${icon}{/${col}-fg}  {white-fg}${a.message}{/white-fg}`;
  }).join('\n');

  alertsBox.setContent('\n' + alertLines);

  // ── NETWORK ───────────────────────────────────────────────────────────
  netBox.setContent(
    `\n  {cyan-fg}${ICONS.up}{/cyan-fg}  {white-fg}${formatBytes(sys.networkSent)}{/white-fg}` +
    `   {cyan-fg}${ICONS.down}{/cyan-fg}  {white-fg}${formatBytes(sys.networkRecv)}{/white-fg}\n\n` +
    `  {cyan-fg}CONN{/cyan-fg}  {white-fg}${sys.connections} active{/white-fg}\n` +
    `  {cyan-fg}IFACE{/cyan-fg} {white-fg}eth0{/white-fg}`
  );

  // ── QUICK STATS ───────────────────────────────────────────────────────
  const runCount   = jobs.filter(j => j.status === 'RUNNING').length;
  const queueCount = jobs.filter(j => j.status === 'QUEUED').length;
  const loggedIn   = users.filter(u => u.loggedIn).map(u => u.username).join('  ');

  statusBar.setContent(
    `\n  {cyan-fg}RUNNING{/cyan-fg}  {green-fg}${runCount}{/green-fg}` +
    `   {cyan-fg}QUEUED{/cyan-fg}  {yellow-fg}${queueCount}{/yellow-fg}` +
    `   {cyan-fg}USERS{/cyan-fg}  {white-fg}${users.length}{/white-fg}\n\n` +
    `  {cyan-fg}ONLINE{/cyan-fg}  {white-fg}${loggedIn}{/white-fg}`
  );

  screen.render();
}

// ─── MAIN LOOP ────────────────────────────────────────────────────────────
function start() {
  render(fetchDashboardState());
  setInterval(() => {
    render(fetchDashboardState());
  }, 1000);
}

start();
