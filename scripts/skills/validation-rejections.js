#!/usr/bin/env node
/**
 * Validation Rejections — mine the API logs for every request that validateBody refused.
 *
 * A form that posts a shape the Zod schema rejects fails on EVERY use with a generic
 * "Invalid request data" — users see nothing useful and rarely report it. The middleware
 * logs each refusal (route, field, message, body keys), so the logs are the cheapest
 * place to find live instances of that bug class. This aggregates them.
 *
 * Usage:
 *   node scripts/skills/validation-rejections.js [--since YYYY-MM-DD] [--top N] [--json] [--logs <dir>]
 *
 * Reads both log formats found in backend/logs: winston JSON lines and pm2 text lines
 * (ANSI colours + timestamp prefix). The same event is written to combined*.log AND
 * pm2-*.log, so events are de-duplicated on (timestamp, route, errors).
 *
 * Route paths: before 2026-09-10 the middleware logged the router-relative req.path
 * ("/calculate"); it now logs the full path ("/api/fabric-costing/calculate"). Both appear.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const has = (n) => args.includes(n);
const opt = (n, def) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};

if (has('--help') || has('-h')) {
  console.log(`
Validation Rejections — what did validateBody refuse, where, and how often?

  node scripts/skills/validation-rejections.js [options]

Options:
  --since YYYY-MM-DD   only count events on/after this date
  --top N              show the N most frequent signatures (default 50)
  --json               machine-readable output
  --logs <dir>         log directory (default backend/logs)
  --help               this text

Reading the table:
  count      distinct rejected requests with this route+field+message
  first/last date range the signature was seen — a "last" of today is LIVE
  body keys  what the client posted (identifies the screen)

Typical fixes: form posts strings/blank → formNumber() in backend/src/schemas/common.schema.ts;
id format mismatch → the right *IdParamSchema; field name drift → align schema with the form.
`);
  process.exit(0);
}

const since = opt('--since', null);
const top = parseInt(opt('--top', '50'), 10);
const asJson = has('--json');
const logsDir = path.resolve(opt('--logs', path.join(__dirname, '..', '..', 'backend', 'logs')));

const ANSI = /\x1b\[[0-9;]*m/g;

/** Normalise one raw log line to { ts: 'YYYY-MM-DD HH:MM:SS', msg } or null. */
function parseLine(raw) {
  const line = raw.replace(ANSI, '');
  if (line.startsWith('{')) {
    try {
      const j = JSON.parse(line);
      return { ts: String(j.timestamp || '').replace('T', ' ').slice(0, 19), msg: String(j.message || '') };
    } catch {
      return null;
    }
  }
  // pm2 text: [N|name | ]2026-09-09T17:18:58: 2026-09-09 17:18:58 [warn]: message
  const m = line.match(/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})[^[]*\[\w+\]:\s?(.*)$/);
  if (!m) return null;
  return { ts: m[1].replace('T', ' '), msg: m[2] };
}

/** The Errors payload is JSON, sometimes with \" escapes when nested inside a JSON log line. */
function parseErrors(text) {
  for (const candidate of [text, text.replace(/\\"/g, '"')]) {
    try {
      const v = JSON.parse(candidate);
      if (Array.isArray(v)) return v;
    } catch {
      /* try next */
    }
  }
  return null;
}

const seen = new Set();
const agg = new Map();
let files = 0;
let events = 0;

function finalize(ev) {
  if (!ev || !ev.errors) return;
  if (since && ev.ts.slice(0, 10) < since) return;
  const dedupe = `${ev.ts}|${ev.method} ${ev.route}|${JSON.stringify(ev.errors)}`;
  if (seen.has(dedupe)) return;
  seen.add(dedupe);
  events++;
  for (const err of ev.errors) {
    const field = String(err.field ?? '').replace(/\.\d+(?=\.|$)/g, '.N') || '(body)';
    const key = `${ev.method} ${ev.route} :: ${field} :: ${err.message}`;
    const a = agg.get(key) || {
      method: ev.method,
      route: ev.route,
      field,
      message: String(err.message ?? ''),
      count: 0,
      first: ev.ts.slice(0, 10),
      last: ev.ts.slice(0, 10),
      bodyKeys: new Set(),
    };
    a.count++;
    if (ev.ts.slice(0, 10) < a.first) a.first = ev.ts.slice(0, 10);
    if (ev.ts.slice(0, 10) > a.last) a.last = ev.ts.slice(0, 10);
    if (ev.bodyKeys) a.bodyKeys.add(ev.bodyKeys);
    agg.set(key, a);
  }
}

if (!fs.existsSync(logsDir)) {
  console.error(`No log directory at ${logsDir}`);
  process.exit(1);
}

for (const f of fs.readdirSync(logsDir).filter((n) => n.endsWith('.log')).sort()) {
  files++;
  const lines = fs.readFileSync(path.join(logsDir, f), 'utf8').split(/\r?\n/);
  let open = null;
  for (const raw of lines) {
    const p = parseLine(raw);
    if (!p) continue;
    const o = p.msg.match(/Validation failed for (\w+) (\S+?):?\s*$/);
    if (o) {
      finalize(open);
      open = { ts: p.ts, method: o[1], route: o[2], errors: null, bodyKeys: null };
      continue;
    }
    if (!open) continue;
    const e = p.msg.match(/Errors:\s*(\[.*\])\s*$/);
    if (e) {
      open.errors = parseErrors(e[1]);
      continue;
    }
    const b = p.msg.match(/Body keys:\s*(.*)$/);
    if (b) {
      open.bodyKeys = b[1].trim();
      finalize(open);
      open = null;
    }
  }
  finalize(open);
}

const rows = [...agg.values()].sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1)).slice(0, top);

if (asJson) {
  console.log(JSON.stringify(rows.map((r) => ({ ...r, bodyKeys: [...r.bodyKeys] })), null, 2));
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
console.log('\n=== Validation Rejections ===');
console.log(`logs: ${logsDir} (${files} files) · distinct rejected requests: ${events}${since ? ` since ${since}` : ''}\n`);
if (rows.length === 0) {
  console.log('No validation rejections found.');
  process.exit(0);
}
const pad = (s, n) => String(s).padEnd(n);
const trunc = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
console.log(`${pad('count', 6)}${pad('first', 11)}${pad('last', 11)}${pad('route', 46)}${pad('field', 30)}message`);
console.log('-'.repeat(130));
for (const r of rows) {
  const live = r.last === today ? ' ◀ today' : '';
  console.log(
    `${pad(r.count, 6)}${pad(r.first, 11)}${pad(r.last, 11)}${pad(trunc(`${r.method} ${r.route}`, 45), 46)}${pad(trunc(r.field, 29), 30)}${r.message}${live}`
  );
  if (r.bodyKeys.size) console.log(`${' '.repeat(28)}body keys: ${[...r.bodyKeys].slice(0, 3).join(' | ')}`);
}
console.log('\nA "last" of today means users are hitting it now. Run with --help for the reading guide.');
