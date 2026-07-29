/* eslint-disable no-console */
/**
 * One-command LOCAL deploy for garment-erp.  Run it with:  npm run deploy
 *
 * USER-RUN by design: it contains `pm2` and `prisma` steps. The PM2 daemon is shared
 * across businesses, so this is intentionally something you run, not an automated hook.
 *
 * Sequence:
 *   1. Build backend + frontend (safe while running — just produces fresh dist/).
 *   2. Stop the API (frees Prisma's client file-lock on Windows).
 *   3. prisma migrate deploy + prisma generate  (migrate deploy is a no-op when there are
 *      no pending migrations, so it is safe to run every deploy).
 *   4. Restart the API — in a `finally`, so a migrate/generate failure never leaves it stopped.
 *   5. Reload the web app.
 *   6. Poll /health.
 *
 * After it finishes: SMOKE-TEST LOGIN (the stale-token change c3ea6ccf re-validates every
 * request against the DB). If login breaks:  git revert c3ea6ccf && npm run deploy
 */
const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const C = { cyan: '\x1b[36m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', reset: '\x1b[0m' };
const run = (cmd, opts = {}) => {
  console.log(`\n${C.cyan}> ${cmd}${C.reset}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
};
const tryRun = (cmd, opts = {}) => {
  try {
    run(cmd, opts);
    return true;
  } catch {
    console.warn(`${C.yellow}  (non-fatal) "${cmd}" failed — continuing${C.reset}`);
    return false;
  }
};

const health = () =>
  new Promise((resolve) => {
    let tries = 0;
    const ping = () => {
      tries += 1;
      http
        .get('http://localhost:5000/health', (r) => {
          if (r.statusCode === 200) return resolve(true);
          return tries < 12 ? setTimeout(ping, 3000) : resolve(false);
        })
        .on('error', () => (tries < 12 ? setTimeout(ping, 3000) : resolve(false)));
    };
    setTimeout(ping, 3000);
  });

/**
 * MANDATORY SAFETY GUARD — do not remove.
 * This machine runs ONE shared PM2 daemon for several businesses (garment-erp, kasya-b2b, harleen,
 * inward). If the pm2 CLI version differs from the RUNNING daemon version, any pm2 command — even a
 * single-app `pm2 restart <name>` — makes the CLI kill and respawn the whole daemon, taking every
 * business down at once. That is exactly what caused the 2026-07-28 outage.
 * The daemon version is read from ~/.pm2/pm2.log (no pm2 command needed), so the guard is itself safe.
 */
function assertPm2VersionsMatch() {
  let cli;
  try {
    cli = execSync('pm2 -v', { encoding: 'utf-8' }).trim().split('\n').pop().trim();
  } catch {
    console.error(`${C.red}Could not read the pm2 CLI version — aborting rather than risk the daemon.${C.reset}`);
    process.exit(1);
  }
  const logPath = path.join(os.homedir(), '.pm2', 'pm2.log');
  let daemon = null;
  try {
    const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter((l) => l.includes('PM2 version'));
    if (lines.length) daemon = lines[lines.length - 1].split(':').pop().trim();
  } catch {
    /* log unreadable — handled below */
  }
  if (!daemon) {
    console.error(
      `${C.red}Could not determine the RUNNING pm2 daemon version from ${logPath}.${C.reset}\n` +
        `Aborting: a CLI/daemon mismatch would restart every app on this machine.`
    );
    process.exit(1);
  }
  if (cli !== daemon) {
    console.error(
      `\n${C.red}✗ ABORTING — pm2 CLI (${cli}) != running daemon (${daemon}).${C.reset}\n` +
        `Running any pm2 command now would respawn the shared daemon and take down\n` +
        `garment-erp, kasya-b2b, harleen and inward together.\n` +
        `Resyncing needs a deliberate 'pm2 update' (which itself restarts everything) — your call.`
    );
    process.exit(1);
  }
  console.log(`${C.green}✓ pm2 CLI and daemon both ${cli} — safe to restart a single app${C.reset}`);
}

(async () => {
  assertPm2VersionsMatch();

  // 1) Build both (running app keeps serving the old dist until restart)
  run('npm --prefix backend run build');
  run('npm --prefix frontend run build');

  // 2) Stop API for the Prisma client lock (non-fatal: if already stopped / name differs, continue)
  tryRun('pm2 stop garment-erp-api');

  // 3) Migrate + regenerate — but ALWAYS restart the API afterwards
  let migrateOk = true;
  try {
    run('npx prisma migrate deploy', { cwd: 'backend' });
    run('npx prisma generate', { cwd: 'backend' });
  } catch {
    migrateOk = false;
    console.error(`\n${C.red}⚠ migrate/generate failed — restarting the API anyway; fix the error above and re-run npm run deploy${C.reset}`);
  } finally {
    // 4) Bring the API back (freshly built dist + regenerated client)
    run('pm2 restart garment-erp-api');
  }

  // 5) Reload web (dist already built above)
  run('pm2 restart garment-erp-web');

  // 6) Health check (non-fatal)
  const healthy = await health();
  console.log(
    healthy
      ? `\n${C.green}✓ backend healthy (/health = 200)${C.reset}`
      : `\n${C.yellow}… backend not 200 yet — re-check http://localhost:5000/health in ~30s${C.reset}`
  );

  console.log(
    `\n${C.green}✓ Deploy done.${C.reset}  Now SMOKE-TEST LOGIN (stale-token change c3ea6ccf).` +
      `  If login breaks:  git revert c3ea6ccf && npm run deploy`
  );
  process.exit(migrateOk ? 0 : 1);
})().catch((e) => {
  console.error(`\n${C.red}Deploy failed:${C.reset} ${e.message}`);
  process.exit(1);
});
