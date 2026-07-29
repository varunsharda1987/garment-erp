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

(async () => {
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
