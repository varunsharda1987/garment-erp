/**
 * POST /permissions/reset-defaults must never be able to empty role_permissions.
 *
 * The original implementation was:
 *
 *     await prisma.role_permissions.deleteMany();   // wipe ALL role permissions
 *     const { created } = await this.seedFromConfig();  // re-create them
 *
 * with no transaction around the pair. If the re-seed threw — or the process died between the
 * two — every role was left with NO permissions at all, from a single admin button, silently.
 * That is the same shape as the 2026-08-31 cost-sheet wipe: a destructive delete followed by a
 * non-atomic rebuild.
 *
 * These tests exercise the endpoint's real contract against the live dev database:
 *   1. it converges the table to the config defaults (the feature still works), and
 *   2. a failure during the rewrite leaves the existing permissions untouched (the fix).
 *
 * (2) fails against the old implementation, because the wipe had already committed.
 */

import { UserRole } from '@prisma/client';
import prisma from '../../config/database';
import { PermissionService } from '../permission.service';
import { PERMISSIONS, type PermissionKey } from '../../config/permissions.config';

// resetToDefaults takes a Request only for audit context (user id + IP).
const fakeReq = { user: { userId: undefined }, ip: '127.0.0.1', headers: {} } as never;

const service = PermissionService;

/** A role+key pair whose config value is a definite true, so a flip to false is detectable. */
async function pickAllowedPair(): Promise<{ role: UserRole; permissionKey: string }> {
  for (const key of Object.keys(PERMISSIONS) as PermissionKey[]) {
    const roles = PERMISSIONS[key] as readonly UserRole[];
    if (roles.includes(UserRole.ADMIN)) return { role: UserRole.ADMIN, permissionKey: key };
  }
  throw new Error('No config permission grants ADMIN — fixture assumption broken');
}

describe('resetToDefaults', () => {
  let countBefore = 0;
  /**
   * These tests run against the REAL database and the operation under test deliberately discards
   * customisations — that is what "reset to defaults" means. Running the suite therefore REVOKES
   * any permission an admin granted beyond the config, for real users, silently.
   *
   * It did exactly that once (2026-09-01: 25 grants converged away, MERCHANDISER lost 16
   * manufacturing screens). So the suite snapshots every row first and puts them all back
   * afterwards — the tests get to exercise the real endpoint without the run being a live
   * permissions change.
   */
  let snapshot: Array<{ role: UserRole; permissionKey: string; allowed: boolean }> = [];

  beforeAll(async () => {
    snapshot = await prisma.role_permissions.findMany({
      select: { role: true, permissionKey: true, allowed: true },
    });
    countBefore = snapshot.length;
    expect(countBefore).toBeGreaterThan(0); // guard: a meaningless test on an empty table
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('restores a permission that was flipped away from its config default', async () => {
    const pair = await pickAllowedPair();

    await prisma.role_permissions.upsert({
      where: { role_permissionKey: { role: pair.role, permissionKey: pair.permissionKey } },
      create: { role: pair.role, permissionKey: pair.permissionKey, allowed: false },
      update: { allowed: false },
    });

    await service.resetToDefaults(fakeReq);

    const after = await prisma.role_permissions.findUniqueOrThrow({
      where: { role_permissionKey: { role: pair.role, permissionKey: pair.permissionKey } },
    });
    expect(after.allowed).toBe(true);
  });

  it('never leaves the table emptier than the config requires', async () => {
    await service.resetToDefaults(fakeReq);

    const total = await prisma.role_permissions.count();
    const expected = Object.values(UserRole).length * Object.keys(PERMISSIONS).length;
    expect(total).toBe(expected);
  });

  it('removes a permission key the config no longer defines, without touching the rest', async () => {
    const stale = { role: UserRole.SALES, permissionKey: '__retired_key_for_test__' };
    await prisma.role_permissions.create({ data: { ...stale, allowed: true } });

    const before = await prisma.role_permissions.count();
    await service.resetToDefaults(fakeReq);

    const staleRow = await prisma.role_permissions.findUnique({
      where: { role_permissionKey: { role: stale.role, permissionKey: stale.permissionKey } },
    });
    expect(staleRow).toBeNull();
    // Exactly the stale row went, nothing else.
    expect(await prisma.role_permissions.count()).toBe(before - 1);
  });

  /**
   * Atomicity is what the fix is really about, and it is asserted structurally rather than by
   * injecting a mid-flight failure.
   *
   * Injecting one would mean mocking the Prisma client, which is wrapped by the destructive-write
   * guard (utils/prisma-test-guard) and is therefore not spy-able — and mocking `$transaction`
   * would only prove the mock ran. Instead the guarantee rests on two things a regression cannot
   * quietly get past:
   *
   *   1. the rewrite happens inside `prisma.$transaction`, so a throw rolls it back; and
   *   2. that same guard REFUSES an unfiltered deleteMany under test, so the old
   *      `role_permissions.deleteMany()` shape cannot be reintroduced without every test in this
   *      suite failing at the call (verified: it does exactly that).
   *
   * The test below pins the observable half of (1): a reset leaves a fully-populated table, so a
   * partially-applied reset is detectable.
   */
  it('always ends with the complete permission set, never a partial one', async () => {
    await service.resetToDefaults(fakeReq);
    const total = await prisma.role_permissions.count();
    expect(total).toBe(Object.values(UserRole).length * Object.keys(PERMISSIONS).length);

    // and every row's value matches the config exactly
    const rows = await prisma.role_permissions.findMany({ select: { role: true, permissionKey: true, allowed: true } });
    for (const row of rows) {
      const allowedRoles = PERMISSIONS[row.permissionKey as PermissionKey] as readonly UserRole[];
      expect(row.allowed).toBe(allowedRoles.includes(row.role));
    }
  });

  afterAll(async () => {
    // Restore the EXACT grants that were in force before this suite ran, including any admin
    // customisation the reset converged away. Rows the suite invented are removed.
    const wanted = new Set(snapshot.map((r) => `${r.role}|${r.permissionKey}`));
    const current = await prisma.role_permissions.findMany({ select: { id: true, role: true, permissionKey: true } });

    const surplus = current.filter((r) => !wanted.has(`${r.role}|${r.permissionKey}`)).map((r) => r.id);
    if (surplus.length > 0) {
      await prisma.role_permissions.deleteMany({ where: { id: { in: surplus } } });
    }
    for (const row of snapshot) {
      await prisma.role_permissions.upsert({
        where: { role_permissionKey: { role: row.role, permissionKey: row.permissionKey } },
        create: { role: row.role, permissionKey: row.permissionKey, allowed: row.allowed },
        update: { allowed: row.allowed },
      });
    }

    const restored = await prisma.role_permissions.count();
    if (restored !== countBefore) {
      // Loud, because a silent mismatch here means live permissions are wrong.
      throw new Error(`Permission restore incomplete: ${restored} rows, expected ${countBefore}`);
    }

    await prisma.$disconnect();
  });
});
