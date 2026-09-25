/**
 * "Create CAD" on a received stock lot (CAD Planning → Fabric Stock Available banner), and the
 * two neighbours that made a Production CAD unusable.
 *
 * Found checking ESSKY085LS after its first dyed fabric arrived (2026-09-23):
 *  - the style's fabric slot was not linked to the dyed fabric, so Create CAD resolved no slot and
 *    wrote an orphan row — no styleFabricId, no costingStyleId — that could not be approved and did
 *    not count for cutting, yet marked the lot "with CAD";
 *  - even when it found the slot it copied the layer length but no sizes, pieces or average;
 *  - "Copy to Production" carried the planning row's PRICE, and a costed PRODUCTION row can never be
 *    edited or deleted (validateCADModification), so a rejected copy was stuck for good;
 *  - Push to Fabric Costing stamped the same price onto Production rows;
 *  - the banner counted a REJECTED Production CAD as covering the lot, hiding Create CAD.
 *
 * 2026-09-25 (IP00138, LNG279): Fabric Costing → Promote to Production made priced, isLocked
 * Production rows with no lot that nobody could edit or delete. Every writer now applies Create
 * CAD's lot rule (production-cad-lot.helper); Copy to Production, a purpose edit into or out of
 * PRODUCTION and Create Version on one are refused; only approval and real users protect it.
 *
 * Owner decision: one Production CAD per lot, pre-filled from the approved planning marker.
 *
 * Runs against the real app + live DB; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `CPS${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let greigeId: string;
let dyedId: string;
let slotId: string;
let rmcId: string;
let lotId: string;
let lot2Id: string;
let firstCadId: string;

const lot = (width: number) =>
  prisma.fabric_stock.create({
    data: {
      fabricId: dyedId,
      finishedWidth: width + 2,
      cutableWidth: width,
      quantityAvailable: 100,
      weightedAvgCost: 59,
      purchaseCost: 59,
      receivedDate: new Date(),
      originStyleId: styleId,
      status: 'AVAILABLE',
      fabricFinishType: 'DYED',
      createdById: userId,
    },
  });

const productionRowsOnLot = (fabricStockId: string) =>
  prisma.fabric_width_cad.findMany({ where: { fabricStockId, purposeEnum: 'PRODUCTION' } });

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const greige = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-G`,
      greigeName: `${RUN} Moss 63"`,
      genericGreigeName: `${RUN} Moss`,
      composition: '100% Viscose',
      greigeWidth: 63,
      createdById: userId,
    },
  });
  greigeId = greige.id;

  styleId = randomUUID();
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Top`, createdById: userId },
  });
  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: 'Top', componentType: 'OTHER' },
  });
  // The slot as ESSKY085LS had it: greige-sourced, NOT linked to the dyed fabric
  const slot = await prisma.style_fabrics.create({
    data: {
      id: randomUUID(),
      componentId: component.id,
      fabricName: `${RUN} Moss`,
      fabricType: 'GENERIC',
      genericGreigeName: `${RUN} Moss`,
      fabricFinishType: 'DYED',
    },
  });
  slotId = slot.id;

  const dyed = await prisma.fabric_master.create({
    data: {
      fabricCode: `${RUN}-DYED`,
      fabricName: `${RUN} Moss - Solid/Dyed - Black - 54"`,
      greigeId,
      colorName: 'Black',
      finishType: 'DYED',
      styleReference: `${RUN}-STY`,
      createdById: userId,
    },
  });
  dyedId = dyed.id;

  // The approved, price-approved planning marker: 4.35 m layer, 6 pcs (1 × XS..XXL), 0.7333 m/pc
  const rmc = await prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      styleFabricId: slotId,
      costingStyleId: styleId,
      greigeId,
      componentName: 'Top',
      purpose: 'RAW_MATERIAL_CALCULATION',
      purposeEnum: 'RAW_MATERIAL_CALCULATION',
      cutableWidth: 52,
      cadMeters: 4.35,
      layerMarginMeters: 0.05,
      piecesPerMarker: 6,
      cadAverage: 0.7333,
      totalCostPerMeter: 57,
      approvalStatus: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: userId,
    },
  });
  rmcId = rmc.id;
  await prisma.cad_size_breakdown.createMany({
    data: ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((sizeName) => ({ cadId: rmcId, sizeName, quantity: 1 })),
  });

  lotId = (await lot(52)).id;
  lot2Id = (await lot(52)).id;
});

afterAll(async () => {
  const lots = [lotId, lot2Id].map((id) => only(id));
  const ownRows = {
    OR: [{ styleFabric: { style_components: { styleId: only(styleId) } } }, { fabricStockId: { in: lots } }],
  };
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['cad_size_breakdown', () => prisma.cad_size_breakdown.deleteMany({ where: { cad: ownRows } })],
    ['fabric_width_cad', () => prisma.fabric_width_cad.deleteMany({ where: ownRows })],
    ['fabric_stock', () => prisma.fabric_stock.deleteMany({ where: { id: { in: lots } } })],
    [
      'style_fabrics',
      () => prisma.style_fabrics.deleteMany({ where: { style_components: { styleId: only(styleId) } } }),
    ],
    ['style_components', () => prisma.style_components.deleteMany({ where: { styleId: only(styleId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['fabric_master', () => prisma.fabric_master.deleteMany({ where: { id: only(dyedId) } })],
    ['greige_master', () => prisma.greige_master.deleteMany({ where: { id: only(greigeId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[cad-production-from-stock teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('Create CAD on a received lot', () => {
  it('finds the unlinked slot by greige and pre-fills the full marker, with no price', async () => {
    // What the banner posts for a lot whose slot is not linked: no styleFabricId, no componentId
    const res = await request(app)
      .post(`/api/cad-planning/${styleId}/production-from-stock`)
      .set(authHeader)
      .send({ fabricStockId: lotId, greigeId });
    expect(res.status).toBe(201);
    expect(res.body.warning ?? null).toBeNull();

    const [row] = await productionRowsOnLot(lotId);
    firstCadId = row.id;
    expect(row.styleFabricId).toBe(slotId);
    expect(row.fabricId).toBe(dyedId); // the lot's fabric, not the planning row's
    expect(row.costingStyleId).toBeNull();
    expect(row.totalCostPerMeter).toBeNull();
    expect(row.approvalStatus).toBe('PENDING');
    expect(Number(row.cutableWidth)).toBe(52);
    expect(Number(row.cadMeters)).toBeCloseTo(4.35, 4);
    expect(row.piecesPerMarker).toBe(6);
    expect(Number(row.cadAverage)).toBeCloseTo(0.7333, 4);
    expect(row.copiedFromId).toBe(rmcId);
    const sizes = await prisma.cad_size_breakdown.findMany({ where: { cadId: row.id } });
    expect(sizes).toHaveLength(6);
  });

  it('refuses a second Production CAD on the same lot', async () => {
    const res = await request(app)
      .post(`/api/cad-planning/${styleId}/production-from-stock`)
      .set(authHeader)
      .send({ fabricStockId: lotId });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/already has a Production CAD/);
    expect(await productionRowsOnLot(lotId)).toHaveLength(1);
  });

  it('a second lot of the same width gets its own row (no unique-key clash)', async () => {
    const res = await request(app)
      .post(`/api/cad-planning/${styleId}/production-from-stock`)
      .set(authHeader)
      .send({ fabricStockId: lot2Id });
    expect(res.status).toBe(201);
    expect(await productionRowsOnLot(lot2Id)).toHaveLength(1);
  });

  it('after a rejection the lot needs a CAD again, and the table says who rejected it and why', async () => {
    await request(app)
      .post(`/api/cad-planning/${styleId}/row/${firstCadId}/reject`)
      .set(authHeader)
      .send({ rejectionNotes: `${RUN} wrong layer` })
      .expect(200);

    const table = await request(app).get(`/api/cad-planning/${styleId}/table`).set(authHeader).expect(200);
    const lotEntry = table.body.data.stockSummary.find((s: { id: string }) => s.id === lotId);
    expect(lotEntry.hasProductionCad).toBe(false);
    expect(lotEntry.productionCadStatus).toBe('REJECTED');
    expect(lotEntry).toHaveProperty('grnNumber');
    const rejected = table.body.data.cadRows.find((r: { id: string }) => r.id === firstCadId);
    expect(rejected.approvalStatus).toBe('REJECTED');
    expect(rejected.approvalNotes).toBe(`${RUN} wrong layer`);
    expect(rejected.rejectedByName).toBeTruthy();

    const again = await request(app)
      .post(`/api/cad-planning/${styleId}/production-from-stock`)
      .set(authHeader)
      .send({ fabricStockId: lotId });
    expect(again.status).toBe(201);
    expect(await productionRowsOnLot(lotId)).toHaveLength(2);
  });

  it("refuses — and writes nothing — when the lot matches two of the style's slots", async () => {
    const second = await prisma.style_components.create({
      data: { id: randomUUID(), styleId, componentName: 'Bottom', componentType: 'OTHER' },
    });
    const twin = await prisma.style_fabrics.create({
      data: {
        id: randomUUID(),
        componentId: second.id,
        fabricName: `${RUN} Moss`,
        fabricType: 'GENERIC',
        genericGreigeName: `${RUN} Moss`,
        fabricFinishType: 'DYED',
      },
    });
    await prisma.fabric_width_cad.create({
      data: {
        id: randomUUID(),
        styleFabricId: twin.id,
        greigeId,
        purpose: 'RAW_MATERIAL_CALCULATION',
        purposeEnum: 'RAW_MATERIAL_CALCULATION',
        cutableWidth: 52,
      },
    });
    const extraLot = await lot(52);
    try {
      const res = await request(app)
        .post(`/api/cad-planning/${styleId}/production-from-stock`)
        .set(authHeader)
        .send({ fabricStockId: extraLot.id });
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/Cannot tell which fabric/);
      expect(await productionRowsOnLot(extraLot.id)).toHaveLength(0);
    } finally {
      await prisma.fabric_stock.delete({ where: { id: extraLot.id } });
    }
  });
});

/**
 * A lot-less Production row as the retired writers left them: Copy to Production, a purpose edit,
 * and Fabric Costing → Promote, which also priced and isLocked it (IP00138 dcd56333, LNG279 018933e8).
 */
const legacyProductionRow = (data: Partial<Prisma.fabric_width_cadUncheckedCreateInput> = {}) =>
  prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      styleFabricId: slotId,
      greigeId,
      purpose: 'PRODUCTION',
      purposeEnum: 'PRODUCTION',
      cutableWidth: 52,
      cadAverage: 0.7333,
      approvalStatus: 'PENDING',
      ...data,
    },
  });

describe('a CAD row a cost sheet still uses cannot be deleted', () => {
  // Deleting it used to BLANK the sheet's link (ON DELETE SET NULL) with no error — how
  // ESSKY085LS's approved sheet and its order BOM lost their CAD in Aug 2026.
  it('refuses, naming what still uses it, and deletes once nothing does', async () => {
    const cad = await legacyProductionRow({
      approvalStatus: 'REJECTED',
      totalCostPerMeter: 77,
      isLocked: true,
      costingStyleId: styleId,
      componentName: `${RUN} sheet`,
    });
    const cadId = cad.id;
    const sheetId = `${RUN}-CS`;
    await prisma.style_costing.create({
      data: { id: sheetId, styleId, createdById: userId, approvalStatus: 'PENDING', isApproved: false },
    });
    await prisma.style_costing_fabric_items.create({
      data: { costingId: sheetId, fabricName: `${RUN} Moss`, fabricCADId: cadId, width: 52, cadMeters: 0.7333 },
    });
    try {
      const refused = await request(app).delete(`/api/cad-planning/${styleId}/row/${cadId}`).set(authHeader);
      expect(refused.status).toBe(422);
      expect(refused.body.message).toMatch(/1 cost sheet line still use it/);
      const line = await prisma.style_costing_fabric_items.findFirst({ where: { costingId: sheetId } });
      expect(line?.fabricCADId).toBe(cadId); // the link survived
    } finally {
      await prisma.style_costing.delete({ where: { id: sheetId } }); // cascades its lines
    }
    await request(app).delete(`/api/cad-planning/${styleId}/row/${cadId}`).set(authHeader).expect(200);
  });
});

describe('the stuck Production CAD (IP00138, LNG279, 2026-09-25)', () => {
  // "Cannot update/delete CAD entry: This is a costed PRODUCTION CAD" — for a rejected row that
  // nothing used. A Production CAD is never costed now; its approval and its users protect it.
  it('a rejected, priced, isLocked Production row nothing uses can be edited and deleted', async () => {
    const cad = await legacyProductionRow({
      approvalStatus: 'REJECTED',
      totalCostPerMeter: 77,
      isLocked: true,
      costingStyleId: styleId,
      componentName: `${RUN} stuck`,
    });
    await request(app)
      .put(`/api/cad-planning/${styleId}/row/${cad.id}`)
      .set(authHeader)
      .send({ piecesPerMarker: 5 })
      .expect(200);
    await request(app).delete(`/api/cad-planning/${styleId}/row/${cad.id}`).set(authHeader).expect(200);
    expect(await prisma.fabric_width_cad.findUnique({ where: { id: cad.id } })).toBeNull();
  });
});

describe('a Production CAD needs a received lot — every writer, not only Create CAD', () => {
  // Owner, 2026-09-25: "shouldn't have been possible without the bulk fabric inward".
  let otherStyleId: string;
  let otherGreigeId: string;
  let otherFabricId: string;
  let otherLotId: string;

  beforeAll(async () => {
    // Another style's lot: its own greige, its own dyed fabric, received for that style
    otherStyleId = randomUUID();
    await prisma.styles.create({
      data: { id: otherStyleId, styleCode: `${RUN}-OTH`, styleName: `${RUN} Other`, createdById: userId },
    });
    otherGreigeId = (
      await prisma.greige_master.create({
        data: {
          greigeCode: `${RUN}-G2`,
          greigeName: `${RUN} Poplin 60"`,
          genericGreigeName: `${RUN} Poplin`,
          composition: '100% Cotton',
          greigeWidth: 60,
          createdById: userId,
        },
      })
    ).id;
    otherFabricId = (
      await prisma.fabric_master.create({
        data: {
          fabricCode: `${RUN}-OTHDYED`,
          fabricName: `${RUN} Poplin - Solid/Dyed - Navy - 56"`,
          greigeId: otherGreigeId,
          colorName: 'Navy',
          finishType: 'DYED',
          createdById: userId,
        },
      })
    ).id;
    otherLotId = (
      await prisma.fabric_stock.create({
        data: {
          fabricId: otherFabricId,
          finishedWidth: 54,
          cutableWidth: 52,
          quantityAvailable: 100,
          weightedAvgCost: 60,
          purchaseCost: 60,
          receivedDate: new Date(),
          originStyleId: otherStyleId,
          status: 'AVAILABLE',
          fabricFinishType: 'DYED',
          createdById: userId,
        },
      })
    ).id;
  });

  afterAll(async () => {
    const steps: Array<[string, () => Promise<unknown>]> = [
      ['fabric_width_cad', () => prisma.fabric_width_cad.deleteMany({ where: { fabricStockId: only(otherLotId) } })],
      ['fabric_stock', () => prisma.fabric_stock.deleteMany({ where: { id: only(otherLotId) } })],
      ['fabric_master', () => prisma.fabric_master.deleteMany({ where: { id: only(otherFabricId) } })],
      ['greige_master', () => prisma.greige_master.deleteMany({ where: { id: only(otherGreigeId) } })],
      ['styles', () => prisma.styles.deleteMany({ where: { id: only(otherStyleId) } })],
    ];
    for (const [label, run] of steps) {
      try {
        await run();
      } catch (err) {
        console.error(`[cad-production-from-stock teardown] could not clean ${label}:`, err);
      }
    }
  });

  it('Copy to Production is refused — Create CAD on the lot is the way', async () => {
    const productionRowsOfSlot = () =>
      prisma.fabric_width_cad.count({ where: { styleFabricId: slotId, purposeEnum: 'PRODUCTION' } });
    const before = await productionRowsOfSlot();
    const res = await request(app)
      .post(`/api/cad-planning/${styleId}/copy`)
      .set(authHeader)
      .send({ sourceCadId: rmcId, targetPurpose: 'PRODUCTION', styleFabricId: slotId });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/Create CAD on the lot/);
    expect(await productionRowsOfSlot()).toBe(before);
  });

  it("a purpose edit cannot make a planning row a Production CAD, nor turn a lot's marker back", async () => {
    const planning = await prisma.fabric_width_cad.create({
      data: {
        id: randomUUID(),
        styleFabricId: slotId,
        greigeId,
        purpose: 'COSTING',
        purposeEnum: 'COSTING',
        cutableWidth: 50,
        approvalStatus: 'PENDING',
        componentName: `${RUN} edit`,
      },
    });
    const into = await request(app)
      .put(`/api/cad-planning/${styleId}/row/${planning.id}`)
      .set(authHeader)
      .send({ purpose: 'PRODUCTION' });
    expect(into.status).toBe(422);
    expect(into.body.message).toMatch(/made for a received fabric lot/);
    expect((await prisma.fabric_width_cad.findUnique({ where: { id: planning.id } }))?.purposeEnum).toBe('COSTING');

    const [lotMarker] = await productionRowsOnLot(lot2Id);
    const out = await request(app)
      .put(`/api/cad-planning/${styleId}/row/${lotMarker.id}`)
      .set(authHeader)
      .send({ purpose: 'RAW_MATERIAL_CALCULATION' });
    expect(out.status).toBe(422);
    expect((await prisma.fabric_width_cad.findUnique({ where: { id: lotMarker.id } }))?.purposeEnum).toBe('PRODUCTION');
  });

  it("Add Row refuses another style's lot, and a lot that already has a Production CAD", async () => {
    const foreign = await request(app)
      .post(`/api/cad-planning/${styleId}/row`)
      .set(authHeader)
      .send({ styleFabricId: slotId, purpose: 'PRODUCTION', fabricStockId: otherLotId });
    expect(foreign.status).toBe(422);
    expect(foreign.body.message).toMatch(/is not a fabric of/);
    expect(await productionRowsOnLot(otherLotId)).toHaveLength(0);

    const taken = await request(app)
      .post(`/api/cad-planning/${styleId}/row`)
      .set(authHeader)
      .send({ styleFabricId: slotId, purpose: 'PRODUCTION', fabricStockId: lot2Id });
    expect(taken.status).toBe(422);
    expect(taken.body.message).toMatch(/already has a Production CAD/);
    expect(await productionRowsOnLot(lot2Id)).toHaveLength(1);
  });

  it("Link to Stock refuses another style's lot, and a Production CAD with no lot cannot be approved", async () => {
    const orphan = await legacyProductionRow({ componentName: `${RUN} link` });

    const link = await request(app)
      .post(`/api/cad-planning/${styleId}/link-stock`)
      .set(authHeader)
      .send({ cadId: orphan.id, fabricStockId: otherLotId });
    expect(link.status).toBe(422);
    expect(link.body.message).toMatch(/is not a fabric of/);

    const approve = await request(app)
      .post(`/api/cad-planning/${styleId}/row/${orphan.id}/approve`)
      .set(authHeader)
      .send({});
    expect(approve.status).toBe(422);
    expect(approve.body.message).toMatch(/not on a received fabric lot/);
    const after = await prisma.fabric_width_cad.findUnique({ where: { id: orphan.id } });
    expect(after?.approvalStatus).toBe('PENDING');
    expect(after?.fabricStockId).toBeNull();
  });

  it('Create Version is refused on a Production CAD (it would be a second row that lost the lot)', async () => {
    const approved = await legacyProductionRow({
      approvalStatus: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: userId,
      componentName: `${RUN} version`,
    });
    const res = await request(app)
      .post(`/api/cad-planning/${styleId}/planning/${approved.id}/create-version`)
      .set(authHeader)
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/no versions/);
    expect(await prisma.fabric_width_cad.count({ where: { supersededById: approved.id } })).toBe(0);
  });
});

describe('Push to Fabric Costing', () => {
  it('skips Production rows', async () => {
    const res = await request(app)
      .post('/api/fabric-costing/push-from-cad')
      .set(authHeader)
      .send({ styleId, cadRowIds: [firstCadId] })
      .expect(200);
    expect(res.body.data.created).toBe(0);
    expect(res.body.data.skippedRows[0].reason).toMatch(/Production CADs are lot markers/);
    const row = await prisma.fabric_width_cad.findUnique({ where: { id: firstCadId } });
    expect(row?.totalCostPerMeter).toBeNull();
  });
});
