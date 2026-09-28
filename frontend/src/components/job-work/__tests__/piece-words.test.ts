/**
 * Rolls are rolls, and a lot with no list says so (2026-09-28). 7 of 10 received greige lots are
 * roll-wise; the picker used to call them "25 thans in 1 bales" / "Bale — · T12". These pin the words
 * the issue screens, the picker and the Greige Stock page use.
 */
import { describe, expect, it } from 'vitest';
import {
  allPiecesPicked,
  baleCountOf,
  bestFitThans,
  endPieceFrom,
  fabricPicksPayload,
  fitParts,
  noListNote,
  pieceKindOf,
  pieceWord,
  piecesListedBy,
  piecesSummary,
  thanLabel,
} from '../lot-rows';
import type { GreigeLotThans, GreigeStockDetail } from '@/services/jobWorkOrder.service';

let seq = 0;
function piece(opts: Partial<GreigeStockDetail> = {}): GreigeStockDetail {
  seq += 1;
  return {
    id: `p${seq}`,
    baleNumber: null,
    sequenceNo: seq,
    meters: 100,
    metersRemaining: 100,
    status: 'AVAILABLE',
    baleNo: null,
    thanNo: null,
    remarks: null,
    detailType: 'THAN',
    ...opts,
  };
}
function lot(details: GreigeStockDetail[], extra: Partial<GreigeLotThans> = {}): GreigeLotThans {
  return {
    stockId: 'lot',
    greigeCode: 'GRG-0039',
    baleCount: null,
    thanCount: null,
    totalAvailable: 4493.24,
    foldLengthCm: null,
    details,
    ...extra,
  };
}

describe('piece labels', () => {
  it('names a baled than by its printed bale and tag, never "TT-…"', () => {
    expect(thanLabel(piece({ baleNumber: 3, baleNo: '417', thanNo: 'T-1000' }))).toBe('Bale 417 · T-1000');
    expect(thanLabel(piece({ baleNumber: 3, sequenceNo: 5 }))).toBe('Bale 3 · T5');
  });

  it('names a loose than and a roll as themselves', () => {
    expect(thanLabel(piece({ sequenceNo: 12 }))).toBe('Than 12');
    expect(thanLabel(piece({ detailType: 'ROLL', thanNo: 'R-55' }))).toBe('Roll R-55');
    expect(thanLabel(piece({ detailType: 'ROLL', sequenceNo: 4 }))).toBe('Roll 4');
  });

  it('counts only real bales — loose thans and rolls are in none', () => {
    expect(baleCountOf(lot([piece({ detailType: 'ROLL' }), piece({ detailType: 'ROLL' })]))).toBe(0);
    expect(
      baleCountOf(lot([piece({ baleNumber: 1 }), piece({ baleNumber: 1 }), piece({ baleNumber: 2 }), piece()]))
    ).toBe(2);
  });
});

describe('thans or rolls', () => {
  it('reads the kind from the pieces, else from the lot', () => {
    expect(pieceKindOf(lot([piece({ detailType: 'ROLL' })]))).toBe('ROLL');
    expect(pieceKindOf(lot([piece(), piece({ detailType: 'ROLL' })]))).toBe('MIXED');
    expect(pieceKindOf(lot([], { pieceKind: 'ROLL' }))).toBe('ROLL');
    expect(pieceKindOf(lot([]))).toBeNull();
    expect(pieceKindOf(undefined)).toBeNull();
  });

  it('words it', () => {
    expect(pieceWord('ROLL', 1)).toBe('roll');
    expect(pieceWord('ROLL', 3)).toBe('rolls');
    expect(pieceWord('THAN', 2)).toBe('thans');
    expect(pieceWord('MIXED', 2)).toBe('pieces');
    expect(pieceWord(null, 2)).toBe('thans');
  });

  it('describes a best fit of rolls as whole rolls, not bales', () => {
    const rolls = lot([100, 100, 100, 100].map((m) => piece({ detailType: 'ROLL', meters: m, metersRemaining: m })));
    const fit = bestFitThans(rolls, 200)!;
    expect(fitParts(rolls, fit)).toBe('2 whole rolls');
    const baled = lot([1, 1, 2, 2].map((b) => piece({ baleNumber: b })));
    expect(fitParts(baled, bestFitThans(baled, 200)!)).toBe('1 whole bale');
  });
});

describe('a lot with no list', () => {
  it('says so, and why, when it never had one', () => {
    expect(
      noListNote(lot([], { piecesRecorded: 0, receipt: { grnNumber: 'GRN2608-0004', entryMode: 'TOTAL_METERS' } }))
    ).toBe(
      'GRG-0039 has no bale, than or roll list — it goes by quantity. (Received on GRN2608-0004 as Total Meters.)'
    );
    expect(noListNote(lot([], { piecesRecorded: 0, sourceType: 'MANUAL' }))).toContain('(Entered by hand.)');
  });

  it('says when its list is used up', () => {
    expect(noListNote(lot([], { piecesRecorded: 7, pieceKind: 'ROLL', totalAvailable: 421.5 }))).toBe(
      "Every roll on GRG-0039's list has gone — the 421.5 m left goes by quantity."
    );
  });

  it('sums a lot up for the Greige Stock page', () => {
    expect(piecesSummary(undefined)).toBe('No list');
    expect(piecesSummary({ total: 0, left: 0, bales: 0, kind: null })).toBe('No list');
    expect(piecesSummary({ total: 25, left: 25, bales: 0, kind: 'ROLL' })).toBe('25 rolls');
    expect(piecesSummary({ total: 109, left: 64, bales: 7, kind: 'THAN' })).toBe('64 of 109 thans left · 7 bales');
    expect(piecesSummary({ total: 25, left: 0, bales: 0, kind: 'ROLL' })).toBe('All 25 rolls gone');
  });
});

describe('pieces a job can have taken', () => {
  it('keeps only pieces listed by the time the job took its cloth', () => {
    const early = piece({ createdAt: '2026-09-20T10:00:00.000Z' });
    const counted = piece({ createdAt: '2026-09-28T10:00:00.000Z' });
    const listed = piecesListedBy(lot([early, counted]), '2026-09-25T07:34:04.790Z')!;
    expect(listed.details.map((d) => d.id)).toEqual([early.id]);
    expect(piecesListedBy(lot([early, counted]), undefined)!.details).toHaveLength(2);
  });
});

// Dyed / printed fabric lots keep their rolls & thans too — the same words, plus the end piece
describe('finished-fabric lots (2026-09-28)', () => {
  it('names an end piece back from cutting by its batch', () => {
    expect(thanLabel(piece({ source: 'END', remarks: 'End from CB-WO2609-0087-002', detailType: 'ROLL' }))).toBe(
      'End · CB-WO2609-0087-002'
    );
    expect(endPieceFrom('End from CB-1')).toBe('CB-1');
    expect(endPieceFrom(null)).toBeNull();
  });

  it('names the lot by its label in the no-list note', () => {
    const fabricLot = lot([], {
      greigeCode: null,
      lotLabel: 'FAB-ESSKY082LS-001 · GRN2609-1212',
      totalAvailable: 1893.5,
      piecesRecorded: 0,
    });
    expect(noListNote(fabricLot)).toMatch(/^FAB-ESSKY082LS-001 · GRN2609-1212 has no bale, than or roll list/);
  });

  it('starts a lot going to cutting with every piece ticked, whole', () => {
    const a = piece({ metersRemaining: 45.5 });
    const b = piece({ metersRemaining: 100 });
    expect(allPiecesPicked(lot([a, b]))).toEqual([
      { detailId: a.id, metersToIssue: '45.5' },
      { detailId: b.id, metersToIssue: '100' },
    ]);
  });

  it('posts fabric picks by their fabric piece id, blanks dropped', () => {
    expect(
      fabricPicksPayload([
        { detailId: 'f1', metersToIssue: '100' },
        { detailId: 'f2', metersToIssue: '' },
      ])
    ).toEqual([{ fabricStockDetailId: 'f1', metersToIssue: 100 }]);
  });
});
