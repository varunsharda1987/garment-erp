import { describe, it, expect } from 'vitest';
import { supplierStateCode } from '../supplier-state';
import type { Supplier } from '../../types/supplier.types';
import type { SupplierSummary } from '../../types/purchaseOrder.types';

/**
 * The PO form splits GST (CGST + SGST vs IGST) from this code, the server from `isInterstatePO`. They must
 * pick the same state in the same order, or the form and the saved PO tax one supplier two ways.
 */
const gstin = (stateCode: string, isPrimary: boolean) => ({ stateCode, isPrimary });

describe('supplierStateCode', () => {
  it("takes the primary GSTIN's state over any other GSTIN and the billing state", () => {
    expect(
      supplierStateCode({
        gstNumbers: [gstin('27', false), gstin('08', true)],
        billingState: { stateCode: '07' },
      })
    ).toBe('08');
  });

  it('falls back to any GSTIN when none is marked primary', () => {
    expect(supplierStateCode({ gstNumbers: [gstin('27', false)], billingState: { stateCode: '07' } })).toBe('27');
  });

  it('falls back to the billing state when the supplier has no GSTIN', () => {
    expect(supplierStateCode({ gstNumbers: [], billingState: { stateCode: '07' } })).toBe('07');
  });

  it('is null when nothing on file says where the supplier is (the form must warn, not assume quietly)', () => {
    expect(supplierStateCode({ gstNumbers: [], billingState: null })).toBeNull();
    expect(supplierStateCode({})).toBeNull();
    expect(supplierStateCode(null)).toBeNull();
    expect(supplierStateCode(undefined)).toBeNull();
  });

  it('skips a GSTIN row with a blank state code', () => {
    expect(supplierStateCode({ gstNumbers: [gstin(' ', true), gstin('08', false)] })).toBe('08');
  });

  it('reads GET /suppliers/:id as the API sends it', () => {
    // Trimmed from the live response for Fine Threads Fabric (2026-09-28)
    const supplier = {
      id: '68e8fcd3-2d67-4bb3-9a0d-d38cbe9a87f2',
      gstNumbers: [{ gstNumber: '08AAOHP1415L1ZV', stateName: 'Rajasthan', stateCode: '08', isPrimary: true }],
      billingState: { id: 'af3c1dbf', stateName: 'Rajasthan', stateCode: '08' },
    } as unknown as Supplier;
    expect(supplierStateCode(supplier)).toBe('08');
  });

  it("reads a loaded PO's supplier, whose billing state carries only its name", () => {
    const poSupplier = {
      id: 's1',
      code: 'SUP1',
      name: 'Mangal Textiles',
      contactPerson: null,
      email: null,
      phone: null,
      paymentTerms: null,
      billingState: { stateName: 'Rajasthan' },
      gstNumbers: [],
    } satisfies SupplierSummary;
    expect(supplierStateCode(poSupplier)).toBeNull();
  });
});
