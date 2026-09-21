/**
 * Multi-select (faceted) filters on the Greige and Fabric master lists.
 *
 * What this pins, and why each case exists:
 *  - a REPEATED key (?greigeQuality=A&greigeQuality=B) ORs inside a facet and ANDs across facets
 *  - a SINGLE value still works (scalar -> [scalar]) — the pre-existing single-value callers
 *  - a BLANK value means NO FILTER: `&maxWidth=` under z.coerce.number() becomes `lte: 0` and
 *    silently returns an empty list, which is the bug queryNumber() exists to prevent
 *  - the facets survive a simultaneous `search=` (applySearch writes under where.AND)
 *  - ranges are inclusive at both ends, on Decimal and on Int columns
 *  - /filter-options hands back values that actually match rows — unlike /fabric/generic-names,
 *    which derives names from greige_master by regex (fabric.controller.ts)
 */

import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only, onlyAll } from '../../utils/prisma-test-guard';

const RUN = `FAC${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;
const greigeIds: string[] = [];
const fabricIds: string[] = [];

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const greiges = await Promise.all([
    prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-G1`,
        greigeName: `${RUN} Poplin`,
        composition: '100% Cotton',
        weaveType: `${RUN}-POPLIN`,
        genericGreigeName: `${RUN}-CAMBRIC`,
        greigeQuality: 'PRINTING',
        greigeWidth: 44,
        averageShrinkagePercent: 3,
        createdById: testUserId,
      },
    }),
    prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-G2`,
        greigeName: `${RUN} Voile`,
        composition: '100% Cotton',
        weaveType: `${RUN}-VOILE`,
        genericGreigeName: `${RUN}-VOILEGEN`,
        greigeQuality: 'DYEING',
        greigeWidth: 58,
        averageShrinkagePercent: 7,
        createdById: testUserId,
      },
    }),
    prisma.greige_master.create({
      data: {
        greigeCode: `${RUN}-G3`,
        greigeName: `${RUN} Satin`,
        composition: '100% Cotton',
        weaveType: `${RUN}-SATIN`,
        genericGreigeName: `${RUN}-CAMBRIC`,
        greigeQuality: 'SUPER_DYEING',
        greigeWidth: 60,
        averageShrinkagePercent: 12,
        createdById: testUserId,
      },
    }),
  ]);
  greigeIds.push(...greiges.map((g) => g.id));

  const fabrics = await Promise.all([
    prisma.fabric_master.create({
      data: {
        fabricCode: `${RUN}-F1`,
        fabricName: `${RUN} Dyed Navy`,
        greigeId: greiges[0].id,
        genericGreigeName: `${RUN}-CAMBRIC`,
        colorName: `${RUN}-NAVY`,
        finishType: 'DYED',
        source: 'STOCK',
        isGeneric: false,
        actualGSM: 110,
        actualWidth: 44,
        createdById: testUserId,
      },
    }),
    prisma.fabric_master.create({
      data: {
        fabricCode: `${RUN}-F2`,
        fabricName: `${RUN} Printed Red`,
        greigeId: greiges[1].id,
        genericGreigeName: `${RUN}-VOILEGEN`,
        colorName: `${RUN}-RED`,
        finishType: 'PRINTED',
        source: 'STYLE_LINKED',
        isGeneric: true,
        actualGSM: 150,
        actualWidth: 58,
        createdById: testUserId,
      },
    }),
    prisma.fabric_master.create({
      data: {
        fabricCode: `${RUN}-F3`,
        fabricName: `${RUN} Raw Grey`,
        greigeId: greiges[2].id,
        genericGreigeName: `${RUN}-CAMBRIC`,
        colorName: `${RUN}-GREY`,
        finishType: 'RAW',
        source: 'STOCK',
        isGeneric: false,
        actualGSM: 200,
        actualWidth: 60,
        createdById: testUserId,
      },
    }),
  ]);
  fabricIds.push(...fabrics.map((f) => f.id));
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['materials (fabric)', () => prisma.materials.deleteMany({ where: { id: { in: onlyAll(fabricIds) } } })],
    ['materials (greige)', () => prisma.materials.deleteMany({ where: { id: { in: onlyAll(greigeIds) } } })],
    ['fabric_master', () => prisma.fabric_master.deleteMany({ where: { id: { in: onlyAll(fabricIds) } } })],
    ['greige_master', () => prisma.greige_master.deleteMany({ where: { id: { in: onlyAll(greigeIds) } } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(testUserId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[fabricGreigeFacets teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

// Every query is scoped with search=RUN so the assertions are exact, not "contains".
const greigeCodes = async (query: string) => {
  const res = await request(app)
    .get(`/api/fabric-management/greige?search=${RUN}&${query}&limit=100`)
    .set(authHeader)
    .expect(200);
  return (res.body.data as Array<{ greigeCode: string }>).map((r) => r.greigeCode).sort();
};

const fabricCodes = async (query: string) => {
  const res = await request(app)
    .get(`/api/fabric-management/fabric?search=${RUN}&${query}&limit=100`)
    .set(authHeader)
    .expect(200);
  return (res.body.data as Array<{ fabricCode: string }>).map((r) => r.fabricCode).sort();
};

describe('Greige master: multi-select facets', () => {
  it('a single value still works — scalar becomes [scalar]', async () => {
    expect(await greigeCodes('greigeQuality=PRINTING')).toEqual([`${RUN}-G1`]);
  });

  it('two values of one facet are OR-ed — the whole point of multi-select', async () => {
    expect(await greigeCodes('greigeQuality=PRINTING&greigeQuality=DYEING')).toEqual([`${RUN}-G1`, `${RUN}-G2`]);
  });

  it('two different facets are AND-ed', async () => {
    expect(await greigeCodes(`greigeQuality=PRINTING&greigeQuality=DYEING&weaveType=${RUN}-VOILE`)).toEqual([
      `${RUN}-G2`,
    ]);
  });

  it('a facet still narrows when the search box is also in use', async () => {
    // applySearch writes to where.AND, so a facet can never be OR-ed away
    const res = await request(app)
      .get(`/api/fabric-management/greige?search=${RUN}%20Satin&greigeQuality=PRINTING&limit=100`)
      .set(authHeader)
      .expect(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('genericGreigeName multi-select matches every row carrying the value', async () => {
    expect(await greigeCodes(`genericGreigeName=${RUN}-CAMBRIC`)).toEqual([`${RUN}-G1`, `${RUN}-G3`]);
  });

  it('the width range is inclusive at both ends (Decimal column)', async () => {
    expect(await greigeCodes('minWidth=44&maxWidth=58')).toEqual([`${RUN}-G1`, `${RUN}-G2`]);
    expect(await greigeCodes('minWidth=59')).toEqual([`${RUN}-G3`]);
  });

  it('the shrinkage range filters the Decimal(5,2) column', async () => {
    expect(await greigeCodes('maxShrinkage=7')).toEqual([`${RUN}-G1`, `${RUN}-G2`]);
    expect(await greigeCodes('minShrinkage=7&maxShrinkage=12')).toEqual([`${RUN}-G2`, `${RUN}-G3`]);
  });

  it('a BLANK range bound means NO bound — not lte:0, which would empty the list', async () => {
    expect(await greigeCodes('minWidth=&maxWidth=&minShrinkage=')).toEqual([`${RUN}-G1`, `${RUN}-G2`, `${RUN}-G3`]);
  });

  it('a BLANK facet value means no filter, not `in: [""]`', async () => {
    expect(await greigeCodes('weaveType=&greigeQuality=&genericGreigeName=')).toEqual([
      `${RUN}-G1`,
      `${RUN}-G2`,
      `${RUN}-G3`,
    ]);
  });

  it('an unknown enum value is rejected loudly instead of silently ignored', async () => {
    await request(app)
      .get('/api/fabric-management/greige?greigeQuality=NOT_A_QUALITY&limit=5')
      .set(authHeader)
      .expect(400);
  });
});

describe('Fabric master: multi-select facets', () => {
  it('finishType multi-select', async () => {
    expect(await fabricCodes('finishType=DYED&finishType=RAW')).toEqual([`${RUN}-F1`, `${RUN}-F3`]);
  });

  it('colorName is an exact multi-select now; the search box still does substring', async () => {
    expect(await fabricCodes(`colorName=${RUN}-NAVY&colorName=${RUN}-RED`)).toEqual([`${RUN}-F1`, `${RUN}-F2`]);
    const res = await request(app)
      .get(`/api/fabric-management/fabric?search=${RUN}-GREY&limit=100`)
      .set(authHeader)
      .expect(200);
    expect(res.body.data.map((r: { fabricCode: string }) => r.fabricCode)).toEqual([`${RUN}-F3`]);
  });

  it('source multi-select works on the plain String? column', async () => {
    expect(await fabricCodes('source=STOCK')).toEqual([`${RUN}-F1`, `${RUN}-F3`]);
    expect(await fabricCodes('source=STOCK&source=STYLE_LINKED')).toEqual([`${RUN}-F1`, `${RUN}-F2`, `${RUN}-F3`]);
  });

  it('genericGreigeName multi-select', async () => {
    expect(await fabricCodes(`genericGreigeName=${RUN}-CAMBRIC`)).toEqual([`${RUN}-F1`, `${RUN}-F3`]);
  });

  it('isGeneric is tri-state: all / true / false', async () => {
    expect(await fabricCodes('isGeneric=all')).toEqual([`${RUN}-F1`, `${RUN}-F2`, `${RUN}-F3`]);
    expect(await fabricCodes('isGeneric=true')).toEqual([`${RUN}-F2`]);
    expect(await fabricCodes('isGeneric=false')).toEqual([`${RUN}-F1`, `${RUN}-F3`]);
  });

  it('the GSM range is inclusive, and a fractional bound does not 500 the list (Int column)', async () => {
    expect(await fabricCodes('minGSM=110&maxGSM=150')).toEqual([`${RUN}-F1`, `${RUN}-F2`]);
    // 110.5 must not reach Prisma as a float on an Int column
    expect(await fabricCodes('minGSM=110.5')).toEqual([`${RUN}-F2`, `${RUN}-F3`]);
  });

  it('the width range works on the Decimal column', async () => {
    expect(await fabricCodes('minWidth=58')).toEqual([`${RUN}-F2`, `${RUN}-F3`]);
  });

  it('greigeId still filters — it was already supported and must stay', async () => {
    expect(await fabricCodes(`greigeId=${greigeIds[1]}`)).toEqual([`${RUN}-F2`]);
  });
});

describe('/filter-options feeds the dropdowns with values that actually match rows', () => {
  const values = (list: Array<{ value: string }>) => list.map((o) => o.value);

  it('greige filter-options returns every facet plus the range bounds in ONE call', async () => {
    const res = await request(app).get('/api/fabric-management/greige/filter-options').set(authHeader).expect(200);
    expect(values(res.body.data.weaveType)).toEqual(expect.arrayContaining([`${RUN}-POPLIN`, `${RUN}-VOILE`]));
    expect(values(res.body.data.genericGreigeName)).toContain(`${RUN}-CAMBRIC`);
    expect(values(res.body.data.greigeQuality)).toEqual(expect.arrayContaining(['DYEING', 'PRINTING', 'SUPER_DYEING']));
    expect(res.body.data.width.max).toBeGreaterThanOrEqual(60);
  });

  it('a weaveType option fed straight back as a filter returns its own count', async () => {
    const res = await request(app).get('/api/fabric-management/greige/filter-options').set(authHeader).expect(200);
    const option = (res.body.data.weaveType as Array<{ value: string; count: number }>).find(
      (o) => o.value === `${RUN}-POPLIN`
    );
    expect(option?.count).toBe(1);
    expect(await greigeCodes(`weaveType=${encodeURIComponent(option!.value)}`)).toEqual([`${RUN}-G1`]);
  });

  it('fabric filter-options returns colours, sources and finishes in ONE call', async () => {
    const res = await request(app).get('/api/fabric-management/fabric/filter-options').set(authHeader).expect(200);
    expect(values(res.body.data.colorName)).toContain(`${RUN}-NAVY`);
    expect(values(res.body.data.source)).toEqual(expect.arrayContaining(['STOCK', 'STYLE_LINKED']));
    expect(values(res.body.data.finishType)).toEqual(expect.arrayContaining(['DYED', 'PRINTED', 'RAW']));
    expect(res.body.data.gsm.max).toBeGreaterThanOrEqual(200);
  });

  it('a colorName option fed back as a filter returns rows (unlike /fabric/generic-names)', async () => {
    const res = await request(app).get('/api/fabric-management/fabric/filter-options').set(authHeader).expect(200);
    const option = (res.body.data.colorName as Array<{ value: string }>).find((o) => o.value === `${RUN}-GREY`);
    expect(await fabricCodes(`colorName=${encodeURIComponent(option!.value)}`)).toEqual([`${RUN}-F3`]);
  });
});
