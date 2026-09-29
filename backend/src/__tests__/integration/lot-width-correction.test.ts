/**
 * A received lot's width and the width of the marker cut from it (services/helpers/lot-width.helper.ts).
 *
 * ESSKY076LS (2026-09-29): both lots were recorded as 57" measured → 55" cutable; the fabric measures 55" →
 * 53" cutable, and the approved Raw Mat marker is 52". A lot's width could not be corrected after inward, and
 * Create CAD reused the marker only at EXACTLY the lot's width, so a 52" marker on a 53" lot lost its length
 * and image. Owner decisions: reuse a marker that fits (≤ the lot's cutable width), warn over 2" spare,
 * refuse one wider than the lot; Correct width on a lot; the job-work receipt needs the measured width.
 *
 * Not walked here: the "already gone to cutting" refusal of Correct width (a cutting batch needs a work order).
 *
 * Runs against the real app + live DB; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { giveMarkerImage } from '../helpers/marker-fixture';
import { cutableFromMeasured, markerFitsLot } from '../../services/helpers/lot-width.helper';

const RUN = `LWC${Date.now().toString(36).toUpperCase()}`;
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((sizeName) => ({ sizeName, quantity: 1 }));

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let greigeId: string;
let dyedId: string;
let slotId: string;
let rmcId: string;
const lots: Record<'recordedWrong' | 'narrow' | 'wide', string> = { recordedWrong: '', narrow: '', wide: '' };

const lot = async (finished: number, cutable: number) =>
  (
    await prisma.fabric_stock.create({
      data: {
        fabricId: dyedId,
        finishedWidth: finished,
        cutableWidth: cutable,
        quantityAvailable: 100,
        weightedAvgCost: 59,
        purchaseCost: 59,
        receivedDate: new Date(),
        originStyleId: styleId,
        status: 'AVAILABLE',
        fabricFinishType: 'DYED',
        createdById: userId,
      },
    })
  ).id;

const productionRowOn = async (fabricStockId: string) => {
  const rows = await prisma.fabric_width_cad.findMany({ where: { fabricStockId, purposeEnum: 'PRODUCTION' } });
  expect(rows).toHaveLength(1);
  return rows[0];
};

const createCad = (fabricStockId: string) =>
  request(app)
    .post(`/api/cad-planning/${styleId}/production-from-stock`)
    .set(authHeader)
    .send({ fabricStockId, greigeId });

const correctWidth = (fabricStockId: string, body: Record<string, unknown>) =>
  request(app).post(`/api/stock/${fabricStockId}/correct-width`).set(authHeader).send(body);

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  greigeId = (
    await prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-G`,
        greigeName: `${RUN} Viscose 63"`,
        genericGreigeName: `${RUN} Viscose`,
        composition: '100% Viscose',
        greigeWidth: 63,
        createdById: userId,
      },
    })
  ).id;

  styleId = randomUUID();
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Shirt`, createdById: userId },
  });
  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: 'Shirt', componentType: 'OTHER' },
  });
  slotId = (
    await prisma.style_fabrics.create({
      data: {
        id: randomUUID(),
        componentId: component.id,
        fabricName: `${RUN} Viscose`,
        fabricType: 'GENERIC',
        genericGreigeName: `${RUN} Viscose`,
        fabricFinishType: 'DYED',
      },
    })
  ).id;
  dyedId = (
    await prisma.fabric_master.create({
      data: {
        fabricCode: `${RUN}-DYED`,
        fabricName: `${RUN} Viscose - Solid/Dyed - Black - 57"`,
        greigeId,
        colorName: 'Black',
        finishType: 'DYED',
        styleReference: `${RUN}-STY`,
        createdById: userId,
      },
    })
  ).id;

  // The approved Raw Mat marker at 52": 7.05 m layer, 5 pcs — with its marker image
  rmcId = (
    await prisma.fabric_width_cad.create({
      data: {
        id: randomUUID(),
        styleFabricId: slotId,
        costingStyleId: styleId,
        greigeId,
        componentName: 'Shirt',
        purpose: 'RAW_MATERIAL_CALCULATION',
        purposeEnum: 'RAW_MATERIAL_CALCULATION',
        cutableWidth: 52,
        cadMeters: 7.05,
        layerMarginMeters: 0.1,
        piecesPerMarker: 6,
        cadAverage: 1.1917,
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: userId,
      },
    })
  ).id;
  await prisma.cad_size_breakdown.createMany({ data: SIZES.map((s) => ({ cadId: rmcId, ...s })) });
  await giveMarkerImage(prisma, { cadId: rmcId, styleId, lengthM: 7.05, widthIn: 52, sizes: SIZES });

  lots.recordedWrong = await lot(57, 55); // recorded 57" measured; really 55" → 53" cutable
  lots.narrow = await lot(52, 50); // too narrow for the 52" marker
  lots.wide = await lot(58, 56); // 4" spare for the 52" marker
});

afterAll(async () => {
  const lotIds = Object.values(lots).map((id) => only(id));
  const ownRows = {
    OR: [{ styleFabric: { style_components: { styleId: only(styleId) } } }, { fabricStockId: { in: lotIds } }],
  };
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['audit_logs', () => prisma.audit_logs.deleteMany({ where: { entityId: { in: lotIds } } })],
    ['cad_purpose_files', () => prisma.cad_purpose_files.deleteMany({ where: { styleId: only(styleId) } })],
    ['cad_size_breakdown', () => prisma.cad_size_breakdown.deleteMany({ where: { cad: ownRows } })],
    ['fabric_width_cad', () => prisma.fabric_width_cad.deleteMany({ where: ownRows })],
    ['fabric_stock', () => prisma.fabric_stock.deleteMany({ where: { id: { in: lotIds } } })],
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
      console.error(`[lot-width-correction teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('the one rule', () => {
  it('cutable = measured − selvedge; a marker fits when it is no wider than the lot', () => {
    expect(cutableFromMeasured(55, 2)).toBe(53);
    expect(cutableFromMeasured(1.5, 2)).toBe(1.5);
    expect(markerFitsLot(52, 53)).toEqual({ fits: true, spareInches: 1, wideSpare: false });
    expect(markerFitsLot(52, 56)).toEqual({ fits: true, spareInches: 4, wideSpare: true });
    expect(markerFitsLot(53.004, 53).fits).toBe(true); // within the 0.005 dust
    expect(markerFitsLot(54, 53).fits).toBe(false);
  });
});

describe('Correct width on a lot', () => {
  it('refuses a cutable width above the measured one, and a missing reason', async () => {
    const over = await correctWidth(lots.recordedWrong, {
      measuredWidthInches: 55,
      cutableWidthInches: 56,
      reason: 'test',
    });
    expect(over.status).toBe(400);
    const noReason = await correctWidth(lots.recordedWrong, { measuredWidthInches: 55 });
    expect(noReason.status).toBe(400);
  });

  it('55" measured → 53" cutable (the selvedge setting), with an audit record', async () => {
    const res = await correctWidth(lots.recordedWrong, {
      measuredWidthInches: 55,
      reason: `${RUN} receipt recorded 57"; the fabric measures 55"`,
    });
    expect(res.status).toBe(200);
    const selvedge = Number(
      (await prisma.system_settings.findFirst({ where: { key: 'GREIGE_CUTABLE_WIDTH_DEDUCTION_CM' } }))?.value ?? 2
    );
    const saved = await prisma.fabric_stock.findUniqueOrThrow({ where: { id: lots.recordedWrong } });
    expect(Number(saved.finishedWidth)).toBe(55);
    expect(Number(saved.cutableWidth)).toBe(cutableFromMeasured(55, selvedge));
    const audit = await prisma.audit_logs.findFirst({ where: { entityId: lots.recordedWrong, action: 'CORRECT' } });
    expect(audit?.newValues).toMatchObject({ finishedWidth: 55, reason: expect.stringContaining('57') });
  });

  it('a typed cutable width wins over the selvedge rule', async () => {
    const res = await correctWidth(lots.recordedWrong, {
      measuredWidthInches: 55,
      cutableWidthInches: 53,
      reason: `${RUN} checked on the table`,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.cutableWidth).toBe(53);
  });
});

describe('Create CAD on a lot reuses a marker that fits', () => {
  it('53" lot + approved 52" marker → the lot\'s CAD at 52", with its length, sizes and image; no warning', async () => {
    const res = await createCad(lots.recordedWrong);
    expect(res.status).toBe(201);
    expect(res.body.warning ?? null).toBeNull();

    const row = await productionRowOn(lots.recordedWrong);
    expect(Number(row.cutableWidth)).toBe(52);
    expect(Number(row.cadMeters)).toBeCloseTo(7.05, 4);
    expect(Number(row.widthVariance)).toBe(1); // the spare
    expect(await prisma.cad_size_breakdown.count({ where: { cadId: row.id } })).toBe(6);
    const image = await prisma.cad_purpose_files.findFirst({ where: { cadId: row.id, replacedAt: null } });
    expect(image).not.toBeNull();

    // It matches its image and fits its lot: it approves
    const approve = await request(app)
      .post(`/api/cad-planning/${styleId}/row/${row.id}/approve`)
      .set(authHeader)
      .send({});
    expect(approve.status).toBe(200);
  });

  it("the table shows the lot's cutable width beside the row", async () => {
    const table = await request(app).get(`/api/cad-planning/${styleId}/table`).set(authHeader).expect(200);
    const row = table.body.data.cadRows.find(
      (r: { fabricStockId: string | null }) => r.fabricStockId === lots.recordedWrong
    );
    expect(row.lotCutableWidth).toBe(53);
    expect(row.cutableWidth).toBe(52);
  });

  it('refuses to narrow a lot below its APPROVED Production CAD', async () => {
    const res = await correctWidth(lots.recordedWrong, {
      measuredWidthInches: 53,
      reason: `${RUN} would leave the 52" marker on 51"`,
    });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/approved Production CAD at 52/);
    const saved = await prisma.fabric_stock.findUniqueOrThrow({ where: { id: lots.recordedWrong } });
    expect(Number(saved.cutableWidth)).toBe(53);
  });

  it('56" lot + 52" marker → reused, with a warning that 4" is spare', async () => {
    const res = await createCad(lots.wide);
    expect(res.status).toBe(201);
    expect(res.body.warning).toMatch(/4" spare/);
    const row = await productionRowOn(lots.wide);
    expect(Number(row.cutableWidth)).toBe(52);
    expect(Number(row.cadMeters)).toBeCloseTo(7.05, 4);
  });

  it('50" lot + 52" marker → sizes only, and the row cannot be saved or approved wider than the lot', async () => {
    const res = await createCad(lots.narrow);
    expect(res.status).toBe(201);
    expect(res.body.warning).toMatch(/will not fit/);
    const row = await productionRowOn(lots.narrow);
    expect(Number(row.cutableWidth)).toBe(50);
    expect(row.cadMeters).toBeNull();
    expect(await prisma.cad_size_breakdown.count({ where: { cadId: row.id } })).toBe(6);
    expect(await prisma.cad_purpose_files.count({ where: { cadId: row.id } })).toBe(0);

    const save = await request(app)
      .put(`/api/cad-planning/${styleId}/row/${row.id}`)
      .set(authHeader)
      .send({ cutableWidth: 52 });
    expect(save.status).toBe(422);
    expect(save.body.details?.code).toBe('PRODUCTION_MARKER_WIDER_THAN_LOT');

    // Stored wider by some other road: Approve refuses it too, before anything else
    await prisma.fabric_width_cad.update({ where: { id: row.id }, data: { cutableWidth: 52 } });
    const approve = await request(app)
      .post(`/api/cad-planning/${styleId}/row/${row.id}/approve`)
      .set(authHeader)
      .send({});
    expect(approve.status).toBe(422);
    expect(approve.body.details?.code).toBe('PRODUCTION_MARKER_WIDER_THAN_LOT');
  });
});
