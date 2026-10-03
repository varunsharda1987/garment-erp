/**
 * The 16 extended trims are seen by every stock reader (2026-10-03).
 *
 * Hook-eye, snap button, buckle, belt, velcro, drawstring, ribbon, sequin, bead, motif, interlining, padding and
 * other fastener / tape / decorative / functional have no lot table — a receipt books them in stock_levels only.
 * derived_stock_view read only the 11 lot tables, so an interlining in store read 0 on Stock Levels, the run page,
 * the stage gate, Trim Issuance, MRP and Use Stock. Migration 20261003140000 adds their stock_levels rows.
 *
 * Also: a lot-table material's stock_levels row (which mirrors its lots) is never counted twice.
 *
 * Runs on garment_erp_test; tagged fixtures, per-step teardown.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import { only, onlyAll } from '../../utils/prisma-test-guard';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { getDerivedOnHandMap } from '../../services/helpers/derived-stock.helper';

const RUN = `ETV${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let warehouseId: string;
let interliningId: string;
let interliningRow: string;
let elasticId: string;
let elasticRow: string;

beforeAll(async () => {
  userId = (
    await createTestUser({
      email: `test-${RUN.toLowerCase()}@smoke.test`,
      role: 'ADMIN',
      isActive: true,
      isApproved: true,
    })
  ).id;
  warehouseId = (
    await prisma.warehouses.create({
      data: {
        warehouseCode: `${RUN}-WH`,
        warehouseName: `${RUN} Store`,
        warehouseType: 'RAW_MATERIAL',
        isActive: true,
        createdById: userId,
      },
    })
  ).id;

  interliningId = (
    await prisma.interlining_master.create({
      data: { id: randomUUID(), interliningCode: `${RUN}-INT`, interliningName: `${RUN} Fusing` },
    })
  ).id;
  interliningRow = await ensureMaterialRecord(interliningId, 'INTERLINING');

  elasticId = (
    await prisma.elastic_master.create({ data: { elasticCode: `${RUN}-ELS`, elasticName: `${RUN} Elastic` } })
  ).id;
  elasticRow = await ensureMaterialRecord(elasticId, 'ELASTIC');
});

afterAll(async () => {
  const materialIds = onlyAll([interliningRow, elasticRow]);
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['elastic_stock', () => prisma.elastic_stock.deleteMany({ where: { elasticId: only(elasticId) } })],
    ['stock_levels', () => prisma.stock_levels.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['stock_settings', () => prisma.stock_settings.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: { in: materialIds } } })],
    ['interlining_master', () => prisma.interlining_master.deleteMany({ where: { id: only(interliningId) } })],
    ['elastic_master', () => prisma.elastic_master.deleteMany({ where: { id: only(elasticId) } })],
    ['warehouses', () => prisma.warehouses.deleteMany({ where: { id: only(warehouseId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[extended-trim-stock-view teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

it('an interlining in stock_levels is on hand in the view', async () => {
  await prisma.stock_levels.create({
    data: { materialId: interliningRow, warehouseId, quantity: 125.5, unit: 'METER' },
  });
  const onHand = await getDerivedOnHandMap([interliningRow]);
  expect(onHand.get(interliningRow)).toBeCloseTo(125.5, 3);
});

it('a lot-table material is counted from its lots only, never again from its stock_levels mirror', async () => {
  await prisma.elastic_stock.create({
    data: {
      elasticId,
      quantityAvailable: 40,
      purchaseCost: 2,
      weightedAvgCost: 2,
      receivedDate: new Date(),
      warehouseId,
    },
  });
  await prisma.stock_levels.create({ data: { materialId: elasticRow, warehouseId, quantity: 40, unit: 'METER' } });
  const onHand = await getDerivedOnHandMap([elasticRow]);
  expect(onHand.get(elasticRow)).toBeCloseTo(40, 3);
});
