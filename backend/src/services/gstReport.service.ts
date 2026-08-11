import prisma from '../config/database';

/**
 * The ONE where-clause for statutory-reportable invoices, shared by GSTR-1 and GSTR-3B so the two
 * returns can never diverge. GST liability arises on invoice ISSUANCE, not payment — payment status
 * (PENDING/PARTIALLY_PAID/PAID/OVERDUE) must NEVER filter a statutory report. If a genuinely
 * non-reportable status (e.g. CANCELLED) is ever added to InvoiceStatus, exclude it HERE only.
 */
const reportableInvoicesWhere = (fromDate: Date, toDate: Date) => ({
  invoiceDate: { gte: fromDate, lte: toDate },
});

interface GSTReportParams {
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
}

interface B2BEntry {
  customerGstin: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  invoiceValue: number;
  placeOfSupply: string;
  isInterstate: boolean;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
}

interface HSNSummaryEntry {
  hsnCode: string;
  description: string;
  uqc: string; // Unit Quantity Code (PCS, MTR, etc.)
  totalQuantity: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
}

interface CDNREntry {
  customerGstin: string;
  customerName: string;
  creditNoteNumber: string;
  creditNoteDate: Date;
  invoiceNumber: string;
  noteValue: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  reason: string;
}

interface GSTR1Report {
  period: { from: string; to: string };
  b2b: B2BEntry[];
  b2cs: {
    // B2C Small - unregistered customers, state-wise
    placeOfSupply: string;
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
  }[];
  cdnr: CDNREntry[];
  hsnSummary: HSNSummaryEntry[];
  totals: {
    totalInvoices: number;
    totalTaxableValue: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    totalTax: number;
    totalInvoiceValue: number;
  };
}

interface GSTR3BSummary {
  period: { from: string; to: string };
  outwardSupplies: {
    taxable: { taxableValue: number; cgst: number; sgst: number; igst: number };
    exempt: { taxableValue: number };
    nilRated: { taxableValue: number };
  };
  inputTaxCredit: {
    fromPurchases: { cgst: number; sgst: number; igst: number };
  };
  netTaxPayable: {
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  };
}

class GSTReportService {
  async generateGSTR1(params: GSTReportParams): Promise<GSTR1Report> {
    const fromDate = new Date(params.fromDate);
    const toDate = new Date(params.toDate);
    toDate.setHours(23, 59, 59, 999);

    // Fetch ALL invoices issued in the period (statutory: liability arises on issuance — the old
    // `status: { not: OVERDUE }` filter silently under-reported GSTR-1 by every past-due unpaid
    // invoice and made it disagree with GSTR-3B for the same period).
    const invoices = await prisma.invoices.findMany({
      where: reportableInvoicesWhere(fromDate, toDate),
      include: {
        customers: {
          select: {
            id: true,
            name: true,
            billingName: true,
            gstNumber: true,
            billingState: { select: { stateName: true, stateCode: true } },
          },
        },
        invoice_items: {
          include: { style: { select: { hsnCode: true } } },
        },
        placeOfSupply: { select: { stateName: true, stateCode: true } },
      },
      orderBy: { invoiceDate: 'asc' },
    });

    // Fetch credit notes in the period
    const creditNotes = await prisma.credit_notes.findMany({
      where: {
        creditNoteDate: { gte: fromDate, lte: toDate },
        status: 'APPROVED',
      },
      include: {
        customer: {
          select: { name: true, billingName: true, gstNumber: true },
        },
        invoice: { select: { invoiceNumber: true } },
        items: true,
      },
    });

    // B2B: Invoices where customer has GSTIN
    const b2b: B2BEntry[] = invoices
      .filter((inv) => inv.customers?.gstNumber)
      .map((inv) => ({
        customerGstin: inv.customers!.gstNumber!,
        customerName: inv.customers!.billingName || inv.customers!.name,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        invoiceValue: Number(inv.totalAmount),
        placeOfSupply: inv.placeOfSupply?.stateName || inv.customers?.billingState?.stateName || '-',
        isInterstate: inv.isInterstate,
        taxableValue: Number(inv.subtotal),
        cgstAmount: Number(inv.cgstAmount),
        sgstAmount: Number(inv.sgstAmount),
        igstAmount: Number(inv.igstAmount),
        totalTax: Number(inv.cgstAmount) + Number(inv.sgstAmount) + Number(inv.igstAmount),
      }));

    // B2CS: Invoices where customer has NO GSTIN, grouped by state
    const b2csMap = new Map<
      string,
      { taxableValue: number; cgstAmount: number; sgstAmount: number; igstAmount: number }
    >();
    invoices
      .filter((inv) => !inv.customers?.gstNumber)
      .forEach((inv) => {
        const state = inv.placeOfSupply?.stateName || inv.customers?.billingState?.stateName || 'Unknown';
        const existing = b2csMap.get(state) || { taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };
        existing.taxableValue += Number(inv.subtotal);
        existing.cgstAmount += Number(inv.cgstAmount);
        existing.sgstAmount += Number(inv.sgstAmount);
        existing.igstAmount += Number(inv.igstAmount);
        b2csMap.set(state, existing);
      });
    const b2cs = Array.from(b2csMap.entries()).map(([placeOfSupply, data]) => ({
      placeOfSupply,
      ...data,
    }));

    // CDNR: Credit notes against registered customers
    const cdnr: CDNREntry[] = creditNotes
      .filter((cn) => cn.customer?.gstNumber)
      .map((cn) => ({
        customerGstin: cn.customer!.gstNumber!,
        customerName: cn.customer!.billingName || cn.customer!.name,
        creditNoteNumber: cn.creditNoteNumber,
        creditNoteDate: cn.creditNoteDate,
        invoiceNumber: cn.invoice?.invoiceNumber || '-',
        noteValue: Number(cn.totalAmount),
        taxableValue: Number(cn.subtotal),
        cgstAmount: Number(cn.cgstAmount),
        sgstAmount: Number(cn.sgstAmount),
        igstAmount: Number(cn.igstAmount),
        reason: cn.reason,
      }));

    // HSN Summary: Aggregate across all invoice items
    const hsnMap = new Map<string, HSNSummaryEntry>();
    invoices.forEach((inv) => {
      if (inv.invoice_items && inv.invoice_items.length > 0) {
        inv.invoice_items.forEach((item) => {
          const hsn = item.hsnCode || item.style?.hsnCode || 'N/A';
          const existing = hsnMap.get(hsn) || {
            hsnCode: hsn,
            description: '',
            uqc: 'PCS',
            totalQuantity: 0,
            taxableValue: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            totalTax: 0,
          };
          existing.totalQuantity += item.quantity;
          existing.taxableValue += Number(item.totalPrice);
          existing.cgstAmount += Number(item.cgstAmount || 0);
          existing.sgstAmount += Number(item.sgstAmount || 0);
          existing.igstAmount += Number(item.igstAmount || 0);
          existing.totalTax += Number(item.taxAmount || 0);
          hsnMap.set(hsn, existing);
        });
      } else {
        // Legacy invoices without items - use header data
        const hsn = 'N/A';
        const existing = hsnMap.get(hsn) || {
          hsnCode: hsn,
          description: '',
          uqc: 'PCS',
          totalQuantity: 0,
          taxableValue: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalTax: 0,
        };
        existing.taxableValue += Number(inv.subtotal);
        existing.cgstAmount += Number(inv.cgstAmount);
        existing.sgstAmount += Number(inv.sgstAmount);
        existing.igstAmount += Number(inv.igstAmount);
        existing.totalTax += Number(inv.cgstAmount) + Number(inv.sgstAmount) + Number(inv.igstAmount);
        hsnMap.set(hsn, existing);
      }
    });

    // Totals
    const totals = {
      totalInvoices: invoices.length,
      totalTaxableValue: invoices.reduce((s, i) => s + Number(i.subtotal), 0),
      totalCgst: invoices.reduce((s, i) => s + Number(i.cgstAmount), 0),
      totalSgst: invoices.reduce((s, i) => s + Number(i.sgstAmount), 0),
      totalIgst: invoices.reduce((s, i) => s + Number(i.igstAmount), 0),
      totalTax: 0,
      totalInvoiceValue: invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
    };
    totals.totalTax = totals.totalCgst + totals.totalSgst + totals.totalIgst;

    return {
      period: { from: params.fromDate, to: params.toDate },
      b2b,
      b2cs,
      cdnr,
      hsnSummary: Array.from(hsnMap.values()),
      totals,
    };
  }

  async generateGSTR3B(params: GSTReportParams): Promise<GSTR3BSummary> {
    const fromDate = new Date(params.fromDate);
    const toDate = new Date(params.toDate);
    toDate.setHours(23, 59, 59, 999);

    // Outward supplies (sales invoices) — same shared reportable-invoices clause as GSTR-1.
    const invoices = await prisma.invoices.findMany({
      where: reportableInvoicesWhere(fromDate, toDate),
      select: {
        subtotal: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        totalAmount: true,
        supplyType: true,
      },
    });

    // Input tax credit from goods ACTUALLY RECEIVED in the period (ACCEPTED GRNs), pro-rating each
    // PO's header tax by the accepted fraction of its subtotal. The old query summed the FULL header
    // tax of every PO merely dated in the period (including SENT POs with nothing delivered) —
    // over-claiming ITC on a statutory return (bug-hunt financial-gst-10).
    const acceptedGrns = await prisma.goods_receiving_notes.findMany({
      where: { status: 'ACCEPTED', receivingDate: { gte: fromDate, lte: toDate } },
      select: {
        poId: true,
        grn_items: {
          select: { acceptedQuantity: true, purchase_order_items: { select: { unitPrice: true } } },
        },
        purchase_orders: {
          select: { subtotal: true, totalCgst: true, totalSgst: true, totalIgst: true },
        },
        // Phase 4b: PO-less JWO GRNs carry their tax on the job work order itself
        jobWorkOrder: {
          select: {
            subtotal: true,
            cgstAmount: true,
            sgstAmount: true,
            igstAmount: true,
            agreedRatePerMeter: true,
          },
        },
      },
    });

    const taxable = {
      taxableValue: invoices.reduce((s, i) => s + Number(i.subtotal), 0),
      cgst: invoices.reduce((s, i) => s + Number(i.cgstAmount), 0),
      sgst: invoices.reduce((s, i) => s + Number(i.sgstAmount), 0),
      igst: invoices.reduce((s, i) => s + Number(i.igstAmount), 0),
    };

    const itc = { cgst: 0, sgst: 0, igst: 0 };
    for (const grn of acceptedGrns) {
      // Phase 4b: PO-less JWO GRN — pro-rate the JWO's SAC-based tax by the accepted
      // fraction of its subtotal (received value = accepted qty × agreed rate)
      if (!grn.poId && grn.jobWorkOrder) {
        const jwo = grn.jobWorkOrder;
        const jwoSubtotal = Number(jwo.subtotal || 0);
        if (jwoSubtotal <= 0) continue;
        const receivedValue = grn.grn_items.reduce(
          (s, it) => s + Number(it.acceptedQuantity || 0) * Number(jwo.agreedRatePerMeter || 0),
          0
        );
        const fraction = Math.min(1, receivedValue / jwoSubtotal);
        itc.cgst += Number(jwo.cgstAmount || 0) * fraction;
        itc.sgst += Number(jwo.sgstAmount || 0) * fraction;
        itc.igst += Number(jwo.igstAmount || 0) * fraction;
        continue;
      }

      const po = grn.purchase_orders;
      const poSubtotal = Number(po?.subtotal || 0);
      if (!po || poSubtotal <= 0) continue;
      const receivedValue = grn.grn_items.reduce(
        (s, it) => s + Number(it.acceptedQuantity || 0) * Number(it.purchase_order_items?.unitPrice || 0),
        0
      );
      const fraction = Math.min(1, receivedValue / poSubtotal);
      itc.cgst += Number(po.totalCgst || 0) * fraction;
      itc.sgst += Number(po.totalSgst || 0) * fraction;
      itc.igst += Number(po.totalIgst || 0) * fraction;
    }

    // Net tax may legitimately be NEGATIVE (excess ITC = carry-forward credit). The old Math.max(0,..)
    // clamp silently discarded carry-forward on the statutory summary.
    const net = {
      cgst: taxable.cgst - itc.cgst,
      sgst: taxable.sgst - itc.sgst,
      igst: taxable.igst - itc.igst,
    };

    return {
      period: { from: params.fromDate, to: params.toDate },
      outwardSupplies: {
        taxable,
        exempt: { taxableValue: 0 },
        nilRated: { taxableValue: 0 },
      },
      inputTaxCredit: { fromPurchases: itc },
      netTaxPayable: {
        cgst: net.cgst,
        sgst: net.sgst,
        igst: net.igst,
        total: net.cgst + net.sgst + net.igst,
      },
    };
  }
}

export const gstReportService = new GSTReportService();
