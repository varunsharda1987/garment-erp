/* eslint-disable no-console */
/**
 * One heavy job at a time on this PC — whole-project type-checks and the deployer's builds take
 * 3-4.5 GB each, and two or three at once left 0.1 GB free: Windows paged everything out and the LIVE
 * app froze for seconds to 4 minutes, several times on 2026-10-03.
 *
 *   node scripts/ship/heavy-slot.js run -- <command...>   wait for the slot, run, give it back
 *   node scripts/ship/heavy-slot.js status                who holds it, who waits
 *   const slot = require('./heavy-slot'); await slot.acquire('label'); ...; slot.release();
 *
 * One slot, machine-wide (a lock file in ops\deploy-state). A holder that died is ignored (its pid is
 * gone). The deployer goes first: while it waits (DEPLOYER_WANTS file), nobody else takes the slot.
 * A process started inside the slot (HEAVY_SLOT_HELD in its env) does not wait for itself.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DIR = process.env.HEAVY_SLOT_DIR || 'C:\\Users\\NEW\\ops\\deploy-state';
const LOCK = path.join(DIR, 'garment-erp.heavy.lock');
const DEPLOYER_WANTS = path.join(DIR, 'garment-erp.heavy.deployer-wants');
const STALE_MS = 60 * 60 * 1000; // a holder older than an hour is a leftover, whatever its pid says

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function holder() {
  const h = readJson(LOCK);
  if (!h) return null;
  if (!alive(h.pid) || Date.now() - Date.parse(h.at) > STALE_MS) {
    fs.rmSync(LOCK, { force: true });
    return null;
  }
  return h;
}

let held = false;

/**
 * Wait for the slot. `isDeployer` jumps the queue. Logs while waiting (to stderr, so the job's own
 * output stays clean). Resolves once this process holds it.
 */
async function acquire(label, { isDeployer = false, log = (m) => console.error(m) } = {}) {
  if (held || process.env.HEAVY_SLOT_HELD) return;
  fs.mkdirSync(DIR, { recursive: true });
  if (isDeployer) fs.writeFileSync(DEPLOYER_WANTS, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  const t0 = Date.now();
  let lastSaid = 0;
  for (;;) {
    const h = holder();
    const deployerWaiting = !isDeployer && (() => {
      const w = readJson(DEPLOYER_WANTS);
      if (w && alive(w.pid)) return true;
      if (w) fs.rmSync(DEPLOYER_WANTS, { force: true });
      return false;
    })();
    if (!h && !deployerWaiting) {
      try {
        fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, label, cwd: process.cwd(), at: new Date().toISOString() }), { flag: 'wx' });
        held = true;
        process.env.HEAVY_SLOT_HELD = String(process.pid); // children (npm run build …) must not wait for us
        if (isDeployer) fs.rmSync(DEPLOYER_WANTS, { force: true });
        if (Date.now() - t0 > 2000) log(`[heavy-slot] got it after ${Math.round((Date.now() - t0) / 1000)} s — running: ${label}`);
        return;
      } catch { /* someone was faster — loop */ }
    }
    if (Date.now() - lastSaid > 30000) {
      lastSaid = Date.now();
      const who = h ? `"${h.label}" (pid ${h.pid}, since ${h.at.slice(11, 19)})` : 'the deployer, which goes first';
      log(`[heavy-slot] waiting: one heavy job at a time on this PC (it froze the live app at 0.1 GB free). Running now: ${who}`);
    }
    await sleep(2000);
  }
}

function release() {
  if (!held) return;
  const h = readJson(LOCK);
  if (h && h.pid === process.pid) fs.rmSync(LOCK, { force: true });
  held = false;
  if (process.env.HEAVY_SLOT_HELD === String(process.pid)) delete process.env.HEAVY_SLOT_HELD;
}
process.on('exit', release);

module.exports = { acquire, release, holder, LOCK };

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'status') {
    const h = holder();
    const w = readJson(DEPLOYER_WANTS);
    console.log(h ? `held by "${h.label}" pid ${h.pid} since ${h.at}` : 'free');
    if (w && alive(w.pid)) console.log(`the deployer is waiting for it (pid ${w.pid})`);
  } else if (cmd === 'run') {
    const sep = rest.indexOf('--');
    const argv = sep >= 0 ? rest.slice(sep + 1) : rest;
    if (!argv.length) {
      console.error('usage: heavy-slot.js run -- <command...>');
      process.exit(2);
    }
    const label = `${argv.join(' ').slice(0, 120)} (in ${path.basename(process.cwd())})`;
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(130));
    acquire(label).then(() => {
      const env = { ...process.env, HEAVY_SLOT_HELD: String(process.pid) };
      // `node …` runs directly (arguments passed as they are); anything else (npx, a .cmd) needs the
      // shell on Windows, as ONE quoted string — an args array with shell:true is concatenated unquoted.
      const quote = (a) => (/^[\w./:=@\\-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);
      const child = /^node(\.exe)?$/i.test(path.basename(argv[0]))
        ? spawn(process.execPath, argv.slice(1), { stdio: 'inherit', env })
        : spawn(argv.map(quote).join(' '), { stdio: 'inherit', shell: true, env });
      child.on('exit', (code, signal) => {
        release();
        process.exit(code === null ? (signal ? 1 : 0) : code);
      });
    });
  } else {
    console.error('usage: heavy-slot.js run -- <command...> | status');
    process.exit(2);
  }
}
