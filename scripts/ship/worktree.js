/* eslint-disable no-console */
/**
 * Each Claude terminal works in its OWN copy of the repo (a git worktree), so one terminal's
 * unfinished or broken file never fails another terminal's tests or commits (2026-10-03: a
 * half-edited cutting.controller.ts failed every jest suite and every backend commit of the others).
 *
 *   npm run wt -- new <name>      make .claude/worktrees/<name> on branch wt/<name>, from main
 *   npm run wt -- list            every worktree: commits not on main yet, uncommitted files
 *   npm run wt -- check           type-check THIS worktree (backend + frontend), with its own caches
 *   npm run land                  put this worktree's commits on main (they go live via the deployer)
 *   npm run wt -- migrate         your commits carry a NEW migration: test db → pause → stop API →
 *                                 land → migrate live → generate → start API → resume (one command)
 *   npm run wt -- migrate --test-db-only   only the garment_erp_test step
 *   npm run wt -- remove <name>   delete a worktree whose work is on main
 *
 * Shared on purpose: node_modules (junctions into the main folder — a package-lock change still
 * needs `npm ci` THERE), the Prisma client (change it only with `npm run wt -- migrate`), the test
 * database and the live API.
 *
 * `land` only ever FAST-FORWARDS main in the main folder (`git merge --ff-only`): git refuses rather
 * than overwrite a file another terminal is still editing there, and this names that terminal.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

function git(args, cwd, opts = {}) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, ...opts }).trim();
}
function tryGit(args, cwd) {
  try {
    return { ok: true, out: git(args, cwd) };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}`.trim() };
  }
}

const HERE = process.cwd();
const TOP = (() => {
  try {
    return path.resolve(git(['rev-parse', '--show-toplevel'], HERE));
  } catch {
    console.error('Not inside the garment-erp repo.');
    process.exit(1);
  }
})();
const MAIN = path.dirname(path.resolve(TOP, git(['rev-parse', '--git-common-dir'], TOP)));
const WT_ROOT = path.join(MAIN, '.claude', 'worktrees');
const LOCK_DIR = 'C:\\Users\\NEW\\ops\\deploy-state';
const LOCK_FILE = path.join(LOCK_DIR, 'garment-erp.land.lock');
const inWorktree = path.resolve(TOP).toLowerCase() !== MAIN.toLowerCase();

// node_modules folders junctioned from the main folder (root = husky, lint-staged, prettier).
const JUNCTIONS = ['node_modules', 'backend/node_modules', 'frontend/node_modules', 'server/node_modules'];
const CACHE = '.wt-cache';

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

function die(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

function isJunction(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function hasEntries(dir) {
  try {
    return fs.readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

function ensureExcluded(pattern) {
  const file = path.join(MAIN, '.git', 'info', 'exclude');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
  if (!text.split(/\r?\n/).includes(pattern)) fs.appendFileSync(file, `${text.endsWith('\n') || !text ? '' : '\n'}${pattern}\n`);
}

function copyEnv(dest) {
  const copied = [];
  for (const side of ['', 'backend', 'frontend']) {
    const srcDir = path.join(MAIN, side);
    for (const name of fs.readdirSync(srcDir)) {
      if (!/^\.env(\..+)?$/.test(name) || /example|sample|backup|\.bak$/i.test(name)) continue;
      const src = path.join(srcDir, name);
      if (!fs.statSync(src).isFile()) continue;
      fs.copyFileSync(src, path.join(dest, side, name));
      copied.push(path.posix.join(side, name));
    }
  }
  return copied;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ---------------------------------------------------------------------------------------------
function cmdNew(name) {
  if (inWorktree) die('Run `npm run wt -- new` from the main folder (C:\\Users\\NEW\\garment-erp).');
  if (!NAME_RE.test(name || '')) die('Give the worktree a short name: lowercase letters, digits and dashes (e.g. cutting-variance).');
  const dir = path.join(WT_ROOT, name);
  const branch = `wt/${name}`;
  if (fs.existsSync(dir)) die(`${dir} already exists — work there, or pick another name.`);
  if (tryGit(['rev-parse', '--verify', `refs/heads/${branch}`], MAIN).ok) {
    die(`Branch ${branch} already exists (a removed worktree's?). Pick another name.`);
  }

  fs.mkdirSync(WT_ROOT, { recursive: true });
  git(['worktree', 'add', '-b', branch, dir, 'refs/heads/main'], MAIN);

  for (const rel of JUNCTIONS) {
    const target = path.join(MAIN, rel);
    if (!fs.existsSync(target)) continue;
    const link = path.join(dir, rel);
    if (fs.existsSync(link)) die(`${link} exists in the new checkout — node_modules is tracked? Fix by hand.`);
    fs.symlinkSync(target, link, 'junction');
  }
  // The git hooks (husky) live in the gitignored .husky/_ — without it no commit check would run.
  const husky = path.join(MAIN, '.husky', '_');
  if (fs.existsSync(husky)) copyDir(husky, path.join(dir, '.husky', '_'));
  const env = copyEnv(dir);
  fs.mkdirSync(path.join(dir, CACHE), { recursive: true });
  ensureExcluded(`/${CACHE}/`);

  console.log(`
Worktree ready:  ${dir}
Branch:          ${branch} (from main ${git(['rev-parse', '--short', 'main'], MAIN)})
Env copied:      ${env.join(', ') || '(none)'}

Work ONLY in that folder from now on (cd there; open files under it). Commit there as often as you
like — nothing goes live until you land. Then:
  npm run wt -- check     type-check this worktree (use this, not \`tsc -b\` — its cache is shared)
  npm run land            put your commits on main → the deployer ships them
  npm run wt -- remove ${name}   when finished
Never run \`prisma generate\` / \`migrate\` here (node_modules is the LIVE app's): use \`npm run wt -- migrate\`.
`);
}

// ---------------------------------------------------------------------------------------------
function cmdList() {
  const porcelain = git(['worktree', 'list', '--porcelain'], MAIN);
  const rows = [];
  for (const block of porcelain.split(/\r?\n\r?\n/)) {
    const wt = (block.match(/^worktree (.+)$/m) || [])[1];
    const br = (block.match(/^branch refs\/heads\/(.+)$/m) || [])[1];
    if (!wt || !br || !br.startsWith('wt/')) continue;
    const ahead = tryGit(['rev-list', '--count', `main..${br}`], MAIN).out;
    const behind = tryGit(['rev-list', '--count', `${br}..main`], MAIN).out;
    const dirty = tryGit(['status', '--porcelain'], wt).out.split('\n').filter(Boolean).length;
    rows.push(`  ${br.padEnd(32)} ${String(ahead).padStart(3)} to land  ${String(behind).padStart(4)} behind main  ${dirty} uncommitted   ${wt}`);
  }
  console.log(rows.length ? `Worktrees:\n${rows.join('\n')}` : 'No worktrees (npm run wt -- new <name>).');
}

// ---------------------------------------------------------------------------------------------
/** Type-check this checkout with build-info files of its own (the default ones sit in the SHARED
 * node_modules/.tmp, and `tsc -b` trusts timestamps — another folder's cache could pass it falsely). */
function typeCheck(dir) {
  const cache = path.join(dir, CACHE);
  fs.mkdirSync(cache, { recursive: true });
  const steps = [
    ['backend', path.join(dir, 'backend'), ['node', '--max-old-space-size=16384', './node_modules/typescript/bin/tsc', '--noEmit', '--tsBuildInfoFile', path.join(cache, 'backend.tsbuildinfo')]],
    ['frontend (app)', path.join(dir, 'frontend'), ['node', './node_modules/typescript/bin/tsc', '-p', 'tsconfig.app.json', '--noEmit', '--tsBuildInfoFile', path.join(cache, 'frontend-app.tsbuildinfo')]],
    ['frontend (node)', path.join(dir, 'frontend'), ['node', './node_modules/typescript/bin/tsc', '-p', 'tsconfig.node.json', '--noEmit', '--tsBuildInfoFile', path.join(cache, 'frontend-node.tsbuildinfo')]],
  ];
  let ok = true;
  for (const [label, cwd, [cmd, ...args]] of steps) {
    process.stdout.write(`  type-check ${label} ... `);
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf-8', maxBuffer: 64 << 20 });
    if (r.status === 0) {
      console.log('ok');
      continue;
    }
    ok = false;
    const errs = `${r.stdout || ''}${r.stderr || ''}`.split(/\r?\n/).filter((l) => /error TS/.test(l));
    console.log(`FAILED (${errs.length} error(s))`);
    errs.slice(0, 15).forEach((l) => console.log(`    ${l.trim()}`));
  }
  return ok;
}

function cmdCheck() {
  console.log(`Type-checking ${TOP}`);
  if (!typeCheck(TOP)) process.exit(1);
}

// ---------------------------------------------------------------------------------------------
function takeLock(what) {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  for (let i = 0; i < 2; i++) {
    try {
      fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, what, worktree: TOP, at: new Date().toISOString() }), { flag: 'wx' });
      return;
    } catch {
      let held = null;
      try {
        held = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
      } catch { /* unreadable */ }
      let alive = false;
      try {
        if (held) process.kill(held.pid, 0);
        alive = Boolean(held);
      } catch { /* gone */ }
      const age = held ? Date.now() - Date.parse(held.at) : Infinity;
      if (alive && age < 30 * 60 * 1000) die(`Another terminal is landing right now (${held.what} from ${held.worktree}, since ${held.at}). Try again in a minute.`);
      fs.rmSync(LOCK_FILE, { force: true }); // stale
    }
  }
  die(`Could not take ${LOCK_FILE}.`);
}
const dropLock = () => fs.rmSync(LOCK_FILE, { force: true });

/** Files git refused to overwrite in the main folder → who is editing them. */
function explainOverwrite(out) {
  const files = [];
  let on = false;
  for (const line of out.split(/\r?\n/)) {
    if (/would be overwritten|untracked working tree files would be/.test(line)) on = true;
    else if (on && /^\s+\S/.test(line)) files.push(line.trim());
    else if (on && line.trim()) on = false;
  }
  let owners = '';
  try {
    const claims = require(path.join(MAIN, 'scripts', 'hooks', 'session-claims.js'));
    const sessions = claims.loadSessions ? claims.loadSessions() : null;
    if (sessions && files.length) {
      owners = files
        .map((f) => {
          const who = sessions.filter((s) => s.files.has(f.toLowerCase())).map((s) => s.id.slice(0, 8));
          return `   ${f}  — being edited in the main folder${who.length ? ` by Claude terminal ${who.join(', ')}` : ''}`;
        })
        .join('\n');
    }
  } catch { /* best effort */ }
  return `${owners || files.map((f) => `   ${f}`).join('\n')}

Another terminal has UNCOMMITTED edits to these files in the main folder, and your commits change
them too. Nothing was changed. Message that terminal (ListAgents / SendMessage): once it commits,
run \`npm run land\` again (it rebases onto its commit).`;
}

function cmdLand() {
  if (!inWorktree) die('`npm run land` runs inside a worktree (npm run wt -- new <name>). In the main folder, commit as before.');
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], TOP);
  if (!branch.startsWith('wt/')) die(`This worktree is on ${branch}, not a wt/ branch.`);
  const dirty = git(['status', '--porcelain', '--untracked-files=no'], TOP);
  if (dirty) die(`Commit (or drop) these first — only commits land:\n${dirty}`);
  if (git(['rev-list', '--count', `main..${branch}`], TOP) === '0') die('Nothing to land: every commit here is already on main.');

  takeLock(`land ${branch}`);
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const main = git(['rev-parse', 'refs/heads/main'], TOP);
      if (git(['merge-base', 'HEAD', main], TOP) !== main) {
        console.log(`Rebasing ${branch} onto main ${main.slice(0, 8)} ...`);
        const r = tryGit(['rebase', main], TOP);
        if (!r.ok) {
          tryGit(['rebase', '--abort'], TOP);
          die(`Your commits conflict with main — nothing was landed.\n${r.out}\n\nResolve it here: git rebase main, fix the conflicts, git rebase --continue, then npm run land.`);
        }
      }
      console.log('Checking types on top of main ...');
      if (!typeCheck(TOP)) die('Type errors — nothing was landed. Fix, commit, then npm run land.');

      const head = git(['rev-parse', 'HEAD'], TOP);
      const n = git(['rev-list', '--count', `${main}..${head}`], TOP);
      const r = tryGit(['merge', '--ff-only', '--quiet', head], MAIN);
      if (r.ok) {
        console.log(`\nLanded ${n} commit(s) on main → ${head.slice(0, 8)}.`);
        console.log(git(['log', '--oneline', `${main}..${head}`], TOP));
        spawnSync('node', [path.join(MAIN, 'scripts', 'ship', 'ship.js'), 'notify'], { stdio: 'inherit' });
        console.log(`Keep working here (commit, then land again), or: npm run wt -- remove ${branch.slice(3)}`);
        return;
      }
      if (/would be overwritten/.test(r.out)) die(`Not landed:\n${explainOverwrite(r.out)}`);
      if (/Not possible to fast-forward|not something we can merge|diverg/i.test(r.out) && attempt < 3) {
        console.log('main moved while checking — rebasing again.');
        continue;
      }
      die(`Not landed — git said:\n${r.out}`);
    }
  } finally {
    dropLock();
  }
}

// ---------------------------------------------------------------------------------------------
// npm run wt -- migrate : a schema change, start to finish, never leaving a pause or a stopped API
// ---------------------------------------------------------------------------------------------
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function liveDatabaseUrl() {
  const text = fs.readFileSync(path.join(MAIN, 'backend', '.env'), 'utf-8');
  const m = text.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/m);
  if (!m) die('DATABASE_URL not found in backend/.env');
  return m[1].trim();
}

function testDatabaseUrl() {
  const url = new URL(liveDatabaseUrl());
  url.pathname = '/garment_erp_test';
  return url.toString();
}

function run(cmd, args, cwd, env) {
  console.log(`  $ ${cmd} ${args.join(' ')}   (${path.relative(MAIN, cwd) || 'main folder'})`);
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, encoding: 'utf-8', shell: isWinShell(cmd), maxBuffer: 64 << 20 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return { ok: r.status === 0, out };
}
const isWinShell = (cmd) => process.platform === 'win32' && /^(npx|npm|pm2)$/.test(cmd);

function apiHealthy() {
  const r = spawnSync('node', ['-e', "require('http').get('http://127.0.0.1:5000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1)).setTimeout(4000,function(){this.destroy()})"], { encoding: 'utf-8' });
  return r.status === 0;
}

function cmdMigrate(testOnly) {
  if (!inWorktree) die('Run `npm run wt -- migrate` inside your worktree.');
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], TOP);
  if (git(['status', '--porcelain', '--untracked-files=no'], TOP)) die('Commit everything first — the migration lands with your commits.');
  const added = git(['diff', '--name-only', '--diff-filter=A', 'refs/heads/main...HEAD'], TOP)
    .split(/\r?\n/).filter((f) => /^backend\/prisma\/migrations\/[^/]+\/migration\.sql$/.test(f));
  if (!added.length) die('No new migration in your commits (main..HEAD). For plain code, use npm run land.');

  console.log(`Migrations in ${branch}:\n${added.map((f) => `  ${f}`).join('\n')}`);
  const contract = require(path.join(MAIN, 'scripts', 'hooks', 'migration-contract.js'));
  const bad = added.flatMap((f) => contract.findContractViolations(fs.readFileSync(path.join(TOP, f), 'utf-8')).map((v) => `  ${f}:${v.line} ${v.reason}`));
  if (bad.length) die(`Not additive:\n${bad.join('\n')}\n${contract.FIX_HINT}`);

  console.log('\n1. Applying to garment_erp_test first ...');
  const t = run('npx', ['prisma', 'migrate', 'deploy'], path.join(TOP, 'backend'), { DATABASE_URL: testDatabaseUrl() });
  if (!t.ok) die(`The migration FAILED on garment_erp_test — live untouched:\n${t.out.slice(-3000)}`);
  console.log('   ok on the test database.');
  if (testOnly) {
    console.log('\n--test-db-only: stopping here. Live database, main and the API are untouched.');
    return;
  }

  takeLock(`migrate ${branch}`);
  const S = require(path.join(MAIN, 'scripts', 'ship', 'state.js'));
  const ship = (...a) => spawnSync('node', [path.join(MAIN, 'scripts', 'ship', 'ship.js'), ...a], { stdio: 'inherit' });
  let paused = false;
  let stopped = false;
  try {
    // Everything slow happens BEFORE the API stops.
    const main = git(['rev-parse', 'refs/heads/main'], TOP);
    if (git(['merge-base', 'HEAD', main], TOP) !== main) {
      console.log(`\n2. Rebasing onto main ${main.slice(0, 8)} ...`);
      const r = tryGit(['rebase', main], TOP);
      if (!r.ok) {
        tryGit(['rebase', '--abort'], TOP);
        die(`Your commits conflict with main — nothing changed:\n${r.out}`);
      }
    }
    console.log('\n3. Type-checking on top of main ...');
    if (!typeCheck(TOP)) die('Type errors — nothing changed. Fix, commit, run again.');

    console.log('\n4. Pausing deploys, waiting for any running deploy ...');
    ship('pause', `migration ${added.map((f) => f.split('/')[3]).join(', ')}`);
    paused = true;
    for (let i = 0; S.isDeployActive(S.readState()); i++) {
      if (i > 180) die('A deploy has been running for 15 min — not stopping the API. npm run ship:status');
      sleep(5000);
    }

    console.log('\n5. Stopping the API, landing, migrating the live database, generating the client ...');
    run('pm2', ['stop', 'garment-erp-api'], MAIN);
    stopped = true;
    sleep(3000);
    const head = git(['rev-parse', 'HEAD'], TOP);
    const ff = tryGit(['merge', '--ff-only', '--quiet', head], MAIN);
    if (!ff.ok) die(/would be overwritten/.test(ff.out) ? `Not landed:\n${explainOverwrite(ff.out)}` : `Not landed — git said:\n${ff.out}`);
    const m = run('npx', ['prisma', 'migrate', 'deploy'], path.join(MAIN, 'backend'));
    if (!m.ok) {
      die(`The migration FAILED on the live database (it passed on the test copy). Your commits ARE on main; the deployer will BLOCK them until it is applied.\n${m.out.slice(-3000)}`);
    }
    let g = run('npx', ['prisma', 'generate'], path.join(MAIN, 'backend'));
    if (!g.ok && /EPERM/.test(g.out)) {
      sleep(5000);
      g = run('npx', ['prisma', 'generate'], path.join(MAIN, 'backend'));
    }
    if (!g.ok) console.log(`   WARNING: prisma generate failed — the deployer will BLOCK until it is run:\n${g.out.slice(-1500)}`);
    console.log(`\nMigrated. ${git(['log', '--oneline', `${main}..${head}`], TOP)}`);
  } finally {
    if (stopped) {
      run('pm2', ['start', 'garment-erp-api'], MAIN);
      let up = false;
      for (let i = 0; i < 30 && !up; i++) {
        sleep(3000);
        up = apiHealthy();
      }
      console.log(up ? '   API is back.' : '   WARNING: the API is not answering /api/health after 90 s — pm2 logs garment-erp-api');
    }
    if (paused) ship('resume');
    dropLock();
  }
  spawnSync('node', [path.join(MAIN, 'scripts', 'hooks', 'notices.js'), 'post', `Migration live: ${added.map((f) => f.split('/')[3]).join(', ')} (from ${branch}) — database migrated, Prisma client regenerated, its commits are on main and deploying.`, '--from', branch], { stdio: 'ignore' });
}

// ---------------------------------------------------------------------------------------------
function cmdRemove(name, force) {
  if (inWorktree) die('Run `npm run wt -- remove` from the main folder (a folder cannot remove itself).');
  if (!NAME_RE.test(name || '')) die('Which worktree? npm run wt -- list');
  const dir = path.join(WT_ROOT, name);
  const branch = `wt/${name}`;
  if (!fs.existsSync(dir)) die(`${dir} does not exist.`);

  const unlanded = tryGit(['rev-list', '--count', `main..${branch}`], MAIN).out;
  if (unlanded !== '0' && !force) die(`${branch} has ${unlanded} commit(s) not on main. Land them first, or: npm run wt -- remove ${name} --force (they are kept on branch ${branch}).`);
  const dirty = tryGit(['status', '--porcelain'], dir).out.split('\n').filter((l) => l && !l.includes(CACHE));
  if (dirty.length && !force) die(`${dir} has uncommitted changes:\n${dirty.join('\n')}\nCommit and land them, or add --force to throw them away.`);

  // Junctions FIRST: a recursive delete follows them and would empty the main folder's node_modules.
  for (const rel of JUNCTIONS) {
    const link = path.join(dir, rel);
    if (!fs.existsSync(link) && !isJunction(link)) continue;
    if (!isJunction(link)) die(`${link} is a real folder, not a junction — remove it by hand, then run this again.`);
    fs.rmdirSync(link);
    if (isJunction(link) || fs.existsSync(link)) die(`Could not unlink ${link} — stopped before deleting anything else.`);
  }
  for (const rel of JUNCTIONS) {
    const target = path.join(MAIN, rel);
    if (fs.existsSync(target) && !hasEntries(target)) die(`${target} is EMPTY — stop and tell the owner (run npm ci there).`);
  }
  git(['worktree', 'remove', '--force', dir], MAIN);
  if (unlanded === '0') tryGit(['branch', '-d', branch], MAIN);
  console.log(`Removed ${dir}${unlanded === '0' ? ` and branch ${branch}` : ` (branch ${branch} kept: ${unlanded} unlanded commit(s))`}.`);
}

// ---------------------------------------------------------------------------------------------
const [cmd, ...rest] = process.argv.slice(2);
const force = rest.includes('--force');
const arg = rest.find((a) => !a.startsWith('--'));
switch (cmd) {
  case 'new': cmdNew(arg); break;
  case 'list': cmdList(); break;
  case 'check': cmdCheck(); break;
  case 'land': cmdLand(); break;
  case 'remove': cmdRemove(arg, force); break;
  case 'migrate': cmdMigrate(rest.includes('--test-db-only')); break;
  default:
    console.log(fs.readFileSync(__filename, 'utf-8').split('*/')[0].replace(/^\/\*.*\n/, '').replace(/^ \* ?/gm, ''));
    process.exit(cmd ? 1 : 0);
}

