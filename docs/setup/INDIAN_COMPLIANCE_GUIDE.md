# 🇮🇳 Indian Financial Compliance Guide - Garment ERP

## Overview

This ERP system is configured for **Indian garment manufacturing businesses** with full compliance to:
- **GST (Goods and Services Tax)**
- **Indian Accounting Standards**
- **Export documentation requirements**
- **Textile industry HSN codes**

---

## 1. Indian GST Implementation

### GST Structure in India

**For Intra-State Transactions (within same state):**
- CGST (Central GST) + SGST (State GST)
- Combined rate = Total GST rate

**For Inter-State Transactions (between states):**
- IGST (Integrated GST)
- Rate = Total GST rate

### GST Rates for Garment Industry

#### Implemented in System:

| GST Rate | HSN Code | Description | CGST | SGST | IGST |
|----------|----------|-------------|------|------|------|
| 5% | 6109 | Cotton T-shirts, vests | 2.5% | 2.5% | 5% |
| 12% | 5407 | Synthetic fabric garments | 6% | 6% | 12% |
| 18% | 9606 | Buttons, accessories, trims | 9% | 9% | 18% |
| 28% | - | Luxury items (rarely used) | 14% | 14% | 28% |

### HSN Codes for Garment Industry

**Common HSN Codes (Configured in System):**

- **6109** - T-shirts, singlets and other vests, knitted or crocheted
- **6110** - Jerseys, pullovers, cardigans
- **6203** - Men's suits, ensembles, jackets, trousers
- **6204** - Women's suits, ensembles, jackets, dresses
- **6211** - Track suits, ski suits, swimwear
- **5407** - Woven fabrics of synthetic filament yarn
- **5408** - Woven fabrics of artificial filament yarn
- **5515** - Other woven fabrics of synthetic staple fibres
- **9606** - Buttons, press-fasteners, snap-fasteners
- **9607** - Slide fasteners (zippers)

### GST Input Tax Credit (ITC)

**Configured Accounts:**
- **Account Code: 1140** - GST Input Credit (Current Asset)
- **Account Code: 2120** - GST Payable (Current Liability)

**Business Logic:**
1. GST on purchases → Input Tax Credit (Asset)
2. GST on sales → GST Payable (Liability)
3. Net GST = GST Payable - Input Credit

---

## 2. Indian Payment Terms

### Standard Terms Configured:

1. **100% Advance**
   - Code: `ADVANCE`
   - Use: New customers, first orders
   - Risk: Minimal for supplier

2. **50% Advance, 50% on Delivery**
   - Code: `ADVANCE50`
   - Use: Medium-size orders, regular customers
   - Risk: Low

3. **Net 15/30/45/60/90 Days**
   - Codes: `NET15`, `NET30`, `NET45`, `NET60`, `NET90`
   - Use: Established customers
   - Risk: Credit period dependent

4. **Post-Dated Cheque (PDC)**
   - Code: `PDC`
   - Use: Large orders, trusted customers
   - Security: Cheque held till due date

5. **Letter of Credit (LC)**
   - Code: `LC`
   - Use: Export orders
   - Security: Bank guarantee

### Export Payment Terms:

**For Export Orders (Additional):**
- **Sight LC** - Payment on presentation of documents
- **Usance LC** - Payment after agreed period (30/60/90 days)
- **DA (Documents Against Acceptance)** - Documents released on acceptance
- **DP (Documents Against Payment)** - Documents released on payment
- **CAD (Cash Against Documents)** - Payment before document handover

---

## 3. Indian Chart of Accounts

### Structure (As per Indian Accounting Standards)

```
1000 - Assets
  1100 - Current Assets
    1110 - Cash and Bank
    1120 - Accounts Receivable (Sundry Debtors)
    1130 - Inventory - Raw Materials
    1131 - Inventory - Work in Progress
    1132 - Inventory - Finished Goods
    1140 - GST Input Credit ⭐
  1200 - Fixed Assets
    1210 - Plant and Machinery
    1220 - Furniture and Fixtures
    1230 - Buildings

2000 - Liabilities
  2100 - Current Liabilities
    2110 - Accounts Payable (Sundry Creditors)
    2120 - GST Payable ⭐
    2130 - TDS Payable ⭐
    2140 - Short Term Loans
  2200 - Long Term Liabilities
    2210 - Term Loans

3000 - Equity
  (Owner's capital, retained earnings)

4000 - Revenue
  4100 - Sales - Domestic
  4200 - Sales - Export ⭐
  4300 - Other Income

5000 - Expenses
  5100 - Direct Expenses
    5110 - Raw Material Purchase
    5120 - Manufacturing Expenses
  5200 - Indirect Expenses
    5210 - Salaries and Wages
    5220 - Rent
    5230 - Electricity
    5240 - Office Expenses
    5250 - Transportation
```

⭐ = India-specific accounts

---

## 4. TDS (Tax Deducted at Source)

### TDS Applicable in Garment Business:

**Section 194C** - Payment to contractors
- Rate: 1% (Individual/HUF) or 2% (Company)
- Applicable: CMT vendors, job workers

**Section 194H** - Commission or brokerage
- Rate: 5%
- Applicable: Commission agents, brokers

**Section 194J** - Professional fees
- Rate: 10%
- Applicable: Designers, consultants

**Account Code: 2130** - TDS Payable (configured)

---

## 5. Export Documentation Requirements

### Documents for Export Orders:

1. **Commercial Invoice**
   - Buyer/seller details
   - Product description
   - HSN codes
   - Unit prices
   - Total value in USD/EUR

2. **Packing List**
   - Carton-wise details
   - Net weight, gross weight
   - Dimensions

3. **Shipping Bill**
   - Required for customs clearance
   - Contains GST exemption details

4. **Bill of Lading / Airway Bill**
   - Proof of shipment
   - Original for LC payments

5. **Certificate of Origin**
   - Required for preferential duty
   - Format: Non-preferential or GSP

6. **Inspection Certificate**
   - Quality inspection report
   - May be required by buyer

7. **GST LUT (Letter of Undertaking)**
   - Export without paying GST
   - Annual declaration

---

## 6. Compliance Checklists

### Monthly Compliance:

- [ ] **GSTR-1** - Outward supplies (by 11th)
- [ ] **GSTR-3B** - Summary return (by 20th)
- [ ] **TDS Return** - Form 24Q/26Q (quarterly)
- [ ] **PF Return** - If employees > 20
- [ ] **ESI Return** - If employees > 10

### Annual Compliance:

- [ ] **Income Tax Return** - For company
- [ ] **GST Annual Return** - GSTR-9
- [ ] **Audit** - If turnover > ₹1 crore
- [ ] **ROC Filings** - Annual returns

---

## 7. Garment Industry Specific Rules

### Inverted Duty Structure:

Garment industry often faces **inverted duty structure**:
- Input materials may have higher GST than finished goods
- Example: Polyester fabric (12% GST) → Finished garment (5% GST)
- Can claim **ITC refund** for accumulation

### Export Benefits:

1. **Duty Drawback**
   - Refund of customs duty on imported inputs
   - Calculated as % of FOB value

2. **MEIS (Merchandise Exports from India Scheme)**
   - Replaced by RoDTEP
   - Duty credit scrips

3. **GST Refund on Exports**
   - Exports are zero-rated
   - Can claim full ITC refund

4. **EPCG (Export Promotion Capital Goods)**
   - Import machinery at concessional duty
   - Export obligation required

---

## 8. Seed Data Included

### Pre-configured Indian Masters:

**Currencies:**
- ✅ INR (Indian Rupee) - Base currency
- ✅ USD, EUR, GBP - Export currencies
- ✅ Exchange rates (sample for Nov 2024)

**GST Rates:**
- ✅ GST: 0%, 5%, 12%, 18%, 28%
- ✅ IGST: 5%, 12%, 18%, 28%
- ✅ CGST: 2.5%, 6%, 9%, 14%
- ✅ SGST: 2.5%, 6%, 9%, 14%
- ✅ HSN codes: 6109, 5407, 9606

**Payment Terms:**
- ✅ Advance, 50% Advance
- ✅ Net 15/30/45/60/90
- ✅ PDC, LC

**Chart of Accounts:**
- ✅ 35+ accounts
- ✅ GST Input Credit account
- ✅ GST Payable account
- ✅ TDS Payable account
- ✅ Domestic vs Export sales separation

**Expense Types:**
- ✅ 7 categories linked to CoA

---

## 9. How to Run Seed Script

### Prerequisites:
1. Database migrated
2. Admin user created
3. Backend running

### Command:
```bash
cd backend
npx ts-node prisma/seed-indian-financial.ts
```

### Expected Output:
```
🇮🇳 Seeding Indian Financial Masters...

💱 Creating Indian Rupee as base currency...
✅ Currencies created: INR (base), USD, EUR, GBP

📊 Creating Indian GST tax rates...
✅ GST rates created: 0%, 5%, 12%, 18%, 28% (GST, IGST, CGST, SGST)

📝 Creating Indian payment terms...
✅ Payment terms created: Advance, Net 15/30/45/60/90, PDC, LC

📚 Creating Indian Chart of Accounts...
✅ Chart of Accounts created: 5 root + 30+ sub-accounts

💸 Creating Indian expense types...
✅ Expense types created: 7 categories

═══════════════════════════════════════
🎉 Indian Financial Masters Seeded!
═══════════════════════════════════════
```

---

## 10. India-Specific Features to Add (Future)

### Phase 2 Enhancements:

1. **E-Way Bill Integration**
   - Auto-generate e-way bill for interstate shipments > ₹50,000
   - Track expiry and extension

2. **GST Portal Integration**
   - Auto-upload GSTR-1
   - Download GSTR-2A for reconciliation

3. **TDS Calculation**
   - Auto-calculate TDS on payments
   - Generate Form 16A

4. **Bank Reconciliation**
   - Import bank statements
   - Auto-reconciliation

5. **Statutory Reports**
   - GSTR-1, GSTR-3B formats
   - TDS returns
   - Form 26AS reconciliation

---

## 11. Important Notes

### GST Rate Changes:
- Monitor GST Council notifications
- Update tax_masters when rates change
- Use `applicableFrom` and `applicableTo` dates

### HSN Code Accuracy:
- Verify HSN codes with CA/Tax consultant
- Incorrect codes can lead to notices
- Keep updated as per latest HSN directory

### Export Documentation:
- Maintain originals for 7 years (as per law)
- Digital copies for quick access
- Bank realization certificates (BRC) for FIRC

### ITC Claims:
- Only claim ITC on valid tax invoices
- Match with GSTR-2A
- Reverse ITC on non-business use

---

## 12. Support & Compliance

### Recommended Actions:

1. **Consult CA/Tax Consultant**
   - Verify GST implementation
   - Annual audit requirements
   - Optimal tax structure

2. **Regular Updates**
   - Monitor GST rate changes
   - Update HSN codes
   - Track compliance deadlines

3. **Employee Training**
   - GST invoice requirements
   - Export documentation
   - Compliance procedures

4. **Software Updates**
   - Keep system updated
   - Backup data regularly
   - Test before GST filing dates

---

**Document Version:** 1.0
**Last Updated:** November 15, 2025
**Applicable For:** Indian Garment Manufacturing & Export Businesses
**Compliance Status:** ✅ GST Compliant | ✅ Accounting Standards Compliant
