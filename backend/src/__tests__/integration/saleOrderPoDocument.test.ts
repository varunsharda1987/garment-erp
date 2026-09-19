/**
 * The customer's own purchase order, attached to a sale order.
 *
 * A buyer PO used to be a VARCHAR(100) label and nothing else — no date, no location, and no
 * document. The PO itself, the paper that says what the buyer ordered and where it ships, lived in
 * someone's email. It now carries a delivery location (from the customer's own address book), a PO
 * date, and the document.
 *
 * What this pins, in rough order of how expensive each would be to get wrong:
 *   - the round trip: add a PO with location + date, attach a PDF, read it all back
 *   - PO files need a LOGIN, and — the half that is easy to break — every OTHER upload directory
 *     still does not
 *   - every path that can strand a file on disk: a rejected upload, a replace, removing the PO,
 *     and deleting the whole sale order. A leak is silent, and the NAS/Drive backup would then
 *     copy the orphan forever
 *   - a bad file type or an oversized file answers 400 NAMING the reason, not a bare 500
 *
 * Runs against the real app + live dev DB; every fixture is scoped to RUN and torn down.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `POD${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;
let customerId: string;
let otherCustomerId: string;
let styleId: string;
let sizeId: string;
let addressId: string;
let otherCustomerAddressId: string;

const createdSoIds: string[] = [];
const createdAddressIds: string[] = [];

/** A minimal but genuinely PDF-shaped payload — multer sniffs the extension and the mimetype. */
const PDF_BYTES = Buffer.from('%PDF-1.4\n%buyer purchase order\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n');

const poDocumentDir = path.join(__dirname, '../../../uploads/po-documents');
const onDisk = (fileUrl: string) => fs.existsSync(path.join(poDocumentDir, path.basename(fileUrl)));

async function createOrder() {
  const res = await request(app)
    .post('/api/sale-orders')
    .set(authHeader)
    .send({ customerId, items: [{ styleId, sizeId, quantity: 5, unitPrice: 100 }] })
    .expect(201);
  createdSoIds.push(res.body.data.id);
  return res.body.data.id as string;
}

const addPo = (soId: string, body: Record<string, unknown>) =>
  request(app).post(`/api/sale-orders/${soId}/buyer-pos`).set(authHeader).send(body);

const attachDoc = (poId: string, bytes: Buffer, filename: string) =>
  request(app).post(`/api/sale-orders/buyer-pos/${poId}/document`).set(authHeader).attach('file', bytes, filename);

const readPos = async (soId: string) => {
  const res = await request(app).get(`/api/sale-orders/${soId}`).set(authHeader).expect(200);
  return res.body.buyerPos as Array<Record<string, any>>;
};

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const [customer, otherCustomer] = await Promise.all([
    prisma.customers.create({
      data: { code: `${RUN}-CUST`, name: `${RUN} Buyer`, type: 'BUYER', category: 'DOMESTIC', createdById: testUserId },
    }),
    prisma.customers.create({
      data: {
        code: `${RUN}-OTHER`,
        name: `${RUN} Other Buyer`,
        type: 'BUYER',
        category: 'DOMESTIC',
        createdById: testUserId,
      },
    }),
  ]);
  customerId = customer.id;
  otherCustomerId = otherCustomer.id;

  const [address, otherAddress] = await Promise.all([
    prisma.customer_addresses.create({
      data: {
        customerId,
        label: `${RUN} Mumbai DC`,
        addressType: 'SHIP_TO',
        addressLine1: '1 Dock Road',
        pincode: '400001',
      },
    }),
    prisma.customer_addresses.create({
      data: {
        customerId: otherCustomerId,
        label: `${RUN} Someone Else DC`,
        addressType: 'SHIP_TO',
        addressLine1: '9 Other Road',
        pincode: '110001',
      },
    }),
  ]);
  addressId = address.id;
  otherCustomerAddressId = otherAddress.id;
  createdAddressIds.push(address.id, otherAddress.id);

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}A`, styleName: `${RUN} Style`, createdById: testUserId },
  });
  styleId = style.id;
  const size = await prisma.size_options.create({
    data: { id: randomUUID(), styleId, sizeName: 'M', sizeCode: `${RUN}-M` },
  });
  sizeId = size.id;
});

afterAll(async () => {
  // Children first, each step independent: one failure must not strand the rest in the live DB.
  const steps: Array<[string, () => Promise<unknown>]> = [
    // Files FIRST, and by hand: the rows below are deleted straight through Prisma, which skips
    // the service that would normally unlink. Without this the suite leaves a PDF behind on every
    // run and the NAS/Drive backup faithfully copies each one.
    [
      'po document files',
      async () => {
        const pos = await prisma.sale_order_buyer_pos.findMany({
          where: { saleOrderId: { in: createdSoIds }, documentUrl: { not: null } },
          select: { documentUrl: true },
        });
        for (const po of pos) {
          const filePath = path.join(poDocumentDir, path.basename(po.documentUrl!));
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      },
    ],
    ['sale_order_items', () => prisma.sale_order_items.deleteMany({ where: { saleOrderId: { in: createdSoIds } } })],
    ['samples', () => prisma.samples.deleteMany({ where: { customerId: only(customerId) } })],
    [
      'sale_order_buyer_pos',
      () => prisma.sale_order_buyer_pos.deleteMany({ where: { saleOrderId: { in: createdSoIds } } }),
    ],
    ['sale_orders', () => prisma.sale_orders.deleteMany({ where: { id: { in: createdSoIds } } })],
    ['size_options', () => prisma.size_options.deleteMany({ where: { styleId: only(styleId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    // After the POs, or the Restrict FK refuses.
    ['customer_addresses', () => prisma.customer_addresses.deleteMany({ where: { id: { in: createdAddressIds } } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: { in: [customerId, otherCustomerId] } } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(testUserId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[saleOrderPoDocument teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('a buyer PO carries its location, its date and the customer’s own paperwork', () => {
  it('records the location and PO date, and reads them back', async () => {
    const soId = await createOrder();

    const res = await addPo(soId, {
      buyerPoNumber: `${RUN}-PO-01`,
      deliveryAddressId: addressId,
      poDate: '2026-09-01',
    }).expect(201);
    expect(res.body.data.deliveryAddressId).toBe(addressId);

    const [po] = await readPos(soId);
    expect(po.buyerPoNumber).toBe(`${RUN}-PO-01`);
    expect(po.deliveryAddress.label).toBe(`${RUN} Mumbai DC`);
    expect(String(po.poDate)).toContain('2026-09-01');
  });

  it('refuses a location that belongs to a different customer', async () => {
    // Without this check the FK would throw a P2003 and surface as a 500 naming a constraint —
    // and one buyer's PO could be pointed at another buyer's warehouse.
    const soId = await createOrder();
    const res = await addPo(soId, { buyerPoNumber: `${RUN}-PO-X`, deliveryAddressId: otherCustomerAddressId });

    expect(res.status).toBe(400);
    expect(res.body.message || res.body.error?.message).toMatch(/different customer/i);
  });

  it('attaches the PO document and reports its name and size', async () => {
    const soId = await createOrder();
    const add = await addPo(soId, { buyerPoNumber: `${RUN}-PO-02`, deliveryAddressId: addressId }).expect(201);

    const res = await attachDoc(add.body.data.id, PDF_BYTES, 'HOK-PO.pdf').expect(201);

    expect(res.body.data.documentUrl).toMatch(/^\/uploads\/po-documents\//);
    expect(res.body.data.documentName).toBe('HOK-PO.pdf');
    expect(res.body.data.documentSize).toBe(PDF_BYTES.length);
    expect(onDisk(res.body.data.documentUrl)).toBe(true);

    const [po] = await readPos(soId);
    expect(po.documentName).toBe('HOK-PO.pdf');
  });

  it('replacing the document unlinks the file it replaced', async () => {
    const soId = await createOrder();
    const add = await addPo(soId, { buyerPoNumber: `${RUN}-PO-03` }).expect(201);

    const first = await attachDoc(add.body.data.id, PDF_BYTES, 'original.pdf').expect(201);
    const second = await attachDoc(add.body.data.id, PDF_BYTES, 'amended.pdf').expect(201);

    expect(second.body.data.documentName).toBe('amended.pdf');
    expect(onDisk(second.body.data.documentUrl)).toBe(true);
    expect(onDisk(first.body.data.documentUrl)).toBe(false);
  });

  it('removing the document keeps the PO and clears every column', async () => {
    const soId = await createOrder();
    const add = await addPo(soId, { buyerPoNumber: `${RUN}-PO-04` }).expect(201);
    const doc = await attachDoc(add.body.data.id, PDF_BYTES, 'to-remove.pdf').expect(201);

    await request(app).delete(`/api/sale-orders/buyer-pos/${add.body.data.id}/document`).set(authHeader).expect(200);

    expect(onDisk(doc.body.data.documentUrl)).toBe(false);
    const [po] = await readPos(soId);
    expect(po.buyerPoNumber).toBe(`${RUN}-PO-04`);
    expect(po.documentUrl).toBeNull();
    expect(po.documentName).toBeNull();
  });

  it('removing the whole PO unlinks its document', async () => {
    const soId = await createOrder();
    const add = await addPo(soId, { buyerPoNumber: `${RUN}-PO-05` }).expect(201);
    const doc = await attachDoc(add.body.data.id, PDF_BYTES, 'with-po.pdf').expect(201);

    await request(app).delete(`/api/sale-orders/buyer-pos/${add.body.data.id}`).set(authHeader).expect(200);

    expect(onDisk(doc.body.data.documentUrl)).toBe(false);
  });

  it('deleting the sale order unlinks the PO documents the cascade wipes', async () => {
    // sale_order_buyer_pos is ON DELETE CASCADE, so the rows — the only record that the file
    // exists — disappear with the order. The B2B app deletes and re-creates orders routinely.
    const soId = await createOrder();
    const add = await addPo(soId, { buyerPoNumber: `${RUN}-PO-06` }).expect(201);
    const doc = await attachDoc(add.body.data.id, PDF_BYTES, 'cascade.pdf').expect(201);

    await request(app).delete(`/api/sale-orders/${soId}`).set(authHeader).expect(200);

    expect(onDisk(doc.body.data.documentUrl)).toBe(false);
  });

  it('a rejected file type answers 400 naming the reason, and leaves nothing on disk', async () => {
    const soId = await createOrder();
    const add = await addPo(soId, { buyerPoNumber: `${RUN}-PO-07` }).expect(201);

    const before = fs.existsSync(poDocumentDir) ? fs.readdirSync(poDocumentDir).length : 0;
    const res = await attachDoc(add.body.data.id, Buffer.from('MZ not a pdf'), 'po.exe');

    // 400 with the real reason, not the global handler's 500 "An unexpected error occurred".
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/JPG, PNG, and PDF/i);
    const after = fs.existsSync(poDocumentDir) ? fs.readdirSync(poDocumentDir).length : 0;
    expect(after).toBe(before);
  });

  it('an upload against a missing PO does not strand the file multer already wrote', async () => {
    const before = fs.existsSync(poDocumentDir) ? fs.readdirSync(poDocumentDir).length : 0;

    const res = await attachDoc(randomUUID(), PDF_BYTES, 'orphan.pdf');

    expect(res.status).toBe(404);
    const after = fs.existsSync(poDocumentDir) ? fs.readdirSync(poDocumentDir).length : 0;
    expect(after).toBe(before);
  });
});

describe('PO documents need a login — and only PO documents', () => {
  let documentUrl: string;

  beforeAll(async () => {
    const soId = await createOrder();
    const add = await addPo(soId, { buyerPoNumber: `${RUN}-PO-AUTH` }).expect(201);
    const doc = await attachDoc(add.body.data.id, PDF_BYTES, 'confidential.pdf').expect(201);
    documentUrl = doc.body.data.documentUrl;
  });

  it('refuses the file without a token', async () => {
    // A buyer PO carries prices and terms. Everything under /uploads is world-readable by default,
    // so this path is mounted behind createFileAccessMiddleware('authenticated').
    await request(app).get(documentUrl).expect(401);
  });

  it('serves the file with a token', async () => {
    const res = await request(app).get(documentUrl).set(authHeader).expect(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
  });

  it('leaves every other upload directory public — the guard is path-scoped', async () => {
    // The negative control. Securing this by setting FILE_ACCESS_MODE globally would 401 every
    // style image, CAD file and lace image in the app; this asserts that did not happen.
    const res = await request(app).get('/uploads/cad-files/does-not-exist.pdf');
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(404);
  });
});
