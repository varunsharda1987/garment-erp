/**
 * Currency Utility Unit Tests
 */

import {
  toCurrency,
  formatCurrency,
  toNumber,
  addCurrency,
  subtractCurrency,
  multiplyCurrency,
  divideCurrency,
  percentOf,
  roundToCent,
  compareCurrency,
  isZero,
  isNegative,
  calculateTotal,
  calculatePriceWithTax,
  calculateDiscount,
  calculatePriceAfterDiscount,
  calculateWeightedAverageCost,
  sumByField,
  Decimal,
} from '../../utils/currency';

describe('Currency Utility', () => {
  describe('toCurrency', () => {
    it('should convert string to Decimal', () => {
      expect(toCurrency('123.45').toString()).toBe('123.45');
    });

    it('should convert number to Decimal', () => {
      expect(toCurrency(123.45).toString()).toBe('123.45');
    });

    it('should return 0 for null/undefined', () => {
      expect(toCurrency(null).toString()).toBe('0');
      expect(toCurrency(undefined).toString()).toBe('0');
    });

    it('should return 0 for empty string', () => {
      expect(toCurrency('').toString()).toBe('0');
    });

    it('should return 0 for invalid string', () => {
      expect(toCurrency('invalid').toString()).toBe('0');
    });
  });

  describe('formatCurrency', () => {
    it('should format to 2 decimal places by default', () => {
      expect(formatCurrency(new Decimal(123.456))).toBe('123.46');
    });

    it('should format to specified decimal places', () => {
      expect(formatCurrency(new Decimal(123.456), 3)).toBe('123.456');
    });

    it('should handle number input', () => {
      expect(formatCurrency(123.456)).toBe('123.46');
    });
  });

  describe('toNumber', () => {
    it('should convert Decimal to number', () => {
      expect(toNumber(new Decimal('123.45'))).toBe(123.45);
    });
  });

  describe('addCurrency', () => {
    it('should add multiple values', () => {
      const result = addCurrency(10, 20, 30);
      expect(result.toString()).toBe('60');
    });

    it('should handle null/undefined values', () => {
      const result = addCurrency(10, null, 20, undefined);
      expect(result.toString()).toBe('30');
    });

    it('should handle floating point correctly', () => {
      // 0.1 + 0.2 in JS is 0.30000000000000004
      const result = addCurrency(0.1, 0.2);
      expect(result.toString()).toBe('0.3');
    });
  });

  describe('subtractCurrency', () => {
    it('should subtract values correctly', () => {
      const result = subtractCurrency(100, 30, 20);
      expect(result.toString()).toBe('50');
    });

    it('should handle negative results', () => {
      const result = subtractCurrency(10, 30);
      expect(result.toString()).toBe('-20');
    });
  });

  describe('multiplyCurrency', () => {
    it('should multiply values correctly', () => {
      const result = multiplyCurrency(10, 5);
      expect(result.toString()).toBe('50');
    });

    it('should handle decimal multiplication', () => {
      const result = multiplyCurrency(10.5, 2);
      expect(result.toString()).toBe('21');
    });
  });

  describe('divideCurrency', () => {
    it('should divide values correctly', () => {
      const result = divideCurrency(100, 4);
      expect(result.toString()).toBe('25');
    });

    it('should return 0 when dividing by zero', () => {
      const result = divideCurrency(100, 0);
      expect(result.toString()).toBe('0');
    });
  });

  describe('percentOf', () => {
    it('should calculate percentage correctly', () => {
      const result = percentOf(200, 10);
      expect(result.toString()).toBe('20');
    });

    it('should handle decimal percentages', () => {
      const result = percentOf(100, 12.5);
      expect(result.toString()).toBe('12.5');
    });
  });

  describe('roundToCent', () => {
    it('should round to 2 decimal places', () => {
      expect(roundToCent(new Decimal('123.456')).toString()).toBe('123.46');
      expect(roundToCent(new Decimal('123.454')).toString()).toBe('123.45');
    });

    it('should handle number input', () => {
      expect(roundToCent(123.456).toString()).toBe('123.46');
    });
  });

  describe('compareCurrency', () => {
    it('should return -1 when a < b', () => {
      expect(compareCurrency(10, 20)).toBe(-1);
    });

    it('should return 0 when a == b', () => {
      expect(compareCurrency(10, 10)).toBe(0);
    });

    it('should return 1 when a > b', () => {
      expect(compareCurrency(20, 10)).toBe(1);
    });
  });

  describe('isZero', () => {
    it('should return true for zero', () => {
      expect(isZero(0)).toBe(true);
      expect(isZero('0')).toBe(true);
      expect(isZero(null)).toBe(true);
    });

    it('should return false for non-zero', () => {
      expect(isZero(10)).toBe(false);
      expect(isZero(-5)).toBe(false);
    });
  });

  describe('isNegative', () => {
    it('should return true for negative', () => {
      expect(isNegative(-10)).toBe(true);
      expect(isNegative('-5')).toBe(true);
    });

    it('should return false for positive or zero', () => {
      expect(isNegative(10)).toBe(false);
      expect(isNegative(0)).toBe(false);
    });
  });

  describe('calculateTotal', () => {
    it('should calculate total correctly', () => {
      const result = calculateTotal(5, 10.5);
      expect(result.toString()).toBe('52.5');
    });
  });

  describe('calculatePriceWithTax', () => {
    it('should add tax correctly', () => {
      const result = calculatePriceWithTax(100, 18);
      expect(result.toString()).toBe('118');
    });

    it('should handle decimal tax rate', () => {
      const result = calculatePriceWithTax(100, 12.5);
      expect(result.toString()).toBe('112.5');
    });
  });

  describe('calculateDiscount', () => {
    it('should calculate discount amount', () => {
      const result = calculateDiscount(100, 20);
      expect(result.toString()).toBe('20');
    });
  });

  describe('calculatePriceAfterDiscount', () => {
    it('should calculate final price after discount', () => {
      const result = calculatePriceAfterDiscount(100, 20);
      expect(result.toString()).toBe('80');
    });
  });

  describe('calculateWeightedAverageCost', () => {
    it('should calculate WAC correctly', () => {
      // 10 units at $5 + 5 units at $8 = (50 + 40) / 15 = 6
      const result = calculateWeightedAverageCost(10, 5, 5, 8);
      expect(result.toString()).toBe('6');
    });

    it('should return 0 when total quantity is 0', () => {
      const result = calculateWeightedAverageCost(0, 5, 0, 8);
      expect(result.toString()).toBe('0');
    });
  });

  describe('sumByField', () => {
    it('should sum values by field', () => {
      const items = [
        { name: 'A', amount: 100 },
        { name: 'B', amount: 200 },
        { name: 'C', amount: 300 },
      ];
      const result = sumByField(items, 'amount');
      expect(result.toString()).toBe('600');
    });

    it('should handle empty array', () => {
      const result = sumByField([], 'amount');
      expect(result.toString()).toBe('0');
    });
  });
});
