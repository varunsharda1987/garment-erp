/**
 * The live greige rate reads placed POs, and a saved rate is labelled with what it really is.
 *
 * Found costing IP00138 / IT00254 (2026-09-26): greige GRG-0072 had been ordered on PO2609-0004 at
 * ₹67, but every costing screen read received purchases only, so Fabric Costing offered January's
 * ₹58.5; a merchandiser typed ₹65 and the save left the old "PROCUREMENT · 25-Jan" label beside it.
 * 28 rows carried a label naming a purchase that did not have their rate.
 *
 * Now (greige-live-rate.helper, one lookup for every screen):
 *  - live rate = the newest placed greige PO or receipt; a DRAFT or CANCELLED PO is not a price,
 *    and on the same day a receipt beats the PO;
 *  - saving the live rate stamps its source and document;
 *  - a typed rate that departs from it needs a reason and is saved as MANUAL_OVERRIDE;
 *  - re-saving an untouched row keeps its label (the page re-sends every row).
 *
 * Runs against the real app + live DB; tagged fixtures, teardown in afterAll.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { resolveLiveGreigeRates } from '../../services/helpers/greige-live-rate.helper';

const RUN = `GLR${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';
const DAY = 24 * 60 * 60 * 1000;

let userId: string;
let authHeader: Record<string, string>;
let supplierId: string;
let greigeId: string; // the Jan purchase + a SENT PO
let tieGreigeId: string; // a receipt and a PO on the same day
let styleId: string;
let slotId: string;
let cadId: string;
const poIds: string[] = [];
let sentPoNumber: string;

async function makePo(materialId: string, status: 'SENT' | 'DRAFT' | 'CANCELLED', unitPrice: number, poDate: Date) {
  const poId = randomUUID();
  const poNumber = `${RUN}-PO${poIds.length + 1}`;
  await prisma.purchase_orders.create({
    data: {
      id: poId,
      poNumber,
      supplierId,
      poDate,
      expectedDeliveryDate: new Date(poDate.getTime() + 7 * DAY),
      status,
      poCategory: 'GREIGE',
      createdById: userId,
    },
  });
  await prisma.purchase_order_items.create({
    data: {
      id: randomUUID(),
      poId,
      materialId,
      orderedQuantity: 1000,
      receivedQuantity: 0,
      unitPrice,
      totalPrice: unitPrice * 1000,
      unit: 'METER',
    },
  });
  poIds.push(poId);
  return poNumber;
}

const purchase = (gId: string, rate: number, purchaseDate: Date) =>
  prisma.fabric_procurement.create({
    data: {
      id: `${RUN}-PROC-${randomUUID().slice(0, 8)}`,
      procurementType: 'GREIGE',
      supplierId,
      greigeId: gId,
      quantityPurchased: 7600,
      unit: 'meters',
      width: 63,
      ratePerUnit: rate,
      totalCost: rate * 7600,
      isStockPurchase: true,
      status: 'RECEIVED',
      purchaseDate,
      receivedDate: purchaseDate,
      createdById: userId,
    },
  });

const cadRow = () => prisma.fabric_width_cad.findUniqueOrThrow({ where: { id: cadId } });

/** What the Fabric Costing page posts for the row, at a given greige rate */
const save = (greigeCostPerMeter: number, greigeRateOverrideReason?: string) =>
  request(app)
    .post('/api/fabric-costing/save')
    .set(authHeader)
    .send({
      styleId,
      fabricCostings: [
        {
          fabricWidthCadId: cadId,
          styleFabricId: slotId,
          fabricId: null,
          greigeId,
          greigeCostPerMeter,
          ...(greigeRateOverrideReason !== undefined ? { greigeRateOverrideReason } : {}),
          transportCostPerMeter: 2,
          processorId: null,
          rateCardId: null,
          processingCostPerMeter: null,
          shrinkagePercent: null,
          shrinkageCostPerMeter: null,
          screenCostPerMeter: null,
          totalCostPerMeter: greigeCostPerMeter + 2,
          costInputMode: 'BUILD_UP',
          purpose: 'RAW_MATERIAL_CALCULATION',
        },
      ],
    });

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  supplierId = (
    await prisma.suppliers.create({
      data: { code: `${RUN}-SUP`, name: `${RUN} Hardik`, supplierCategories: ['GREIGE_SUPPLIER'], createdById: userId },
    })
  ).id;

  const greige = (code: string) =>
    prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-${code}`,
        greigeName: `${RUN} Cotton Flex ${code}`,
        genericGreigeName: `${RUN} Cotton Flex`,
        composition: '100% Cotton',
        greigeWidth: 63,
        createdById: userId,
      },
    });
  greigeId = (await greige('G1')).id;
  tieGreigeId = (await greige('G2')).id;
  const materialId = await ensureMaterialRecord(greigeId, 'GREIGE'); // materials.id === greige id
  const tieMaterialId = await ensureMaterialRecord(tieGreigeId, 'GREIGE');

  // GRG-0049/0072 as found: an old purchase at ₹58.5, then a placed PO at ₹67
  await purchase(greigeId, 58.5, new Date('2026-01-25T00:00:00.000Z'));
  sentPoNumber = await makePo(materialId, 'SENT', 67, new Date(Date.now() - 2 * DAY));
  // Newer and dearer, but not a price: a draft, and a cancelled order
  await makePo(materialId, 'DRAFT', 99, new Date(Date.now() - DAY));
  await makePo(materialId, 'CANCELLED', 98, new Date(Date.now() - DAY));

  // Same day: the receipt (what actually arrived) beats the PO
  const sameDay = new Date(Date.now() - 3 * DAY);
  await purchase(tieGreigeId, 60, sameDay);
  await makePo(tieMaterialId, 'SENT', 70, sameDay);

  styleId = randomUUID();
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Top`, createdById: userId },
  });
  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: 'Top', componentType: 'OTHER' },
  });
  slotId = (
    await prisma.style_fabrics.create({
      data: {
        id: randomUUID(),
        componentId: component.id,
        fabricName: `${RUN} Cotton Flex`,
        fabricType: 'GENERIC',
        genericGreigeName: `${RUN} Cotton Flex`,
        fabricFinishType: 'DYED',
      },
    })
  ).id;
  cadId = (
    await prisma.fabric_width_cad.create({
      data: {
        id: randomUUID(),
        styleFabricId: slotId,
        greigeId,
        componentName: 'Top',
        purpose: 'RAW_MATERIAL_CALCULATION',
        purposeEnum: 'RAW_MATERIAL_CALCULATION',
        cutableWidth: 52,
        cadAverage: 1.68,
        approvalStatus: 'APPROVED',
      },
    })
  ).id;
});

afterAll(async () => {
  const greiges = [only(greigeId), only(tieGreigeId)];
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['fabric_width_cad', () => prisma.fabric_width_cad.deleteMany({ where: { styleFabricId: only(slotId) } })],
    ['style_fabrics', () => prisma.style_fabrics.deleteMany({ where: { id: only(slotId) } })],
    ['style_components', () => prisma.style_components.deleteMany({ where: { styleId: only(styleId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['purchase_order_items', () => prisma.purchase_order_items.deleteMany({ where: { poId: { in: poIds } } })],
    ['purchase_orders', () => prisma.purchase_orders.deleteMany({ where: { id: { in: poIds } } })],
    ['fabric_procurement', () => prisma.fabric_procurement.deleteMany({ where: { greigeId: { in: greiges } } })],
    ['stock_levels', () => prisma.stock_levels.deleteMany({ where: { materialId: { in: greiges } } })],
    ['materials', () => prisma.materials.deleteMany({ where: { greigeId: { in: greiges } } })],
    ['greige_master', () => prisma.greige_master.deleteMany({ where: { id: { in: greiges } } })],
    ['suppliers', () => prisma.suppliers.deleteMany({ where: { id: only(supplierId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[greige-live-rate teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('the live greige rate', () => {
  it('is the newest placed PO — not a draft or cancelled one, not the older purchase', async () => {
    const live = (await resolveLiveGreigeRates([greigeId])).get(greigeId);
    expect(live?.rate).toBe(67);
    expect(live?.source).toBe('PURCHASE_ORDER');
    expect(live?.ref).toBe(sentPoNumber);
    expect(live?.supplierName).toBe(`${RUN} Hardik`);
  });

  it('on the same day, the receipt beats the PO', async () => {
    const live = (await resolveLiveGreigeRates([tieGreigeId])).get(tieGreigeId);
    expect(live?.rate).toBe(60);
    expect(live?.source).toBe('PROCUREMENT');
  });

  it('is what the Fabric Costing page receives, with the PO named', async () => {
    const res = await request(app)
      .get(`/api/fabric-costing/style/${styleId}?purpose=RAW_MATERIAL_CALCULATION`)
      .set(authHeader)
      .expect(200);
    const row = res.body.data.fabrics.find((f: { id: string }) => f.id === cadId);
    expect(row.greigeCostPerMeter).toBe(67);
    expect(row.greigeCostSource).toBe('PURCHASE_ORDER');
    expect(row.greigeCostSourceRef).toBe(sentPoNumber);
    expect(row.greigeCostSourceSupplier).toBe(`${RUN} Hardik`);
  });
});

describe('saving a greige rate', () => {
  it('at the live rate: labelled with the PO it came from, and who saved it', async () => {
    await save(67).expect(200);
    const row = await cadRow();
    expect(Number(row.greigeCostPerMeter)).toBe(67);
    expect(row.greigeRateSource).toBe('PURCHASE_ORDER');
    expect(row.greigeRateSourceRef).toBe(sentPoNumber);
    expect(row.greigeRateSetById).toBe(userId);
    expect(row.greigeRateOverrideReason).toBeNull();
  });

  it('a typed rate that departs from the live one is refused without a reason — nothing written', async () => {
    const res = await save(65);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/differs from the live rate ₹67/);
    expect(res.body.message).toContain(sentPoNumber);
    expect(Number((await cadRow()).greigeCostPerMeter)).toBe(67);
  });

  it('with a reason it is saved as MANUAL_OVERRIDE, carrying the reason — never the PO label', async () => {
    await save(65, 'supplier quote for the new quality').expect(200);
    const row = await cadRow();
    expect(Number(row.greigeCostPerMeter)).toBe(65);
    expect(row.greigeRateSource).toBe('MANUAL_OVERRIDE');
    expect(Number(row.greigeRateManualOverride)).toBe(65);
    expect(row.greigeRateOverrideReason).toBe('supplier quote for the new quality');
    expect(row.greigeRateSourceRef).toBeNull();
    expect(row.greigeRateSetById).toBe(userId);
  });

  it('re-saving the untouched row keeps its label (the page re-sends every row)', async () => {
    await save(65).expect(200);
    const row = await cadRow();
    expect(row.greigeRateSource).toBe('MANUAL_OVERRIDE');
    expect(row.greigeRateOverrideReason).toBe('supplier quote for the new quality');
  });

  it('returning to the live rate relabels it from the PO and drops the reason', async () => {
    await save(67).expect(200);
    const row = await cadRow();
    expect(row.greigeRateSource).toBe('PURCHASE_ORDER');
    expect(row.greigeRateOverrideReason).toBeNull();
    expect(row.greigeRateManualOverride).toBeNull();
  });
});

describe('CAD Planning seeds a new row with the same live rate', () => {
  it('saving an uncosted CAD row stamps ₹67 labelled with the PO — the lookup Fabric Costing uses', async () => {
    const row = await prisma.fabric_width_cad.create({
      data: {
        id: randomUUID(),
        styleFabricId: slotId,
        greigeId,
        componentName: `${RUN} seed`,
        purpose: 'COSTING',
        purposeEnum: 'COSTING',
        cutableWidth: 50,
        cadMeters: 4.35,
        approvalStatus: 'PENDING',
      },
    });
    await prisma.cad_size_breakdown.createMany({
      data: ['S', 'M', 'L', 'XL', 'XXL'].map((sizeName) => ({ cadId: row.id, sizeName, quantity: 1 })),
    });
    try {
      await request(app)
        .put(`/api/cad-planning/${styleId}/row/${row.id}`)
        .set(authHeader)
        .send({ printDirection: 'TWO_WAY' })
        .expect(200);
      const seeded = await prisma.fabric_width_cad.findUniqueOrThrow({ where: { id: row.id } });
      expect(Number(seeded.greigeCostPerMeter)).toBe(67);
      expect(seeded.greigeRateSource).toBe('PURCHASE_ORDER');
      expect(seeded.greigeRateSourceRef).toBe(sentPoNumber);
      expect(seeded.totalCostPerMeter).toBeNull(); // seeded, not costed
    } finally {
      await prisma.cad_size_breakdown.deleteMany({ where: { cadId: row.id } });
      await prisma.fabric_width_cad.delete({ where: { id: row.id } });
    }
  });
});
