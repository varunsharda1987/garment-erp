/**
 * drawPlan (stock-routing.helper): a stock-out takes the FREE part of every lot, oldest first, before the held
 * part of any — oldest-first alone emptied a held lot and left its hold on nothing (2026-10-03).
 */
import { drawPlan } from '../../services/helpers/stock-routing.helper';

const lots = [
  { id: 'old', quantityAvailable: 100 },
  { id: 'new', quantityAvailable: 50 },
];

describe('drawPlan', () => {
  it('free stock first: the old lot gives only what is not held', () => {
    const plan = drawPlan(lots, new Map([['old', 80]]), 50);
    expect(Object.fromEntries(plan)).toEqual({ old: 20, new: 30 });
  });

  it('then the held part, oldest first', () => {
    const plan = drawPlan(lots, new Map([['old', 80]]), 90);
    expect(Object.fromEntries(plan)).toEqual({ old: 40, new: 50 });
  });

  it('nothing held = plain oldest first', () => {
    const plan = drawPlan(lots, new Map(), 120);
    expect(Object.fromEntries(plan)).toEqual({ old: 100, new: 20 });
  });

  it('a remainder within dust of a lot takes exactly that lot', () => {
    const plan = drawPlan([{ id: 'a', quantityAvailable: 10 }], new Map(), 10.002);
    expect(plan.get('a')).toBe(10);
  });
});
