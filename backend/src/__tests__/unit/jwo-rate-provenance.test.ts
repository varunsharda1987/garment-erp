/**
 * jwoRateProvenance — the pure half of the JWO rate checkpoint (qty-rate audit 2026-08-24).
 *
 * These semantics have NO guardrail hook watching them (raw `!==` on rates is exactly the
 * Decimal-comparison trap the audit flagged as undetectable by the pre-commit checks), so the
 * tolerance boundaries live here as executable contract.
 */
import { jwoRateProvenance, JwoRateResolution } from '../../services/helpers/jwo-rate.helper';

const resolution = (overrides: Partial<JwoRateResolution> = {}): JwoRateResolution => ({
  cardRatePerMeter: 52,
  rateCardId: 'card-1',
  slabId: 'slab-1',
  slabLabel: '500-1000m',
  basisQuantityMeters: 700,
  upstreamRatePerMeter: 48,
  differsFromUpstream: true,
  varianceReason: 'Slab rate at 700m (500-1000m) is ₹52/m vs upstream ₹48/m',
  ...overrides,
});

describe('jwoRateProvenance', () => {
  it('records RATE_CARD with the upstream snapshot as the superseded rate when the agreed rate IS the card quote', () => {
    const p = jwoRateProvenance(resolution(), 52);
    expect(p.rateSource).toBe('RATE_CARD');
    expect(p.rateCardId).toBe('card-1');
    expect(p.slabId).toBe('slab-1');
    expect(p.rateBasisQuantity).toBe(700);
    // The rate this document did NOT take = the upstream snapshot it superseded
    expect(p.costedRatePerMeter).toBe(48);
  });

  it('treats a sub-paise difference as matching the card (decimal-safe, not raw !==)', () => {
    const p = jwoRateProvenance(resolution({ cardRatePerMeter: 52.004 }), 52.0);
    expect(p.rateSource).toBe('RATE_CARD');
  });

  it('a paise-level deviation from the card is a variance: card kept as costedRate, reason recorded', () => {
    const p = jwoRateProvenance(resolution(), 50); // negotiated ₹50 vs card ₹52
    expect(p.rateSource).toBe('ORDER_BOM'); // upstream existed → labelled as such
    expect(p.costedRatePerMeter).toBe(52); // the card quote the document deviated from
    expect(p.rateVarianceReason).toContain('₹50');
    expect(p.rateVarianceReason).toContain('₹52');
    expect(p.rateVarianceReason).toContain('500-1000m');
  });

  it('labels an operator-typed rate with no upstream as MANUAL', () => {
    const p = jwoRateProvenance(resolution({ upstreamRatePerMeter: null }), 50);
    expect(p.rateSource).toBe('MANUAL');
    expect(p.costedRatePerMeter).toBe(52);
  });

  it('no card resolvable: provenance stays null-safe and MANUAL/ORDER_BOM by upstream presence', () => {
    const bare = jwoRateProvenance(null, 25);
    expect(bare.rateSource).toBe('MANUAL');
    expect(bare.rateCardId).toBeNull();
    expect(bare.costedRatePerMeter).toBeNull();
    expect(bare.rateVarianceReason).toBeNull();

    const noCard = jwoRateProvenance(
      resolution({
        cardRatePerMeter: null,
        rateCardId: null,
        slabId: null,
        slabLabel: null,
        differsFromUpstream: false,
        varianceReason: null,
      }),
      25
    );
    expect(noCard.rateSource).toBe('ORDER_BOM'); // upstream snapshot known
    expect(noCard.costedRatePerMeter).toBeNull();
  });

  it('TBD short-circuits: no card pinned, upstream kept for later settlement', () => {
    const p = jwoRateProvenance(resolution(), 0, { isRateTbd: true });
    expect(p.rateSource).toBe('TBD');
    expect(p.rateCardId).toBeNull();
    expect(p.costedRatePerMeter).toBe(48);
    expect(p.rateVarianceReason).toBeNull();
  });
});
