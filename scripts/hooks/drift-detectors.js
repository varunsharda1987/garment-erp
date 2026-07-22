/**
 * Pure detectors for the schema-drift + money-math guardrails.
 *
 * Each detector takes a list of repo-relative file paths and returns an array of
 * { key, file, line, detail }. `key` is line-number-independent (path + normalized
 * expression / structural identity) so it survives reformatting and a NEW violation
 * inside an already-baselined file is still distinguishable. smart-check.js diffs these
 * keys against a committed baseline (see ratchet.js) and blocks only fresh ones.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function readRel(rel) {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Blank out comment bodies (replace with spaces, preserving newlines and length so line/index
 * math is unchanged) while leaving string literals intact. Prevents a pattern that merely appears
 * in a comment — e.g. the "/ (1 - s/100)" example inside a doc comment — from being flagged.
 */
function blankComments(src) {
  let out = '';
  let mode = 'code'; // code | line | block | sq | dq | tpl
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const nx = src[i + 1];
    if (mode === 'line') {
      out += ch === '\n' ? '\n' : ' ';
      if (ch === '\n') mode = 'code';
      continue;
    }
    if (mode === 'block') {
      if (ch === '*' && nx === '/') {
        out += '  ';
        i++;
        mode = 'code';
      } else out += ch === '\n' ? '\n' : ' ';
      continue;
    }
    if (mode === 'sq' || mode === 'dq' || mode === 'tpl') {
      out += ch;
      if (ch === '\\') {
        if (nx !== undefined) {
          out += nx;
          i++;
        }
      } else if ((mode === 'sq' && ch === "'") || (mode === 'dq' && ch === '"') || (mode === 'tpl' && ch === '`')) {
        mode = 'code';
      }
      continue;
    }
    if (ch === '/' && nx === '/') {
      out += '  ';
      i++;
      mode = 'line';
      continue;
    }
    if (ch === '/' && nx === '*') {
      out += '  ';
      i++;
      mode = 'block';
      continue;
    }
    if (ch === "'") mode = 'sq';
    else if (ch === '"') mode = 'dq';
    else if (ch === '`') mode = 'tpl';
    out += ch;
  }
  return out;
}

// Read a file with comments blanked; skip template/scaffold files (they hold illustrative examples).
function readCode(rel) {
  if (/\.template\.|\/templates?\//.test(rel)) return null;
  const raw = readRel(rel);
  return raw == null ? null : blankComments(raw);
}

function lineOf(content, idx) {
  return content.slice(0, idx).split('\n').length;
}

/**
 * From an index pointing at '(', return the balanced "(...)" substring, skipping over
 * string literals and comments so nested parens inside strings don't throw off the count.
 */
function sliceBalanced(content, openIdx) {
  let depth = 0;
  let str = null;
  let line = false;
  let block = false;
  for (let i = openIdx; i < content.length; i++) {
    const ch = content[i];
    const nx = content[i + 1];
    if (line) {
      if (ch === '\n') line = false;
      continue;
    }
    if (block) {
      if (ch === '*' && nx === '/') {
        block = false;
        i++;
      }
      continue;
    }
    if (str) {
      if (ch === '\\') i++;
      else if (ch === str) str = null;
      continue;
    }
    if (ch === '/' && nx === '/') {
      line = true;
      i++;
      continue;
    }
    if (ch === '/' && nx === '*') {
      block = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      str = ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return content.slice(openIdx, i + 1);
    }
  }
  return content.slice(openIdx);
}

// A2 — a POST/PUT/PATCH route with no validateBody/validateQuery (per-route, not per-file).
const MUT_VERB_RE = /router\.(post|put|patch)\s*\(/g;
function perRouteValidation(relFiles) {
  const out = [];
  for (const rel of relFiles) {
    if (!rel.endsWith('.routes.ts')) continue;
    const content = readCode(rel);
    if (!content) continue;
    MUT_VERB_RE.lastIndex = 0;
    let m;
    while ((m = MUT_VERB_RE.exec(content))) {
      const verb = m[1].toUpperCase();
      const openIdx = m.index + m[0].length - 1; // the '('
      const call = sliceBalanced(content, openIdx);
      const pathM = call.match(/^\(\s*['"`]([^'"`]*)['"`]/);
      const routePath = pathM ? pathM[1] : '?';
      const validated = /\bvalidateBody\s*\(|\bvalidateQuery\s*\(/.test(call);
      // Opt-out for genuinely body-less mutations: `// no-body` in the call or just above it.
      const optOut = /no-body/.test(call) || /no-body/.test(content.slice(Math.max(0, m.index - 80), m.index));
      if (!validated && !optOut) {
        out.push({
          key: `${rel} :: ${verb} ${routePath}`,
          file: rel,
          line: lineOf(content, m.index),
          detail: `${verb} ${routePath} has no validateBody/validateQuery`,
        });
      }
    }
  }
  return out;
}

// A3 — a Zod enum value that is not in the correspondingly-named Prisma enum (guaranteed reject/500).
function parsePrismaEnums() {
  const content = readRel('backend/prisma/schema.prisma') || '';
  const map = new Map();
  const re = /enum\s+(\w+)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(content))) {
    const values = m[2]
      .split(/\r?\n/)
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter((v) => /^\w+$/.test(v));
    map.set(m[1].toLowerCase(), { name: m[1], values: new Set(values) });
  }
  return map;
}

function enumDrift(relFiles) {
  const prisma = parsePrismaEnums();
  const out = [];
  // `const XxxEnum = z.enum([...])`  OR  `field: z.enum([...])`
  const re = /(?:const\s+(\w+?)(?:Enum)?\s*=\s*|(\w+)\s*:\s*)z\.enum\(\s*\[([^\]]*)\]/g;
  for (const rel of relFiles) {
    if (!rel.endsWith('.schema.ts')) continue;
    const content = readCode(rel);
    if (!content) continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      const nameHint = m[1] || m[2];
      if (!nameHint) continue;
      const pEnum = prisma.get(nameHint.toLowerCase());
      if (!pEnum) continue; // no clearly-corresponding Prisma enum → skip (false-positive guard)
      const values = [...m[3].matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1]);
      if (!values.length) continue;
      // HARDENED (Phase-3 review): the old "skip if < half the values match" guard is exactly how a
      // ZERO-overlap SampleTypeEnum shipped and killed sample creation — a name that matches a Prisma
      // enum but shares no values is the WORST drift, not noise. Name-matched enums are now always
      // compared: zero overlap → one loud violation; partial → per-missing-value violations.
      const matched = values.filter((v) => pEnum.values.has(v)).length;
      const line = lineOf(content, m.index);
      if (matched === 0) {
        out.push({
          key: `${rel} :: ${nameHint} :: ZERO-OVERLAP`,
          file: rel,
          line,
          detail: `Zod enum ${nameHint} shares NO values with Prisma enum ${pEnum.name} — the endpoint using it is dead (every real value 400s, every Zod value 500s)`,
        });
      } else {
        for (const v of values) {
          if (!pEnum.values.has(v)) {
            out.push({
              key: `${rel} :: ${nameHint} :: ${v}`,
              file: rel,
              line,
              detail: `Zod value '${v}' is not in Prisma enum ${pEnum.name}`,
            });
          }
        }
      }
    }
  }
  return out;
}

// A4 — z.string().datetime() in a schema; rejects <input type="date"> YYYY-MM-DD. Use z.coerce.date().
function datetimeSchema(relFiles) {
  const out = [];
  const re = /(\w+)\s*:\s*z\.string\(\)\.datetime\(/g;
  for (const rel of relFiles) {
    if (!rel.endsWith('.schema.ts')) continue;
    const content = readCode(rel);
    if (!content) continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      const lineStart = content.lastIndexOf('\n', m.index) + 1;
      let lineEnd = content.indexOf('\n', m.index);
      if (lineEnd === -1) lineEnd = content.length;
      if (/allow-datetime/.test(content.slice(lineStart, lineEnd))) continue; // opt-out
      out.push({
        key: `${rel} :: ${m[1]}`,
        file: rel,
        line: lineOf(content, m.index),
        detail: `${m[1]} uses z.string().datetime() — use z.coerce.date() for date-input fields`,
      });
    }
  }
  return out;
}

// B1 — raw divide-by-shrinkage `/ (1 - <expr> / 100)`; use divideByShrinkage() (guards >= 100).
function shrinkageDivide(relFiles) {
  const out = [];
  const re = /\/\s*\(\s*1\s*-\s*[^)]*?\/\s*100\s*\)/g;
  for (const rel of relFiles) {
    if (!/\.(ts|tsx)$/.test(rel)) continue;
    const content = readCode(rel);
    if (!content) continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      const norm = m[0].replace(/\s+/g, '');
      out.push({
        key: `${rel} :: ${norm}`,
        file: rel,
        line: lineOf(content, m.index),
        detail: `raw divide-by-shrinkage "${norm}" — route through divideByShrinkage()`,
      });
    }
  }
  return out;
}

// B2 — en-IN currency toLocaleString with minimumFractionDigits but no maximumFractionDigits.
function currencyFormat(relFiles) {
  const out = [];
  const re = /toLocaleString\(\s*['"]en-IN['"]\s*,\s*\{([\s\S]*?)\}/g;
  for (const rel of relFiles) {
    if (!/\.(ts|tsx)$/.test(rel)) continue;
    const content = readCode(rel);
    if (!content) continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      const opts = m[1];
      if (!/minimumFractionDigits/.test(opts)) continue; // narrow to money-style formatting
      if (/maximumFractionDigits/.test(opts)) continue; // already correct
      const norm = opts.replace(/\s+/g, ' ').trim();
      out.push({
        key: `${rel} :: {${norm}}`,
        file: rel,
        line: lineOf(content, m.index),
        detail: `en-IN currency format missing maximumFractionDigits`,
      });
    }
  }
  return out;
}

// C1 — controller re-parses req.body/req.query with its own schema after route-level validation.
// Two independently-maintained schemas for one request ALWAYS drift (Phase-3: the cost-sheet edit
// endpoint silently discarded every edit because the route schema and controller schema shared zero
// fields). Rule: exactly ONE schema per endpoint, applied by the route's validateBody/validateQuery.
function controllerReparse(relFiles) {
  const out = [];
  const re = /(\w+)\.(?:safeParse|parse)\(\s*req\.(body|query)\s*\)/g;
  for (const rel of relFiles) {
    if (!/controllers\/.*\.controller\.ts$/.test(rel.replace(/\\/g, '/'))) continue;
    const content = readCode(rel);
    if (!content) continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      const lineStart = content.lastIndexOf('\n', m.index) + 1;
      let lineEnd = content.indexOf('\n', m.index);
      if (lineEnd === -1) lineEnd = content.length;
      if (/allow-reparse/.test(content.slice(lineStart, lineEnd))) continue; // opt-out
      out.push({
        key: `${rel} :: ${m[1]}.parse(req.${m[2]})`,
        file: rel,
        line: lineOf(content, m.index),
        detail: `controller re-parses req.${m[2]} with ${m[1]} — validate ONCE at the route (validateBody/validateQuery) with this schema and type req.${m[2]} instead`,
      });
    }
  }
  return out;
}

// C2 — the GLOBAL prisma client used for a WRITE inside a $transaction callback. It opens a second
// connection and ESCAPES ROLLBACK (Phase-3: GRN receiving called createStockIn on the global client
// inside the receive tx — stock rows survived a rolled-back receipt). Use the tx client.
function globalPrismaInTx(relFiles) {
  const out = [];
  const txRe = /\$transaction\s*\(/g;
  const writeRe = /(?:^|[^.\w])((?:this\.)?prisma)\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/g;
  for (const rel of relFiles) {
    if (!/\.(ts)$/.test(rel)) continue;
    const content = readCode(rel);
    if (!content) continue;
    txRe.lastIndex = 0;
    let t;
    while ((t = txRe.exec(content))) {
      const call = sliceBalanced(content, t.index + t[0].length - 1);
      // only interactive transactions (async callback) — array-form txs pass promises built elsewhere
      if (!/^\(\s*async/.test(call)) continue;
      writeRe.lastIndex = 0;
      let w;
      while ((w = writeRe.exec(call))) {
        if (w[2].startsWith('$')) continue;
        const abs = t.index + t[0].length - 1 + w.index;
        const lineStart = content.lastIndexOf('\n', abs) + 1;
        let lineEnd = content.indexOf('\n', abs);
        if (lineEnd === -1) lineEnd = content.length;
        if (/allow-global-prisma/.test(content.slice(lineStart, lineEnd))) continue; // opt-out
        out.push({
          key: `${rel} :: tx :: ${w[1]}.${w[2]}.${w[3]}`,
          file: rel,
          line: lineOf(content, abs),
          detail: `${w[1]}.${w[2]}.${w[3]}() inside a $transaction callback — use the tx client or the write escapes rollback`,
        });
      }
    }
  }
  return out;
}

// C3 — Prisma Decimal fields compared with a raw relational operator. Decimals compare as STRINGS
// ("95" >= "100" is true — Phase-3: the fully-received gate flipped on digit count). Both sides
// must look like money/qty property accesses; wrapping in Number() breaks the pattern (the fix).
function decimalCompare(relFiles) {
  const out = [];
  const FIELD = String.raw`\w+\.\w*(?:Quantity|Amount|Qty|Price|Cost|Balance|Total)`;
  const re = new RegExp(`(${FIELD})\\s*(>=|<=|>|<)\\s*(${FIELD})`, 'g');
  for (const rel of relFiles) {
    if (!/\.(ts|tsx)$/.test(rel)) continue;
    const content = readCode(rel);
    if (!content) continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      const lineStart = content.lastIndexOf('\n', m.index) + 1;
      let lineEnd = content.indexOf('\n', m.index);
      if (lineEnd === -1) lineEnd = content.length;
      const lineText = content.slice(lineStart, lineEnd);
      if (/allow-decimal-compare/.test(lineText)) continue; // opt-out
      // Number(x.fooQty) >= ... doesn't match (the ')' sits between field and operator), but skip
      // lines that already coerce BOTH sides some other way (.toNumber() etc.)
      if (/\.toNumber\(\)/.test(lineText)) continue;
      out.push({
        key: `${rel} :: ${m[1]}${m[2]}${m[3]}`.replace(/\s+/g, ''),
        file: rel,
        line: lineOf(content, m.index),
        detail: `raw '${m[2]}' between ${m[1]} and ${m[3]} — Prisma Decimals compare as strings; wrap both in Number() or use .gte()/.lte()`,
      });
    }
  }
  return out;
}

// C4 — count()/findFirst-max+1 document numbering: racy (duplicate legal numbers under concurrency)
// and permanently wedges at padded limits (Phase-3: CN numbering stuck at #999). Use a sequence
// table with retry-on-P2002.
function countNumbering(relFiles) {
  const out = [];
  const fnRe = /(?:async\s+)?(generate\w*(?:Number|Code)\w*)\s*\(/g;
  for (const rel of relFiles) {
    if (!/\.(ts)$/.test(rel)) continue;
    const content = readCode(rel);
    if (!content) continue;
    fnRe.lastIndex = 0;
    let m;
    while ((m = fnRe.exec(content))) {
      // examine the ~50 lines after the generator's definition
      const slice = content.slice(m.index, m.index + 2500);
      if (/allow-count-numbering/.test(slice.slice(0, 200))) continue; // opt-out near the signature
      if (/\.count\s*\(/.test(slice) || /findFirst\s*\([\s\S]{0,300}?orderBy/.test(slice)) {
        out.push({
          key: `${rel} :: ${m[1]}`,
          file: rel,
          line: lineOf(content, m.index),
          detail: `${m[1]}() derives the next number from count()/findFirst-max — racy duplicates + wedges at padded limits; use a sequence table with retry-on-P2002`,
        });
      }
    }
  }
  return out;
}

module.exports = {
  perRouteValidation,
  enumDrift,
  datetimeSchema,
  shrinkageDivide,
  currencyFormat,
  controllerReparse,
  globalPrismaInTx,
  decimalCompare,
  countNumbering,
  REPO_ROOT,
};
