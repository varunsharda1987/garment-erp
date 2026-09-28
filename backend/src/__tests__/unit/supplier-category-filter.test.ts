/**
 * GET /api/suppliers?category= takes one category or a comma list meaning ANY of them.
 *
 * An Accessories PO (labels + packaging, 2026-09-28) asks for "TRIMS_SUPPLIER,PACKAGING_SUPPLIER": label
 * makers are tagged Trims suppliers, packaging makers Packaging suppliers. One value and the PROCESSOR
 * meta-category keep working as before.
 */

jest.mock('../../config/database', () => ({ __esModule: true, default: {} }));

import { supplierCategoryFilterList, supplierQuerySchema } from '../../schemas/supplier.schema';
import { supplierService } from '../../services/supplier.service';

describe('supplier list category filter', () => {
  it('validates each value of a comma list', () => {
    const ok = (category: string) => supplierQuerySchema.safeParse({ category }).success;
    expect(ok('TRIMS_SUPPLIER')).toBe(true);
    expect(ok('PROCESSOR')).toBe(true);
    expect(ok('TRIMS_SUPPLIER,PACKAGING_SUPPLIER')).toBe(true);
    expect(ok('TRIMS_SUPPLIER, PACKAGING_SUPPLIER')).toBe(true);
    expect(ok('TRIMS_SUPPLIER,NOT_A_CATEGORY')).toBe(false);
    expect(ok('ACCESSORIES')).toBe(false); // a PO category, not a supplier one
    expect(supplierQuerySchema.safeParse({}).success).toBe(true);
  });

  it('splits and trims, dropping blanks', () => {
    expect(supplierCategoryFilterList(' TRIMS_SUPPLIER ,, PACKAGING_SUPPLIER,')).toEqual([
      'TRIMS_SUPPLIER',
      'PACKAGING_SUPPLIER',
    ]);
  });

  it('asks for suppliers with ANY of the categories', async () => {
    const findAll = jest
      .spyOn(supplierService, 'findAll')
      .mockResolvedValue({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } } as never);

    await supplierService.findAllWithFilters({ page: 1, limit: 50, category: 'TRIMS_SUPPLIER,PACKAGING_SUPPLIER' });
    expect(findAll.mock.calls[0][1]).toEqual({
      supplierCategories: { hasSome: ['TRIMS_SUPPLIER', 'PACKAGING_SUPPLIER'] },
    });

    await supplierService.findAllWithFilters({ page: 1, limit: 50, category: 'GREIGE_SUPPLIER' });
    expect(findAll.mock.calls[1][1]).toEqual({ supplierCategories: { hasSome: ['GREIGE_SUPPLIER'] } });

    await supplierService.findAllWithFilters({ page: 1, limit: 50, category: 'PROCESSOR' });
    const processor = (findAll.mock.calls[2][1] as { supplierCategories: { hasSome: string[] } }).supplierCategories;
    expect(processor.hasSome).toEqual(expect.arrayContaining(['DYEING_PRINTING', 'EMBROIDERY', 'CMT_UNIT']));

    await supplierService.findAllWithFilters({ page: 1, limit: 50 });
    expect(findAll.mock.calls[3][1]).toEqual({});
  });
});
