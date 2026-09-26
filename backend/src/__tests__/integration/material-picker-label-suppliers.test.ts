/**
 * PO material picker — a sized label is offered in EVERY size for its supplier (2026-09-26).
 *
 * The PO form lists `GET /materials?supplierId=…`. It used to keep only materials with a
 * `material_suppliers` row, but a label's suppliers live in `label_suppliers` (what the Label page
 * writes); `material_suppliers` held one arbitrary size row per label from a March sync. So
 * "Main Cum Size Label Black" (LBL-0004) offered only XS and a PO could not buy the other six sizes.
 *
 * Asserts, on tagged fixtures linked through `label_suppliers` ONLY:
 *  - supplier filter → the base row and every size row, each size row naming its size;
 *  - supplier + TRIMS types (the PO form's TRIMS category, which has no LABEL) → the same;
 *  - another supplier's label is not offered;
 *  - a label with NO supplier is offered for every supplier on a Trims / General PO, never on a Greige one;
 *  - a material linked through material_suppliers is still offered (the existing path);
 *  - Assign Vendors suggests the label's supplier for every size (vendor-suggestion.service).
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { suggestVendorForMaterial } from '../../services/vendor-suggestion.service';

const RUN = `MPLS${Date.now().toString(36).toUpperCase()}`;
const SIZES = ['S', 'M', 'L'];
// The PO form's TRIMS category types (PurchaseOrderForm.tsx) — LABEL is deliberately not among them
const TRIMS_TYPES = 'TRIMS,BUTTON,ZIPPER,ELASTIC';

let authHeader: Record<string, string>;
let testUserId: string;
let supplierId: string;
let otherSupplierId: string;
let labelId: string;
let otherLabelId: string;
let freeLabelId: string;
let linkedMaterialId: string;
const variantIds: string[] = [];

async function makeLabel(
  code: string,
  supplier: string | null,
  sizes: string[]
): Promise<{ id: string; variants: string[] }> {
  const categoryId = (await prisma.material_categories.findFirstOrThrow({ select: { id: true } })).id;
  const label = await prisma.label_master.create({
    data: { labelCode: code, labelName: `${code} Main Cum Size Label`, pricePerPiece: 0.6 },
  });
  if (supplier) {
    await prisma.label_suppliers.create({ data: { labelId: label.id, supplierId: supplier, isPreferred: true } });
  }
  await prisma.materials.create({
    data: {
      id: label.id,
      code,
      name: label.labelName,
      categoryId,
      materialType: 'LABEL',
      unit: 'PIECE',
      labelId: label.id,
    },
  });
  const variants: string[] = [];
  for (const size of sizes) {
    const variant = await prisma.label_size_variants.create({ data: { id: randomUUID(), labelId: label.id, size } });
    await prisma.materials.create({
      data: {
        id: variant.id,
        code: `${code}-${size}`,
        name: `${label.labelName} - Size ${size}`,
        categoryId,
        materialType: 'LABEL',
        unit: 'PIECE',
        labelId: label.id,
        sizeVariantId: variant.id,
      },
    });
    variants.push(variant.id);
  }
  return { id: label.id, variants };
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@mpls.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  supplierId = (await prisma.suppliers.create({ data: { code: `${RUN}A`, name: `${RUN} A`, createdById: testUserId } }))
    .id;
  otherSupplierId = (
    await prisma.suppliers.create({ data: { code: `${RUN}B`, name: `${RUN} B`, createdById: testUserId } })
  ).id;

  const label = await makeLabel(`${RUN}-LBL`, supplierId, SIZES);
  labelId = label.id;
  variantIds.push(...label.variants);
  const other = await makeLabel(`${RUN}-OTH`, otherSupplierId, ['S']);
  otherLabelId = other.id;
  variantIds.push(...other.variants);
  // A label nobody has been set up to make yet (Liva Tag, 2026-09-26)
  const free = await makeLabel(`${RUN}-FREE`, null, ['S']);
  freeLabelId = free.id;
  variantIds.push(...free.variants);

  // A plain material linked the old way, through material_suppliers
  const categoryId = (await prisma.material_categories.findFirstOrThrow({ select: { id: true } })).id;
  linkedMaterialId = randomUUID();
  await prisma.materials.create({
    data: {
      id: linkedMaterialId,
      code: `${RUN}-GEN`,
      name: `${RUN} Generic`,
      categoryId,
      materialType: 'GENERIC',
      unit: 'PIECE',
    },
  });
  await prisma.material_suppliers.create({ data: { materialId: linkedMaterialId, supplierId } });
});

afterAll(async () => {
  const labelIds = [labelId, otherLabelId, freeLabelId].filter(Boolean).map((id) => only(id));
  await prisma.material_suppliers.deleteMany({ where: { materialId: only(linkedMaterialId) } });
  await prisma.materials.deleteMany({
    where: { id: { in: [...labelIds, ...variantIds.map((id) => only(id)), only(linkedMaterialId)] } },
  });
  await prisma.label_size_variants.deleteMany({ where: { labelId: { in: labelIds } } });
  await prisma.label_suppliers.deleteMany({ where: { labelId: { in: labelIds } } });
  await prisma.label_master.deleteMany({ where: { id: { in: labelIds } } });
  await prisma.suppliers.deleteMany({ where: { id: { in: [only(supplierId), only(otherSupplierId)] } } });
  await prisma.users.deleteMany({ where: { id: only(testUserId) } });
  await prisma.$disconnect();
});

async function pickerCodes(query: Record<string, string>) {
  const res = await request(app)
    .get('/api/materials')
    .query({ limit: '500', search: RUN, ...query })
    .set(authHeader);
  expect(res.status).toBe(200);
  return res.body.data as Array<{ code: string; labelSizeVariant?: { size: string } | null }>;
}

describe('PO material picker — label suppliers', () => {
  it('offers the base row and every size of a label linked only through label_suppliers', async () => {
    const rows = await pickerCodes({ supplierId });
    const codes = rows.map((r) => r.code).sort();
    expect(codes).toEqual(
      [
        `${RUN}-GEN`,
        `${RUN}-LBL`,
        `${RUN}-LBL-L`,
        `${RUN}-LBL-M`,
        `${RUN}-LBL-S`,
        // the label with no supplier yet — any supplier may make it
        `${RUN}-FREE`,
        `${RUN}-FREE-S`,
      ].sort()
    );
    // each size row names its size, so the form can build the size grid
    for (const size of SIZES) {
      expect(rows.find((r) => r.code === `${RUN}-LBL-${size}`)?.labelSizeVariant?.size).toBe(size);
    }
    expect(rows.find((r) => r.code === `${RUN}-LBL`)?.labelSizeVariant ?? null).toBeNull();
  });

  it('offers them too in the TRIMS category, whose type list has no LABEL', async () => {
    const codes = (await pickerCodes({ supplierId, materialTypes: TRIMS_TYPES })).map((r) => r.code);
    for (const code of [`${RUN}-LBL`, ...SIZES.map((s) => `${RUN}-LBL-${s}`), `${RUN}-GEN`]) {
      expect(codes).toContain(code);
    }
  });

  it("does not offer another supplier's label", async () => {
    const codes = (await pickerCodes({ supplierId })).map((r) => r.code);
    expect(codes).not.toContain(`${RUN}-OTH`);
    expect(codes).not.toContain(`${RUN}-OTH-S`);
  });

  it('offers a label with no supplier yet to every supplier on a Trims PO, but not on a Greige PO', async () => {
    for (const s of [supplierId, otherSupplierId]) {
      const codes = (await pickerCodes({ supplierId: s, materialTypes: TRIMS_TYPES })).map((r) => r.code);
      expect(codes).toContain(`${RUN}-FREE`);
      expect(codes).toContain(`${RUN}-FREE-S`);
    }
    const greige = (await pickerCodes({ supplierId, materialTypes: 'GREIGE' })).map((r) => r.code);
    expect(greige).not.toContain(`${RUN}-FREE`);
    expect(greige).not.toContain(`${RUN}-FREE-S`);
    // a label set up for supplier B stays with B, even on a Trims PO
    const trimsA = (await pickerCodes({ supplierId, materialTypes: TRIMS_TYPES })).map((r) => r.code);
    expect(trimsA).not.toContain(`${RUN}-OTH`);
  });

  it("suggests the label's supplier for every size, with high confidence (Assign Vendors)", async () => {
    for (const id of variantIds.slice(0, SIZES.length)) {
      const suggestion = await suggestVendorForMaterial(id);
      expect(suggestion.suggestedSupplierId).toBe(supplierId);
      expect(suggestion.confidence).toBe('high');
    }
  });
});
