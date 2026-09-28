import { describe, it, expect } from 'vitest';
import { pageGroups, statusesForParam, statusFilterValue, viewFromParam } from '../requirement-list-options';

describe('viewFromParam', () => {
  it('opens Order & Style when no view is given', () => {
    expect(viewFromParam(null)).toBe('byOrderStyle');
    expect(viewFromParam('')).toBe('byOrderStyle');
  });

  it('keeps old links working: flat is the List view, the retired byStyle lands on Order & Style', () => {
    expect(viewFromParam('flat')).toBe('list');
    expect(viewFromParam('list')).toBe('list');
    expect(viewFromParam('byStyle')).toBe('byOrderStyle');
    expect(viewFromParam('byOrderStyle')).toBe('byOrderStyle');
  });

  it('passes the other views through and ignores junk', () => {
    expect(viewFromParam('byMaterial')).toBe('byMaterial');
    expect(viewFromParam('byParty')).toBe('byParty');
    expect(viewFromParam('nonsense')).toBe('byOrderStyle');
  });
});

describe('status presets', () => {
  it('opens on "Needs action" — everything a person still has to act on', () => {
    expect(statusFilterValue(null)).toBe('open');
    expect(statusesForParam(null)).toEqual([
      'PENDING',
      'SIZE_PENDING',
      'PO_REQUIRED',
      'PARTIAL_STOCK',
      'DECISION_PENDING',
    ]);
  });

  it('maps each preset to its statuses; "all" sends no status (the API then hides only CANCELLED)', () => {
    expect(statusesForParam('onOrder')).toEqual(['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED']);
    expect(statusesForParam('done')).toEqual(['RECEIVED', 'FULFILLED_STOCK', 'CONVERTED']);
    expect(statusesForParam('cancelled')).toEqual(['CANCELLED']);
    expect(statusesForParam('all')).toBeUndefined();
  });

  it('passes an exact status (or a comma list from a link) straight through', () => {
    expect(statusFilterValue('PO_REQUIRED')).toBe('PO_REQUIRED');
    expect(statusesForParam('PO_REQUIRED')).toEqual(['PO_REQUIRED']);
    expect(statusesForParam('PO_SENT, RECEIVED')).toEqual(['PO_SENT', 'RECEIVED']);
  });
});

describe('pageGroups', () => {
  const groups = Array.from({ length: 23 }, (_, i) => ({ key: `g${i + 1}` }));

  it('pages whole groups — a group is never split', () => {
    const p1 = pageGroups(groups, 1, 10);
    expect(p1.items.map((g) => g.key)).toEqual(groups.slice(0, 10).map((g) => g.key));
    expect(p1.totalPages).toBe(3);
    expect(p1.total).toBe(23);
    expect(pageGroups(groups, 3, 10).items).toHaveLength(3);
  });

  it('shows the last page when asked for one past the end, and page 1 for junk', () => {
    const past = pageGroups(groups, 9, 10);
    expect(past.page).toBe(3);
    expect(past.items).toHaveLength(3);
    expect(pageGroups(groups, 0, 10).page).toBe(1);
    expect(pageGroups(groups, Number.NaN, 10).page).toBe(1);
  });

  it('has one (empty) page when there is nothing to show', () => {
    expect(pageGroups([], 1, 10)).toEqual({ items: [], page: 1, totalPages: 1, total: 0 });
  });
});
