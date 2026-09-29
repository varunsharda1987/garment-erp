/**
 * Create Colourway — POST /api/styles/:id/colourways (services/style-colourway.service.ts).
 *
 * The owner asked for it on SP27CK130 (2026-09-29): "i want to create colorways of this style, but today
 * there is no easy way that i can copy the style and just change the color". A colourway is its own
 * style, so this walks the real endpoint on a tagged source style that has everything a style can carry:
 * a fabric in the style's colour and a contrast fabric, a trim, sizes, a process, and CAD rows of every
 * kind (an approved + costed Raw Mat row with its marker image, a combined Costing row, a rejected row and a
 * Production row). It pins what the copy takes, what it leaves, and that the source is untouched.
 *
 * Runs on garment_erp_test (setup.ts); every fixture is scoped to RUN and torn down.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only, onlyAll } from '../../utils/prisma-test-guard';
import { giveMarkerImage } from '../helpers/marker-fixture';
import { syncStyleColourway } from '../../services/helpers/style-colour.helper';
import { cadRowsOfStyle } from '../../services/helpers/cad-status.helper';
import { cadMarkerFields } from '../../services/helpers/cad-copy.helper';
import { CAD_COLUMNS, pickCadRowsToCopy } from '../../services/style-colourway.service';

const RUN = `SCC${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let customerId: string;
const colour = { red: '', white: '', blue: '', green: '' };
const styleIds: string[] = [];

// the source style
let sourceId: string;
let fabricTopId: string; // Red — the style's own colour
let fabricBottomId: string; // White — a contrast
let rawMatCadId: string;
let costingCadId: string;
let rejectedCadId: string;
let productionCadId: string;
let sizeSId: string;
let sizeMId: string;
let materialUnit: string;
let materialId: string;

async function makeStyle(args: { code: string; buyerRef: string | null; name: string; colorId: string }) {
  const id = randomUUID();
  await prisma.styles.create({
    data: {
      id,
      styleCode: args.code,
      styleName: args.name,
      buyerStyleRef: args.buyerRef,
      customerId,
      customerName: `${RUN} Buyer`,
      brandName: `${RUN} Brand`,
      colorId: args.colorId,
      status: 'ACTIVE',
      numberOfComponents: 2,
      projectGroup: `${RUN} group`,
      hsnCode: '6204',
      imageUrl: '/uploads/styles/red-photo.jpg',
      createdById: userId,
    },
  });
  styleIds.push(id);
  await syncStyleColourway(prisma, id, args.colorId);
  return id;
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const customer = await prisma.customers.create({
    data: { code: `${RUN}-CUST`, name: `${RUN} Buyer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
  });
  customerId = customer.id;

  for (const name of ['red', 'white', 'blue', 'green'] as const) {
    const c = await prisma.color_master.create({
      data: { colorCode: `${RUN}-${name}`, colorName: `${RUN} ${name}`, hexCode: '#123456' },
    });
    colour[name] = c.id;
  }

  // A metre trim from the test copy's own masters (read only)
  const material = await prisma.materials.findFirst({
    where: { unit: 'METER', isActive: true, materialType: 'ELASTIC' },
    select: { id: true, unit: true },
  });
  if (!material) throw new Error('garment_erp_test has no active metre elastic to use as a trim');
  materialId = material.id;
  materialUnit = material.unit;
  const patternPart = await prisma.pattern_part_master.findFirst({ where: { isActive: true }, select: { id: true } });

  sourceId = await makeStyle({
    code: `${RUN}-001`,
    buyerRef: `${RUN}-RED`,
    name: `${RUN} Kurta Set`,
    colorId: colour.red,
  });

  // sizes + SKUs
  sizeSId = randomUUID();
  sizeMId = randomUUID();
  await prisma.size_options.createMany({
    data: [
      { id: sizeSId, styleId: sourceId, sizeName: 'S', sizeCode: 'S', sortOrder: 1 },
      { id: sizeMId, styleId: sourceId, sizeName: 'M', sizeCode: 'M', sortOrder: 2 },
    ],
  });
  await prisma.style_variants.createMany({
    data: [
      { styleId: sourceId, sizeId: sizeSId, sizeName: 'S', sku: `${RUN}-001S`, sortOrder: 1 },
      { styleId: sourceId, sizeId: sizeMId, sizeName: 'M', sku: `${RUN}-001M`, sortOrder: 2 },
    ],
  });

  // components + fabrics
  const top = await prisma.style_components.create({
    data: { styleId: sourceId, componentName: 'Kurta', componentType: 'TOP', sortOrder: 0 },
  });
  const bottom = await prisma.style_components.create({
    data: { styleId: sourceId, componentName: 'Pallazo', componentType: 'BOTTOM', sortOrder: 1 },
  });
  fabricTopId = randomUUID();
  fabricBottomId = randomUUID();
  await prisma.style_fabrics.create({
    data: {
      id: fabricTopId,
      componentId: top.id,
      fabricName: 'Viscose Slub',
      fabricType: 'GENERIC',
      genericGreigeName: `${RUN} Viscose`,
      fabricFinishType: 'DYED',
      colorMasterId: colour.red,
      fabricColor: 'Red',
      fabricCostPerMeter: 120,
      totalCostPerMeter: 140,
      cutableWidth: 52,
      hasEmbroidery: true,
    },
  });
  await prisma.style_fabrics.create({
    data: {
      id: fabricBottomId,
      componentId: bottom.id,
      fabricName: 'Cotton',
      fabricType: 'GENERIC',
      genericGreigeName: `${RUN} Cotton`,
      fabricFinishType: 'DYED',
      colorMasterId: colour.white,
      fabricColor: 'White',
    },
  });
  if (patternPart) {
    await prisma.style_pattern_parts.create({
      data: { styleFabricId: fabricTopId, patternPartId: patternPart.id, quantity: 2, goesToEmbroidery: true },
    });
  }

  await prisma.style_processes.create({
    data: { styleId: sourceId, processName: 'Embroidery', processType: 'EMBROIDERY', estimatedCost: 45 },
  });
  // A trim saved with the wrong unit: the copy stores the material's own
  await prisma.style_material_bom.create({
    data: {
      styleId: sourceId,
      materialId,
      elasticId: null,
      materialType: 'ELASTIC',
      usageCategory: 'GARMENT_TRIM',
      quantityPerGarment: 0.75,
      unit: 'pcs',
      unitPrice: 3.5,
      extraPercentage: 2,
    },
  });
  await prisma.style_tech_specs.create({ data: { styleId: sourceId, topLength: 44, designNotes: 'Yoke' } });
  await prisma.style_images.createMany({
    data: [
      { styleId: sourceId, imageUrl: '/uploads/styles/red-main.jpg', imageType: 'MAIN' },
      { styleId: sourceId, imageUrl: '/uploads/styles/sketch.jpg', imageType: 'SKETCH_FRONT' },
    ],
  });

  // CAD rows
  const rawMat = await prisma.fabric_width_cad.create({
    data: {
      costingStyleId: sourceId,
      styleFabricId: fabricTopId,
      componentName: 'Kurta',
      purpose: 'RAW_MATERIAL_CALCULATION',
      purposeEnum: 'RAW_MATERIAL_CALCULATION',
      cutableWidth: 52,
      cadMeters: 3.82,
      cadAverage: 1.91,
      markerEfficiency: 84,
      approvalStatus: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
      isLocked: true,
      // Fabric Costing's side — must not travel
      totalCostPerMeter: 150,
      processingPricePerMeter: 30,
    },
  });
  rawMatCadId = rawMat.id;
  await prisma.fabric_width_cad.update({
    where: { id: rawMatCadId },
    data: { costingApprovalStatus: 'APPROVED', costingApprovedBy: userId, costingApprovedAt: new Date() },
  });
  await prisma.cad_size_breakdown.createMany({
    data: [
      { cadId: rawMatCadId, sizeName: 'S', sizeId: sizeSId, quantity: 1 },
      { cadId: rawMatCadId, sizeName: 'M', sizeId: sizeMId, quantity: 1 },
    ],
  });
  if (patternPart) {
    await prisma.cad_pattern_parts.create({ data: { cadId: rawMatCadId, patternPartId: patternPart.id } });
  }
  await giveMarkerImage(prisma, {
    cadId: rawMatCadId,
    styleId: sourceId,
    lengthM: 3.82,
    widthIn: 52,
    sizes: [
      { sizeName: 'S', quantity: 1 },
      { sizeName: 'M', quantity: 1 },
    ],
  });
  await prisma.style_fabrics.update({ where: { id: fabricTopId }, data: { fabricCADId: rawMatCadId } });

  const costing = await prisma.fabric_width_cad.create({
    data: {
      costingStyleId: sourceId,
      styleFabricId: fabricTopId,
      componentName: 'Combined: Kurta, Pallazo',
      purpose: 'COSTING',
      purposeEnum: 'COSTING',
      cutableWidth: 58,
      cadMeters: 5.1,
      isCombinedCutting: true,
      combinedComponents: 'Kurta, Pallazo',
      combinedFabricIds: JSON.stringify([fabricTopId, fabricBottomId]),
      approvalStatus: 'PENDING',
    },
  });
  costingCadId = costing.id;

  const rejected = await prisma.fabric_width_cad.create({
    data: {
      costingStyleId: sourceId,
      styleFabricId: fabricBottomId,
      componentName: 'Pallazo',
      purpose: 'RAW_MATERIAL_CALCULATION',
      purposeEnum: 'RAW_MATERIAL_CALCULATION',
      cutableWidth: 50,
      approvalStatus: 'REJECTED',
    },
  });
  rejectedCadId = rejected.id;

  const production = await prisma.fabric_width_cad.create({
    data: {
      costingStyleId: sourceId,
      styleFabricId: fabricBottomId,
      componentName: 'Pallazo',
      purpose: 'PRODUCTION',
      purposeEnum: 'PRODUCTION',
      cutableWidth: 54,
      cadMeters: 2.2,
      approvalStatus: 'APPROVED',
    },
  });
  productionCadId = production.id;
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    [
      'fabric_width_cad',
      () => prisma.fabric_width_cad.deleteMany({ where: { OR: onlyAll(styleIds).map((id) => cadRowsOfStyle(id)) } }),
    ],
    ['styles', () => prisma.styles.deleteMany({ where: { id: { in: onlyAll(styleIds) } } })],
    ['color_master', () => prisma.color_master.deleteMany({ where: { id: { in: onlyAll(Object.values(colour)) } } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['audit_logs', () => prisma.audit_logs.deleteMany({ where: { userId: only(userId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[style-colourway-copy teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

async function createColourway(styleId: string, body: Record<string, unknown>, expected = 201) {
  const res = await request(app).post(`/api/styles/${styleId}/colourways`).set(authHeader).send(body);
  if (res.status !== expected) console.error(res.status, JSON.stringify(res.body));
  expect(res.status).toBe(expected);
  if (expected === 201) styleIds.push(res.body.data.id);
  return res.body;
}

const snapshotOf = async (styleId: string) => ({
  style: await prisma.styles.findUnique({ where: { id: styleId } }),
  variants: await prisma.style_variants.findMany({ where: { styleId }, orderBy: { sku: 'asc' } }),
  fabrics: await prisma.style_fabrics.findMany({
    where: { style_components: { styleId } },
    orderBy: { id: 'asc' },
  }),
  bom: await prisma.style_material_bom.findMany({ where: { styleId } }),
  cads: await prisma.fabric_width_cad.findMany({ where: cadRowsOfStyle(styleId), orderBy: { id: 'asc' } }),
  markerFiles: await prisma.cad_purpose_files.findMany({ where: { styleId }, orderBy: { id: 'asc' } }),
});

describe('Create Colourway', () => {
  let copyId: string;
  let sourceBefore: Awaited<ReturnType<typeof snapshotOf>>;

  it('copies the style into the new colour, with its own codes and SKUs', async () => {
    sourceBefore = await snapshotOf(sourceId);
    const body = await createColourway(sourceId, { colorId: colour.blue, buyerStyleRef: `${RUN}-BLUE` });
    copyId = body.data.id;
    expect(body.data.copied).toEqual({ fabrics: 2, recolouredFabrics: 1, trims: 1, sizes: 2, cadRows: 2 });

    const copy = await prisma.styles.findUniqueOrThrow({ where: { id: copyId } });
    expect(copy.styleCode).not.toBe(`${RUN}-001`);
    expect(copy.buyerStyleRef).toBe(`${RUN}-BLUE`);
    expect(copy.styleName).toBe(`${RUN} Kurta Set`);
    expect(copy.colorId).toBe(colour.blue);
    expect(copy.colourwayOfStyleId).toBe(sourceId);
    // the style's definition travels…
    expect(copy.customerId).toBe(customerId);
    expect(copy.numberOfComponents).toBe(2);
    expect(copy.projectGroup).toBe(`${RUN} group`);
    expect(copy.hsnCode).toBe('6204');
    expect(copy.status).toBe('ACTIVE');
    // …the photo (old colour) does not
    expect(copy.imageUrl).toBeNull();
    expect(copy.cadStatus).toBe('IN_PROGRESS'); // two PENDING rows

    const colourways = await prisma.color_options.findMany({ where: { styleId: copyId } });
    expect(colourways.map((c) => c.colorMasterId)).toEqual([colour.blue]);

    const variants = await prisma.style_variants.findMany({
      where: { styleId: copyId },
      orderBy: { sortOrder: 'asc' },
    });
    expect(variants.map((v) => v.sku)).toEqual([`${copy.styleCode}S`, `${copy.styleCode}M`]);
    const sizes = await prisma.size_options.findMany({ where: { styleId: copyId } });
    expect(sizes.map((s) => s.sizeName).sort()).toEqual(['M', 'S']);
  });

  it('recolours the fabric in the style colour and leaves the contrast fabric alone', async () => {
    const fabrics = await prisma.style_fabrics.findMany({
      where: { style_components: { styleId: copyId } },
      include: { style_components: true, stylePatternParts: true },
    });
    const top = fabrics.find((f) => f.style_components.componentName === 'Kurta');
    const bottom = fabrics.find((f) => f.style_components.componentName === 'Pallazo');
    expect(top?.colorMasterId).toBe(colour.blue);
    expect(top?.fabricColor).toBe(`${RUN} blue`);
    expect(top?.fabricCostPerMeter).toBeNull(); // costing starts fresh
    expect(top?.hasEmbroidery).toBe(true);
    expect(Number(top?.cutableWidth)).toBe(52);
    expect(bottom?.colorMasterId).toBe(colour.white);
    expect(bottom?.fabricColor).toBe('White');
    const sourcePartCount = await prisma.style_pattern_parts.count({ where: { styleFabricId: fabricTopId } });
    expect(top?.stylePatternParts).toHaveLength(sourcePartCount);
  });

  it('keeps the trims (quantity, price, wastage) in the material unit, the process, the spec and the sketches', async () => {
    const bom = await prisma.style_material_bom.findMany({ where: { styleId: copyId } });
    expect(bom).toHaveLength(1);
    expect(bom[0].materialId).toBe(materialId);
    expect(Number(bom[0].quantityPerGarment)).toBe(0.75);
    expect(Number(bom[0].unitPrice)).toBe(3.5);
    expect(Number(bom[0].extraPercentage)).toBe(2);
    expect(bom[0].unit).toBe(materialUnit);

    const processes = await prisma.style_processes.findMany({ where: { styleId: copyId } });
    expect(processes.map((p) => p.processType)).toEqual(['EMBROIDERY']);
    const spec = await prisma.style_tech_specs.findUnique({ where: { styleId: copyId } });
    expect(Number(spec?.topLength)).toBe(44);
    const images = await prisma.style_images.findMany({ where: { styleId: copyId } });
    expect(images.map((i) => i.imageType)).toEqual(['SKETCH_FRONT']);
  });

  it('copies the CAD work unapproved and uncosted — never the rejected or Production rows', async () => {
    const cads = await prisma.fabric_width_cad.findMany({
      where: cadRowsOfStyle(copyId),
      include: { sizeBreakdowns: true, cadPatternParts: true, markerImages: true },
    });
    expect(cads.map((c) => c.copiedFromId).sort()).toEqual([costingCadId, rawMatCadId].sort());
    expect(cads.some((c) => c.copiedFromId === rejectedCadId || c.copiedFromId === productionCadId)).toBe(false);

    const fabrics = await prisma.style_fabrics.findMany({
      where: { style_components: { styleId: copyId } },
      include: { style_components: true },
    });
    const newTop = fabrics.find((f) => f.style_components.componentName === 'Kurta');
    const newBottom = fabrics.find((f) => f.style_components.componentName === 'Pallazo');
    const newSizes = await prisma.size_options.findMany({ where: { styleId: copyId } });

    const rawMat = cads.find((c) => c.copiedFromId === rawMatCadId);
    expect(rawMat?.costingStyleId).toBe(copyId);
    expect(rawMat?.styleFabricId).toBe(newTop?.id);
    expect(Number(rawMat?.cadMeters)).toBe(3.82);
    expect(Number(rawMat?.cadAverage)).toBe(1.91);
    expect(rawMat?.approvalStatus).toBe('PENDING');
    expect(rawMat?.approvedBy).toBeNull();
    expect(rawMat?.isLocked).toBe(false);
    expect(rawMat?.totalCostPerMeter).toBeNull();
    expect(rawMat?.processingPricePerMeter).toBeNull();
    expect(rawMat?.costingApprovalStatus).toBeNull();
    // sizes point at the NEW style's sizes
    const sizeIds = new Set(newSizes.map((s) => s.id));
    expect(rawMat?.sizeBreakdowns).toHaveLength(2);
    expect(rawMat?.sizeBreakdowns.every((b) => b.sizeId && sizeIds.has(b.sizeId))).toBe(true);
    const sourcePartCount = await prisma.cad_pattern_parts.count({ where: { cadId: rawMatCadId } });
    expect(rawMat?.cadPatternParts).toHaveLength(sourcePartCount);
    // its marker image, filed under the new style, on the same file
    expect(rawMat?.markerImages).toHaveLength(1);
    expect(rawMat?.markerImages[0].styleId).toBe(copyId);
    const sourceImage = await prisma.cad_purpose_files.findFirstOrThrow({ where: { cadId: rawMatCadId } });
    expect(rawMat?.markerImages[0].fileUrl).toBe(sourceImage.fileUrl);
    // the fabric's chosen CAD row is the copy
    expect(newTop?.fabricCADId).toBe(rawMat?.id);

    const combined = cads.find((c) => c.copiedFromId === costingCadId);
    expect(combined?.isCombinedCutting).toBe(true);
    expect(JSON.parse(combined?.combinedFabricIds ?? '[]')).toEqual([newTop?.id, newBottom?.id]);
  });

  it('leaves the source style exactly as it was', async () => {
    const after = await snapshotOf(sourceId);
    expect(after).toEqual(sourceBefore);
  });

  it('a copy of a copy joins the same colour group, and the group lists them all', async () => {
    const body = await createColourway(copyId, { colorId: colour.green, buyerStyleRef: `${RUN}-GREEN` });
    const second = await prisma.styles.findUniqueOrThrow({ where: { id: body.data.id } });
    expect(second.colourwayOfStyleId).toBe(sourceId); // never chained

    const res = await request(app).get(`/api/styles/${copyId}/colourways`).set(authHeader).expect(200);
    const group = res.body.data as Array<{ id: string; isFirst: boolean; isCurrent: boolean }>;
    expect(group.map((g) => g.id)).toEqual([sourceId, copyId, second.id]);
    expect(group.find((g) => g.isFirst)?.id).toBe(sourceId);
    expect(group.find((g) => g.isCurrent)?.id).toBe(copyId);
  });

  it('refuses a Buyer Style Code another style has, and the colour the style already is', async () => {
    const taken = await createColourway(sourceId, { colorId: colour.green, buyerStyleRef: `${RUN}-BLUE` }, 409);
    expect(JSON.stringify(taken)).toContain(`${RUN}-BLUE`);
    await createColourway(sourceId, { colorId: colour.red, buyerStyleRef: `${RUN}-RED2` }, 400);
    await createColourway(sourceId, { buyerStyleRef: `${RUN}-X` }, 400); // no colour
  });

  it('an in-house style (Style Code = Buyer Style Code) takes the typed code as both', async () => {
    const inHouse = await makeStyle({ code: `${RUN}P`, buyerRef: `${RUN}P`, name: `${RUN}P`, colorId: colour.red });
    await createColourway(inHouse, { colorId: colour.blue }, 400); // the new code is required
    const body = await createColourway(inHouse, { colorId: colour.blue, buyerStyleRef: `${RUN}B` });
    const copy = await prisma.styles.findUniqueOrThrow({ where: { id: body.data.id } });
    expect(copy.styleCode).toBe(`${RUN}B`);
    expect(copy.buyerStyleRef).toBe(`${RUN}B`);
    expect(copy.styleName).toBe(`${RUN}B`); // the source was named only by its code
  });
});

describe('what a copied CAD row carries', () => {
  it('every marker field of cad-copy.helper is carried', () => {
    const markerKeys = Object.keys(cadMarkerFields({} as Parameters<typeof cadMarkerFields>[0]));
    for (const key of markerKeys) expect([key, CAD_COLUMNS[key as keyof typeof CAD_COLUMNS]]).toEqual([key, 'carry']);
  });

  it('keeps the approved row of two that differ only by approval, and drops superseded versions', () => {
    const base = {
      purpose: 'RAW_MATERIAL_CALCULATION',
      purposeEnum: 'RAW_MATERIAL_CALCULATION' as const,
      costingStyleId: 's',
      componentName: 'Top',
      styleFabricId: 'f',
      cutableWidth: 52 as never,
      supersededById: null,
      updatedAt: new Date('2026-09-01'),
    };
    const approved = { ...base, id: 'a', approvalStatus: 'APPROVED' as const };
    const pending = { ...base, id: 'p', approvalStatus: 'PENDING' as const, updatedAt: new Date('2026-09-02') };
    expect(pickCadRowsToCopy([pending, approved]).map((r) => r.id)).toEqual(['a']);

    const v1 = { ...base, id: 'v1', approvalStatus: 'APPROVED' as const, cutableWidth: 50 as never };
    const v2 = {
      ...base,
      id: 'v2',
      approvalStatus: 'PENDING' as const,
      cutableWidth: 51 as never,
      supersededById: 'v1',
    };
    expect(pickCadRowsToCopy([v1, v2]).map((r) => r.id)).toEqual(['v2']);
  });
});
