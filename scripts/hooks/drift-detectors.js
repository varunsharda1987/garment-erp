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
      // Preserve line comments carrying detector opt-out markers (allow-*, no-body) verbatim —
      // blanking them made every documented opt-out unmatchable (latent guardrail bug).
      let eol = src.indexOf('\n', i);
      if (eol === -1) eol = src.length;
      const comment = src.slice(i, eol);
      if (/allow-[a-z-]+|no-body/.test(comment)) {
        out += comment;
        i = eol - 1;
        continue;
      }
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
      // Opt-out for genuinely body-less mutations: `// no-body` in the call, or in the comment block
      // directly above it. Scan back over whole COMMENT LINES rather than a fixed 80-char window —
      // that window silently ignored any marker whose explanatory comment ran past ~82 chars, so a
      // correctly-marked route kept being reported and the author had no way to see why.
      const lines = content.slice(0, m.index).split('\n');
      let precedingComment = '';
      // Walk up from the route, collecting the comment block immediately above it. STOP at the first
      // line of real code so we can't pick up an unrelated comment further up the file.
      for (let i = lines.length - 2; i >= 0; i--) {
        const t = lines[i].trim();
        if (t === '') continue;
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) {
          precedingComment += t + '\n';
          continue;
        }
        break;
      }
      const optOut = /no-body/.test(call) || /no-body/.test(precedingComment);
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
  // Definitions only (matching CALL sites false-positived whenever unrelated pagination
  // count()/findFirst followed within ~50 lines). Covers method (`async name(`), function
  // (`function name(`), and const-arrow (`const name = async (`) forms — the arrow form
  // hid finishing's FI- generator from the original sweep.
  const fnRe =
    /(?:async\s+function\s+|function\s+|async\s+|(?:const|let)\s+)(generate\w*(?:Number|Code)\w*)\s*(?:=\s*(?:async\s*)?)?\(/g;
  for (const rel of relFiles) {
    if (!/\.(ts)$/.test(rel)) continue;
    const content = readCode(rel);
    if (!content) continue;
    fnRe.lastIndex = 0;
    let m;
    while ((m = fnRe.exec(content))) {
      if (/^generateAtomic/.test(m[1])) continue; // the atomic helpers ARE the fix
      // Examine only the generator's own brace-balanced body (fallback: ~50 lines) so
      // count()/findFirst in unrelated code later in the file can't false-positive.
      const params = sliceBalanced(content, m.index + m[0].length - 1);
      const bodyOpen = content.indexOf('{', m.index + m[0].length - 1 + params.length);
      const slice =
        bodyOpen === -1 ? content.slice(m.index, m.index + 2500) : sliceBalancedBraces(content, bodyOpen);
      if (/allow-count-numbering/.test(content.slice(m.index, m.index + 200))) continue; // opt-out near the signature
      if (/generateAtomic/.test(slice)) continue; // migrated: delegates to the atomic sequence helper
      if (/\.count\s*\(/.test(slice) || /findFirst\s*\([\s\S]{0,300}?orderBy/.test(slice)) {
        out.push({
          key: `${rel} :: ${m[1]}`,
          file: rel,
          line: lineOf(content, m.index),
          detail: `${m[1]}() derives the next number from count()/findFirst-max — racy duplicates + wedges at padded limits; use a sequence table with retry-on-P2002`,
        });
      }
    }
    // Inline count-numbering (no named generator at all): `.count(...)` whose result feeds
    // `x + 1` and a padStart within a short window — the transfer-slip TS-YYYYMMDD pattern.
    const inlineRe = /\.count\s*\(/g;
    let n = 0;
    let im;
    while ((im = inlineRe.exec(content))) {
      const win = content.slice(im.index, im.index + 500);
      if (!/\w+\s*\+\s*1\b/.test(win) || !/padStart\s*\(/.test(win)) continue;
      if (/allow-count-numbering/.test(win) || /generateAtomic/.test(win)) continue;
      // Skip if this .count( sits inside a named generate* body (already reported above).
      const before = content.slice(Math.max(0, im.index - 3000), im.index);
      if (/(?:function\s+|async\s+|(?:const|let)\s+)generate\w*(?:Number|Code)\w*\s*(?:=\s*(?:async\s*)?)?\([^)]*\)[^{]*\{[^]*$/.test(before)) continue;
      n++;
      out.push({
        key: `${rel} :: inline-count-numbering #${n}`,
        file: rel,
        line: lineOf(content, im.index),
        detail: `inline count()+1+padStart numbering — racy duplicates; route through the atomic sequence helper`,
      });
    }
  }
  return out;
}

/** Brace-balanced variant of sliceBalanced: from an index pointing at '{', return "{...}". */
function sliceBalancedBraces(content, openIdx) {
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
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return content.slice(openIdx, i + 1);
    }
  }
  return content.slice(openIdx);
}

// C5 — a try block containing a Prisma write whose catch only logs (or is empty). The write's
// failure vanishes: caller proceeds as if it committed (the ledger-drift bug class — GRN stock
// sync, tracking auto-creates). A catch around a write must rethrow, respond, or set a surfaced
// flag; pure logging is a silent data-loss path. Opt-out: `// allow-swallow` inside the catch.
function swallowedWriteErrors(relFiles) {
  const out = [];
  const writeRe = /\b(?:tx|prisma|this\.prisma)\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/;
  const tryRe = /\btry\s*\{/g;
  for (const rel of relFiles) {
    const norm = rel.replace(/\\/g, '/');
    if (!/backend\/src\/.*\.ts$/.test(norm) || /\.test\.ts$/.test(norm)) continue;
    const content = readCode(rel);
    if (!content) continue;
    tryRe.lastIndex = 0;
    let m;
    const seen = new Map(); // dedupe key collisions deterministically by occurrence order
    while ((m = tryRe.exec(content))) {
      const tryOpen = m.index + m[0].length - 1;
      const tryBody = sliceBalancedBraces(content, tryOpen);
      const w = tryBody.match(writeRe);
      if (!w || w[1].startsWith('$')) continue;
      const afterTry = content.slice(tryOpen + tryBody.length);
      const catchM = afterTry.match(/^\s*catch\s*(?:\(\s*[^)]*\))?\s*\{/);
      if (!catchM) continue;
      const catchOpen = tryOpen + tryBody.length + catchM[0].length - 1;
      const catchInner = sliceBalancedBraces(content, catchOpen).slice(1, -1);
      if (/allow-swallow/.test(catchInner)) continue; // opt-out
      // A catch that rethrows, responds, returns, forwards, or records the failure into a
      // surfaced variable is fine — only pure logging (or emptiness) is a swallow. Logging
      // calls are masked first so their argument text can't fake a meaningful action.
      const masked = catchInner.replace(
        /\b(?:logger\s*\.\s*\w+|console\s*\.\s*\w+|logError|logWarn|logInfo|logDebug)\s*\(/g,
        '__LOG__('
      );
      const withoutLogArgs = masked.replace(/__LOG__\((?:[^()]|\([^()]*\))*\)/g, '__LOG__');
      const meaningful = /\bthrow\b|\bres\.\w+|\breturn\b|\bnext\s*\(|[\w.\]]\s*=[^=]/.test(withoutLogArgs);
      if (meaningful) continue;
      let key = `${rel} :: swallow :: ${w[1]}.${w[2]}`;
      const n = (seen.get(key) || 0) + 1;
      seen.set(key, n);
      if (n > 1) key += ` #${n}`;
      out.push({
        key,
        file: rel,
        line: lineOf(content, m.index),
        detail: `catch around ${w[1]}.${w[2]}() only logs — the write's failure is silent (drift). Rethrow, respond, surface a flag, or mark \`// allow-swallow\` if truly best-effort`,
      });
    }
  }
  return out;
}

// C6 — a quantity/balance-ish field ASSIGNED an arithmetic expression inside prisma update data.
// `qty: current + delta` is the read-modify-write lost-update pattern (two concurrent requests both
// read, both write, one delta vanishes). Use `{ increment: delta }` / `{ decrement: ... }`, or hold
// a row lock (a `FOR UPDATE` in the preceding ~1500 chars suppresses the flag). Plain-variable
// assignments (derived totals) don't match — only visible +/- arithmetic. Opt-out: `// allow-assign`.
function assignNotIncrement(relFiles) {
  const out = [];
  const callRe = /\b(?:tx|prisma|this\.prisma)\.(\w+)\.(update|updateMany|upsert)\s*\(/g;
  const FIELD = /(\w*(?:[Qq]uantity|[Qq]ty|[Bb]alance|[Ss]tock(?:Value)?|[Aa]mount|[Mm]eters)\w*)\s*:\s*([^,\n}]+)/g;
  for (const rel of relFiles) {
    const norm = rel.replace(/\\/g, '/');
    if (!/backend\/src\/.*\.ts$/.test(norm) || /\.test\.ts$/.test(norm)) continue;
    const content = readCode(rel);
    if (!content) continue;
    callRe.lastIndex = 0;
    let m;
    while ((m = callRe.exec(content))) {
      if (m[1].startsWith('$')) continue;
      // Row-locked recomputes assign absolutes safely — a FOR UPDATE shortly before is the tell.
      if (/FOR UPDATE/.test(content.slice(Math.max(0, m.index - 1500), m.index))) continue;
      const call = sliceBalanced(content, m.index + m[0].length - 1);
      const dataM = call.match(/\bdata\s*:\s*\{/);
      if (!dataM) continue;
      const dataBody = sliceBalancedBraces(call, dataM.index + dataM[0].length - 1);
      FIELD.lastIndex = 0;
      let f;
      while ((f = FIELD.exec(dataBody))) {
        const expr = f[2].trim();
        if (expr.startsWith('{')) continue; // { increment: ... } / { set: ... } forms
        if (!/[+\-]/.test(expr)) continue; // only flag visible read-modify arithmetic
        if (/^-?\d+(?:\.\d+)?$/.test(expr)) continue; // literal (incl. negative) is deliberate
        const abs = m.index + m[0].length - 1 + dataM.index + dataM[0].length - 1 + f.index;
        // Opt-out: `// allow-assign` anywhere on the field's line or the line above it.
        const lineStart = content.lastIndexOf('\n', abs) + 1;
        let lineEnd = content.indexOf('\n', abs);
        if (lineEnd === -1) lineEnd = content.length;
        const prevLineStart = content.lastIndexOf('\n', Math.max(0, lineStart - 2)) + 1;
        if (/allow-assign/.test(content.slice(prevLineStart, lineEnd))) continue;
        out.push({
          key: `${rel} :: ${m[1]}.${m[2]} :: ${f[1]}:${expr.replace(/\s+/g, '')}`,
          file: rel,
          line: lineOf(content, abs),
          detail: `${m[1]}.${m[2]} assigns ${f[1]} an arithmetic value ("${expr}") — lost-update race; use { increment/decrement } or hold a FOR UPDATE row lock (or mark \`// allow-assign\`)`,
        });
      }
    }
  }
  return out;
}

// C7 — schema↔frontend payload parity: a REQUIRED field in a backend create-schema that the paired
// frontend request type doesn't declare. The frontend compiles a payload the API will 400 (or the
// page "saves" and the API rejects it — Phase-3's dead-write-endpoint class). Convention-paired:
// backend/src/schemas/<mod>.schema.ts × frontend/src/types/<mod>.types.ts, createXSchema × CreateXRequest.
// Pairs that don't both exist are skipped. Opt-out: `// allow-parity` on the interface line.
function parseZodObjectFields(objBody) {
  const inner = objBody.slice(1, -1);
  const fields = [];
  let depth = 0;
  let start = 0;
  const entries = [];
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      entries.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  entries.push(inner.slice(start));
  for (const e of entries) {
    const nm = e.match(/^\s*(\w+)\s*:/);
    if (!nm) continue;
    const required = !/\.optional\s*\(|\.default\s*\(|\.nullish\s*\(|\.catch\s*\(/.test(e);
    fields.push({ name: nm[1], required });
  }
  return fields;
}

function schemaFrontendParity(relFiles) {
  const out = [];
  const changed = new Set(relFiles.map((f) => f.replace(/\\/g, '/')));
  // run on every schema whose file OR paired type file is in scope
  const schemaRels = [...changed].filter((f) => /^backend\/src\/schemas\/\w+\.schema\.ts$/.test(f));
  for (const typeRel of [...changed].filter((f) => /^frontend\/src\/types\/\w+\.types\.ts$/.test(f))) {
    const mod = typeRel.match(/(\w+)\.types\.ts$/)[1];
    const pair = `backend/src/schemas/${mod}.schema.ts`;
    if (!schemaRels.includes(pair) && readRel(pair) != null) schemaRels.push(pair);
  }
  for (const schemaRel of schemaRels) {
    const mod = schemaRel.match(/(\w+)\.schema\.ts$/)[1];
    const typeRel = `frontend/src/types/${mod}.types.ts`;
    const schemaContent = readCode(schemaRel);
    const typeContentRaw = readRel(typeRel);
    if (!schemaContent || typeContentRaw == null) continue; // no pair — out of scope
    const typeContent = blankComments(typeContentRaw);
    const schemaRe = /export const (create\w*Schema)\s*=\s*z\s*\.object\s*\(\s*\{/g;
    let m;
    while ((m = schemaRe.exec(schemaContent))) {
      const objBody = sliceBalancedBraces(schemaContent, m.index + m[0].length - 1);
      const fields = parseZodObjectFields(objBody).filter((f) => f.required);
      if (!fields.length) continue;
      // createAgencySchema -> CreateAgencyRequest
      const ifaceName = m[1].replace(/Schema$/, 'Request').replace(/^create/, 'Create');
      const ifaceM = typeContent.match(new RegExp(`interface\\s+${ifaceName}\\s*(extends [^{]+)?\\{`));
      if (!ifaceM) continue; // no paired request type — skip (interface may be named differently)
      if (ifaceM[1]) continue; // extends — inherited fields not cheaply resolvable
      const ifaceLine = typeContentRaw.split('\n')[lineOf(typeContent, ifaceM.index) - 1] || '';
      if (/allow-parity/.test(ifaceLine)) continue; // opt-out
      const ifaceBody = sliceBalancedBraces(typeContent, ifaceM.index + ifaceM[0].length - 1);
      const ifaceFields = new Set([...ifaceBody.matchAll(/^\s*(\w+)\??\s*:/gm)].map((x) => x[1]));
      for (const f of fields) {
        if (ifaceFields.has(f.name)) continue;
        out.push({
          key: `${schemaRel} :: ${m[1]}.${f.name} :: missing-in ${ifaceName}`,
          file: schemaRel,
          line: lineOf(schemaContent, m.index),
          detail: `required field "${f.name}" of ${m[1]} is absent from frontend ${ifaceName} (${typeRel}) — the typed frontend payload will be rejected by the API`,
        });
      }
    }
  }
  return out;
}

// Split a "(...)"-inner argument string on top-level commas (nested calls/objects/arrays and
// string literals are skipped). Used to inspect individual call arguments positionally.
function splitTopLevelArgs(inner) {
  const args = [];
  let cur = '';
  let depth = 0;
  let str = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (str) {
      cur += ch;
      if (ch === '\\') {
        cur += inner[i + 1] ?? '';
        i++;
      } else if (ch === str) str = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      str = ch;
      cur += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      args.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

// D1 — syncStockLevelQuantity() called without a warehouseId (arg 3 missing or literally
// `undefined`). The helper now refuses to run an unscoped multi-warehouse update (bug-hunt
// BH-0030), but a warehouse-less call still forces it to GUESS the target row — every caller
// that knows the warehouse must pass it. Opt-out: `// allow-no-warehouse` on the line.
function stockSyncNoWarehouse(relFiles) {
  const out = [];
  for (const rel of relFiles) {
    const norm = rel.replace(/\\/g, '/');
    if (!/backend\/src\/.*\.ts$/.test(norm)) continue;
    if (/\.test\.ts$|__tests__|material-sync\.helper\.ts$/.test(norm)) continue;
    const content = readCode(rel);
    if (!content) continue;
    const re = /\bsyncStockLevelQuantity\s*\(/g;
    let m;
    const seen = new Map();
    while ((m = re.exec(content))) {
      const call = sliceBalanced(content, m.index + m[0].length - 1);
      const args = splitTopLevelArgs(call.slice(1, -1));
      const wh = (args[2] || '').trim();
      if (wh && wh !== 'undefined' && wh !== 'null') continue; // warehouse passed
      const lineText = content.split('\n')[lineOf(content, m.index) - 1] || '';
      if (/allow-no-warehouse/.test(lineText)) continue; // opt-out
      let key = `${rel} :: sync-no-warehouse :: ${(args[0] || '?').replace(/\s+/g, '')}`;
      const n = (seen.get(key) || 0) + 1;
      seen.set(key, n);
      if (n > 1) key += ` #${n}`;
      out.push({
        key,
        file: rel,
        line: lineOf(content, m.index),
        detail: `syncStockLevelQuantity called without a warehouseId — the helper must guess the target warehouse row. Pass the warehouse this movement belongs to`,
      });
    }
  }
  return out;
}

// D2 — a frontend catch whose body is empty or ONLY console.* logging: the operation failed but
// the user sees nothing and the UI proceeds as if it succeeded (the "silent failure" bug class —
// ~30 tracker bugs). A catch must surface the failure (toast/handleApiError/setError/throw/…) or
// deliberately return a fallback. Also flags `.catch(() => {})`. Opt-out: `// allow-silent-catch`.
function silentCatchFrontend(relFiles) {
  const out = [];
  for (const rel of relFiles) {
    const norm = rel.replace(/\\/g, '/');
    if (!/^frontend\/src\/.*\.(ts|tsx)$/.test(norm)) continue;
    if (/\.test\.|__tests__/.test(norm)) continue;
    const content = readCode(rel);
    if (!content) continue;
    const seen = new Map();
    const push = (idx, what) => {
      let key = `${rel} :: silent-catch :: ${what}`;
      const n = (seen.get(key) || 0) + 1;
      seen.set(key, n);
      if (n > 1) key += ` #${n}`;
      out.push({
        key,
        file: rel,
        line: lineOf(content, idx),
        detail: `catch ${what} — the failure is invisible to the user. Surface it (toast/handleApiError/setError) or mark \`// allow-silent-catch\``,
      });
    };
    // try/catch form
    const re = /\bcatch\s*(?:\(\s*[^)]*\))?\s*\{/g;
    let m;
    while ((m = re.exec(content))) {
      if (content[m.index - 1] === '.') continue; // promise .catch handled below
      const open = m.index + m[0].length - 1;
      const inner = sliceBalancedBraces(content, open).slice(1, -1);
      if (/allow-silent-catch/.test(inner)) continue;
      // Blank console.* calls (balanced), then see if any code remains.
      let masked = inner;
      let cIdx;
      while ((cIdx = masked.search(/\bconsole\s*\.\s*\w+\s*\(/)) !== -1) {
        const openParen = masked.indexOf('(', cIdx);
        const call = sliceBalanced(masked, openParen);
        masked = masked.slice(0, cIdx) + masked.slice(openParen + call.length).replace(/^\s*;/, '');
      }
      if (!/\w/.test(masked)) push(m.index, inner.trim() ? 'only console-logs' : 'is empty');
    }
    // promise `.catch(() => {})` with an empty body
    const pRe = /\.catch\(\s*(?:\(\s*[\w$]*\s*\)|[\w$]+)?\s*=>\s*\{\s*\}\s*\)/g;
    while ((m = pRe.exec(content))) {
      const lineText = content.split('\n')[lineOf(content, m.index) - 1] || '';
      if (/allow-silent-catch/.test(lineText)) continue;
      push(m.index, 'is an empty .catch(() => {})');
    }
  }
  return out;
}

// D3 — `someQty || null` / `|| undefined` / `|| ''` on a money/quantity identifier: `||` treats a
// REAL 0 as missing, so a genuine zero price/qty is replaced by the fallback and lost (BUG-BEL1,
// BUG-FC2 class). Use `??` (only null/undefined trigger the fallback). Only literal null/undefined/
// empty-string fallbacks are flagged — those are always value-selection, never boolean logic.
const MONEY_TOKENS = ['price', 'rate', 'cost', 'amount', 'qty', 'quantity', 'meters'];
function numericOrFallback(relFiles) {
  const out = [];
  const re = /([\w$.]*[\w$])\s*\|\|\s*(null\b|undefined\b|''|"")/g;
  for (const rel of relFiles) {
    const norm = rel.replace(/\\/g, '/');
    if (!/\.(ts|tsx)$/.test(norm) || /\.test\.|__tests__/.test(norm)) continue;
    const content = readCode(rel);
    if (!content) continue;
    re.lastIndex = 0;
    let m;
    const seen = new Map();
    while ((m = re.exec(content))) {
      const ident = m[1].split('.').pop() || '';
      // Match whole camelCase/snake_case segments so "separate"/"strategy" don't hit rate/qty.
      const segments = ident
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter(Boolean);
      if (!segments.some((s) => MONEY_TOKENS.includes(s))) continue;
      // "rateSource", "costInputMode", "quantityUnit" etc. are STRINGS — `|| null` on them is
      // normalization, not zero-loss. Skip identifiers whose final segment marks a non-numeric.
      const NON_NUMERIC_TAILS = ['source', 'date', 'mode', 'type', 'status', 'name', 'id', 'code', 'unit', 'label', 'note', 'notes', 'remarks', 'method', 'reason', 'ref', 'basis', 'currency'];
      if (NON_NUMERIC_TAILS.includes(segments[segments.length - 1])) continue;
      const lineText = content.split('\n')[lineOf(content, m.index) - 1] || '';
      if (/allow-or-fallback/.test(lineText)) continue; // opt-out
      let key = `${rel} :: or-fallback :: ${m[1]}||${m[2]}`;
      const n = (seen.get(key) || 0) + 1;
      seen.set(key, n);
      if (n > 1) key += ` #${n}`;
      out.push({
        key,
        file: rel,
        line: lineOf(content, m.index),
        detail: `"${m[1]} || ${m[2]}" — a real 0 becomes ${m[2]}. Use ?? so only null/undefined trigger the fallback`,
      });
    }
  }
  return out;
}

// E1 — schema↔service update parity: a field in the Zod update schema that is MISSING from the
// corresponding service's Prisma update() data block. The field passes validation but silently gets
// ignored — classic "silent data loss on update" bug (the buyerStyleRef incident, 2026-08-04).
// We match schema files (*.schema.ts) to service files (*.service.ts) by module name, extract field
// names from both, and flag any schema fields absent from the service update.
//
// IMPROVEMENTS (2026-08-04):
// 1. Detect spread syntax (...data, ...cleanedData) and mark service as "covers all fields"
// 2. Skip standalone endpoint schemas (updateComponent*, updateStyleProcess*, etc.)
// 3. Expanded list of nested/relation fields to exclude
// 4. Only check main entity update schemas, not sub-entity or query schemas

// Schemas that are for standalone endpoints with dedicated controllers (not the main entity update)
const STANDALONE_ENDPOINT_SCHEMAS = [
  'updateComponentSchema',
  'updateComponentFabricSchema',
  'updateComponentAccessorySchema',
  'updateStyleProcessSchema',
  'updateStyleCommentSchema',
  'updateStyleMaterialBOMSchema',
  'updateCADGroupingSchema',
  'updateClaimStatusSchema',
  'updateOrderStatusSchema',
];

// Fields that are nested relations handled via separate upserts/methods
const NESTED_RELATION_FIELDS = [
  'items', 'components', 'processes', 'materialBOM', 'skuVariants', 'fabrics', 'accessories',
  'suppliers', 'gstNumbers', 'brandCategories', 'brandNames', 'categories', 'lots',
  'fabricGroups', 'trims', 'columnConfig',
];

// Query param fields that sometimes accidentally appear in update schemas
const QUERY_PARAM_FIELDS = ['page', 'limit', 'search', 'fromDate', 'toDate', 'sortBy', 'sortOrder'];

function schemaServiceUpdateParity(relFiles) {
  const out = [];
  const schemaFiles = relFiles.filter((f) => f.endsWith('.schema.ts'));

  for (const schemaRel of schemaFiles) {
    const schemaContent = readRel(schemaRel);
    if (!schemaContent) continue;

    // Find all update schemas: `export const updateXxxSchema = z.object({`
    // Use a more robust approach: find the schema start, then find the closing `});`
    const schemaRe = /export\s+const\s+(update\w*Schema)\s*=\s*z\.object\(\s*\{/g;
    let schemaMatch;
    while ((schemaMatch = schemaRe.exec(schemaContent))) {
      const schemaName = schemaMatch[1];

      // Skip standalone endpoint schemas - they have dedicated controllers
      if (STANDALONE_ENDPOINT_SCHEMAS.includes(schemaName)) continue;

      // Find the end of this schema - look for `});` that closes the z.object()
      // Start after the opening brace and find the matching close
      const schemaStart = schemaMatch.index + schemaMatch[0].length;
      const afterStart = schemaContent.slice(schemaStart);

      // Find closing `});` - this is more reliable than brace counting for Zod schemas
      // We look for a line that starts with `});` (possibly with leading whitespace)
      const closeMatch = afterStart.match(/\n\}\);/);
      if (!closeMatch) continue;

      const schemaBody = afterStart.slice(0, closeMatch.index);
      if (!schemaBody || schemaBody.length > 5000) continue; // Sanity check

      // Extract field names from schema (top-level keys only)
      // Match: `fieldName:` at the start of a line (with optional whitespace)
      const schemaFields = new Set();
      const fieldRe = /^\s{2}(\w+)\s*:/gm; // Exactly 2 spaces = top-level field in z.object
      let fm;
      while ((fm = fieldRe.exec(schemaBody))) {
        const field = fm[1];
        // Skip nested relations and query params
        if (NESTED_RELATION_FIELDS.includes(field)) continue;
        if (QUERY_PARAM_FIELDS.includes(field)) continue;
        schemaFields.add(field);
      }

      if (schemaFields.size === 0) continue;

      // Derive service file name from schema file
      const serviceRel = schemaRel.replace('/schemas/', '/services/').replace('.schema.ts', '.service.ts');
      const serviceContent = readRel(serviceRel);
      if (!serviceContent) continue;

      // Check if service uses spread syntax in update - if so, all fields are covered
      // Patterns: `data: { ...data`, `data: { ...cleanedData`, `data: cleanedData`
      const usesSpread = /\bdata\s*:\s*(?:\{\s*\.\.\.(?:data|cleanedData|customerData|updateData)\b|(?:data|cleanedData|customerData|updateData)\s*[,}])/.test(serviceContent);
      if (usesSpread) continue; // Service uses spread - all schema fields are covered

      // Also check for conditional spread patterns: `...(data.field && { field: ... })`
      // These cover the field even though it's not a direct assignment
      const conditionalSpreadFields = new Set();
      const conditionalSpreadRe = /\.\.\.\s*\(\s*(?:data\.(\w+)|data\[['"](\w+)['"]\])\s*(?:!==|&&)/g;
      let csm;
      while ((csm = conditionalSpreadRe.exec(serviceContent))) {
        conditionalSpreadFields.add(csm[1] || csm[2]);
      }
      // Also catch: `...(expectedOrderQtyPatch as object)` pattern where a variable holds the patch
      const varSpreadRe = /const\s+(\w+)\s*=\s*(?:data\.(\w+)|data\[['"](\w+)['"]\])\s*!==\s*undefined/g;
      while ((csm = varSpreadRe.exec(serviceContent))) {
        conditionalSpreadFields.add(csm[2] || csm[3]);
      }

      // Find Prisma update calls in the service
      const updateRe = /\.(update|updateMany|upsert)\s*\(\s*\{/g;
      let updateMatch;
      const serviceFields = new Set();

      while ((updateMatch = updateRe.exec(serviceContent))) {
        const callStart = updateMatch.index + updateMatch[0].length - 1;
        const callBody = sliceBalancedBraces(serviceContent, callStart);
        if (!callBody) continue;

        // Check for spread in this specific update call
        if (/\bdata\s*:\s*\{\s*\.\.\./.test(callBody)) {
          // This update uses spread - mark all fields as covered for this schema
          serviceFields.add('__SPREAD_COVERS_ALL__');
        }

        // Find data: { ... } block
        const dataMatch = callBody.match(/\bdata\s*:\s*\{/);
        if (!dataMatch) continue;

        const dataStart = dataMatch.index + dataMatch[0].length - 1;
        const dataBody = sliceBalancedBraces(callBody, dataStart);
        if (!dataBody) continue;

        // Extract field names from data block
        const dataFieldRe = /^\s*(\w+)\s*:/gm;
        let dfm;
        while ((dfm = dataFieldRe.exec(dataBody))) {
          serviceFields.add(dfm[1]);
        }
      }

      // If spread covers all, skip this schema
      if (serviceFields.has('__SPREAD_COVERS_ALL__')) continue;

      if (serviceFields.size === 0) continue; // No update calls found, skip

      // Find fields in schema but missing from service
      const moduleName = path.basename(schemaRel).replace('.schema.ts', '');
      for (const field of schemaFields) {
        if (!serviceFields.has(field) && !conditionalSpreadFields.has(field)) {
          // Skip common fields that are intentionally not updated directly
          if (['id', 'code', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'].includes(field)) continue;
          // Skip status fields that may have dedicated methods
          if (field === 'status' || field === 'cadStatus') continue;

          const line = lineOf(schemaContent, schemaMatch.index);
          out.push({
            key: `${schemaRel} :: ${schemaName} :: ${field}`,
            file: schemaRel,
            line,
            detail: `${schemaName}.${field} is in the Zod schema but MISSING from ${moduleName}.service update() — updates to this field are silently ignored`,
          });
        }
      }
    }
  }
  return out;
}

// Utility: slice balanced braces for service detector
function sliceBalancedBraces(content, openIdx) {
  let depth = 0;
  let str = null;
  for (let i = openIdx; i < content.length; i++) {
    const ch = content[i];
    const nx = content[i + 1];
    if (str) {
      if (ch === '\\') i++;
      else if (ch === str) str = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      str = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return content.slice(openIdx, i + 1);
    }
  }
  return content.slice(openIdx);
}

// E2 — materials.create with a hand-written id (string/template literal, e.g. `mat-${code}`):
// materials.id must equal the master's uuid (createFromMaster in material.service.ts is the ONLY
// authorized id-assigner). Hand-derived ids forked the registry into 4 incompatible conventions
// (the 2026-08 material-identity audit: 108 mat-* rows, preset saves 400ing on uuid validation).
// Legit non-literal ids (randomUUID(), master.id variables) are not flagged.
// Opt-out: `// allow-manual-material-create` on the call line or the line above.
function manualMaterialCreate(relFiles) {
  const out = [];
  for (const rel of relFiles) {
    const norm = rel.replace(/\\/g, '/');
    if (!/^backend\/(src|scripts)\/.*\.ts$/.test(norm)) continue;
    if (/\.test\.ts$|__tests__|backend\/src\/services\/material\.service\.ts$/.test(norm)) continue;
    const content = readCode(rel);
    if (!content) continue;
    const re = /\b(?:prisma|tx)\.materials\.create(?:Many)?\s*\(/g;
    let m;
    const seen = new Map();
    while ((m = re.exec(content))) {
      const call = sliceBalanced(content, m.index + m[0].length - 1);
      const idMatch = /\bid:\s*(['"`][^\n,]{0,60})/.exec(call);
      if (!idMatch) continue; // no literal id — Prisma default / uuid variable / createFromMaster
      const lineNo = lineOf(content, m.index);
      const lines = content.split('\n');
      const context = `${lines[lineNo - 2] || ''}\n${lines[lineNo - 1] || ''}`;
      if (/allow-manual-material-create/.test(context)) continue; // opt-out
      const snippet = idMatch[1].replace(/\s+/g, ' ').trim();
      let key = `${rel} :: manual-material-id :: ${snippet}`;
      const n = (seen.get(key) || 0) + 1;
      seen.set(key, n);
      if (n > 1) key += ` #${n}`;
      out.push({
        key,
        file: rel,
        line: lineNo,
        detail: `materials.create with hand-written id ${snippet} — use materialService.createFromMaster(master, TYPE, tx) so materials.id === master.id`,
      });
    }
  }
  return out;
}

// Fabric-naming (2026-08-18) — placeholder colour literals written into identity fields.
// 'Natural'/'Unknown'/'Printed' sentinels pinned colorName on auto-created fabric masters,
// merging every real colour of a greige into one record (dedup key includes colorName).
// Unknown colour must be stored as NULL (name segment omitted) — never placeholder text.
// All writes now route through services/helpers/fabric-identity.helper.ts.
function colourSentinelLiteral(relFiles) {
  const out = [];
  const re = /\bcolorName:\s*['"](Natural|Unknown|Printed)['"]/g;
  for (const rel of relFiles) {
    const norm = rel.replace(/\\/g, '/');
    if (!/^backend\/src\/.*\.ts$/.test(norm)) continue;
    if (/\.test\.ts$|__tests__/.test(norm)) continue;
    const content = readCode(rel);
    if (!content) continue;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      const lineNo = lineOf(content, m.index);
      const lines = content.split('\n');
      const context = `${lines[lineNo - 2] || ''}\n${lines[lineNo - 1] || ''}`;
      if (/allow-colour-sentinel/.test(context)) continue; // opt-out (e.g. a real colour seed)
      out.push({
        key: `${rel} :: ${m[0].replace(/\s+/g, ' ')} :: L${lineNo}`,
        file: rel,
        line: lineNo,
        detail: `placeholder colour literal ${m[0]} — store NULL for unknown colour (fabric-identity.helper resolves the real one)`,
      });
    }
  }
  return out;
}

// CAD preservation (2026-08-20) — a delete that destroys approved CAD planning work.
// fabric_width_cad is a hybrid row: CAD Planning owns the geometry/approval/children,
// Fabric Costing only decorates it with cost columns. Deleting the row from a costing
// screen wiped an approved CAD entry (plus cad_size_breakdown / cad_pattern_parts via
// cascade). style_fabrics / style_components cascade into it the same way.
// Sanctioned shapes: guard fabric_width_cad deletes with validateCADModification();
// unlink (fabric_width_cad.updateMany → styleFabricId: null) before deleting a
// style_fabrics / style_components row.
function unguardedCadDelete(relFiles) {
  const out = [];
  const re = /\b(?:prisma|tx)\.(fabric_width_cad|style_fabrics|style_components)\.(delete|deleteMany)\b/g;
  for (const rel of relFiles) {
    const norm = rel.replace(/\\/g, '/');
    if (!/^backend\/src\/.*\.ts$/.test(norm)) continue;
    if (/\.test\.ts$|__tests__/.test(norm)) continue;
    const content = readCode(rel);
    if (!content) continue;
    const hasCadGuard = /validateCADModification\s*\(/.test(content);
    // An unlink writes styleFabricId: null onto fabric_width_cad before the cascade fires
    const hasUnlink = /fabric_width_cad\.updateMany[\s\S]{0,400}?styleFabricId:\s*null/.test(content);
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content))) {
      const [table] = [m[1]];
      if (table === 'fabric_width_cad' ? hasCadGuard : hasUnlink) continue;
      const lineNo = lineOf(content, m.index);
      const lines = content.split('\n');
      const context = `${lines[lineNo - 2] || ''}\n${lines[lineNo - 1] || ''}`;
      if (/allow-cad-delete/.test(context)) continue; // opt-out (e.g. a deliberate hard purge)
      out.push({
        key: `${rel} :: ${m[0]} :: L${lineNo}`,
        file: rel,
        line: lineNo,
        detail:
          table === 'fabric_width_cad'
            ? `${m[0]} without validateCADModification() — an APPROVED CAD entry can be destroyed`
            : `${m[0]} without unlinking fabric_width_cad first — styleFabricId is ON DELETE CASCADE, so approved CAD/costing rows are destroyed`,
      });
    }
  }
  return out;
}

// Single source of defaults (2026-08-21) — a business default value declared anywhere other
// than backend/src/config/defaults.registry.ts.
//
// The bug this prevents: the SAME wastage default was declared in seven places that disagreed
// (a Prisma column @default, the seed array, per-call-site fallback literals, two frontend
// copies, and a hand-kept key list). The DB column default silently won, so every trim on
// every BOM carried 5% wastage nobody had chosen and that Settings could not change.
//
// Sanctioned shape: declare the value once in defaults.registry.ts and read it via
// systemSettingsService.getNumberDefault('KEY') / getStringDefault / getBooleanDefault, or in
// the frontend via useDefaultSettings(). Opt out on a genuinely unrelated line with
//   // allow-hardcoded-default
function hardcodedDefault(relFiles) {
  const out = [];

  // Concepts owned by the registry. A literal assigned to one of these duplicates it.
  const GOVERNED = [
    'wastagePercent',
    'cadWastagePercent',
    'extraPercentage',
    'valueLossPercent',
    'markupPercent',
    'fabricBufferPercent',
    'trimsBufferPercent',
    'cmtBufferPercent',
    'embroideryBufferPercent',
    'accessoriesBufferPercent',
    'cutableWidthDeduction',
    'agingThresholdDays',
  ].join('|');

  const RULES = [
    {
      // getNumber('KEY', 5) — the fallback argument that generated the whole bug class.
      re: /systemSettingsService\.(?:getNumber|getString)\(\s*['"][A-Z_]+['"]\s*,/g,
      detail: () =>
        "passes a fallback literal to systemSettingsService — use getNumberDefault('KEY') / " +
        "getStringDefault('KEY'); the value belongs in defaults.registry.ts",
    },
    {
      // A governed field assigned a bare non-zero literal (object seed, useState, etc).
      re: new RegExp('\\b(?:' + GOVERNED + ')\\s*[:=]\\s*(?!0\\b)\\d+(?:\\.\\d+)?', 'g'),
      detail: (m) => 'hardcoded default `' + m.trim() + '` — read it from defaults.registry.ts',
    },
    {
      // A governed field defaulted with ?? or || to a non-zero literal.
      re: new RegExp(
        '\\b(?:' + GOVERNED + ')\\b[^;\\n]{0,80}?(?:\\?\\?|\\|\\|)\\s*(?!0\\b)\\d+(?:\\.\\d+)?',
        'g'
      ),
      detail: (m) => 'fallback literal in `' + m.trim() + '` — read the default from defaults.registry.ts',
    },
  ];

  for (const rel of relFiles) {
    const norm = rel.replace(/\\/g, '/');
    if (!/^(backend|frontend)\/src\/.*\.(ts|tsx)$/.test(norm)) continue;
    if (/\.test\.tsx?$|__tests__|\/tests?\//.test(norm)) continue;
    // The registry itself and the service that reads it are the sanctioned homes.
    if (/defaults\.registry\.ts$|system-settings\.service\.ts$/.test(norm)) continue;

    const content = readCode(rel);
    if (!content) continue;
    const lines = content.split('\n');

    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(content))) {
        const lineNo = lineOf(content, m.index);
        const context = (lines[lineNo - 2] || '') + '\n' + (lines[lineNo - 1] || '');
        if (/allow-hardcoded-default/.test(context)) continue;
        out.push({
          // Key on the normalised path so a baseline written on Windows still matches the
          // forward-slash paths git hands smart-check.
          key: norm + ' :: ' + m[0].replace(/\s+/g, ' '),
          file: rel,
          line: lineNo,
          detail: rule.detail(m[0]),
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
  swallowedWriteErrors,
  assignNotIncrement,
  manualMaterialCreate,
  colourSentinelLiteral,
  unguardedCadDelete,
  schemaFrontendParity,
  schemaServiceUpdateParity,
  stockSyncNoWarehouse,
  silentCatchFrontend,
  numericOrFallback,
  hardcodedDefault,
  REPO_ROOT,
};
