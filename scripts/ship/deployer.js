/* eslint-disable no-console */
/**
 * garment-erp-deployer — the ONLY thing that puts garment-erp code live.  (PM2 app, ecosystem.config.js)
 *
 * WHY (2026-09-26): several Claude terminals work in this one folder at once. Until today a file SAVE
 * rebuilt and restarted the live app (server/dev-watcher.js) and every COMMIT rebuilt from the files
 * on disk (.husky/post-commit) — so one terminal's commit shipped every other terminal's half-done
 * edits, two deploys could run at once, and every restart sent the other terminals off running
 * fleet checks. Now:
 *
 *   commit on main  ->  this process notices (polls refs/heads/main every 3s, waits 10s for a burst
 *   of commits to settle)  ->  checks out EXACTLY that commit in the private build folder
 *   (C:\Users\NEW\garment-erp-build)  ->  builds it there  ->  swaps the new dist/ into the live
 *   folder  ->  restarts through pm2-safe-restart  ->  checks health  ->  runs fleet-check.
 *
 * One process, one deploy at a time. Commits that land during a deploy are shipped together by the
 * next one. Uncommitted work in the shared folder is never built.
 *
 * It writes C:\Users\NEW\ops\deploy-state\garment-erp.json (see state.js) — fleet-check, the
 * safe-restart helper and the fleet watchdog read it and stand back while `state` is `deploying`.
 *
 *   node scripts/ship/deployer.js                 run forever (what PM2 does)
 *   node scripts/ship/deployer.js --once          deploy main now if it is not live, then exit
 *   node scripts/ship/deployer.js --once --dry-run   build main in the build folder, swap nothing
 *
 * Talk to it with scripts/ship/ship.js (npm run ship:status / ship:wait / ship -- now|pause|resume).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync, execSync } = require('child_process');
const S = require('./state');
const { ensureBuildTree, copyEnvFiles } = require('./setup-build-tree');
const notices = require('../hooks/notices');

/** Tell every Claude terminal (notice board) — not in a dry run. */
function announce(text, opts) {
  if (!DRY) notices.post(text, { from: 'garment-erp-deployer', ...opts });
}

const ONCE = process.argv.includes('--once');
const DRY = process.argv.includes('--dry-run');

const POLL_MS = 3000;
const SETTLE_MS = 10000;
const BUILD_TIMEOUT_MS = 15 * 60 * 1000;
const API = { app: 'garment-erp-api', port: 5000, url: 'http://127.0.0.1:5000/health' };
const WEB = { app: 'garment-erp-web', port: 3000, url: 'http://127.0.0.1:3000/' };
const SAFE_RESTART = path.join(S.OPS_DIR, 'pm2-safe-restart.js');
const FLEET_CHECK = path.join(S.OPS_DIR, 'fleet-check.js');
const LOCK_FILE = path.join(S.STATE_DIR, 'garment-erp.deployer.lock');

// What a commit has to touch for each side to need a rebuild. backend/templates is NOT here: the
// live API reads PDF templates straight from the shared folder (html-document.service.ts).
const SIDES = {
  backend: [/^backend\/src\//, /^backend\/prisma\//, /^backend\/[^/]+\.json$/],
  frontend: [/^frontend\/src\//, /^frontend\/public\//, /^frontend\/index\.html$/, /^frontend\/[^/]+\.(json|[cm]?[jt]s)$/],
  server: [/^server\/static-server\.js$/, /^server\/package(-lock)?\.json$/],
};

class StepFailure extends Error {
  constructor(message, tail) {
    super(message);
    this.tail = tail || null;
  }
}

// ---------------------------------------------------------------------------------------------
// logging + state
// ---------------------------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
function stamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function log(msg) {
  const line = `[${stamp()}]${DRY ? ' [dry-run]' : ''} ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(S.LOG_FILE), { recursive: true });
    fs.appendFileSync(S.LOG_FILE, `${line}\n`);
  } catch { /* logging must never stop a deploy */ }
}

let st = S.readState();
function save(patch) {
  st = { ...st, ...patch, app: 'garment-erp', deployerPid: process.pid, updatedAt: new Date().toISOString() };
  if (!DRY) S.writeJson(S.STATE_FILE, st);
}
function step(name) {
  log(`-- ${name}`);
  save({ step: name, stepAt: new Date().toISOString() });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => fs.existsSync(p);
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });

// ---------------------------------------------------------------------------------------------
// processes
// ---------------------------------------------------------------------------------------------
/** Run a shell command, streaming output into the deploy log. Resolves { code, tail }. */
function run(command, { cwd, env, timeoutMs = BUILD_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    log(`$ ${command}   (in ${cwd})`);
    const child = spawn(command, { cwd, env: { ...process.env, ...env }, shell: true, windowsHide: true });
    const lines = [];
    const keep = (chunk) => {
      const text = chunk.toString();
      try { fs.appendFileSync(S.LOG_FILE, text); } catch { /* ignore */ }
      if (ONCE) process.stdout.write(text); // under PM2 the deploy log has it; keep the PM2 log quiet
      lines.push(...text.split(/\r?\n/));
      if (lines.length > 400) lines.splice(0, lines.length - 400);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const timer = setTimeout(() => {
      log(`timed out after ${timeoutMs / 60000} min - killing`);
      try { execSync(`taskkill /T /F /PID ${child.pid}`, { stdio: 'ignore' }); } catch { /* ignore */ }
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code === null ? 1 : code, tail: lines.filter((l) => l.trim()).slice(-40).join('\n') });
    });
  });
}

/** Same guard as pm2-safe-restart.js: a CLI/daemon version split respawns the SHARED daemon. */
function pm2VersionsMatch() {
  let cli;
  try {
    cli = execSync('pm2 -v', { encoding: 'utf-8' }).trim().split('\n').pop().trim();
  } catch {
    return false;
  }
  try {
    const lines = fs.readFileSync(path.join(os.homedir(), '.pm2', 'pm2.log'), 'utf-8')
      .split('\n').filter((l) => l.includes('PM2 version'));
    return lines.length > 0 && lines[lines.length - 1].split(':').pop().trim() === cli;
  } catch {
    return false;
  }
}

function pm2Stop(app) {
  try {
    execSync(`pm2 stop ${app}`, { stdio: 'ignore' });
  } catch { /* already stopped */ }
}

function pm2Pid(app) {
  try {
    const out = execSync(`pm2 pid ${app}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    const line = out.split('\n').map((l) => l.trim()).find((l) => /^\d+$/.test(l));
    return line ? parseInt(line, 10) : 0;
  } catch {
    return 0;
  }
}

/** The one restart path (stop -> port free -> kill verified stale fork -> start -> owner check). */
function safeRestart(target) {
  log(`restarting ${target.app} (pm2-safe-restart)`);
  const r = spawnSync('node', [SAFE_RESTART, `${target.app}:${target.port}`], {
    env: { ...process.env, GARMENT_DEPLOYER: '1' },
    encoding: 'utf-8',
    windowsHide: true,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  try { fs.appendFileSync(S.LOG_FILE, out); } catch { /* ignore */ }
  return r.status === 0;
}

function httpGet(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (d) => { if (body.length < 200000) body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '' }); });
    req.on('error', () => resolve({ status: 0, body: '' }));
  });
}

async function waitHttp(url, timeoutMs, accept = (r) => r.status === 200) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await httpGet(url);
    if (accept(r)) return true;
    if (Date.now() > deadline) return false;
    await sleep(3000);
  }
}

/** Rename with retries — Windows holds directory handles for a moment after a process exits. */
async function renameRetry(from, to, attempts = 4) {
  for (let i = 1; i <= attempts; i++) {
    try {
      fs.renameSync(from, to);
      return true;
    } catch (e) {
      if (i === attempts) {
        log(`rename ${from} -> ${to} failed: ${e.code || e.message}`);
        return false;
      }
      await sleep(2000);
    }
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// pre-flight: refuse (BLOCKED) rather than ship something the live app cannot run
// ---------------------------------------------------------------------------------------------
function classify(changed) {
  const out = {};
  for (const [side, patterns] of Object.entries(SIDES)) {
    out[side] = changed === null || changed.some((f) => patterns.some((re) => re.test(f)));
  }
  return out;
}

/**
 * The live app runs with the SHARED folder's node_modules. If a commit changes a package-lock.json,
 * those packages must already be installed there — compare against npm's hidden lockfile.
 */
function depsProblem(side, sha) {
  let committed;
  try {
    committed = JSON.parse(S.git(['show', `${sha}:${side}/package-lock.json`])).packages || {};
  } catch {
    return null; // no lockfile for this side
  }
  let installed;
  try {
    installed = JSON.parse(fs.readFileSync(path.join(S.REPO, side, 'node_modules', '.package-lock.json'), 'utf-8')).packages || {};
  } catch {
    return `${side}/node_modules/.package-lock.json is missing`;
  }
  const bad = [];
  for (const [key, meta] of Object.entries(committed)) {
    if (!key.startsWith('node_modules/')) continue;
    const inst = installed[key];
    if (!inst) {
      if (!meta.optional && !meta.devOptional && !meta.peer) bad.push(`${key.slice(13)} missing`);
    } else if (meta.version && inst.version && meta.version !== inst.version) {
      bad.push(`${key.slice(13)} ${inst.version} installed, ${meta.version} committed`);
    }
  }
  if (!bad.length) return null;
  return `${bad.length} package(s) in ${side}/package-lock.json are not what is installed in ${side}/node_modules ` +
    `(${bad.slice(0, 3).join('; ')}${bad.length > 3 ? '; …' : ''})`;
}

/**
 * The live app also runs with the SHARED Prisma client. It may be AHEAD of the commit (a terminal
 * has migrated + generated a schema change it has not committed yet — harmless, a superset), but
 * it must not be BEHIND: every model/field/enum line of the committed schema must be in the
 * generated one.
 */
function prismaClientProblem(sha) {
  const norm = (text) => new Set(
    text.split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  );
  let committed;
  try {
    committed = norm(S.git(['show', `${sha}:backend/prisma/schema.prisma`]));
  } catch {
    return null;
  }
  // Read the schema the RUNTIME uses — the `inlineSchema` embedded in the generated index.js — not the
  // schema.prisma copy beside it: on Windows `prisma generate` often writes index.js/index.d.ts and
  // then fails with EPERM renaming the locked query engine, leaving that copy stale while the client
  // itself is current (2026-09-26: the first deploy was BLOCKED on exactly that false alarm).
  let generated;
  try {
    const src = fs.readFileSync(path.join(S.REPO, 'backend', 'node_modules', '.prisma', 'client', 'index.js'), 'utf-8');
    const at = src.indexOf('"inlineSchema"');
    const m = at < 0 ? null : src.slice(at).match(/^"inlineSchema":\s*("(?:[^"\\]|\\.)*")/);
    if (!m) return 'cannot read the inlineSchema of backend/node_modules/.prisma/client/index.js (Prisma format changed?) — check scripts/ship/deployer.js prismaClientProblem';
    generated = norm(JSON.parse(m[1]));
  } catch {
    return 'backend/node_modules/.prisma/client/index.js is missing (prisma generate never ran)';
  }
  const missing = [...committed].filter((l) => !generated.has(l));
  if (!missing.length) return null;
  return `the Prisma client in backend/node_modules is older than the committed schema.prisma ` +
    `(${missing.length} line(s) not generated, e.g. "${missing[0]}")`;
}

async function migrationsProblem() {
  const r = await run('npx prisma migrate status', { cwd: path.join(S.BUILD_DIR, 'backend'), timeoutMs: 120000 });
  if (/have not yet been applied|not yet been applied/i.test(r.tail)) {
    return `the commit contains a migration that is not applied to the database yet:\n${r.tail}`;
  }
  return null;
}

async function preflight(sha, changed, sides) {
  const problems = [];
  const lockChanged = (side) => changed === null || changed.includes(`${side}/package-lock.json`);
  for (const side of ['backend', 'frontend', 'server']) {
    if (!sides[side] || !lockChanged(side)) continue;
    const p = depsProblem(side, sha);
    if (!p) continue;
    // First deploy (changed === null): the running app already works with what is installed.
    if (changed === null) log(`note: ${p}`);
    else problems.push(p);
  }
  if (sides.backend) {
    const p = prismaClientProblem(sha);
    if (p) problems.push(p);
    if (changed === null || changed.some((f) => f.startsWith('backend/prisma/migrations/'))) {
      const m = await migrationsProblem();
      if (m) problems.push(m);
    }
  }
  return problems.length ? problems.join('\n') : null;
}

// ---------------------------------------------------------------------------------------------
// build (in the private build folder) and swap (into the live folder)
// ---------------------------------------------------------------------------------------------
async function buildBackend() {
  step('building the backend (in the build folder)');
  // Incremental, with the build info kept INSIDE the build folder: the tsconfig's own
  // tsBuildInfoFile sits in node_modules/.tmp, which is a junction shared with the working folder.
  const dir = path.join(S.BUILD_DIR, 'backend');
  const info = path.join(dir, '.deployer', 'tsconfig.tsbuildinfo');
  fs.mkdirSync(path.dirname(info), { recursive: true });
  if (!exists(path.join(dir, 'dist', 'server.js'))) rm(info); // no outputs -> force a full emit
  const r = await run(`npm run build -- --tsBuildInfoFile "${info}"`, { cwd: dir });
  if (r.code !== 0 || !exists(path.join(dir, 'dist', 'server.js'))) {
    throw new StepFailure('the backend does not compile — nothing was changed on the live app', r.tail);
  }
}

async function buildFrontend() {
  step('building the frontend (in the build folder)');
  const dir = path.join(S.BUILD_DIR, 'frontend');
  rm(path.join(dir, 'dist.next'));
  const r = await run('npm run build -- --outDir dist.next --emptyOutDir', { cwd: dir });
  if (r.code !== 0 || !exists(path.join(dir, 'dist.next', 'index.html'))) {
    rm(path.join(dir, 'dist.next'));
    throw new StepFailure('the frontend does not build — nothing was changed on the live app', r.tail);
  }
}

async function swapBackend() {
  step('putting the new backend live');
  const live = path.join(S.REPO, 'backend', 'dist');
  const next = `${live}.next`;
  const prev = `${live}.prev`;
  rm(next);
  fs.cpSync(path.join(S.BUILD_DIR, 'backend', 'dist'), next, { recursive: true });

  pm2Stop(API.app);
  rm(prev);
  const aside = !exists(live) || (await renameRetry(live, prev));
  const moved = aside && (await renameRetry(next, live));
  if (!moved) {
    if (!exists(live) && exists(prev)) await renameRetry(prev, live);
    safeRestart(API);
    throw new StepFailure('could not swap backend/dist (a file lock?) — the previous backend was put back');
  }

  if (safeRestart(API) && (await waitHttp(API.url, 90000))) {
    log('backend is up on the new build');
    return;
  }

  log('the new backend did not come up — rolling back');
  pm2Stop(API.app);
  rm(`${live}.failed`);
  if (exists(prev) && (await renameRetry(live, `${live}.failed`)) && (await renameRetry(prev, live))) {
    safeRestart(API);
    const back = await waitHttp(API.url, 90000);
    throw new StepFailure(
      `the new backend did not start (see: pm2 logs garment-erp-api --lines 80). ` +
      (back ? 'Rolled back — the previous build is live again.' : 'Rolled back, but the API is STILL not answering — needs a human.'),
    );
  }
  safeRestart(API);
  throw new StepFailure('the new backend did not start AND the rollback failed — needs a human (pm2 logs garment-erp-api)');
}

function servedIndexMatches(expected) {
  return (r) => r.status === 200 && (!expected || r.body.includes(expected));
}

async function swapFrontend() {
  step('putting the new frontend live');
  const fe = path.join(S.REPO, 'frontend');
  const dist = path.join(fe, 'dist');
  const staging = path.join(fe, 'dist.staging');
  const prev = path.join(fe, 'dist.prev');
  rm(staging);
  if (!(await renameRetry(path.join(S.BUILD_DIR, 'frontend', 'dist.next'), staging, 1))) {
    fs.cpSync(path.join(S.BUILD_DIR, 'frontend', 'dist.next'), staging, { recursive: true });
  }
  const indexHtml = fs.readFileSync(path.join(staging, 'index.html'), 'utf-8');
  const expected = (indexHtml.match(/assets\/index-[\w-]+\.js/) || [null])[0];

  // Rename the live dist aside (never delete it first), move the new one in; roll back on failure.
  // If the web server holds the folder, stop it for the swap — a few seconds of deliberate downtime
  // instead of an accidental outage (the 2026-09-01 lesson from the old post-commit hook).
  const trySwap = async (tries) => {
    rm(prev);
    if (!exists(dist)) return renameRetry(staging, dist, tries);
    if (!(await renameRetry(dist, prev, tries))) return false;
    if (await renameRetry(staging, dist, tries)) return true;
    await renameRetry(prev, dist, tries);
    return false;
  };
  let swapped = await trySwap(1);
  if (!swapped) {
    log('frontend/dist is locked by the running web app — stopping it for the swap');
    pm2Stop(WEB.app);
    await sleep(5000);
    swapped = await trySwap(3);
    safeRestart(WEB);
  }
  if (!swapped) {
    throw new StepFailure('could not swap frontend/dist (file lock) — the live app is unchanged; the new build is in frontend/dist.staging');
  }

  if (await waitHttp(WEB.url, 15000, servedIndexMatches(expected))) {
    log(`web app serves the new build (${expected})`);
    return;
  }
  log('web app not serving the new build — restarting garment-erp-web once');
  safeRestart(WEB);
  if (await waitHttp(WEB.url, 30000, servedIndexMatches(expected))) {
    log(`web app serves the new build after a restart (${expected})`);
    return;
  }
  // Not serving at all -> put the previous build back.
  if (!(await waitHttp(WEB.url, 3000))) {
    if (exists(prev)) {
      rm(`${dist}.failed`);
      pm2Stop(WEB.app);
      await renameRetry(dist, `${dist}.failed`);
      await renameRetry(prev, dist);
      safeRestart(WEB);
    }
    throw new StepFailure('the web app stopped serving after the swap — rolled back to the previous frontend (pm2 logs garment-erp-web)');
  }
  throw new StepFailure(`the web app is up but not serving the new index (${expected}) — check pm2 logs garment-erp-web`);
}

async function restartWeb() {
  step('restarting the web server (server/ changed)');
  if (!safeRestart(WEB) || !(await waitHttp(WEB.url, 30000))) {
    throw new StepFailure('garment-erp-web did not come back after a restart — pm2 logs garment-erp-web');
  }
}

function runFleetCheck() {
  const r = spawnSync('node', [FLEET_CHECK], { encoding: 'utf-8', windowsHide: true, env: { ...process.env, NO_COLOR: '1' } });
  const out = `${r.stdout || ''}${r.stderr || ''}`.replace(/\x1b\[[0-9;]*m/g, '');
  try { fs.appendFileSync(S.LOG_FILE, out); } catch { /* ignore */ }
  return r.status === 0;
}

// ---------------------------------------------------------------------------------------------
// one deploy
// ---------------------------------------------------------------------------------------------
function remember(entry) {
  return [entry, ...(st.history || [])].slice(0, 15);
}

async function deploy(sha) {
  const subject = S.subjectOf(sha);
  const wasBroken = st.state === 'failed' || st.state === 'blocked';
  const from = st.liveSha && S.tryGit(['cat-file', '-e', `${st.liveSha}^{commit}`]) !== null ? st.liveSha : null;
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  log('');
  log(`=== DEPLOY ${S.short(sha)} "${subject}"  (live: ${from ? S.short(from) : 'unknown - first deploy'}) ===`);
  if (from) {
    const commits = S.tryGit(['log', '--oneline', '-20', `${from}..${sha}`]);
    if (commits) log(`commits in this deploy:\n${commits}`);
  }
  save({
    state: 'deploying', targetSha: sha, targetSubject: subject, startedAt, finishedAt: null,
    error: null, logTail: null, attempts: st.targetSha === sha ? (st.attempts || 0) + 1 : 1,
  });

  const done = (result, patch) => {
    const finishedAt = new Date().toISOString();
    const seconds = Math.round((Date.now() - t0) / 1000);
    save({ ...patch, finishedAt, step: null, history: remember({ sha, subject, result, note: patch.error || patch.note || null, startedAt, finishedAt, seconds }) });
    return seconds;
  };

  try {
    // The old save-watcher rebuilds dist IN PLACE on every save. Running both would have two
    // writers fighting over the live dist — refuse until it is gone.
    if (!DRY && pm2Pid('garment-erp-watcher') > 0) {
      const msg = 'garment-erp-watcher is still running (it rebuilds the live app on every file save). ' +
        'Remove it first: pm2 delete garment-erp-watcher && pm2 save — then: npm run ship -- now';
      done('blocked', { state: 'blocked', failedSha: sha, error: msg });
      announce(`Deploy BLOCKED: ${msg}`);
      return log(`BLOCKED ${S.short(sha)}: ${msg}`);
    }

    step('checking what changed');
    const changed = from ? S.git(['diff', '--name-only', from, sha]).split('\n').filter(Boolean) : null;
    const sides = classify(changed);
    log(`changed: ${changed ? `${changed.length} file(s)` : 'everything (first deploy)'} -> backend=${sides.backend} frontend=${sides.frontend} webServer=${sides.server}`);

    if (!sides.backend && !sides.frontend && !sides.server) {
      if (DRY) return log('dry run: no app files changed');
      done('live', { state: 'idle', liveSha: sha, liveSubject: subject, liveAt: new Date().toISOString(), failedSha: null, attempts: 0, note: 'no app files changed' });
      return log(`LIVE ${S.short(sha)} — no app files changed, nothing to build`);
    }

    step('preparing the build folder');
    ensureBuildTree(log);
    S.git(['checkout', '--detach', '--force', sha], { cwd: S.BUILD_DIR });
    copyEnvFiles();

    step('pre-flight checks');
    const blocked = await preflight(sha, changed, sides);
    if (blocked) {
      if (DRY) return log(`dry run: would be BLOCKED:\n${blocked}`);
      done('blocked', { state: 'blocked', failedSha: sha, error: blocked });
      announce(`Deploy of ${S.short(sha)} "${subject}" is BLOCKED — the live app is unchanged: ${blocked.split('\n')[0]} ` +
        'The terminal that owns that commit: fix the cause, then `npm run ship -- now`. Details: npm run ship:status');
      return log(`BLOCKED ${S.short(sha)}:\n${blocked}`);
    }

    if (sides.backend) await buildBackend();
    if (sides.frontend) await buildFrontend();
    if (DRY) return log(`dry run: ${S.short(sha)} builds cleanly — nothing was swapped`);

    if (!pm2VersionsMatch()) {
      throw new StepFailure('pm2 CLI and daemon versions differ — refusing to touch the shared PM2 daemon (see the fleet skill)');
    }
    if (sides.backend) await swapBackend();
    if (sides.frontend) await swapFrontend();
    else if (sides.server) await restartWeb();

    const seconds = done('live', { state: 'idle', liveSha: sha, liveSubject: subject, liveAt: new Date().toISOString(), failedSha: null, attempts: 0 });
    log(`LIVE ${S.short(sha)} "${subject}" in ${seconds}s`);
    if (wasBroken) announce(`Deploys are flowing again — ${S.short(sha)} "${subject}" is live (the earlier failed/blocked deploy is resolved).`, { hours: 12 });
    log('-- fleet-check');
    const fleetOk = runFleetCheck();
    save({ fleetOk });
    log(fleetOk ? 'fleet-check clean' : 'fleet-check reported problems (see above)');
  } catch (e) {
    const failure = e instanceof StepFailure ? e : new StepFailure(`unexpected deployer error: ${e.message}`, e.stack);
    if (DRY) return log(`dry run FAILED: ${failure.message}\n${failure.tail || ''}`);
    done('failed', { state: 'failed', failedSha: sha, error: failure.message, logTail: failure.tail });
    announce(`Deploy of ${S.short(sha)} "${subject}" FAILED — ${failure.message}. ` +
      'The terminal that owns that commit: fix it and commit again (that redeploys). Others: nothing to do. Details: npm run ship:status');
    log(`FAILED ${S.short(sha)}: ${failure.message}`);
    if (failure.tail) log(`last output:\n${failure.tail}`);
  }
}

// ---------------------------------------------------------------------------------------------
// lifecycle
// ---------------------------------------------------------------------------------------------
function acquireLock() {
  fs.mkdirSync(S.STATE_DIR, { recursive: true });
  for (let i = 0; i < 2; i++) {
    try {
      fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, at: new Date().toISOString(), dryRun: DRY }), { flag: 'wx' });
      process.on('exit', () => {
        try {
          const held = S.readJson(LOCK_FILE);
          if (held && held.pid === process.pid) fs.rmSync(LOCK_FILE, { force: true });
        } catch { /* ignore */ }
      });
      for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0));
      return true;
    } catch {
      const held = S.readJson(LOCK_FILE);
      if (held && S.pidAlive(held.pid)) {
        console.error(`another deployer is already running (pid ${held.pid}) — not starting a second one`);
        return false;
      }
      fs.rmSync(LOCK_FILE, { force: true }); // leftover from a deployer that died
    }
  }
  return false;
}

/** A deployer that died mid-deploy may have left an app stopped or a dist renamed aside. */
function recoverInterrupted() {
  // We hold the deployer lock, so a `deploying` state on disk can only be a previous run's.
  if (st.state !== 'deploying') return;
  log(`the previous deploy of ${S.short(st.targetSha)} was interrupted — checking the live apps`);
  for (const rel of ['backend/dist', 'frontend/dist']) {
    const live = path.join(S.REPO, rel);
    if (!exists(live) && exists(`${live}.prev`)) {
      fs.renameSync(`${live}.prev`, live);
      log(`restored ${rel} from ${rel}.prev`);
    }
  }
  if (pm2VersionsMatch()) {
    for (const t of [API, WEB]) if (!pm2Pid(t.app)) safeRestart(t);
  }
  if ((st.attempts || 0) >= 2) {
    save({ state: 'failed', failedSha: st.targetSha, error: 'the deploy was interrupted twice — not retrying by itself (npm run ship -- now to retry)', step: null });
  } else {
    save({ state: 'idle', step: null });
  }
}

async function main() {
  if (!acquireLock()) process.exit(1);
  const firstEver = !S.readJson(S.STATE_FILE);
  if (!DRY) recoverInterrupted();
  if (firstEver && !ONCE) {
    announce(
      'SWITCHOVER DONE: garment-erp-deployer is now the only thing that puts code live. Only COMMITTED code on main ships, one ' +
      'deploy at a time; saving a file no longer deploys (garment-erp-watcher is retired). Uncommitted edits are NOT on the live ' +
      'app any more — commit your finished work by name (git commit -m "..." -- <your files>), then `npm run ship:wait`. ' +
      'Never build in backend/ or frontend/. API restarts during a deploy are expected — `npm run ship:status` before any fleet check.',
      { sticky: true, hours: 72 },
    );
  }
  save({ deployerStartedAt: new Date().toISOString() });
  log(`deployer started (pid ${process.pid}${ONCE ? ', --once' : ''}${DRY ? ', --dry-run' : ''}); live is ${S.short(st.liveSha)}`);

  if (ONCE) {
    const head = S.mainSha();
    if (head && (head !== st.liveSha || DRY)) await deploy(head);
    else log('main is already live — nothing to do');
    return;
  }

  let seenHead = null;
  let seenAt = 0;
  for (;;) {
    try {
      const head = S.mainSha();
      if (head && head !== seenHead) {
        seenHead = head;
        seenAt = Date.now();
      }
      if (exists(S.RETRY_FILE)) {
        fs.rmSync(S.RETRY_FILE, { force: true });
        if (st.state === 'failed' || st.state === 'blocked') {
          log(`retry requested for ${S.short(st.failedSha)}`);
          save({ state: 'idle', failedSha: null, error: null, attempts: 0 });
        }
        seenAt = 0; // skip the settle wait
      }
      const stuck = (st.state === 'failed' || st.state === 'blocked') && st.failedSha === head;
      if (head && head !== st.liveSha && !stuck && !S.readPause() && Date.now() - seenAt >= SETTLE_MS) {
        await deploy(head);
      }
    } catch (e) {
      log(`deployer loop error: ${e.stack || e.message}`);
    }
    await sleep(POLL_MS);
  }
}

main().then(() => process.exit(0), (e) => {
  log(`deployer crashed: ${e.stack || e.message}`);
  process.exit(1);
});
