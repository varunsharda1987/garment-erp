/**
 * MRP "Generate POs" puts each material on the PO category it belongs on — one PO per category, by the one PO
 * line rule (po-line-category.helper), never a majority vote (2026-09-28).
 *
 * The GRN books a line by its PO's category, and a lace PO books only lace: the vote put 2 laces + 1 button on one
 * Lace PO, whose button was received and booked nothing, and a greige lace went on a Lace PO instead of a Greige
 * Lace one. One supplier with a lace and a button now gets a Lace PO and a Trims PO, every line fitting its PO,
 * and the bulk wizard counts both POs.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import { only, onlyAll } from '../../utils/prisma-test-guard';
import { generatePOFromRequirements, generatePOsBySupplier } from '../../services/mrp.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { fitsPoCategory, loadPoLineMaterials } from '../../services/helpers/po-line-category.helper';

const RUN = `MPC${Date.now().toString(36).toUpperCase()}`;
const DAY = 86400000;

let userId: string;
let supplierId: string;
let laceId: string;
let greigeLaceId: string;
let buttonId: string;
const requirementIds: string[] = [];
const poIds: string[] = [];

const requirement = async (n: number, materialId: string, unit: 'METER' | 'PIECE', qty: number, unitPrice: number) => {
  const { id } = await prisma.material_requirements.create({
    data: {
      id: randomUUID(),
      requirementNumber: `${RUN}-MR${n}`,
      source: 'MANUAL',
      unit,
      materialId,
      orderQuantity: 1,
      quantityPerUnit: qty,
      wastagePercent: 0,
      totalRequired: qty,
      shortfall: qty,
      unitPrice,
      status: 'PO_REQUIRED',
      requiredDate: new Date(Date.now() + 30 * DAY),
      createdById: userId,
    },
  });
  requirementIds.push(id);
  return id;
};

/** Each PO's category, its lines' materials, and whether every line fits the category */
const posOf = async (ids: string[]) => {
  const pos = await prisma.purchase_orders.findMany({
    where: { id: { in: ids } },
    include: { purchase_order_items: { select: { materialId: true } } },
  });
  const facts = await loadPoLineMaterials(pos.flatMap((po) => po.purchase_order_items.map((i) => i.materialId!)));
  return pos
    .map((po) => ({
      category: po.poCategory,
      materialIds: po.purchase_order_items.map((i) => i.materialId),
      allFit: po.purchase_order_items.every((i) => fitsPoCategory(po.poCategory, facts.get(i.materialId!)!)),
    }))
    .sort((a, b) => String(a.category).localeCompare(String(b.category)));
};

beforeAll(async () => {
  userId = (
    await createTestUser({
      email: `test-${RUN.toLowerCase()}@smoke.test`,
      role: 'ADMIN',
      isActive: true,
      isApproved: true,
    })
  ).id;
  supplierId = (
    await prisma.suppliers.create({
      data: { code: `${RUN}-SUP`, name: `${RUN} Lace & Buttons`, isActive: true, createdById: userId },
    })
  ).id;
  laceId = (
    await prisma.lace_master.create({ data: { laceCode: `${RUN}-LC`, laceName: `${RUN} Dyed Lace`, isGreige: false } })
  ).id;
  greigeLaceId = (
    await prisma.lace_master.create({
      data: { laceCode: `${RUN}-GLC`, laceName: `${RUN} Greige Lace`, isGreige: true },
    })
  ).id;
  buttonId = (
    await prisma.button_master.create({
      data: { buttonCode: `${RUN}-BTN`, buttonName: `${RUN} Shell Button`, pricePerPiece: 0.125, pricePerGross: 18 },
    })
  ).id;
  await ensureMaterialRecord(laceId, 'LACE');
  await ensureMaterialRecord(greigeLaceId, 'LACE');
  await ensureMaterialRecord(buttonId, 'BUTTON');
});

afterAll(async () => {
  const materialIds = onlyAll([laceId, greigeLaceId, buttonId]);
  const steps: Array<[string, () => Promise<unknown>]> = [
    [
      'links',
      () => prisma.requirement_po_links.deleteMany({ where: { requirementId: { in: onlyAll(requirementIds) } } }),
    ],
    ['source links', () => prisma.po_source_links.deleteMany({ where: { purchaseOrderId: { in: onlyAll(poIds) } } })],
    ['po items', () => prisma.purchase_order_items.deleteMany({ where: { poId: { in: onlyAll(poIds) } } })],
    ['po', () => prisma.purchase_orders.deleteMany({ where: { id: { in: onlyAll(poIds) } } })],
    ['requirements', () => prisma.material_requirements.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['material_suppliers', () => prisma.material_suppliers.deleteMany({ where: { materialId: { in: materialIds } } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: { in: materialIds } } })],
    ['lace_master', () => prisma.lace_master.deleteMany({ where: { id: { in: onlyAll([laceId, greigeLaceId]) } } })],
    ['button_master', () => prisma.button_master.deleteMany({ where: { id: only(buttonId) } })],
    ['suppliers', () => prisma.suppliers.deleteMany({ where: { id: only(supplierId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[mrp-po-category-split teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('MRP raises one PO per category', () => {
  it('one supplier, a lace and a button → a Lace PO and a Trims PO, every line on its own', async () => {
    const laceReq = await requirement(1, laceId, 'METER', 100, 12);
    const buttonReq = await requirement(2, buttonId, 'PIECE', 288, 0.125);

    const result = await generatePOFromRequirements(
      {
        requirementIds: [laceReq, buttonReq],
        supplierId,
        expectedDeliveryDate: new Date(Date.now() + 7 * DAY).toISOString(),
        consolidate: true,
      } as never,
      userId
    );
    const ids = (result.purchaseOrders ?? []).map((po) => po.id);
    poIds.push(...ids);

    expect(ids).toHaveLength(2);
    expect(result.purchaseOrder?.id).toBe(ids[0]);
    expect(result.linkedRequirements).toBe(2);
    expect(result.totalItems).toBe(2);
    expect(await posOf(ids)).toEqual([
      { category: 'LACE', materialIds: [laceId], allFit: true },
      { category: 'TRIMS', materialIds: [buttonId], allFit: true },
    ]);
    // Each requirement is linked to the PO its material went on
    const links = await prisma.requirement_po_links.findMany({
      where: { requirementId: { in: [laceReq, buttonReq] } },
      select: { requirementId: true, purchaseOrderId: true },
    });
    expect(links).toHaveLength(2);
    expect(new Set(links.map((l) => l.purchaseOrderId))).toEqual(new Set(ids));
  });

  it('the bulk wizard puts a greige lace on a Greige Lace PO and counts both POs', async () => {
    const greigeReq = await requirement(3, greigeLaceId, 'METER', 50, 8);
    const buttonReq = await requirement(4, buttonId, 'PIECE', 144, 0.125);

    const result = await generatePOsBySupplier(
      [
        {
          supplierId,
          requirementIds: [greigeReq, buttonReq],
          expectedDeliveryDate: new Date(Date.now() + 7 * DAY).toISOString(),
        },
      ],
      userId
    );
    const ids = result.purchaseOrders.map((po) => po.id);
    poIds.push(...ids);

    expect(result.errors).toEqual([]);
    expect(result.totalPOs).toBe(2);
    expect(result.totalRequirements).toBe(2);
    expect(await posOf(ids)).toEqual([
      { category: 'GREIGE_LACE', materialIds: [greigeLaceId], allFit: true },
      { category: 'TRIMS', materialIds: [buttonId], allFit: true },
    ]);
  });
});
