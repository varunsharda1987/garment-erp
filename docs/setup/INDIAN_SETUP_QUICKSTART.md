# 🚀 Indian Financial Setup - Quick Start Guide

## Step-by-Step Setup for Indian Garment Business

---

## ✅ Step 1: Verify Database is Ready

```bash
cd backend
psql -U postgres -h localhost -d garment_erp -c "\dt" | grep -E "(chart_of_accounts|tax_masters|currencies)"
```

**Expected:** You should see 8 financial master tables.

---

## ✅ Step 2: Create Admin User (if not exists)

Start the backend:
```bash
cd backend
npm run dev
```

Register admin user via API:
```bash
POST http://localhost:5000/api/auth/register
{
  "email": "admin@kashayafabs.com",
  "password": "Admin@123",
  "firstName": "Admin",
  "lastName": "User",
  "role": "ADMIN"
}
```

---

## ✅ Step 3: Run Indian Financial Seed Script

```bash
cd backend
npx ts-node prisma/seed-indian-financial.ts
```

**This will create:**
- ₹ INR as base currency + USD, EUR, GBP
- Indian GST rates (0%, 5%, 12%, 18%, 28%)
- CGST, SGST, IGST configurations
- HSN codes (6109, 5407, 9606)
- Indian payment terms (Advance, Net 30, LC, PDC)
- Indian Chart of Accounts (35+ accounts)
- Expense types linked to accounts

**Expected Output:**
```
🎉 Indian Financial Masters Seeded!
✅ Currency: INR (base) + USD, EUR, GBP
✅ GST Rates: 0%, 5%, 12%, 18%, 28%
✅ Payment Terms: 9 options
✅ Chart of Accounts: 35+ accounts
```

---

## ✅ Step 4: Verify Seed Data

### Test API Endpoints:

```bash
# Login
POST http://localhost:5000/api/auth/login
{
  "email": "admin@kashayafabs.com",
  "password": "Admin@123"
}
# Copy the token
```

```bash
# Check Currencies
GET http://localhost:5000/api/currencies
Authorization: Bearer <your-token>

# Expected: INR, USD, EUR, GBP
```

```bash
# Check GST Rates
GET http://localhost:5000/api/tax-masters
Authorization: Bearer <your-token>

# Expected: GST5, GST12, GST18, IGST5, CGST2.5, SGST2.5, etc.
```

```bash
# Check Chart of Accounts Hierarchy
GET http://localhost:5000/api/chart-of-accounts/hierarchy
Authorization: Bearer <your-token>

# Expected: Tree structure with Assets, Liabilities, Revenue, Expenses
```

```bash
# Check Payment Terms
GET http://localhost:5000/api/payment-terms
Authorization: Bearer <your-token>

# Expected: ADVANCE, NET30, LC, PDC, etc.
```

---

## ✅ Step 5: Configure Your Business Details

### Add Your Bank Accounts:

```bash
POST http://localhost:5000/api/bank-accounts
Authorization: Bearer <your-token>
{
  "accountNumber": "1234567890",
  "bankName": "HDFC Bank",
  "branchName": "Your Branch",
  "ifscCode": "HDFC0001234",
  "accountType": "CURRENT",
  "accountHolderName": "Your Company Name",
  "openingBalance": 100000,
  "currency": "INR",
  "isPrimaryAccount": true
}
```

### Add Cost Centers (if needed):

```bash
POST http://localhost:5000/api/cost-centers
{
  "costCenterCode": "PROD",
  "costCenterName": "Production Department",
  "costCenterType": "DEPARTMENT",
  "budgetAmount": 500000
}
```

---

## ✅ Step 6: Understand Indian GST Application

### For Domestic Sales (Intra-State):

**Example: Selling T-shirts in same state**

```json
{
  "product": "Cotton T-Shirt",
  "hsnCode": "6109",
  "amount": 1000,
  "gstRate": 5,
  "cgst": 25,    // 2.5% of 1000
  "sgst": 25,    // 2.5% of 1000
  "total": 1050
}
```

**Tax to Apply:**
- Tax Master Code: `CGST2.5` + `SGST2.5`

### For Domestic Sales (Inter-State):

**Example: Selling to different state**

```json
{
  "product": "Cotton T-Shirt",
  "hsnCode": "6109",
  "amount": 1000,
  "gstRate": 5,
  "igst": 50,     // 5% of 1000
  "total": 1050
}
```

**Tax to Apply:**
- Tax Master Code: `IGST5`

### For Export Sales:

**Zero-rated (No GST)**

```json
{
  "product": "Cotton T-Shirt",
  "hsnCode": "6109",
  "amount": 1000,
  "currency": "USD",
  "exchangeRate": 83.25,
  "inrValue": 83250,
  "gst": 0,
  "total": 1000
}
```

**Tax to Apply:**
- Tax Master Code: `GST0` (0% - Exempt for exports)

---

## ✅ Step 7: Common HSN Codes Reference

| HSN Code | Product | GST Rate | Tax Master Code |
|----------|---------|----------|-----------------|
| 6109 | Cotton T-shirts, vests | 5% | GST5 / IGST5 |
| 6110 | Jerseys, sweaters | 5% | GST5 / IGST5 |
| 6203 | Men's trousers, suits | 5% | GST5 / IGST5 |
| 6204 | Women's suits, dresses | 5% | GST5 / IGST5 |
| 5407 | Synthetic fabric garments | 12% | GST12 / IGST12 |
| 9606 | Buttons, accessories | 18% | GST18 / IGST18 |
| 9607 | Zippers | 18% | GST18 / IGST18 |

---

## ✅ Step 8: Payment Terms Usage

| Term Code | When to Use | Risk Level |
|-----------|-------------|------------|
| ADVANCE | New customers, first orders | Low |
| ADVANCE50 | Regular customers, medium orders | Low-Medium |
| NET30 | Trusted customers | Medium |
| NET45 | Established customers | Medium |
| NET60/90 | Large retailers, regular buyers | High |
| PDC | Large orders, security needed | Low-Medium |
| LC | Export orders, new export buyers | Low |

---

## ✅ Step 9: Understanding Chart of Accounts

### Quick Reference:

**Assets (1000s):**
- 1110 - Cash/Bank accounts
- 1120 - Customer payments pending
- 1130-1132 - Inventory (Raw, WIP, Finished)
- 1140 - GST you can claim back

**Liabilities (2000s):**
- 2110 - Payments to suppliers
- 2120 - GST you owe government
- 2130 - TDS you deducted (to pay govt)

**Revenue (4000s):**
- 4100 - Domestic sales
- 4200 - Export sales

**Expenses (5000s):**
- 5110 - Material purchases
- 5120 - Manufacturing costs
- 5210 - Salaries
- 5220-5250 - Overhead costs

---

## ✅ Step 10: Next Steps

### Immediate:
1. ✅ Seed data loaded
2. ✅ Test API endpoints
3. ⏳ **Start using in orders**

### Short-term:
4. Configure your suppliers with payment terms
5. Configure your customers with payment terms
6. Link HSN codes to your products
7. Set up cost centers per department

### Medium-term:
8. Generate first invoice with GST
9. Record GST input credit on purchases
10. Prepare for monthly GST filing
11. Set up TDS deduction for vendors

---

## 🎯 Indian Compliance Checklist

### Monthly Tasks:
- [ ] File GSTR-1 (by 11th of next month)
- [ ] File GSTR-3B (by 20th of next month)
- [ ] Pay GST liability
- [ ] Reconcile ITC with GSTR-2A

### Quarterly Tasks:
- [ ] TDS Return (Form 24Q/26Q)
- [ ] PF Return (if applicable)

### Annual Tasks:
- [ ] GSTR-9 (Annual Return)
- [ ] Income Tax Return
- [ ] Audit (if turnover > ₹1 crore)

---

## 📚 References

1. **[INDIAN_COMPLIANCE_GUIDE.md](INDIAN_COMPLIANCE_GUIDE.md)**
   - Complete GST guide
   - Export procedures
   - TDS rules
   - Compliance checklists

2. **[PHASE1_COMPLETE.md](PHASE1_COMPLETE.md)**
   - Technical implementation details
   - API endpoint documentation

3. **GST Portal:** https://www.gst.gov.in
4. **HSN Code Search:** https://cbic-gst.gov.in/gst-goods-services-rates.html

---

## ⚠️ Important Notes

1. **Consult CA/Tax Professional**
   - Verify HSN codes for your products
   - Confirm GST rates (rates may change)
   - Ensure compliance with latest rules

2. **GST Registration Required**
   - Mandatory if turnover > ₹40 lakhs (₹20 lakhs for services)
   - Get GSTIN before starting operations

3. **Export Documentation**
   - LUT (Letter of Undertaking) for GST-free exports
   - Shipping bill for customs clearance
   - BRC (Bank Realization Certificate) for FIRC

4. **Data Backup**
   - Regular backups before GST filing dates
   - Keep records for 6 years (GST requirement)

---

## 🆘 Troubleshooting

### Issue: Seed script fails

```bash
# Solution: Ensure admin user exists
# Create via API or manually in database
```

### Issue: Tax calculation incorrect

```bash
# Check:
# 1. Correct HSN code selected
# 2. Right tax type (GST/IGST/CGST+SGST)
# 3. Tax rate matches product category
```

### Issue: Exchange rate not found

```bash
# Add current rate:
POST /api/currencies/USD/exchange-rates
{
  "effectiveDate": "2024-11-15",
  "rateType": "AVERAGE",
  "exchangeRate": 83.25
}
```

---

**Setup Date:** November 15, 2025
**System:** Kashaya Fabs Garment ERP
**Compliance:** 🇮🇳 Indian GST & Accounting Standards
**Status:** ✅ Ready for Production

**Need help? Refer to INDIAN_COMPLIANCE_GUIDE.md for detailed information!**
