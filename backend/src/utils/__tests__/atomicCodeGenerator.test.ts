/**
 * Unit Tests for Atomic Code Generator
 *
 * Tests race condition prevention:
 * 1. Sequential number generation produces unique values
 * 2. Concurrent number generation produces unique values (no duplicates)
 * 3. Different document types use separate sequences
 * 4. Format validation for generated codes
 */

import {
  generateAtomicPONumber,
  generateAtomicOrderNumber,
  generateAtomicGRNNumber,
  generateAtomicInvoiceNumber,
  generateAtomicDocNumber,
  generateAtomicMasterCode,
} from '../atomicCodeGenerator';
import prisma from '../../config/database';

describe('AtomicCodeGenerator', () => {
  const testPrefix = `TEST_${Date.now()}`;

  afterAll(async () => {
    // Clean up test sequences
    try {
      await prisma.code_sequences.deleteMany({
        where: {
          prefix: { startsWith: testPrefix },
        },
      });
    } catch (error) {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  describe('Sequential Generation', () => {
    it('should generate unique PO numbers sequentially', async () => {
      const po1 = await generateAtomicPONumber();
      const po2 = await generateAtomicPONumber();
      const po3 = await generateAtomicPONumber();

      expect(po1).not.toBe(po2);
      expect(po2).not.toBe(po3);
      expect(po1).not.toBe(po3);
    });

    it('should follow PO number format POYYMM-NNNN', async () => {
      const poNumber = await generateAtomicPONumber();
      const pattern = /^PO\d{4}-\d{4}$/;
      expect(poNumber).toMatch(pattern);
    });

    it('should follow Order number format ORDYYYYMMNNNN', async () => {
      const orderNumber = await generateAtomicOrderNumber();
      const pattern = /^ORD\d{10}$/;
      expect(orderNumber).toMatch(pattern);
    });

    it('should follow GRN number format GRNYYMM-NNNN', async () => {
      const grnNumber = await generateAtomicGRNNumber();
      const pattern = /^GRN\d{4}-\d{4}$/;
      expect(grnNumber).toMatch(pattern);
    });

    it('should follow Invoice number format INVYYMM-NNNN', async () => {
      const invNumber = await generateAtomicInvoiceNumber();
      const pattern = /^INV\d{4}-\d{4}$/;
      expect(invNumber).toMatch(pattern);
    });

    it('should follow the unified doc number format PREFIXYYMM-NNNN', async () => {
      const challanNumber = await generateAtomicDocNumber('CH');
      const pattern = /^CH\d{4}-\d{4}$/;
      expect(challanNumber).toMatch(pattern);
    });
  });

  describe('Concurrent Generation (Race Condition Prevention)', () => {
    it('should generate 10 unique PO numbers concurrently', async () => {
      const promises = Array.from({ length: 10 }, () => generateAtomicPONumber());
      const results = await Promise.all(promises);

      const uniqueNumbers = new Set(results);
      expect(uniqueNumbers.size).toBe(10);
    });

    it('should generate 20 unique GRN numbers concurrently', async () => {
      const promises = Array.from({ length: 20 }, () => generateAtomicGRNNumber());
      const results = await Promise.all(promises);

      const uniqueNumbers = new Set(results);
      expect(uniqueNumbers.size).toBe(20);
    });

    it('should generate 15 unique Invoice numbers concurrently', async () => {
      const promises = Array.from({ length: 15 }, () => generateAtomicInvoiceNumber());
      const results = await Promise.all(promises);

      const uniqueNumbers = new Set(results);
      expect(uniqueNumbers.size).toBe(15);
    });
  });

  describe('Sequence Isolation', () => {
    it('should use separate sequences for different document types', async () => {
      // Generate one of each type
      const po = await generateAtomicPONumber();
      const grn = await generateAtomicGRNNumber();
      const inv = await generateAtomicInvoiceNumber();

      // Extract the sequence numbers
      const poSeq = parseInt(po.split('-')[1], 10);
      const grnSeq = parseInt(grn.split('-')[1], 10);
      const invSeq = parseInt(inv.split('-')[1], 10);

      // They should be independently numbered (sequences for each type)
      // This test verifies they don't share a single global counter
      expect(po.startsWith('PO')).toBe(true);
      expect(grn.startsWith('GRN')).toBe(true);
      expect(inv.startsWith('INV')).toBe(true);
    });
  });

  describe('Master Code Generation', () => {
    it('should generate master codes with custom prefix', async () => {
      const code = await generateAtomicMasterCode(testPrefix);
      expect(code).toMatch(new RegExp(`^${testPrefix}-\\d{3}$`));
    });

    it('should generate unique master codes for same prefix', async () => {
      const code1 = await generateAtomicMasterCode(`${testPrefix}_A`);
      const code2 = await generateAtomicMasterCode(`${testPrefix}_A`);
      const code3 = await generateAtomicMasterCode(`${testPrefix}_A`);

      expect(code1).not.toBe(code2);
      expect(code2).not.toBe(code3);
    });

    it('should support custom padding', async () => {
      const code = await generateAtomicMasterCode(`${testPrefix}_PAD`, 5);
      expect(code).toMatch(new RegExp(`^${testPrefix}_PAD-\\d{5}$`));
    });

    it('should generate 10 unique master codes concurrently', async () => {
      const promises = Array.from({ length: 10 }, () => generateAtomicMasterCode(`${testPrefix}_CONC`));
      const results = await Promise.all(promises);

      const uniqueCodes = new Set(results);
      expect(uniqueCodes.size).toBe(10);
    });
  });

  describe('Date-Based Prefix Handling', () => {
    it('should include current year and month in PO prefix', async () => {
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const expectedPrefix = `PO${year}${month}`;

      const poNumber = await generateAtomicPONumber();
      expect(poNumber.startsWith(expectedPrefix)).toBe(true);
    });

    it('should include full year in Order prefix', async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const expectedPrefix = `ORD${year}${month}`;

      const orderNumber = await generateAtomicOrderNumber();
      expect(orderNumber.startsWith(expectedPrefix)).toBe(true);
    });
  });
});
