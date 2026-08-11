/**
 * Order BOM trim/accessory matching + quantity resolution unit tests
 *
 * Covers the "Cost Sheet as authority" fix: cost sheet supplies quantity and price
 * for trims/accessories; style BOM quantity > 0 acts as an explicit override.
 * Pure-logic tests on private methods — no DB access.
 */

import { orderBomService } from '../../services/order-bom.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const svc = orderBomService as any;

describe('Order BOM matching helpers', () => {
  describe('normalizeName', () => {
    it('lowercases and trims', () => {
      expect(svc.normalizeName('  Ring Adjuster ')).toBe('ring adjuster');
    });

    it('collapses internal whitespace', () => {
      expect(svc.normalizeName('Poly   Bag\t12x16')).toBe('poly bag 12x16');
    });

    it('returns null for null/undefined/empty/whitespace-only', () => {
      expect(svc.normalizeName(null)).toBeNull();
      expect(svc.normalizeName(undefined)).toBeNull();
      expect(svc.normalizeName('')).toBeNull();
      expect(svc.normalizeName('   ')).toBeNull();
    });
  });

  describe('sharesMasterFK', () => {
    const FK_FIELDS = ['buttonId', 'labelId', 'materialId'];

    it('matches when any FK is equal on both sides', () => {
      expect(svc.sharesMasterFK({ buttonId: 'b1' }, { buttonId: 'b1', labelId: 'l9' }, FK_FIELDS)).toBe(true);
    });

    it('does not match when one side is null/undefined', () => {
      expect(svc.sharesMasterFK({ buttonId: null }, { buttonId: null }, FK_FIELDS)).toBe(false);
      expect(svc.sharesMasterFK({}, { buttonId: 'b1' }, FK_FIELDS)).toBe(false);
    });

    it('does not match different values or different FK fields', () => {
      expect(svc.sharesMasterFK({ buttonId: 'b1' }, { buttonId: 'b2' }, FK_FIELDS)).toBe(false);
      expect(svc.sharesMasterFK({ buttonId: 'x' }, { labelId: 'x' }, FK_FIELDS)).toBe(false);
    });
  });

  describe('getMaterialName', () => {
    it('prefers master record name over componentName', () => {
      expect(
        svc.getMaterialName({
          materialType: 'BUTTON',
          componentName: 'Front Button',
          button_master: { buttonName: 'Shell Button 18L' },
        })
      ).toBe('Shell Button 18L');
    });

    it('falls back to componentName when master relation is null', () => {
      expect(svc.getMaterialName({ materialType: 'BUTTON', componentName: 'Front Button' })).toBe('Front Button');
    });

    it('falls back to componentName for generic trim types (default branch)', () => {
      expect(svc.getMaterialName({ materialType: 'TRIMS', componentName: 'Ring Adjuster' })).toBe('Ring Adjuster');
    });

    it('returns null when no master name and no componentName', () => {
      expect(svc.getMaterialName({ materialType: 'TRIMS' })).toBeNull();
    });
  });

  describe('matchTrimDetail', () => {
    it('matches by master FK even when names differ (FK beats name)', () => {
      const byName = { trimName: 'Ring Adjuster', trimQuantity: 9 };
      const byFk = { trimName: 'RA-Gold', trimQuantity: 2, buttonId: 'btn-1' };
      const material = { id: 'bom-1', materialType: 'TRIMS', componentName: 'Ring Adjuster', buttonId: 'btn-1' };
      const consumed = new Set();
      expect(svc.matchTrimDetail(material, [byName, byFk], consumed)).toBe(byFk);
      expect(consumed.has(byFk)).toBe(true);
    });

    it('matches by bomId when no FK matches', () => {
      const byName = { trimName: 'Ring Adjuster', trimQuantity: 9 };
      const byBomId = { trimName: 'Something Else', trimQuantity: 2, bomId: 'bom-1' };
      const material = { id: 'bom-1', materialType: 'TRIMS', componentName: 'Ring Adjuster' };
      expect(svc.matchTrimDetail(material, [byName, byBomId], new Set())).toBe(byBomId);
    });

    it('matches by normalized name via componentName fallback (the Ring Adjuster bug)', () => {
      const entry = { trimName: '  ring  ADJUSTER ', trimQuantity: 2, trimRate: 5 };
      const material = { id: 'bom-1', materialType: 'TRIMS', componentName: 'Ring Adjuster' };
      expect(svc.matchTrimDetail(material, [entry], new Set())).toBe(entry);
    });

    it('excludes isNotApplicable and nameless entries', () => {
      const na = { trimName: 'Ring Adjuster', isNotApplicable: true };
      const nameless = { trimQuantity: 3 };
      const material = { id: 'bom-1', materialType: 'TRIMS', componentName: 'Ring Adjuster' };
      expect(svc.matchTrimDetail(material, [na, nameless], new Set())).toBeUndefined();
    });

    it('pairs duplicate names 1:1 via consumption', () => {
      const first = { trimName: 'Button', trimQuantity: 4 };
      const second = { trimName: 'Button', trimQuantity: 6 };
      const rowA = { id: 'bom-a', materialType: 'TRIMS', componentName: 'Button' };
      const rowB = { id: 'bom-b', materialType: 'TRIMS', componentName: 'Button' };
      const consumed = new Set();
      expect(svc.matchTrimDetail(rowA, [first, second], consumed)).toBe(first);
      expect(svc.matchTrimDetail(rowB, [first, second], consumed)).toBe(second);
    });

    it('reuses a consumed entry when style rows outnumber entries', () => {
      const only = { trimName: 'Button', trimQuantity: 4 };
      const rowA = { id: 'bom-a', materialType: 'TRIMS', componentName: 'Button' };
      const rowB = { id: 'bom-b', materialType: 'TRIMS', componentName: 'Button' };
      const consumed = new Set();
      expect(svc.matchTrimDetail(rowA, [only], consumed)).toBe(only);
      expect(svc.matchTrimDetail(rowB, [only], consumed)).toBe(only);
      expect(consumed.size).toBe(1);
    });

    it('returns undefined when nothing matches', () => {
      const entry = { trimName: 'Zipper 6in', trimQuantity: 1 };
      const material = { id: 'bom-1', materialType: 'TRIMS', componentName: 'Ring Adjuster' };
      expect(svc.matchTrimDetail(material, [entry], new Set())).toBeUndefined();
    });
  });

  describe('matchAccessoryDetail', () => {
    it('matches by FK first, then name; excludes N/A', () => {
      const byFk = { accessoryName: 'Polybag Large', packagingId: 'pkg-1' };
      const byName = { accessoryName: 'Poly Bag' };
      const na = { accessoryName: 'Poly Bag', isNotApplicable: true, packagingId: 'pkg-1' };
      const material = {
        id: 'bom-1',
        materialType: 'PACKAGING',
        componentName: 'Poly Bag',
        packagingId: 'pkg-1',
      };
      expect(svc.matchAccessoryDetail(material, [na, byName, byFk], new Set())).toBe(byFk);
      expect(svc.matchAccessoryDetail(material, [byName], new Set())).toBe(byName);
      expect(svc.matchAccessoryDetail(material, [na], new Set())).toBeUndefined();
    });
  });

  describe('resolveTrimQuantity', () => {
    it('cost sheet quantity beats style BOM even when both > 0 (style BOM values are artifacts, not intent)', () => {
      expect(svc.resolveTrimQuantity(5, 2, 'GARMENT_TRIM')).toEqual({ qty: 2, source: 'COST_SHEET' });
    });

    it('cost sheet quantity used when style BOM is 0 (the core fix)', () => {
      expect(svc.resolveTrimQuantity(0, 2, 'GARMENT_TRIM')).toEqual({ qty: 2, source: 'COST_SHEET' });
    });

    it('style BOM quantity survives as fallback when cost sheet has no matched qty (picker-added materials)', () => {
      expect(svc.resolveTrimQuantity(3, 0, 'GARMENT_TRIM')).toEqual({ qty: 3, source: 'STYLE_BOM_FALLBACK' });
    });

    it('PACKAGING defaults to 1 when both are 0', () => {
      expect(svc.resolveTrimQuantity(0, 0, 'PACKAGING')).toEqual({ qty: 1, source: 'PACKAGING_DEFAULT' });
    });

    it('resolves 0/UNRESOLVED when nothing is set on a garment trim', () => {
      expect(svc.resolveTrimQuantity(0, 0, 'GARMENT_TRIM')).toEqual({ qty: 0, source: 'UNRESOLVED' });
    });

    it('handles Number(Decimal)-style inputs (NaN treated upstream as 0)', () => {
      expect(svc.resolveTrimQuantity(Number('3.5'), 0, 'GARMENT_TRIM')).toEqual({
        qty: 3.5,
        source: 'STYLE_BOM_FALLBACK',
      });
    });
  });
});
