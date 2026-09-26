/**
 * master-supplier.helper — the supplier to plan a label / packaging line against, and its price.
 * The DB readers are exercised by integration/sizes-later-workflow.test.ts (MRP) and
 * integration/material-picker-label-suppliers.test.ts (PO picker).
 */
import {
  masterSupplierPrice,
  preferredMasterSupplierId,
  type MasterSupplierLink,
} from '../../services/helpers/master-supplier.helper';

const link = (supplierId: string, isPreferred: boolean, pricePerUnit: number | null = null): MasterSupplierLink => ({
  supplierId,
  isPreferred,
  pricePerUnit,
});

describe('preferredMasterSupplierId', () => {
  it('is the supplier marked preferred, wherever it sits', () => {
    expect(preferredMasterSupplierId([link('A', false), link('B', true)])).toBe('B');
  });
  it('is the only supplier when there is just one, preferred or not', () => {
    expect(preferredMasterSupplierId([link('A', false)])).toBe('A');
  });
  it('does not guess between several suppliers with none preferred', () => {
    expect(preferredMasterSupplierId([link('A', false), link('B', false)])).toBeNull();
  });
  it('is null with no suppliers', () => {
    expect(preferredMasterSupplierId([])).toBeNull();
    expect(preferredMasterSupplierId(undefined)).toBeNull();
  });
});

describe('masterSupplierPrice', () => {
  const links = [link('A', true, 0.6), link('B', false, null)];
  it("is that supplier's recorded price", () => {
    expect(masterSupplierPrice(links, 'A')).toBe(0.6);
  });
  it('is null when that supplier has no price, or is not a supplier of it', () => {
    expect(masterSupplierPrice(links, 'B')).toBeNull();
    expect(masterSupplierPrice(links, 'C')).toBeNull();
    expect(masterSupplierPrice(undefined, 'A')).toBeNull();
  });
});
