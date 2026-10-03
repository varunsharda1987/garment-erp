#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * claude-guard — Claude PreToolUse hook (Bash|PowerShell) for the SHARED garment-erp folder.
 *
 * WHY (2026-09-26): several Claude terminals work in C:\Users\NEW\garment-erp at once, sharing one
 * working tree, one git index and one live app. A few everyday commands silently take or destroy
 * another terminal's work, or knock the live app over:
 *
 *   git add -A / . / -u, git commit -a      stage EVERY terminal's edits into your commit
 *   git stash, reset --hard, checkout ., clean, restore .   wipe other terminals' uncommitted work
 *   git switch / checkout <branch> / rebase / merge / pull   change files under every terminal
 *   git commit --amend                      rewrites a commit that may be another terminal's
 *   npm run build / tsc / vite build in backend|frontend   overwrite the LIVE app's dist/
 *   npm run dev|start, node dist/server.js in backend       port-5000 reclaim tree-kills the live API
 *   pm2 restart|reload garment-erp-*        orphan-fork race (use pm2-safe-restart / the deployer)
 *   pm2 stop|start|delete garment-erp-api|web   only while deploys are paused (migrations)
 *
 * Deploys are the deployer's job (scripts/ship/). Only commands whose working directory is the
 * main checkout are checked — scratch worktrees are free.
 *
 * Escape hatch, ONLY when the owner has explicitly asked for that exact command: put
 * CLAUDE_GUARD_OK=1 in front of it.
 *
 * Any internal error allows the command (fail open) and is logged to .git/claude-guard-errors.log.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const MAIN_ROOT = path.resolve(__dirname, '..', '..');
const PAUSE_FILE = 'C:\\Users\\NEW\\ops\\deploy-state\\garment-erp.paused.json';

// ---------------------------------------------------------------------------------------------
// parsing
// ---------------------------------------------------------------------------------------------
/** Drop heredoc bodies and PowerShell here-strings: commit messages live there. */
function stripBodies(cmd) {
  let s = cmd.replace(/\r\n/g, '\n');
  s = s.replace(/@(['"])\n[\s\S]*?\n\1@/g, "''");
  s = s.replace(/<<-?[ \t]*(['"]?)([A-Za-z_][\w-]*)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g, (m, q, tag, rest) => `<<${tag}${rest}`);
  return s;
}

/**
 * Split into command segments (on ; && || | & newline and parentheses) of tokens { v, q }.
 * Quoted text becomes part of a token with q = true, so a message like -m "git add ." is one
 * quoted argument, never a command.
 */
function tokenize(input) {
  const s = stripBodies(input);
  const segs = [];
  let cur = [];
  let tok = null;
  const push = () => {
    if (tok !== null) cur.push(tok);
    tok = null;
  };
  const endSeg = () => {
    push();
    if (cur.length) segs.push(cur);
    cur = [];
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'") {
      const j = s.indexOf("'", i + 1);
      const end = j < 0 ? s.length : j;
      tok = tok || { v: '', q: false };
      tok.v += s.slice(i + 1, end);
      tok.q = true;
      i = end;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let v = '';
      while (j < s.length && s[j] !== '"') {
        if ((s[j] === '\\' || s[j] === '`') && j + 1 < s.length) {
          v += s[j + 1];
          j += 2;
          continue;
        }
        v += s[j];
        j++;
      }
      tok = tok || { v: '', q: false };
      tok.v += v;
      tok.q = true;
      i = j;
      continue;
    }
    if (c === '\\' && s[i + 1] === '\n') {
      i++;
      continue;
    }
    if (c === '\n' || c === ';' || c === '(' || c === ')') {
      endSeg();
      continue;
    }
    if (c === '&' || c === '|') {
      if (tok && /^\d?>$/.test(tok.v)) { // 2>&1, >&2 — a redirect, not a separator
        tok.v += c;
        continue;
      }
      endSeg();
      if (s[i + 1] === c) i++;
      continue;
    }
    if (/\s/.test(c)) {
      push();
      continue;
    }
    tok = tok || { v: '', q: false };
    tok.v += c;
  }
  endSeg();
  return segs;
}

/** /c/Users/x -> C:\Users\x ; ~ -> home ; relative -> resolved against dir */
function resolveDir(dir, target) {
  if (!target) return dir;
  let t = target;
  const m = t.match(/^\/([a-zA-Z])(\/.*)?$/);
  if (m) t = `${m[1].toUpperCase()}:${m[2] || '\\'}`;
  if (t === '~' || t.startsWith('~/') || t.startsWith('~\\')) t = path.join(os.homedir(), t.slice(1));
  return path.resolve(dir, t);
}

function relToMain(dir) {
  const rel = path.relative(MAIN_ROOT, dir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const posix = rel.split(path.sep).join('/');
  if (/^\.claude\/worktrees(\/|$)/i.test(posix)) return null;
  return posix; // '' = repo root
}

/** 'backend' | 'frontend' | 'root' | null (outside the main checkout) */
function sideOf(dir) {
  const rel = relToMain(dir);
  if (rel === null) return null;
  const top = rel.split('/')[0].toLowerCase();
  return top === 'backend' || top === 'frontend' ? top : 'root';
}

const base = (w) => path.basename(w).toLowerCase().replace(/\.(exe|cmd|ps1|bat)$/, '');
const isFlag = (t) => !t.q && t.v.startsWith('-');

// ---------------------------------------------------------------------------------------------
// rules
// ---------------------------------------------------------------------------------------------
const WIPE = 'it would discard or take OTHER Claude terminals\' uncommitted work in this shared folder';

function gitRule(tokens, dir, ctx) {
  let i = 1;
  let gdir = dir;
  while (i < tokens.length && isFlag(tokens[i])) {
    const w = tokens[i].v;
    if (w === '-C') {
      gdir = resolveDir(gdir, tokens[i + 1] && tokens[i + 1].v);
      i += 2;
      continue;
    }
    if (w === '-c' || w === '--git-dir' || w === '--work-tree' || w === '--namespace') {
      i += 2;
      continue;
    }
    i++;
  }
  if (relToMain(gdir) === null) return null;
  const sub = tokens[i] && tokens[i].v;
  const args = tokens.slice(i + 1);
  const words = args.map((t) => t.v);
  const has = (...f) => words.some((w) => f.includes(w));
  const plain = args.filter((t) => !isFlag(t)).map((t) => t.v);
  const clusterHas = (letter) => args.some((t) => !t.q && /^-[a-zA-Z]+$/.test(t.v) && t.v.includes(letter));

  switch (sub) {
    case 'add':
      if (has('-A', '--all', '.', './', '-u', '--update', ':/', ':/*', '*', ':(top)', '--no-ignore-removal') || clusterHas('A') || clusterHas('u')) {
        return `\`git add ${words.join(' ')}\` stages EVERY terminal's edits, not just yours. Name your files (git add <file>...), or better commit them directly: git commit -m "..." -- <your files>`;
      }
      return null;
    case 'commit':
      if (has('--amend')) return '`git commit --amend` rewrites the last commit on main, which may be another terminal\'s and may already be live. Make a new commit instead.';
      if (has('--all') || clusterHas('a')) {
        return '`git commit -a` commits EVERY terminal\'s modified files. Commit your own files by name: git commit -m "..." -- <your files>';
      }
      return null;
    case 'stash':
      if (plain[0] === 'list' || plain[0] === 'show') return null;
      return `\`git stash\` — ${WIPE}. It moves every terminal's uncommitted edits out of the folder.`;
    case 'clean':
      if (has('-n', '--dry-run') || clusterHas('n')) return null;
      return `\`git clean\` — ${WIPE} (it deletes their new, not-yet-committed files).`;
    case 'reset': {
      if (has('--hard', '--merge', '--keep')) return `\`git reset ${words.join(' ')}\` — ${WIPE}.`;
      if (has('--soft', '--mixed')) return '`git reset --soft/--mixed <commit>` moves main, which the deployer ships. Make a new commit (git revert) instead.';
      const dd = words.indexOf('--');
      const paths = dd >= 0 ? words.slice(dd + 1) : plain.filter((w) => w !== 'HEAD');
      const allExist = paths.length > 0 && paths.every((p) => fs.existsSync(path.resolve(gdir, p)));
      if ((dd >= 0 && paths.length) || allExist) return null; // unstaging named files
      return '`git reset` with no file names unstages EVERY terminal\'s staged files (or moves main). Name the files: git reset -- <file>...';
    }
    case 'checkout': {
      if (has('-b', '-B', '--orphan', '--detach') ) return '`git checkout -b/--detach` switches the SHARED folder to another branch under every terminal. Use a separate git worktree for branch work.';
      if (has('-f', '--force', '.', './', ':/')) return `\`git checkout ${words.join(' ')}\` — ${WIPE}.`;
      const dd = words.indexOf('--');
      const paths = dd >= 0 ? words.slice(dd + 1) : plain.filter((p) => fs.existsSync(path.resolve(gdir, p)));
      if (dd < 0 && plain.length && paths.length === 0) {
        return `\`git checkout ${plain[0]}\` switches the SHARED folder to another branch/commit under every terminal. Use a separate git worktree (git worktree add) for that.`;
      }
      return ctx.claimsRule(paths, gdir, 'git checkout');
    }
    case 'restore': {
      const staged = has('--staged', '-S');
      const worktree = has('--worktree', '-W') || !staged;
      const dd = words.indexOf('--');
      let paths = [];
      if (dd >= 0) paths = words.slice(dd + 1);
      else {
        for (let k = 0; k < args.length; k++) {
          if (['-s', '--source'].includes(args[k].v)) k++; // its value is a commit, not a path
          else if (!isFlag(args[k])) paths.push(args[k].v);
        }
      }
      if (paths.some((p) => ['.', './', ':/', '*'].includes(p))) return `\`git restore ${words.join(' ')}\` — ${WIPE}.`;
      return worktree ? ctx.claimsRule(paths, gdir, 'git restore') : null;
    }
    case 'switch':
      return '`git switch` changes the SHARED folder\'s branch under every terminal. Use a separate git worktree (git worktree add) for branch work.';
    case 'rebase':
      if (has('--abort', '--continue', '--skip', '--quit')) return null;
      return '`git rebase` rewrites main and the files under every terminal. Not in the shared folder.';
    case 'merge':
      if (has('--abort')) return null;
      return '`git merge` changes files under every terminal. Not in the shared folder.';
    case 'pull':
      if (has('--ff-only')) return null;
      return '`git pull` can merge/rebase under every terminal. Use `git pull --ff-only` (or ask the owner).';
    default:
      return null;
  }
}

const NO_BUILD = (what) =>
  `${what} writes the LIVE app's files (backend/dist, frontend/dist) from this shared folder — including other terminals' unfinished edits. ` +
  'Deploys are the deployer\'s job: commit, then `npm run ship:wait`. To only type-check: `npm run type-check` (backend) or `npx tsc -b` (frontend). ' +
  'To preview uncommitted frontend work: `npx vite` in frontend (port 5173).';
const NO_DEV_API = 'A second backend in this folder binds port 5000 and its port-reclaim tree-kills the LIVE API. Test backend changes with jest (npm test -- <file>), which does not bind the port.';

function outDirElsewhere(words) {
  const k = words.findIndex((w) => w === '--outDir' || w.startsWith('--outDir='));
  if (k < 0) return false;
  const v = words[k].includes('=') ? words[k].split('=')[1] : words[k + 1];
  return !!v && !/^(\.\/)?dist\/?$/.test(v);
}

function tscRule(words, dir) {
  if (sideOf(dir) !== 'backend') return null; // frontend tsconfigs are noEmit
  if (words.some((w) => w === '--noEmit' || w === '--noEmit=true' || w === '-b' || w === '--build')) return null;
  if (outDirElsewhere(words)) return null;
  return NO_BUILD('`tsc` in backend');
}

function npmRule(tokens, dir) {
  const words = tokens.map((t) => t.v);
  let d = dir;
  const pk = words.findIndex((w) => w === '--prefix' || w === '-C');
  if (pk >= 0) d = resolveDir(dir, words[pk + 1]);
  const side = sideOf(d);
  if (side !== 'backend' && side !== 'frontend') return null;
  const rest = words.slice(1).filter((w, k, a) => !(a[k - 1] === '--prefix' || a[k - 1] === '-C' || w === '--prefix' || w === '-C'));
  const verb = rest.find((w) => !w.startsWith('-'));
  const script = ['run', 'run-script', 'rum', 'urn'].includes(verb) ? rest[rest.indexOf(verb) + 1] : verb;
  if (script === 'build' || (script && script.startsWith('build:'))) {
    if (side === 'frontend' && outDirElsewhere(words)) return null;
    return NO_BUILD(`\`npm run ${script}\` in ${side}`);
  }
  if (side === 'backend' && (script === 'dev' || script === 'start')) return NO_DEV_API;
  return null;
}

function nodeRule(words, dir) {
  const script = words.slice(1).find((w) => !w.startsWith('-'));
  if (!script) return null;
  const s = script.replace(/\\/g, '/');
  if (/typescript\/bin\/tsc$/.test(s)) return tscRule(words, dir);
  if (/(^|\/)dist\/server\.js$/.test(s) && sideOf(resolveDir(dir, path.dirname(script))) === 'backend') return NO_DEV_API;
  if (/vite(\.js)?$/.test(s) && words.includes('build')) return viteRule(words, dir);
  return null;
}

function viteRule(words, dir) {
  if (sideOf(dir) !== 'frontend' || !words.includes('build')) return null;
  if (outDirElsewhere(words)) return null;
  return NO_BUILD('`vite build` in frontend');
}

const LIVE_APP = /^garment-erp-(api|web)$/;

function pm2Rule(words, ctx) {
  const action = words[1];
  const targets = words.slice(2).filter((w) => !w.startsWith('-'));
  if (!targets.some((t) => LIVE_APP.test(t))) return null;
  if (action === 'restart' || action === 'reload') {
    return '`pm2 restart/reload` on a garment-erp app races PM2\'s Windows kill and orphans the old fork. ' +
      'Deploys restart the apps themselves (npm run ship:status). To fix a sick app: node C:\\Users\\NEW\\ops\\pm2-safe-restart.js garment-erp-api:5000';
  }
  if (action === 'delete') return '`pm2 delete` on garment-erp-api/web removes the live app from PM2. Ask the owner.';
  if ((action === 'stop' || action === 'start') && !ctx.paused()) {
    return `\`pm2 ${action}\` on the live app while deploys are running could collide with the deployer. ` +
      'For a migration: npm run ship -- pause "reason"  ->  pm2 stop garment-erp-api  ->  migrate/generate  ->  pm2 start garment-erp-api  ->  npm run ship -- resume';
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
/** A Claude worktree (npm run wt -- new): { side: 'backend' | 'frontend' | 'root' } or null. */
function worktreeOf(dir) {
  const rel = path.relative(MAIN_ROOT, dir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const parts = rel.split(path.sep).join('/').split('/');
  if (parts[0].toLowerCase() !== '.claude' || (parts[1] || '').toLowerCase() !== 'worktrees' || !parts[2]) return null;
  const top = (parts[3] || '').toLowerCase();
  return { side: top === 'backend' || top === 'frontend' ? top : 'root' };
}

const WT_PRISMA =
  "node_modules in a worktree is a junction to the LIVE app's — `prisma generate` here rewrites the Prisma client the " +
  'running API uses (and once baked in a worktree path: 2026-09-26 outage), and `migrate` here moves the live database. ' +
  'Use `npm run wt -- migrate` (applies to garment_erp_test first, then live, then generates in the main folder). ' +
  'Applying to the TEST database only is fine: DATABASE_URL=…/garment_erp_test npx prisma migrate deploy.';
const WT_TSC_B =
  'In a worktree `tsc -b` reads and writes the build cache in the SHARED frontend/node_modules/.tmp and trusts its ' +
  "timestamps — another folder's cache can make it pass falsely, and yours can do that to theirs. Use `npm run wt -- check` " +
  '(type-checks this worktree with its own caches).';

/** Rules that apply only inside a Claude worktree. */
function worktreeRule(cmd, words, wt, command) {
  const tool = cmd === 'npx' || cmd === 'pnpm' || cmd === 'yarn' ? base(words.find((w, k) => k > 0 && !w.startsWith('-')) || '') : cmd;
  const args = cmd === tool ? words.slice(1) : words.slice(words.findIndex((w, k) => k > 0 && !w.startsWith('-')) + 1);
  if (tool === 'prisma' || (cmd === 'node' && args.some((w) => /prisma(\/build\/index\.js)?$/.test(w.replace(/\\/g, '/'))))) {
    const verb = args.filter((w) => !w.startsWith('-'));
    if (verb.includes('generate')) return WT_PRISMA;
    if (verb[0] === 'migrate' || verb[0] === 'db') {
      if (verb[1] === 'deploy' && /garment_erp_test\b/.test(command)) return null;
      if (verb[1] === 'status' || verb[1] === 'diff') return null;
      return WT_PRISMA;
    }
  }
  if (wt.side === 'frontend') {
    if (tool === 'tsc' && args.some((w) => w === '-b' || w === '--build')) return WT_TSC_B;
    if (cmd === 'npm' && /\b(type-check|typecheck)\b/.test(words.join(' '))) return WT_TSC_B;
  }
  return null;
}

const HEAVY_TSC =
  'A whole-backend type-check takes ~4.3 GB; two or three at once (plus a deploy build) left this PC at 0.1 GB ' +
  'free and froze the LIVE app for up to 4 minutes (2026-10-03). Run `npm run type-check` in backend (or ' +
  '`npm run wt -- check` in a worktree) — it waits its turn (scripts/ship/heavy-slot.js).';
const HEAVY_TS_NODE =
  '`ts-node` without --transpile-only type-checks the whole backend before the script runs (~3 GB for a repair ' +
  'script that read 2 rows, 2026-10-03). Add --transpile-only (keep --files): npx ts-node --files --transpile-only scripts/x.ts';

/** Backend jobs that skip the one-heavy-job-at-a-time slot (main folder and worktrees). */
function heavyJobRule(cmd, words, dir, command) {
  const wt = worktreeOf(dir);
  if (sideOf(dir) !== 'backend' && !(wt && wt.side === 'backend')) return null;
  let tool = cmd;
  let args = words.slice(1);
  if (cmd === 'npx' || cmd === 'pnpm' || cmd === 'yarn') {
    const at = words.findIndex((w, k) => k > 0 && !w.startsWith('-'));
    tool = at < 0 ? '' : base(words[at]);
    args = at < 0 ? [] : words.slice(at + 1);
  } else if (cmd === 'node') {
    const k = args.findIndex((w) => !w.startsWith('-'));
    const s = k < 0 ? '' : args[k].replace(/\\/g, '/');
    if (/typescript\/bin\/tsc$/.test(s)) tool = 'tsc';
    else if (/ts-node\/dist\/bin(\.js)?$/.test(s)) tool = 'ts-node';
    args = args.slice(k + 1);
  }
  if (tool === 'tsc' && args.includes('--noEmit') && !args.some((w) => /\.tsx?$/.test(w))) return HEAVY_TSC;
  if (tool === 'ts-node') {
    const light = args.some((w) => w === '--transpile-only' || w === '-T' || w === '--transpileOnly' || w === '--swc') ||
      /\bTS_NODE_TRANSPILE_ONLY=['"]?(true|1)\b/.test(command);
    if (!light && !args.some((w) => /server\.ts$/.test(w))) return HEAVY_TS_NODE;
  }
  return null;
}

// analysis
// ---------------------------------------------------------------------------------------------
/** Returns a list of reasons to refuse `command` run from `cwd` (empty = allow). */
function analyze(command, cwd, ctx) {
  // The owner-approved escape hatch (works for Bash `X=1 cmd` and PowerShell `$env:X=1; cmd`).
  if (/\bCLAUDE_GUARD_OK=['"]?1\b/.test(command)) return [];
  const reasons = [];
  let dir = cwd;
  for (const seg of tokenize(command)) {
    let tokens = seg;
    while (tokens.length && !tokens[0].q && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0].v)) tokens = tokens.slice(1);
    while (tokens.length && ['sudo', 'time', 'command', 'exec', 'env', 'nohup', '&', 'call', '{', '}'].includes(tokens[0].v)) tokens = tokens.slice(1);
    if (!tokens.length) continue;
    const words = tokens.map((t) => t.v);
    const cmd = base(words[0]);

    if (['cd', 'set-location', 'sl', 'pushd', 'chdir'].includes(cmd)) {
      const target = tokens.slice(1).find((t) => !isFlag(t));
      dir = resolveDir(dir, target ? target.v : os.homedir());
      continue;
    }

    let reason = null;
    const wt = cmd === 'git' ? null : worktreeOf(dir);
    if (cmd === 'git') reason = gitRule(tokens, dir, ctx);
    else if (wt) reason = worktreeRule(cmd, words, wt, command);
    else if (relToMain(dir) === null && cmd !== 'pm2') reason = null;
    else if (cmd === 'npm') reason = npmRule(tokens, dir);
    else if (cmd === 'npx' || cmd === 'pnpm' || cmd === 'yarn') {
      const at = words.findIndex((w, k) => k > 0 && !w.startsWith('-'));
      const rest = at < 0 ? [] : words.slice(at); // the tool and ALL its arguments, flags included
      const tool = rest[0] && base(rest[0]);
      if (tool === 'tsc') reason = tscRule(rest, dir);
      else if (tool === 'vite') reason = viteRule(rest, dir);
      else if ((tool === 'nodemon' || tool === 'ts-node' || tool === 'tsx') && sideOf(dir) === 'backend' && rest.some((w) => /server\.ts$/.test(w))) reason = NO_DEV_API;
      else if (tool === 'nodemon' && sideOf(dir) === 'backend') reason = NO_DEV_API;
    } else if (cmd === 'tsc') reason = tscRule(words, dir);
    else if (cmd === 'vite') reason = viteRule(words, dir);
    else if (cmd === 'nodemon' && sideOf(dir) === 'backend') reason = NO_DEV_API;
    else if (cmd === 'node') reason = nodeRule(words, dir);
    if (cmd === 'pm2') reason = pm2Rule(words, ctx);
    if (!reason && cmd !== 'git') reason = heavyJobRule(cmd, words, dir, command);
    if (reason) reasons.push(reason);
  }
  return reasons;
}

function defaultCtx(sessionId) {
  return {
    paused: () => fs.existsSync(PAUSE_FILE),
    claimsRule: (paths, dir, what) => {
      const { otherClaims, relPath } = require('./session-claims');
      const rels = paths.map((p) => relPath(path.resolve(dir, p))).filter(Boolean);
      const conflicts = otherClaims(rels, sessionId || null);
      if (!conflicts.length) return null;
      const files = [...new Set(conflicts.map((c) => c.file))].join(', ');
      return `\`${what}\` would throw away edits ANOTHER Claude terminal made and has not committed (${files}). ` +
        'Ask the owner or message that terminal first.';
    },
  };
}

function main() {
  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf-8'));
  } catch {
    return;
  }
  const command = input && input.tool_input && input.tool_input.command;
  if (typeof command !== 'string' || !command) return;
  const cwd = input.cwd || process.cwd();
  const reasons = analyze(command, cwd, defaultCtx(input.session_id));
  if (!reasons.length) return;
  const reason = `Blocked by the shared-folder guard (scripts/hooks/claude-guard.js):\n- ${reasons.join('\n- ')}\n` +
    'Only if the owner has explicitly asked for this exact command, prefix it with CLAUDE_GUARD_OK=1.';
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }));
}

module.exports = { analyze, tokenize, stripBodies };

if (require.main === module) {
  try {
    main();
  } catch (e) {
    try {
      fs.appendFileSync(path.join(MAIN_ROOT, '.git', 'claude-guard-errors.log'), `${new Date().toISOString()} ${e.stack}\n`);
    } catch { /* ignore */ }
  }
  process.exit(0);
}
