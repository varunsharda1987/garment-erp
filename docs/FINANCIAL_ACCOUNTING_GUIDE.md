# Financial & Accounting Guide

## Table of Contents

1. [Overview](#1-overview)
2. [Chart of Accounts](#2-chart-of-accounts)
3. [Cost Centers](#3-cost-centers)
4. [Expense Types](#4-expense-types)
5. [Tax Masters](#5-tax-masters)
6. [Payment Terms](#6-payment-terms)
7. [Bank Accounts](#7-bank-accounts)
8. [Currencies & Exchange Rates](#8-currencies--exchange-rates)
9. [Invoice Management](#9-invoice-management)
10. [Payment Tracking](#10-payment-tracking)
11. [Quotations](#11-quotations)
12. [Financial Reporting](#12-financial-reporting)
13. [GST Integration](#13-gst-integration)
14. [API Reference](#14-api-reference)
15. [Frontend Integration](#15-frontend-integration)
16. [Best Practices](#16-best-practices)

---

## 1. Overview

### Purpose

The Financial & Accounting system provides:

- **Chart of Accounts**: Hierarchical account structure for financial tracking
- **Cost Centers**: Department/location/project-based cost allocation
- **Expense Management**: Categorized expense tracking with account linking
- **Tax Management**: GST, VAT, duties with HSN/SAC codes
- **Payment Terms**: Standardized payment schedules and discount policies
- **Multi-Currency**: Currency master with real-time exchange rates
- **Bank Accounts**: Multiple bank account management with balance tracking
- **Invoice & Quotation**: Complete billing workflow with GST calculation
- **Payment Tracking**: Payment recording with method, reference, and reconciliation

### Key Features

✅ Hierarchical Chart of Accounts (parent-child relationships)
✅ Cost Center allocation by department/location/project
✅ Expense categorization with account linking
✅ Tax management with date-based applicability
✅ Multi-currency support with exchange rate tracking
✅ Invoice management with automatic GST calculation
✅ Payment recording with multiple payment methods
✅ Quotation to order workflow
✅ Financial reporting and dashboards

### Core Models

```prisma
// Financial structure
model chart_of_accounts {
  accountCode     String
  accountName     String
  accountType     AccountType   // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  accountGroup    AccountGroup  // CURRENT_ASSET, FIXED_ASSET, etc.
  parentAccountId String?       // Hierarchical structure
}

model cost_centers {
  costCenterCode String
  costCenterName String
  costCenterType String        // DEPARTMENT, LOCATION, PROJECT, PRODUCT_LINE
  budgetAmount   Decimal?
}

model expense_types {
  expenseCode     String
  expenseName     String
  expenseCategory ExpenseCategory // DIRECT, INDIRECT, ADMIN, MARKETING, etc.
  accountId       String?         // Link to COA
}

// Billing & payments
model invoices {
  invoiceNumber   String
  orderId         String
  customerId      String
  subtotal        Decimal
  taxAmount       Decimal        // GST calculated
  totalAmount     Decimal
  paidAmount      Decimal        // Sum of payments
  balanceAmount   Decimal        // totalAmount - paidAmount
  status          InvoiceStatus  // PENDING, PARTIALLY_PAID, PAID, OVERDUE
}

model payments {
  invoiceId       String
  amount          Decimal
  paymentDate     DateTime
  paymentMethod   PaymentMethod  // CASH, CHEQUE, NEFT, RTGS, UPI, etc.
  referenceNumber String?
}
```

### Financial Workflow

```
1. Setup Phase
   ├─ Create Chart of Accounts
   ├─ Setup Cost Centers
   ├─ Define Expense Types
   ├─ Configure Tax Masters
   ├─ Create Payment Terms
   └─ Add Bank Accounts

2. Operational Phase
   ├─ Create Quotations → Approve → Convert to Order
   ├─ Create Invoices from Orders (with GST)
   ├─ Record Payments → Update Invoice Status
   ├─ Track Expenses → Allocate to Cost Centers
   └─ Multi-currency Transactions → Exchange Rate Application

3. Reporting Phase
   ├─ Invoice Summary (Pending, Paid, Overdue)
   ├─ Payment Reports (Method-wise, Date-wise)
   ├─ Cost Center Reports (Budget vs Actual)
   └─ GST Reports (CGST, SGST, IGST)
```

---

## 2. Chart of Accounts

### Database Schema

```prisma
model chart_of_accounts {
  id              String       @id
  accountCode     String       // ACC-1000, ACC-1100, ACC-2000
  accountName     String       // "Cash", "Bank - HDFC", "Sales Revenue"
  accountType     AccountType  // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  accountGroup    AccountGroup // CURRENT_ASSET, FIXED_ASSET, etc.
  parentAccountId String?      // For hierarchical structure
  description     String?
  isActive        Boolean      @default(true)
  isSystem        Boolean      @default(false) // System accounts (non-deletable)

  // Self-referential relation
  parentAccount chart_of_accounts?  @relation("AccountHierarchy", ...)
  childAccounts chart_of_accounts[] @relation("AccountHierarchy")

  // Relations
  expense_types expense_types[]
}
```

### Account Types

**AccountType Enum:**
- `ASSET` - Resources owned (Cash, Bank, Inventory, Fixed Assets)
- `LIABILITY` - Obligations owed (Loans, Payables, Accruals)
- `EQUITY` - Owner's stake (Capital, Retained Earnings)
- `REVENUE` - Income (Sales, Services, Interest Income)
- `EXPENSE` - Costs (Materials, Salaries, Rent, Utilities)

**AccountGroup Enum:**
- **Assets:**
  - `CURRENT_ASSET` - Cash, Bank, Accounts Receivable, Inventory
  - `FIXED_ASSET` - Machinery, Buildings, Vehicles
  - `INTANGIBLE_ASSET` - Patents, Goodwill
- **Liabilities:**
  - `CURRENT_LIABILITY` - Accounts Payable, Short-term Loans
  - `LONG_TERM_LIABILITY` - Mortgages, Bonds
- **Equity:**
  - `CAPITAL` - Owner's Capital
  - `RETAINED_EARNINGS` - Accumulated Profits
- **Revenue:**
  - `OPERATING_REVENUE` - Sales, Service Income
  - `OTHER_INCOME` - Interest, Rental Income
- **Expense:**
  - `COST_OF_SALES` - Direct Material, Direct Labor
  - `OPERATING_EXPENSE` - Rent, Salaries, Utilities
  - `FINANCIAL_EXPENSE` - Interest Paid

### Hierarchical Structure

**Example Account Structure:**

```
ACC-1000 Assets (Parent)
  ├─ ACC-1100 Current Assets (Parent)
  │   ├─ ACC-1110 Cash (Leaf)
  │   ├─ ACC-1120 Bank - HDFC (Leaf)
  │   ├─ ACC-1130 Bank - ICICI (Leaf)
  │   └─ ACC-1150 Accounts Receivable (Leaf)
  └─ ACC-1200 Fixed Assets (Parent)
      ├─ ACC-1210 Machinery (Leaf)
      └─ ACC-1220 Buildings (Leaf)

ACC-2000 Liabilities (Parent)
  └─ ACC-2100 Current Liabilities (Parent)
      ├─ ACC-2110 Accounts Payable (Leaf)
      └─ ACC-2120 Short-term Loans (Leaf)

ACC-3000 Revenue (Parent)
  ├─ ACC-3100 Sales Revenue - Domestic (Leaf)
  ├─ ACC-3200 Sales Revenue - Export (Leaf)
  └─ ACC-3300 Other Income (Leaf)

ACC-4000 Expenses (Parent)
  ├─ ACC-4100 Cost of Goods Sold (Parent)
  │   ├─ ACC-4110 Raw Materials (Leaf)
  │   └─ ACC-4120 Direct Labor (Leaf)
  └─ ACC-4200 Operating Expenses (Parent)
      ├─ ACC-4210 Salaries (Leaf)
      ├─ ACC-4220 Rent (Leaf)
      └─ ACC-4230 Utilities (Leaf)
```

### API: Create Chart of Account

```bash
curl -X POST http://localhost:5000/api/chart-of-accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "accountCode": "ACC-1120",
    "accountName": "Bank - HDFC Checking",
    "accountType": "ASSET",
    "accountGroup": "CURRENT_ASSET",
    "parentAccountId": "acc-parent-uuid",
    "description": "HDFC Bank Current Account - Checking",
    "isSystem": false
  }'
```

### Query: Get Account Hierarchy

```typescript
// Fetch accounts with full hierarchy
const accounts = await prisma.chart_of_accounts.findMany({
  where: { isActive: true },
  include: {
    parentAccount: true,
    childAccounts: {
      include: {
        childAccounts: true, // Recursive nesting
      },
    },
  },
  orderBy: { accountCode: 'asc' },
});

// Build tree structure
function buildAccountTree(accounts: any[], parentId: string | null = null): any[] {
  return accounts
    .filter(acc => acc.parentAccountId === parentId)
    .map(acc => ({
      ...acc,
      children: buildAccountTree(accounts, acc.id),
    }));
}

const accountTree = buildAccountTree(accounts);
```

---

## 3. Cost Centers

### Database Schema

```prisma
model cost_centers {
  id             String   @id
  costCenterCode String   // CC-001, CC-PROD-01, CC-SALES-MH
  costCenterName String   // "Production Department", "Mumbai Office"
  costCenterType String   // DEPARTMENT, LOCATION, PROJECT, PRODUCT_LINE
  departmentId   String?
  locationId     String?
  budgetAmount   Decimal? // Annual/monthly budget
  description    String?
  isActive       Boolean  @default(true)

  // Relations
  locations locations? @relation(...)
}
```

### Cost Center Types

- **DEPARTMENT** - Organizational units (Production, Sales, Admin, R&D)
- **LOCATION** - Physical locations (Mumbai Office, Delhi Branch, Factory-1)
- **PROJECT** - Specific projects (Project Alpha, Event XYZ)
- **PRODUCT_LINE** - Product categories (Menswear, Womenswear, Kids)

### Use Cases

**1. Department-wise Expense Tracking**

```sql
-- Allocate expenses to Production Department
INSERT INTO expenses (expenseTypeId, costCenterId, amount, ...)
VALUES ('expense-type-uuid', 'cc-production-uuid', 50000, ...);

-- Report: Expenses by Department
SELECT
  cc.costCenterName,
  SUM(e.amount) as totalExpense,
  cc.budgetAmount,
  (cc.budgetAmount - SUM(e.amount)) as budgetRemaining
FROM expenses e
JOIN cost_centers cc ON e.costCenterId = cc.id
GROUP BY cc.id;
```

**2. Location-wise Cost Allocation**

```bash
# Create location-based cost center
curl -X POST http://localhost:5000/api/cost-centers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "costCenterCode": "CC-LOC-MUM",
    "costCenterName": "Mumbai Office",
    "costCenterType": "LOCATION",
    "locationId": "location-mumbai-uuid",
    "budgetAmount": 500000,
    "description": "All operational costs for Mumbai office"
  }'
```

**3. Project-wise Tracking**

```bash
# Create project-based cost center
curl -X POST http://localhost:5000/api/cost-centers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "costCenterCode": "CC-PROJ-ALPHA",
    "costCenterName": "Project Alpha",
    "costCenterType": "PROJECT",
    "budgetAmount": 1000000,
    "description": "New product line launch project"
  }'
```

### Budget Monitoring

```typescript
// Get cost center with expense summary
const costCenter = await prisma.cost_centers.findUnique({
  where: { id: costCenterId },
  include: {
    expenses: {
      where: {
        expenseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
  },
});

const totalExpenses = costCenter.expenses.reduce(
  (sum, expense) => sum + parseFloat(expense.amount.toString()),
  0
);

const budgetUsed = (totalExpenses / parseFloat(costCenter.budgetAmount.toString())) * 100;

// Alert if budget exceeded
if (budgetUsed > 100) {
  console.warn(`Cost Center ${costCenter.costCenterName} has exceeded budget by ${budgetUsed - 100}%`);
}
```

---

## 4. Expense Types

### Database Schema

```prisma
model expense_types {
  id              String          @id
  expenseCode     String          // EXP-001, EXP-MAT, EXP-SAL
  expenseName     String          // "Raw Materials", "Salaries", "Rent"
  expenseCategory ExpenseCategory // DIRECT, INDIRECT, ADMIN, MARKETING, FINANCIAL
  accountId       String?         // Link to Chart of Accounts
  isRecurring     Boolean         @default(false) // Monthly recurring expense?
  description     String?
  isActive        Boolean         @default(true)

  // Relations
  chart_of_accounts chart_of_accounts? @relation(...)
}
```

### Expense Categories

**ExpenseCategory Enum:**
- `DIRECT` - Directly attributable to production (Raw Materials, Direct Labor)
- `INDIRECT` - Production overheads (Factory Rent, Utilities, Maintenance)
- `ADMIN` - Administrative costs (Office Rent, Admin Salaries, Supplies)
- `MARKETING` - Sales & marketing (Advertising, Commissions, Travel)
- `FINANCIAL` - Finance-related (Interest, Bank Charges, Loan Fees)
- `LOGISTICS` - Transportation & dispatch (Freight, Courier, Transport)
- `RESEARCH` - R&D expenses (Product Development, Testing)
- `OTHER` - Miscellaneous expenses

### Linking to Chart of Accounts

**Example Mapping:**

```typescript
// Expense Type: "Raw Materials"
{
  expenseCode: "EXP-MAT-001",
  expenseName: "Raw Materials - Fabric",
  expenseCategory: "DIRECT",
  accountId: "acc-4110-uuid", // COA: ACC-4110 Raw Materials (Expense Account)
  isRecurring: false
}

// Expense Type: "Salaries"
{
  expenseCode: "EXP-SAL-001",
  expenseName: "Salaries - Production Staff",
  expenseCategory: "DIRECT",
  accountId: "acc-4120-uuid", // COA: ACC-4120 Direct Labor (Expense Account)
  isRecurring: true           // Monthly recurring
}

// Expense Type: "Rent"
{
  expenseCode: "EXP-RENT-001",
  expenseName: "Office Rent",
  expenseCategory: "ADMIN",
  accountId: "acc-4220-uuid", // COA: ACC-4220 Rent (Operating Expense)
  isRecurring: true
}
```

### API: Create Expense Type

```bash
curl -X POST http://localhost:5000/api/expense-types \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "expenseCode": "EXP-MAT-FAB",
    "expenseName": "Fabric Purchase",
    "expenseCategory": "DIRECT",
    "accountId": "acc-4110-uuid",
    "isRecurring": false,
    "description": "All fabric procurement expenses"
  }'
```

### Expense Recording Workflow

```
1. Create Expense Record
   └─ expenseTypeId: EXP-MAT-FAB
   └─ costCenterId: CC-PROD-01 (Production Department)
   └─ amount: ₹50,000
   └─ expenseDate: 2025-01-12

2. System Links to COA
   └─ Expense Type → accountId: ACC-4110 (Raw Materials)
   └─ Auto-post to accounting ledger

3. Cost Center Tracking
   └─ Deduct from cost center budget
   └─ Update budget utilization report
```

---

## 5. Tax Masters

### Database Schema

```prisma
model tax_masters {
  id             String    @id
  taxCode        String    // GST-12, GST-18, VAT-5
  taxName        String    // "GST 12%", "IGST 18%"
  taxType        TaxType   // GST, VAT, CUSTOMS_DUTY, CESS
  taxRate        Decimal   // 12.00, 18.00, 5.00
  hsnSacCode     String?   // HSN/SAC code for GST
  description    String?
  applicableFrom DateTime  // Start date
  applicableTo   DateTime? // End date (NULL = still applicable)
  isActive       Boolean   @default(true)
}
```

### Tax Types

**TaxType Enum:**
- `GST` - Goods and Services Tax (India)
- `VAT` - Value Added Tax
- `CUSTOMS_DUTY` - Import/export duties
- `CESS` - Additional cess/surcharge
- `EXCISE` - Excise duty
- `SALES_TAX` - State sales tax (legacy)

### GST Rates for Garments

**Standard GST Rates:**
- **5%** - Cotton fabrics, handloom products
- **12%** - Most readymade garments (standard rate)
- **18%** - Premium/branded garments
- **28%** - Luxury items (rare in garments)

### HSN/SAC Codes

**Common Garment HSN Codes:**
- **6204** - Women's or girls' suits, ensembles, jackets, dresses, skirts
- **6205** - Men's or boys' shirts
- **6206** - Women's or girls' blouses, shirts
- **6110** - Jerseys, pullovers, cardigans, waistcoats

### API: Create Tax Master

```bash
curl -X POST http://localhost:5000/api/tax-masters \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "taxCode": "GST-12-GARMENTS",
    "taxName": "GST 12% - Readymade Garments",
    "taxType": "GST",
    "taxRate": 12.00,
    "hsnSacCode": "6204",
    "description": "Standard GST rate for readymade garments",
    "applicableFrom": "2017-07-01",
    "applicableTo": null
  }'
```

### Date-Based Tax Applicability

**Use Case:** GST rate changed from 18% to 12% on 2022-01-01.

```typescript
// Query applicable tax rate for a date
const getApplicableTaxRate = async (taxType: string, date: Date) => {
  const tax = await prisma.tax_masters.findFirst({
    where: {
      taxType,
      isActive: true,
      applicableFrom: { lte: date },
      OR: [
        { applicableTo: null },
        { applicableTo: { gte: date } },
      ],
    },
    orderBy: { applicableFrom: 'desc' },
  });

  return tax ? parseFloat(tax.taxRate.toString()) : 0;
};

// Example: Invoice dated 2023-06-15
const taxRate = await getApplicableTaxRate('GST', new Date('2023-06-15'));
console.log(taxRate); // 12.00
```

---

## 6. Payment Terms

### Database Schema

```prisma
model payment_terms {
  id              String   @id
  termCode        String   // NET-30, NET-60, ADV-50
  termName        String   // "Net 30 Days", "50% Advance"
  description     String?  // "Payment due within 30 days of invoice"
  daysCount       Int?     // 30, 60, 90 (for NET terms)
  paymentSchedule Json?    // For complex schedules
  discountPercent Decimal? // Early payment discount
  isActive        Boolean  @default(true)

  // Relations
  customers customers[]
  suppliers suppliers[]
}
```

### Common Payment Terms

**1. Net Terms**

```bash
# NET-30: Payment due within 30 days
{
  "termCode": "NET-30",
  "termName": "Net 30 Days",
  "description": "Payment due within 30 days of invoice date",
  "daysCount": 30,
  "discountPercent": null
}

# NET-60: Payment due within 60 days
{
  "termCode": "NET-60",
  "termName": "Net 60 Days",
  "description": "Payment due within 60 days of invoice date",
  "daysCount": 60,
  "discountPercent": null
}
```

**2. Advance Payment Terms**

```bash
# 50% Advance, 50% on Delivery
{
  "termCode": "ADV-50-BAL-DEL",
  "termName": "50% Advance, 50% on Delivery",
  "description": "50% advance payment, balance on delivery",
  "paymentSchedule": {
    "milestones": [
      { "milestone": "Order Confirmation", "percentage": 50 },
      { "milestone": "Delivery", "percentage": 50 }
    ]
  }
}

# 100% Advance
{
  "termCode": "ADV-100",
  "termName": "100% Advance Payment",
  "description": "Full payment before production",
  "daysCount": 0
}
```

**3. PDC (Post-Dated Cheque) Terms**

```bash
# PDC-30-60-90: Three PDCs over 90 days
{
  "termCode": "PDC-30-60-90",
  "termName": "PDC 30-60-90 Days",
  "description": "Three equal PDCs dated 30, 60, and 90 days from invoice",
  "paymentSchedule": {
    "milestones": [
      { "days": 30, "percentage": 33.33 },
      { "days": 60, "percentage": 33.33 },
      { "days": 90, "percentage": 33.34 }
    ]
  }
}
```

**4. Early Payment Discount**

```bash
# 2/10 Net 30: 2% discount if paid within 10 days, else net 30 days
{
  "termCode": "2-10-NET-30",
  "termName": "2/10 Net 30",
  "description": "2% discount if paid within 10 days, otherwise net 30 days",
  "daysCount": 30,
  "discountPercent": 2.0,
  "paymentSchedule": {
    "discountDays": 10
  }
}
```

### Complex Payment Schedule (JSON)

```json
{
  "paymentSchedule": {
    "milestones": [
      {
        "milestone": "Order Confirmation",
        "percentage": 30,
        "description": "Advance payment on order confirmation"
      },
      {
        "milestone": "Sample Approval",
        "percentage": 20,
        "description": "Payment after sample approval"
      },
      {
        "milestone": "Production Start",
        "percentage": 30,
        "description": "Payment before production starts"
      },
      {
        "milestone": "Delivery",
        "percentage": 20,
        "description": "Balance payment on delivery"
      }
    ]
  }
}
```

### API: Create Payment Term

```bash
curl -X POST http://localhost:5000/api/payment-terms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "termCode": "ADV-30-BAL-DEL",
    "termName": "30% Advance, Balance on Delivery",
    "description": "30% advance payment on order, balance on delivery",
    "paymentSchedule": {
      "milestones": [
        { "milestone": "Order Confirmation", "percentage": 30 },
        { "milestone": "Delivery", "percentage": 70 }
      ]
    }
  }'
```

---

## 7. Bank Accounts

### Database Schema

```prisma
model bank_accounts {
  id                String          @id
  accountNumber     String          // Unique bank account number
  bankName          String          // "HDFC Bank", "ICICI Bank"
  branchName        String          // "Andheri West", "MG Road"
  ifscCode          String?         // IFSC code for NEFT/RTGS
  swiftCode         String?         // SWIFT code for international transfers
  accountType       BankAccountType // SAVINGS, CURRENT, OVERDRAFT, FIXED_DEPOSIT
  accountHolderName String
  openingBalance    Decimal         // Initial balance
  currentBalance    Decimal         // Real-time balance
  currency          String          @default("INR")
  isActive          Boolean         @default(true)
  isPrimaryAccount  Boolean         @default(false) // Default account for transactions
}
```

### Account Types

**BankAccountType Enum:**
- `SAVINGS` - Personal savings account
- `CURRENT` - Business current account (no interest, unlimited transactions)
- `OVERDRAFT` - Overdraft facility linked account
- `FIXED_DEPOSIT` - Term deposit account

### API: Create Bank Account

```bash
curl -X POST http://localhost:5000/api/bank-accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "accountNumber": "123456789012",
    "bankName": "HDFC Bank",
    "branchName": "Andheri West, Mumbai",
    "ifscCode": "HDFC0001234",
    "swiftCode": "HDFCINBB",
    "accountType": "CURRENT",
    "accountHolderName": "ABC Garments Pvt Ltd",
    "openingBalance": 500000.00,
    "currentBalance": 500000.00,
    "currency": "INR",
    "isPrimaryAccount": true
  }'
```

### Balance Tracking

**Update Balance on Payment:**

```typescript
// Record payment received in bank account
async function recordPaymentInBank(
  paymentId: string,
  bankAccountId: string,
  amount: number
) {
  await prisma.bank_accounts.update({
    where: { id: bankAccountId },
    data: {
      currentBalance: { increment: amount },
    },
  });

  // Create bank transaction log
  await prisma.bank_transactions.create({
    data: {
      bankAccountId,
      transactionType: 'CREDIT',
      amount,
      referenceType: 'PAYMENT',
      referenceId: paymentId,
      transactionDate: new Date(),
    },
  });
}
```

### Multi-Account Management

```typescript
// Get all active bank accounts with balances
const accounts = await prisma.bank_accounts.findMany({
  where: { isActive: true },
  select: {
    id: true,
    accountNumber: true,
    bankName: true,
    accountType: true,
    currentBalance: true,
    currency: true,
    isPrimaryAccount: true,
  },
  orderBy: [
    { isPrimaryAccount: 'desc' }, // Primary account first
    { bankName: 'asc' },
  ],
});

// Total balance across all accounts (INR only)
const totalBalance = accounts
  .filter(acc => acc.currency === 'INR')
  .reduce((sum, acc) => sum + parseFloat(acc.currentBalance.toString()), 0);
```

---

## 8. Currencies & Exchange Rates

### Database Schemas

```prisma
// Currency Master
model currencies {
  id             String   @id
  currencyCode   String   @unique // USD, EUR, GBP, INR
  currencyName   String   // "US Dollar", "Euro"
  currencySymbol String   // "$", "€", "£", "₹"
  isBaseCurrency Boolean  @default(false) // Base currency for conversion
  decimalPlaces  Int      @default(2)     // 2 for USD, 0 for JPY
  isActive       Boolean  @default(true)

  // Relations
  exchange_rates exchange_rates[]
  customers      customers[]
  suppliers      suppliers[]
}

// Exchange Rate Tracking
model exchange_rates {
  id            String   @id
  currencyCode  String   // USD, EUR, GBP
  effectiveDate DateTime // Date for which rate is applicable
  rateType      RateType // BUY, SELL, MID
  exchangeRate  Decimal  // 1 USD = 83.25 INR

  // Unique constraint: one rate per currency per date per type
  @@unique([currencyCode, effectiveDate, rateType])
}
```

### Rate Types

**RateType Enum:**
- `BUY` - Rate at which you buy foreign currency
- `SELL` - Rate at which you sell foreign currency
- `MID` - Mid-market rate (average of buy/sell)

### API: Create Currency

```bash
curl -X POST http://localhost:5000/api/currencies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "currencyCode": "USD",
    "currencyName": "US Dollar",
    "currencySymbol": "$",
    "isBaseCurrency": false,
    "decimalPlaces": 2
  }'
```

### API: Add Exchange Rate

```bash
curl -X POST http://localhost:5000/api/exchange-rates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "currencyCode": "USD",
    "effectiveDate": "2025-01-12",
    "rateType": "MID",
    "exchangeRate": 83.25
  }'
```

### Currency Conversion

```typescript
// Get exchange rate for a date
async function getExchangeRate(
  currencyCode: string,
  date: Date,
  rateType: string = 'MID'
): Promise<number> {
  const rate = await prisma.exchange_rates.findFirst({
    where: {
      currencyCode,
      rateType,
      effectiveDate: { lte: date },
    },
    orderBy: { effectiveDate: 'desc' },
  });

  return rate ? parseFloat(rate.exchangeRate.toString()) : 1.0;
}

// Convert amount from USD to INR
const amountUSD = 1000;
const rate = await getExchangeRate('USD', new Date());
const amountINR = amountUSD * rate; // 1000 * 83.25 = 83,250 INR
```

### Multi-Currency Invoice

```typescript
// Invoice in foreign currency
const invoice = await prisma.invoices.create({
  data: {
    invoiceNumber: 'INV-EXP-001',
    customerId: 'customer-uuid',
    currency: 'USD',
    subtotal: 10000, // $10,000
    exchangeRate: 83.25,
    subtotalInBaseCurrency: 832500, // ₹8,32,500
    // ... tax and total calculations
  },
});
```

---

## 9. Invoice Management

### Database Schema

```prisma
model invoices {
  id              String         @id
  invoiceNumber   String         @unique // INV-2512-0001
  orderId         String
  customerId      String
  invoiceDate     DateTime       @default(now())
  dueDate         DateTime
  status          InvoiceStatus  @default(PENDING)
  subtotal        Decimal        // Amount before tax
  taxAmount       Decimal        // Total tax (GST)
  totalAmount     Decimal        // subtotal + taxAmount
  paidAmount      Decimal        @default(0)
  balanceAmount   Decimal        // totalAmount - paidAmount
  remarks         String?

  // GST fields
  placeOfSupplyId String?        // State of supply
  cgstAmount      Decimal        @default(0) // Central GST
  sgstAmount      Decimal        @default(0) // State GST
  igstAmount      Decimal        @default(0) // Integrated GST
  taxRate         Decimal?       // 5, 12, 18, 28

  // Relations
  orders        orders         @relation(...)
  customers     customers      @relation(...)
  placeOfSupply indian_states? @relation(...)
  payments      payments[]
}
```

### Invoice Status

**InvoiceStatus Enum:**
- `PENDING` - Invoice created, no payment received
- `PARTIALLY_PAID` - Partial payment received
- `PAID` - Fully paid
- `OVERDUE` - Due date passed, not fully paid
- `CANCELLED` - Invoice cancelled

### Invoice Number Generation

**Format:** `INV-YYMM-XXXX`

```typescript
async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `INV-${year}${month}-`;

  const latestInvoice = await prisma.invoices.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
  });

  let nextNumber = 1;
  if (latestInvoice) {
    const match = latestInvoice.invoiceNumber.match(/INV-\d{4}-(\d+)/);
    if (match) nextNumber = parseInt(match[1], 10) + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}
```

### Auto GST Calculation

```typescript
// Create invoice with automatic GST calculation
async function createInvoiceWithGST(data: CreateInvoiceDTO) {
  const customer = await prisma.customers.findUnique({
    where: { id: data.customerId },
    include: { billingState: true },
  });

  const order = await prisma.orders.findUnique({
    where: { id: data.orderId },
  });

  // Get company state from environment
  const companyStateId = process.env.COMPANY_STATE_ID;

  // Determine if intrastate or interstate
  const isIntrastate = customer.billingStateId === companyStateId;

  // Calculate GST (default 12% for garments if not provided)
  const taxRate = data.taxRate || 12;
  const taxAmount = (data.subtotal * taxRate) / 100;

  let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

  if (isIntrastate) {
    // Intrastate: CGST + SGST (split equally)
    cgstAmount = taxAmount / 2;
    sgstAmount = taxAmount / 2;
  } else {
    // Interstate: IGST
    igstAmount = taxAmount;
  }

  const totalAmount = data.subtotal + taxAmount;
  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await prisma.invoices.create({
    data: {
      id: randomUUID(),
      invoiceNumber,
      orderId: data.orderId,
      customerId: data.customerId,
      invoiceDate: data.invoiceDate || new Date(),
      dueDate: data.dueDate,
      subtotal: data.subtotal,
      taxAmount,
      totalAmount,
      balanceAmount: totalAmount,
      placeOfSupplyId: customer.billingStateId,
      cgstAmount,
      sgstAmount,
      igstAmount,
      taxRate,
      remarks: data.remarks,
      status: 'PENDING',
      createdById: data.createdById,
    },
  });

  return invoice;
}
```

### API: Create Invoice

```bash
curl -X POST http://localhost:5000/api/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "orderId": "order-uuid",
    "customerId": "customer-uuid",
    "dueDate": "2025-02-11",
    "subtotal": 100000,
    "taxRate": 12,
    "remarks": "Invoice for Order ORD-2025-001"
  }'
```

**Response:**

```json
{
  "data": {
    "id": "invoice-uuid",
    "invoiceNumber": "INV-2501-0001",
    "invoiceDate": "2025-01-12",
    "dueDate": "2025-02-11",
    "subtotal": 100000,
    "taxAmount": 12000,
    "cgstAmount": 6000,
    "sgstAmount": 6000,
    "igstAmount": 0,
    "totalAmount": 112000,
    "balanceAmount": 112000,
    "status": "PENDING"
  }
}
```

---

## 10. Payment Tracking

### Database Schema

```prisma
model payments {
  id              String        @id
  invoiceId       String
  paymentDate     DateTime      @default(now())
  amount          Decimal
  paymentMethod   PaymentMethod
  referenceNumber String?       // Cheque no, UTR no, Transaction ID
  remarks         String?
  receivedById    String        // User who recorded payment

  // Relations
  invoices invoices @relation(...)
  users    users    @relation(...)
}
```

### Payment Methods

**PaymentMethod Enum:**
- `CASH` - Cash payment
- `CHEQUE` - Cheque payment
- `NEFT` - National Electronic Funds Transfer
- `RTGS` - Real Time Gross Settlement
- `IMPS` - Immediate Payment Service
- `UPI` - Unified Payments Interface
- `CARD` - Credit/Debit Card
- `WIRE_TRANSFER` - International wire transfer
- `LC` - Letter of Credit
- `PDC` - Post-Dated Cheque

### Record Payment

```typescript
// Service: invoice.service.ts

async recordPayment(data: RecordPaymentDTO) {
  return await prisma.$transaction(async (tx) => {
    // 1. Get invoice
    const invoice = await tx.invoices.findUnique({
      where: { id: data.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new ValidationError('Invoice is already fully paid');
    }

    // 2. Validate payment amount
    const balance = parseFloat(invoice.balanceAmount.toString());
    if (data.amount > balance) {
      throw new ValidationError(
        `Payment amount (${data.amount}) exceeds balance (${balance})`
      );
    }

    // 3. Create payment record
    const payment = await tx.payments.create({
      data: {
        id: randomUUID(),
        invoiceId: data.invoiceId,
        paymentDate: data.paymentDate || new Date(),
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
        remarks: data.remarks,
        receivedById: data.receivedById,
      },
    });

    // 4. Update invoice paid amount and balance
    const newPaidAmount = parseFloat(invoice.paidAmount.toString()) + data.amount;
    const newBalanceAmount = parseFloat(invoice.totalAmount.toString()) - newPaidAmount;

    // 5. Calculate new status
    let newStatus: InvoiceStatus = 'PENDING';
    if (newBalanceAmount <= 0) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      if (new Date() > new Date(invoice.dueDate)) {
        newStatus = 'OVERDUE';
      } else {
        newStatus = 'PARTIALLY_PAID';
      }
    }

    // 6. Update invoice
    const updatedInvoice = await tx.invoices.update({
      where: { id: data.invoiceId },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: newBalanceAmount,
        status: newStatus,
      },
      include: {
        payments: true,
        customers: true,
        orders: true,
      },
    });

    return { payment, invoice: updatedInvoice };
  });
}
```

### API: Record Payment

```bash
curl -X POST http://localhost:5000/api/invoices/{invoiceId}/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "amount": 50000,
    "paymentDate": "2025-01-12",
    "paymentMethod": "NEFT",
    "referenceNumber": "UTR123456789",
    "remarks": "First installment payment"
  }'
```

**Response:**

```json
{
  "data": {
    "payment": {
      "id": "payment-uuid",
      "amount": 50000,
      "paymentDate": "2025-01-12",
      "paymentMethod": "NEFT",
      "referenceNumber": "UTR123456789"
    },
    "invoice": {
      "id": "invoice-uuid",
      "invoiceNumber": "INV-2501-0001",
      "totalAmount": 112000,
      "paidAmount": 50000,
      "balanceAmount": 62000,
      "status": "PARTIALLY_PAID"
    }
  }
}
```

---

## 11. Quotations

### Database Schema

```prisma
model quotations {
  id                 String           @id
  quotationNumber    String           // QUOT-2512-0001
  customerId         String
  quotationDate      DateTime         @default(now())
  validUntil         DateTime         // Validity period
  status             QuotationStatus  @default(DRAFT)
  totalAmount        Decimal?
  remarks            String?
  termsAndConditions String?
  placeOfSupplyId    String?

  // GST estimates
  estimatedCGST Decimal @default(0)
  estimatedSGST Decimal @default(0)
  estimatedIGST Decimal @default(0)
  taxRate       Decimal?
  totalWithTax  Decimal?

  // Relations
  customers     customers      @relation(...)
  placeOfSupply indian_states? @relation(...)
  quotation_items quotation_items[]
}
```

### Quotation Status

**QuotationStatus Enum:**
- `DRAFT` - Being prepared
- `SENT` - Sent to customer
- `ACCEPTED` - Customer accepted
- `REJECTED` - Customer rejected
- `EXPIRED` - Validity period expired
- `CONVERTED` - Converted to order

### Workflow

```
1. Create Quotation (DRAFT)
   └─ Add quotation items with prices

2. Send to Customer (SENT)
   └─ Email quotation PDF

3. Customer Decision
   ├─ Accept → status: ACCEPTED
   └─ Reject → status: REJECTED

4. Convert to Order (CONVERTED)
   └─ Create order from quotation
   └─ Link quotationId in order
```

### API: Create Quotation

```bash
curl -X POST http://localhost:5000/api/quotations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "customer-uuid",
    "validUntil": "2025-02-12",
    "remarks": "Special discount offer",
    "termsAndConditions": "Price valid for 30 days. 50% advance required.",
    "items": [
      {
        "styleId": "style-1",
        "quantity": 1000,
        "unitPrice": 150,
        "totalPrice": 150000
      },
      {
        "styleId": "style-2",
        "quantity": 500,
        "unitPrice": 200,
        "totalPrice": 100000
      }
    ]
  }'
```

### Convert Quotation to Order

```typescript
async function convertQuotationToOrder(
  quotationId: string,
  userId: string
) {
  const quotation = await prisma.quotations.findUnique({
    where: { id: quotationId },
    include: { quotation_items: true },
  });

  if (!quotation) {
    throw new NotFoundError('Quotation not found');
  }

  if (quotation.status !== 'ACCEPTED') {
    throw new ValidationError('Only accepted quotations can be converted');
  }

  // Create order from quotation
  const order = await prisma.orders.create({
    data: {
      customerId: quotation.customerId,
      orderDate: new Date(),
      quotationId: quotation.id,
      totalAmount: quotation.totalWithTax || quotation.totalAmount,
      order_items: {
        create: quotation.quotation_items.map(item => ({
          styleId: item.styleId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      },
      createdById: userId,
    },
  });

  // Update quotation status
  await prisma.quotations.update({
    where: { id: quotationId },
    data: { status: 'CONVERTED' },
  });

  return order;
}
```

---

## 12. Financial Reporting

### Invoice Summary

```typescript
// Get invoice summary statistics
async function getInvoiceSummary(): Promise<InvoiceSummary> {
  const [total, pending, partiallyPaid, paid, overdue] = await Promise.all([
    prisma.invoices.count(),
    prisma.invoices.count({ where: { status: 'PENDING' } }),
    prisma.invoices.count({ where: { status: 'PARTIALLY_PAID' } }),
    prisma.invoices.count({ where: { status: 'PAID' } }),
    prisma.invoices.count({ where: { status: 'OVERDUE' } }),
  ]);

  const amounts = await prisma.invoices.aggregate({
    _sum: {
      totalAmount: true,
      paidAmount: true,
      balanceAmount: true,
    },
  });

  return {
    total,
    pending,
    partiallyPaid,
    paid,
    overdue,
    totalAmount: parseFloat(amounts._sum.totalAmount?.toString() || '0'),
    paidAmount: parseFloat(amounts._sum.paidAmount?.toString() || '0'),
    balanceAmount: parseFloat(amounts._sum.balanceAmount?.toString() || '0'),
  };
}
```

### Payment Report

```typescript
// Payments by method in date range
async function getPaymentReport(fromDate: Date, toDate: Date) {
  const payments = await prisma.payments.groupBy({
    by: ['paymentMethod'],
    where: {
      paymentDate: {
        gte: fromDate,
        lte: toDate,
      },
    },
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });

  return payments.map(p => ({
    paymentMethod: p.paymentMethod,
    totalAmount: parseFloat(p._sum.amount?.toString() || '0'),
    transactionCount: p._count.id,
  }));
}
```

### Cost Center Budget Report

```typescript
// Budget vs actual by cost center
async function getCostCenterReport(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const costCenters = await prisma.cost_centers.findMany({
    where: { isActive: true },
    include: {
      expenses: {
        where: {
          expenseDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
    },
  });

  return costCenters.map(cc => {
    const totalExpense = cc.expenses.reduce(
      (sum, exp) => sum + parseFloat(exp.amount.toString()),
      0
    );
    const budget = parseFloat(cc.budgetAmount?.toString() || '0');
    const variance = budget - totalExpense;
    const utilizationPercent = budget > 0 ? (totalExpense / budget) * 100 : 0;

    return {
      costCenterCode: cc.costCenterCode,
      costCenterName: cc.costCenterName,
      budget,
      totalExpense,
      variance,
      utilizationPercent,
    };
  });
}
```

---

## 13. GST Integration

### GST Calculation in Invoices

The invoice creation automatically calculates GST based on customer's billing state and company state.

**Refer to:** [GST_GUIDE.md](GST_GUIDE.md) for comprehensive GST implementation details.

**Key Points:**

1. **Intrastate (Same State):** CGST + SGST (6% + 6% = 12% total)
2. **Interstate (Different States):** IGST (12% total)
3. **Company State:** Set in `COMPANY_STATE_ID` environment variable
4. **Customer State:** From `customers.billingStateId`

**API Endpoint for GST Calculation:**

```bash
curl -X POST http://localhost:5000/api/gst/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100000,
    "taxRate": 12,
    "fromStateId": "company-state-uuid",
    "toStateId": "customer-state-uuid"
  }'
```

**Response:**

```json
{
  "cgst": 6000,
  "sgst": 6000,
  "igst": 0,
  "totalTax": 12000,
  "isInterstate": false
}
```

---

## 14. API Reference

### Chart of Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chart-of-accounts` | Create account |
| GET | `/api/chart-of-accounts` | Get all accounts (hierarchy) |
| GET | `/api/chart-of-accounts/{id}` | Get account by ID |
| PATCH | `/api/chart-of-accounts/{id}` | Update account |
| DELETE | `/api/chart-of-accounts/{id}` | Delete account |

### Cost Centers

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cost-centers` | Create cost center |
| GET | `/api/cost-centers` | Get all cost centers |
| GET | `/api/cost-centers/{id}` | Get cost center by ID |
| PATCH | `/api/cost-centers/{id}` | Update cost center |
| GET | `/api/cost-centers/{id}/budget-report` | Budget vs actual report |

### Expense Types

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/expense-types` | Create expense type |
| GET | `/api/expense-types` | Get all expense types |
| GET | `/api/expense-types/{id}` | Get expense type by ID |
| PATCH | `/api/expense-types/{id}` | Update expense type |

### Tax Masters

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tax-masters` | Create tax master |
| GET | `/api/tax-masters` | Get all tax masters |
| GET | `/api/tax-masters/{id}` | Get tax master by ID |
| GET | `/api/tax-masters/applicable` | Get applicable tax for date |

### Payment Terms

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payment-terms` | Create payment term |
| GET | `/api/payment-terms` | Get all payment terms |
| GET | `/api/payment-terms/{id}` | Get payment term by ID |
| PATCH | `/api/payment-terms/{id}` | Update payment term |

### Bank Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bank-accounts` | Create bank account |
| GET | `/api/bank-accounts` | Get all bank accounts |
| GET | `/api/bank-accounts/{id}` | Get bank account by ID |
| PATCH | `/api/bank-accounts/{id}` | Update bank account |
| GET | `/api/bank-accounts/balances` | Get balance summary |

### Currencies & Exchange Rates

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/currencies` | Create currency |
| GET | `/api/currencies` | Get all currencies |
| POST | `/api/exchange-rates` | Add exchange rate |
| GET | `/api/exchange-rates/{currencyCode}` | Get latest rate |
| GET | `/api/exchange-rates/convert` | Convert amount |

### Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/invoices` | Create invoice (with GST) |
| GET | `/api/invoices` | Get all invoices (filtered, paginated) |
| GET | `/api/invoices/{id}` | Get invoice by ID |
| PATCH | `/api/invoices/{id}` | Update invoice |
| POST | `/api/invoices/{id}/payments` | Record payment |
| GET | `/api/invoices/summary` | Get invoice summary |
| GET | `/api/invoices/overdue` | Get overdue invoices |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments` | Get all payments (filtered) |
| GET | `/api/payments/{id}` | Get payment by ID |
| GET | `/api/payments/report` | Payment report (by method/date) |

### Quotations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/quotations` | Create quotation |
| GET | `/api/quotations` | Get all quotations |
| GET | `/api/quotations/{id}` | Get quotation by ID |
| PATCH | `/api/quotations/{id}` | Update quotation |
| POST | `/api/quotations/{id}/send` | Send to customer |
| POST | `/api/quotations/{id}/accept` | Accept quotation |
| POST | `/api/quotations/{id}/convert` | Convert to order |

---

## 15. Frontend Integration

### Invoice List Page

```typescript
// Fetch invoices with filters
const fetchInvoices = async (filters: InvoiceFilters) => {
  const response = await fetch(
    `/api/invoices?${new URLSearchParams({
      page: filters.page.toString(),
      limit: filters.limit.toString(),
      status: filters.status || '',
      customerId: filters.customerId || '',
      fromDate: filters.fromDate || '',
      toDate: filters.toDate || '',
    })}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const { data, pagination } = await response.json();

  // Backend serializes snake_case to camelCase
  return {
    invoices: data, // Already camelCase
    pagination,
  };
};
```

### Record Payment Form

```typescript
const recordPayment = async (invoiceId: string, paymentData: PaymentFormData) => {
  const response = await fetch(`/api/invoices/${invoiceId}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      amount: paymentData.amount,
      paymentDate: paymentData.date,
      paymentMethod: paymentData.method,
      referenceNumber: paymentData.reference,
      remarks: paymentData.remarks,
    }),
  });

  const { data } = await response.json();

  return {
    payment: data.payment,
    updatedInvoice: data.invoice, // Updated status and balance
  };
};
```

### Dashboard: Invoice Summary

```typescript
const fetchInvoiceSummary = async () => {
  const response = await fetch('/api/invoices/summary', {
    headers: { Authorization: `Bearer ${token}` },
  });

  const { data } = await response.json();

  // data: { total, pending, paid, overdue, totalAmount, paidAmount, balanceAmount }
  return data;
};
```

---

## 16. Best Practices

### 1. Chart of Accounts Setup

**Why:** Proper COA structure is foundation of financial tracking.

**Best Practices:**
- Use hierarchical structure (parent → child → leaf)
- Standardize account codes (ACC-1000, ACC-1100, etc.)
- Mark system accounts as non-deletable (`isSystem: true`)
- Link expense types to appropriate COA accounts

### 2. Cost Center Allocation

**Why:** Track costs by department/location/project for better insights.

**Best Practices:**
- Create cost centers early (before expenses start)
- Set realistic budgets per cost center
- Monitor utilization monthly (budget vs actual)
- Alert when budget exceeds 90%

### 3. Payment Terms Documentation

**Why:** Clear payment terms prevent disputes.

**Best Practices:**
- Document all payment schedules in `paymentSchedule` JSON
- Link payment terms to customers/suppliers
- Update terms in master, not per transaction
- Track adherence to payment terms

### 4. Invoice GST Calculation

**Why:** Automated GST prevents manual errors.

**Best Practices:**
- Always use service-layer GST calculation
- Validate customer billing state before invoice creation
- Store CGST/SGST/IGST separately for reporting
- Link to `placeOfSupplyId` for state tracking

### 5. Payment Reconciliation

**Why:** Match payments to invoices for accurate accounts receivable.

**Best Practices:**
- Record payment immediately upon receipt
- Always capture reference number (UTR, cheque no, transaction ID)
- Auto-update invoice status on payment
- Generate payment receipts

### 6. Multi-Currency Handling

**Why:** Export orders need accurate currency conversion.

**Best Practices:**
- Update exchange rates daily (automated API integration)
- Use `MID` rate type for consistency
- Store both foreign currency amount and base currency amount
- Lock exchange rate at invoice creation date

### 7. Bank Account Balance Tracking

**Why:** Real-time balance visibility prevents overdrafts.

**Best Practices:**
- Update `currentBalance` on every transaction
- Create `bank_transactions` log for audit trail
- Reconcile bank statements monthly
- Alert on low balance thresholds

### 8. Expense Categorization

**Why:** Accurate expense categorization enables cost analysis.

**Best Practices:**
- Link expense types to COA accounts
- Mark recurring expenses (rent, salaries)
- Allocate expenses to cost centers
- Review expense categories quarterly

### 9. Quotation to Order Workflow

**Why:** Seamless conversion from quote to order.

**Best Practices:**
- Create quotations before orders
- Set realistic validity periods (30-60 days)
- Auto-expire quotations after validity
- Link order to quotation for traceability

### 10. Financial Reporting

**Why:** Timely reports enable better decision-making.

**Best Practices:**
- Generate invoice summary daily
- Review overdue invoices weekly
- Analyze cost center budgets monthly
- GST reports monthly (before filing)

### 11. Audit Trail

**Why:** Track all financial changes for compliance.

**Best Practices:**
- Log all invoice and payment changes
- Track who created/modified financial records
- Store historical exchange rates
- Retain deleted records (soft delete)

### 12. Tax Compliance

**Why:** Proper tax tracking prevents penalties.

**Best Practices:**
- Use date-based tax applicability
- Link HSN/SAC codes to tax masters
- Separate CGST/SGST/IGST in invoices
- Generate tax reports monthly

### 13. Security & Permissions

**Why:** Financial data requires strict access control.

**Best Practices:**
- Role-based access (ADMIN, ACCOUNTANT, VIEWER)
- Separate permissions for invoice creation vs payment recording
- Two-factor authentication for financial transactions
- Regular audit of user access logs

### 14. Data Validation

**Why:** Prevent invalid financial data.

**Best Practices:**
- Validate payment amount ≤ invoice balance
- Check for duplicate invoice numbers
- Ensure due date ≥ invoice date
- Validate GST rate (5, 12, 18, 28 only)

### 15. Backup & Disaster Recovery

**Why:** Financial data loss is catastrophic.

**Best Practices:**
- Daily automated backups
- Store backups offsite
- Test restore procedures quarterly
- Maintain transaction logs

---

## Summary

The Financial & Accounting system provides:

✅ **Hierarchical Chart of Accounts** with parent-child relationships
✅ **Cost Center Management** for department/location/project tracking
✅ **Expense Categorization** with COA linking
✅ **Tax Management** with date-based applicability
✅ **Payment Terms** with complex schedule support
✅ **Multi-Currency** with daily exchange rate tracking
✅ **Bank Account Management** with balance tracking
✅ **Invoice Management** with automatic GST calculation
✅ **Payment Recording** with reconciliation
✅ **Quotation Workflow** with order conversion
✅ **Financial Reporting** (summary, overdue, budget reports)
✅ **Complete API** for all financial operations

**Cross-References:**
- [GST_GUIDE.md](GST_GUIDE.md) - Comprehensive GST implementation
- [ORDER_PROCUREMENT_GUIDE.md](ORDER_PROCUREMENT_GUIDE.md) - Order to invoice workflow
- [PROJECT_BIBLE.md](PROJECT_BIBLE.md) - Complete system overview

For questions or issues, refer to [PROJECT_BIBLE.md](PROJECT_BIBLE.md) or contact the development team.
