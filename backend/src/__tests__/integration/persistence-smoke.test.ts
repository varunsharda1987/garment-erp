/**
 * Persistence smoke tests — the "did it actually save?" harness.
 *
 * Retrospective background (2026-08-01): ~37 tracker findings were features that 400 on EVERY
 * use, and a further class silently saved nothing while reporting success (schema strips the
 * fields, controller ignores them, etc.). Every one would have been caught by one round-trip:
 *
 *   POST create → GET read-back → assert EVERY sent field persisted
 *   PUT update  → GET read-back → assert the changed fields persisted
 *
 * That is exactly what this suite does, per module, against the real Express app and DB.
 * Add a module here whenever its create/edit breaks once — the round-trip pins the fix.
 *
 * Notes:
 * - Warehouse round-trip pins BUG-WH1/WH2/WH3 (country / contactEmail / isVirtual were
 *   validated by Zod but never written by the service).
 * - Values are compared loosely for numerics (Prisma Decimal may serialize as a string).
 * - All records are created with a unique per-run prefix and deleted in afterAll.
 */

import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

// Unique, short (fits 20-char code columns), per-run prefix.
const RUN = `SMK${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;

interface ModuleSpec {
  name: string;
  base: string;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
  /** Fields the SERVER legitimately recomputes on update (excluded from the no-clobber check). */
  derived?: string[];
}

const MODULES: ModuleSpec[] = [
  {
    name: 'agencies',
    base: '/api/agencies',
    create: {
      name: `${RUN} Agency`,
      phone: '9999999999',
      email: `${RUN.toLowerCase()}@smoke.test`,
      address: 'Smoke Test Street 1',
    },
    update: { name: `${RUN} Agency v2`, phone: '8888888888' },
  },
  {
    name: 'warehouses',
    base: '/api/warehouses',
    create: {
      warehouseCode: `${RUN}-WH`,
      warehouseName: `${RUN} Warehouse`,
      warehouseType: 'RAW_MATERIAL',
      address: 'Smoke Test Street 2',
      city: 'Delhi',
      state: 'Delhi',
      // BUG-WH1/WH2/WH3 pins: these three were validated but never saved.
      country: 'India',
      contactEmail: `${RUN.toLowerCase()}-wh@smoke.test`,
      isVirtual: true,
      pincode: '110001',
      contactPerson: 'Smoke Tester',
      contactPhone: '7777777777',
      capacity: 1234,
    },
    update: { warehouseName: `${RUN} Warehouse v2`, country: 'Bharat', isVirtual: false },
  },
  {
    name: 'seasons',
    base: '/api/seasons',
    create: {
      name: `${RUN} Season`,
      code: `${RUN}-SEA`,
      seasonType: 'SS',
      year: 2031,
      sortOrder: 42,
    },
    update: { name: `${RUN} Season v2`, year: 2032 },
    // sortOrder is chronology-derived: changing year/seasonType recalculates it by design.
    derived: ['sortOrder'],
  },
  {
    name: 'colors',
    base: '/api/colors',
    create: {
      colorName: `${RUN} Color`,
      hexCode: '#123456',
      description: 'Persistence smoke test color',
      sortOrder: 7,
    },
    update: { colorName: `${RUN} Color v2`, hexCode: '#654321' },
  },
  {
    name: 'issue-reports',
    base: '/api/issue-reports',
    // Screenshot is optional and multer skips non-multipart requests, so a JSON round-trip is valid.
    create: {
      title: `${RUN} Issue Report`,
      description: 'Persistence smoke test issue',
      pageUrl: '/smoke-test',
    },
    update: { status: 'FIXED', adminNotes: `${RUN} resolved in smoke test` },
  },
];

/** Loose field equality: numbers may come back as Decimal strings; trims already applied. */
function expectFieldPersisted(entity: Record<string, unknown>, key: string, sent: unknown) {
  const got = entity[key];
  if (typeof sent === 'number') {
    expect({ [key]: Number(got) }).toEqual({ [key]: sent });
  } else {
    expect({ [key]: got }).toEqual({ [key]: sent });
  }
}

async function readBack(base: string, id: string): Promise<Record<string, unknown>> {
  const res = await request(app).get(`${base}/${id}`).set(authHeader).expect(200);
  return (res.body.data ?? res.body) as Record<string, unknown>;
}

beforeAll(async () => {
  // Auth middleware re-validates against the DB: the user must be active AND approved.
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');
});

afterAll(async () => {
  await prisma.agencies.deleteMany({ where: { name: { startsWith: RUN } } });
  await prisma.warehouses.deleteMany({ where: { warehouseCode: { startsWith: RUN } } });
  await prisma.season_master.deleteMany({ where: { name: { startsWith: RUN } } });
  await prisma.color_master.deleteMany({ where: { colorName: { startsWith: RUN } } });
  // issue_reports reference the test user — delete them first or the user delete hits its FK
  await prisma.issue_reports.deleteMany({ where: { title: { startsWith: RUN } } });
  await prisma.users.deleteMany({ where: { id: only(testUserId) } });
  await prisma.$disconnect();
});

/**
 * Customer accessory presets — bespoke round-trip (customer-nested, so it doesn't fit
 * the flat MODULES array). Pins two Phase-0 fixes of the material-identity project:
 *  1. materialId accepts legacy 'mat-<code>' ids (was z.uuid() → 400 on every packaging item)
 *  2. every preset read/write returns the `material` object (was list-endpoint-only →
 *     packaging items rendered blank right after save)
 */
describe('customer accessory presets — round-trip with legacy mat-* material id', () => {
  let customerId: string;
  let labelId: string;
  let packagingMaterialId: string;
  let presetId: string;
  const base = () => `/api/customers/${customerId}/accessory-presets`;

  beforeAll(async () => {
    const customer = await prisma.customers.create({
      data: {
        code: `${RUN}-CUST`,
        name: `${RUN} Preset Customer`,
        type: 'BUYER',
        category: 'DOMESTIC',
        createdById: testUserId,
      },
    });
    customerId = customer.id;

    const label = await prisma.label_master.create({
      data: { labelCode: `${RUN}-LBL`, labelName: `${RUN} Label`, labelCategory: 'SEWN_IN' },
    });
    labelId = label.id;
    // Base materials row (id === label id — same-id convention): the dual-write sets
    // preset item materialId = labelId only when this row exists.
    await prisma.material_categories.create({ data: { id: `CAT-${RUN}-L`, name: `${RUN} Label Cat` } });
    await prisma.materials.create({
      data: {
        id: label.id,
        code: `${RUN}-LBL`,
        name: `${RUN} Label`,
        categoryId: `CAT-${RUN}-L`,
        unit: 'PIECE',
        materialType: 'LABEL',
        labelId: label.id,
      },
    });

    const packaging = await prisma.packaging_master.create({
      data: { packagingCode: `${RUN}-PKG`, packagingName: `${RUN} Polybag` },
    });

    // Legacy-convention materials row: 'mat-<code>' id + required category. This is exactly
    // what the trim controllers create today; the round-trip must accept it end-to-end.
    await prisma.material_categories.create({
      data: { id: `CAT-${RUN}`, name: `${RUN} Packaging Cat` },
    });
    packagingMaterialId = `mat-${RUN.toLowerCase()}-pkg`;
    await prisma.materials.create({
      data: {
        id: packagingMaterialId,
        code: `${RUN}-PKG`,
        name: `${RUN} Polybag`,
        categoryId: `CAT-${RUN}`,
        unit: 'PIECE',
        materialType: 'PACKAGING',
        packagingId: packaging.id,
      },
    });
  });

  it('creates a preset with LABEL + legacy-id PACKAGING items', async () => {
    const res = await request(app)
      .post(base())
      .set(authHeader)
      .send({
        presetName: `${RUN} Preset`,
        items: [
          { materialType: 'LABEL', labelId, componentName: 'Back Neck', extraPercentage: 5 },
          { materialType: 'PACKAGING', materialId: packagingMaterialId, quantity: 2, usageCategory: 'PACKAGING' },
        ],
      });
    if (res.status >= 400) {
      throw new Error(`POST accessory-presets → ${res.status}: ${JSON.stringify(res.body)}`);
    }
    const created = (res.body.data ?? res.body) as Record<string, any>;
    presetId = created.id;
    expect(presetId).toBeTruthy();
    expect(created.items).toHaveLength(2);
  });

  it('reads back both items WITH label/material objects hydrated', async () => {
    const res = await request(app).get(`${base()}/${presetId}`).set(authHeader).expect(200);
    const preset = (res.body.data ?? res.body) as Record<string, any>;
    const items: any[] = preset.items;
    expect(items).toHaveLength(2);

    const labelItem = items.find((i) => i.materialType === 'LABEL');
    expect(labelItem.labelId).toBe(labelId);
    expect(labelItem.componentName).toBe('Back Neck');
    expect(labelItem.label?.labelName).toBe(`${RUN} Label`);
    // Dual-write pin (material-identity Phase 3): LABEL items carry the unified materialId
    expect(labelItem.materialId).toBe(labelId);

    const pkgItem = items.find((i) => i.materialType === 'PACKAGING');
    expect(pkgItem.materialId).toBe(packagingMaterialId);
    expect(Number(pkgItem.quantity)).toBe(2);
    // The include-asymmetry pin: material must be hydrated on EVERY read, not just the list.
    expect(pkgItem.material?.name).toBe(`${RUN} Polybag`);
    expect(pkgItem.material?.code).toBe(`${RUN}-PKG`);
  });

  it('replaces items via PUT and the replacement persists', async () => {
    const res = await request(app)
      .put(`${base()}/${presetId}`)
      .set(authHeader)
      .send({
        presetName: `${RUN} Preset v2`,
        items: [
          { materialType: 'PACKAGING', materialId: packagingMaterialId, quantity: 5, usageCategory: 'PACKAGING' },
        ],
      });
    if (res.status >= 400) {
      throw new Error(`PUT accessory-presets → ${res.status}: ${JSON.stringify(res.body)}`);
    }

    const back = await request(app).get(`${base()}/${presetId}`).set(authHeader).expect(200);
    const preset = (back.body.data ?? back.body) as Record<string, any>;
    expect(preset.presetName).toBe(`${RUN} Preset v2`);
    expect(preset.items).toHaveLength(1);
    expect(Number(preset.items[0].quantity)).toBe(5);
    expect(preset.items[0].material?.name).toBe(`${RUN} Polybag`);
  });

  afterAll(async () => {
    // FK order: preset items cascade with preset; materials Restricts preset items, so preset first.
    await prisma.customer_accessories_presets.deleteMany({ where: { customerId } });
    await prisma.materials.deleteMany({ where: { id: { in: [packagingMaterialId, labelId] } } });
    await prisma.material_categories.deleteMany({ where: { id: { in: [`CAT-${RUN}`, `CAT-${RUN}-L`] } } });
    await prisma.packaging_master.deleteMany({ where: { packagingCode: `${RUN}-PKG` } });
    await prisma.label_master.deleteMany({ where: { labelCode: `${RUN}-LBL` } });
    await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  });
});

/**
 * Tally settings — singleton upsert round-trip.
 * Unlike MODULES which create new records, tally_settings has a fixed "singleton" ID.
 * The test updates the singleton and verifies all fields persist.
 */
describe('tally_settings — singleton upsert round-trip', () => {
  let originalSettings: Record<string, unknown>;
  const base = '/api/tally/settings';

  it('GET returns the singleton settings (creates if needed)', async () => {
    const res = await request(app).get(base).set(authHeader).expect(200);
    originalSettings = (res.body.data ?? res.body) as Record<string, unknown>;
    expect(originalSettings.id).toBe('singleton');
  });

  it('PUT updates settings and every sent field reads back', async () => {
    const testUpdate = {
      tallyEnabled: true,
      tallyHost: '192.168.99.99',
      tallyPort: 9001,
      tallyCompanyName: `${RUN} Test Company`,
      tallyPartyGroup: `${RUN} Debtors`,
      tallyVoucherType: `${RUN} Sales`,
      tallySalesLedgerIntra: `${RUN} Intra Sales`,
      tallySalesLedgerInter: `${RUN} Inter Sales`,
      tallyCgstLedger: `${RUN} CGST 5%`,
      tallySgstLedger: `${RUN} SGST 5%`,
      tallyIgstLedger: `${RUN} IGST 5%`,
      tallyCgstLedger18: `${RUN} CGST 18%`,
      tallySgstLedger18: `${RUN} SGST 18%`,
      tallyIgstLedger18: `${RUN} IGST 18%`,
      tallyRoundOffLedger: `${RUN} Round Off`,
      tallyFreightLedger: `${RUN} Freight`,
      tallyGodownName: `${RUN} Godown`,
      tallyStockUnit: 'Nos',
    };

    const updateRes = await request(app).put(base).set(authHeader).send(testUpdate);
    if (updateRes.status >= 400) {
      throw new Error(`PUT ${base} → ${updateRes.status}: ${JSON.stringify(updateRes.body)}`);
    }

    const fetchRes = await request(app).get(base).set(authHeader).expect(200);
    const fetched = (fetchRes.body.data ?? fetchRes.body) as Record<string, unknown>;

    for (const [key, sent] of Object.entries(testUpdate)) {
      expectFieldPersisted(fetched, key, sent);
    }
  });

  afterAll(async () => {
    // Restore original settings to avoid polluting other tests/runs
    if (originalSettings) {
      const restore: Record<string, unknown> = {};
      const fields = [
        'tallyEnabled',
        'tallyHost',
        'tallyPort',
        'tallyCompanyName',
        'tallyPartyGroup',
        'tallyVoucherType',
        'tallySalesLedgerIntra',
        'tallySalesLedgerInter',
        'tallyCgstLedger',
        'tallySgstLedger',
        'tallyIgstLedger',
        'tallyCgstLedger18',
        'tallySgstLedger18',
        'tallyIgstLedger18',
        'tallyRoundOffLedger',
        'tallyFreightLedger',
        'tallyGodownName',
        'tallyStockUnit',
      ];
      for (const key of fields) {
        if (key in originalSettings) restore[key] = originalSettings[key];
      }
      await request(app).put(base).set(authHeader).send(restore);
    }
  });
});

/**
 * e-Invoice settings — singleton upsert round-trip.
 * Same singleton pattern as tally_settings, plus the secret-masking contract:
 * secrets (einvClientId/einvClientSecret/einvApiPassword) must come back MASKED,
 * never as the stored plaintext.
 */
describe('einvoice_settings — singleton upsert round-trip', () => {
  let originalSettings: Record<string, unknown>;
  const base = '/api/einvoice/settings';
  const MASK = '••••••••';

  it('GET returns the singleton settings (creates if needed)', async () => {
    const res = await request(app).get(base).set(authHeader).expect(200);
    originalSettings = (res.body.data ?? res.body) as Record<string, unknown>;
    expect(originalSettings.id).toBe('singleton');
  });

  it('PUT updates settings; non-secrets read back, secrets read back masked', async () => {
    const testUpdate = {
      einvEnabled: true,
      einvMode: 'SANDBOX',
      einvGstin: '08DCDPS0146D1ZU',
      einvApiUsername: `${RUN}_apiuser`,
      einvClientId: `${RUN}_client_id`,
      einvClientSecret: `${RUN}_client_secret`,
      einvApiPassword: `${RUN}_password`,
    };

    const updateRes = await request(app).put(base).set(authHeader).send(testUpdate);
    if (updateRes.status >= 400) {
      throw new Error(`PUT ${base} → ${updateRes.status}: ${JSON.stringify(updateRes.body)}`);
    }

    const fetchRes = await request(app).get(base).set(authHeader).expect(200);
    const fetched = (fetchRes.body.data ?? fetchRes.body) as Record<string, unknown>;

    expectFieldPersisted(fetched, 'einvEnabled', testUpdate.einvEnabled);
    expectFieldPersisted(fetched, 'einvMode', testUpdate.einvMode);
    expectFieldPersisted(fetched, 'einvGstin', testUpdate.einvGstin);
    expectFieldPersisted(fetched, 'einvApiUsername', testUpdate.einvApiUsername);
    // Secrets must be masked in responses — plaintext echo is a leak
    expect(fetched.einvClientId).toBe(MASK);
    expect(fetched.einvClientSecret).toBe(MASK);
    expect(fetched.einvApiPassword).toBe(MASK);
  });

  it('PUT with the mask sentinel keeps the stored secret (round-trip safe)', async () => {
    // Re-sending the mask (as the settings form does) must NOT overwrite the secret with '••••••••'
    await request(app).put(base).set(authHeader).send({ einvClientId: MASK }).expect(200);
    const res = await request(app).get(base).set(authHeader).expect(200);
    const fetched = (res.body.data ?? res.body) as Record<string, unknown>;
    expect(fetched.einvClientId).toBe(MASK); // still set → still masked, not cleared
  });

  afterAll(async () => {
    // Restore originals. Secrets come back as the mask when they were set — re-sending
    // the mask keeps the stored value; re-sending '' clears (it was blank before the test).
    if (originalSettings) {
      const restore: Record<string, unknown> = {};
      for (const key of [
        'einvEnabled',
        'einvMode',
        'einvGstin',
        'einvApiUsername',
        'einvClientId',
        'einvClientSecret',
        'einvApiPassword',
      ]) {
        if (key in originalSettings) restore[key] = originalSettings[key];
      }
      await request(app).put(base).set(authHeader).send(restore);
    }
  });
});

describe.each(MODULES)('$name — create/update round-trip persists every field', (spec) => {
  let id: string;

  it(`creates via POST ${spec.base} and every sent field reads back`, async () => {
    const res = await request(app).post(spec.base).set(authHeader).send(spec.create);
    // Surface the server's own error message on failure — a bare 400/500 hides the cause.
    if (res.status >= 400) {
      throw new Error(`POST ${spec.base} → ${res.status}: ${JSON.stringify(res.body)}`);
    }
    const created = (res.body.data ?? res.body) as Record<string, unknown>;
    expect(created.id).toBeTruthy();
    id = created.id as string;

    const fetched = await readBack(spec.base, id);
    for (const [key, sent] of Object.entries(spec.create)) {
      expectFieldPersisted(fetched, key, sent);
    }
  });

  it(`updates via PUT ${spec.base}/:id and the changed fields read back`, async () => {
    expect(id).toBeTruthy(); // create must have succeeded

    const res = await request(app).put(`${spec.base}/${id}`).set(authHeader).send(spec.update);
    if (res.status >= 400) {
      throw new Error(`PUT ${spec.base}/${id} → ${res.status}: ${JSON.stringify(res.body)}`);
    }

    const fetched = await readBack(spec.base, id);
    for (const [key, sent] of Object.entries(spec.update)) {
      expectFieldPersisted(fetched, key, sent);
    }
    // An update must not clobber fields it didn't touch (the silent no-op/wipe class).
    for (const [key, sent] of Object.entries(spec.create)) {
      if (key in spec.update) continue;
      if (spec.derived?.includes(key)) continue;
      expectFieldPersisted(fetched, key, sent);
    }
  });
});
