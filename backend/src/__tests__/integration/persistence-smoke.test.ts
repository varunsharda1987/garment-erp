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
  await prisma.users.deleteMany({ where: { id: testUserId } });
  await prisma.$disconnect();
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
