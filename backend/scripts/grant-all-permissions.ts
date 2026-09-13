/**
 * Turn EVERY switch on the Permissions page ON, for every role.
 *
 * Run once when the Permissions page goes live (2026-09-13). Before that day the table was never
 * enforced and every role could do everything ("full access mode" in code). Making the table
 * real must not change anyone's access on day one — so the table is set to what was actually in
 * force, and the owner tightens it from the page, deliberately, with each change logged.
 *
 *   cd backend && npx ts-node scripts/grant-all-permissions.ts            # dry run
 *   cd backend && npx ts-node scripts/grant-all-permissions.ts --apply
 *
 * Idempotent. Creates any role×key row the table lacks (new catalogue keys), flips the rest to
 * allowed=true, writes one audit row, and clears the per-role permission cache in Redis so the
 * running API sees it without a restart.
 *
 * Deliberately imports only the Prisma client + the catalogue: pulling in the service layer from
 * a one-off script killed the process silently under ts-node (2026-09-13), so the audit row and
 * the cache flush are done directly here.
 */

import 'dotenv/config';
import { randomUUID } from 'crypto';
import { UserRole } from '@prisma/client';
import prisma from '../src/config/database';
import { PERMISSION_KEYS } from '../src/config/permissions.config';

const APPLY = process.argv.includes('--apply');
const out = (line: string) => process.stdout.write(`${line}\n`);

async function flushPermissionCache(): Promise<string> {
  // Mirrors backend/src/lib/cache.ts: keys are `erp:cache:permissions:*` on the configured Redis.
  const enabled =
    process.env.REDIS_CACHE_ENABLED === 'true' || process.env.REDIS_ENABLED === 'true' || !!process.env.REDIS_HOST;
  if (!enabled) return 'cache not enabled';
  try {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_CACHE_DB || process.env.REDIS_DB || '0', 10),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await redis.connect();
    const keys = await redis.keys('*permissions:*');
    if (keys.length) await redis.del(...keys);
    redis.disconnect();
    return `cache cleared (${keys.length} keys)`;
  } catch (err) {
    return `cache NOT cleared (${err instanceof Error ? err.message : String(err)}) — restart the API or wait 10 min`;
  }
}

async function main() {
  const roles = Object.values(UserRole);
  const existing = await prisma.role_permissions.findMany({
    select: { id: true, role: true, permissionKey: true, allowed: true },
  });
  const byKey = new Map(existing.map((r) => [`${r.role}|${r.permissionKey}`, r]));

  const toCreate: Array<{ role: UserRole; permissionKey: string; allowed: boolean }> = [];
  const toFlip: string[] = [];
  for (const role of roles) {
    for (const key of PERMISSION_KEYS) {
      const row = byKey.get(`${role}|${key}`);
      if (!row) toCreate.push({ role, permissionKey: key, allowed: true });
      else if (!row.allowed) toFlip.push(row.id);
    }
  }
  const stale = existing.filter((r) => !(PERMISSION_KEYS as readonly string[]).includes(r.permissionKey));

  out(`roles: ${roles.length}, catalogue keys: ${PERMISSION_KEYS.length}, rows now: ${existing.length}`);
  out(`  create (missing keys, allowed=true): ${toCreate.length}`);
  out(`  flip to allowed=true:                ${toFlip.length}`);
  out(`  stale rows (key no longer exists):   ${stale.length} — left untouched`);

  if (!APPLY) {
    out('\nDry run — re-run with --apply to write.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (toCreate.length) await tx.role_permissions.createMany({ data: toCreate, skipDuplicates: true });
    if (toFlip.length) await tx.role_permissions.updateMany({ where: { id: { in: toFlip } }, data: { allowed: true } });
    await tx.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: null,
        action: 'UPDATE',
        entityType: 'ROLE_PERMISSION',
        entityId: 'ALL',
        oldValues: {
          action: 'grant-all (go-live of the Permissions page; matches the full access every role already had)',
        },
        newValues: { created: toCreate.length, flipped: toFlip.length, total: roles.length * PERMISSION_KEYS.length },
        ipAddress: null,
      },
    });
  });

  const cache = await flushPermissionCache();
  out(`\nDone. ${toCreate.length} created, ${toFlip.length} flipped; ${cache}.`);
}

main()
  .catch((err) => {
    out(`FAILED: ${err instanceof Error ? err.stack : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
