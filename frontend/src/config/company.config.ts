/**
 * FALLBACK ONLY — not the source of truth.
 *
 * Company identity lives in the company_profile table and is served by
 * GET /api/company-profiles/default. Read it with the `useCompanyProfile()` hook.
 *
 * This constant exists solely as the pre-network placeholder so a letterhead never renders
 * blank on first paint, and so an interstate comparison never runs against `undefined`.
 * Do not add fields here and do not read it directly in a component — the hook already
 * falls back to it.
 *
 * Kept deliberately in step with backend/src/config/company.config.ts, including the
 * canonical address spelling confirmed by the owner on 2026-09-21.
 */

export interface FallbackCompany {
  name: string;
  tagline?: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  phone: string;
  email: string;
  gstin: string;
  msmeNumber?: string;
  panNumber?: string;
}

export const FALLBACK_COMPANY: FallbackCompany = {
  name: 'KASHAYA FABS',
  tagline: 'Proprietorship · Contract & Private Label Manufacturing',
  address: 'H1-51, Riico Industrial Area, Mansarovar',
  city: 'Jaipur',
  state: 'Rajasthan',
  stateCode: '08',
  pincode: '302020',
  // The ACCOUNTS contact — what invoices print. Distinct from the lab/TRF contact.
  phone: '8890729433',
  email: 'kashayafabs.acc@gmail.com',
  gstin: '08DCDPS0146D1ZU',
  msmeNumber: 'UDYAM-RJ-17-0028194',
  panNumber: 'DCDPS0146D',
};
