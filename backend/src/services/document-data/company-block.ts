/**
 * Company (consignor/seller) block for every kf-document masthead.
 *
 * Source of truth: the DEFAULT company_profile row, resolved through companyProfileService
 * so the cache, the multi-entity default rule and the "identity never falls back to config"
 * merge rule all apply here too.
 *
 * Until 2026-09-21 this read the row directly and then overrode two of its fields with
 * hardcoded values — `tagline` and, more seriously, `msme`, which meant the Udyam number on
 * every invoice came from company.config.ts and could not be changed without a deploy.
 * Both now come from the row.
 */
import { companyProfileService } from '../company-profile.service';

export interface CompanyBlock {
  name: string;
  tagline: string;
  addressLine: string; // "H-1, 51, RIICO Industrial Area, Mansarovar, Jaipur 302020"
  gstin: string;
  stateCode: string;
  stateName: string;
  pan: string | null;
  msme: string | null;
  phone: string | null;
  email: string | null;
}

export async function buildCompanyBlock(): Promise<CompanyBlock> {
  const company = await companyProfileService.getDefault();

  return {
    name: company.name,
    tagline: company.tagline,
    addressLine: company.addressLine,
    gstin: company.gstin,
    stateCode: company.stateCode,
    stateName: company.stateName,
    pan: company.pan,
    msme: company.msmeNumber,
    phone: company.phone,
    email: company.email,
  };
}
