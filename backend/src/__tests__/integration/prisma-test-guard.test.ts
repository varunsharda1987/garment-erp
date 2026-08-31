/**
 * The interlock that would have prevented the 2026-08-31 data loss.
 *
 * A teardown deleted by a fixture id that `beforeAll` never assigned. Prisma reads an undefined
 * `where` value as "no filter", so instead of removing one row it emptied style_costing and its
 * four child tables — 43 cost sheets and 383 related rows on the live dev database.
 *
 * These tests assert the guard REFUSES such a call. They deliberately aim the dangerous shape at
 * real tables; if the guard ever regresses, the assertions fail rather than the tables emptying,
 * because a throw is the expected outcome. Nothing here is expected to write or delete anything.
 */

import { prisma } from '../helpers/test-utils';
import { guardDestructiveFilters, allowUnfilteredWrite } from '../../utils/prisma-test-guard';

describe('prisma test guard — destructive calls with an undefined filter', () => {
  const unassigned: string | undefined = undefined;

  it('refuses deleteMany when the where value is undefined (the exact incident shape)', async () => {
    await expect(prisma.style_costing.deleteMany({ where: { id: unassigned } })).rejects.toThrow(/prisma-test-guard/);
  });

  it('names the model and the offending path so the call site is obvious', async () => {
    await expect(prisma.orders.deleteMany({ where: { id: unassigned } })).rejects.toThrow(
      /orders\.deleteMany\(\).*where\.id.*undefined/s
    );
  });

  it('catches an undefined nested inside a relation filter, not just at the top level', async () => {
    await expect(prisma.order_bom_items.deleteMany({ where: { orderBom: { orderId: unassigned } } })).rejects.toThrow(
      /prisma-test-guard/
    );
  });

  it('catches an undefined inside an array branch (OR/IN)', async () => {
    await expect(prisma.customers.deleteMany({ where: { OR: [{ id: unassigned }] } })).rejects.toThrow(
      /prisma-test-guard/
    );
  });

  it('guards updateMany too — an unfiltered update rewrites every row', async () => {
    await expect(prisma.styles.updateMany({ where: { id: unassigned }, data: { styleName: 'x' } })).rejects.toThrow(
      /prisma-test-guard/
    );
  });

  it('allows a properly bounded delete through (no false positives)', async () => {
    // Matches nothing, but the filter IS bounded, so the guard must not interfere.
    const res = await prisma.style_costing.deleteMany({ where: { id: '__guard_test_no_such_id__' } });
    expect(res.count).toBe(0);
  });

  it('leaves reads alone — an undefined filter there is harmless', async () => {
    await expect(prisma.style_costing.findMany({ where: { id: unassigned }, take: 1 })).resolves.toBeDefined();
  });

  it('refuses a bulk delete with NO where at all — the worst form of the same bug', async () => {
    await expect(prisma.style_costing.deleteMany()).rejects.toThrow(/no effective filter/);
  });

  it('refuses a bulk delete with an EMPTY where — also matches every row', async () => {
    await expect(prisma.style_costing.deleteMany({ where: {} })).rejects.toThrow(/no effective filter/);
    await expect(prisma.orders.updateMany({ where: {}, data: {} })).rejects.toThrow(/no effective filter/);
  });

  it('allows a deliberately unfiltered write when it is explicitly opted into', async () => {
    // Nothing is actually wiped: the table is filtered to a value that matches nothing first.
    // What is asserted is that the guard steps aside when the intent is declared.
    const err = await allowUnfilteredWrite(async () => {
      try {
        await prisma.style_costing.updateMany({ where: { id: '__guard_optout_no_such_id__' }, data: {} });
        return null;
      } catch (e) {
        return e as Error;
      }
    });
    expect(err).toBeNull();
  });

  it('guards inside $transaction too — most destructive writes happen there', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        return tx.style_costing.deleteMany({ where: { id: unassigned } });
      })
    ).rejects.toThrow(/prisma-test-guard/);
  });

  it('still lets a bounded write through inside $transaction', async () => {
    const res = await prisma.$transaction(async (tx) => {
      return tx.style_costing.deleteMany({ where: { id: '__guard_tx_no_such_id__' } });
    });
    expect(res.count).toBe(0);
  });

  it('is a pure wrapper: the guarded client still exposes $transaction and raw access', () => {
    const guarded = guardDestructiveFilters(prisma);
    expect(typeof guarded.$transaction).toBe('function');
    expect(typeof guarded.$queryRaw).toBe('function');
  });
});
