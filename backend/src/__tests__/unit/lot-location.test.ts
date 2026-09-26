/**
 * Where a greige lot is — the one authority (helpers/lot-location.helper.ts), direct-to-processor plan
 * 2026-09-25. A lot's holder has two homes: its processorId (delivered straight there, or parked by a
 * Stock-Out) and the processor whose "… - Processing Unit" it sits in. Every reader places lots here.
 */
import {
  greigeCountsForPlanning,
  greigeHolderId,
  laceCountsForPlanning,
  lotInProcessorUnit,
  resolveLotLocation,
  unitLotHolderId,
} from '../../services/helpers/lot-location.helper';

const store = { warehouseName: 'Kashaya Fabs', warehouseType: 'RAW_MATERIAL', supplierId: null };
const unitOf = (supplierId: string | null, name = 'Aryan Dyeing') => ({
  warehouseName: `${name} - Processing Unit`,
  warehouseType: 'JOB_WORK',
  supplierId,
  supplier: supplierId ? { name } : null,
});

const storeLot = { processorId: null, sourceType: 'GRN', warehouse: store };
const heldAtA = { processorId: 'A', sourceType: 'DIRECT', processor: { name: 'Aryan Dyeing' }, warehouse: unitOf('A') };
const legacyAtA = { processorId: null, sourceType: 'GRN', warehouse: unitOf('A') }; // the Aug-2026 lots
const transferAtB = { processorId: 'B', sourceType: 'TRANSFER', processor: { name: 'Manish' }, warehouse: store };
const transferShadow = { processorId: null, sourceType: 'TRANSFER', warehouse: store };
const unlinkedUnit = { processorId: null, sourceType: 'GRN', warehouse: unitOf(null, 'Old') };

describe('greigeHolderId', () => {
  it('reads processorId first, else the unit the lot sits in', () => {
    expect(greigeHolderId(storeLot)).toBeNull();
    expect(greigeHolderId(heldAtA)).toBe('A');
    expect(greigeHolderId(legacyAtA)).toBe('A');
    expect(greigeHolderId(transferAtB)).toBe('B');
    expect(greigeHolderId(unlinkedUnit)).toBeNull();
  });
});

describe('resolveLotLocation', () => {
  it('places a lot relative to the processor a job is for', () => {
    expect(resolveLotLocation(storeLot, 'A').category).toBe('OUR_STORE');
    expect(resolveLotLocation(heldAtA, 'A')).toMatchObject({ category: 'AT_THIS_PROCESSOR', legacyUnitLot: false });
    expect(resolveLotLocation(legacyAtA, 'A')).toMatchObject({ category: 'AT_THIS_PROCESSOR', legacyUnitLot: true });
    expect(resolveLotLocation(heldAtA, 'B')).toMatchObject({
      category: 'AT_OTHER_PROCESSOR',
      holderName: 'Aryan Dyeing',
    });
    expect(resolveLotLocation(legacyAtA, 'B').category).toBe('AT_OTHER_PROCESSOR');
  });

  it('takes the conservative answer when processorId and the unit disagree', () => {
    const conflicting = { processorId: 'A', processor: { name: 'Aryan Dyeing' }, warehouse: unitOf('B', 'Mangal') };
    expect(resolveLotLocation(conflicting, 'A').category).toBe('AT_OTHER_PROCESSOR');
  });

  it('never places a lot in a unit linked to no processor at this processor', () => {
    expect(resolveLotLocation(unlinkedUnit, 'A').category).toBe('AT_OTHER_PROCESSOR');
  });
});

describe('greigeCountsForPlanning', () => {
  it('lets every requirement plan with our stores', () => {
    expect(greigeCountsForPlanning(storeLot, 'A')).toBe(true);
    expect(greigeCountsForPlanning(storeLot, null)).toBe(true);
  });

  it("counts cloth already at the requirement's own processor, and at any processor while none is chosen", () => {
    expect(greigeCountsForPlanning(heldAtA, 'A')).toBe(true);
    expect(greigeCountsForPlanning(legacyAtA, 'A')).toBe(true);
    expect(greigeCountsForPlanning(transferAtB, 'B')).toBe(true);
    expect(greigeCountsForPlanning(heldAtA, null)).toBe(true);
  });

  it("never counts another processor's cloth once the processor is known", () => {
    expect(greigeCountsForPlanning(heldAtA, 'B')).toBe(false);
    expect(greigeCountsForPlanning(legacyAtA, 'B')).toBe(false);
    expect(greigeCountsForPlanning(transferAtB, 'A')).toBe(false);
  });

  it('never counts a Stock-Out shadow or a lot in an unlinked unit', () => {
    expect(greigeCountsForPlanning(transferShadow, null)).toBe(false);
    expect(greigeCountsForPlanning(unlinkedUnit, null)).toBe(false);
  });
});

describe('lace: placed by its unit alone (no processorId)', () => {
  const laceInStore = { warehouse: store };
  const laceAtA = { warehouse: unitOf('A') };
  const laceNoWarehouse = { warehouse: null };
  const laceInUnlinkedUnit = { warehouse: unitOf(null, 'Old') };

  it('laceCountsForPlanning mirrors the greige rule', () => {
    expect(laceCountsForPlanning(laceInStore, 'A')).toBe(true);
    expect(laceCountsForPlanning(laceNoWarehouse, 'A')).toBe(true);
    expect(laceCountsForPlanning(laceAtA, 'A')).toBe(true);
    expect(laceCountsForPlanning(laceAtA, null)).toBe(true);
    expect(laceCountsForPlanning(laceAtA, 'B')).toBe(false);
    expect(laceCountsForPlanning(laceInUnlinkedUnit, null)).toBe(false);
  });

  it('unitLotHolderId / lotInProcessorUnit read the unit', () => {
    expect(unitLotHolderId(laceAtA)).toBe('A');
    expect(unitLotHolderId(laceInStore)).toBeNull();
    expect(unitLotHolderId(laceInUnlinkedUnit)).toBeNull();
    expect(lotInProcessorUnit(laceAtA)).toBe(true);
    expect(lotInProcessorUnit(laceInUnlinkedUnit)).toBe(true);
    expect(lotInProcessorUnit(laceInStore)).toBe(false);
    expect(lotInProcessorUnit(laceNoWarehouse)).toBe(false);
  });
});
