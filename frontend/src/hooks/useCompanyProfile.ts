/**
 * The default company entity — one shared query for every screen that renders our letterhead
 * or decides intrastate vs interstate GST.
 *
 * Replaces the hardcoded frontend/src/config/company.config.ts, which had drifted from the
 * backend (different address spelling, and its own getCompanyFullAddress format).
 */
import { useQuery } from '@tanstack/react-query';
import { getDefaultCompanyProfile } from '@/services/companyProfile.service';
import { FALLBACK_COMPANY } from '@/config/company.config';
import type { CompanyProfile } from '@/types/companyProfile.types';

/** Shape the fallback constant like a profile so consumers need no special-casing. */
const FALLBACK_PROFILE = {
  id: '',
  name: FALLBACK_COMPANY.name,
  legalName: FALLBACK_COMPANY.name,
  gstin: FALLBACK_COMPANY.gstin,
  pan: FALLBACK_COMPANY.panNumber ?? null,
  msmeNumber: FALLBACK_COMPANY.msmeNumber ?? null,
  cin: null,
  iec: null,
  tan: null,
  stateCode: FALLBACK_COMPANY.stateCode,
  stateName: FALLBACK_COMPANY.state,
  stateId: null,
  address: FALLBACK_COMPANY.address,
  city: FALLBACK_COMPANY.city,
  pincode: FALLBACK_COMPANY.pincode,
  phone: FALLBACK_COMPANY.phone,
  email: FALLBACK_COMPANY.email,
  contactPerson: null,
  contactPhone: null,
  contactEmail: null,
  website: null,
  bankName: null,
  bankBranch: null,
  bankAccountNumber: null,
  bankIfscCode: null,
  logoUrl: null,
  signatureUrl: null,
  tagline: FALLBACK_COMPANY.tagline ?? null,
  invoiceTerms: null,
  jurisdiction: null,
  brandColorPrimary: null,
  brandColorAccent: null,
  brandColorHeader: null,
  brandColorText: null,
  brandColorMuted: null,
  isActive: true,
  isDefault: true,
  createdAt: '',
  updatedAt: '',
} satisfies CompanyProfile;

export const COMPANY_PROFILE_QUERY_KEY = ['company-profile', 'default'] as const;

export interface UseCompanyProfileResult {
  company: CompanyProfile;
  /** True while showing the compile-time fallback rather than the real entity. */
  isPlaceholder: boolean;
  /** Single address format, matching the backend's `${address}, ${city} ${pincode}`. */
  companyFullAddress: string;
}

export function useCompanyProfile(): UseCompanyProfileResult {
  const { data, isPlaceholderData, isPending } = useQuery({
    queryKey: COMPANY_PROFILE_QUERY_KEY,
    queryFn: getDefaultCompanyProfile,
    // Company identity changes at most a few times a year; every screen shares one fetch.
    staleTime: 30 * 60 * 1000,
    gcTime: Infinity,
    // placeholderData, NOT initialData: initialData marks the cache fresh and would suppress
    // the real fetch for the whole staleTime, pinning the app to the stale constant.
    placeholderData: FALLBACK_PROFILE,
  });

  const company = data ?? FALLBACK_PROFILE;

  return {
    company,
    isPlaceholder: isPlaceholderData || isPending || company.id === '',
    companyFullAddress: `${company.address}, ${company.city} ${company.pincode}`,
  };
}
