import { z } from 'zod';

/**
 * Company Profile schemas.
 *
 * Every field here must also appear in companyProfileService's update data block, or the
 * schema↔service parity smart-check blocks the commit (a field in the schema but not the
 * service is silently ignored on save).
 */

// 15 chars: 2 state digits, 5 PAN letters, 4 digits, entity letter, alnum, 'Z', checksum.
// Same shape as einvoice.schema.ts — ours is the seller GSTIN, so it must be just as strict.
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const bankAccountRegex = /^[0-9]{9,18}$/;
const pincodeRegex = /^[1-9][0-9]{5}$/;
const hexColorRegex = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Optional free text that an HTML form may post as ''. */
const optionalText = (max: number, label: string) =>
  z
    .union([z.string().max(max, `${label} must not exceed ${max} characters`).trim(), z.literal('')])
    .optional()
    .nullable();

/** Optional field with a format, which an HTML form may still post as ''. */
const optionalPattern = (regex: RegExp, message: string) =>
  z
    .union([z.string().trim().toUpperCase().regex(regex, message), z.literal('')])
    .optional()
    .nullable();

const optionalColor = z
  .union([z.string().trim().regex(hexColorRegex, 'Use a hex colour like #B85C38'), z.literal('')])
  .optional()
  .nullable();

const identityFields = {
  name: z.string().min(1, 'Trading name is required').max(200).trim(),
  legalName: z.string().min(1, 'Legal name is required').max(250).trim(),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .length(15, 'GSTIN must be exactly 15 characters')
    .regex(gstinRegex, 'Invalid GSTIN format (e.g. 08DCDPS0146D1ZU)'),
  pan: optionalPattern(panRegex, 'Invalid PAN format (e.g. DCDPS0146D)'),
  msmeNumber: optionalText(50, 'Udyam/MSME number'),
  cin: optionalText(30, 'CIN'),
  iec: optionalText(20, 'IEC'),
  tan: optionalText(20, 'TAN'),
};

const addressFields = {
  stateCode: z
    .string()
    .trim()
    .length(2, 'State code must be 2 digits')
    .regex(/^[0-9]{2}$/, 'State code must be 2 digits'),
  stateName: z.string().min(1, 'State name is required').max(100).trim(),
  stateId: z
    .union([z.string().uuid('Invalid state'), z.literal('')])
    .optional()
    .nullable(),
  address: z.string().min(1, 'Address is required').max(500).trim(),
  city: z.string().min(1, 'City is required').max(100).trim(),
  pincode: z.string().trim().regex(pincodeRegex, 'Invalid PIN code'),
  phone: optionalText(20, 'Phone'),
  email: z
    .union([z.string().email('Invalid email format').max(255).trim(), z.literal('')])
    .optional()
    .nullable(),
  contactPerson: optionalText(150, 'Contact person'),
  contactPhone: optionalText(20, 'Contact phone'),
  contactEmail: z
    .union([z.string().email('Invalid email format').max(255).trim(), z.literal('')])
    .optional()
    .nullable(),
  website: optionalText(255, 'Website'),
};

const bankFields = {
  bankName: optionalText(150, 'Bank name'),
  bankBranch: optionalText(150, 'Branch'),
  bankAccountNumber: optionalPattern(bankAccountRegex, 'Account number must be 9-18 digits'),
  bankIfscCode: optionalPattern(ifscRegex, 'Invalid IFSC code format (e.g. HDFC0001234)'),
};

const brandingFields = {
  tagline: optionalText(200, 'Tagline'),
  invoiceTerms: optionalText(2000, 'Invoice terms'),
  jurisdiction: optionalText(200, 'Jurisdiction'),
  brandColorPrimary: optionalColor,
  brandColorAccent: optionalColor,
  brandColorHeader: optionalColor,
  brandColorText: optionalColor,
  brandColorMuted: optionalColor,
};

/**
 * The GSTIN's first two digits ARE the state code — a mismatch is what silently flips
 * CGST/SGST to IGST on every document this entity issues.
 */
const assertStateCodeMatchesGstin = <T extends { gstin?: string; stateCode?: string }>(
  data: T,
  ctx: z.RefinementCtx
) => {
  if (data.gstin && data.stateCode && data.gstin.slice(0, 2) !== data.stateCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['stateCode'],
      message: `State code must match the GSTIN prefix (${data.gstin.slice(0, 2)})`,
    });
  }
};

/** POST /api/company-profiles */
export const createCompanyProfileSchema = z
  .object({
    ...identityFields,
    ...addressFields,
    ...bankFields,
    ...brandingFields,
    isActive: z.boolean().optional().default(true),
  })
  .superRefine(assertStateCodeMatchesGstin);

/** PUT /api/company-profiles/:id — every field optional; isDefault is NOT settable here. */
export const updateCompanyProfileSchema = z
  .object({
    name: identityFields.name.optional(),
    legalName: identityFields.legalName.optional(),
    gstin: identityFields.gstin.optional(),
    pan: identityFields.pan,
    msmeNumber: identityFields.msmeNumber,
    cin: identityFields.cin,
    iec: identityFields.iec,
    tan: identityFields.tan,
    stateCode: addressFields.stateCode.optional(),
    stateName: addressFields.stateName.optional(),
    stateId: addressFields.stateId,
    address: addressFields.address.optional(),
    city: addressFields.city.optional(),
    pincode: addressFields.pincode.optional(),
    phone: addressFields.phone,
    email: addressFields.email,
    contactPerson: addressFields.contactPerson,
    contactPhone: addressFields.contactPhone,
    contactEmail: addressFields.contactEmail,
    website: addressFields.website,
    ...bankFields,
    ...brandingFields,
    isActive: z.boolean().optional(),
  })
  .superRefine(assertStateCodeMatchesGstin);

/**
 * POST /api/company-profiles/:id/set-default — the id in the path is the whole request.
 * An explicit empty-object schema keeps the route-validation check satisfied while
 * rejecting a stray body that a caller might expect to be honoured.
 */
export const setDefaultCompanyProfileSchema = z.object({}).strict();

export type CreateCompanyProfileInput = z.infer<typeof createCompanyProfileSchema>;
export type UpdateCompanyProfileInput = z.infer<typeof updateCompanyProfileSchema>;
