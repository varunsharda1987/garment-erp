/**
 * MRP "generate POs" orders buttons by the GROSS (owner, 2026-09-26).
 *
 * A requirement counts buttons in pieces (2,300 pcs); the supplier sells them by the gross. The wizard's preview
 * and the PO it creates must both read 16 GROSS (rounded UP) at the rate per gross — the supplier's own, else
 * the master's — and the requirement link must hold PIECES (2,304) so the remainder check, cancel and
 * short-close keep comparing pieces with pieces. The wizard echoes the previewed quantity and price back as
 * edits: they are already in gross and must not be multiplied by 144 a second time.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { generatePOFromRequirements, previewPOsFromRequirements } from '../../services/mrp.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';

const RUN = `MBG${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let supplierId: string;
let buttonId: string;
let requirementId: string;
let poId: string | null = null;

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
      data: { code: `${RUN}-SUP`, name: `${RUN} Buttons`, isActive: true, createdById: userId },
    })
  ).id;
  buttonId = (
    await prisma.button_master.create({
      data: { buttonCode: `${RUN}-BTN`, buttonName: `${RUN} Shirt Button`, pricePerPiece: 0.125, pricePerGross: 18 },
    })
  ).id;
  await ensureMaterialRecord(buttonId, 'BUTTON');
  // This supplier's own price per gross beats the master's
  await prisma.button_suppliers.create({ data: { buttonId, supplierId, pricePerGross: 17 } });
  requirementId = (
    await prisma.material_requirements.create({
      data: {
        id: randomUUID(),
        requirementNumber: `${RUN}-MR`,
        source: 'MANUAL',
        unit: 'PIECE',
        materialId: buttonId,
        orderQuantity: 1,
        quantityPerUnit: 2300,
        wastagePercent: 0,
        totalRequired: 2300,
        shortfall: 2300,
        unitPrice: 0.125,
        status: 'PO_REQUIRED',
        requiredDate: new Date(Date.now() + 30 * 86400000),
        createdById: userId,
      },
    })
  ).id;
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['links', () => prisma.requirement_po_links.deleteMany({ where: { requirementId: only(requirementId) } })],
    ['source links', () => prisma.po_source_links.deleteMany({ where: { purchaseOrderId: only(poId ?? undefined) } })],
    ['po items', () => prisma.purchase_order_items.deleteMany({ where: { poId: only(poId ?? undefined) } })],
    ['po', () => prisma.purchase_orders.deleteMany({ where: { id: only(poId ?? undefined) } })],
    ['requirements', () => prisma.material_requirements.deleteMany({ where: { materialId: only(buttonId) } })],
    ['button_suppliers', () => prisma.button_suppliers.deleteMany({ where: { buttonId: only(buttonId) } })],
    ['material_suppliers', () => prisma.material_suppliers.deleteMany({ where: { materialId: only(buttonId) } })],
    ['materials', () => prisma.materials.deleteMany({ where: { id: only(buttonId) } })],
    ['button_master', () => prisma.button_master.deleteMany({ where: { id: only(buttonId) } })],
    ['suppliers', () => prisma.suppliers.deleteMany({ where: { id: only(supplierId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[mrp-buttons-by-gross teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('MRP orders buttons by the gross', () => {
  let groupKey: string;
  let previewQty: number;
  let previewPrice: number;

  it('the preview shows 16 GROSS (2,300 pcs rounded up) at the supplier’s rate per gross', async () => {
    const [group] = await previewPOsFromRequirements({
      groups: [
        {
          supplierId,
          requirementIds: [requirementId],
          expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        },
      ],
    });
    const [item] = group.items;
    expect(item.unit).toBe('GROSS');
    expect(item.quantity).toBe(16);
    expect(item.unitPrice).toBe(17);
    groupKey = item.groupKey!;
    previewQty = item.quantity;
    previewPrice = item.unitPrice;
  });

  it('the PO it creates matches the preview even when the wizard echoes it back — no second ×144', async () => {
    const result = await generatePOFromRequirements(
      {
        requirementIds: [requirementId],
        supplierId,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        consolidate: true,
        // what BulkPOGenerationDialog sends: the previewed figures, keyed by the group key
        itemPrices: { [groupKey]: previewPrice },
        itemQuantities: { [groupKey]: previewQty },
      } as never,
      userId
    );
    poId = result.purchaseOrder!.id;
    const [line] = await prisma.purchase_order_items.findMany({ where: { poId } });
    expect(line.unit).toBe('GROSS');
    expect(Number(line.orderedQuantity)).toBe(16);
    expect(Number(line.unitPrice)).toBe(17);
    expect(Number(line.stockUnitsPerUnit)).toBe(144);
    expect(Number(line.totalPrice)).toBe(272);
  });

  it('the requirement link holds pieces (2,304) — so no uncovered remainder is split off', async () => {
    const links = await prisma.requirement_po_links.findMany({ where: { requirementId } });
    expect(links).toHaveLength(1);
    expect(Number(links[0].allocatedQuantity)).toBe(2304);
    const splits = await prisma.material_requirements.count({ where: { splitFromId: requirementId } });
    expect(splits).toBe(0);
  });
});
