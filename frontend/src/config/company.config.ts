/**
 * Company Configuration
 * Static company details for document preview and display
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
};

export const getCompanyFullAddress = (): string => {
  return `${COMPANY_CONFIG.address}, ${COMPANY_CONFIG.city}, ${COMPANY_CONFIG.state} - ${COMPANY_CONFIG.pincode}`;
};
