/**
 * The "Deliver To" of a printed purchase order — one rule for the HTML print and the pdfkit
 * fallback.
 *
 * Until 2026-09-25 a PO with no delivery location printed OUR address, although the team leaves it
 * blank precisely when the place is decided at dispatch (all five such POs went straight to dyers),
 * and a PO to our own store printed just the store's name, because the store record carries no
 * address. Our address lives in ONE place — Settings → Company Profile — so an own store without
 * an address prints that, and is never retyped into Warehouses.
 */

export interface PoDeliveryWarehouse {
  warehouseName: string;
  warehouseType: string;
  address: string | null;
  city: string | null;
  pincode: string | null;
}

export interface PoDeliverTo {
  /** No location on the PO: the supplier is told the place comes before dispatch. */
  toBeAdvised: boolean;
  /** The place's name, or null when to be advised. */
  name: string | null;
  /** Address lines under the name (may be empty for a processor unit with none on file). */
  addressLines: string[];
  /** "Name — address" on one line, or the to-be-advised sentence. */
  oneLine: string;
  /** Short phrase for the delivery term: "Delivery to <placeName> during working hours…" */
  placeName: string;
}

export const TO_BE_ADVISED_LINE = 'To be advised before dispatch — we will confirm the delivery address in writing';

/**
 * @param wh          the PO's delivery warehouse, or null when none is set
 * @param ourAddress  the default company profile's address line (companyProfileService)
 */
export function resolvePoDeliverTo(wh: PoDeliveryWarehouse | null, ourAddress: string): PoDeliverTo {
  if (!wh) {
    return {
      toBeAdvised: true,
      name: null,
      addressLines: [],
      oneLine: TO_BE_ADVISED_LINE,
      placeName: 'the address we confirm before dispatch',
    };
  }
  const own = [wh.address, [wh.city, wh.pincode].filter((b) => (b ?? '').trim()).join(' ')]
    .map((b) => (b ?? '').trim())
    .filter((b) => b.length > 0);
  // Our own store with no address of its own prints the company address. A processor's unit never
  // borrows ours — it would send the goods to the wrong place.
  const lines = own.length > 0 ? own : wh.warehouseType !== 'JOB_WORK' && ourAddress.trim() ? [ourAddress.trim()] : [];
  return {
    toBeAdvised: false,
    name: wh.warehouseName,
    addressLines: lines,
    oneLine: lines.length > 0 ? `${wh.warehouseName} — ${lines.join(', ')}` : wh.warehouseName,
    placeName: wh.warehouseName,
  };
}
