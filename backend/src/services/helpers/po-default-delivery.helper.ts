/**
 * Where a new purchase order delivers when nobody has said — ONE rule for every PO writer: the Create PO page
 * (it shows this default), manual create, MRP "Generate PO" / bulk, unified creation and the AI assistant's
 * create action.
 *
 * Owner, 2026-09-29: "Apart from the greige the delivery location of everything has to be Kashaya Fabs by
 * default" — and greige lace is treated like greige. Greige and greige lace usually go straight to a dyer that
 * is decided later, so those POs start "to be advised" (from Requirements: the dyer's unit when the dyer is
 * known — mrp.service `generatePOFromRequirements`). Everything else is delivered to our own store.
 *
 * "Our own store" is the company warehouse every stock default already uses — Kashaya Fabs, WH-RM-0001
 * (`getDefaultWarehouseId`: the oldest active WH-RM warehouse). Its address prints from Company Profile.
 *
 * A default only fills a place nobody chose: the Create PO page shows it and can be set to "To be advised", an
 * explicit `deliveryLocationId: null` on the API stays "to be advised", and a saved PO is never changed.
 */

import type { POCategory, Prisma } from '@prisma/client';
import { getDefaultWarehouseId } from './material-sync.helper';

/** Categories that start "to be advised" instead of at our store. */
export const PO_CATEGORIES_WITHOUT_DEFAULT_DELIVERY: readonly POCategory[] = ['GREIGE', 'GREIGE_LACE'];

type WarehouseReader = Pick<Prisma.TransactionClient, 'warehouses'>;

export interface CompanyStore {
  id: string;
  warehouseCode: string;
  warehouseName: string;
}

/**
 * Our own store (Kashaya Fabs), or null when there is none to name. `getDefaultWarehouseId` falls back to the
 * oldest warehouse of ANY type and keeps its answer for the life of the process, so the row is checked here: a
 * processor's unit or an in-transit location is never a default delivery place, nor is a deactivated store.
 */
export async function companyStore(client: WarehouseReader): Promise<CompanyStore | null> {
  const id = await getDefaultWarehouseId(client);
  if (!id) return null;
  const store = await client.warehouses.findUnique({
    where: { id },
    select: { id: true, warehouseCode: true, warehouseName: true, isActive: true, warehouseType: true },
  });
  if (!store?.isActive || store.warehouseType === 'JOB_WORK' || store.warehouseType === 'TRANSIT') return null;
  return { id: store.id, warehouseCode: store.warehouseCode, warehouseName: store.warehouseName };
}

/** Whether a new PO of this category starts at our store. A PO with no category is GENERAL (the column default). */
export function takesDefaultDelivery(poCategory: POCategory | string | null | undefined): boolean {
  return !PO_CATEGORIES_WITHOUT_DEFAULT_DELIVERY.includes((poCategory || 'GENERAL') as POCategory);
}

/** Where a new PO of this category delivers when nobody chose a place: our store, or null = "to be advised". */
export async function defaultDeliveryLocationId(
  client: WarehouseReader,
  poCategory: POCategory | string | null | undefined
): Promise<string | null> {
  if (!takesDefaultDelivery(poCategory)) return null;
  return (await companyStore(client))?.id ?? null;
}

export interface PoDeliveryDefault {
  /** Our store — null when there is none, and then every new PO starts "to be advised" */
  warehouse: CompanyStore | null;
  /** The categories that start "to be advised" instead */
  exceptCategories: POCategory[];
}

/** What the Create PO page shows before the PO is saved (GET /api/purchase-orders/delivery-default). */
export async function getPoDeliveryDefault(client: WarehouseReader): Promise<PoDeliveryDefault> {
  return { warehouse: await companyStore(client), exceptCategories: [...PO_CATEGORIES_WITHOUT_DEFAULT_DELIVERY] };
}
