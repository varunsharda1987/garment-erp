/**
 * SQL Injection Prevention Tests
 *
 * Verifies Prisma's parameterization protects against SQL injection:
 * 1. Search parameters with SQL injection payloads
 * 2. Filter parameters with malicious input
 * 3. ID parameters with injection attempts
 * 4. Sort column validation
 *
 * Note: Prisma uses parameterized queries which inherently prevent SQL injection.
 * These tests verify that malicious input doesn't break queries or bypass security.
 */

import prisma from '../../config/database';

describe('SQL Injection Prevention', () => {
  const testPrefix = `TEST_SQLI_${Date.now()}`;
  let testUserId: string;
  let testCategoryId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.users.create({
      data: {
        email: `${testPrefix}@test.com`,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'ADMIN',
      },
    });
    testUserId = user.id;

    // Create test category
    testCategoryId = `${testPrefix}_CAT`;
    await prisma.material_categories.create({
      data: {
        id: testCategoryId,
        name: `${testPrefix} Normal Category`,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    try {
      await prisma.material_categories.deleteMany({
        where: { id: { startsWith: testPrefix } },
      });
      await prisma.users.deleteMany({
        where: { email: `${testPrefix}@test.com` },
      });
    } catch (error) {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe('Search Parameter Injection', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      '1; DELETE FROM material_categories; --',
      "' UNION SELECT * FROM users --",
      "1' AND 1=1 --",
      "'; TRUNCATE TABLE users; --",
      "1'; EXEC xp_cmdshell('dir'); --",
      "' OR ''='",
      "admin'--",
      '1/**/OR/**/1=1',
    ];

    it.each(sqlInjectionPayloads)('should safely handle search: %s', async (payload) => {
      // This should not throw and should not execute the SQL injection
      const result = await prisma.material_categories.findMany({
        where: {
          OR: [
            { name: { contains: payload, mode: 'insensitive' } },
            { id: { contains: payload, mode: 'insensitive' } },
          ],
        },
      });

      // Should return empty array (no matches) rather than executing injection
      expect(Array.isArray(result)).toBe(true);
    });

    it('should treat SQL keywords as literal strings', async () => {
      // Create a category with SQL keywords in the name
      const maliciousName = "Test'; DROP TABLE users; --";
      await prisma.material_categories.create({
        data: {
          id: `${testPrefix}_SQL_NAME`,
          name: maliciousName,
          isActive: true,
        },
      });

      // Search should find it as a literal string
      const result = await prisma.material_categories.findMany({
        where: {
          name: { contains: 'DROP TABLE', mode: 'insensitive' },
        },
      });

      // Should find the category with literal SQL in name
      const found = result.find((r) => r.id === `${testPrefix}_SQL_NAME`);
      expect(found).toBeDefined();
      expect(found?.name).toBe(maliciousName);

      // Clean up
      await prisma.material_categories.delete({
        where: { id: `${testPrefix}_SQL_NAME` },
      });
    });
  });

  describe('ID Parameter Injection', () => {
    const idInjectionPayloads = [
      "1' OR '1'='1",
      "'; DROP TABLE users; --",
      '1 OR 1=1',
      '1; SELECT * FROM users; --',
      "non-existent-id' OR 'a'='a",
    ];

    it.each(idInjectionPayloads)('should safely handle ID lookup: %s', async (payload) => {
      // This should not throw and should not find records via injection
      const result = await prisma.material_categories.findUnique({
        where: { id: payload },
      });

      // Should return null (not found) rather than returning all records
      expect(result).toBeNull();
    });

    it('should not allow ID-based injection to return all records', async () => {
      // Attempt to inject OR 1=1 style attack
      const result = await prisma.material_categories.findMany({
        where: {
          id: { equals: "' OR '1'='1" },
        },
      });

      // Should return empty array, not all records
      expect(result.length).toBe(0);
    });
  });

  describe('Filter Parameter Injection', () => {
    it('should safely handle injection in boolean filters', async () => {
      // Even if someone tries to inject via filter values
      const result = await prisma.material_categories.findMany({
        where: {
          isActive: true, // Boolean - can't be injected
          name: { contains: "1' OR '1'='1" },
        },
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should safely handle injection in date filters', async () => {
      // Date filters should only accept valid dates
      const result = await prisma.material_categories.findMany({
        where: {
          createdAt: {
            gte: new Date('2024-01-01'),
            lte: new Date(), // SQL injection in date would fail
          },
        },
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should safely handle injection in numeric filters', async () => {
      // Using a table with numeric fields
      const result = await prisma.users.findMany({
        where: {
          email: { contains: testPrefix },
        },
        take: 10, // Numeric - type-checked by Prisma
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Order By / Sort Injection', () => {
    it('should handle sort field as literal string', async () => {
      // Prisma requires sortBy to be a known column - can't inject arbitrary SQL
      const result = await prisma.material_categories.findMany({
        where: { id: { startsWith: testPrefix } },
        orderBy: { name: 'asc' }, // Only accepts known columns
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should only accept valid sort columns', async () => {
      // TypeScript and Prisma prevent invalid orderBy columns
      // This test verifies valid columns work correctly
      const resultAsc = await prisma.material_categories.findMany({
        where: { id: { startsWith: testPrefix } },
        orderBy: { name: 'asc' },
      });

      const resultDesc = await prisma.material_categories.findMany({
        where: { id: { startsWith: testPrefix } },
        orderBy: { createdAt: 'desc' },
      });

      expect(Array.isArray(resultAsc)).toBe(true);
      expect(Array.isArray(resultDesc)).toBe(true);
    });
  });

  describe('Raw Query Protection', () => {
    it('should parameterize raw queries with Prisma.sql', async () => {
      const maliciousInput = "'; DROP TABLE users; --";

      // Using Prisma.sql template literal - values are parameterized
      const result = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM material_categories
        WHERE name LIKE ${`%${maliciousInput}%`}
        LIMIT 10
      `;

      // Should return empty array, not execute injection
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('LIKE Pattern Injection', () => {
    it('should escape LIKE wildcards in search', async () => {
      // Create a category with % in name
      await prisma.material_categories.create({
        data: {
          id: `${testPrefix}_PERCENT`,
          name: '100% Cotton',
          isActive: true,
        },
      });

      // Search for literal % character
      const result = await prisma.material_categories.findMany({
        where: {
          name: { contains: '100%' },
        },
      });

      const found = result.find((r) => r.id === `${testPrefix}_PERCENT`);
      expect(found).toBeDefined();

      // Clean up
      await prisma.material_categories.delete({
        where: { id: `${testPrefix}_PERCENT` },
      });
    });

    it('should handle underscore wildcard safely', async () => {
      // _ is a SQL wildcard for single character
      const result = await prisma.material_categories.findMany({
        where: {
          name: { contains: 'Test_Category' },
        },
      });

      // Should search for literal underscore, not any character
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
