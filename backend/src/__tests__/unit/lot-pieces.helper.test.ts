/**
 * The pure rules a lot's roll / than list follows (services/helpers/lot-pieces.helper.ts) — shared by greige
 * and finished-fabric lots since 2026-09-28. No database.
 */
import {
  THAN_PICK_TOLERANCE_PCT,
  THAN_ROUNDING_SLACK_M,
  listStateOf,
  pieceKindOf,
  pieceWord,
  snapWholeList,
} from '../../services/helpers/lot-pieces.helper';
import * as greigeStockService from '../../services/greige-stock.service';

describe('piece words', () => {
  it('names a lot by what its pieces are', () => {
    expect(pieceKindOf([])).toBeNull();
    expect(pieceKindOf(['THAN', 'THAN'])).toBe('THAN');
    expect(pieceKindOf(['ROLL'])).toBe('ROLL');
    expect(pieceKindOf(['ROLL', 'THAN'])).toBe('MIXED');
    expect(pieceWord('ROLL', 1)).toBe('roll');
    expect(pieceWord('THAN', 3)).toBe('thans');
    expect(pieceWord('MIXED', 2)).toBe('pieces');
    expect(pieceWord(null, 2)).toBe('thans');
  });

  it('is still what greige-stock.service exports (its callers keep their imports)', () => {
    expect(greigeStockService.THAN_PICK_TOLERANCE_PCT).toBe(THAN_PICK_TOLERANCE_PCT);
    expect(greigeStockService.pieceKindOf).toBe(pieceKindOf);
    expect(greigeStockService.pieceWord).toBe(pieceWord);
  });
});

describe('listStateOf — does the list still describe the rack?', () => {
  it('a lot that never had a list', () => {
    expect(listStateOf({ piecesRecorded: 0, listActual: 0, onHand: 500 })).toBe('NO_LIST');
    expect(listStateOf({ piecesRecorded: 0, listActual: 0, onHand: 0 })).toBe('NO_LIST');
  });

  it('every listed piece gone while metres are on hand', () => {
    expect(listStateOf({ piecesRecorded: 12, listActual: 0, onHand: 37.5 })).toBe('LIST_EMPTY');
  });

  it('an empty lot with an empty list is in step (dust included)', () => {
    expect(listStateOf({ piecesRecorded: 12, listActual: 0, onHand: 0 })).toBe('IN_STEP');
    expect(listStateOf({ piecesRecorded: 12, listActual: 0.002, onHand: 0.003 })).toBe('IN_STEP');
  });

  it('within ±1% of on hand is in step; beyond is out of step', () => {
    expect(listStateOf({ piecesRecorded: 26, listActual: 3683.2, onHand: 3683.2 })).toBe('IN_STEP');
    expect(listStateOf({ piecesRecorded: 10, listActual: 1009, onHand: 1000 })).toBe('IN_STEP');
    expect(listStateOf({ piecesRecorded: 10, listActual: 991, onHand: 1000 })).toBe('IN_STEP');
    expect(listStateOf({ piecesRecorded: 10, listActual: 1011, onHand: 1000 })).toBe('OUT_OF_STEP');
    expect(listStateOf({ piecesRecorded: 8, listActual: 800, onHand: 500 })).toBe('OUT_OF_STEP');
  });

  it('a list with metres on an empty lot is out of step', () => {
    expect(listStateOf({ piecesRecorded: 4, listActual: 400, onHand: 0 })).toBe('OUT_OF_STEP');
  });

  it('rounding slack protects a small lot', () => {
    // 1% of 5 m is 0.05 m; the list's own rounding may differ by up to the slack
    expect(listStateOf({ piecesRecorded: 1, listActual: 5 + THAN_ROUNDING_SLACK_M, onHand: 5 })).toBe('IN_STEP');
  });
});

describe('snapWholeList — taking every piece takes the whole lot', () => {
  it('snaps within the rounding slack when every piece is taken', () => {
    expect(snapWholeList(3683.19, { takesEveryPiece: true, onHand: 3683.2 })).toBe(3683.2);
    expect(snapWholeList(499.95, { takesEveryPiece: true, onHand: 500 })).toBe(500);
  });

  it('never snaps a part pick, or a whole pick beyond the slack', () => {
    expect(snapWholeList(196, { takesEveryPiece: false, onHand: 196.05 })).toBe(196);
    expect(snapWholeList(480, { takesEveryPiece: true, onHand: 500 })).toBe(480);
  });
});
