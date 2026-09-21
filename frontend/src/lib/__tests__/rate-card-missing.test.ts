import { describe, it, expect } from 'vitest';
import { extractRateCardMissing } from '../rate-card-missing';
import { getErrorMessage } from '../api-error-handler';

/**
 * The Fabric Costing page tells the operator WHY a processor rate could not be resolved. The
 * backend sends that sentence in `message` and the machine code in `details.code`.
 *
 * The trap these tests exist for: getErrorMessage runs describeValidationDetails FIRST, and that
 * treats any object `details` as {field: message} pairs — so a coded refusal renders as
 * "Code: NO_GREIGE_RATE · Processor Name: Aryan Dyeing · …" and the real sentence is never
 * reached. The extractor must therefore run BEFORE getErrorMessage at every call site. If
 * anyone reorders that, the whole fix silently reverts to gibberish; the last test below is the
 * guard that fails loudly when they do.
 */
const missing = (
  details: Record<string, unknown>,
  message = 'Aryan Dyeing has no dyeing rate for "Cotton 60x60".'
) => ({
  response: { status: 404, data: { error: 'NOT_FOUND', message, details } },
});

const fullDetails = {
  code: 'NO_GREIGE_RATE',
  processorId: 'proc-aryan',
  processorName: 'Aryan Dyeing',
  processingType: 'DYEING',
  printingType: null,
  greigeId: 'greige-0035',
  greigeName: 'Cotton 60x60',
  quantityMeters: 1200,
  slabLabel: '1000-1500m',
  availableGreiges: ['Rayon 30s'],
  availablePrintingTypes: [],
};

describe('extractRateCardMissing', () => {
  it('returns the backend sentence verbatim — that is what the operator reads', () => {
    const result = extractRateCardMissing(missing(fullDetails));
    expect(result?.message).toBe('Aryan Dyeing has no dyeing rate for "Cotton 60x60".');
    expect(result?.code).toBe('NO_GREIGE_RATE');
  });

  it('carries the context the page needs to deep-link the Rate Card page', () => {
    const result = extractRateCardMissing(missing(fullDetails));
    expect(result?.processorId).toBe('proc-aryan');
    expect(result?.processingType).toBe('DYEING');
    expect(result?.greigeId).toBe('greige-0035');
    expect(result?.availableGreiges).toEqual(['Rayon 30s']);
  });

  it('defaults the arrays so a trimmed payload cannot crash the banner', () => {
    const result = extractRateCardMissing(missing({ code: 'NO_SLABS' }));
    expect(result?.availableGreiges).toEqual([]);
    expect(result?.availablePrintingTypes).toEqual([]);
    expect(result?.processorName).toBeNull();
  });

  it('accepts a top-level code too, in case the payload is ever flattened', () => {
    const err = { response: { status: 404, data: { message: 'No slabs set.', code: 'NO_SLABS' } } };
    expect(extractRateCardMissing(err)?.code).toBe('NO_SLABS');
  });

  it('ignores a 404 that is not a rate-card refusal, so normal error handling still runs', () => {
    expect(extractRateCardMissing({ response: { status: 404, data: { message: 'Style not found' } } })).toBeNull();
    expect(extractRateCardMissing(missing({ code: 'SOMETHING_ELSE' }))).toBeNull();
  });

  it('ignores non-404s', () => {
    expect(extractRateCardMissing({ response: { status: 500, data: { details: { code: 'NO_SLABS' } } } })).toBeNull();
    expect(extractRateCardMissing(new Error('network'))).toBeNull();
  });

  it('REGRESSION: getErrorMessage mangles this payload — the extractor must run first', () => {
    const err = missing(fullDetails);

    // What getErrorMessage would show if it were reached first: field-ish noise, not the sentence
    const viaGeneric = getErrorMessage(err);
    expect(viaGeneric).not.toBe(fullDetails.processorName);
    expect(viaGeneric).toContain('Code');
    expect(viaGeneric).not.toBe('Aryan Dyeing has no dyeing rate for "Cotton 60x60".');

    // The extractor recovers the real sentence. Call it BEFORE getErrorMessage, always.
    expect(extractRateCardMissing(err)?.message).toBe('Aryan Dyeing has no dyeing rate for "Cotton 60x60".');
  });
});
