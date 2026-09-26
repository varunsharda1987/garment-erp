/* eslint-disable no-console */
/**
 * RETIRED 2026-09-26 — deploys are done by the deployer (PM2 app garment-erp-deployer,
 * scripts/ship/deployer.js), which ships the COMMITTED main branch one deploy at a time.
 *
 * This script used to build the shared working folder and restart the apps. With several Claude
 * terminals editing that folder at once, that shipped their unfinished edits. It now just asks the
 * deployer to (re)ship main and waits:  same as  npm run ship -- now
 *
 * Migrations are no longer part of a deploy. Apply one BEFORE committing the code that needs it:
 *   npm run ship -- pause "migration"
 *   pm2 stop garment-erp-api
 *   cd backend && npx prisma migrate deploy && npx prisma generate
 *   pm2 start garment-erp-api
 *   npm run ship -- resume
 * (The deployer refuses — BLOCKED — to ship a commit whose migration is not applied yet.)
 */
const { spawnSync } = require('child_process');
const path = require('path');

const r = spawnSync('node', [path.join(__dirname, 'ship', 'ship.js'), 'now'], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
