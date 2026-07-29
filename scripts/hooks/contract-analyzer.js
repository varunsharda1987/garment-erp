#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * CONTRACT ANALYZER — deterministic route ↔ Zod ↔ controller contract checker.
 *
 * WHY THIS EXISTS
 * ---------------
 * The previous detector (check-schema-controller-alignment.js) resolved schemas with a regex that only
 * understood `export const X = z.object({...})`. Real schemas use .passthrough() (111), .refine() (45),
 * unions (29), .extend() (10), .partial() (10) — all invisible to it. Result: of 655 mutating routes it
 * compared only 81, and silently discarded 212 findings as "warnings" (128 unresolvable schema, 84
 * controller-passes-body-wholesale). Real silent-data-loss bugs (style tech-specs dropping 8 of 10
 * fields on every save) lived in that blind spot.
 *
 * HOW THIS IS DIFFERENT — ground truth instead of guessing:
 *  1. Schemas are LOADED AT RUNTIME from source .ts (ts-node, transpile-only) and introspected via
 *     `.shape`, so .extend/.partial/.passthrough/.refine/union all resolve exactly. `_def.catchall`
 *     tells us whether the schema STRIPS unknown keys (silent-data-loss risk) or passes them through.
 *  2. Route files are the pairing source of truth — they import BOTH the schema and the handler, so we
 *     never guess from filenames (styleTechSpecs.schema.ts ↔ style-tech-specs.controller.ts never matches).
 *     Route args are split with a paren/brace/string-aware scanner, not a single brittle regex.
 *  3. Controller body usage is extracted in THREE modes (destructure / req.body.x / wholesale req.body),
 *     so "passes req.body to a service" is analyzed instead of skipped.
 *
 * Usage:
 *   node scripts/hooks/contract-analyzer.js            # human summary
 *   node scripts/hooks/contract-analyzer.js --json     # findings as JSON (for reports/CI)
 *   node scripts/hooks/contract-analyzer.js --verbose  # include per-finding detail
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const BACKEND = path.join(ROOT, 'backend/src');
const SCHEMAS_DIR = path.join(BACKEND, 'schemas');
const ROUTES_DIR = path.join(BACKEND, 'routes');
const CONTROLLERS_DIR = path.join(BACKEND, 'controllers');

const MUTATING = ['post', 'put', 'patch', 'delete'];

// ---------------------------------------------------------------------------
// Generic source scanning helpers (string/comment/nesting aware)
// ---------------------------------------------------------------------------

/** Strip // and /* *\/ comments without destroying string contents. */
function stripComments(src) {
  let out = '';
  let i = 0;
  let str = null; // current quote char
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (str) {
      if (c === '\\') {
        out += c + (n || '');
        i += 2;
        continue;
      }
      if (c === str) str = null;
      out += c;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      str = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Index of the closer matching the opener at openIdx. Handles nesting + strings. */
function matchClose(src, openIdx) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const open = src[openIdx];
  const close = pairs[open];
  let depth = 0;
  let str = null;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (str) {
      if (c === '\\') i++;
      else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      str = c;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split an argument list on top-level commas. */
function splitArgs(src) {
  const args = [];
  let depth = 0;
  let str = null;
  let cur = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (str) {
      cur += c;
      if (c === '\\') {
        cur += src[++i] || '';
      } else if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      str = c;
      cur += c;
      continue;
    }
    if (c === '(' || c === '{' || c === '[') depth++;
    if (c === ')' || c === '}' || c === ']') depth--;
    if (c === ',' && depth === 0) {
      args.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

// ---------------------------------------------------------------------------
// 1. SCHEMAS — load at runtime, introspect the real Zod objects
// ---------------------------------------------------------------------------

/** Resolve an import specifier ('../schemas/agency.schema') to the file basename we index by. */
function specToFile(spec) {
  return path.basename(spec).replace(/\.(ts|js)$/, '') + '.ts';
}

/**
 * Unwrap ZodEffects(.refine/.transform), ZodOptional/Nullable/Default to reach an object shape.
 * NOTE: `out` is tried BEFORE `in` — for z.preprocess() `_def.in` is the preprocessing transform and
 * `_def.out` is the real object; short-circuiting on `in` classified those schemas as non-object.
 */
function unwrap(schema, depth = 0) {
  if (!schema || depth > 12) return null;
  if (schema.shape) return schema;
  const d = schema._def || {};
  return unwrap(d.innerType || d.schema || d.out || d.in || null, depth + 1);
}

function describeType(field) {
  const inner = field && field._def ? field : null;
  if (!inner) return 'unknown';
  const seen = [];
  let cur = field;
  for (let i = 0; i < 12 && cur && cur._def; i++) {
    const t = cur._def.type || (cur.constructor && cur.constructor.name) || '';
    if (t) seen.push(String(t));
    cur = cur._def.innerType || cur._def.schema || null;
  }
  return seen.join('<') || 'unknown';
}

function isOptionalField(field) {
  try {
    return typeof field.safeParse === 'function' ? field.safeParse(undefined).success : false;
  } catch {
    return false;
  }
}

function loadSchemas() {
  try {
    // ts-node lives in backend/node_modules, not at the repo root — resolve it from there.
    const tsNodePath = require.resolve('ts-node', { paths: [path.join(ROOT, 'backend')] });
    require(tsNodePath).register({
      transpileOnly: true,
      compilerOptions: { module: 'commonjs' },
      cwd: path.join(ROOT, 'backend'),
    });
  } catch (e) {
    console.error('FATAL: ts-node is required to introspect schemas —', e.message);
    process.exit(2);
  }

  // Keyed by `file::exportName` — 33 schema export names are duplicated across files
  // (sendOutSchema, allocateStockSchema, ...), so a bare-name map silently resolved to the wrong file.
  const schemas = new Map();
  const byName = new Map(); // exportName -> [keys] (fallback when the import can't be resolved)
  const loadErrors = [];
  // Not every Zod schema lives in schemas/ — e.g. CreateCostSheetSchema/UpdateCostSheetSchema are
  // exported from controllers/style-costing.utils.ts and are the REAL schemas those routes validate
  // against. Scanning only schemas/ reported them as "unresolvable" instead of checking them.
  const sources = [
    ...fs.readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith('.ts')).map((f) => [SCHEMAS_DIR, f]),
    ...fs
      .readdirSync(CONTROLLERS_DIR)
      .filter((f) => f.endsWith('.ts') && /\.utils\.ts$|schema/i.test(f))
      .map((f) => [CONTROLLERS_DIR, f]),
  ];
  const files = sources.map(([, f]) => f);

  for (const [dir, file] of sources) {
    const full = path.join(dir, file);
    let mod;
    try {
      mod = require(full);
    } catch (e) {
      loadErrors.push({ file, error: e.message.split('\n')[0] });
      continue;
    }
    for (const [name, val] of Object.entries(mod)) {
      if (!val || typeof val !== 'object' || typeof val.safeParse !== 'function') continue;
      const key = `${file}::${name}`;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(key);
      const obj = unwrap(val);
      if (!obj || !obj.shape) {
        // Union / non-object schema — record so we can report it rather than silently skip.
        schemas.set(key, { name, file, kind: 'non-object', fields: null });
        continue;
      }
      const shape = obj.shape;
      const fields = {};
      for (const [k, v] of Object.entries(shape)) {
        fields[k] = { optional: isOptionalField(v), type: describeType(v) };
      }
      // zod v4: catchall undefined => strips unknown keys; ZodUnknown => passthrough; ZodNever => strict
      const catchall = obj._def && obj._def.catchall;
      const catchallType = catchall && catchall._def ? catchall._def.type : undefined;
      schemas.set(key, {
        name,
        file,
        kind: 'object',
        fields,
        // undefined = default strip; 'never' = .strict() which REJECTS unknown keys (400 rather than a
        // silent drop, but still a contract mismatch worth reporting).
        strips: catchallType === undefined || catchallType === 'never',
        strict: catchallType === 'never',
        passthrough: catchallType === 'unknown',
      });
    }
  }
  return { schemas, byName, loadErrors, fileCount: files.length };
}

// ---------------------------------------------------------------------------
// 2. ROUTES — parse registrations + imports (the pairing source of truth)
// ---------------------------------------------------------------------------

function parseImports(src) {
  const map = {}; // symbol -> module specifier
  const re = /import\s+(?:type\s+)?(\{[^}]*\}|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const [, clause, spec] = m;
    if (clause.startsWith('{')) {
      for (const part of clause.slice(1, -1).split(',')) {
        const sym = part.split(/\s+as\s+/).pop().trim();
        if (sym) map[sym] = spec;
      }
    } else {
      map[clause.trim()] = spec;
    }
  }
  return map;
}

/** Extract the callee symbol from a handler argument (asyncHandler(fn) | fn | ctrl.m.bind(ctrl) | inline). */
function handlerName(arg) {
  if (!arg) return null;
  const a = arg.trim();
  if (/^async\s*\(|^\(.*\)\s*=>/.test(a)) {
    // arrow delegate: (req,res) => SomeController.method(req,res)
    const d = a.match(/=>\s*\{?\s*(?:return\s+)?([\w.]+)\s*\(/);
    return d ? stripBind(d[1]) : '<inline>';
  }
  let m = a.match(/^asyncHandler\s*\(\s*([\w.]+)/);
  if (m) return stripBind(m[1]);
  m = a.match(/^([\w.]+)\.bind\s*\(/);
  if (m) return stripBind(m[1]);
  m = a.match(/^([\w.]+)$/);
  if (m) return stripBind(m[1]);
  m = a.match(/^[\w]+\s*\(\s*([\w.]+)/); // any wrapper(fn)
  if (m) return stripBind(m[1]);
  return null;
}

/**
 * `agencyController.create.bind` -> `agencyController.create`.
 * Without this the trailing segment popped off was literally "bind", so every class-based module —
 * including the LIVE B2B saleOrder routes, tcs/tds, credit/debit notes, agency (the project's own
 * documented reference pattern) — was skipped as "handler-not-found".
 */
function stripBind(sym) {
  return sym.replace(/\.bind$/, '');
}

function parseRoutes() {
  const routes = [];
  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
    const src = stripComments(raw);
    const imports = parseImports(src);
    const re = /\brouter\s*\.\s*(get|post|put|patch|delete|all)\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
      const method = m[1];
      const openIdx = src.indexOf('(', m.index + m[0].length - 1);
      const closeIdx = matchClose(src, openIdx);
      if (closeIdx === -1) continue;
      const argsStr = src.slice(openIdx + 1, closeIdx);
      const args = splitArgs(argsStr);
      if (!args.length) continue;
      const pathLit = (args[0].match(/^['"`]([^'"`]*)['"`]$/) || [])[1];
      if (pathLit === undefined) continue;

      const middleware = args.slice(1, -1).join(' , ');
      const bodySchema = (middleware.match(/validateBody\s*\(\s*([\w.]+)\s*\)/) || [])[1] || null;
      const querySchema = (middleware.match(/validateQuery\s*\(\s*([\w.]+)\s*\)/) || [])[1] || null;
      const handler = handlerName(args[args.length - 1]);
      const noBodyMarker = /no-body/.test(
        raw.slice(Math.max(0, raw.indexOf(args[0]) - 300), raw.indexOf(args[0]) + 1)
      );

      routes.push({
        file,
        method: method.toUpperCase(),
        path: pathLit,
        bodySchema,
        querySchema,
        handler,
        imports,
        mutating: MUTATING.includes(method),
        line: lineOf(src, m.index),
        noBodyMarker,
      });
    }
  }
  return routes;
}

// ---------------------------------------------------------------------------
// 3. CONTROLLERS — 3-mode req.body extraction
// ---------------------------------------------------------------------------

/**
 * Fields destructured from a specific expression, e.g. `const { a, b } = req.body`.
 * Anchors on the `= req.body` and walks BACKWARD to the matching `{`. A forward lazy regex is wrong
 * here: with `const {styleId} = req.params;` above `const {a} = req.body;` it spans both statements and
 * reports route params as body fields.
 */
function destructuredFrom(body, expr) {
  const out = new Set();
  const re = new RegExp('=\\s*' + expr.replace(/\./g, '\\.') + '\\b', 'g');
  let m;
  while ((m = re.exec(body))) {
    let i = m.index - 1;
    while (i >= 0 && /\s/.test(body[i])) i--;
    // Skip a TYPE ANNOTATION on the pattern: `const { a, b }: LoginRequest = req.body`.
    // Without this the scan sees the type name instead of `}` and reports the controller as reading
    // nothing — which produced false "schema requires X but controller never reads it" findings on
    // obviously-correct handlers like login/register.
    if (body[i] !== '}') {
      let j = i;
      while (j >= 0 && /[\w<>\[\]|&.,'"\s]/.test(body[j]) && body[j] !== ':' && body[j] !== '}') j--;
      if (body[j] === ':') {
        j--;
        while (j >= 0 && /\s/.test(body[j])) j--;
        i = j;
      }
    }
    if (body[i] !== '}') continue;
    let depth = 0;
    let j = i;
    for (; j >= 0; j--) {
      if (body[j] === '}') depth++;
      else if (body[j] === '{') {
        depth--;
        if (depth === 0) break;
      }
    }
    if (j < 0) continue;
    cleanDestructured(body.slice(j + 1, i)).forEach((f) => out.add(f));
  }
  return out;
}

function cleanDestructured(inner) {
  const out = [];
  for (const part of splitArgs(inner)) {
    const p = part.trim();
    if (!p || p.startsWith('...')) continue;
    const name = p.split(':')[0].split('=')[0].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) out.push(name);
  }
  return out;
}

function parseControllers() {
  const fns = new Map(); // `file::functionName` -> info
  const byName = new Map(); // functionName -> [keys]
  const files = fs.readdirSync(CONTROLLERS_DIR).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const src = stripComments(fs.readFileSync(path.join(CONTROLLERS_DIR, file), 'utf8'));
    // export const NAME = async (...) => {  |  export async function NAME(  |  async NAME(  (class method)
    const defRe =
      /(?:export\s+const\s+(\w+)\s*[:=][^=]*?=>\s*\{)|(?:export\s+(?:async\s+)?function\s+(\w+)\s*\()|(?:^\s{2}(?:public\s+)?async\s+(\w+)\s*\()/gm;
    let m;
    while ((m = defRe.exec(src))) {
      const name = m[1] || m[2] || m[3];
      if (!name) continue;
      const braceIdx = src.indexOf('{', m.index + m[0].length - 1);
      if (braceIdx === -1) continue;
      const end = matchClose(src, braceIdx);
      if (end === -1) continue;
      const body = src.slice(braceIdx, end);

      // mode 1: const { a, b } = req.body   (backward-anchored, see destructuredFrom)
      const fields = destructuredFrom(body, 'req.body');
      // mode 2: req.body.x
      const are = /req\.body\.(\w+)/g;
      let a;
      while ((a = are.exec(body))) fields.add(a[1]);
      // mode 3: ALIAS — `const data = req.body as CreateX;` then `data.field`.
      // Previously invisible to all modes, producing false "controller never reads it" findings.
      const aliasRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*req\.body\b(?!\s*\.)/g;
      let al;
      let aliasForwarded = false;
      while ((al = aliasRe.exec(body))) {
        const alias = al[1];
        const useRe = new RegExp('\\b' + alias + '\\.(\\w+)', 'g');
        let u;
        while ((u = useRe.exec(body))) fields.add(u[1]);
        // also `const { x } = data`
        destructuredFrom(body, alias).forEach((f) => fields.add(f));
        // ...and the alias may be forwarded WHOLESALE: `service.reorder(validatedData)`.
        // Without this the controller looks like it reads nothing, producing false
        // REQUIRED_UNUSED ("schema requires X but controller never reads it").
        // ...forwarded either as a bare argument `service.create(data)` or SPREAD into an object
        // literal `service.create({ ...data, createdById })` — both mean the whole validated body
        // is used, so the schema's fields are not "unused".
        if (
          new RegExp('[(,]\\s*' + alias + '\\s*[,)]').test(body) ||
          new RegExp('\\.{3}\\s*' + alias + '\\b').test(body)
        ) {
          aliasForwarded = true;
        }
      }
      // mode 4: WHOLESALE — req.body spread, or passed as a bare argument.
      // The old test `req.body\s*(?:\)|,|;|\})` also matched the `;` ending a plain destructure
      // (`const {a,b} = req.body;`), flagging 305 ordinary controllers as mass-assignment and (via the
      // !wholesale guard) suppressing real REQUIRED_UNUSED findings. Require spread or argument position.
      const wholesale =
        aliasForwarded || /\.{3}\s*req\.body/.test(body) || /[(,]\s*req\.body\s*(?:[,)])/.test(body);

      // query usage (Express-5 validatedQuery discard class)
      const queryFields = destructuredFrom(body, 'req.query');
      const qre = /req\.query\.(\w+)/g;
      let q;
      while ((q = qre.exec(body))) queryFields.add(q[1]);
      const usesValidatedQuery = /validatedQuery/.test(body);

      // Which query fields does the controller RE-CONVERT itself?
      // req.query yields raw strings (Express 5 — the coerced copy lives only on req.validatedQuery),
      // and the controllers here correctly convert them: parseInt(page), String(x) === 'true', etc.
      // Those are NOT bugs — flagging them produced ~50 findings for code that works. Only a
      // controller that TRUSTS the schema's coercion and uses the raw value directly is at risk
      // (that is what caused the patternPart count() 500).
      const querySafe = new Set();
      for (const f of queryFields) {
        const e = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reCoerced = new RegExp(
          `(?:parseInt|parseFloat|Number|String|Boolean)\\s*\\(\\s*(?:req\\.query\\.)?${e}\\b` +
            `|\\b${e}\\s*===\\s*['"]` +
            `|req\\.query\\.${e}\\s*===\\s*['"]` +
            `|\\b${e}\\s+as\\s+(?:string|unknown)` +
            `|req\\.query\\.${e}\\s+as\\s+(?:string|unknown)`
        );
        if (reCoerced.test(body)) querySafe.add(f);
      }

      // Keyed by `file::name` — 47 controller function names collide across files (getById in 13
      // files, create/delete in 11), so a bare-name map compared ~9% of routes against the WRONG
      // controller body.
      const key = `${file}::${name}`;
      const info = {
        name,
        file,
        fields: [...fields],
        wholesale,
        queryFields: [...queryFields],
        querySafe: [...querySafe],
        usesValidatedQuery,
        line: lineOf(src, m.index),
      };
      if (!fns.has(key)) fns.set(key, info);
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(key);
    }
  }
  return { fns, byName };
}

// ---------------------------------------------------------------------------
// 4. ANALYZE
// ---------------------------------------------------------------------------

function analyze() {
  const { schemas, byName: schemasByName, loadErrors, fileCount } = loadSchemas();
  const routes = parseRoutes();
  const { fns: controllers, byName: ctrlByName } = parseControllers();

  /**
   * Resolve a symbol referenced in a route file to its defining file, USING THAT ROUTE FILE'S IMPORTS.
   * This is the whole point of pairing via route files; without it, duplicate export names (33 schemas,
   * 47 controller fns) resolve to an arbitrary file and silently compare the wrong pair.
   */
  const resolveVia = (map, byNameMap, imports, symbol) => {
    if (!symbol) return { entry: null, ambiguous: false };
    const base = symbol.split('.')[0]; // agencyController.create -> agencyController
    const leaf = symbol.split('.').pop(); // -> create
    const spec = imports[base] || imports[leaf] || imports[symbol];
    if (spec) {
      const hit = map.get(`${specToFile(spec)}::${leaf}`);
      if (hit) return { entry: hit, ambiguous: false };
    }
    const candidates = byNameMap.get(leaf) || [];
    if (candidates.length === 1) return { entry: map.get(candidates[0]), ambiguous: false };
    // Ambiguous: several files export this name and the import didn't resolve — refuse to guess.
    return { entry: null, ambiguous: candidates.length > 1 };
  };

  const findings = [];
  const stats = {
    schemaFiles: fileCount,
    schemasLoaded: schemas.size,
    schemaLoadErrors: loadErrors.length,
    routesTotal: routes.length,
    mutating: 0,
    mutatingWithBody: 0,
    compared: 0,
    skipped: {},
  };

  const skip = (r, why) => {
    stats.skipped[why] = (stats.skipped[why] || 0) + 1;
  };

  for (const r of routes) {
    if (!r.mutating) continue;
    stats.mutating++;

    // ---- class: mutating route with NO body validation at all
    if (!r.bodySchema) {
      // Only a real risk if the handler actually READS a body. 116 of the original 207 were DELETEs,
      // which normally carry no body at all — reporting those as "raw body reaches Prisma" was noise.
      const { entry: h } = resolveVia(controllers, ctrlByName, r.imports, r.handler);
      const readsBody = h ? h.fields.length > 0 || h.wholesale : null;
      if (!r.noBodyMarker && readsBody !== false) {
        findings.push({
          type: 'NO_VALIDATION',
          severity: readsBody ? 'MEDIUM' : 'LOW',
          symptom: readsBody ? '500-crash / mass-assignment' : 'unverified (handler not resolved)',
          route: `${r.method} ${r.path}`,
          file: `backend/src/routes/${r.file}:${r.line}`,
          detail: readsBody
            ? 'Mutating route has no validateBody and the handler reads req.body — raw input reaches the controller/Prisma.'
            : 'Mutating route has no validateBody; handler could not be resolved to confirm body usage.',
          handler: r.handler,
        });
      }
      continue;
    }
    stats.mutatingWithBody++;

    const { entry: schema, ambiguous: schemaAmbiguous } = resolveVia(
      schemas,
      schemasByName,
      r.imports,
      r.bodySchema
    );
    if (!schema) {
      skip(r, schemaAmbiguous ? 'schema-ambiguous(duplicate name)' : 'schema-not-loaded');
      if (schemaAmbiguous) continue;
      findings.push({
        type: 'SCHEMA_UNRESOLVED',
        severity: 'LOW',
        symptom: 'analyzer-gap',
        route: `${r.method} ${r.path}`,
        file: `backend/src/routes/${r.file}:${r.line}`,
        detail: `validateBody(${r.bodySchema}) but that export could not be loaded/introspected.`,
      });
      continue;
    }
    if (schema.kind !== 'object') {
      skip(r, 'schema-non-object(union/effect)');
      continue;
    }

    const { entry: fn, ambiguous: fnAmbiguous } = resolveVia(
      controllers,
      ctrlByName,
      r.imports,
      r.handler
    );
    if (!fn) {
      skip(r, fnAmbiguous ? 'handler-ambiguous(duplicate name)' : 'handler-not-found');
      continue;
    }

    stats.compared++;
    const schemaFields = Object.keys(schema.fields);

    // ---- class A: controller reads a field the schema STRIPS  → silent data loss
    if (schema.strips) {
      const dropped = fn.fields.filter((f) => !schemaFields.includes(f));
      if (dropped.length) {
        findings.push({
          type: 'SILENT_DROP',
          severity: 'HIGH',
          symptom: 'silent-data-loss',
          route: `${r.method} ${r.path}`,
          file: `backend/src/controllers/${fn.file}:${fn.line}`,
          schema: `${schema.name} (${schema.file})`,
          fields: dropped,
          detail: `${fn.name} reads [${dropped.join(', ')}] but ${schema.name} strips them → saved as undefined.`,
        });
      }
    }

    // ---- class B: schema REQUIRES a field the controller never reads → 400 blocks valid input
    const requiredUnused = schemaFields.filter(
      (f) => !schema.fields[f].optional && !fn.fields.includes(f) && !fn.wholesale
    );
    if (requiredUnused.length) {
      findings.push({
        type: 'REQUIRED_UNUSED',
        severity: 'MEDIUM',
        symptom: '400-blocks-valid-input',
        route: `${r.method} ${r.path}`,
        file: `backend/src/schemas/${schema.file}`,
        schema: schema.name,
        fields: requiredUnused,
        detail: `${schema.name} REQUIRES [${requiredUnused.join(', ')}] but ${fn.name} never reads them → callers must send dead fields or get 400.`,
      });
    }

    // ---- class C: passthrough schema + wholesale body → mass-assignment
    if (schema.passthrough && fn.wholesale) {
      findings.push({
        type: 'PASSTHROUGH_WHOLESALE',
        severity: 'MEDIUM',
        symptom: 'mass-assignment',
        route: `${r.method} ${r.path}`,
        file: `backend/src/controllers/${fn.file}:${fn.line}`,
        schema: schema.name,
        detail: `${schema.name} is .passthrough() and ${fn.name} forwards req.body wholesale → unvalidated keys reach the service/Prisma.`,
      });
    }
  }

  // ---- class D: Express-5 validatedQuery discard
  for (const r of routes) {
    if (!r.querySchema) continue;
    const { entry: schema } = resolveVia(schemas, schemasByName, r.imports, r.querySchema);
    if (!schema || schema.kind !== 'object') continue;
    const { entry: fn } = resolveVia(controllers, ctrlByName, r.imports, r.handler);
    if (!fn || fn.usesValidatedQuery) continue;
    const coerced = Object.keys(schema.fields).filter(
      (f) =>
        /coerce|number|boolean|date|pipe|transform/i.test(schema.fields[f].type) &&
        fn.queryFields.includes(f) &&
        !(fn.querySafe || []).includes(f) // controller already converts it itself — not a bug
    );
    if (coerced.length) {
      findings.push({
        type: 'QUERY_COERCION_LOST',
        severity: 'MEDIUM',
        symptom: '500-crash / wrong-filter',
        route: `${r.method} ${r.path}`,
        file: `backend/src/controllers/${fn.file}:${fn.line}`,
        schema: r.querySchema,
        fields: coerced,
        detail: `${fn.name} reads req.query.[${coerced.join(', ')}] but those are coerced by ${r.querySchema}; under Express 5 the coerced copy lives only on req.validatedQuery → controller gets a raw string.`,
      });
    }
  }

  return { findings, stats, loadErrors };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const { findings, stats, loadErrors } = analyze();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ findings, stats, loadErrors }, null, 2));
    process.exit(0);
  }

  const byType = {};
  for (const f of findings) byType[f.type] = (byType[f.type] || 0) + 1;

  console.log('\n=== CONTRACT ANALYZER ===');
  console.log(`schemas: ${stats.schemasLoaded} loaded from ${stats.schemaFiles} files (${stats.schemaLoadErrors} load errors)`);
  console.log(`routes: ${stats.routesTotal} total | ${stats.mutating} mutating | ${stats.mutatingWithBody} with validateBody`);
  console.log(`COMPARED: ${stats.compared} route/schema/controller triples`);
  if (Object.keys(stats.skipped).length) {
    console.log('skipped:');
    for (const [k, v] of Object.entries(stats.skipped)) console.log(`   ${k}: ${v}`);
  }
  console.log('\nFINDINGS by type:');
  for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`   ${k}: ${v}`);
  console.log(`   TOTAL: ${findings.length}`);

  if (process.argv.includes('--verbose')) {
    for (const f of findings) {
      console.log(`\n[${f.severity}] ${f.type} — ${f.route}`);
      console.log(`   ${f.file}`);
      console.log(`   ${f.detail}`);
    }
  }
  if (loadErrors.length) {
    console.log('\nschema load errors:');
    loadErrors.slice(0, 10).forEach((e) => console.log(`   ${e.file}: ${e.error}`));
  }
}

module.exports = { analyze };
