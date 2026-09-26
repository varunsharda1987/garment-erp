#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * session-claims — which Claude terminal edited which file, so one terminal cannot commit another
 * terminal's unfinished work.
 *
 * WHY (2026-09-26): several Claude terminals share this ONE working folder and ONE git index. A
 * commit here goes live, so a terminal that swept another terminal's half-done file into its commit
 * shipped it (70677e14 took a peer's staged AI guide; others shipped peers' edits by accident).
 *
 * How it works:
 *   record   Claude PostToolUse hook (Edit|Write|MultiEdit|NotebookEdit). Appends
 *            "<ms>\t<path>" to .git/claude-sessions/<session_id>.log. Append-only, one file per
 *            terminal, so parallel terminals never race on a write.
 *   end      Claude SessionEnd hook: appends "<ms>\t#END".
 *   check    first step of .husky/pre-commit. For every file being committed, if ANOTHER terminal
 *            edited it after that file's last commit, the commit is refused. Keyed on
 *            CLAUDE_CODE_SESSION_ID, which Claude sets in every terminal command. A commit made
 *            outside Claude (the owner in VS Code) only gets a warning.
 *            Override, only after the owner agrees:  ALLOW_SHARED_COMMIT=1 git commit ...
 *   release <file...>   this terminal gives up its claim (it will not commit those edits).
 *   list     show every live claim.
 *
 * Claims clear themselves: a claim older than the file's last commit no longer counts. Logs of
 * terminals idle for 7 days are deleted. Edits made by shell commands (sed, codemods, generators)
 * are not recorded — only Claude's Edit/Write tools are.
 *
 * Any internal error FAILS OPEN (exit 0): a bug here must never stop every terminal committing.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MAIN_ROOT = path.resolve(__dirname, '..', '..');
const CLAIMS_DIR = path.join(MAIN_ROOT, '.git', 'claude-sessions');
const PRUNE_AFTER_MS = 7 * 24 * 3600 * 1000;

/** Repo-relative posix path of a file in the MAIN checkout, or null (worktrees, .git, outside). */
function relPath(file) {
  if (!file) return null;
  const rel = path.relative(MAIN_ROOT, path.resolve(file));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const posix = rel.split(path.sep).join('/');
  if (/^(\.git|\.claude\/worktrees|node_modules)(\/|$)/i.test(posix) || /\/node_modules\//i.test(posix)) return null;
  return posix;
}

const key = (p) => p.toLowerCase();

function append(sessionId, line) {
  if (!sessionId || !/^[\w-]+$/.test(sessionId)) return;
  if (!fs.statSync(path.join(MAIN_ROOT, '.git')).isDirectory()) return; // a linked worktree copy
  fs.mkdirSync(CLAIMS_DIR, { recursive: true });
  fs.appendFileSync(path.join(CLAIMS_DIR, `${sessionId}.log`), `${line}\n`);
}

/** All sessions: { id, files: Map(lowerPath -> { path, ts }), lastSeen, ended } */
function loadSessions(dir = CLAIMS_DIR) {
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.log'));
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    const file = path.join(dir, name);
    let text;
    try {
      const stat = fs.statSync(file);
      if (Date.now() - stat.mtimeMs > PRUNE_AFTER_MS) {
        fs.rmSync(file, { force: true });
        continue;
      }
      text = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    const s = { id: name.slice(0, -4), files: new Map(), lastSeen: 0, ended: false };
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue;
      const [tsStr, a, b] = line.split('\t');
      const ts = Number(tsStr);
      if (!Number.isFinite(ts)) continue;
      s.lastSeen = Math.max(s.lastSeen, ts);
      if (a === '#END') s.ended = true;
      else if (a === '#RELEASE' && b) {
        const c = s.files.get(key(b));
        if (c && c.ts <= ts) s.files.delete(key(b));
      } else if (a && !a.startsWith('#')) {
        s.ended = false; // a resumed terminal is open again
        const prev = s.files.get(key(a));
        if (!prev || prev.ts < ts) s.files.set(key(a), { path: a, ts });
      }
    }
    out.push(s);
  }
  return out;
}

function lastCommitMs(file) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%ct', '--', file], {
      cwd: MAIN_ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out ? Number(out) * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Files in `paths` (repo-relative) that another terminal has edited since the file was last
 * committed. `me` is this terminal's session id (null = not a Claude terminal).
 */
function otherClaims(paths, me, sessions = loadSessions()) {
  const others = sessions.filter((s) => s.id !== me);
  const conflicts = [];
  for (const p of paths) {
    const k = key(p);
    let committedAt = null;
    for (const s of others) {
      const c = s.files.get(k);
      if (!c) continue;
      if (committedAt === null) committedAt = lastCommitMs(p);
      if (c.ts > committedAt) conflicts.push({ file: p, session: s.id, ts: c.ts, ended: s.ended, lastSeen: s.lastSeen });
    }
  }
  return conflicts;
}

const pad = (n) => String(n).padStart(2, '0');
function when(ms) {
  const d = new Date(ms);
  const today = new Date();
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === today.toDateString() ? hm : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hm}`;
}

function describe(c) {
  const idle = Date.now() - c.lastSeen;
  const state = c.ended ? 'terminal closed' : idle > 3 * 3600 * 1000 ? `terminal idle ${Math.round(idle / 3600000)}h` : 'terminal open';
  return `   ${c.file}\n      edited by Claude terminal ${c.session.slice(0, 8)} at ${when(c.ts)} (${state})`;
}

function readStdinJson() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf-8'));
  } catch {
    return null;
  }
}

function stagedFiles() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], {
    cwd: MAIN_ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024,
  });
  return out.split('\0').filter(Boolean);
}

function check() {
  const me = process.env.CLAUDE_CODE_SESSION_ID || null;
  const conflicts = otherClaims(stagedFiles(), me);
  if (!conflicts.length) return 0;

  const list = conflicts.map(describe).join('\n');
  if (!me) {
    console.log(`\nNote: this commit includes files a Claude terminal edited and has not committed:\n${list}\n`);
    return 0;
  }
  if (process.env.ALLOW_SHARED_COMMIT === '1') {
    console.log(`\nALLOW_SHARED_COMMIT=1 - committing files another Claude terminal also edited:\n${list}\n`);
    return 0;
  }
  console.error(`
COMMIT REFUSED - it includes files ANOTHER Claude terminal edited and has not committed:

${list}

A commit here goes live, so this would ship that terminal's unfinished work with yours.

  -> Commit only your own files, by name:   git commit -m "..." -- <your files>
  -> If you edited one of these files too, the file holds both terminals' changes. Ask the owner,
     or message that terminal (ListAgents / SendMessage) so ONE of you commits it with the other's
     agreement. Then, with that agreement:   ALLOW_SHARED_COMMIT=1 git commit ...
  -> If that terminal has abandoned the edit, it (or the owner) can drop the claim:
       node scripts/hooks/session-claims.js release <file>
`);
  return 1;
}

function release(files) {
  const me = process.env.CLAUDE_CODE_SESSION_ID;
  if (!me) {
    console.error('release must run inside a Claude terminal (CLAUDE_CODE_SESSION_ID not set)');
    return 1;
  }
  const now = Date.now();
  let n = 0;
  for (const f of files) {
    const rel = relPath(f);
    if (!rel) continue;
    append(me, `${now}\t#RELEASE\t${rel}`);
    n++;
  }
  console.log(`released ${n} file(s) for terminal ${me.slice(0, 8)}`);
  return 0;
}

function list() {
  const sessions = loadSessions();
  let any = false;
  for (const s of sessions) {
    const live = [...s.files.values()].filter((c) => c.ts > lastCommitMs(c.path));
    if (!live.length) continue;
    any = true;
    console.log(`terminal ${s.id.slice(0, 8)} (${s.ended ? 'closed' : 'open'}, last active ${when(s.lastSeen)}):`);
    for (const c of live) console.log(`   ${c.path}   (${when(c.ts)})`);
  }
  if (!any) console.log('no uncommitted claims');
  return 0;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'record') {
    const input = readStdinJson();
    const ti = (input && input.tool_input) || {};
    const rel = relPath(ti.file_path || ti.notebook_path);
    if (input && rel) append(input.session_id, `${Date.now()}\t${rel}`);
    return 0;
  }
  if (cmd === 'end') {
    const input = readStdinJson();
    if (input) append(input.session_id, `${Date.now()}\t#END`);
    return 0;
  }
  if (cmd === 'check') return check();
  if (cmd === 'release') return release(rest);
  if (cmd === 'list') return list();
  console.error('usage: session-claims.js record|end|check|release <file...>|list');
  return 2;
}

module.exports = { relPath, loadSessions, otherClaims, MAIN_ROOT, CLAIMS_DIR };

if (require.main === module) {
  let code = 0;
  try {
    code = main();
  } catch (e) {
    // Fail open: a bug in this guard must never stop every terminal from committing.
    console.error(`session-claims: internal error, not blocking (${e.message})`);
    code = 0;
  }
  process.exit(code);
}
