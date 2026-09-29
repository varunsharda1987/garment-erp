/**
 * Style import takes the Buyer Style Code (owner, 2026-09-29).
 *
 * The buyer's code is the main name of a style on every screen and printout, but the import had no
 * column for it — every imported style arrived without one and had to be opened on the Style form.
 * What this pins, through the real endpoint the Style Bulk Import page posts to:
 *   - the template offers a BuyerStyleCode column, and the reader takes it (plus header aliases)
 *   - a new style is saved with its buyer code; a style given none stays without
 *   - one buyer code per style, one style per buyer code (in the file AND against active styles —
 *     the same rule and wording as the Style form, buyer-style-code.helper)
 *   - an overwrite updates the matched style in place, and an empty cell keeps the saved code
 *
 * Runs against the real app + live dev DB; every fixture is scoped to RUN and torn down.
 */

import request from 'supertest';
import ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only, onlyAll } from '../../utils/prisma-test-guard';

const RUN = `SIB${Date.now().toString(36).toUpperCase()}`;
const CUSTOMER = `${RUN} Buyer`;
const OTHER_CUSTOMER = `${RUN} Other Buyer`;

let authHeader: Record<string, string>;
let testUserId: string;
let customerId: string;
let otherCustomerId: string;
let takenStyleId: string;

const HEADER = 'StyleCode,CustomerName,BrandName,Size,StyleName,BuyerStyleCode';

function csv(rows: string[], header = HEADER): Buffer {
  return Buffer.from([header, ...rows].join('\n'), 'utf-8');
}

async function importCsv(file: Buffer, overwrite = false) {
  const req = request(app).post('/api/styles/import').set(authHeader).attach('file', file, 'styles.csv');
  if (overwrite) req.field('overwriteExisting', 'true');
  const res = await req;
  expect([200, 207]).toContain(res.status);
  return res.body as { success: boolean; errors?: Array<{ styleCode: string; errorMessage: string }> };
}

const styleOf = (styleCode: string, customerName = CUSTOMER) =>
  prisma.styles.findFirst({ where: { styleCode, customerName, isActive: true } });

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const customer = await prisma.customers.create({
    data: { code: `${RUN}-C1`, name: CUSTOMER, type: 'BUYER', category: 'DOMESTIC', createdById: testUserId },
  });
  customerId = customer.id;
  const other = await prisma.customers.create({
    data: { code: `${RUN}-C2`, name: OTHER_CUSTOMER, type: 'BUYER', category: 'DOMESTIC', createdById: testUserId },
  });
  otherCustomerId = other.id;

  // An active style already answering to a buyer code the import will try to reuse
  const taken = await prisma.styles.create({
    data: {
      id: randomUUID(),
      styleCode: `${RUN}-TAKEN`,
      styleName: `${RUN} Taken`,
      customerName: OTHER_CUSTOMER,
      buyerStyleRef: `${RUN}-BSC-TAKEN`,
      createdById: testUserId,
    },
  });
  takenStyleId = taken.id;
});

afterAll(async () => {
  const styles = await prisma.styles.findMany({
    where: { styleCode: { startsWith: RUN } },
    select: { id: true },
  });
  const styleIds = onlyAll(styles.map((s) => s.id));
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['style_variants', () => prisma.style_variants.deleteMany({ where: { styleId: { in: styleIds } } })],
    ['size_options', () => prisma.size_options.deleteMany({ where: { styleId: { in: styleIds } } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: { in: styleIds } } })],
    ['staging', () => prisma.style_import_staging.deleteMany({ where: { styleCode: { startsWith: RUN } } })],
    [
      'brand_categories',
      () =>
        prisma.brand_categories.deleteMany({ where: { customerId: { in: onlyAll([customerId, otherCustomerId]) } } }),
    ],
    ['customers', () => prisma.customers.deleteMany({ where: { id: { in: onlyAll([customerId, otherCustomerId]) } } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(testUserId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[style-import-buyer-code teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('the template offers the Buyer Style Code', () => {
  it('has a BuyerStyleCode column', async () => {
    const res = await request(app)
      .get('/api/styles/import/template')
      .set(authHeader)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ArrayBuffer);
    const header = (wb.worksheets[0].getRow(1).values as unknown[]).slice(1).map(String);
    expect(header).toContain('BuyerStyleCode');
  });
});

describe('a new style takes its buyer code', () => {
  it('saves the code given on its rows, and none when the column is empty', async () => {
    const body = await importCsv(
      csv([
        `${RUN}-A,${CUSTOMER},${RUN} Brand,S,Kurta A,${RUN}-BSC-A`,
        `${RUN}-A,${CUSTOMER},${RUN} Brand,M,Kurta A,${RUN}-BSC-A`,
        `${RUN}-B,${CUSTOMER},${RUN} Brand,S,Kurta B,`,
      ])
    );
    expect(body.errors ?? []).toEqual([]);
    expect((await styleOf(`${RUN}-A`))?.buyerStyleRef).toBe(`${RUN}-BSC-A`);
    expect((await styleOf(`${RUN}-B`))?.buyerStyleRef).toBeNull();
  });

  it('reads the column under the other names people write it as', async () => {
    const body = await importCsv(
      csv(
        [`${RUN}-C,${CUSTOMER},${RUN} Brand,S,Kurta C,${RUN}-BSC-C`],
        'Style Code,Customer Name,Brand Name,Size,Style Name,Buyer Style No.'
      )
    );
    expect(body.errors ?? []).toEqual([]);
    expect((await styleOf(`${RUN}-C`))?.buyerStyleRef).toBe(`${RUN}-BSC-C`);
  });
});

describe('one buyer code per style, one style per buyer code', () => {
  it('refuses a style whose rows give different codes', async () => {
    const body = await importCsv(
      csv([
        `${RUN}-D,${CUSTOMER},${RUN} Brand,S,Kurta D,${RUN}-BSC-D1`,
        `${RUN}-D,${CUSTOMER},${RUN} Brand,M,Kurta D,${RUN}-BSC-D2`,
      ])
    );
    expect(body.errors?.[0].errorMessage).toMatch(/different Buyer Style Codes/);
    expect(await styleOf(`${RUN}-D`)).toBeNull();
  });

  it('refuses two styles in one file claiming the same code', async () => {
    const body = await importCsv(
      csv([
        `${RUN}-E,${CUSTOMER},${RUN} Brand,S,Kurta E,${RUN}-BSC-SAME`,
        `${RUN}-F,${CUSTOMER},${RUN} Brand,S,Kurta F,${RUN}-BSC-SAME`,
      ])
    );
    expect(body.errors).toHaveLength(2);
    expect(body.errors?.every((e) => /more than one style in this file/.test(e.errorMessage))).toBe(true);
    expect(await styleOf(`${RUN}-E`)).toBeNull();
    expect(await styleOf(`${RUN}-F`)).toBeNull();
  });

  it('refuses a code already on another active style — the Style form wording', async () => {
    const body = await importCsv(csv([`${RUN}-G,${CUSTOMER},${RUN} Brand,S,Kurta G,${RUN}-BSC-TAKEN`]));
    expect(body.errors?.[0].errorMessage).toBe(
      `Buyer Style Code "${RUN}-BSC-TAKEN" already exists on style ${RUN}-TAKEN`
    );
    expect(await styleOf(`${RUN}-G`)).toBeNull();
    expect((await prisma.styles.findUnique({ where: { id: takenStyleId } }))?.buyerStyleRef).toBe(`${RUN}-BSC-TAKEN`);
  });
});

describe('an overwrite', () => {
  it('re-codes the style, and an empty cell keeps the saved code', async () => {
    const before = await styleOf(`${RUN}-A`);
    const recoded = await importCsv(csv([`${RUN}-A,${CUSTOMER},${RUN} Brand,S,Kurta A,${RUN}-BSC-A2`]), true);
    expect(recoded.errors ?? []).toEqual([]);
    const after1 = await styleOf(`${RUN}-A`);
    expect(after1?.id).toBe(before?.id); // the matched style is updated in place, by id
    expect(after1?.buyerStyleRef).toBe(`${RUN}-BSC-A2`);

    const kept = await importCsv(csv([`${RUN}-A,${CUSTOMER},${RUN} Brand,S,Kurta A renamed,`]), true);
    expect(kept.errors ?? []).toEqual([]);
    const after = await styleOf(`${RUN}-A`);
    expect(after?.styleName).toBe('Kurta A renamed');
    expect(after?.buyerStyleRef).toBe(`${RUN}-BSC-A2`);
  });
});

describe('the Style form keeps the same rule (buyer-style-code.helper)', () => {
  it('refuses a new style whose buyer code is taken, and an edit that takes one', async () => {
    const taken = await request(app)
      .post('/api/styles')
      .set(authHeader)
      .send({
        styleCode: `${RUN}-FORM`,
        styleName: `${RUN} Form`,
        customerName: CUSTOMER,
        brandName: `${RUN} Brand`,
        buyerStyleRef: `${RUN}-BSC-TAKEN`,
      });
    expect(taken.status).toBe(409);
    expect(JSON.stringify(taken.body)).toContain(
      `Buyer Style Code \\"${RUN}-BSC-TAKEN\\" already exists on style ${RUN}-TAKEN`
    );

    const ok = await request(app)
      .post('/api/styles')
      .set(authHeader)
      .send({ styleCode: `${RUN}-FORM`, styleName: `${RUN} Form`, customerName: CUSTOMER, brandName: `${RUN} Brand` })
      .expect(201);
    const styleId = ok.body.data.id as string;

    const edit = await request(app)
      .put(`/api/styles/${styleId}`)
      .set(authHeader)
      .send({ buyerStyleRef: `${RUN}-BSC-TAKEN` });
    expect(edit.status).toBe(409);
    // its own code may be saved again
    await request(app)
      .put(`/api/styles/${styleId}`)
      .set(authHeader)
      .send({ buyerStyleRef: `${RUN}-BSC-FORM` })
      .expect(200);
    await request(app)
      .put(`/api/styles/${styleId}`)
      .set(authHeader)
      .send({ buyerStyleRef: `${RUN}-BSC-FORM` })
      .expect(200);
  });
});
