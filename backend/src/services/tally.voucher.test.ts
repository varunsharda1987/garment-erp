/**
 * Tally Voucher Builder Tests
 *
 * Tests the XML builders for sales vouchers and credit notes.
 * Key regressions to prevent:
 * 1. Sign convention (Dr = negative, Cr = positive)
 * 2. GST rate routing (18% vs 5% based on full rate, not cgstRate alone)
 * 3. Inventory nesting (sales ledger inside ACCOUNTINGALLOCATIONS, not top-level)
 * 4. Balance assertion (party total = sum of credits)
 *
 * Ported from kasya-b2b-sales tally.voucher.test.ts
 */

// Pure XML-builder tests: they never touch the DB, but importing tally.service opens a real Prisma
// client, which keeps the Jest worker alive. (The logger is already mocked globally in
// src/__tests__/setup.ts — do not re-mock it here; a local mock without __esModule/default is the
// documented cause of "logger.info is not a function" 500s.)
jest.mock('../config/database', () => ({ __esModule: true, default: {} }));

import { buildSalesVoucherXml, InvoiceForTally } from './tally.service';
import type { TallySettings } from './tally-settings.service';

const mockSettings: TallySettings = {
  id: 'singleton',
  tallyEnabled: true,
  tallyHost: 'localhost',
  tallyPort: 9000,
  tallyCompanyName: 'Test Company',
  tallyVoucherType: 'Sales',
  tallyPartyGroup: 'Sundry Debtors',
  tallyGodownName: 'Main Location',
  tallyStockUnit: 'Pcs',
  tallySalesLedgerIntra: 'Sales @5%',
  tallySalesLedgerInter: 'Interstate Sales @5%',
  tallyCgstLedger: 'Output CGST @2.5%',
  tallySgstLedger: 'Output SGST @2.5%',
  tallyIgstLedger: 'Output IGST @5%',
  tallyCgstLedger18: 'Output CGST @9%',
  tallySgstLedger18: 'Output SGST @9%',
  tallyIgstLedger18: 'Output IGST @18%',
  tallyRoundOffLedger: 'Round Off',
  tallyFreightLedger: 'Freight Income',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makeInvoice = (overrides: Partial<InvoiceForTally> = {}): InvoiceForTally => ({
  id: 'inv-123',
  invoiceNumber: 'INV/26-27/001',
  invoiceDate: new Date('2026-07-15'),
  customerId: 'cust-1',
  isInterstate: false,
  subtotal: 1000,
  cgstAmount: 25,
  sgstAmount: 25,
  igstAmount: 0,
  totalAmount: 1050,
  customers: {
    name: 'Test Customer',
    tallyLedgerName: 'Test Customer Ledger',
    billingAddress: '123 Test St',
    billingStateId: 'RJ',
    billingState: { name: 'Rajasthan', stateCode: '08' },
  },
  invoice_items: [
    {
      description: 'Test Item',
      hsnCode: '62081910',
      quantity: 2,
      unitPrice: 500,
      totalPrice: 1000,
      gstRate: 5,
      cgstRate: 2.5,
      cgstAmount: 25,
      sgstRate: 2.5,
      sgstAmount: 25,
      igstRate: null,
      igstAmount: null,
    },
  ],
  ...overrides,
});

describe('buildSalesVoucherXml', () => {
  it('builds XML with correct REMOTEID', () => {
    const invoice = makeInvoice();
    const xml = buildSalesVoucherXml(invoice, mockSettings, 'Create');

    expect(xml).toContain('REMOTEID="KF-INV-inv-123"');
  });

  it('uses correct voucher type and date format', () => {
    const invoice = makeInvoice();
    const xml = buildSalesVoucherXml(invoice, mockSettings, 'Create');

    expect(xml).toContain('<VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>');
    expect(xml).toContain('<DATE>20260715</DATE>');
    expect(xml).toContain('<VOUCHERNUMBER>INV/26-27/001</VOUCHERNUMBER>');
  });

  it('uses intra-state sales ledger for same-state invoices', () => {
    const invoice = makeInvoice({ isInterstate: false });
    const xml = buildSalesVoucherXml(invoice, mockSettings, 'Create');

    expect(xml).toContain('Sales @5%'); // intra-state ledger
    expect(xml).not.toContain('Interstate Sales');
  });

  it('uses inter-state sales ledger for interstate invoices', () => {
    const invoice = makeInvoice({
      isInterstate: true,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 50,
      invoice_items: [
        {
          description: 'Test Item',
          hsnCode: '62081910',
          quantity: 2,
          unitPrice: 500,
          totalPrice: 1000,
          gstRate: 5,
          cgstRate: null,
          cgstAmount: null,
          sgstRate: null,
          sgstAmount: null,
          igstRate: 5,
          igstAmount: 50,
        },
      ],
    });
    const xml = buildSalesVoucherXml(invoice, mockSettings, 'Create');

    expect(xml).toContain('Interstate Sales @5%');
  });

  it('routes 18% GST to the 18% ledgers (not 5%)', () => {
    // This was a real bug: IGST invoices had null cgstRate, so cgstRate >= 9 was always false
    const invoice = makeInvoice({
      isInterstate: true,
      subtotal: 3000,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 540, // 18% of 3000
      totalAmount: 3540,
      invoice_items: [
        {
          description: 'Expensive Item',
          hsnCode: '62081910',
          quantity: 1,
          unitPrice: 3000, // > 2500, so 18%
          totalPrice: 3000,
          gstRate: 18,
          cgstRate: null,
          cgstAmount: null,
          sgstRate: null,
          sgstAmount: null,
          igstRate: 18,
          igstAmount: 540,
        },
      ],
    });
    const xml = buildSalesVoucherXml(invoice, mockSettings, 'Create');

    // Must use 18% ledger, not 5%
    expect(xml).toContain('Output IGST @18%');
    expect(xml).not.toContain('Output IGST @5%');
  });

  it('includes COUNTRYOFRESIDENCE (not COUNTRYNAME)', () => {
    const invoice = makeInvoice();
    const xml = buildSalesVoucherXml(invoice, mockSettings, 'Create');

    expect(xml).toContain('<COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>');
    expect(xml).not.toContain('<COUNTRYNAME>');
  });

  it('throws on missing customer ledger link', () => {
    const invoice = makeInvoice({
      customers: {
        ...makeInvoice().customers,
        tallyLedgerName: null,
      },
    });

    expect(() => buildSalesVoucherXml(invoice, mockSettings, 'Create')).toThrow(/linked Tally ledger/);
  });

  it('embeds e-invoice IRN when present', () => {
    const invoice = makeInvoice({
      eInvoiceIrn: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567abc890def12',
      eInvoiceAckNo: '123456789012345',
      eInvoiceAckDate: new Date('2026-07-16'),
      eInvoiceStatus: 'GENERATED',
    });
    const xml = buildSalesVoucherXml(invoice, mockSettings, 'Create');

    expect(xml).toContain('<IRN>abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567abc890def12</IRN>');
    expect(xml).toContain('<IRNACKNO>123456789012345</IRNACKNO>');
    expect(xml).toContain('<IRNACKDATE>20260716</IRNACKDATE>');
  });

  it('omits IRN block when e-invoice not generated', () => {
    const invoice = makeInvoice({ eInvoiceStatus: 'PENDING' });
    const xml = buildSalesVoucherXml(invoice, mockSettings, 'Create');

    expect(xml).not.toContain('<IRN>');
  });
});

describe('Balance assertion', () => {
  it('accepts a voucher whose party debit equals its credits', () => {
    // 1000 sales + 25 CGST + 25 SGST = 1050 party debit.
    expect(() => buildSalesVoucherXml(makeInvoice(), mockSettings, 'Create')).not.toThrow();
  });

  it('refuses a header total the lines do not support', () => {
    // Header claims 9999 but the lines add up to 1050. Round-off is a residual, so without a
    // bound this would post an 8,949 "round-off" and balance perfectly.
    const invoice = makeInvoice({ totalAmount: 9999 });

    expect(() => buildSalesVoucherXml(invoice, mockSettings, 'Create')).toThrow(/round-off out of range/);
  });

  it('names the real numbers in the error so the bad figure is obvious', () => {
    const invoice = makeInvoice({ totalAmount: 9999 });

    expect(() => buildSalesVoucherXml(invoice, mockSettings, 'Create')).toThrow(
      /Billed total 9999\.00 does not match the line amounts 1050\.00/
    );
  });

  it('allows a genuine rounding of up to a rupee', () => {
    // Lines total 1050.40, billed at 1050 — a normal nearest-rupee round-off of -0.40.
    const invoice = makeInvoice({
      subtotal: 1000.4,
      totalAmount: 1050,
      invoice_items: [{ ...makeInvoice().invoice_items[0], totalPrice: 1000.4 }],
    });

    expect(() => buildSalesVoucherXml(invoice, mockSettings, 'Create')).not.toThrow();
  });

  it('catches GST posted with no matching sales line', () => {
    // The balance assertion (not the round-off bound) is what fires here: the header carries tax
    // for a line that posts nothing, so the emitted credits fall short of the party debit.
    const base = makeInvoice();
    const invoice = makeInvoice({
      cgstAmount: 50, // header counts the zero-qty line's tax
      sgstAmount: 50,
      totalAmount: 1100,
      invoice_items: [
        base.invoice_items[0],
        { ...base.invoice_items[0], description: 'Cancelled', quantity: 0, totalPrice: 0 },
      ],
    });

    expect(() => buildSalesVoucherXml(invoice, mockSettings, 'Create')).toThrow(/does not balance/);
  });

  it('absorbs sub-paisa drift through the round-off line', () => {
    // Lines sum to 1050.004; the invoice is billed at 1050.00. The round-off line takes the
    // difference and the voucher still balances.
    const invoice = makeInvoice({
      subtotal: 1000.004,
      totalAmount: 1050,
      invoice_items: [{ ...makeInvoice().invoice_items[0], totalPrice: 1000.004 }],
    });

    expect(() => buildSalesVoucherXml(invoice, mockSettings, 'Create')).not.toThrow();
  });
});

describe('Zero-quantity lines', () => {
  it('posts no stock line and no GST for a zero-qty item', () => {
    // A zero-qty line used to contribute GST with no matching sales credit, which makes the
    // voucher unbalanced and Tally rejects it with an unhelpful error.
    const base = makeInvoice();
    const invoice = makeInvoice({
      invoice_items: [
        base.invoice_items[0],
        {
          description: 'Cancelled Line',
          hsnCode: '62081910',
          quantity: 0,
          unitPrice: 500,
          totalPrice: 0,
          gstRate: 5,
          cgstRate: 2.5,
          cgstAmount: 25, // tax present on a line that ships nothing
          sgstRate: 2.5,
          sgstAmount: 25,
          igstRate: null,
          igstAmount: null,
        },
      ],
    });

    const xml = buildSalesVoucherXml(invoice, mockSettings, 'Create');

    expect(xml).not.toContain('Cancelled Line');
    // Only the real line's tax is posted: 25.00, not 50.00.
    expect(xml).toMatch(/<LEDGERNAME>Output CGST @2\.5%<\/LEDGERNAME>[\s\S]*?<AMOUNT>25\.00<\/AMOUNT>/);
    expect(xml).not.toContain('<AMOUNT>50.00</AMOUNT>');
  });
});

describe('Sign convention', () => {
  it('party ledger entry is DEBIT (negative amount, ISDEEMEDPOSITIVE=Yes)', () => {
    const invoice = makeInvoice();
    const xml = buildSalesVoucherXml(invoice, mockSettings, 'Create');

    // Party line pattern: negative amount with ISDEEMEDPOSITIVE=Yes
    expect(xml).toMatch(/<LEDGERNAME>Test Customer Ledger<\/LEDGERNAME>/);
    expect(xml).toMatch(/<ISDEEMEDPOSITIVE>Yes<\/ISDEEMEDPOSITIVE>[\s\S]*?<AMOUNT>-1050\.00<\/AMOUNT>/);
  });

  it('GST ledger entries are CREDIT (positive amount, ISDEEMEDPOSITIVE=No)', () => {
    const invoice = makeInvoice();
    const xml = buildSalesVoucherXml(invoice, mockSettings, 'Create');

    // GST lines: positive amount with ISDEEMEDPOSITIVE=No
    expect(xml).toMatch(
      /<LEDGERNAME>Output CGST @2\.5%<\/LEDGERNAME>[\s\S]*?<ISDEEMEDPOSITIVE>No<\/ISDEEMEDPOSITIVE>[\s\S]*?<AMOUNT>25\.00<\/AMOUNT>/
    );
  });
});
