/**
 * Unit Tests for GST Report Service
 * Tests GSTR-1 and GSTR-3B report generation with mocked Prisma
 */

// Mock prisma before importing the service
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    invoices: { findMany: jest.fn() },
    credit_notes: { findMany: jest.fn() },
    purchase_orders: { findMany: jest.fn() },
  },
}));

jest.mock('../../utils/logger', () => ({
  logDebug: jest.fn(),
  logError: jest.fn(),
}));

import { gstReportService } from '../gstReport.service';
import prisma from '../../config/database';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ---- Helpers to build mock data ----

function makeInvoice(overrides: Partial<any> = {}) {
  return {
    invoiceNumber: 'INV-001',
    invoiceDate: new Date('2026-01-15'),
    subtotal: 10000,
    totalAmount: 11200,
    cgstAmount: 600,
    sgstAmount: 600,
    igstAmount: 0,
    isInterstate: false,
    status: 'PENDING',
    supplyType: 'TAXABLE',
    customers: {
      id: 'c1',
      name: 'Customer A',
      billingName: 'Customer A Pvt Ltd',
      gstNumber: '29AABCU9603R1ZM',
      billingState: { stateName: 'Karnataka', stateCode: '29' },
    },
    invoice_items: [
      {
        hsnCode: '62114210',
        quantity: 100,
        totalPrice: 10000,
        cgstAmount: 600,
        sgstAmount: 600,
        igstAmount: 0,
        taxAmount: 1200,
        style: { hsnCode: '62114210' },
      },
    ],
    placeOfSupply: { stateName: 'Karnataka', stateCode: '29' },
    ...overrides,
  };
}

function makeCreditNote(overrides: Partial<any> = {}) {
  return {
    creditNoteNumber: 'CN-001',
    creditNoteDate: new Date('2026-01-20'),
    totalAmount: 5000,
    subtotal: 4464,
    cgstAmount: 268,
    sgstAmount: 268,
    igstAmount: 0,
    reason: 'Quality issue',
    status: 'APPROVED',
    customer: {
      name: 'Customer A',
      billingName: 'Customer A Pvt Ltd',
      gstNumber: '29AABCU9603R1ZM',
    },
    invoice: { invoiceNumber: 'INV-001' },
    items: [],
    ...overrides,
  };
}

const DEFAULT_PARAMS = { fromDate: '2026-01-01', toDate: '2026-01-31' };

describe('GSTReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: empty results
    (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.credit_notes.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.purchase_orders.findMany as jest.Mock).mockResolvedValue([]);
  });

  // ============================================
  // 1. generateGSTR1
  // ============================================
  describe('generateGSTR1', () => {
    it('should return correct period from/to', async () => {
      const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);
      expect(result.period).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    });

    // ---- B2B Section ----
    describe('B2B entries', () => {
      it('should create B2B entries for invoices with customer gstNumber', async () => {
        const inv1 = makeInvoice({
          invoiceNumber: 'INV-001',
          subtotal: 10000,
          totalAmount: 11200,
          cgstAmount: 600,
          sgstAmount: 600,
          igstAmount: 0,
          customers: {
            id: 'c1',
            name: 'Alpha Corp',
            billingName: 'Alpha Corp Pvt Ltd',
            gstNumber: '29AABCA1234R1Z1',
            billingState: { stateName: 'Karnataka', stateCode: '29' },
          },
        });
        const inv2 = makeInvoice({
          invoiceNumber: 'INV-002',
          subtotal: 20000,
          totalAmount: 23600,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 3600,
          isInterstate: true,
          customers: {
            id: 'c2',
            name: 'Beta Ltd',
            billingName: 'Beta Ltd',
            gstNumber: '27AABCB5678R1Z2',
            billingState: { stateName: 'Maharashtra', stateCode: '27' },
          },
          placeOfSupply: { stateName: 'Maharashtra', stateCode: '27' },
        });

        (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue([inv1, inv2]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);

        expect(result.b2b).toHaveLength(2);

        // First B2B entry
        expect(result.b2b[0].customerGstin).toBe('29AABCA1234R1Z1');
        expect(result.b2b[0].customerName).toBe('Alpha Corp Pvt Ltd');
        expect(result.b2b[0].invoiceNumber).toBe('INV-001');
        expect(result.b2b[0].invoiceValue).toBe(11200);
        expect(result.b2b[0].taxableValue).toBe(10000);
        expect(result.b2b[0].cgstAmount).toBe(600);
        expect(result.b2b[0].sgstAmount).toBe(600);
        expect(result.b2b[0].igstAmount).toBe(0);
        expect(result.b2b[0].totalTax).toBe(1200);
        expect(result.b2b[0].isInterstate).toBe(false);
        expect(result.b2b[0].placeOfSupply).toBe('Karnataka');

        // Second B2B entry (interstate)
        expect(result.b2b[1].customerGstin).toBe('27AABCB5678R1Z2');
        expect(result.b2b[1].invoiceValue).toBe(23600);
        expect(result.b2b[1].igstAmount).toBe(3600);
        expect(result.b2b[1].totalTax).toBe(3600);
        expect(result.b2b[1].isInterstate).toBe(true);
        expect(result.b2b[1].placeOfSupply).toBe('Maharashtra');
      });

      it('should use customer name when billingName is not available', async () => {
        const inv = makeInvoice({
          customers: {
            id: 'c1',
            name: 'Alpha Corp',
            billingName: null,
            gstNumber: '29AABCA1234R1Z1',
            billingState: { stateName: 'Karnataka', stateCode: '29' },
          },
        });
        (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue([inv]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);
        expect(result.b2b[0].customerName).toBe('Alpha Corp');
      });

      it('should fall back to billingState when placeOfSupply is absent', async () => {
        const inv = makeInvoice({
          placeOfSupply: null,
          customers: {
            id: 'c1',
            name: 'Customer',
            billingName: 'Customer',
            gstNumber: '33AABCC1234R1Z3',
            billingState: { stateName: 'Tamil Nadu', stateCode: '33' },
          },
        });
        (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue([inv]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);
        expect(result.b2b[0].placeOfSupply).toBe('Tamil Nadu');
      });

      it('should exclude invoices without gstNumber from B2B', async () => {
        const inv = makeInvoice({
          customers: {
            id: 'c1',
            name: 'Unregistered Customer',
            billingName: null,
            gstNumber: null,
            billingState: { stateName: 'Karnataka', stateCode: '29' },
          },
        });
        (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue([inv]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);
        expect(result.b2b).toHaveLength(0);
      });
    });

    // ---- B2CS Section ----
    describe('B2CS entries (unregistered customers, state-wise)', () => {
      it('should group unregistered customer invoices by state', async () => {
        const inv1 = makeInvoice({
          invoiceNumber: 'INV-010',
          subtotal: 5000,
          cgstAmount: 300,
          sgstAmount: 300,
          igstAmount: 0,
          customers: {
            id: 'c10', name: 'Walk-in 1', billingName: null, gstNumber: null,
            billingState: { stateName: 'Karnataka', stateCode: '29' },
          },
          placeOfSupply: { stateName: 'Karnataka', stateCode: '29' },
        });
        const inv2 = makeInvoice({
          invoiceNumber: 'INV-011',
          subtotal: 8000,
          cgstAmount: 480,
          sgstAmount: 480,
          igstAmount: 0,
          customers: {
            id: 'c11', name: 'Walk-in 2', billingName: null, gstNumber: null,
            billingState: { stateName: 'Karnataka', stateCode: '29' },
          },
          placeOfSupply: { stateName: 'Karnataka', stateCode: '29' },
        });
        const inv3 = makeInvoice({
          invoiceNumber: 'INV-012',
          subtotal: 3000,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 540,
          customers: {
            id: 'c12', name: 'Walk-in 3', billingName: null, gstNumber: null,
            billingState: { stateName: 'Maharashtra', stateCode: '27' },
          },
          placeOfSupply: { stateName: 'Maharashtra', stateCode: '27' },
        });

        (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue([inv1, inv2, inv3]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);

        expect(result.b2cs).toHaveLength(2);

        // Karnataka grouped (inv1 + inv2)
        const karnataka = result.b2cs.find(e => e.placeOfSupply === 'Karnataka');
        expect(karnataka).toBeDefined();
        expect(karnataka!.taxableValue).toBe(13000); // 5000 + 8000
        expect(karnataka!.cgstAmount).toBe(780);     // 300 + 480
        expect(karnataka!.sgstAmount).toBe(780);     // 300 + 480
        expect(karnataka!.igstAmount).toBe(0);

        // Maharashtra (inv3 only)
        const maharashtra = result.b2cs.find(e => e.placeOfSupply === 'Maharashtra');
        expect(maharashtra).toBeDefined();
        expect(maharashtra!.taxableValue).toBe(3000);
        expect(maharashtra!.igstAmount).toBe(540);
      });

      it('should not include registered customers in B2CS', async () => {
        const inv = makeInvoice(); // has gstNumber by default
        (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue([inv]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);
        expect(result.b2cs).toHaveLength(0);
      });
    });

    // ---- CDNR Section ----
    describe('CDNR entries (credit notes against registered customers)', () => {
      it('should create CDNR entry for approved credit note with customer gstNumber', async () => {
        const cn = makeCreditNote({
          creditNoteNumber: 'CN-001',
          creditNoteDate: new Date('2026-01-20'),
          totalAmount: 5000,
          subtotal: 4464,
          cgstAmount: 268,
          sgstAmount: 268,
          igstAmount: 0,
          reason: 'Defective goods returned',
          customer: {
            name: 'Customer A',
            billingName: 'Customer A Pvt Ltd',
            gstNumber: '29AABCU9603R1ZM',
          },
          invoice: { invoiceNumber: 'INV-001' },
        });

        (mockPrisma.credit_notes.findMany as jest.Mock).mockResolvedValue([cn]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);

        expect(result.cdnr).toHaveLength(1);
        expect(result.cdnr[0].customerGstin).toBe('29AABCU9603R1ZM');
        expect(result.cdnr[0].customerName).toBe('Customer A Pvt Ltd');
        expect(result.cdnr[0].creditNoteNumber).toBe('CN-001');
        expect(result.cdnr[0].invoiceNumber).toBe('INV-001');
        expect(result.cdnr[0].noteValue).toBe(5000);
        expect(result.cdnr[0].taxableValue).toBe(4464);
        expect(result.cdnr[0].cgstAmount).toBe(268);
        expect(result.cdnr[0].sgstAmount).toBe(268);
        expect(result.cdnr[0].igstAmount).toBe(0);
        expect(result.cdnr[0].reason).toBe('Defective goods returned');
      });

      it('should exclude credit notes from unregistered customers', async () => {
        const cn = makeCreditNote({
          customer: {
            name: 'Unregistered Customer',
            billingName: null,
            gstNumber: null,
          },
        });
        (mockPrisma.credit_notes.findMany as jest.Mock).mockResolvedValue([cn]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);
        expect(result.cdnr).toHaveLength(0);
      });

      it('should use dash when credit note has no linked invoice', async () => {
        const cn = makeCreditNote({ invoice: null });
        (mockPrisma.credit_notes.findMany as jest.Mock).mockResolvedValue([cn]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);
        expect(result.cdnr[0].invoiceNumber).toBe('-');
      });
    });

    // ---- HSN Summary ----
    describe('HSN summary', () => {
      it('should group invoice items by HSN code', async () => {
        const inv = makeInvoice({
          invoice_items: [
            {
              hsnCode: '62114210',
              quantity: 100,
              totalPrice: 8000,
              cgstAmount: 480,
              sgstAmount: 480,
              igstAmount: 0,
              taxAmount: 960,
              style: { hsnCode: '62114210' },
            },
            {
              hsnCode: '96064100',
              quantity: 200,
              totalPrice: 2000,
              cgstAmount: 120,
              sgstAmount: 120,
              igstAmount: 0,
              taxAmount: 240,
              style: { hsnCode: '96064100' },
            },
          ],
        });
        (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue([inv]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);

        expect(result.hsnSummary).toHaveLength(2);

        const garmentHsn = result.hsnSummary.find(h => h.hsnCode === '62114210');
        expect(garmentHsn).toBeDefined();
        expect(garmentHsn!.totalQuantity).toBe(100);
        expect(garmentHsn!.taxableValue).toBe(8000);
        expect(garmentHsn!.cgstAmount).toBe(480);
        expect(garmentHsn!.sgstAmount).toBe(480);
        expect(garmentHsn!.totalTax).toBe(960);

        const buttonHsn = result.hsnSummary.find(h => h.hsnCode === '96064100');
        expect(buttonHsn).toBeDefined();
        expect(buttonHsn!.totalQuantity).toBe(200);
        expect(buttonHsn!.taxableValue).toBe(2000);
      });

      it('should aggregate same HSN across multiple invoices', async () => {
        const inv1 = makeInvoice({
          invoiceNumber: 'INV-001',
          invoice_items: [
            {
              hsnCode: '62114210', quantity: 50, totalPrice: 5000,
              cgstAmount: 300, sgstAmount: 300, igstAmount: 0, taxAmount: 600,
              style: { hsnCode: '62114210' },
            },
          ],
        });
        const inv2 = makeInvoice({
          invoiceNumber: 'INV-002',
          invoice_items: [
            {
              hsnCode: '62114210', quantity: 75, totalPrice: 7500,
              cgstAmount: 450, sgstAmount: 450, igstAmount: 0, taxAmount: 900,
              style: { hsnCode: '62114210' },
            },
          ],
        });
        (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue([inv1, inv2]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);

        expect(result.hsnSummary).toHaveLength(1);
        expect(result.hsnSummary[0].hsnCode).toBe('62114210');
        expect(result.hsnSummary[0].totalQuantity).toBe(125); // 50 + 75
        expect(result.hsnSummary[0].taxableValue).toBe(12500); // 5000 + 7500
        expect(result.hsnSummary[0].cgstAmount).toBe(750);
        expect(result.hsnSummary[0].totalTax).toBe(1500);
      });

      it('should use style hsnCode when item hsnCode is absent', async () => {
        const inv = makeInvoice({
          invoice_items: [
            {
              hsnCode: null, quantity: 50, totalPrice: 5000,
              cgstAmount: 300, sgstAmount: 300, igstAmount: 0, taxAmount: 600,
              style: { hsnCode: '62041200' },
            },
          ],
        });
        (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue([inv]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);
        expect(result.hsnSummary[0].hsnCode).toBe('62041200');
      });

      it('should create N/A HSN entry for legacy invoices without items', async () => {
        const inv = makeInvoice({
          subtotal: 15000,
          cgstAmount: 900,
          sgstAmount: 900,
          igstAmount: 0,
          invoice_items: [], // no items (legacy)
        });
        (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue([inv]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);

        expect(result.hsnSummary).toHaveLength(1);
        expect(result.hsnSummary[0].hsnCode).toBe('N/A');
        expect(result.hsnSummary[0].taxableValue).toBe(15000);
        expect(result.hsnSummary[0].cgstAmount).toBe(900);
        expect(result.hsnSummary[0].sgstAmount).toBe(900);
        expect(result.hsnSummary[0].totalTax).toBe(1800); // 900 + 900 + 0
        expect(result.hsnSummary[0].totalQuantity).toBe(0);
      });

      it('should aggregate N/A entries when invoice_items is null/undefined', async () => {
        const inv = makeInvoice({
          subtotal: 7000,
          cgstAmount: 420,
          sgstAmount: 420,
          igstAmount: 0,
          invoice_items: null,
        });
        (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue([inv]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);

        expect(result.hsnSummary).toHaveLength(1);
        expect(result.hsnSummary[0].hsnCode).toBe('N/A');
        expect(result.hsnSummary[0].taxableValue).toBe(7000);
      });
    });

    // ---- Empty Period ----
    describe('empty period', () => {
      it('should return empty arrays and zero totals when no invoices exist', async () => {
        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);

        expect(result.b2b).toHaveLength(0);
        expect(result.b2cs).toHaveLength(0);
        expect(result.cdnr).toHaveLength(0);
        expect(result.hsnSummary).toHaveLength(0);
        expect(result.totals.totalInvoices).toBe(0);
        expect(result.totals.totalTaxableValue).toBe(0);
        expect(result.totals.totalCgst).toBe(0);
        expect(result.totals.totalSgst).toBe(0);
        expect(result.totals.totalIgst).toBe(0);
        expect(result.totals.totalTax).toBe(0);
        expect(result.totals.totalInvoiceValue).toBe(0);
      });
    });

    // ---- Totals ----
    describe('totals', () => {
      it('should sum all invoices correctly in totals object', async () => {
        const inv1 = makeInvoice({
          invoiceNumber: 'INV-001',
          subtotal: 10000,
          totalAmount: 11200,
          cgstAmount: 600,
          sgstAmount: 600,
          igstAmount: 0,
        });
        const inv2 = makeInvoice({
          invoiceNumber: 'INV-002',
          subtotal: 20000,
          totalAmount: 23600,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 3600,
          isInterstate: true,
        });
        const inv3 = makeInvoice({
          invoiceNumber: 'INV-003',
          subtotal: 5000,
          totalAmount: 5900,
          cgstAmount: 450,
          sgstAmount: 450,
          igstAmount: 0,
          customers: {
            id: 'c3', name: 'Walk-in', billingName: null, gstNumber: null,
            billingState: { stateName: 'Karnataka', stateCode: '29' },
          },
        });

        (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue([inv1, inv2, inv3]);

        const result = await gstReportService.generateGSTR1(DEFAULT_PARAMS);

        expect(result.totals.totalInvoices).toBe(3);
        expect(result.totals.totalTaxableValue).toBe(35000); // 10000 + 20000 + 5000
        expect(result.totals.totalCgst).toBe(1050);          // 600 + 0 + 450
        expect(result.totals.totalSgst).toBe(1050);          // 600 + 0 + 450
        expect(result.totals.totalIgst).toBe(3600);          // 0 + 3600 + 0
        expect(result.totals.totalTax).toBe(5700);           // 1050 + 1050 + 3600
        expect(result.totals.totalInvoiceValue).toBe(40700); // 11200 + 23600 + 5900
      });
    });
  });

  // ============================================
  // 2. generateGSTR3B
  // ============================================
  describe('generateGSTR3B', () => {
    it('should return correct period', async () => {
      const result = await gstReportService.generateGSTR3B(DEFAULT_PARAMS);
      expect(result.period).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    });

    it('should calculate net payable when outward > ITC', async () => {
      // Outward: CGST 600, SGST 600, IGST 3600
      const invoices = [
        {
          subtotal: 10000, cgstAmount: 600, sgstAmount: 600, igstAmount: 0,
          totalAmount: 11200, supplyType: 'TAXABLE',
        },
        {
          subtotal: 20000, cgstAmount: 0, sgstAmount: 0, igstAmount: 3600,
          totalAmount: 23600, supplyType: 'TAXABLE',
        },
      ];

      // ITC: CGST 200, SGST 200, IGST 1000
      const purchaseOrders = [
        { totalCgst: 200, totalSgst: 200, totalIgst: 1000 },
      ];

      (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue(invoices);
      (mockPrisma.purchase_orders.findMany as jest.Mock).mockResolvedValue(purchaseOrders);

      const result = await gstReportService.generateGSTR3B(DEFAULT_PARAMS);

      // Outward supplies
      expect(result.outwardSupplies.taxable.taxableValue).toBe(30000);
      expect(result.outwardSupplies.taxable.cgst).toBe(600);
      expect(result.outwardSupplies.taxable.sgst).toBe(600);
      expect(result.outwardSupplies.taxable.igst).toBe(3600);

      // ITC
      expect(result.inputTaxCredit.fromPurchases.cgst).toBe(200);
      expect(result.inputTaxCredit.fromPurchases.sgst).toBe(200);
      expect(result.inputTaxCredit.fromPurchases.igst).toBe(1000);

      // Net payable (outward - ITC, minimum 0)
      expect(result.netTaxPayable.cgst).toBe(400);  // 600 - 200
      expect(result.netTaxPayable.sgst).toBe(400);  // 600 - 200
      expect(result.netTaxPayable.igst).toBe(2600); // 3600 - 1000
      expect(result.netTaxPayable.total).toBe(3400); // 400 + 400 + 2600
    });

    it('should return net payable = 0 when ITC exceeds outward (Math.max(0, negative))', async () => {
      // Outward: CGST 300, SGST 300, IGST 0
      const invoices = [
        {
          subtotal: 5000, cgstAmount: 300, sgstAmount: 300, igstAmount: 0,
          totalAmount: 5600, supplyType: 'TAXABLE',
        },
      ];

      // ITC: CGST 1000, SGST 1000, IGST 2000 (much higher than outward)
      const purchaseOrders = [
        { totalCgst: 1000, totalSgst: 1000, totalIgst: 2000 },
      ];

      (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue(invoices);
      (mockPrisma.purchase_orders.findMany as jest.Mock).mockResolvedValue(purchaseOrders);

      const result = await gstReportService.generateGSTR3B(DEFAULT_PARAMS);

      // Net payable should be 0 (not negative)
      expect(result.netTaxPayable.cgst).toBe(0);
      expect(result.netTaxPayable.sgst).toBe(0);
      expect(result.netTaxPayable.igst).toBe(0);
      expect(result.netTaxPayable.total).toBe(0);
    });

    it('should return all zeros for empty period', async () => {
      const result = await gstReportService.generateGSTR3B(DEFAULT_PARAMS);

      expect(result.outwardSupplies.taxable.taxableValue).toBe(0);
      expect(result.outwardSupplies.taxable.cgst).toBe(0);
      expect(result.outwardSupplies.taxable.sgst).toBe(0);
      expect(result.outwardSupplies.taxable.igst).toBe(0);
      expect(result.outwardSupplies.exempt.taxableValue).toBe(0);
      expect(result.outwardSupplies.nilRated.taxableValue).toBe(0);
      expect(result.inputTaxCredit.fromPurchases.cgst).toBe(0);
      expect(result.inputTaxCredit.fromPurchases.sgst).toBe(0);
      expect(result.inputTaxCredit.fromPurchases.igst).toBe(0);
      expect(result.netTaxPayable.cgst).toBe(0);
      expect(result.netTaxPayable.sgst).toBe(0);
      expect(result.netTaxPayable.igst).toBe(0);
      expect(result.netTaxPayable.total).toBe(0);
    });

    it('should only count POs with SENT/ACKNOWLEDGED/PARTIALLY_RECEIVED/RECEIVED in ITC', async () => {
      // The service filters PO status via the Prisma where clause
      // Verify the correct statuses are passed in the query
      const invoices = [
        {
          subtotal: 10000, cgstAmount: 600, sgstAmount: 600, igstAmount: 0,
          totalAmount: 11200, supplyType: 'TAXABLE',
        },
      ];

      const purchaseOrders = [
        { totalCgst: 500, totalSgst: 500, totalIgst: 0 },
      ];

      (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue(invoices);
      (mockPrisma.purchase_orders.findMany as jest.Mock).mockResolvedValue(purchaseOrders);

      await gstReportService.generateGSTR3B(DEFAULT_PARAMS);

      // Verify the PO query includes correct status filter
      const poCall = (mockPrisma.purchase_orders.findMany as jest.Mock).mock.calls[0][0];
      expect(poCall.where.status.in).toEqual([
        'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED',
      ]);
    });

    it('should handle POs with null GST values', async () => {
      const invoices = [
        {
          subtotal: 10000, cgstAmount: 600, sgstAmount: 600, igstAmount: 0,
          totalAmount: 11200, supplyType: 'TAXABLE',
        },
      ];

      const purchaseOrders = [
        { totalCgst: null, totalSgst: null, totalIgst: null },
        { totalCgst: 200, totalSgst: 200, totalIgst: 0 },
      ];

      (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue(invoices);
      (mockPrisma.purchase_orders.findMany as jest.Mock).mockResolvedValue(purchaseOrders);

      const result = await gstReportService.generateGSTR3B(DEFAULT_PARAMS);

      // null should be treated as 0 via Number(null || 0) = 0
      expect(result.inputTaxCredit.fromPurchases.cgst).toBe(200);
      expect(result.inputTaxCredit.fromPurchases.sgst).toBe(200);
      expect(result.inputTaxCredit.fromPurchases.igst).toBe(0);
    });

    it('should aggregate multiple POs for ITC', async () => {
      const invoices = [
        {
          subtotal: 50000, cgstAmount: 3000, sgstAmount: 3000, igstAmount: 0,
          totalAmount: 56000, supplyType: 'TAXABLE',
        },
      ];

      const purchaseOrders = [
        { totalCgst: 300, totalSgst: 300, totalIgst: 0 },
        { totalCgst: 500, totalSgst: 500, totalIgst: 0 },
        { totalCgst: 0, totalSgst: 0, totalIgst: 1800 },
      ];

      (mockPrisma.invoices.findMany as jest.Mock).mockResolvedValue(invoices);
      (mockPrisma.purchase_orders.findMany as jest.Mock).mockResolvedValue(purchaseOrders);

      const result = await gstReportService.generateGSTR3B(DEFAULT_PARAMS);

      expect(result.inputTaxCredit.fromPurchases.cgst).toBe(800);  // 300 + 500
      expect(result.inputTaxCredit.fromPurchases.sgst).toBe(800);  // 300 + 500
      expect(result.inputTaxCredit.fromPurchases.igst).toBe(1800);

      expect(result.netTaxPayable.cgst).toBe(2200);  // 3000 - 800
      expect(result.netTaxPayable.sgst).toBe(2200);  // 3000 - 800
      expect(result.netTaxPayable.igst).toBe(0);      // 0 - 1800 = negative, clamped to 0
      expect(result.netTaxPayable.total).toBe(4400);
    });
  });
});
