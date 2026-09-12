---
slug: chart-of-accounts
title: Manage Chart of Accounts
keywords:
  # English
  - chart of accounts
  - COA
  - ledger
  - accounts
  - accounting
  - account code
  - account hierarchy
  - financial accounts
  # Hinglish
  - chart of accounts
  - ledger banana
  - account banana
  - khata
  # Devanagari
  - चार्ट ऑफ अकाउंट्स
  - खाता
  - लेजर
  - खाता बही
  - लेखा
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/ChartOfAccountsList.tsx
  - frontend/src/types/financial.types.ts
route: /chart-of-accounts
---

## Steps to View Chart of Accounts

1. Go to **Reports & Finance** in the sidebar
2. Click **Chart of Accounts**
3. The page shows a hierarchical tree of all accounts
4. Click **arrows** (triangle icons) to expand/collapse account groups
5. Level 1 accounts are auto-expanded on page load

## Steps to Create a New Account

1. On the Chart of Accounts page, click **+ New Account** button (top-right)
2. Fill in required fields:
   - **Account Code** - unique identifier (e.g., "1000", "2100") - cannot be changed later
   - **Account Name** - descriptive name (e.g., "Cash in Hand")
   - **Account Type** - select one: ASSET, LIABILITY, EQUITY, REVENUE, or EXPENSE
   - **Account Group** - select the classification group
3. Optional fields:
   - **Parent Account** - select to nest under an existing account, or "None (top-level)"
   - **Description** - additional notes
4. Click **Create** to save

## Steps to Edit an Account

1. Find the account in the hierarchy tree
2. Click the **Edit** button on the account row
3. Modify allowed fields:
   - Account Name
   - Account Type
   - Account Group
   - Parent Account
   - Description
4. Click **Update** to save changes

Note: Account Code cannot be changed after creation.

## Account Types

| Type | Description | Color |
|------|-------------|-------|
| **ASSET** | Resources owned (cash, inventory, equipment) | Green |
| **LIABILITY** | Amounts owed (loans, payables) | Red |
| **EQUITY** | Owner's stake in the business | Accent |
| **REVENUE** | Income from sales and services | Blue |
| **EXPENSE** | Costs of running the business | Primary |

## Account Groups

Each account type has sub-groups for finer classification:

- **CURRENT_ASSET** - Short-term assets (cash, receivables)
- **FIXED_ASSET** - Long-term assets (machinery, property)
- **CURRENT_LIABILITY** - Short-term debts (payables due within a year)
- **LONG_TERM_LIABILITY** - Long-term debts (loans, mortgages)
- **EQUITY** - Owner's capital and retained earnings
- **DIRECT_REVENUE** - Primary business income
- **INDIRECT_REVENUE** - Secondary income (interest, discounts received)
- **DIRECT_EXPENSE** - Costs directly tied to production
- **INDIRECT_EXPENSE** - Administrative and overhead costs
- **OVERHEAD** - General operating expenses

## Import and Export

- Click **Export** button to download current chart as Excel/CSV
- Click **Import** button to bulk upload accounts from a file
- Import preserves hierarchy via parent account codes

## Summary Cards

The page shows a count card for each account type at the bottom:
- Total ASSET accounts
- Total LIABILITY accounts
- Total EQUITY accounts
- Total REVENUE accounts
- Total EXPENSE accounts

## Traps

- **Account Code is permanent** - Choose codes carefully; they cannot be changed after creation
- **System accounts cannot be edited** - Accounts marked with "System" badge are protected
- **Inactive accounts** - Marked with "Inactive" badge; cannot be used in transactions
- **Parent account selection** - An account cannot be its own parent
- **Unique codes required** - Each account code must be unique across the entire chart
