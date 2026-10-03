/* eslint-disable no-console */
/**
 * garment-erp-api supervisor — restarts the API onto a new build WITHOUT dropping anyone.
 *
 * Until 2026-10-03 every backend deploy stopped the API, swapped backend/dist and started it again:
 * 27 s (up to 95 s) of "not responding", 79 times in one working week. Now PM2 runs THIS file (still
 * one fork-mode PM2 process, no cluster mode, no pm2 reload). It holds port 5000 and runs the API as
 * a Node `cluster` worker. A deploy copies the new build to backend/dist-<sha> and asks for a switch:
 *
 *   1. a new worker starts on the new build (the old one keeps serving);
 *   2. it reports {type:'api-ready'} once it listens — a broken build never gets this far, is
 *      killed, and the old worker simply carries on;
 *   3. the old worker gets {type:'drain'}: it stops taking connections, finishes what it is doing
 *      (up to 120 s, the request timeout) and exits.
 *
 * A build folder is never touched while a worker runs from it: the API loads modules lazily
 * (`await import(...)`), so an old worker must keep its own files.
 *
 * Control (127.0.0.1 only, token in the state file):  GET /status   POST /switch?build=dist-<sha>
 * The deployer (scripts/ship/deployer.js) is the only caller.
 */
const cluster = require('cluster');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const BACKEND = path.resolve(process.env.API_BACKEND_DIR || path.join(__dirname, '..', 'backend'));
const POINTER = path.join(BACKEND, '.live-build');
const STATE_DIR = process.env.API_SUPERVISOR_STATE_DIR || 'C:\\Users\\NEW\\ops\\deploy-state';
const STATE_FILE = path.join(STATE_DIR, process.env.API_SUPERVISOR_STATE_NAME || 'garment-erp.api-supervisor.json');
const CONTROL_PORT = Number(process.env.API_SUPERVISOR_PORT || 5099);
const READY_TIMEOUT_MS = 90 * 1000;
const DRAIN_TIMEOUT_MS = 130 * 1000;
const STOP_TIMEOUT_MS = 20 * 1000;
const MEMORY_LIMIT_BYTES = 1024 * 1024 * 1024;
const BUILD_RE = /^dist(-[0-9a-f]{7,40})?$/;

const token = crypto.randomBytes(24).toString('hex');
const startedAt = new Date().toISOString();

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const log = (msg) => console.log(`[supervisor ${stamp()}] ${msg}`);

/** { worker, build, readyAt, startedAt } */
let current = null;
const draining = new Map(); // pid -> { build, since }
let switching = null; // build name being started
let crashes = [];
let stopping = false;

function readPointer() {
  try {
    const b = fs.readFileSync(POINTER, 'utf-8').trim();
    if (BUILD_RE.test(b) && fs.existsSync(path.join(BACKEND, b, 'server.js'))) return b;
    log(`pointer ${POINTER} names "${b}", which has no server.js — using dist`);
  } catch { /* no pointer yet: the classic backend/dist */ }
  return 'dist';
}

function writePointer(build) {
  const tmp = `${POINTER}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${build}\n`);
  fs.renameSync(tmp, POINTER);
}

function writeState() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ pid: process.pid, port: CONTROL_PORT, token, startedAt }, null, 2));
}

function killTree(pid) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true });
    else process.kill(pid, 'SIGKILL');
  } catch { /* already gone */ }
}

/** Start a worker on `build`; resolves with it once it listens, rejects (and kills it) otherwise. */
function startWorker(build) {
  return new Promise((resolve, reject) => {
    cluster.setupPrimary({ exec: path.join(BACKEND, build, 'server.js'), cwd: BACKEND, windowsHide: true });
    const worker = cluster.fork({ API_BUILD: build });
    const pid = worker.process.pid;
    log(`worker ${pid} starting on ${build}`);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      log(`worker ${pid} (${build}) did not report ready in ${READY_TIMEOUT_MS / 1000}s — killing it`);
      killTree(pid);
      reject(new Error(`the new build did not start within ${READY_TIMEOUT_MS / 1000}s`));
    }, READY_TIMEOUT_MS);
    worker.on('message', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'api-ready' && !settled) {
        settled = true;
        clearTimeout(timer);
        log(`worker ${pid} (${build}) is serving`);
        resolve({ worker, build, startedAt: new Date().toISOString(), readyAt: new Date().toISOString() });
      } else if (msg.type === 'api-mem' && current && current.worker === worker && msg.rss > MEMORY_LIMIT_BYTES && !switching) {
        log(`worker ${pid} uses ${Math.round(msg.rss / 1048576)} MB (> ${MEMORY_LIMIT_BYTES / 1048576}) — fresh worker on the same build`);
        switchTo(current.build).catch((e) => log(`memory switch failed: ${e.message}`));
      }
    });
    worker.on('exit', (code, signal) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`the new build exited before it was ready (code ${code}${signal ? `, ${signal}` : ''}) — see pm2 logs garment-erp-api`));
      }
    });
  });
}

function drainOld(old) {
  const pid = old.worker.process.pid;
  draining.set(pid, { build: old.build, since: new Date().toISOString() });
  log(`worker ${pid} (${old.build}) draining`);
  try {
    old.worker.send({ type: 'drain' });
  } catch { /* already gone */ }
  const timer = setTimeout(() => {
    log(`worker ${pid} still running after ${DRAIN_TIMEOUT_MS / 1000}s of draining — killing it`);
    killTree(pid);
  }, DRAIN_TIMEOUT_MS);
  old.worker.on('exit', () => {
    clearTimeout(timer);
    draining.delete(pid);
    log(`worker ${pid} (${old.build}) has exited`);
  });
}

async function switchTo(build) {
  if (switching) throw Object.assign(new Error(`a switch to ${switching} is already running`), { status: 409 });
  if (!BUILD_RE.test(build) || !fs.existsSync(path.join(BACKEND, build, 'server.js'))) {
    throw Object.assign(new Error(`${build} is not a build folder under backend/ with a server.js`), { status: 400 });
  }
  switching = build;
  try {
    const next = await startWorker(build);
    const old = current;
    current = next;
    writePointer(build);
    if (old) drainOld(old);
    return next;
  } finally {
    switching = null;
  }
}

function status() {
  return {
    supervisorPid: process.pid,
    startedAt,
    current: current && { build: current.build, pid: current.worker.process.pid, readyAt: current.readyAt },
    draining: [...draining].map(([pid, d]) => ({ pid, ...d })),
    switching,
    pointer: readPointer(),
  };
}

// --- control server -------------------------------------------------------------------------
function controlServer() {
  const server = http.createServer((req, res) => {
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.headers['x-supervisor-token'] !== token) return send(403, { error: 'bad token' });
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/status') return send(200, status());
    if (req.method === 'POST' && url.pathname === '/switch') {
      const build = url.searchParams.get('build') || '';
      req.setTimeout(READY_TIMEOUT_MS + 30000);
      return switchTo(build).then(
        () => send(200, { ok: true, ...status() }),
        (e) => send(e.status || 500, { ok: false, error: e.message, ...status() }),
      );
    }
    return send(404, { error: 'not found' });
  });
  server.listen(CONTROL_PORT, '127.0.0.1', () => log(`control on 127.0.0.1:${CONTROL_PORT}`));
  server.on('error', (e) => log(`control server error: ${e.message} (switches unavailable; the API itself is unaffected)`));
}

// --- crashes ---------------------------------------------------------------------------------
cluster.on('exit', (worker, code, signal) => {
  if (stopping || !current || current.worker !== worker || switching) return;
  const pid = worker.process.pid;
  crashes = [...crashes.filter((t) => Date.now() - t < 120000), Date.now()];
  log(`worker ${pid} (${current.build}) exited unexpectedly (code ${code}${signal ? `, ${signal}` : ''}) — crash ${crashes.length} in 2 min`);
  const build = current.build;
  current = null;
  if (crashes.length >= 5) {
    log('5 crashes in 2 minutes — exiting so PM2 applies its own restart policy');
    process.exit(1);
  }
  setTimeout(() => {
    startWorker(build).then((w) => { current = w; }, (e) => {
      log(`restart after crash failed: ${e.message} — exiting for PM2`);
      process.exit(1);
    });
  }, 1000);
});

// --- stop ------------------------------------------------------------------------------------
async function stop() {
  if (stopping) return;
  stopping = true;
  log('stopping: asking workers to shut down');
  const workers = Object.values(cluster.workers || {});
  for (const w of workers) {
    try {
      w.send('shutdown');
    } catch { /* gone */ }
  }
  const deadline = Date.now() + STOP_TIMEOUT_MS;
  while (Object.keys(cluster.workers || {}).length && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
  }
  // Kill the TREE: a worker that did not finish leaves headless Chrome behind otherwise.
  for (const w of Object.values(cluster.workers || {})) killTree(w.process.pid);
  try {
    const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    if (st.pid === process.pid) fs.rmSync(STATE_FILE, { force: true });
  } catch { /* ignore */ }
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('message', (m) => { if (m === 'shutdown') stop(); }); // PM2 shutdown_with_message

// --- boot ------------------------------------------------------------------------------------
(async () => {
  writeState();
  controlServer();
  const build = readPointer();
  log(`supervisor ${process.pid} starting the API on backend/${build}`);
  try {
    current = await startWorker(build);
  } catch (e) {
    log(`the API did not start: ${e.message} — exiting for PM2`);
    process.exit(1);
  }
})();
