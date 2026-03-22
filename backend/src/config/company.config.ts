/**
 * Company Configuration
 *
 * Static company details used for document generation (invoices, catalogues, etc.)
 * Bank details are fetched dynamically from bank_accounts table (primary account)
 *
 * To support multiple companies in future, migrate this to a database table
 */

export interface CompanyConfig {
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
  cinNumber?: string;
  logoPath?: string;
  website?: string;
}

export const COMPANY_CONFIG: CompanyConfig = {
  name: 'KASHAYA FABS',
  tagline: 'Quality Garments',
  address: 'H-1, 51, RIICO Industrial Area, Mansarovar',
  city: 'Jaipur',
  state: 'Rajasthan',
  stateCode: '08',
  pincode: '302020',
  phone: '8890729433',
  email: 'kashayafabs.acc@gmail.com',
  gstin: '08DCDPS0146D1ZU',
  msmeNumber: 'UDYAM-RJ-17-0028194',
  panNumber: 'DCDPS0146D',
  logoPath: '/assets/company-logo.png',
  website: 'www.kashayafabs.com',
};

/**
 * @deprecated Use hsn_sac_masters table instead. These are fallback defaults
 * for document generation only. Will be removed once document-generator
 * is updated to query hsn_sac_masters.
 */
export const DEFAULT_HSN_CODES = {
  GARMENTS: '62114210', // Ladies Garments
  KURTA_SETS: '62114210', // Ladies Kurta Sets
  NIGHTWEAR: '62114210', // Nightwear
  FABRIC: '52091100', // Cotton Fabric
  ACCESSORIES: '63079090', // Other made-up articles
};

/**
 * Document prefixes for numbering
 */
export const DOCUMENT_PREFIXES = {
  INVOICE: 'KF', // KF/25-26/0001
  PROFORMA: 'PF', // PF/25-26/0001
  QUOTATION: 'QT', // QT-2602-0001
  ORDER_FORM: 'OF', // OF/25-26/0001
};

/**
 * Terms and conditions for invoices
 */
export const INVOICE_TERMS = [
  'Goods once sold will not be taken back.',
  'Subject to Jaipur jurisdiction only.',
  'E. & O.E.',
  'Payment terms as per agreement.',
];

/**
 * Amount to Indian English words converter
 * Converts numbers to words in Indian format (Lakhs, Crores)
 */
export function amountToWords(amount: number): string {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  amount = Math.round(amount);
  if (amount === 0) return 'Rupees Zero Only';

  const twoDigits = (n: number): string => {
    if (n < 20) return ones[n];
    const t = tens[Math.floor(n / 10)];
    const o = ones[n % 10];
    return o ? `${t} ${o}` : t;
  };

  const threeDigits = (n: number): string => {
    if (n >= 100) {
      const rest = twoDigits(n % 100);
      return rest ? `${ones[Math.floor(n / 100)]} Hundred ${rest}` : `${ones[Math.floor(n / 100)]} Hundred`;
    }
    return twoDigits(n);
  };

  const parts: string[] = [];
  let remaining = amount;

  if (remaining >= 10000000) {
    parts.push(`${twoDigits(Math.floor(remaining / 10000000))} Crore`);
    remaining %= 10000000;
  }
  if (remaining >= 100000) {
    parts.push(`${twoDigits(Math.floor(remaining / 100000))} Lakh`);
    remaining %= 100000;
  }
  if (remaining >= 1000) {
    parts.push(`${twoDigits(Math.floor(remaining / 1000))} Thousand`);
    remaining %= 1000;
  }
  if (remaining > 0) {
    parts.push(threeDigits(Math.floor(remaining)));
  }

  return `Rupees ${parts.join(' ')} Only`;
}
