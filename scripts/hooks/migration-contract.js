/**
 * Migration contract check — a migration may only ADD what the running code can ignore.
 *
 * A migration is applied to the live database BEFORE its commit deploys (CLAUDE.md, How changes go
 * live), so for minutes the OLD code runs against the NEW schema. Adding a nullable / defaulted column,
 * a table, an index or an enum value is invisible to it. Dropping, renaming, retyping or tightening is
 * not: retire_legacy_jwo_status (DROP COLUMN status), wash_care_per_customer_fabric (DROP COLUMN) and
 * jwo_line_links_required (SET NOT NULL) each broke the live code until their deploy landed.
 *
 * The contract step goes in a LATER migration, once no live code uses the old shape, and carries
 * `-- allow-contract: <why>` on the statement or the comment lines just above it.
 *
 *   node scripts/hooks/migration-contract.js <migration.sql>...   (exit 1 on a violation)
 */
const fs = require('fs');
const path = require('path');

// Migrations before this were written before the rule; --all mode and the deployer skip them.
const CONTRACT_RULE_SINCE = '20261003000000';

const MIGRATION_SQL_RE = /^backend\/prisma\/migrations\/(\d{14})_[^/]+\/migration\.sql$/;

/** Split SQL into statements on `;` outside quotes, dollar-quoted bodies and comments, keeping each
 * statement's own preceding comment lines (where an allow-contract marker lives). */
function splitStatements(sql) {
  const out = [];
  let buf = '';
  let line = 1;
  let startLine = 1;
  let i = 0;
  let dollar = null;
  let quote = null;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === '\n') line++;
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        buf += dollar;
        i += dollar.length;
        dollar = null;
        continue;
      }
    } else if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end < 0 ? sql.length : end;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === '$') {
      const m = sql.slice(i).match(/^\$[A-Za-z_]*\$/);
      if (m) {
        dollar = m[0];
        buf += dollar;
        i += dollar.length;
        continue;
      }
    } else if (ch === ';') {
      out.push({ raw: buf, line: startLine });
      buf = '';
      i++;
      startLine = line;
      continue;
    }
    if (!buf.trim()) startLine = line;
    buf += ch;
    i++;
  }
  if (buf.trim()) out.push({ raw: buf, line: startLine });
  return out;
}

const stripComments = (s) => s.replace(/--[^\n]*/g, ' ');
const norm = (s) => stripComments(s).replace(/\s+/g, ' ').trim();
const unquote = (s) => s.replace(/"/g, '').toLowerCase();
const allowed = (raw) => /--[ \t]*allow-contract:[ \t]*\S/.test(raw);

/** The contract-breaking parts of one statement, as human reasons (empty = fine for old code). */
function statementProblems(stmt, createdViews) {
  const s = norm(stmt);
  const S = s.toUpperCase();
  const problems = [];
  if (/^DROP (MATERIALIZED )?VIEW\b/.test(S)) {
    const names = s.replace(/^DROP (MATERIALIZED )?VIEW (IF EXISTS )?/i, '').replace(/ (CASCADE|RESTRICT)$/i, '');
    const gone = names.split(',').map((n) => unquote(n.trim())).filter((n) => n && !createdViews.has(n));
    if (gone.length) problems.push(`DROP VIEW ${gone.join(', ')} with no CREATE VIEW of it in this migration — the running code still reads it`);
    return problems;
  }
  if (/^DROP TABLE\b/.test(S)) problems.push('DROP TABLE — the running code still reads/writes it until this commit deploys');
  if (/^DROP TYPE\b/.test(S)) problems.push('DROP TYPE — the running code still uses this enum');
  if (/^DROP SCHEMA\b/.test(S)) problems.push('DROP SCHEMA');
  if (/^TRUNCATE\b/.test(S)) problems.push('TRUNCATE — deletes every row');
  if (/^DO\b/.test(S)) {
    // A procedural block is not parsed statement by statement — any contract keyword inside it counts.
    const inner = [
      [/\bDROP COLUMN\b/, 'DROP COLUMN'],
      [/\bDROP TABLE\b/, 'DROP TABLE'],
      [/\bDROP TYPE\b/, 'DROP TYPE'],
      [/\bSET NOT NULL\b/, 'SET NOT NULL'],
      [/\bALTER COLUMN \S+ (SET DATA )?TYPE\b/, 'ALTER COLUMN … TYPE'],
      [/\bRENAME (COLUMN|TO|VALUE)\b/, 'RENAME'],
    ].filter(([re]) => re.test(S));
    for (const [, what] of inner) problems.push(`${what} inside a DO block — the running code still uses the old shape`);
    return problems;
  }
  if (/^ALTER INDEX\b/.test(S)) return problems; // an index rename/move is invisible to the code
  if (/\bRENAME\b/.test(S) && !/\bRENAME CONSTRAINT\b/.test(S)) {
    problems.push('RENAME — the running code still uses the old name; add the new one, move the code, drop the old later');
  }
  if (/^ALTER TABLE\b/.test(S)) {
    if (/\bDROP COLUMN\b/.test(S)) problems.push('DROP COLUMN — the running code still reads/writes it until this commit deploys');
    if (/\bSET NOT NULL\b/.test(S)) problems.push('SET NOT NULL — the running code may still write NULL / omit the column');
    if (/\bALTER COLUMN \S+ (SET DATA )?TYPE\b/.test(S)) problems.push('ALTER COLUMN … TYPE — the running code reads/writes the old type');
    for (const clause of s.split(/\bADD COLUMN\b/i).slice(1)) {
      const c = clause.split(/,\s*(?:ADD|DROP|ALTER)\b/i)[0].toUpperCase();
      if (/\bNOT NULL\b/.test(c) && !/\bDEFAULT\b/.test(c) && !/\bGENERATED\b/.test(c)) {
        const col = clause.trim().split(/\s+/)[0];
        problems.push(`ADD COLUMN ${col} NOT NULL with no DEFAULT — the running code's inserts omit it and fail`);
      }
    }
  }
  return problems;
}

/** Violations in one migration file's SQL: [{ line, statement, reason }]. */
function findContractViolations(sql) {
  const statements = splitStatements(sql);
  const createdViews = new Set();
  for (const st of statements) {
    const m = norm(st.raw).match(/^CREATE (?:OR REPLACE )?(?:MATERIALIZED )?VIEW (?:IF NOT EXISTS )?("?[\w.]+"?)/i);
    if (m) createdViews.add(unquote(m[1]));
  }
  const out = [];
  for (const st of statements) {
    if (allowed(st.raw)) continue;
    const firstCode = st.raw.split('\n').findIndex((l) => l.trim() && !l.trim().startsWith('--'));
    const line = st.line + Math.max(0, firstCode);
    for (const reason of statementProblems(st.raw, createdViews)) {
      out.push({ line, statement: norm(st.raw).slice(0, 140), reason });
    }
  }
  return out;
}

/** Is this repo path a migration the rule applies to? */
function isRuledMigration(relPath) {
  const m = relPath.replace(/\\/g, '/').match(MIGRATION_SQL_RE);
  return Boolean(m && m[1] >= CONTRACT_RULE_SINCE);
}

const FIX_HINT =
  'A migration is applied to the live database BEFORE its code deploys, so it may only ADD (nullable / ' +
  'defaulted columns, tables, indexes, enum values). Drop, rename, retype or tighten in a LATER migration, ' +
  'once no live code uses the old shape, and mark that statement `-- allow-contract: <why>` (on it or the ' +
  'comment lines just above). See CLAUDE.md → How changes go live.';

module.exports = { findContractViolations, isRuledMigration, splitStatements, CONTRACT_RULE_SINCE, FIX_HINT };

if (require.main === module) {
  let bad = 0;
  for (const f of process.argv.slice(2)) {
    const v = findContractViolations(fs.readFileSync(f, 'utf8'));
    for (const x of v) console.log(`${path.relative(process.cwd(), f)}:${x.line}  ${x.reason}\n    ${x.statement}`);
    bad += v.length;
  }
  if (bad) {
    console.log(`\n${bad} contract statement(s). ${FIX_HINT}`);
    process.exit(1);
  }
}
