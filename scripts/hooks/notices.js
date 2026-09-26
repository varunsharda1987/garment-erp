#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * notices — a notice board shared by every Claude terminal working in this folder.
 *
 * WHY (2026-09-26): the owner runs several Claude terminals here at once and kept having to carry
 * messages between them ("the other terminal says…"). Now anything every terminal must know is
 * posted ONCE and each terminal picks it up by itself:
 *
 *   SessionStart hook        (`session-start`)  a new terminal gets the deploy status + recent notices
 *   UserPromptSubmit hook    (`prompt`)         an open terminal gets any notice it has not seen yet,
 *                                               the next time the owner types in it
 *
 *   npm run notice -- "text" [--from <your ListAgents name>] [--sticky] [--hours N]
 *   node scripts/hooks/notices.js list | remove <id>
 *
 * The deployer and `ship` post by themselves: a deploy that FAILED/BLOCKED, deploys paused/resumed,
 * the deployer going live. To reach ONE terminal right now, use SendMessage (ListAgents) instead.
 *
 * Board: .git/claude-notices/board.jsonl (append-only, never committed). Per-terminal "seen" marks:
 * .git/claude-notices/seen/<session>.txt. Notices expire (default 48 h; --sticky = shown to every new
 * terminal until it expires, default 14 days). Any internal error prints nothing (fail open).
 */
const fs = require('fs');
const path = require('path');

const MAIN_ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(MAIN_ROOT, '.git', 'claude-notices');
const BOARD = path.join(DIR, 'board.jsonl');
const SEEN = path.join(DIR, 'seen');
const HOUR = 3600 * 1000;

function load() {
  let text = '';
  try {
    text = fs.readFileSync(BOARD, 'utf-8');
  } catch {
    return [];
  }
  const removed = new Set();
  const all = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e.remove) removed.add(e.remove);
      else if (e.id && e.text) all.push(e);
    } catch { /* skip a torn line */ }
  }
  const now = Date.now();
  return all.filter((e) => !removed.has(e.id) && (!e.expiresMs || e.expiresMs > now));
}

/** Post a notice. Used by the CLI, the deployer and ship.js. Never throws. */
function post(text, { from = null, sticky = false, hours = null } = {}) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const ms = Date.now();
    const ttl = (hours || (sticky ? 14 * 24 : 48)) * HOUR;
    const entry = {
      id: `${ms.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      ms,
      at: new Date(ms).toISOString(),
      from: from || (process.env.CLAUDE_CODE_SESSION_ID ? `terminal ${process.env.CLAUDE_CODE_SESSION_ID.slice(0, 8)}` : 'the owner'),
      session: process.env.CLAUDE_CODE_SESSION_ID || null,
      sticky: !!sticky,
      expiresMs: ms + ttl,
      text: String(text).trim(),
    };
    fs.appendFileSync(BOARD, `${JSON.stringify(entry)}\n`);
    return entry;
  } catch {
    return null;
  }
}

const pad = (n) => String(n).padStart(2, '0');
function when(ms) {
  const d = new Date(ms);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === new Date().toDateString() ? `today ${hm}` : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hm}`;
}
const show = (e) => `- [${when(e.ms)}, ${e.from}${e.sticky ? ', standing' : ''}] ${e.text}`;

function readSeen(session) {
  try {
    return Number(fs.readFileSync(path.join(SEEN, `${session}.txt`), 'utf-8')) || 0;
  } catch {
    return null;
  }
}
function writeSeen(session, ms) {
  if (!session || !/^[\w-]+$/.test(session)) return;
  try {
    fs.mkdirSync(SEEN, { recursive: true });
    fs.writeFileSync(path.join(SEEN, `${session}.txt`), String(ms));
  } catch { /* ignore */ }
}

/** One or two lines on how deploys stand right now (from the deployer's state file). */
function deployStatus() {
  try {
    const S = require('../ship/state');
    const st = S.readState();
    const running = S.pidAlive(st.deployerPid);
    if (!running) {
      return 'Deploys: the garment-erp-deployer is NOT running. Until the owner starts it, the old path is live — ' +
        'garment-erp-watcher rebuilds the live app on every save under src/, and a commit builds from the files on disk.';
    }
    let line = `Deploys: garment-erp-deployer ships COMMITTED main, one deploy at a time (after a commit: npm run ship:wait). ` +
      `Live: ${S.short(st.liveSha)} "${(st.liveSubject || '').slice(0, 80)}".`;
    if (st.state === 'deploying') line += ` Deploying ${S.short(st.targetSha)} now — API/web restarts are expected, do not diagnose them.`;
    if (st.state === 'failed' || st.state === 'blocked') line += ` LAST DEPLOY ${st.state.toUpperCase()} (${S.short(st.failedSha)}): ${String(st.error || '').split('\n')[0]}`;
    if (S.readPause()) line += ' Deploys are PAUSED (npm run ship -- resume).';
    return line;
  } catch {
    return null;
  }
}

function readStdinJson() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf-8'));
  } catch {
    return {};
  }
}

function sessionStart() {
  const input = readStdinJson();
  const notices = load();
  const cutoff = Date.now() - 48 * HOUR;
  const relevant = notices.filter((e) => e.sticky || e.ms >= cutoff);
  const out = ['[garment-erp shared folder] Several Claude terminals work in this folder at once — see CLAUDE.md "How changes go live".'];
  const status = deployStatus();
  if (status) out.push(status);
  if (relevant.length) {
    out.push('Notices from the other terminals / the deployer:');
    out.push(...relevant.slice(-12).map(show));
  }
  out.push('To tell every terminal something: npm run notice -- "text" --from <your ListAgents name>. To reach one terminal: SendMessage. Do not ask the owner to carry messages.');
  console.log(out.join('\n'));
  writeSeen(input.session_id, Math.max(Date.now(), ...notices.map((e) => e.ms)));
}

function prompt() {
  const input = readStdinJson();
  const session = input.session_id;
  if (!session) return;
  const seen = readSeen(session);
  // A terminal that was already open when the board arrived has no mark: show it the last 48 h once.
  const since = seen === null ? Date.now() - 48 * HOUR : seen;
  const fresh = load().filter((e) => e.ms > since && e.session !== session);
  if (!fresh.length) {
    if (seen === null) writeSeen(session, Date.now());
    return;
  }
  console.log(['[garment-erp] New notice(s) for every terminal in this folder — take them into account:', ...fresh.map(show)].join('\n'));
  writeSeen(session, Math.max(...fresh.map((e) => e.ms)));
}

function cli(args) {
  const [cmd, ...rest] = args;
  if (cmd === 'post') {
    const opts = { sticky: false, from: null, hours: null };
    const words = [];
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--sticky') opts.sticky = true;
      else if (rest[i] === '--from') opts.from = rest[++i];
      else if (rest[i] === '--hours') opts.hours = Number(rest[++i]) || null;
      else words.push(rest[i]);
    }
    const text = words.join(' ').trim();
    if (!text) {
      console.error('usage: npm run notice -- "text" [--from <your ListAgents name>] [--sticky] [--hours N]');
      return 2;
    }
    const e = post(text, opts);
    console.log(e ? `posted ${e.id} — every garment-erp terminal sees it on its next prompt (new ones at start)` : 'could not post');
    return e ? 0 : 1;
  }
  if (cmd === 'list') {
    const all = load();
    console.log(all.length ? all.map((e) => `${e.id}  ${show(e)}`).join('\n') : 'no current notices');
    return 0;
  }
  if (cmd === 'remove' && rest[0]) {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(BOARD, `${JSON.stringify({ remove: rest[0], at: new Date().toISOString() })}\n`);
    console.log(`removed ${rest[0]}`);
    return 0;
  }
  if (cmd === 'session-start') return sessionStart() || 0;
  if (cmd === 'prompt') return prompt() || 0;
  console.error('usage: notices.js post "text" [--from name] [--sticky] [--hours N] | list | remove <id> | session-start | prompt');
  return 2;
}

module.exports = { post, load, deployStatus };

if (require.main === module) {
  let code = 0;
  try {
    code = cli(process.argv.slice(2));
  } catch {
    code = 0; // a hook must never break a terminal
  }
  process.exit(code);
}
