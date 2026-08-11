/**
 * Company (consignor/seller) block for every kf-document masthead.
 * Source of truth: company_profile table (isActive row) with COMPANY_CONFIG
 * as the fallback — one function so the two sources can't drift silently.
 */
import prisma from '../../config/database';
import { COMPANY_CONFIG } from '../../config/company.config';

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
  const profile = await prisma.company_profile.findFirst({ where: { isActive: true } });

  if (profile) {
    return {
      name: profile.name,
      tagline: 'Proprietorship · Contract & Private Label Manufacturing',
      addressLine: `${profile.address}, ${profile.city} ${profile.pincode}`,
      gstin: profile.gstin,
      stateCode: profile.stateCode,
      stateName: profile.stateName,
      pan: profile.pan ?? COMPANY_CONFIG.panNumber ?? null,
      msme: COMPANY_CONFIG.msmeNumber ?? null,
      phone: profile.phone ?? COMPANY_CONFIG.phone ?? null,
      email: profile.email ?? COMPANY_CONFIG.email ?? null,
    };
  }

  return {
    name: COMPANY_CONFIG.name,
    tagline: 'Proprietorship · Contract & Private Label Manufacturing',
    addressLine: `${COMPANY_CONFIG.address}, ${COMPANY_CONFIG.city} ${COMPANY_CONFIG.pincode}`,
    gstin: COMPANY_CONFIG.gstin,
    stateCode: COMPANY_CONFIG.stateCode,
    stateName: COMPANY_CONFIG.state,
    pan: COMPANY_CONFIG.panNumber ?? null,
    msme: COMPANY_CONFIG.msmeNumber ?? null,
    phone: COMPANY_CONFIG.phone ?? null,
    email: COMPANY_CONFIG.email ?? null,
  };
}
