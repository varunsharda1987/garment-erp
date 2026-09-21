/**
 * POST /fabric-costing/lookup-rate answers a missing rate card with 404 + `details.code` +
 * a human `message` naming the exact next action ("Ramdev Processors rates "Cotton 60x60",
 * but not for PIGMENT printing", "…has no rate in the 0-500m band that 1,200 m falls into").
 *
 * This MUST run BEFORE getErrorMessage(). getErrorMessage (api-error-handler.ts:72) calls
 * describeValidationDetails (:50) first, which treats ANY object `details` as {field: message}
 * pairs and keeps the string values — so this payload would render as
 * "Code: NO_GREIGE_RATE · Processor Name: Ramdev · Greige Name: … · +2 more" and the real
 * `message` at :84 would never be reached. Same reason rate-slab-change.ts exists.
 */
import type { RateCardMissing, RateCardMissingDetails, RateCardMissingCode } from '../types/fabricCosting.types';

const CODES: readonly RateCardMissingCode[] = [
  'NO_SLABS',
  'NO_RATES_AT_ALL',
  'NO_GREIGE_RATE',
  'NO_PRINTING_TYPE_RATE',
  'NO_SLAB_RATE',
];

export function extractRateCardMissing(err: unknown): RateCardMissing | null {
  const e = err as {
    response?: {
      status?: number;
      data?: { message?: string; code?: RateCardMissingCode; details?: Partial<RateCardMissingDetails> };
    };
  };
  if (e?.response?.status !== 404) return null;

  const data = e.response?.data;
  // Accept a top-level `code` too: if the backend ever flattens the payload, falling through
  // to getErrorMessage would print the mangled "Code: …" string rather than the real message.
  const code = data?.details?.code ?? data?.code;
  if (!code || !CODES.includes(code)) return null;

  // Every field defaulted: a backend that omits one must not crash a .map() or render
  // "undefined" into the banner.
  const d: Partial<RateCardMissingDetails> = data?.details ?? {};
  return {
    code,
    processorId: d.processorId ?? null,
    processorName: d.processorName ?? null,
    processingType: d.processingType ?? 'DYEING',
    printingType: d.printingType ?? null,
    greigeId: d.greigeId ?? null,
    greigeName: d.greigeName ?? null,
    quantityMeters: d.quantityMeters ?? null,
    slabLabel: d.slabLabel ?? null,
    availableGreiges: d.availableGreiges ?? [],
    availablePrintingTypes: d.availablePrintingTypes ?? [],
    message: data?.message ?? 'No processor rate card covers this combination.',
  };
}
