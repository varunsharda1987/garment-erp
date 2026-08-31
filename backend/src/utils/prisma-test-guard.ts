/**
 * Test-mode interlock against table-wiping filters.
 *
 * Prisma treats an `undefined` value in a `where` clause as "no filter". So this:
 *
 *     await prisma.style_costing.deleteMany({ where: { id: costSheetId } });
 *
 * deletes EVERY ROW when `costSheetId` is undefined — which is exactly what happens in a test
 * teardown after `beforeAll` threw before assigning it. On 2026-08-31 that wiped all 43 cost
 * sheets and 383 related rows from the live development database; only a nightly backup saved it.
 *
 * In production this shape is legitimate and common (`where: { status: maybeUndefined }` builds an
 * optional filter), so the guard is TEST-ONLY. It covers the destructive operations, where an
 * unfiltered match means data loss rather than an over-broad read.
 *
 * Failing loudly leaves fixture rows behind; that is vastly preferable to silently emptying a
 * table, and the thrown error names the exact call site.
 */

const DESTRUCTIVE_OPS = new Set(['delete', 'deleteMany', 'update', 'updateMany', 'upsert']);

/** Depth-limited scan for an explicitly-undefined value anywhere in a where clause. */
function findUndefinedPath(node: unknown, path: string[] = [], depth = 0): string | null {
  if (depth > 8 || node === null || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const hit = findUndefinedPath(node[i], [...path, `[${i}]`], depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    // `Object.entries` only yields keys that are actually present, so an explicit
    // `{ id: undefined }` is caught while an omitted key is correctly ignored.
    if (value === undefined) return [...path, key].join('.');
    const hit = findUndefinedPath(value, [...path, key], depth + 1);
    if (hit) return hit;
  }
  return null;
}

/** Operations that hit an unbounded number of rows, so an absent filter is catastrophic. */
const BULK_OPS = new Set(['deleteMany', 'updateMany']);

let unfilteredWritesAllowed = false;

/**
 * Permit deliberately unfiltered bulk writes inside `fn`.
 *
 * Deliberately awkward, and deliberately rare. If you find yourself reaching for this, check
 * first that the wipe is actually correct: a delete-everything followed by a rebuild is only safe
 * inside a transaction, and is usually better expressed as converging to the desired state than
 * as emptying the table and hoping the refill succeeds.
 */
export async function allowUnfilteredWrite<T>(fn: () => Promise<T>): Promise<T> {
  const previous = unfilteredWritesAllowed;
  unfilteredWritesAllowed = true;
  try {
    return await fn();
  } finally {
    unfilteredWritesAllowed = previous;
  }
}

/** The violation for this call, or null when the filter is safely bounded. */
function unboundedFilterError(model: string, operation: string, args: unknown): Error | null {
  const advice =
    `This usually means a fixture id was never assigned because setup failed. ` +
    `Guard the id (e.g. \`id: someId ?? '__unset__'\`), skip the cleanup when it is missing, or — ` +
    `if wiping the table is genuinely intended — wrap the call in allowUnfilteredWrite().`;

  const where = args && typeof args === 'object' ? (args as { where?: unknown }).where : undefined;

  // An absent, undefined, null or empty `where` on a bulk op matches EVERY row. This is a
  // strictly worse form of the incident shape, so it must not be quietly permitted.
  if (BULK_OPS.has(operation) && !unfilteredWritesAllowed) {
    const isEmptyObject =
      where !== null && typeof where === 'object' && !Array.isArray(where) && Object.keys(where).length === 0;
    if (where === undefined || where === null || isEmptyObject) {
      return new Error(
        `[prisma-test-guard] ${model}.${operation}() was called with no effective filter ` +
          `(\`where\` is ${where === undefined ? 'absent' : where === null ? 'null' : 'empty'}), ` +
          `which matches EVERY ROW in "${model}". ${advice}`
      );
    }
  }

  if (where === undefined || where === null) return null;

  const path = findUndefinedPath(where);
  if (path === null) return null;
  if (unfilteredWritesAllowed) return null;

  return new Error(
    `[prisma-test-guard] ${model}.${operation}() was called with \`where.${path}\` === undefined. ` +
      `Prisma ignores undefined filters, so this would have matched EVERY ROW in "${model}". ${advice}`
  );
}

/**
 * Wrap a Prisma client so destructive calls with an undefined filter throw.
 *
 * Implemented with Proxies rather than `$extends` so the returned value keeps the exact
 * PrismaClient type — callers and existing imports are unaffected.
 */
export function guardDestructiveFilters<T extends object>(client: T): T {
  const modelCache = new Map<string, unknown>();

  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      // $transaction hands its callback a SEPARATE client, which would otherwise be unguarded —
      // and most destructive writes in this codebase happen inside a transaction, so leaving it
      // out would exempt the majority of the surface this exists to protect. Wrap the tx client
      // with the same guard. The array form needs nothing: those promises were already built
      // from guarded delegates.
      if (prop === '$transaction' && typeof value === 'function') {
        const original = value as (...a: unknown[]) => unknown;
        return (...txArgs: unknown[]) => {
          const [first, ...rest] = txArgs;
          if (typeof first === 'function') {
            const userCallback = first as (tx: unknown) => unknown;
            return original.apply(target, [(tx: object) => userCallback(guardDestructiveFilters(tx)), ...rest]);
          }
          return original.apply(target, txArgs);
        };
      }

      // Skip the remaining $-prefixed APIs ($queryRaw, $connect, …) and non-model members.
      if (typeof prop !== 'string' || prop.startsWith('$') || prop.startsWith('_')) return value;
      if (!value || typeof value !== 'object') return value;

      const cached = modelCache.get(prop);
      if (cached) return cached;

      const guardedModel = new Proxy(value as object, {
        get(modelTarget, opProp, modelReceiver) {
          const op = Reflect.get(modelTarget, opProp, modelReceiver);
          if (typeof opProp !== 'string' || !DESTRUCTIVE_OPS.has(opProp) || typeof op !== 'function') {
            return op;
          }
          return (...callArgs: unknown[]) => {
            const violation = unboundedFilterError(prop, opProp, callArgs[0]);
            // Reject rather than throw synchronously: every other Prisma failure arrives as a
            // rejected promise, so callers' existing await/catch handling applies unchanged.
            if (violation) return Promise.reject(violation);
            return (op as (...a: unknown[]) => unknown).apply(modelTarget, callArgs);
          };
        },
      });

      modelCache.set(prop, guardedModel);
      return guardedModel;
    },
  }) as T;
}

/** True when this process is running the test suite. */
export function shouldGuardPrismaFilters(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
}

/**
 * Bound a teardown filter to a single id, safely.
 *
 * The interlock above stops an unset id from wiping a table, but it does so by rejecting — which
 * aborts the rest of the teardown and leaves MORE fixtures behind. Wrapping the id instead makes
 * the delete match nothing and lets cleanup carry on:
 *
 *     await prisma.orders.deleteMany({ where: { id: only(orderId) } });
 */
export function only(id: string | undefined | null): string {
  return id ?? '__unset__';
}

/** Same idea for an `in: [...]` list: drop the ids that were never assigned. */
export function onlyAll(ids: Array<string | undefined | null>): string[] {
  return ids.filter((v): v is string => typeof v === 'string' && v.length > 0);
}
