/**
 * Every write route must be gated by the Permissions page (or the admin floor).
 *
 * Before 2026-09-13 only 48 of 137 route files had any role check at all, and the ones that
 * did used hardcoded `authorize(...roles)` lists the Permissions page never read. This scan is
 * what stops that from growing back: a POST/PUT/PATCH/DELETE with no `requirePermission(key)`,
 * `requirePermissionForWrites(key)` (router-level) or `requireAdmin()` fails the suite, naming
 * file:line. Self-service and public writes carry an explicit `// open-write: <reason>` comment
 * on the line above the route.
 *
 * Parser-based (TypeScript compiler API) so multi-line calls and comments cannot fool it.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const ROUTES_DIR = path.join(__dirname, '..', '..', 'routes');

/** Whole files whose writes are public or self-service by nature. */
const OPEN_FILES: Record<string, string> = {
  'auth.routes.ts': 'login / register / refresh / logout are public or act on the caller only',
};

const WRITE_VERBS = new Set(['post', 'put', 'patch', 'delete', 'all']);
const GUARDS = new Set(['requirePermission', 'requirePermissionForWrites', 'requireAnyPermission', 'requireAdmin']);

interface Finding {
  file: string;
  line: number;
  route: string;
}

function guardCall(node: ts.Node): string | null {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && GUARDS.has(node.expression.text)) {
    return node.expression.text;
  }
  return null;
}

/**
 * `const adminOnly = requireAdmin();` — the route then passes the IDENTIFIER, not the call.
 * companyProfile.routes.ts hoists its guard that way (deliberately: requireAdmin() is the floor
 * the Permissions page cannot lower), and without following the alias the scan called all five of
 * its admin-only writes unguarded. A guard suite sitting red on false positives guards nothing —
 * a genuinely unguarded route would have hidden in the same noise.
 */
function collectGuardAliases(sf: ts.SourceFile): Set<string> {
  const aliases = new Set<string>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      guardCall(node.initializer)
    ) {
      aliases.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return aliases;
}

function guardName(node: ts.Node, aliases: Set<string>): string | null {
  const direct = guardCall(node);
  if (direct) return direct;
  if (ts.isIdentifier(node) && aliases.has(node.text)) return node.text;
  return null;
}

function scanFile(file: string): { unguarded: Finding[]; authorizeCalls: Finding[] } {
  const name = path.basename(file);
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const lineOf = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  // Pre-pass, so an alias declared anywhere in the file counts — not only above the routes.
  const guardAliases = collectGuardAliases(sf);

  // Router-level guards: `X.use(guard)` covers everything on X; `X.use('/p', guard)` covers paths under /p
  const routerGuards = new Map<string, string[]>(); // router → list of path prefixes ('' = all)
  const unguarded: Finding[] = [];
  const authorizeCalls: Finding[] = [];

  const routeCalls: Array<{ node: ts.CallExpression; router: string; verb: string }> = [];

  function walk(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'authorize') {
        authorizeCalls.push({ file: name, line: lineOf(node), route: 'authorize(...)' });
      }
      if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)) {
        const router = node.expression.expression.text;
        const verb = node.expression.name.text;
        if (/router$/i.test(router)) {
          if (verb === 'use') {
            const args = node.arguments;
            const last = args[args.length - 1];
            if (last && guardName(last, guardAliases)) {
              const prefix = args.length === 2 && ts.isStringLiteral(args[0]) ? args[0].text : '';
              routerGuards.set(router, [...(routerGuards.get(router) ?? []), prefix]);
            }
          } else if (WRITE_VERBS.has(verb)) {
            routeCalls.push({ node, router, verb });
          }
        }
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(sf);

  for (const { node, router, verb } of routeCalls) {
    const args = node.arguments;
    const routePath = args[0] && ts.isStringLiteral(args[0]) ? args[0].text : '?';
    const prefixes = routerGuards.get(router) ?? [];
    const coveredByRouter = prefixes.some((p) => p === '' || routePath.startsWith(p));
    const coveredInline = args.some((a) => guardName(a, guardAliases) !== null);

    // `// open-write: reason` on the line(s) immediately above the call
    const statement = node.parent;
    const leading = ts.getLeadingCommentRanges(src, statement.getFullStart()) ?? [];
    const openWrite = leading.some((c) => /open-write:\s*\S/.test(src.slice(c.pos, c.end)));

    if (!coveredByRouter && !coveredInline && !openWrite) {
      unguarded.push({ file: name, line: lineOf(node), route: `${verb.toUpperCase()} ${routePath}` });
    }
  }

  return { unguarded, authorizeCalls };
}

describe('route write guards', () => {
  const files = fs
    .readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith('.routes.ts') && !f.startsWith('.'))
    .map((f) => path.join(ROUTES_DIR, f));

  it('scans the whole routes directory', () => {
    // If this ever drops, the scan is looking in the wrong place and passing vacuously.
    expect(files.length).toBeGreaterThan(120);
  });

  it('every POST/PUT/PATCH/DELETE is gated by a permission key, the admin floor, or an open-write reason', () => {
    const findings: Finding[] = [];
    for (const file of files) {
      if (OPEN_FILES[path.basename(file)]) continue;
      findings.push(...scanFile(file).unguarded);
    }
    const report = findings.map((f) => `  ${f.file}:${f.line}  ${f.route}`).join('\n');
    const verdict = findings.length
      ? `Unguarded write routes (add requirePermission('<key>') / router.use(requirePermissionForWrites('<key>')) / requireAdmin(), or a "// open-write: <reason>" comment above the route):\n${report}`
      : '';
    expect(verdict).toBe('');
  });

  it('the dead authorize(...roles) helper is gone from every route file', () => {
    const findings: Finding[] = [];
    for (const file of files) findings.push(...scanFile(file).authorizeCalls);
    const report = findings.map((f) => `  ${f.file}:${f.line}`).join('\n');
    const verdict = findings.length
      ? `authorize(...) lists are not connected to the Permissions page — use requirePermission:\n${report}`
      : '';
    expect(verdict).toBe('');
  });
});
