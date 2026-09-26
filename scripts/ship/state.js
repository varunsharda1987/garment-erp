/* eslint-disable no-console */
/**
 * Shared state for the garment-erp deployer — read by `ship.js`, written ONLY by `deployer.js`.
 *
 * Why a file and not a lock: several things restart the live apps (the deployer, the fleet
 * doctor's pm2-safe-restart, the 5-minute fleet watchdog). Each of them reads this one file to
 * learn "a deploy is in progress — restarts are expected, keep your hands off". Those readers live
 * outside this repo (C:\Users\NEW\ops\fleet-check.js, pm2-safe-restart.js and
 * kasya-b2b-sales/backend/scripts/fleet-watchdog.ps1) and parse the JSON themselves, so keep the
 * field names below stable: `state`, `deployerPid`, `startedAt`, `targetSha`, `liveSha`.
 *
 * Single writer: only the deployer writes STATE_FILE. The CLI talks to the deployer through two
 * flag files (PAUSE_FILE, RETRY_FILE), so a `ship pause` can never be overwritten by a deploy that
 * finishes a second later.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const BUILD_DIR = path.join(path.dirname(REPO), `${path.basename(REPO)}-build`);
const OPS_DIR = 'C:\\Users\\NEW\\ops';
const STATE_DIR = path.join(OPS_DIR, 'deploy-state');
const STATE_FILE = path.join(STATE_DIR, 'garment-erp.json');
const PAUSE_FILE = path.join(STATE_DIR, 'garment-erp.paused.json');
const RETRY_FILE = path.join(STATE_DIR, 'garment-erp.retry.json');
const LOG_FILE = path.join(OPS_DIR, 'logs', 'garment-erp-deploy.log');

// A `deploying` state older than this (or whose deployer pid is gone) is a leftover, not a deploy.
const STALE_DEPLOY_MS = 20 * 60 * 1000;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

/** Write JSON atomically: readers never see a half-written file. */
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  const text = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmp, text);
  // On Windows a rename over a file another process has open (a PowerShell reader, say) can fail
  // with EPERM for a moment. Retry briefly, then fall back to a plain write.
  for (let i = 0; i < 5; i++) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  fs.writeFileSync(file, text);
  fs.rmSync(tmp, { force: true });
}

function readState() {
  return readJson(STATE_FILE) || { app: 'garment-erp', state: 'idle', liveSha: null, history: [] };
}

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/** True while a deploy is genuinely running (not a leftover from a deployer that died). */
function isDeployActive(st) {
  if (!st || st.state !== 'deploying') return false;
  if (!pidAlive(st.deployerPid)) return false;
  const started = Date.parse(st.startedAt || '');
  return Number.isFinite(started) && Date.now() - started < STALE_DEPLOY_MS;
}

function readPause() {
  return readJson(PAUSE_FILE);
}

function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: opts.cwd || REPO,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function tryGit(args, opts) {
  try {
    return git(args, opts);
  } catch {
    return null;
  }
}

function mainSha() {
  return tryGit(['rev-parse', '--verify', 'refs/heads/main']);
}

function subjectOf(sha) {
  return tryGit(['log', '-1', '--format=%s', sha]) || '';
}

/** Is `ancestor` contained in `descendant`? (equal counts) */
function isAncestor(ancestor, descendant) {
  if (!ancestor || !descendant) return false;
  if (ancestor === descendant) return true;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: REPO,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function short(sha) {
  return sha ? sha.slice(0, 8) : '—';
}

function tailFile(file, lines) {
  try {
    const text = fs.readFileSync(file, 'utf-8');
    return text.split(/\r?\n/).slice(-lines).join('\n');
  } catch {
    return '';
  }
}

module.exports = {
  REPO,
  BUILD_DIR,
  OPS_DIR,
  STATE_DIR,
  STATE_FILE,
  PAUSE_FILE,
  RETRY_FILE,
  LOG_FILE,
  STALE_DEPLOY_MS,
  readJson,
  writeJson,
  readState,
  readPause,
  pidAlive,
  isDeployActive,
  git,
  tryGit,
  mainSha,
  subjectOf,
  isAncestor,
  short,
  tailFile,
};
