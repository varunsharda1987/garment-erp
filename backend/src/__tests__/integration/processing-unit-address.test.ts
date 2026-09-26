/**
 * A processor's unit takes the processor's address — shipping, else billing, else its GSTIN row's — and
 * only when the unit's whole address block is blank (helpers/processing-unit-address.helper.ts,
 * 2026-09-26). A PO shipping straight to a dyer prints the unit as the ship-to; none of the 25 units had
 * an address.
 */
import { prisma, createTestUser } from '../helpers/test-utils';
import {
  processorShipToAddress,
  syncProcessingUnitAddress,
  unitAddressBlank,
} from '../../services/helpers/processing-unit-address.helper';
import { supplierService } from '../../services/supplier.service';

const RUN = `PUA${Date.now().toString(36).toUpperCase()}`;
let userId: string;
const supplierIds: string[] = [];
const unitIds: string[] = [];

const noAddress = {
  address: null,
  billingPincode: null,
  shippingAddress: null,
  shippingPincode: null,
  billing_city: null,
  billing_state: null,
  shipping_city: null,
  shipping_state: null,
  gst_numbers: [],
};

beforeAll(async () => {
  userId = (
    await createTestUser({
      email: `test-${RUN.toLowerCase()}@smoke.test`,
      role: 'ADMIN',
      isActive: true,
      isApproved: true,
    })
  ).id;
});

afterAll(async () => {
  await prisma.warehouses.deleteMany({ where: { OR: [{ id: { in: unitIds } }, { supplierId: { in: supplierIds } }] } });
  await prisma.suppliers.deleteMany({ where: { id: { in: supplierIds } } });
  await prisma.users.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('the address a processor unit takes', () => {
  it('prefers shipping, then billing, then the GSTIN row; none gives nothing', () => {
    expect(
      processorShipToAddress({
        ...noAddress,
        shippingAddress: ' Plot 4, RIICO ',
        shippingPincode: '302020',
        address: 'Office',
      })
    ).toEqual({ address: 'Plot 4, RIICO', city: null, state: null, pincode: '302020' });
    expect(
      processorShipToAddress({ ...noAddress, address: 'Office, Sanganer', billingPincode: '302029' })?.address
    ).toBe('Office, Sanganer');
    expect(
      processorShipToAddress({
        ...noAddress,
        gst_numbers: [
          {
            billingAddress: 'GST address',
            billingPincode: '395002',
            stateName: 'Gujarat',
            billing_city: { cityName: 'Surat' },
          },
        ],
      })
    ).toEqual({ address: 'GST address', city: 'Surat', state: 'Gujarat', pincode: '395002' });
    expect(processorShipToAddress({ ...noAddress, address: '  ' })).toBeNull();
  });

  it('treats a unit as blank only when address, city, state and pincode are all empty', () => {
    expect(unitAddressBlank({ address: null, city: '', state: null, pincode: ' ' })).toBe(true);
    expect(unitAddressBlank({ address: null, city: 'Jaipur', state: null, pincode: null })).toBe(false);
  });

  it('fills a blank unit and never overwrites a typed one', async () => {
    const supplierId = (
      await prisma.suppliers.create({
        data: {
          code: `${RUN}-DY`,
          name: `${RUN} Dyer`,
          supplierCategories: ['DYEING_PRINTING'],
          shippingAddress: 'Plot 12, Sanganer',
          shippingPincode: '302029',
          createdById: userId,
        },
      })
    ).id;
    supplierIds.push(supplierId);
    const mkUnit = async (tag: string, address: string | null) => {
      const id = (
        await prisma.warehouses.create({
          data: {
            warehouseCode: `${RUN}-${tag}`,
            warehouseName: `${RUN} ${tag} - Processing Unit`,
            warehouseType: 'JOB_WORK',
            supplierId,
            address,
            createdById: userId,
          },
        })
      ).id;
      unitIds.push(id);
      return id;
    };
    const blankUnit = await mkUnit('A', null);
    const typedUnit = await mkUnit('B', 'Their own gate, typed by the store');

    const written = await syncProcessingUnitAddress(prisma, supplierId);
    expect(written.map((w) => w.warehouseId)).toEqual([blankUnit]);
    expect(await prisma.warehouses.findUniqueOrThrow({ where: { id: blankUnit } })).toMatchObject({
      address: 'Plot 12, Sanganer',
      pincode: '302029',
    });
    expect((await prisma.warehouses.findUniqueOrThrow({ where: { id: typedUnit } })).address).toBe(
      'Their own gate, typed by the store'
    );
    // A second run finds nothing to do
    expect(await syncProcessingUnitAddress(prisma, supplierId)).toEqual([]);
  });

  it('a processor saved without an address gets one on its unit when the address is added', async () => {
    const created = await supplierService.createSupplier(
      { code: `${RUN}-SV`, name: `${RUN} Saved Dyer`, supplierCategories: ['DYEING_PRINTING'] },
      userId
    );
    supplierIds.push(created.id);
    const unitOf = () =>
      prisma.warehouses.findFirstOrThrow({ where: { supplierId: created.id, warehouseType: 'JOB_WORK' } });
    expect((await unitOf()).address).toBeNull();
    await supplierService.updateSupplier(created.id, { address: '14, Sitapura', billingPincode: '302022' });
    expect(await unitOf()).toMatchObject({ address: '14, Sitapura', pincode: '302022' });
  });
});
