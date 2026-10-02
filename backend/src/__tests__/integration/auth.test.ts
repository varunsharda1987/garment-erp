/**
 * Integration Tests for Authentication API
 *
 * Tests the auth endpoints with actual HTTP requests, against the auth flow as it is now:
 * self-registration creates an account PENDING admin approval (no token, role forced to a safe
 * default), login refuses an unapproved account with 403, and /me returns the user object itself.
 *
 * Runs against the LIVE database, so every account it touches carries a per-run email and is
 * deleted afterwards. (The previous version registered test0…test6@test.com in a rate-limit loop
 * and never removed them; the limiter allows 100 attempts outside production, so that loop proved
 * nothing — it is gone.)
 */

import request from 'supertest';
import app from '../../app';
import { prisma } from '../helpers/test-utils';

const RUN = `auth${Date.now().toString(36)}`;
const only = (id: string | undefined) => id ?? '__unset__';

describe('Auth API Integration Tests', () => {
  const testUser = {
    email: `${RUN}@auth.test`,
    password: 'TestPassword123!',
    firstName: 'Auth',
    lastName: 'Tester',
  };
  let userId: string | undefined;

  afterAll(async () => {
    const users = await prisma.users.findMany({ where: { email: { endsWith: '@auth.test', startsWith: RUN } } });
    const ids = users.map((u) => u.id);
    if (ids.length > 0) {
      await prisma.refresh_tokens.deleteMany({ where: { userId: { in: ids } } });
      await prisma.users.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('registers a new account pending admin approval — no token is issued', async () => {
      const response = await request(app).post('/api/auth/register').send(testUser).expect(201);

      expect(response.body).not.toHaveProperty('token');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.isApproved).toBe(false);
      expect(response.body.user).not.toHaveProperty('password');
      userId = response.body.user.id;
    });

    it('ignores a caller-supplied role (no self-service ADMIN)', async () => {
      const stored = await prisma.users.findUnique({ where: { id: only(userId) } });
      expect(stored?.role).not.toBe('ADMIN');

      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: `${RUN}-role@auth.test`, role: 'ADMIN' })
        .expect(201);
      expect(response.body.user.role).not.toBe('ADMIN');
    });

    it('returns 409 for a duplicate email', async () => {
      const response = await request(app).post('/api/auth/register').send(testUser).expect(409);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 400 for an invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'invalid-email' })
        .expect(400);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 400 for a weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: `${RUN}-weak@auth.test`, password: 'password' })
        .expect(400);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: `${RUN}-missing@auth.test` })
        .expect(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('refuses an account that is still pending approval (403)', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(403);
      expect(response.body.message).toContain('pending admin approval');
    });

    it('logs in once an admin has approved the account', async () => {
      await prisma.users.update({ where: { id: only(userId) }, data: { isApproved: true } });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('password');
      expect(Array.isArray(response.body.user.permissions)).toBe(true);
    });

    it('returns 401 for an incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword123!' })
        .expect(401);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 401 for a non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: `${RUN}-nobody@auth.test`, password: 'Password123!' })
        .expect(401);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 400 for missing credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({ email: testUser.email }).expect(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      authToken = response.body.token;
    });

    it('returns the current user (the object itself, with permissions) for a valid token', async () => {
      const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${authToken}`).expect(200);

      expect(response.body.email).toBe(testUser.email);
      expect(response.body).not.toHaveProperty('password');
      expect(Array.isArray(response.body.permissions)).toBe(true);
    });

    it('returns 401 without a token', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);
      expect(response.body).toHaveProperty('error');
    });

    it('returns 403 "Invalid or expired token" for a token that does not verify', async () => {
      // 403, not 401, is the contract: frontend/src/lib/api.ts treats a 403 whose message mentions
      // the token as an auth error and signs the user out. Changing either side breaks the other.
      const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid-token').expect(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toBe('Invalid or expired token');
    });
  });
});
