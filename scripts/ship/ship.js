/* eslint-disable no-console */
/**
 * ship — see and steer garment-erp deploys. The deployer (scripts/ship/deployer.js, PM2 app
 * garment-erp-deployer) does the actual work; this only reads its state and leaves it notes.
 *
 *   npm run ship:status              what is live, what is queued, is a deploy running / failed
 *   npm run ship:wait [-- <sha>]     wait until that commit (default: main) is live; exit 1 if it failed
 *   npm run ship -- now              retry a failed/blocked deploy of main now, and wait for it
 *   npm run ship -- pause [reason]   hold deploys (migrations, manual maintenance)
 *   npm run ship -- resume           let deploys continue
 *   npm run ship -- log [lines]      tail the deploy log
 *
 * Claude: run `ship:wait` with a 600000 ms Bash timeout, after a commit, before checking the live app.
 */
const fs = require('fs');
const S = require('./state');
const notices = require('../hooks/notices');

const WAIT_LIMIT_MS = 20 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

function clock(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '?';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function ago(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const m = Math.floor(ms / 60000);
  if (m < 1) return `${Math.floor(ms / 1000)}s ago`;
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}
const who = () => process.env.CLAUDE_CODE_SESSION_ID
  ? `Claude terminal ${process.env.CLAUDE_CODE_SESSION_ID.slice(0, 8)}`
  : process.env.USERNAME || 'someone';

function deployerRunning(st) {
  return S.pidAlive(st.deployerPid);
}

const NOT_RUNNING = 'the deployer is NOT running — commits will not go live through it.\n' +
  '  It is started by the OWNER (shared PM2 daemon): pm2 delete garment-erp-watcher (if listed),\n' +
  '  pm2 start ecosystem.config.js --only garment-erp-deployer, then pm2 save. Do not start it yourself.';

function describeNow(st, pause) {
  if (st.state === 'deploying') {
    return `DEPLOYING ${S.short(st.targetSha)} "${st.targetSubject || ''}" — ${st.step || '…'} (started ${clock(st.startedAt)}, ${ago(st.startedAt)})`;
  }
  if (st.state === 'failed' || st.state === 'blocked') {
    const hint = st.state === 'blocked'
      ? 'fix the cause, then: npm run ship -- now'
      : 'fix it and commit again (that deploys automatically), or retry: npm run ship -- now';
    return `${st.state.toUpperCase()} ${S.short(st.failedSha)} (${ago(st.finishedAt)}): ${st.error}\n  -> ${hint}`;
  }
  if (pause) return `PAUSED since ${clock(pause.at)} by ${pause.by}${pause.reason ? ` — "${pause.reason}"` : ''}\n  -> npm run ship -- resume`;
  return 'idle';
}

function status() {
  const st = S.readState();
  const pause = S.readPause();
  const head = S.mainSha();
  const pending = st.liveSha && head && head !== st.liveSha
    ? (S.tryGit(['rev-list', '--count', `${st.liveSha}..${head}`]) || '?')
    : null;

  console.log('\ngarment-erp deploys');
  console.log(`  Live:     ${S.short(st.liveSha)} "${st.liveSubject || ''}"${st.liveAt ? `  (${clock(st.liveAt)}, ${ago(st.liveAt)})` : ''}`);
  console.log(`  main:     ${S.short(head)}${head === st.liveSha ? '  (live)' : `  <- ${pending || 'some'} commit(s) not live yet`}`);
  console.log(`  Deployer: ${deployerRunning(st) ? `running (pid ${st.deployerPid})` : NOT_RUNNING}`);
  console.log(`  Now:      ${describeNow(st, pause)}`);
  if (st.state !== 'deploying' && pause && st.state !== 'idle') console.log(`  Also:     PAUSED since ${clock(pause.at)} by ${pause.by}`);
  const recent = (st.history || []).slice(0, 5);
  if (recent.length) {
    console.log('  Recent:');
    for (const h of recent) {
      console.log(`    ${clock(h.finishedAt)}  ${h.result.padEnd(7)} ${S.short(h.sha)}  ${h.seconds}s  ${(h.subject || '').slice(0, 70)}`);
    }
  }
  console.log(`  Log:      ${S.LOG_FILE}\n`);
}

async function wait(target) {
  const sha = target ? S.tryGit(['rev-parse', '--verify', `${target}^{commit}`]) : S.mainSha();
  if (!sha) {
    console.error(`unknown commit: ${target}`);
    return 1;
  }
  console.log(`Waiting for ${S.short(sha)} "${S.subjectOf(sha)}" to go live…`);
  const deadline = Date.now() + WAIT_LIMIT_MS;
  let lastLine = '';
  let deadChecks = 0;
  for (;;) {
    const st = S.readState();
    if (S.isAncestor(sha, st.liveSha)) {
      const h = (st.history || [])[0];
      console.log(`LIVE: ${S.short(sha)} is live (deploy of ${S.short(st.liveSha)} finished ${clock(st.liveAt)}${h && h.seconds ? `, took ${h.seconds}s` : ''}).`);
      if (st.fleetOk === false) console.log('  note: fleet-check reported a problem after the deploy — see the deploy log.');
      return 0;
    }
    if ((st.state === 'failed' || st.state === 'blocked') && S.isAncestor(sha, st.failedSha)) {
      console.log(`${st.state.toUpperCase()}: ${st.error}`);
      if (st.logTail) console.log(`\nlast output:\n${st.logTail}`);
      console.log(`\nThe live app is unchanged (still ${S.short(st.liveSha)}). Log: ${S.LOG_FILE}`);
      return 1;
    }
    if (!deployerRunning(st)) {
      if (++deadChecks >= 3) {
        console.log(NOT_RUNNING);
        return 1;
      }
    } else deadChecks = 0;
    const pause = S.readPause();
    if (pause && st.state !== 'deploying') {
      console.log(describeNow({ state: 'idle' }, pause));
      return 1;
    }
    let line = 'queued — waiting for the deployer to pick it up';
    if (st.state === 'deploying') {
      line = S.isAncestor(sha, st.targetSha)
        ? `… ${st.step || 'deploying'}`
        : `… another deploy (${S.short(st.targetSha)}) is running — yours goes next`;
    }
    if (line !== lastLine) {
      console.log(line);
      lastLine = line;
    }
    if (Date.now() > deadline) {
      console.log(`still not live after ${WAIT_LIMIT_MS / 60000} min — current state: ${describeNow(st, pause)}`);
      return 1;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function now() {
  if (S.readPause()) {
    console.log(describeNow({ state: 'idle' }, S.readPause()));
    return 1;
  }
  S.writeJson(S.RETRY_FILE, { at: new Date().toISOString(), by: who() });
  return wait();
}

function pause(reason) {
  S.writeJson(S.PAUSE_FILE, { at: new Date().toISOString(), by: who(), reason: reason || null });
  notices.post(`Deploys PAUSED by ${who()}${reason ? ` — "${reason}"` : ''}. Commits wait until \`npm run ship -- resume\`. ` +
    'If the API is stopped meanwhile, that is deliberate — do not restart it.', { hours: 12 });
  const st = S.readState();
  if (S.isDeployActive(st)) {
    console.log(`Paused — but a deploy of ${S.short(st.targetSha)} is running now (${st.step}); it will finish first.`);
    console.log('Wait for it (npm run ship:status) before stopping the API.');
  } else {
    console.log('Paused. No deploy will start until: npm run ship -- resume');
  }
  return 0;
}

function resume() {
  fs.rmSync(S.PAUSE_FILE, { force: true });
  notices.post(`Deploys RESUMED by ${who()} — queued commits on main will now ship.`, { hours: 12 });
  console.log('Resumed — the deployer will ship main if it is not live.');
  return 0;
}

/**
 * Printed by .husky/post-commit. Must never fail a commit.
 * With --if-deployer it prints nothing and exits 1 when the deployer is not running, so the hook
 * can fall back to its old in-place build until the owner has switched to the deployer.
 */
function notify(ifDeployer) {
  if (ifDeployer) {
    try {
      if (!deployerRunning(S.readState())) return 1;
    } catch {
      return 1;
    }
  }
  try {
    const st = S.readState();
    const pause = S.readPause();
    const sha = S.mainSha();
    console.log('');
    console.log(`Committed ${S.short(sha)}. The deployer puts committed work live, one deploy at a time (usually 2-5 min).`);
    console.log('  Follow it:  npm run ship:wait        Status:  npm run ship:status');
    if (!deployerRunning(st)) console.log(`  WARNING: ${NOT_RUNNING}`);
    else if (pause) console.log(`  NOTE: deploys are PAUSED (since ${clock(pause.at)} by ${pause.by}) — this goes live after: npm run ship -- resume`);
    console.log('');
  } catch { /* never block a commit */ }
  return 0;
}

function logTail(lines) {
  console.log(S.tailFile(S.LOG_FILE, parseInt(lines, 10) || 60));
  return 0;
}

async function main() {
  const [cmd = 'status', ...rest] = process.argv.slice(2);
  switch (cmd) {
    case 'status': status(); return 0;
    case 'wait': return wait(rest[0]);
    case 'now': return now();
    case 'pause': return pause(rest.join(' '));
    case 'resume': return resume();
    case 'notify': return notify(rest.includes('--if-deployer'));
    case 'log': return logTail(rest[0]);
    default:
      console.error(`unknown command "${cmd}" — use status | wait [sha] | now | pause [reason] | resume | log [lines]`);
      return 2;
  }
}

main().then((code) => process.exit(code), (e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
