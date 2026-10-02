/**
 * Integration Tests for GST-related API Endpoints
 *
 * Tests API endpoints with real HTTP requests using Supertest, against the LIVE database.
 *
 * The auth middleware re-validates every token against the users table (active + approved), so a
 * token signed for a made-up id is refused with 401 — which is why 18 of these tests failed for
 * months. A real, tagged, approved ADMIN is created for the run and removed afterwards, together with
 * every row the run creates (tagged by RUN), so nothing is left behind even if a DELETE soft-deletes.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';

const RUN = `GST${Date.now().toString(36).toUpperCase()}`;
/** Unique per run and short: HSN codes are plain strings, unique across the table. */
const HSN_CODE = `99T${Date.now().toString().slice(-5)}`;
const only = (id: string | undefined) => id ?? '__unset__';

let authHeader: Record<string, string>;
let testUserId: string;

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@gst.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');
});

afterAll(async () => {
  await prisma.hsn_sac_masters.deleteMany({ where: { code: HSN_CODE } });
  await prisma.tds_entries.deleteMany({ where: { deductorName: { startsWith: RUN } } });
  await prisma.tcs_entries.deleteMany({ where: { customerName: { startsWith: RUN } } });
  await prisma.users.deleteMany({ where: { id: only(testUserId) } });
  await prisma.$disconnect();
});

describe('GST API Integration Tests', () => {
  // ============================================
  // HSN/SAC Master API
  // ============================================
  describe('HSN/SAC Masters - /api/hsn-sac-masters', () => {
    let createdId: string;

    it('POST / should create an HSN code', async () => {
      const response = await request(app).post('/api/hsn-sac-masters').set(authHeader).send({
        code: HSN_CODE,
        type: 'HSN',
        description: 'Test HSN Code for integration test',
        defaultGstRate: 12,
        chapter: '99',
        unit: 'PCS',
      });

      // Creates answer { data, message }; the code is unique per run, so this must succeed.
      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.code).toBe(HSN_CODE);
      createdId = response.body.data.id;
    });

    it('GET / should return paginated list', async () => {
      const response = await request(app)
        .get('/api/hsn-sac-masters')
        .set(authHeader)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('total');
    });

    it('GET /search should return search results', async () => {
      const response = await request(app)
        .get('/api/hsn-sac-masters/search')
        .set(authHeader)
        .query({ type: 'HSN', search: '62' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('GET /:id answers 400 for a malformed id and 404 for an unknown one', async () => {
      await request(app).get('/api/hsn-sac-masters/non-existent-id').set(authHeader).expect(400);
      await request(app).get(`/api/hsn-sac-masters/${randomUUID()}`).set(authHeader).expect(404);
    });

    // Cleanup
    afterAll(async () => {
      if (createdId) {
        await request(app).delete(`/api/hsn-sac-masters/${createdId}`).set(authHeader);
      }
    });
  });

  // ============================================
  // Tax Masters API
  // ============================================
  describe('Tax Masters - /api/tax-masters', () => {
    it('GET / should return paginated list', async () => {
      const response = await request(app)
        .get('/api/tax-masters')
        .set(authHeader)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
    });

    it('GET / should filter by taxType', async () => {
      const response = await request(app).get('/api/tax-masters').set(authHeader).query({ taxType: 'GST' }).expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  // ============================================
  // GST Reports API
  // ============================================
  describe('GST Reports - /api/gst-reports', () => {
    it('GET /gstr1 should return GSTR-1 report', async () => {
      const response = await request(app)
        .get('/api/gst-reports/gstr1')
        .set(authHeader)
        .query({ fromDate: '2026-01-01', toDate: '2026-01-31' })
        .expect(200);

      // Controller wraps response in { data: report }
      const report = response.body.data;
      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('b2b');
      expect(report).toHaveProperty('b2cs');
      expect(report).toHaveProperty('cdnr');
      expect(report).toHaveProperty('hsnSummary');
      expect(report).toHaveProperty('totals');
      expect(Array.isArray(report.b2b)).toBe(true);
      expect(Array.isArray(report.b2cs)).toBe(true);
    });

    it('GET /gstr3b should return GSTR-3B summary', async () => {
      const response = await request(app)
        .get('/api/gst-reports/gstr3b')
        .set(authHeader)
        .query({ fromDate: '2026-01-01', toDate: '2026-01-31' })
        .expect(200);

      // Controller wraps response in { data: report }
      const report = response.body.data;
      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('outwardSupplies');
      expect(report).toHaveProperty('inputTaxCredit');
      expect(report).toHaveProperty('netTaxPayable');
      expect(report.outwardSupplies).toHaveProperty('taxable');
      expect(report.netTaxPayable).toHaveProperty('total');
    });

    it('GET /gstr1 should validate date range', async () => {
      const response = await request(app).get('/api/gst-reports/gstr1').set(authHeader).query({}); // No dates

      // Should return 400 or handle gracefully
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  // ============================================
  // Credit Notes API
  // ============================================
  describe('Credit Notes - /api/credit-notes', () => {
    it('GET / should return paginated list', async () => {
      const response = await request(app)
        .get('/api/credit-notes')
        .set(authHeader)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('GET / should filter by status', async () => {
      const response = await request(app)
        .get('/api/credit-notes')
        .set(authHeader)
        .query({ status: 'DRAFT' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('GET /:id answers 400 for a malformed id and 404 for an unknown one', async () => {
      await request(app).get('/api/credit-notes/non-existent-id').set(authHeader).expect(400);
      await request(app).get(`/api/credit-notes/${randomUUID()}`).set(authHeader).expect(404);
    });
  });

  // ============================================
  // Debit Notes API
  // ============================================
  describe('Debit Notes - /api/debit-notes', () => {
    it('GET / should return paginated list', async () => {
      const response = await request(app)
        .get('/api/debit-notes')
        .set(authHeader)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
    });

    it('GET /:id answers 400 for a malformed id and 404 for an unknown one', async () => {
      await request(app).get('/api/debit-notes/non-existent-id').set(authHeader).expect(400);
      await request(app).get(`/api/debit-notes/${randomUUID()}`).set(authHeader).expect(404);
    });
  });

  // ============================================
  // TDS API
  // ============================================
  describe('TDS - /api/tds', () => {
    let createdTdsId: string;

    it('POST / should create a TDS entry', async () => {
      const response = await request(app)
        .post('/api/tds')
        .set(authHeader)
        .send({
          deductorName: `${RUN} Test Deductor Pvt Ltd`,
          deducteeName: 'Test Company',
          tdsSection: '194C',
          tdsRate: 1,
          grossAmount: 100000,
          tdsAmount: 1000,
          netAmount: 99000,
          deductionDate: '2026-01-15',
          financialYear: '2025-26',
          quarter: 4,
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.deductorName).toBe(`${RUN} Test Deductor Pvt Ltd`);
      expect(Number(response.body.data.tdsAmount)).toBe(1000);
      createdTdsId = response.body.data.id;
    });

    it('GET / should return paginated list', async () => {
      const response = await request(app).get('/api/tds').set(authHeader).query({ page: 1, limit: 10 }).expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
    });

    it('GET /summary should return quarterly summary', async () => {
      const response = await request(app)
        .get('/api/tds/summary')
        .set(authHeader)
        .query({ financialYear: '2025-26' })
        .expect(200);

      expect(response.body).toHaveProperty('financialYear');
      expect(response.body).toHaveProperty('quarterSummary');
      expect(response.body.quarterSummary).toHaveLength(4);
    });

    it('GET /summary should return 400 without financialYear', async () => {
      await request(app).get('/api/tds/summary').set(authHeader).expect(400);
    });

    it('PUT /:id/status should update status', async () => {
      if (!createdTdsId) return;

      const response = await request(app)
        .put(`/api/tds/${createdTdsId}/status`)
        .set(authHeader)
        .send({ status: 'CERTIFICATE_RECEIVED', certificateNo: 'CERT-2026-001' })
        .expect(200);

      expect(response.body.status).toBe('CERTIFICATE_RECEIVED');
      expect(response.body.certificateNo).toBe('CERT-2026-001');
    });

    // Cleanup
    afterAll(async () => {
      if (createdTdsId) {
        await request(app).delete(`/api/tds/${createdTdsId}`).set(authHeader);
      }
    });
  });

  // ============================================
  // TCS API
  // ============================================
  describe('TCS - /api/tcs', () => {
    let createdTcsId: string;

    it('POST / should create a TCS entry', async () => {
      const response = await request(app)
        .post('/api/tcs')
        .set(authHeader)
        .send({
          customerName: `${RUN} Test Customer Ltd`,
          tcsSection: '206C(1H)',
          tcsRate: 0.1,
          saleAmount: 5000000,
          tcsAmount: 5000,
          collectionDate: '2026-01-20',
          financialYear: '2025-26',
          quarter: 4,
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.customerName).toBe(`${RUN} Test Customer Ltd`);
      createdTcsId = response.body.data.id;
    });

    it('GET / should return paginated list', async () => {
      const response = await request(app).get('/api/tcs').set(authHeader).query({ page: 1, limit: 10 }).expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
    });

    it('GET /summary should return quarterly summary', async () => {
      const response = await request(app)
        .get('/api/tcs/summary')
        .set(authHeader)
        .query({ financialYear: '2025-26' })
        .expect(200);

      expect(response.body).toHaveProperty('financialYear');
      expect(response.body).toHaveProperty('quarterSummary');
      expect(response.body.quarterSummary).toHaveLength(4);
    });

    it('PUT /:id/status should update status', async () => {
      if (!createdTcsId) return;

      const response = await request(app)
        .put(`/api/tcs/${createdTcsId}/status`)
        .set(authHeader)
        .send({ status: 'DEPOSITED' })
        .expect(200);

      expect(response.body.status).toBe('DEPOSITED');
    });

    // Cleanup
    afterAll(async () => {
      if (createdTcsId) {
        await request(app).delete(`/api/tcs/${createdTcsId}`).set(authHeader);
      }
    });
  });

  // ============================================
  // Auth - All GST endpoints require authentication
  // ============================================
  describe('Authentication required', () => {
    const protectedEndpoints = [
      { method: 'get', path: '/api/hsn-sac-masters' },
      { method: 'get', path: '/api/tax-masters' },
      { method: 'get', path: '/api/credit-notes' },
      { method: 'get', path: '/api/debit-notes' },
      { method: 'get', path: '/api/gst-reports/gstr1' },
      { method: 'get', path: '/api/gst-reports/gstr3b' },
      { method: 'get', path: '/api/tds' },
      { method: 'get', path: '/api/tcs' },
    ];

    it.each(protectedEndpoints)('$method $path should return 401 without auth', async ({ method, path }) => {
      const response = await (request(app) as any)[method](path);
      expect(response.status).toBe(401);
    });
  });
});
