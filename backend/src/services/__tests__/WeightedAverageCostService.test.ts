/**
 * Unit Tests for WeightedAverageCostService
 *
 * Tests the weighted average cost calculation logic
 */

import { WeightedAverageCostService } from '../WeightedAverageCostService';

describe('WeightedAverageCostService', () => {
  describe('calculateWeightedAverageCost', () => {
    it('should calculate correct weighted average for simple case', () => {
      const transactions = [
        { quantity: 100, unitCost: 10 }, // Total: 1000
        { quantity: 50, unitCost: 12 },  // Total: 600
      ];

      const result = WeightedAverageCostService.calculateWeightedAverageCost(transactions);

      // Expected: (1000 + 600) / (100 + 50) = 1600 / 150 = 10.67
      expect(result).toBeCloseTo(10.67, 2);
    });

    it('should return 0 for empty transactions', () => {
      const result = WeightedAverageCostService.calculateWeightedAverageCost([]);
      expect(result).toBe(0);
    });

    it('should handle single transaction', () => {
      const transactions = [{ quantity: 100, unitCost: 15 }];
      const result = WeightedAverageCostService.calculateWeightedAverageCost(transactions);
      expect(result).toBe(15);
    });

    it('should handle zero quantity correctly', () => {
      const transactions = [
        { quantity: 0, unitCost: 10 },
        { quantity: 100, unitCost: 20 },
      ];

      const result = WeightedAverageCostService.calculateWeightedAverageCost(transactions);
      expect(result).toBe(20);
    });

    it('should handle decimal quantities and costs', () => {
      const transactions = [
        { quantity: 10.5, unitCost: 12.75 },
        { quantity: 5.25, unitCost: 15.50 },
      ];

      const result = WeightedAverageCostService.calculateWeightedAverageCost(transactions);

      // Expected: (10.5 * 12.75 + 5.25 * 15.50) / (10.5 + 5.25)
      // = (133.875 + 81.375) / 15.75
      // = 215.25 / 15.75 = 13.67
      expect(result).toBeCloseTo(13.67, 2);
    });

    it('should handle negative costs (returns/adjustments)', () => {
      const transactions = [
        { quantity: 100, unitCost: 20 },
        { quantity: -10, unitCost: 20 }, // Return
      ];

      const result = WeightedAverageCostService.calculateWeightedAverageCost(transactions);

      // Expected: (100 * 20 + (-10) * 20) / (100 - 10)
      // = (2000 - 200) / 90 = 1800 / 90 = 20
      expect(result).toBe(20);
    });

    it('should round to 2 decimal places', () => {
      const transactions = [
        { quantity: 3, unitCost: 10 },
        { quantity: 7, unitCost: 11 },
      ];

      const result = WeightedAverageCostService.calculateWeightedAverageCost(transactions);

      // Expected: (30 + 77) / 10 = 10.7
      expect(result).toBe(10.7);
      expect(Number.isInteger(result * 100)).toBe(true); // Max 2 decimals
    });
  });

  describe('calculateNewAverageCost', () => {
    it('should calculate new average after purchase', () => {
      const currentQty = 100;
      const currentAvgCost = 10;
      const newQty = 50;
      const newCost = 12;

      const result = WeightedAverageCostService.calculateNewAverageCost(
        currentQty,
        currentAvgCost,
        newQty,
        newCost
      );

      // Expected: (100 * 10 + 50 * 12) / 150 = 1600 / 150 = 10.67
      expect(result).toBeCloseTo(10.67, 2);
    });

    it('should handle zero current quantity (first purchase)', () => {
      const result = WeightedAverageCostService.calculateNewAverageCost(0, 0, 100, 15);
      expect(result).toBe(15);
    });

    it('should handle zero new quantity (no change)', () => {
      const result = WeightedAverageCostService.calculateNewAverageCost(100, 10, 0, 15);
      expect(result).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('should handle very large numbers', () => {
      const transactions = [
        { quantity: 1000000, unitCost: 100 },
        { quantity: 500000, unitCost: 120 },
      ];

      const result = WeightedAverageCostService.calculateWeightedAverageCost(transactions);
      expect(result).toBeCloseTo(106.67, 2);
    });

    it('should handle very small numbers', () => {
      const transactions = [
        { quantity: 0.01, unitCost: 0.05 },
        { quantity: 0.02, unitCost: 0.08 },
      ];

      const result = WeightedAverageCostService.calculateWeightedAverageCost(transactions);
      expect(result).toBeCloseTo(0.07, 2);
    });
  });
});
