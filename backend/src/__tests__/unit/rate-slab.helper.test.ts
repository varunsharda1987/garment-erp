/**
 * pickRatedSlab — which band prices a rate-card row (pure, no DB).
 *
 * The owner's rule (2026-09-28): a row's LAST filled band carries up to every larger quantity.
 * Aryan Dyeing has bands to 3500 m, but nine greiges were filled only to 1500 m, so a 2000 m job
 * found no rate at all. Carrying DOWN was not asked for: a quantity below the first filled band
 * still has no rate.
 */

import { pickRatedSlab, carriedBandLabel } from '../../services/helpers/rate-slab.helper';

// Aryan-style bands: [0,500) [500,1000) [1000,1500) [1500,2000) [2000,2500)
const B0 = { id: 'b0', maxQuantity: 500 };
const B1 = { id: 'b1', maxQuantity: 1000 };
const B2 = { id: 'b2', maxQuantity: 1500 };
const B3 = { id: 'b3', maxQuantity: 2000 };
const B4 = { id: 'b4', maxQuantity: 2500 };

describe('pickRatedSlab', () => {
  it('uses the band the quantity falls in when the row fills it', () => {
    expect(pickRatedSlab(B1, [B0, B1, B2], 700)).toEqual({ slabId: 'b1', carriedUp: false });
  });

  it('carries the last filled band up to a larger quantity in an empty band', () => {
    expect(pickRatedSlab(B3, [B0, B1, B2], 1800)).toEqual({ slabId: 'b2', carriedUp: true });
  });

  it('above every band with the top band empty: the highest FILLED band, not the top band', () => {
    // findMatchingSlab hands over the processor's top band (b4) for 4000 m; this row stops at b2
    expect(pickRatedSlab(B4, [B1, B0, B2], 4000)).toEqual({ slabId: 'b2', carriedUp: true });
  });

  it('a quantity exactly at the last filled band’s max is past it (bands are half-open)', () => {
    expect(pickRatedSlab(B3, [B0, B1, B2], 1500)).toEqual({ slabId: 'b2', carriedUp: true });
  });

  it('never carries DOWN: below the row’s first filled band there is no rate', () => {
    // Viscose Moss is filled only in 1000-1500; 400 m falls in the empty 0-500 band
    expect(pickRatedSlab(B0, [B2], 400)).toBeNull();
  });

  it('a hole between filled bands is not filled in', () => {
    expect(pickRatedSlab(B1, [B0, B2], 700)).toBeNull();
  });

  it('a row with nothing filled has no rate', () => {
    expect(pickRatedSlab(B3, [], 1800)).toBeNull();
  });
});

describe('carriedBandLabel', () => {
  it('says the rate came from the last rated band', () => {
    expect(carriedBandLabel('1000-1500m')).toBe('1000-1500m — last rated band');
  });
});
