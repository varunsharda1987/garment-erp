/**
 * INV-01 (e-Invoice schema v1.1) payload builder.
 *
 * Pure mapping from a fully-resolved invoice structure to the IRP JSON schema.
 * All data loading, fallback chains, and validation live in einvoice-preflight.ts —
 * this file never touches Prisma or settings.
 */

export interface Inv01Item {
  SlNo: string;
  PrdDesc: string;
  IsServc: 'Y' | 'N';
  HsnCd: string;
  Qty: number;
  Unit: string;
  UnitPrice: number;
  TotAmt: number;
  Discount: number;
  AssAmt: number;
  GstRt: number;
  IgstAmt: number;
  CgstAmt: number;
  SgstAmt: number;
  TotItemVal: number;
}

export interface Inv01Party {
  Gstin: string;
  LglName: string;
  TrdName?: string;
  Addr1: string;
  Addr2?: string;
  Loc: string;
  Pin: number;
  Stcd: string;
  Ph?: string;
  Em?: string;
}

export interface Inv01Payload {
  Version: '1.1';
  TranDtls: {
    TaxSch: 'GST';
    SupTyp: string;
    RegRev: 'Y' | 'N';
    IgstOnIntra: 'Y' | 'N';
  };
  DocDtls: {
    Typ: 'INV' | 'CRN' | 'DBN';
    No: string;
    Dt: string; // dd/MM/yyyy
  };
  SellerDtls: Inv01Party;
  BuyerDtls: Inv01Party & { Pos: string };
  ItemList: Inv01Item[];
  ValDtls: {
    AssVal: number;
    CgstVal: number;
    SgstVal: number;
    IgstVal: number;
    RndOffAmt: number;
    TotInvVal: number;
  };
}

export interface ResolvedParty {
  gstin: string;
  legalName: string;
  tradeName?: string;
  addr1: string;
  addr2?: string;
  location: string;
  pincode: string;
  stateCode: string;
  phone?: string;
  email?: string;
}

export interface ResolvedItem {
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}

export interface ResolvedInvoice {
  docType: 'INV' | 'CRN' | 'DBN';
  docNo: string;
  docDate: Date;
  supTyp: string; // B2B | SEZWP | SEZWOP | EXPWP | EXPWOP | DEXP
  isInterstate: boolean;
  seller: ResolvedParty;
  buyer: ResolvedParty;
  placeOfSupplyStateCode: string;
  items: ResolvedItem[];
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function formatIrpDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

/** Split a free-text address into Addr1 (≤100 chars, required) + Addr2 (≤100 chars). */
export function splitAddress(address: string): { addr1: string; addr2?: string } {
  const clean = address.replace(/\s+/g, ' ').trim();
  if (clean.length <= 100) return { addr1: clean };
  // Break at the last comma/space before the 100-char limit
  let breakAt = clean.lastIndexOf(',', 100);
  if (breakAt < 20) breakAt = clean.lastIndexOf(' ', 100);
  if (breakAt < 20) breakAt = 100;
  const addr1 = clean.slice(0, breakAt).replace(/[,\s]+$/, '');
  const addr2 = clean
    .slice(breakAt)
    .replace(/^[,\s]+/, '')
    .slice(0, 100);
  return addr2 ? { addr1, addr2 } : { addr1 };
}

function toParty(p: ResolvedParty): Inv01Party {
  const party: Inv01Party = {
    Gstin: p.gstin,
    LglName: p.legalName.slice(0, 100),
    Addr1: p.addr1.slice(0, 100),
    Loc: p.location.slice(0, 50),
    Pin: Number(p.pincode),
    Stcd: p.stateCode,
  };
  if (p.tradeName?.trim()) party.TrdName = p.tradeName.slice(0, 100);
  if (p.addr2?.trim()) party.Addr2 = p.addr2.slice(0, 100);
  if (p.phone?.trim()) party.Ph = p.phone.replace(/\D/g, '').slice(-12) || undefined;
  if (p.email?.trim()) party.Em = p.email.slice(0, 100);
  return party;
}

export function buildInv01Payload(inv: ResolvedInvoice): Inv01Payload {
  const items: Inv01Item[] = inv.items.map((item, index) => {
    const assAmt = round2(item.totalPrice);
    const cgst = inv.isInterstate ? 0 : round2(item.cgstAmount);
    const sgst = inv.isInterstate ? 0 : round2(item.sgstAmount);
    const igst = inv.isInterstate ? round2(item.igstAmount) : 0;
    return {
      SlNo: String(index + 1),
      PrdDesc: item.description.slice(0, 300),
      IsServc: 'N',
      HsnCd: item.hsnCode,
      Qty: item.quantity,
      Unit: item.unit,
      UnitPrice: round2(item.unitPrice),
      TotAmt: assAmt,
      Discount: 0,
      AssAmt: assAmt,
      GstRt: item.gstRate,
      IgstAmt: igst,
      CgstAmt: cgst,
      SgstAmt: sgst,
      TotItemVal: round2(assAmt + cgst + sgst + igst),
    };
  });

  const rndOff = round2(inv.totalAmount - (inv.subtotal + inv.cgstAmount + inv.sgstAmount + inv.igstAmount));

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: inv.supTyp,
      RegRev: 'N',
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: inv.docType,
      No: inv.docNo,
      Dt: formatIrpDate(inv.docDate),
    },
    SellerDtls: toParty(inv.seller),
    BuyerDtls: { ...toParty(inv.buyer), Pos: inv.placeOfSupplyStateCode },
    ItemList: items,
    ValDtls: {
      AssVal: round2(inv.subtotal),
      CgstVal: round2(inv.cgstAmount),
      SgstVal: round2(inv.sgstAmount),
      IgstVal: round2(inv.igstAmount),
      RndOffAmt: rndOff,
      TotInvVal: round2(inv.totalAmount),
    },
  };
}
