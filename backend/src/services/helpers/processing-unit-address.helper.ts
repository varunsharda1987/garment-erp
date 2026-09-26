/**
 * A processor's "… - Processing Unit" carries the processor's address (direct-to-processor plan, Phase 3,
 * 2026-09-26). A PO that ships goods straight to a dyer prints the unit as the ship-to, so the unit needs
 * the dyer's address — but until now the unit got only the supplier's free-text address line at creation
 * (never its city, state or pincode) and nothing afterwards: none of the 14 dyeing units had an address.
 *
 * The processor's address lives on the supplier master. It is copied into the unit — its shipping
 * address, else its billing address — ONLY when the unit's whole address block is blank, so an address
 * someone typed on the warehouse is never overwritten. Called on supplier create and update, and by
 * scripts/backfill-processing-unit-addresses.ts for the units that exist.
 */
import type { Prisma } from '@prisma/client';

type Client = Pick<Prisma.TransactionClient, 'suppliers' | 'warehouses'>;

export interface UnitAddress {
  address: string;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export const SUPPLIER_ADDRESS_SELECT = {
  address: true,
  billingPincode: true,
  shippingAddress: true,
  shippingPincode: true,
  billing_city: { select: { cityName: true } },
  billing_state: { select: { stateName: true } },
  shipping_city: { select: { cityName: true } },
  shipping_state: { select: { stateName: true } },
  // Some suppliers carry their address only on the GSTIN row
  gst_numbers: {
    where: { isPrimary: true },
    take: 1,
    select: {
      billingAddress: true,
      billingPincode: true,
      stateName: true,
      billing_city: { select: { cityName: true } },
    },
  },
} as const satisfies Prisma.suppliersSelect;

type SupplierAddress = Prisma.suppliersGetPayload<{ select: typeof SUPPLIER_ADDRESS_SELECT }>;

const clean = (v: string | null | undefined) => {
  const t = (v ?? '').trim();
  return t.length > 0 ? t : null;
};

/**
 * Where goods for this processor go: its shipping address when it has one, else its billing address,
 * else the address on its primary GSTIN.
 */
export function processorShipToAddress(s: SupplierAddress): UnitAddress | null {
  const shipping = clean(s.shippingAddress);
  if (shipping) {
    return {
      address: shipping,
      city: clean(s.shipping_city?.cityName),
      state: clean(s.shipping_state?.stateName),
      pincode: clean(s.shippingPincode),
    };
  }
  const billing = clean(s.address);
  if (billing) {
    return {
      address: billing,
      city: clean(s.billing_city?.cityName),
      state: clean(s.billing_state?.stateName),
      pincode: clean(s.billingPincode),
    };
  }
  const gst = s.gst_numbers[0];
  const gstAddress = clean(gst?.billingAddress);
  if (gst && gstAddress) {
    return {
      address: gstAddress,
      city: clean(gst.billing_city?.cityName),
      state: clean(gst.stateName),
      pincode: clean(gst.billingPincode),
    };
  }
  return null;
}

/** A unit whose address, city, state and pincode are all empty — the only kind this ever writes. */
export function unitAddressBlank(w: {
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}) {
  return !clean(w.address) && !clean(w.city) && !clean(w.state) && !clean(w.pincode);
}

export interface UnitAddressSync {
  warehouseId: string;
  warehouseName: string;
  address: UnitAddress;
}

/**
 * The address writes this processor's units need: one per unit whose address block is blank, when the
 * processor has an address. Pure read — `syncProcessingUnitAddress` applies it.
 */
export async function planProcessingUnitAddress(client: Client, supplierId: string): Promise<UnitAddressSync[]> {
  const [supplier, units] = await Promise.all([
    client.suppliers.findUnique({ where: { id: supplierId }, select: SUPPLIER_ADDRESS_SELECT }),
    client.warehouses.findMany({
      where: { supplierId, warehouseType: 'JOB_WORK' },
      select: { id: true, warehouseName: true, address: true, city: true, state: true, pincode: true },
    }),
  ]);
  const address = supplier ? processorShipToAddress(supplier) : null;
  if (!address) return [];
  return units.filter(unitAddressBlank).map((u) => ({ warehouseId: u.id, warehouseName: u.warehouseName, address }));
}

/** Copy the processor's address into its units whose address block is blank. Returns what it wrote. */
export async function syncProcessingUnitAddress(client: Client, supplierId: string): Promise<UnitAddressSync[]> {
  const writes = await planProcessingUnitAddress(client, supplierId);
  for (const w of writes) {
    // Guarded: only if still blank (a warehouse edit may have landed in between)
    await client.warehouses.updateMany({
      where: {
        id: w.warehouseId,
        OR: [{ address: null }, { address: '' }],
        AND: [
          { OR: [{ city: null }, { city: '' }] },
          { OR: [{ state: null }, { state: '' }] },
          { OR: [{ pincode: null }, { pincode: '' }] },
        ],
      },
      data: { ...w.address },
    });
  }
  return writes;
}
