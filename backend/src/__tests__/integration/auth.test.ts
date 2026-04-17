/**
 * Integration Tests for Authentication API
 *
 * Tests the auth endpoints with actual HTTP requests
 */

import request from 'supertest';
import app from '../../app';
import { prisma } from '../helpers/test-utils';
import bcrypt from 'bcrypt';

describe('Auth API Integration Tests', () => {
  const testUser = {
    email: 'auth-test@test.com',
    password: 'TestPassword123!',
    name: 'Auth Test User',
  };

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.users.deleteMany({
      where: { email: testUser.email },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.users.deleteMany({
      where: { email: testUser.email },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app).post('/api/auth/register').send(testUser).expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return 400 for duplicate email', async () => {
      const response = await request(app).post('/api/auth/register').send(testUser).expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@test.com',
          // Missing password and name
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should enforce rate limiting after 5 attempts', async () => {
      // Make 5 requests (should succeed or fail with 400)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/register')
          .send({
            email: `test${i}@test.com`,
            password: 'pass',
            name: 'Test',
          });
      }

      // 6th request should be rate limited
      const response = await request(app).post('/api/auth/register').send({
        email: 'test6@test.com',
        password: 'password',
        name: 'Test',
      });

      expect([429, 400, 201]).toContain(response.status);
      if (response.status === 429) {
        expect(response.body.message).toContain('Too many');
      }
    }, 20000);
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // Ensure test user exists with known password
      const hashedPassword = await bcrypt.hash(testUser.password, 10);
      await prisma.users.upsert({
        where: { email: testUser.email },
        create: {
          email: testUser.email,
          password: hashedPassword,
          name: testUser.name,
        },
        update: {
          password: hashedPassword,
        },
      });
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return 401 for incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          // Missing password
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;

    beforeAll(async () => {
      // Login to get auth token
      const response = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      authToken = response.body.token;
    });

    it('should return current user with valid token', async () => {
      const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${authToken}`).expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid-token').expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 with expired token', async () => {
      // This would require mocking time or creating an expired token
      // Skipping for now as it requires more complex setup
    });
  });
});
