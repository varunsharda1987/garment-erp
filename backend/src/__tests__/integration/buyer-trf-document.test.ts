/**
 * Buyer TRF — the printed sheet.
 *
 * The printed sheet is EXACTLY two pages: the filled form, then Intertek's Terms and
 * Conditions reproduced from the buyer's own file. The form must stay on page 1 — a form that
 * arrives split gets separated from the sample it belongs to — and the 33 test labels are the
 * wild card, because one long enough to wrap adds a row to all three columns at once. So the
 * page count is asserted rather than trusted: this is the test that fails when someone adds a
 * test to TRF_TESTS, rather than the buyer when the sheet arrives in pieces.
 *
 * Also pins the two judgement calls in the adapter that are invisible in a page count:
 *  - a value we do not hold renders as a hand-fill hatch, never as an em-dash (on a lab form
 *    an em-dash reads as "not applicable", which is a different and wrong claim);
 *  - ticks are never hatched, because they are system-populated.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { buildBuyerTrfDocData } from '../../services/document-data/buyer-trf.doc-data';
import { documentFacadeService } from '../../services/document-facade.service';
import { closeBrowser } from '../../services/html-renderer.service';
import { TRF_TESTS } from '../../constants/buyer-trf.constants';

const RUN = `TRFDOC${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let customerId: string;
let styleId: string;
let saleOrderId: string;
let trfId: string;

/** Count PDF page objects without pulling in a PDF library for one assertion. */
function pdfPageCount(buf: Buffer): number {
  return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `${RUN.toLowerCase()}@doc.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;

  const customer = await prisma.customers.create({
    data: {
      code: `${RUN}-C`,
      name: `${RUN} Buyer`,
      type: 'BUYER',
      category: 'DOMESTIC',
      createdById: userId,
    },
  });
  customerId = customer.id;

  const style = await prisma.styles.create({
    data: {
      id: randomUUID(),
      styleCode: `${RUN}-S`,
      styleName: `${RUN} Tunic`,
      createdById: userId,
    },
  });
  styleId = style.id;

  const so = await prisma.sale_orders.create({
    data: { saleOrderNumber: `${RUN}-SO`, buyerPoNumber: '2058937', customerId, createdById: userId },
  });
  saleOrderId = so.id;

  const trf = await prisma.buyer_test_requirement_forms.create({
    data: {
      trfNumber: `${RUN}`.slice(0, 20),
      styleId,
      customerId,
      saleOrderId,
      createdById: userId,
      buyingDepartment: 'WOMENS_WEAR',
      styleNo: `${RUN}-S`,
      sampleDescription: 'TUNIC',
      endUse: 'TUNIC(TOP)',
      fibreContent: '100% RAYON',
      yarnCount: '30*30',
      construction: '68*46',
      season: 'S10-26',
      washCareCode: 'RN-6',
      vendorCode: '205577',
      orderNumber: '2058937',
      // Deliberately left unset so the hatch path is exercised: colour, fabric weight,
      // supplier, dyeing house, merchandiser.
      setsPackingDifferentColour: null,
      contrastTrimUsed: false,
      // Every test ticked — the worst case for height, which is the case that must fit.
      selectedTests: TRF_TESTS.map((t) => t.code),
      buyingSubCategories: ['WOMENS_DENIM', 'WOMENS_NIGHT_WEAR', 'WOMENS_DRESS', 'WOMENS_SMART'],
    },
  });
  trfId = trf.id;
});

afterAll(async () => {
  // The renderer keeps a lazy Chrome alive for 120s of idle; without this Jest hangs after
  // the last test rather than exiting.
  await closeBrowser();
  await prisma.buyer_test_requirement_forms.deleteMany({ where: { customerId } });
  await prisma.sale_orders.deleteMany({ where: { id: only(saleOrderId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('buyer TRF document data', () => {
  it('renders a missing value as a hand-fill hatch, never as text', async () => {
    const data = await buildBuyerTrfDocData(trfId);
    const colour = data.identity.find((f) => f.label === 'Color');

    expect(colour).toBeDefined();
    expect(colour!.hand).toBe(true);
    expect(colour!.value).toBeNull();
    // The specific thing that must never happen: an em-dash standing in for "we don't know".
    expect(String(colour!.value ?? '')).not.toContain('—');
  });

  it('marks a value we DO hold as not-hand-filled', async () => {
    const data = await buildBuyerTrfDocData(trfId);
    const fibre = data.identity.find((f) => f.label === 'Fiber Content');
    expect(fibre!.hand).toBe(false);
    expect(fibre!.value).toBe('100% RAYON');
  });

  it('lists every hatched field so the sheet can name them in its footer', async () => {
    const data = await buildBuyerTrfDocData(trfId);
    expect(data.handFilled).toEqual(expect.arrayContaining(['Color', 'Fabric Weight', 'Dyeing House Name']));
  });

  it('splits the 33 tests into the buyer three printed columns of 11', async () => {
    const data = await buildBuyerTrfDocData(trfId);
    expect(data.testColumns).toHaveLength(3);
    expect(data.testColumns.map((c) => c.length)).toEqual([11, 11, 11]);
    expect(data.testColumns.flat().every((t) => t.on)).toBe(true); // all ticked in this fixture
  });

  it('keeps the two Denim boxes in their own departments', async () => {
    const data = await buildBuyerTrfDocData(trfId);
    const [kids, mens, womens] = data.subCategoryColumns;
    expect(kids.map((t) => t.label)).toEqual(['Boys', 'Girls', 'Infant', '2-8 Years', '8-16 Years']);
    // Both columns print a box labelled "Denim"; only the Women's one is ticked here.
    expect(mens.find((t) => t.label === 'Denim')!.on).toBe(false);
    expect(womens.find((t) => t.label === 'Denim')!.on).toBe(true);
  });

  it('leaves BOTH yes and no unticked for a tri-state null', async () => {
    const data = await buildBuyerTrfDocData(trfId);
    const sets = data.yesNo.find((r) => r.label.startsWith('Style With Sets'));
    expect(sets).toMatchObject({ yes: false, no: false });

    const contrast = data.yesNo.find((r) => r.label.startsWith('Contrast/Trim'));
    expect(contrast).toMatchObject({ yes: false, no: true });
  });
});

describe('buyer TRF PDF', () => {
  // Chrome launch plus render; comfortably longer than the default 5s.
  jest.setTimeout(120_000);

  it('is exactly TWO pages with every test ticked — the form, then the T&C', async () => {
    const pdf = await documentFacadeService.generateBuyerTrfPDF(trfId);

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    // Includes the embedded T&C scan, so a thin PDF means the image failed to load.
    expect(pdf.length).toBeGreaterThan(100_000);
    // 3+ means the form spilled off page 1 (or the T&C scan is no longer bounded by height).
    expect(pdfPageCount(pdf)).toBe(2);
  });
});
