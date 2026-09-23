import { Prisma } from '@prisma/client';
import { grnLineRate, isKaajButtonJob, jobWorkCharges } from '../../services/helpers/grn-line-value.helper';
import { transformGrn, type GrnWithDetails } from '../../services/document-data/grn.doc-data';
import type { CompanyBlock } from '../../services/document-data/company-block';

/**
 * The GRN list's Rate / Value columns and the printed job-work return's "Job charges" read one
 * definition (grn-line-value.helper). These pin it — and that the print did not move when the
 * charge calculation was lifted out of it.
 */
const D = (v: number | string) => new Prisma.Decimal(v);

const dyeingJob = {
  processType: 'DYEING',
  processTypeMaster: { code: 'DYEING' },
  agreedRatePerMeter: D(10),
  buttonholeCount: null,
  buttonCount: null,
  buttonholeRatePerUnit: null,
  buttonRatePerUnit: null,
};

const kaajJob = {
  processType: 'KAAJ_BUTTON',
  processTypeMaster: { code: 'KAAJ_BUTTON' },
  agreedRatePerMeter: D(0),
  buttonholeCount: 400,
  buttonCount: 800,
  buttonholeRatePerUnit: D('0.75'),
  buttonRatePerUnit: D('0.40'),
};

describe('grnLineRate', () => {
  it("prefers the receipt's own rate over the PO line", () => {
    expect(
      grnLineRate({ actualRatePerUnit: D(52), purchase_order_items: { unitPrice: D('50.40') } }, null)?.toNumber()
    ).toBe(52);
  });

  it("falls back to the PO line's price", () => {
    expect(
      grnLineRate({ actualRatePerUnit: null, purchase_order_items: { unitPrice: D('50.40') } }, null)?.toNumber()
    ).toBe(50.4);
  });

  it("prices a PO-less job-work return at the processor's charge", () => {
    expect(grnLineRate({ actualRatePerUnit: null, purchase_order_items: null }, dyeingJob)?.toNumber()).toBe(10);
  });

  it('has no single rate for a kaaj-button return, and none without a PO line or job', () => {
    expect(grnLineRate({ actualRatePerUnit: null, purchase_order_items: null }, kaajJob)).toBeNull();
    expect(grnLineRate({ actualRatePerUnit: null, purchase_order_items: null }, null)).toBeNull();
  });
});

describe('jobWorkCharges', () => {
  it('bills accepted quantity × agreed rate', () => {
    const { amount, ratePerUnit } = jobWorkCharges(dyeingJob, D('1707.3'));
    expect(amount.toNumber()).toBe(17073);
    expect(ratePerUnit?.toNumber()).toBe(10);
  });

  it('bills kaaj-button as buttonholes + buttons, with no per-unit rate', () => {
    expect(isKaajButtonJob(kaajJob)).toBe(true);
    const { amount, ratePerUnit } = jobWorkCharges(kaajJob, D(400));
    expect(amount.toNumber()).toBe(620); // 400 × 0.75 + 800 × 0.40
    expect(ratePerUnit).toBeNull();
  });

  it('keeps paise exact where floats would drift', () => {
    expect(jobWorkCharges({ ...dyeingJob, agreedRatePerMeter: D('0.1') }, D('0.2')).amount.toString()).toBe('0.02');
  });
});

describe('the printed GRN', () => {
  const company: CompanyBlock = {
    name: 'Test Co',
    tagline: '',
    addressLine: 'Jaipur',
    gstin: '08AAAAA0000A1Z5',
    stateCode: '08',
    stateName: 'Rajasthan',
    pan: null,
    msme: null,
    phone: null,
    email: null,
  };

  const item = (unit: 'METER' | 'PIECE', accepted: number) => ({
    id: 'item-1',
    grnId: 'grn-1',
    poItemId: null,
    materialId: 'mat-1',
    orderedQuantity: D(accepted),
    receivedQuantity: D(accepted),
    acceptedQuantity: D(accepted),
    rejectedQuantity: D(0),
    unit,
    remarks: null,
    componentName: null,
    colorName: null,
    foldLengthCm: null,
    receivedWidthInches: null,
    entryMode: null,
    baleCount: null,
    thanCount: null,
    rollCount: null,
    totalMeters: null,
    isOverReceipt: false,
    overReceiptQty: null,
    receivedAsReadyFabric: false,
    actualRatePerUnit: null,
    updateFutureSourcing: false,
    actualQuantity: null,
    materials: { name: 'Viscose Moss', code: 'FAB-1' },
    grn_item_details: [],
  });

  const grn = (overrides: Partial<GrnWithDetails>): GrnWithDetails =>
    ({
      id: 'grn-1',
      grnNumber: 'GRN2609-0114',
      poId: null,
      jobWorkOrderId: null,
      supplierId: 'sup-1',
      warehouseId: null,
      receivingDate: new Date('2026-09-21T06:00:00Z'),
      invoiceNumber: null,
      invoiceDate: null,
      status: 'ACCEPTED',
      remarks: null,
      receivedById: 'u-1',
      approvedById: null,
      createdAt: new Date('2026-09-21T06:00:00Z'),
      suppliers: { name: 'Aryan Dyeing', gst_numbers: [] },
      jobWorkOrder: null,
      purchase_orders: null,
      grn_items: [],
      users_goods_receiving_notes_receivedByIdTousers: { firstName: 'A', lastName: 'B' },
      users_goods_receiving_notes_approvedByIdTousers: null,
      ...overrides,
    }) as unknown as GrnWithDetails;

  it('still prints the job charges it printed before the calculation moved out', () => {
    const data = transformGrn(
      company,
      grn({
        jobWorkOrderId: 'jwo-1',
        jobWorkOrder: {
          jobWorkNumber: 'DJ-ESSKY086LS-004',
          processType: 'DYEING',
          sentDate: new Date('2026-09-21T06:00:00Z'),
          challanNumber: null,
          statutoryDueDate: null,
          qtySentMeters: D('1800'),
          qtyReceivedMeters: D('1707.3'),
          qtyNormalLoss: null,
          qtyAbnormalLoss: null,
          tolerancePercent: null,
          agreedRatePerMeter: D(10),
          uom: 'MTR',
          totalTaxAmount: null,
          buttonholeCount: null,
          buttonCount: null,
          buttonholeRatePerUnit: null,
          buttonRatePerUnit: null,
          processTypeMaster: null,
          components: [],
        },
        grn_items: [item('METER', 1707.3)],
      } as unknown as Partial<GrnWithDetails>)
    );
    expect(data.valuation?.jobCharges).toBe('17,073.00');
    expect(data.valuation?.jobChargesBasis).toBe('1,707.30 accepted × ₹10.00');
    expect(data.uomLabel).toBe('Mtr');
  });

  it('heads a PO receipt in Mtr, not the raw enum METER', () => {
    const data = transformGrn(
      company,
      grn({
        poId: 'po-1',
        purchase_orders: { poNumber: 'PO2609-0003' },
        grn_items: [item('METER', 15726.2)],
      } as unknown as Partial<GrnWithDetails>)
    );
    expect(data.uomLabel).toBe('Mtr');
    expect(data.lines[0].uom).toBe('Mtr');
    expect(data.lines[0].received).toBe('15,726.20');
  });
});
