/**
 * Who a PO is for (po-for-buyer.helper) — mocked prisma, no DB.
 *
 * PO2609-0231 bought Easybuy's size labels and nothing on it said Easybuy (2026-09-28). The order's customer,
 * else the style's, else the ONE buyer every buyer-carrying line names; mixed or none → null.
 */

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    requirement_po_links: { findMany: jest.fn() },
    orders: { findMany: jest.fn() },
    styles: { findMany: jest.fn() },
    label_master: { findMany: jest.fn() },
    packaging_master: { findMany: jest.fn() },
  },
}));

import prisma from '../../config/database';
import { poForBuyerLine, resolvePoForBuyer, resolvePoForBuyers } from '../../services/helpers/po-for-buyer.helper';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const EASYBUY = { id: 'cust-easybuy', name: 'Easybuy' };
const KASYA = { id: 'cust-kasya', name: 'House Of Kasya Pvt Ltd' };

const label = (id: string, customer: typeof EASYBUY | null, brandCustomer: typeof EASYBUY | null = null) => ({
  id,
  labelName: `Label ${id}`,
  labelCategory: 'SEWN_IN',
  labelType: 'Main Cum Size Label',
  material: null,
  color: 'Black',
  size: null,
  customer,
  brandCategory: brandCustomer ? { brandName: 'Easybuy', category: 'Western Wear', customer: brandCustomer } : null,
});

const labelLine = (labelId: string) => ({ materials: { materialType: 'LABEL', labelId } });
const buttonLine = { materials: { materialType: 'BUTTON', buttonId: 'btn-1' } };
const serviceLine = { materials: null };

const bare = (id: string, lines: Array<{ materials: Record<string, unknown> | null }>) => ({
  id,
  orderId: null,
  styleId: null,
  purchase_order_items: lines as never,
});

beforeEach(() => {
  jest.clearAllMocks();
  db.requirement_po_links.findMany.mockResolvedValue([]);
  db.orders.findMany.mockResolvedValue([]);
  db.styles.findMany.mockResolvedValue([]);
  db.label_master.findMany.mockResolvedValue([]);
  db.packaging_master.findMany.mockResolvedValue([]);
});

describe('resolvePoForBuyers', () => {
  it("PO2609-0231's shape: one buyer's size labels, no order or style → that buyer, from the lines", async () => {
    db.label_master.findMany.mockResolvedValue([label('lbl-4', null, EASYBUY)]); // named by its brand's customer
    const out = await resolvePoForBuyer(
      bare('po-1', [labelLine('lbl-4'), labelLine('lbl-4'), buttonLine, serviceLine]) // a button names nobody
    );
    expect(out).toEqual({ name: 'Easybuy', source: 'LINES', orderNumber: null, styleCode: null });
    // only the buyer-carrying masters are read — never the button master
    expect(db.label_master.findMany).toHaveBeenCalledTimes(1);
  });

  it('lines of two buyers, or none that names one → null', async () => {
    db.label_master.findMany.mockResolvedValue([label('lbl-e', EASYBUY), label('lbl-k', KASYA)]);
    const [mixed, none] = await resolvePoForBuyers([
      bare('po-mixed', [labelLine('lbl-e'), labelLine('lbl-k')]),
      bare('po-none', [buttonLine]),
    ]);
    expect(mixed).toBeNull();
    expect(none).toBeNull();
  });

  it("the PO's own order wins over the lines; its style comes next", async () => {
    db.orders.findMany.mockResolvedValue([
      { id: 'ord-1', orderNumber: 'SO2609-0012', customerId: KASYA.id, customers: { name: KASYA.name } },
    ]);
    db.styles.findMany.mockResolvedValue([{ id: 'sty-1', styleCode: 'ESSKY082LS', customer: { name: 'Easybuy' } }]);
    db.label_master.findMany.mockResolvedValue([label('lbl-e', EASYBUY)]);
    const [byOrder, byStyle] = await resolvePoForBuyers([
      { ...bare('po-o', [labelLine('lbl-e')]), orderId: 'ord-1' },
      { ...bare('po-s', [labelLine('lbl-e')]), styleId: 'sty-1' },
    ]);
    expect(byOrder).toEqual({ name: KASYA.name, source: 'ORDER', orderNumber: 'SO2609-0012', styleCode: null });
    expect(byStyle).toEqual({ name: 'Easybuy', source: 'STYLE', orderNumber: null, styleCode: 'ESSKY082LS' });
    // neither fell through to the lines
    expect(db.label_master.findMany).not.toHaveBeenCalled();
  });

  it("an MRP PO (no orderId) reads its requirement links' orders — several orders of one buyer name no order", async () => {
    db.requirement_po_links.findMany.mockResolvedValue([
      { purchaseOrderId: 'po-mrp', material_requirements: { orderId: 'ord-1' } },
      { purchaseOrderId: 'po-mrp', material_requirements: { orderId: 'ord-2' } },
      { purchaseOrderId: 'po-split', material_requirements: { orderId: 'ord-1' } },
      { purchaseOrderId: 'po-split', material_requirements: { orderId: 'ord-3' } },
    ]);
    db.orders.findMany.mockResolvedValue([
      { id: 'ord-1', orderNumber: 'SO-1', customerId: KASYA.id, customers: { name: KASYA.name } },
      { id: 'ord-2', orderNumber: 'SO-2', customerId: KASYA.id, customers: { name: KASYA.name } },
      { id: 'ord-3', orderNumber: 'SO-3', customerId: EASYBUY.id, customers: { name: EASYBUY.name } },
    ]);
    db.label_master.findMany.mockResolvedValue([label('lbl-e', EASYBUY)]);
    const [mrp, split] = await resolvePoForBuyers([
      bare('po-mrp', [labelLine('lbl-e')]),
      bare('po-split', [labelLine('lbl-e')]), // orders of two buyers → nobody, even though the lines agree
    ]);
    expect(mrp).toEqual({ name: KASYA.name, source: 'ORDER', orderNumber: null, styleCode: null });
    expect(split).toBeNull();
  });

  it('a page of POs costs one query per source, not one per PO', async () => {
    db.label_master.findMany.mockResolvedValue([label('lbl-e', EASYBUY), label('lbl-k', KASYA)]);
    const out = await resolvePoForBuyers([
      bare('po-1', [labelLine('lbl-e')]),
      bare('po-2', [labelLine('lbl-k'), labelLine('lbl-k')]),
      bare('po-3', [labelLine('lbl-e'), labelLine('lbl-k')]),
    ]);
    expect(out.map((b) => b?.name ?? null)).toEqual(['Easybuy', KASYA.name, null]);
    expect(db.requirement_po_links.findMany).toHaveBeenCalledTimes(1);
    expect(db.label_master.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('poForBuyerLine', () => {
  it('names the order or style only when that is the source', () => {
    expect(poForBuyerLine(null)).toBeNull();
    expect(poForBuyerLine({ name: 'Easybuy', source: 'LINES', orderNumber: null, styleCode: null })).toBe('Easybuy');
    expect(poForBuyerLine({ name: 'Easybuy', source: 'ORDER', orderNumber: 'SO-1', styleCode: null })).toBe(
      'Easybuy · Order SO-1'
    );
    expect(poForBuyerLine({ name: 'Easybuy', source: 'STYLE', orderNumber: null, styleCode: 'ESSKY082LS' })).toBe(
      'Easybuy · Style ESSKY082LS'
    );
  });
});
