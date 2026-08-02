// Financial Management Types

// Chart of Accounts
export const AccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

// Must match the Prisma AccountGroup enum exactly (backend AccountGroupEnum in
// chartOfAccounts.schema.ts). CAPITAL/SALES were stale values not present in the
// DB enum and would be rejected on create/update.
export const AccountGroup = {
  CURRENT_ASSET: 'CURRENT_ASSET',
  FIXED_ASSET: 'FIXED_ASSET',
  CURRENT_LIABILITY: 'CURRENT_LIABILITY',
  LONG_TERM_LIABILITY: 'LONG_TERM_LIABILITY',
  EQUITY: 'EQUITY',
  DIRECT_REVENUE: 'DIRECT_REVENUE',
  INDIRECT_REVENUE: 'INDIRECT_REVENUE',
  DIRECT_EXPENSE: 'DIRECT_EXPENSE',
  INDIRECT_EXPENSE: 'INDIRECT_EXPENSE',
  OVERHEAD: 'OVERHEAD',
} as const;
export type AccountGroup = (typeof AccountGroup)[keyof typeof AccountGroup];

export interface ChartOfAccount {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountGroup: AccountGroup;
  parentAccountId: string | null;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  parentAccount?: ChartOfAccount;
  childAccounts?: ChartOfAccount[];
}

// camelCase to match the backend Zod schema (createChartOfAccountSchema).
// validateBody strips unknown keys, so snake_case fields were silently dropped.
export interface ChartOfAccountCreate {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountGroup: AccountGroup;
  parentAccountId?: string | null;
  description?: string | null;
  isActive?: boolean;
}

// Tax Masters
export const TaxType = {
  GST: 'GST',
  IGST: 'IGST',
  CGST: 'CGST',
  SGST: 'SGST',
  CUSTOMS: 'CUSTOMS',
  CESS: 'CESS',
  OTHER: 'OTHER',
} as const;
export type TaxType = (typeof TaxType)[keyof typeof TaxType];

export interface TaxMaster {
  id: number;
  tax_name: string;
  tax_type: TaxType;
  tax_percentage: number;
  hsn_code: string | null;
  is_active: boolean;
  valid_from: string;
  valid_to: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxMasterCreate {
  tax_name: string;
  tax_type: TaxType;
  tax_percentage: number;
  hsn_code?: string;
  valid_from: string;
  valid_to?: string;
  description?: string;
}

// Payment Schedule (JSON structure for payment milestones)
export interface PaymentScheduleItem {
  percentage: number;
  dueDate?: string;
  description?: string;
  daysAfterInvoice?: number;
}

export type PaymentSchedule = PaymentScheduleItem[];

// Payment Terms
export interface PaymentTerm {
  id: number;
  term_name: string;
  term_code: string;
  net_days: number;
  discount_percentage: number | null;
  discount_days: number | null;
  description: string | null;
  payment_schedule: PaymentSchedule | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentTermCreate {
  term_name: string;
  term_code: string;
  net_days: number;
  discount_percentage?: number;
  discount_days?: number;
  description?: string;
  payment_schedule?: PaymentSchedule;
}

// Currencies
export const ExchangeRateType = {
  BUYING: 'BUYING',
  SELLING: 'SELLING',
  AVERAGE: 'AVERAGE',
} as const;
export type ExchangeRateType = (typeof ExchangeRateType)[keyof typeof ExchangeRateType];

export interface Currency {
  id: number;
  currency_code: string;
  currency_name: string;
  currency_symbol: string;
  is_base_currency: boolean;
  decimal_places: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  exchange_rates?: ExchangeRate[];
}

export interface ExchangeRate {
  id: number;
  currency_code: string;
  rate_type: ExchangeRateType;
  exchange_rate: number;
  effective_date: string;
  created_at: string;
}

export interface CurrencyCreate {
  currency_code: string;
  currency_name: string;
  currency_symbol: string;
  is_base_currency?: boolean;
  decimal_places?: number;
}

export interface ExchangeRateCreate {
  rate_type: ExchangeRateType;
  exchange_rate: number;
  effective_date: string;
}

// Cost Centers
export const CostCenterType = {
  DEPARTMENT: 'DEPARTMENT',
  LOCATION: 'LOCATION',
  PROJECT: 'PROJECT',
  PRODUCT_LINE: 'PRODUCT_LINE',
  CUSTOMER: 'CUSTOMER',
  OTHER: 'OTHER',
} as const;
export type CostCenterType = (typeof CostCenterType)[keyof typeof CostCenterType];

export interface CostCenter {
  id: number;
  cost_center_code: string;
  cost_center_name: string;
  cost_center_type: CostCenterType;
  parent_cost_center_id: number | null;
  budget_amount: number | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  parent_cost_center?: CostCenter;
}

export interface CostCenterCreate {
  cost_center_code: string;
  cost_center_name: string;
  cost_center_type: CostCenterType;
  parent_cost_center_id?: number;
  budget_amount?: number;
  description?: string;
}

// Expense Types
export interface ExpenseType {
  id: number;
  expense_type_code: string;
  expense_type_name: string;
  chart_of_account_id: number;
  is_recurring: boolean;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
  chart_of_account?: ChartOfAccount;
}

export interface ExpenseTypeCreate {
  expense_type_code: string;
  expense_type_name: string;
  chart_of_account_id: number;
  is_recurring?: boolean;
  description?: string;
}

// Bank Accounts - matches Prisma BankAccountType enum
export const BankAccountType = {
  CURRENT: 'CURRENT',
  SAVINGS: 'SAVINGS',
  OD: 'OD', // Overdraft
  CC: 'CC', // Cash Credit
} as const;
export type BankAccountType = (typeof BankAccountType)[keyof typeof BankAccountType];

export interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  branch_name: string;
  account_type: BankAccountType;
  ifsc_code: string | null;
  swift_code: string | null;
  currency_code: string;
  opening_balance: number;
  current_balance: number;
  is_primary: boolean;
  is_active: boolean;
  chart_of_account_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  currency?: Currency;
  chart_of_account?: ChartOfAccount;
}

export interface BankAccountCreate {
  account_name: string;
  account_number: string;
  bank_name: string;
  branch_name: string;
  account_type: BankAccountType;
  ifsc_code?: string;
  swift_code?: string;
  currency_code: string;
  opening_balance: number;
  is_primary?: boolean;
  chart_of_account_id?: number;
  description?: string;
}
