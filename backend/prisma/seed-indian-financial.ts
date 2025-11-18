// Seed script for Indian Financial Masters
// Run: npx ts-node prisma/seed-indian-financial.ts

// Force local database URL BEFORE importing Prisma
const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/garment_erp';
process.env.DATABASE_URL = DATABASE_URL;

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

async function main() {
  console.log('🇮🇳 Seeding Indian Financial Masters...\n');

  // Get admin user for createdById
  const adminUser = await prisma.users.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!adminUser) {
    throw new Error('Admin user not found. Please create an admin user first.');
  }

  const userId = adminUser.id;

  // ============================================
  // 1. INDIAN CURRENCY SETUP
  // ============================================
  console.log('💱 Creating Indian Rupee as base currency...');

  const inr = await prisma.currencies.upsert({
    where: { currencyCode: 'INR' },
    update: {},
    create: {
      currencyCode: 'INR',
      currencyName: 'Indian Rupee',
      currencySymbol: '₹',
      isBaseCurrency: true,
      decimalPlaces: 2,
      isActive: true,
    },
  });

  // Add common export currencies
  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$', rate: 83.25 },
    { code: 'EUR', name: 'Euro', symbol: '€', rate: 90.50 },
    { code: 'GBP', name: 'British Pound', symbol: '£', rate: 105.75 },
  ];

  for (const curr of currencies) {
    await prisma.currencies.upsert({
      where: { currencyCode: curr.code },
      update: {},
      create: {
        currencyCode: curr.code,
        currencyName: curr.name,
        currencySymbol: curr.symbol,
        isBaseCurrency: false,
        decimalPlaces: 2,
        isActive: true,
      },
    });

    // Add current exchange rate
    await prisma.exchange_rates.upsert({
      where: {
        currencyCode_effectiveDate_rateType: {
          currencyCode: curr.code,
          effectiveDate: new Date('2024-11-15'),
          rateType: 'AVERAGE',
        },
      },
      update: {},
      create: {
        currencyCode: curr.code,
        effectiveDate: new Date('2024-11-15'),
        rateType: 'AVERAGE',
        exchangeRate: curr.rate,
        createdById: userId,
      },
    });
  }

  console.log('✅ Currencies created: INR (base), USD, EUR, GBP\n');

  // ============================================
  // 2. INDIAN GST TAX RATES
  // ============================================
  console.log('📊 Creating Indian GST tax rates...');

  const gstRates = [
    // GST Rates
    { code: 'GST0', name: 'GST 0% (Exempt)', type: 'GST', rate: 0, hsn: null },
    { code: 'GST5', name: 'GST 5%', type: 'GST', rate: 5, hsn: '6109' }, // Cotton garments
    { code: 'GST12', name: 'GST 12%', type: 'GST', rate: 12, hsn: '5407' }, // Synthetic fabrics
    { code: 'GST18', name: 'GST 18%', type: 'GST', rate: 18, hsn: '9606' }, // Buttons, accessories
    { code: 'GST28', name: 'GST 28%', type: 'GST', rate: 28, hsn: null },

    // IGST (Inter-state)
    { code: 'IGST5', name: 'IGST 5%', type: 'IGST', rate: 5, hsn: '6109' },
    { code: 'IGST12', name: 'IGST 12%', type: 'IGST', rate: 12, hsn: '5407' },
    { code: 'IGST18', name: 'IGST 18%', type: 'IGST', rate: 18, hsn: '9606' },
    { code: 'IGST28', name: 'IGST 28%', type: 'IGST', rate: 28, hsn: null },

    // SGST + CGST (Intra-state) - Combined rate same as GST
    { code: 'CGST2.5', name: 'CGST 2.5%', type: 'CGST', rate: 2.5, hsn: '6109' },
    { code: 'SGST2.5', name: 'SGST 2.5%', type: 'SGST', rate: 2.5, hsn: '6109' },
    { code: 'CGST6', name: 'CGST 6%', type: 'CGST', rate: 6, hsn: '5407' },
    { code: 'SGST6', name: 'SGST 6%', type: 'SGST', rate: 6, hsn: '5407' },
    { code: 'CGST9', name: 'CGST 9%', type: 'CGST', rate: 9, hsn: '9606' },
    { code: 'SGST9', name: 'SGST 9%', type: 'SGST', rate: 9, hsn: '9606' },
    { code: 'CGST14', name: 'CGST 14%', type: 'CGST', rate: 14, hsn: null },
    { code: 'SGST14', name: 'SGST 14%', type: 'SGST', rate: 14, hsn: null },
  ];

  for (const tax of gstRates) {
    await prisma.tax_masters.upsert({
      where: { taxCode: tax.code },
      update: {},
      create: {
        taxCode: tax.code,
        taxName: tax.name,
        taxType: tax.type as any,
        taxRate: tax.rate,
        hsnSacCode: tax.hsn,
        description: `Indian ${tax.type} at ${tax.rate}%`,
        applicableFrom: new Date('2017-07-01'), // GST introduced in India
        applicableTo: null,
        isActive: true,
        createdById: userId,
      },
    });
  }

  console.log('✅ GST rates created: 0%, 5%, 12%, 18%, 28% (GST, IGST, CGST, SGST)\n');

  // ============================================
  // 3. INDIAN PAYMENT TERMS
  // ============================================
  console.log('📝 Creating Indian payment terms...');

  const paymentTerms = [
    {
      code: 'ADVANCE',
      name: '100% Advance',
      days: 0,
      description: 'Full payment in advance before production',
    },
    {
      code: 'ADVANCE50',
      name: '50% Advance, 50% on Delivery',
      days: null,
      description: '50% advance, balance on delivery',
      schedule: { advance: 50, onDelivery: 50 },
    },
    {
      code: 'NET15',
      name: 'Net 15 Days',
      days: 15,
      description: 'Payment due within 15 days of invoice',
    },
    {
      code: 'NET30',
      name: 'Net 30 Days',
      days: 30,
      description: 'Payment due within 30 days of invoice',
    },
    {
      code: 'NET45',
      name: 'Net 45 Days',
      days: 45,
      description: 'Payment due within 45 days of invoice',
    },
    {
      code: 'NET60',
      name: 'Net 60 Days',
      days: 60,
      description: 'Payment due within 60 days of invoice',
    },
    {
      code: 'NET90',
      name: 'Net 90 Days',
      days: 90,
      description: 'Payment due within 90 days of invoice',
    },
    {
      code: 'PDC',
      name: 'Post-Dated Cheque',
      days: null,
      description: 'Payment via post-dated cheque',
    },
    {
      code: 'LC',
      name: 'Letter of Credit',
      days: null,
      description: 'Payment via LC (export orders)',
    },
  ];

  for (const term of paymentTerms) {
    await prisma.payment_terms.upsert({
      where: { termCode: term.code },
      update: {},
      create: {
        termCode: term.code,
        termName: term.name,
        description: term.description,
        daysCount: term.days,
        paymentSchedule: (term as any).schedule || null,
        discountPercent: null,
        isActive: true,
        createdById: userId,
      },
    });
  }

  console.log('✅ Payment terms created: Advance, Net 15/30/45/60/90, PDC, LC\n');

  // ============================================
  // 4. INDIAN CHART OF ACCOUNTS (Basic Structure)
  // ============================================
  console.log('📚 Creating Indian Chart of Accounts...');

  // Root level accounts
  const rootAccounts = [
    { code: '1000', name: 'Assets', type: 'ASSET', group: 'CURRENT_ASSET' },
    { code: '2000', name: 'Liabilities', type: 'LIABILITY', group: 'CURRENT_LIABILITY' },
    { code: '3000', name: 'Equity', type: 'EQUITY', group: 'EQUITY' },
    { code: '4000', name: 'Revenue', type: 'REVENUE', group: 'DIRECT_REVENUE' },
    { code: '5000', name: 'Expenses', type: 'EXPENSE', group: 'DIRECT_EXPENSE' },
  ];

  const accountMap: any = {};

  for (const acc of rootAccounts) {
    const account = await prisma.chart_of_accounts.upsert({
      where: { accountCode: acc.code },
      update: {},
      create: {
        accountCode: acc.code,
        accountName: acc.name,
        accountType: acc.type as any,
        accountGroup: acc.group as any,
        parentAccountId: null,
        description: `Root account for ${acc.name}`,
        isActive: true,
        isSystem: true, // System accounts cannot be deleted
        createdById: userId,
      },
    });
    accountMap[acc.code] = account.id;
  }

  // Sub-accounts under Assets
  const assetAccounts = [
    { code: '1100', name: 'Current Assets', parent: '1000', group: 'CURRENT_ASSET' },
    { code: '1110', name: 'Cash and Bank', parent: '1100', group: 'CURRENT_ASSET' },
    { code: '1120', name: 'Accounts Receivable (Debtors)', parent: '1100', group: 'CURRENT_ASSET' },
    { code: '1130', name: 'Inventory - Raw Materials', parent: '1100', group: 'CURRENT_ASSET' },
    { code: '1131', name: 'Inventory - Work in Progress', parent: '1100', group: 'CURRENT_ASSET' },
    { code: '1132', name: 'Inventory - Finished Goods', parent: '1100', group: 'CURRENT_ASSET' },
    { code: '1140', name: 'GST Input Credit', parent: '1100', group: 'CURRENT_ASSET' },
    { code: '1200', name: 'Fixed Assets', parent: '1000', group: 'FIXED_ASSET' },
    { code: '1210', name: 'Plant and Machinery', parent: '1200', group: 'FIXED_ASSET' },
    { code: '1220', name: 'Furniture and Fixtures', parent: '1200', group: 'FIXED_ASSET' },
    { code: '1230', name: 'Buildings', parent: '1200', group: 'FIXED_ASSET' },
  ];

  for (const acc of assetAccounts) {
    const account = await prisma.chart_of_accounts.upsert({
      where: { accountCode: acc.code },
      update: {},
      create: {
        accountCode: acc.code,
        accountName: acc.name,
        accountType: 'ASSET',
        accountGroup: acc.group as any,
        parentAccountId: accountMap[acc.parent],
        isActive: true,
        isSystem: false,
        createdById: userId,
      },
    });
    accountMap[acc.code] = account.id;
  }

  // Sub-accounts under Liabilities
  const liabilityAccounts = [
    { code: '2100', name: 'Current Liabilities', parent: '2000', group: 'CURRENT_LIABILITY' },
    { code: '2110', name: 'Accounts Payable (Creditors)', parent: '2100', group: 'CURRENT_LIABILITY' },
    { code: '2120', name: 'GST Payable', parent: '2100', group: 'CURRENT_LIABILITY' },
    { code: '2130', name: 'TDS Payable', parent: '2100', group: 'CURRENT_LIABILITY' },
    { code: '2140', name: 'Short Term Loans', parent: '2100', group: 'CURRENT_LIABILITY' },
    { code: '2200', name: 'Long Term Liabilities', parent: '2000', group: 'LONG_TERM_LIABILITY' },
    { code: '2210', name: 'Term Loans', parent: '2200', group: 'LONG_TERM_LIABILITY' },
  ];

  for (const acc of liabilityAccounts) {
    const account = await prisma.chart_of_accounts.upsert({
      where: { accountCode: acc.code },
      update: {},
      create: {
        accountCode: acc.code,
        accountName: acc.name,
        accountType: 'LIABILITY',
        accountGroup: acc.group as any,
        parentAccountId: accountMap[acc.parent],
        isActive: true,
        isSystem: false,
        createdById: userId,
      },
    });
    accountMap[acc.code] = account.id;
  }

  // Sub-accounts under Revenue
  const revenueAccounts = [
    { code: '4100', name: 'Sales - Domestic', parent: '4000', group: 'DIRECT_REVENUE' },
    { code: '4200', name: 'Sales - Export', parent: '4000', group: 'DIRECT_REVENUE' },
    { code: '4300', name: 'Other Income', parent: '4000', group: 'INDIRECT_REVENUE' },
  ];

  for (const acc of revenueAccounts) {
    const account = await prisma.chart_of_accounts.upsert({
      where: { accountCode: acc.code },
      update: {},
      create: {
        accountCode: acc.code,
        accountName: acc.name,
        accountType: 'REVENUE',
        accountGroup: acc.group as any,
        parentAccountId: accountMap[acc.parent],
        isActive: true,
        isSystem: false,
        createdById: userId,
      },
    });
    accountMap[acc.code] = account.id;
  }

  // Sub-accounts under Expenses
  const expenseAccounts = [
    { code: '5100', name: 'Direct Expenses', parent: '5000', group: 'DIRECT_EXPENSE' },
    { code: '5110', name: 'Raw Material Purchase', parent: '5100', group: 'DIRECT_EXPENSE' },
    { code: '5120', name: 'Manufacturing Expenses', parent: '5100', group: 'DIRECT_EXPENSE' },
    { code: '5200', name: 'Indirect Expenses', parent: '5000', group: 'INDIRECT_EXPENSE' },
    { code: '5210', name: 'Salaries and Wages', parent: '5200', group: 'INDIRECT_EXPENSE' },
    { code: '5220', name: 'Rent', parent: '5200', group: 'INDIRECT_EXPENSE' },
    { code: '5230', name: 'Electricity', parent: '5200', group: 'INDIRECT_EXPENSE' },
    { code: '5240', name: 'Office Expenses', parent: '5200', group: 'INDIRECT_EXPENSE' },
    { code: '5250', name: 'Transportation', parent: '5200', group: 'INDIRECT_EXPENSE' },
  ];

  for (const acc of expenseAccounts) {
    const account = await prisma.chart_of_accounts.upsert({
      where: { accountCode: acc.code },
      update: {},
      create: {
        accountCode: acc.code,
        accountName: acc.name,
        accountType: 'EXPENSE',
        accountGroup: acc.group as any,
        parentAccountId: accountMap[acc.parent],
        isActive: true,
        isSystem: false,
        createdById: userId,
      },
    });
    accountMap[acc.code] = account.id;
  }

  console.log('✅ Chart of Accounts created: 5 root + 30+ sub-accounts\n');

  // ============================================
  // 5. EXPENSE TYPES
  // ============================================
  console.log('💸 Creating Indian expense types...');

  const expenseTypes = [
    { code: 'RAW_MAT', name: 'Raw Material', category: 'DIRECT', accountCode: '5110' },
    { code: 'MFG', name: 'Manufacturing', category: 'DIRECT', accountCode: '5120' },
    { code: 'SALARY', name: 'Salaries & Wages', category: 'INDIRECT', accountCode: '5210' },
    { code: 'RENT', name: 'Rent', category: 'INDIRECT', accountCode: '5220' },
    { code: 'ELECTRICITY', name: 'Electricity', category: 'OVERHEAD', accountCode: '5230' },
    { code: 'OFFICE', name: 'Office Expenses', category: 'ADMINISTRATIVE', accountCode: '5240' },
    { code: 'TRANSPORT', name: 'Transportation', category: 'OVERHEAD', accountCode: '5250' },
  ];

  for (const expense of expenseTypes) {
    await prisma.expense_types.upsert({
      where: { expenseCode: expense.code },
      update: {},
      create: {
        expenseCode: expense.code,
        expenseName: expense.name,
        expenseCategory: expense.category as any,
        accountId: accountMap[expense.accountCode],
        isRecurring: ['SALARY', 'RENT', 'ELECTRICITY'].includes(expense.code),
        description: `${expense.name} expenses`,
        isActive: true,
        createdById: userId,
      },
    });
  }

  console.log('✅ Expense types created: 7 categories\n');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('═══════════════════════════════════════');
  console.log('🎉 Indian Financial Masters Seeded!');
  console.log('═══════════════════════════════════════');
  console.log('✅ Currency: INR (base) + USD, EUR, GBP');
  console.log('✅ GST Rates: 0%, 5%, 12%, 18%, 28%');
  console.log('✅ Tax Types: GST, IGST, CGST, SGST');
  console.log('✅ Payment Terms: 9 options');
  console.log('✅ Chart of Accounts: 35+ accounts');
  console.log('✅ Expense Types: 7 categories');
  console.log('═══════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
