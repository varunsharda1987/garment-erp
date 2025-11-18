# Business Rules - Garment ERP

This document codifies all business logic, validation rules, and calculation formulas used in the Kashaya Fabs ERP system.

---

## 1. COSTING & PRICING RULES

### 1.1 Value Loss (Material Wastage)

**Default Value:** 2%

**Business Rationale:**
Industry-standard wastage allowance covering:
- Fabric cutting losses (selvage, pattern inefficiency)
- Defective material rejection
- Sample production
- End-of-roll wastage
- Shrinkage and damage

**Calculation:**
```
Value Loss Amount = Subtotal Cost × (Value Loss % / 100)
Total After Value Loss = Subtotal Cost + Value Loss Amount
```

**Validation Rules:**
- Minimum: 0% (no wastage scenarios)
- Maximum: 100% (prevents data entry errors)
- Can be overridden per cost sheet
- Must be documented if exceeds 5%

**Applied To:** All cost sheets at final calculation stage

---

### 1.2 Markup Percentage

**Default Value:** 15%

**Business Rationale:**
Standard profit margin covering:
- Business overhead costs
- Marketing and sales expenses
- Administrative costs
- Target profit margin
- Market positioning

**Calculation:**
```
Markup Amount = Total After Value Loss × (Markup % / 100)
Final Product Cost = Total After Value Loss + Markup Amount
```

**Validation Rules:**
- Minimum: 0% (break-even pricing)
- Maximum: 100% (prevents unrealistic pricing)
- Can be adjusted based on:
  - Customer relationship
  - Order volume
  - Market competition
  - Product category

**Applied To:** Final cost sheet calculation

---

### 1.3 Cost Sheet Calculation Flow

**Step-by-Step Calculation:**

1. **Material Costs:**
   ```
   Fabric Total = Sum of (Fabric Width × CAD Average × Rate)
   Trims Total = Sum of (Quantity × Rate)
   Embroidery Total = Sum of (Average × Rate)
   Accessories Total = Sum of (Quantity × Rate)
   ```

2. **CMT Costs:**
   ```
   CMT Total = Cutting + Stitching + Finishing + Button Attachment + Handwork
   ```

3. **Subtotal:**
   ```
   Subtotal = Fabric Total + Trims Total + Embroidery Total + Accessories Total + CMT Total
   ```

4. **Value Loss:**
   ```
   Value Loss Amount = Subtotal × (Value Loss % / 100)
   ```

5. **Markup:**
   ```
   Markup Amount = (Subtotal + Value Loss Amount) × (Markup % / 100)
   ```

6. **Final Cost:**
   ```
   Total Product Cost = Subtotal + Value Loss Amount + Markup Amount
   ```

**Formula Summary:**
```
Total Product Cost = (Subtotal × (1 + Value Loss %/100)) × (1 + Markup %/100)
```

---

## 2. BOM (BILL OF MATERIALS) RULES

### 2.1 Material Requirement Calculation

**Formula:**
```
Base Quantity = Quantity Per Unit × Order Quantity
Wastage Quantity = Base Quantity × (Wastage % / 100)
Total Required = Base Quantity + Wastage Quantity
Total Cost = Total Required × Cost Per Unit
```

**Example:**
```
Order Quantity: 1000 pieces
Fabric per piece: 2.5 meters
Wastage: 5%

Base Quantity = 2.5 × 1000 = 2,500 meters
Wastage Quantity = 2,500 × 0.05 = 125 meters
Total Required = 2,500 + 125 = 2,625 meters
```

### 2.2 BOM Versioning Rules

**Version Control:**
- Each style can have multiple BOM versions
- Version number auto-increments (1, 2, 3, ...)
- Only ONE active BOM per style at any time
- Creating new BOM deactivates previous active BOM

**Validation:**
- Cannot modify approved BOM
- To change approved BOM → Create new version
- Approved BOMs are locked for audit trail

### 2.3 BOM vs Cost Sheet Validation

**Business Rule:** BOM material costs should NOT exceed approved Cost Sheet material budget.

**Implementation:** (Future Enhancement)
```
Validation Check:
IF BOM Total > Cost Sheet Material Budget THEN
  WARN: "BOM exceeds approved budget"
  REQUIRE: Management approval override
END IF
```

---

## 3. ORDER MANAGEMENT RULES

### 3.1 Order Numbering

**Format:** `ORD{YEAR}{MONTH}{SEQUENCE}`

**Example:** ORD202511001 (November 2025, sequence 001)

**Rules:**
- Sequence resets monthly
- 4-digit sequence (0001-9999)
- Auto-generated, cannot be edited
- Unique per order

### 3.2 Color × Size Matrix

**Validation Rules:**
- At least one non-zero quantity required
- Total order quantity = sum of all matrix cells
- Matrix dimensions based on style's available colors and sizes
- Each cell must be ≥ 0

**Calculation:**
```
Item Total Quantity = Sum of all Color × Size quantities
Item Total Price = Item Total Quantity × Unit Price
Order Total Quantity = Sum of all items
Order Total Amount = Sum of all item totals
```

### 3.3 Order Status Flow

**Status Progression:**
```
PENDING → CONFIRMED → IN_PRODUCTION → COMPLETED → SHIPPED → CANCELLED
```

**Business Rules:**
- PENDING: Initial state, can be edited
- CONFIRMED: Customer confirmed, locks pricing
- IN_PRODUCTION: Work order created, cannot modify order details
- COMPLETED: Production finished, ready for shipment
- SHIPPED: Dispatched to customer
- CANCELLED: Can cancel only if status = PENDING or CONFIRMED

**Validation:**
- Cannot go backwards in status (except to CANCELLED)
- CANCELLED is terminal state

---

## 4. STYLE MANAGEMENT RULES

### 4.1 Style as Template

**Concept:** Style = Reusable design specification

**Business Rules:**
- One style can be referenced by multiple orders
- Style contains NO customer-specific information
- Style contains NO quantity information
- Style is NOT an inventory item

**Benefits:**
- 80% reduction in data entry for repeat orders
- Consistency across orders
- Easy style evolution (versioning)

### 4.2 Style Code Format

**Recommended Format:** `{CATEGORY_CODE}-{YEAR}-{SEQUENCE}`

**Example:** `TS-2025-001` (T-Shirt, Year 2025, Sequence 001)

**Validation:**
- Must be unique across all styles
- Alphanumeric + hyphens allowed
- Maximum 50 characters
- Case-insensitive uniqueness

---

## 5. SUPPLIER MANAGEMENT RULES

### 5.1 Supplier Categorization

**7 Distinct Categories:**
1. Fabric Supplier
2. Trim Supplier
3. Thread Supplier
4. Interlining Supplier
5. Label Supplier
6. Packaging Supplier
7. Accessories Supplier

**Business Rules:**
- One supplier can belong to only ONE category
- Category determines:
  - Relevant specifications fields
  - Purchase order templates
  - Quality parameters
  - Payment terms preferences

### 5.2 Supplier Performance Tracking

**Key Metrics:**
- On-time delivery rate (%)
- Quality rejection rate (%)
- Price competitiveness
- Response time

**Business Rules:** (Future Enhancement)
- Automatic rating calculation
- Preferred supplier designation
- Blacklist capability

---

## 6. INVENTORY RULES

### 6.1 Stock Transaction Types

**Four Transaction Types:**
1. **STOCK_IN:** Material received (from Purchase Order/GRN)
2. **STOCK_OUT:** Material issued (to production)
3. **ADJUSTMENT:** Corrections (damage, found items)
4. **TRANSFER:** Move between locations

**Validation:**
- STOCK_OUT cannot exceed available stock
- All transactions require approval (user ID tracked)
- Negative stock not allowed

### 6.2 Reorder Level Logic

**Calculation:**
```
Reorder Level = (Average Daily Usage × Lead Time Days) + Safety Stock
```

**Example:**
```
Average daily usage: 50 meters
Lead time: 7 days
Safety stock: 20% buffer

Reorder Level = (50 × 7) + (50 × 7 × 0.20)
              = 350 + 70
              = 420 meters
```

**Alert Trigger:**
```
IF Current Stock < Reorder Level THEN
  GENERATE: Low Stock Alert
  RECOMMEND: Create Purchase Order
END IF
```

---

## 7. PRODUCTION RULES

### 7.1 Work Order Generation

**Business Rules:**
- Work Order created FROM confirmed order
- One work order can cover multiple order items
- Work order cannot exceed order quantity
- Partial work orders allowed (split shipments)

### 7.2 Production Stage Tracking

**12 Standard Stages:**
1. Fabric Inspection
2. Fabric Spreading
3. Cutting
4. Print/Embroidery
5. Stitching
6. Checking
7. Washing (if applicable)
8. Finishing
9. Thread Trimming
10. Ironing
11. Final Inspection
12. Packing

**Stage Rules:**
- Stages can run in parallel (cutting + embroidery)
- Some stages depend on previous (ironing after stitching)
- Stage completion % tracked
- Bottleneck identification when stage time > planned time

---

## 8. QUALITY CONTROL RULES

### 8.1 AQL Sampling

**Acceptable Quality Levels:**
- **AQL 1.5:** Export quality, strict standards
- **AQL 2.5:** Standard commercial quality
- **AQL 4.0:** Domestic/budget quality

**Sampling Plan:**
```
Order Size | Sample Size | Accept | Reject
-----------|-------------|--------|-------
1-50       | 5           | 0      | 1
51-150     | 13          | 1      | 2
151-500    | 32          | 2      | 3
501-1200   | 50          | 3      | 4
```

**Business Rule:**
```
IF Defects Found ≤ Accept Number THEN
  PASS: Entire lot accepted
ELSE IF Defects Found ≥ Reject Number THEN
  FAIL: Entire lot rejected
ELSE
  INSPECT: Check more samples
END IF
```

### 8.2 Defect Classification

**Critical Defects:** (0 tolerance)
- Safety hazards (sharp objects, choking hazards)
- Wrong size labeling
- Color mismatch with specification

**Major Defects:**
- Broken stitching
- Fabric defects affecting appearance
- Incorrect placement of trims

**Minor Defects:**
- Loose threads
- Minor stitch variations
- Small marks (removable)

**Action Rules:**
- Critical → 100% rejection
- Major → Rework if economical, else reject
- Minor → Accept if within AQL limit

---

## 9. APPROVAL WORKFLOWS

### 9.1 Cost Sheet Approval

**Workflow:**
```
Created (Draft) → Pending Approval → Approved/Rejected
```

**Business Rules:**
- Only users with "Manager" or "Admin" role can approve
- Approved cost sheet is LOCKED (cannot edit)
- To change → Create new cost sheet
- Rejection requires comment

### 9.2 BOM Approval

**Workflow:** Same as Cost Sheet

**Additional Rule:**
- BOM can only be created if style has approved cost sheet (future validation)

### 9.3 Purchase Order Approval

**Multi-Level Approval:**
```
PO Amount | Approver
----------|----------
< ₹50,000 | Manager
₹50,000 - ₹2,00,000 | Senior Manager
> ₹2,00,000 | Director
```

**Business Rule:**
```
IF PO Amount > Approval Limit THEN
  ROUTE TO: Next level approver
  STATUS: Pending Higher Approval
END IF
```

---

## 10. FINANCIAL RULES

### 10.1 Payment Terms

**Standard Terms:**
- **NET 30:** Payment due 30 days after invoice
- **NET 45:** 45 days credit
- **2/10 NET 30:** 2% discount if paid within 10 days, else full amount due in 30 days
- **Advance:** 30-50% advance, balance before shipment
- **LC:** Letter of Credit (international orders)

### 10.2 Currency & Taxation

**Currency:** INR (Indian Rupees) - primary
**GST:** Goods and Services Tax applied as per Indian tax law
```
Taxable Amount = Final Product Cost
GST Amount = Taxable Amount × (GST %/ 100)
Invoice Total = Taxable Amount + GST Amount
```

**Current GST Rates:** (Verify with tax regulations)
- Fabric: 5%
- Readymade Garments: 5% or 12% (based on value)

---

## 11. USER ROLES & PERMISSIONS

### 11.1 Role Hierarchy

**Admin:**
- Full system access
- User management
- All approvals
- System configuration

**Manager:**
- Module management within department
- Cost sheet & BOM approvals
- Purchase order approvals (< ₹2,00,000)
- Reports and analytics

**Merchandiser:**
- Style creation and management
- Order creation
- Cost sheet creation (pending approval)
- BOM creation (pending approval)

**Production:**
- Work order management
- Production stage updates
- Material requisition
- Quality inspection data entry

**Inventory:**
- Stock transactions
- Stock reports
- Purchase order creation
- GRN entry

**Accounts:**
- Invoice generation
- Payment tracking
- Financial reports

### 11.2 Data Access Rules

**Own Data:** Users can edit their own created records (if not approved)
**Team Data:** Managers can view/edit team data
**Approved Data:** Only admins can delete approved records
**Audit Trail:** All changes logged with user ID and timestamp

---

## 12. DATA VALIDATION RULES

### 12.1 Required Fields

**Customer:**
- Company name
- Code (unique)
- Contact person
- Phone or email (at least one)

**Order:**
- Customer ID
- Order date
- At least one order item
- Total quantity > 0

**Material:**
- Code (unique)
- Name
- Category
- Unit of measurement

### 12.2 Format Validations

**Email:** Valid email format (name@domain.com)
**Phone:** 10 digits (India) or international format
**GST Number:** 15 characters alphanumeric (India)
**Dates:** Valid date, cannot be in far past (> 10 years ago)
**Quantities:** Must be positive numbers
**Prices:** Non-negative, max 2 decimal places

---

## 13. SYSTEM BEHAVIOR RULES

### 13.1 Soft Delete

**Philosophy:** Never permanently delete data

**Implementation:**
- Use `isActive` flag (TRUE/FALSE)
- Deleted records: `isActive = FALSE`
- Queries filter: `WHERE isActive = TRUE`
- Admins can view deleted records

**Benefits:**
- Audit trail preservation
- Data recovery capability
- Regulatory compliance

### 13.2 Timestamps

**Auto-Generated Fields:**
- `createdAt`: Record creation timestamp
- `updatedAt`: Last modification timestamp
- `createdById`: User who created record
- `approvedAt`: Approval timestamp (if applicable)

**Business Rule:** These fields are READ-ONLY for users, auto-managed by system

---

## 14. INTEGRATION RULES

### 14.1 Style-Order Relationship

**Data Flow:**
```
Style (template) → Order (customer-specific)
```

**Rules:**
- Order MUST reference a valid style
- Deleting style does NOT delete orders (soft delete both)
- Style updates do NOT affect existing orders
- Order can clone style data at creation time

### 14.2 Cost Sheet → BOM Workflow

**Sequential Dependency:**
```
1. Create Cost Sheet
2. Approve Cost Sheet (locks budget)
3. Create BOM (material breakdown)
4. Validate: BOM cost ≤ Cost Sheet budget
5. Approve BOM (locks material plan)
6. Create Work Order (production)
```

**Business Rule:** Cannot skip steps. Each step must be approved before next step.

---

## 15. REPORTING RULES

### 15.1 Date Range Filters

**Standard Periods:**
- Today
- Yesterday
- This Week
- Last Week
- This Month
- Last Month
- This Quarter
- This Year
- Custom (user-defined start & end)

### 15.2 Export Formats

**Supported:**
- Excel (.xlsx)
- PDF
- CSV

**Export Limits:**
- Maximum 10,000 records per export
- Large datasets: paginated exports

---

## CHANGE LOG

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-14 | 1.0 | Initial documentation | Claude Code |

---

**Last Updated:** November 14, 2025
**Document Owner:** Kashaya Fabs Development Team
**Review Frequency:** Quarterly or on major feature changes
