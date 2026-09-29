/**
 * Where a new PO delivers when nobody chose a place (helpers/po-default-delivery.helper.ts, owner 2026-09-29):
 * our store for every category except greige and greige lace. The store is `getDefaultWarehouseId`'s answer —
 * whose last-resort fallback is the oldest warehouse of ANY type, cached for the life of the process — so the row
 * is checked: a processor's unit, an in-transit location or a deactivated store is never the default.
 */
import {
  companyStore,
  defaultDeliveryLocationId,
  getPoDeliveryDefault,
  takesDefaultDelivery,
} from '../../services/helpers/po-default-delivery.helper';

type Row = { id: string; warehouseCode: string; warehouseName: string; isActive: boolean; warehouseType: string };

/** A client whose default warehouse is always W1 (getDefaultWarehouseId caches its first answer), with this row */
const clientWith = (row: Row | null) =>
  ({
    warehouses: {
      findFirst: jest.fn().mockResolvedValue({ id: 'W1' }),
      findUnique: jest.fn().mockResolvedValue(row),
    },
  }) as never;

const kashaya: Row = {
  id: 'W1',
  warehouseCode: 'WH-RM-0001',
  warehouseName: 'Kashaya Fabs',
  isActive: true,
  warehouseType: 'RAW_MATERIAL',
};

describe('takesDefaultDelivery', () => {
  it('every category but greige and greige lace — a PO with no category is General', () => {
    for (const category of ['TRIMS', 'ACCESSORIES', 'FABRIC', 'LACE', 'THREAD', 'MACHINE_PART', 'GENERAL']) {
      expect(takesDefaultDelivery(category)).toBe(true);
    }
    expect(takesDefaultDelivery(undefined)).toBe(true);
    expect(takesDefaultDelivery(null)).toBe(true);
    expect(takesDefaultDelivery('GREIGE')).toBe(false);
    expect(takesDefaultDelivery('GREIGE_LACE')).toBe(false);
  });
});

describe('companyStore', () => {
  it('is our store when it is an active store', async () => {
    expect(await companyStore(clientWith(kashaya))).toEqual({
      id: 'W1',
      warehouseCode: 'WH-RM-0001',
      warehouseName: 'Kashaya Fabs',
    });
  });

  it("is nothing when the warehouse found is a processor's unit, in transit, deactivated or gone", async () => {
    expect(await companyStore(clientWith({ ...kashaya, warehouseType: 'JOB_WORK' }))).toBeNull();
    expect(await companyStore(clientWith({ ...kashaya, warehouseType: 'TRANSIT' }))).toBeNull();
    expect(await companyStore(clientWith({ ...kashaya, isActive: false }))).toBeNull();
    expect(await companyStore(clientWith(null))).toBeNull();
  });
});

describe('defaultDeliveryLocationId / getPoDeliveryDefault', () => {
  it('our store for a Trims PO, "to be advised" (null) for greige and greige lace', async () => {
    expect(await defaultDeliveryLocationId(clientWith(kashaya), 'TRIMS')).toBe('W1');
    expect(await defaultDeliveryLocationId(clientWith(kashaya), 'GREIGE')).toBeNull();
    expect(await defaultDeliveryLocationId(clientWith(kashaya), 'GREIGE_LACE')).toBeNull();
    expect(await defaultDeliveryLocationId(clientWith({ ...kashaya, warehouseType: 'JOB_WORK' }), 'TRIMS')).toBeNull();
  });

  it('tells the Create PO page the store and the exceptions', async () => {
    expect(await getPoDeliveryDefault(clientWith(kashaya))).toEqual({
      warehouse: { id: 'W1', warehouseCode: 'WH-RM-0001', warehouseName: 'Kashaya Fabs' },
      exceptCategories: ['GREIGE', 'GREIGE_LACE'],
    });
  });
});
