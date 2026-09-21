import request from 'supertest';
import app from '../../app';
import prisma from '../../config/database';
import { getAuthHeader } from '../helpers/test-utils';

/**
 * The permission contract for company_profile: reads OPEN, writes admin-only.
 *
 * Deliberately not the router-wide requireAdmin() that Tally/e-Invoice use — those hold
 * secrets, whereas this is the letterhead every Purchase Order screen renders. If reads were
 * admin-gated, every non-admin's letterhead would 403 into a permanent fallback.
 */
describe('company_profile permissions — reads open, writes admin-only', () => {
  let merchandiser: Record<string, string>;
  let admin: Record<string, string>;
  let defaultId: string;

  beforeAll(async () => {
    // isApproved matters: the users table carries leaked test fixtures (TEST_*@test.com) that
    // are active but unapproved, and authenticateToken rejects those with a 401 — which reads
    // exactly like a broken permission rule.
    const m = await prisma.users.findFirst({ where: { role: 'MERCHANDISER', isActive: true, isApproved: true } });
    const a = await prisma.users.findFirst({ where: { role: 'ADMIN', isActive: true, isApproved: true } });
    merchandiser = getAuthHeader(m!.id, 'MERCHANDISER');
    admin = getAuthHeader(a!.id, 'ADMIN');
    const row = await prisma.company_profile.findFirst({ where: { isDefault: true } });
    defaultId = row!.id;
  });

  it('a MERCHANDISER can READ the default entity (the PO letterhead depends on it)', async () => {
    const res = await request(app).get('/api/company-profiles/default').set(merchandiser).expect(200);
    expect((res.body.data ?? res.body).gstin).toBeTruthy();
  });

  it('a MERCHANDISER cannot WRITE it', async () => {
    await request(app).put(`/api/company-profiles/${defaultId}`).set(merchandiser).send({ name: 'NOPE' }).expect(403);
  });

  it('a MERCHANDISER cannot switch the default entity', async () => {
    await request(app).post(`/api/company-profiles/${defaultId}/set-default`).set(merchandiser).send({}).expect(403);
  });

  it('an ADMIN can write', async () => {
    const before = await prisma.company_profile.findUnique({ where: { id: defaultId } });
    await request(app)
      .put(`/api/company-profiles/${defaultId}`)
      .set(admin)
      .send({ tagline: before!.tagline })
      .expect(200);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
