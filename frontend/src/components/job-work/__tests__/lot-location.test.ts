/**
 * Where the lots are, on the issue screens (direct-to-processor plan, Phase 2 — 2026-09-25): cloth
 * already at the job's processor is offered and taken first, oldest first; our stores after it,
 * largest first; the sent date can never be after today or before a chosen lot got where it is.
 */
import { describe, expect, it } from 'vitest';
import {
  autoFillLotRows,
  checkSentDate,
  earliestSentDate,
  groupLotsForIssue,
  issueMovement,
  lotOptionLabel,
  sortLotsForIssue,
} from '../lot-rows';
import type { JwoIssueLotLocation, JwoIssuePreviewLot } from '@/services/jobWorkOrder.service';

function location(patch: Partial<JwoIssueLotLocation>): JwoIssueLotLocation {
  return {
    category: 'OUR_STORE',
    holderName: null,
    warehouseName: 'Kashaya Fabs',
    drawnWhereItLies: false,
    legacyUnitLot: false,
    coveringChallanNumber: null,
    ...patch,
  };
}
function lot(id: string, qty: number, receivedDate: string, loc: Partial<JwoIssueLotLocation>): JwoIssuePreviewLot {
  return {
    id,
    greigeId: 'g1',
    greigeCode: 'GRG-0072',
    greigeName: 'Cotton Flex',
    greigeWidth: 63,
    quantityAvailable: qty,
    receivedDate,
    weaverName: null,
    location: location(loc),
  };
}

const held = lot('held', 3000, '2026-09-20', {
  category: 'AT_THIS_PROCESSOR',
  holderName: 'Aryan Dyeing',
  warehouseName: 'Aryan Dyeing - Processing Unit',
  drawnWhereItLies: true,
  coveringChallanNumber: 'CH2609-0300',
});
const heldOlder = lot('held-older', 1000, '2026-08-12', {
  category: 'AT_THIS_PROCESSOR',
  holderName: 'Aryan Dyeing',
  warehouseName: 'Aryan Dyeing - Processing Unit',
  drawnWhereItLies: true,
  coveringChallanNumber: 'CH2609-0200',
});
const unitLot = lot('unit', 800, '2026-08-12', {
  category: 'AT_THIS_PROCESSOR',
  holderName: 'Aryan Dyeing',
  warehouseName: 'Aryan Dyeing - Processing Unit',
  legacyUnitLot: true,
});
const storeSmall = lot('store-small', 2000, '2026-09-01', {});
const storeBig = lot('store-big', 6000, '2026-09-10', {});

describe('sortLotsForIssue', () => {
  it('puts cloth at the processor first (oldest first), then stores largest first', () => {
    const sorted = sortLotsForIssue([storeSmall, held, storeBig, heldOlder]);
    expect(sorted.map((l) => l.id)).toEqual(['held-older', 'held', 'store-big', 'store-small']);
  });
});

describe('groupLotsForIssue', () => {
  it('sections held lots, unit lots not yet booked there, and each store', () => {
    const groups = groupLotsForIssue([storeBig, unitLot, held], 'Aryan Dyeing');
    expect(groups.map((g) => g.key)).toEqual(['unit', 'held', 'store:Kashaya Fabs']);
    expect(groups.find((g) => g.key === 'held')!.label).toBe('Already at Aryan Dyeing — no dispatch needed');
    expect(groups.find((g) => g.key === 'unit')!.label).toContain('goes on a challan');
    expect(groups.find((g) => g.key === 'store:Kashaya Fabs')!.label).toBe('In Kashaya Fabs');
  });

  it('a lace lot (no location) lands in our store', () => {
    const lace = { ...storeBig, id: 'lace', location: undefined };
    expect(groupLotsForIssue([lace], 'Aryan Dyeing')[0].label).toBe('In our store');
  });
});

describe('lotOptionLabel', () => {
  it('names the weaver and where the lot is since when', () => {
    const label = lotOptionLabel({ ...held, weaverName: 'Mangal Weaves' });
    expect(label).toContain('GRG-0072 — Cotton Flex (3,000 m, 63″)');
    expect(label).toContain('Weaver Mangal Weaves');
    expect(label).toContain('at Aryan Dyeing since 20-Sep-2026');
  });

  it('names the store for a store lot', () => {
    expect(lotOptionLabel(storeBig)).toContain('· in Kashaya Fabs');
  });
});

describe('autoFillLotRows', () => {
  it('takes the cloth already at the dyer before any store lot', () => {
    const rows = autoFillLotRows([storeBig, held], 4000, [{ lotId: '', qty: '' }])!;
    expect(rows.map((r) => [r.lotId, r.qty])).toEqual([
      ['held', '3000'],
      ['store-big', '1000'],
    ]);
  });
});

describe('issueMovement', () => {
  it('nothing travels when every chosen lot is drawn where it lies', () => {
    expect(issueMovement([{ lotId: 'held', qty: '3000' }], [held, storeBig])).toEqual({
      travels: false,
      drawsHere: true,
    });
  });

  it('a store lot travels; a unit lot not yet booked there still goes on a challan', () => {
    expect(
      issueMovement(
        [
          { lotId: 'held', qty: '1' },
          { lotId: 'store-big', qty: '1' },
        ],
        [held, storeBig]
      ).travels
    ).toBe(true);
    expect(issueMovement([{ lotId: 'unit', qty: '1' }], [unitLot]).travels).toBe(true);
  });
});

describe('checkSentDate', () => {
  const today = '2026-09-25';

  it('refuses a date after today', () => {
    expect(checkSentDate('2026-09-26', [storeBig], today).error).toBe('The sent date is after today.');
  });

  it('refuses a store lot leaving before it was received', () => {
    expect(checkSentDate('2026-09-09', [storeBig], today).error).toContain('was received on 10-Sep-2026');
  });

  it('refuses drawing held cloth before it reached the processor', () => {
    expect(checkSentDate('2026-09-19', [held], today).error).toContain('reached Aryan Dyeing on 20-Sep-2026');
  });

  it('warns — but allows — a date more than a week back', () => {
    const check = checkSentDate('2026-09-12', [storeBig], today);
    expect(check.error).toBeNull();
    expect(check.warning).toContain('13 days ago');
  });

  it('the earliest allowed date is the latest arrival among the chosen lots', () => {
    expect(earliestSentDate([storeBig, held, heldOlder])).toBe('2026-09-20');
  });
});
