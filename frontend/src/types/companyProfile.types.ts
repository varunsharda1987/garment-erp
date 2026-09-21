/**
 * Company Profile — the legal entities we invoice as.
 *
 * Multi-entity: several may exist, exactly one is the default, and that one supplies the
 * letterhead, GSTIN and state code for every document and GST decision. Nothing selects an
 * entity per transaction.
 *
 * All camelCase, matching backend/src/schemas/companyProfile.schema.ts after serialization.
 */

export interface CompanyProfile {
  id: string;

  // Identity
  name: string;
  legalName: string;
  gstin: string;
  pan: string | null;
  /** Udyam/MSME registration printed on invoices under the MSMED Act. */
  msmeNumber: string | null;
  cin: string | null;
  iec: string | null;
  tan: string | null;

  // Address
  stateCode: string;
  stateName: string;
  stateId: string | null;
  address: string;
  city: string;
  pincode: string;

  /** Accounts-side contact — what invoices, POs and challans print. */
  phone: string | null;
  email: string | null;
  /** The named lab/TRF contact, with their own number. NOT the accounts contact. */
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  website: string | null;

  // Bank
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  bankIfscCode: string | null;

  // Branding & terms
  logoUrl: string | null;
  signatureUrl: string | null;
  tagline: string | null;
  invoiceTerms: string | null;
  jurisdiction: string | null;
  brandColorPrimary: string | null;
  brandColorAccent: string | null;
  brandColorHeader: string | null;
  brandColorText: string | null;
  brandColorMuted: string | null;

  isActive: boolean;
  /** Exactly one entity has this set. It is what every document uses. */
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateCompanyProfileRequest = Omit<
  CompanyProfile,
  'id' | 'isDefault' | 'createdAt' | 'updatedAt' | 'logoUrl' | 'signatureUrl'
>;

export type UpdateCompanyProfileRequest = Partial<CreateCompanyProfileRequest>;
