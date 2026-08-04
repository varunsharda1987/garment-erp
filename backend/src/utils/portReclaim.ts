// Self-heal for the Windows PM2 kill-race: a pm2 restart can orphan the previous fork of
// THIS app — still alive, still bound to our port, invisible to PM2 — while PM2
// crash-loops the replacement with EADDRINUSE. This module finds the process holding a
// port and, ONLY if it is provably a stale PM2 fork (node.exe running
// pm2\lib\ProcessContainerFork.js), tree-kills it so the tracked copy can bind.
// (Same logic as kasya-b2b/label-harleen portReclaim.ts, adapted to this logger.)
import { execFile } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { logError, logWarn } from './logger';

const execFileAsync = promisify(execFile);

export type ReclaimResult = 'reclaimed' | 'no-owner' | 'refused';

// Cross-generation rate limit (file survives our own restarts): when PM2's slot
// bookkeeping is INVERTED (post kill-race storm, tracked pid is always one generation
// behind the bound fork), every new fork would "reclaim" from the previous healthy one
// forever - a self-sustaining kill-loop. After 3 reclaims per 5 min we stop reclaiming and
// exit, so min_uptime/max_restarts trips the slot to errored and the watchdog realigns it
// with a clean stop -> free port -> start.
const RECLAIM_WINDOW_MS = 5 * 60_000;
const RECLAIM_MAX = 3;

function historyFile(port: number): string {
  return join(tmpdir(), `port-reclaim-${port}.json`);
}

function loadReclaimHistory(port: number, now: number): number[] {
  try {
    const arr: unknown = JSON.parse(readFileSync(historyFile(port), 'utf8'));
    if (!Array.isArray(arr)) return [];
    return arr.filter((t): t is number => typeof t === 'number' && now - t < RECLAIM_WINDOW_MS);
  } catch {
    return [];
  }
}

function saveReclaimHistory(port: number, history: number[]): void {
  try {
    writeFileSync(historyFile(port), JSON.stringify(history));
  } catch {
    /* best effort */
  }
}

async function ps(command: string): Promise<string> {
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    timeout: 15000,
    windowsHide: true,
  });
  return stdout.trim();
}

// Locale-proof port→PID lookup (never parse netstat text output).
async function getPortOwner(port: number): Promise<number> {
  const out = await ps(
    `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)`
  );
  const pid = parseInt(out, 10);
  return Number.isFinite(pid) && pid > 0 ? pid : 0;
}

export async function reclaimPort(port: number): Promise<ReclaimResult> {
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`reclaimPort: invalid port ${port}`);
  }
  const owner = await getPortOwner(port);
  if (owner === 0) return 'no-owner';
  // Our own command line is ALSO ProcessContainerFork.js, so the self-guard must be
  // PID-based; ppid guards the PM2 daemon, low pids guard System/Idle.
  if (owner <= 4 || owner === process.pid || owner === process.ppid) {
    logError(`Port ${port} owner pid=${owner} is self/daemon/system - refusing to kill`);
    return 'refused';
  }
  const info = await ps(
    `Get-CimInstance Win32_Process -Filter "ProcessId=${owner}" | ForEach-Object { $_.Name + '|' + $_.CommandLine }`
  );
  if (!info) return 'no-owner'; // holder died in the meantime
  const sep = info.indexOf('|');
  const name = (sep >= 0 ? info.slice(0, sep) : info).trim().toLowerCase();
  const cmdline = sep >= 0 ? info.slice(sep + 1) : '';
  const isStaleFork = name === 'node.exe' && /pm2[\\/]lib[\\/]ProcessContainerFork\.js/i.test(cmdline);
  if (!isStaleFork) {
    logError(`Port ${port} is held by a foreign process pid=${owner} (${name}: ${cmdline}) - refusing to kill`);
    return 'refused';
  }
  const now = Date.now();
  const history = loadReclaimHistory(port, now);
  if (history.length >= RECLAIM_MAX) {
    logError(
      `Port ${port}: ${history.length} reclaims in the last 5 min - PM2 bookkeeping looks inverted ` +
        '(each new fork killing the previous healthy one). Not killing again; exiting so PM2 trips ' +
        'to errored and the watchdog realigns the slot with stop -> start.'
    );
    return 'refused';
  }
  history.push(now);
  saveReclaimHistory(port, history);
  // PID-reuse guard: the port owner must still be the same pid right before the kill.
  if ((await getPortOwner(port)) !== owner) return 'no-owner';
  logWarn(`Port ${port} held by stale PM2 fork pid=${owner} - tree-killing it`);
  // /T: take the fork's children (e.g. its WhatsApp Chromium) down with it.
  await execFileAsync('taskkill', ['/T', '/F', '/PID', String(owner)], {
    timeout: 15000,
    windowsHide: true,
  });
  for (let i = 0; i < 6; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if ((await getPortOwner(port)) === 0) return 'reclaimed';
  }
  logError(`Port ${port} still bound after killing pid=${owner}`);
  return 'refused';
}
