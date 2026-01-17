# Indian GST Compliance Guide

> **Complete GST Implementation for Kashaya Fabs ERP**
> **Last Updated:** January 12, 2026
> **Coverage:** 36 States/UTs, 133 Cities, Full Tax Calculation

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Overview](#2-overview)
3. [Database Schema](#3-database-schema)
4. [Backend Services](#4-backend-services)
5. [API Reference](#5-api-reference)
6. [Frontend Components](#6-frontend-components)
7. [Configuration](#7-configuration)
8. [Testing Guide](#8-testing-guide)
9. [GST Reference Data](#9-gst-reference-data)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Quick Start

### Setup Company State

Edit `backend/.env`:
```bash
COMPANY_STATE_ID="<your-state-uuid>"
```

Find your state ID:
```sql
SELECT id FROM indian_states WHERE stateCode = '27'; -- Maharashtra
SELECT id FROM indian_states WHERE stateCode = '24'; -- Gujarat
```

### Run Seed Data

```bash
cd backend
npx prisma db seed
```

This creates:
- 36 states/UTs with GST codes
- 133 major cities with tier classification

### Test GST Validation

```bash
# Valid GST number
curl -X POST http://localhost:5000/api/gst/validate \
  -H "Content-Type: application/json" \
  -d '{"gstNumber":"27AAAAA0000A1Z5","stateCode":"27"}'
```

---

## 2. Overview

### What This System Provides

1. **State & City Management** - Complete Indian geographic database
2. **GST Number Validation** - Format and state code verification
3. **Tax Calculation** - Automatic CGST/SGST vs IGST determination
4. **Multi-GST Support** - Customers with registrations in multiple states

### Tax Calculation Logic

| Transaction Type | Tax Applied |
|-----------------|-------------|
| Intrastate (same state) | CGST (6%) + SGST (6%) = 12% |
| Interstate (different states) | IGST (12%) |

### Default Tax Rate

**12%** for garments (HSN codes 61, 62, 63)

---

## 3. Database Schema

### Tables

**indian_states:**
```sql
id          UUID PRIMARY KEY
stateName   VARCHAR(100)
stateCode   VARCHAR(2)      -- GST 2-digit code
stateType   ENUM('STATE', 'UNION_TERRITORY')
sortOrder   INTEGER
isActive    BOOLEAN
```

**indian_cities:**
```sql
id          UUID PRIMARY KEY
stateId     UUID REFERENCES indian_states
cityName    VARCHAR(100)
tier        ENUM('TIER_1', 'TIER_2', 'TIER_3')
isGarmentHub BOOLEAN
```

### Relations

```
customers → indian_states (billingStateId, shippingStateId)
customers → indian_cities (billingCityId, shippingCityId)
customer_gst_numbers → indian_states (stateId)
invoices → indian_states (placeOfSupplyId)
quotations → indian_states (placeOfSupplyId)
```

---

## 4. Backend Services

### GST Service

**Location:** `backend/src/services/gst.service.ts`

#### validateGSTNumber
```typescript
validateGSTNumber(gstNumber: string, stateCode: string): boolean
```
- Validates 15-character format
- Verifies state code matches first 2 digits
- Auto-normalizes to uppercase

#### calculateGST
```typescript
calculateGST(
  amount: number,
  taxRate: number,
  fromStateId: string,
  toStateId: string
): Promise<GSTCalculation>
```
- Determines intrastate vs interstate
- Returns tax breakdown

#### calculateBulkGST
```typescript
calculateBulkGST(
  items: BulkItem[],
  fromStateId: string
): Promise<BulkGSTTotals>
```
- Bulk calculation for multiple line items

### Location Service

**Location:** `backend/src/services/location.service.ts`

```typescript
getAllStates(options?: StateFilterOptions): Promise<StateWithCityCount[]>
getStateByCode(stateCode: string): Promise<indian_states | null>
getCitiesByState(stateId: string, options?: CityFilterOptions): Promise<CityWithState[]>
searchCities(searchTerm: string, stateId?: string): Promise<CityWithState[]>
getGarmentHubs(): Promise<CityWithState[]>
```

---

## 5. API Reference

### Location Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/locations/states` | Get all states |
| GET | `/api/locations/states/code/:stateCode` | Get state by code |
| GET | `/api/locations/cities` | Get cities (filter by state) |
| GET | `/api/locations/cities/hubs` | Get garment hubs |
| GET | `/api/locations/validate/state/:id` | Validate state ID |

### GST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/gst/validate` | Validate GST number |
| POST | `/api/gst/calculate` | Calculate GST breakdown |
| POST | `/api/gst/calculate-bulk` | Bulk calculation |
| GET | `/api/gst/rates` | Get common rates |
| GET | `/api/gst/hsn-codes` | Get garment HSN codes |

### Example Requests

**Validate GST Number:**
```bash
curl -X POST http://localhost:5000/api/gst/validate \
  -H "Content-Type: application/json" \
  -d '{
    "gstNumber": "27AAAAA0000A1Z5",
    "stateCode": "27"
  }'
```

**Calculate GST:**
```bash
curl -X POST http://localhost:5000/api/gst/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10000,
    "taxRate": 12,
    "fromStateId": "<MAHARASHTRA_ID>",
    "toStateId": "<GUJARAT_ID>"
  }'
```

**Response:**
```json
{
  "cgst": 0,
  "sgst": 0,
  "igst": 1200,
  "cgstRate": 0,
  "sgstRate": 0,
  "igstRate": 12,
  "totalTax": 1200,
  "isInterstate": true
}
```

---

## 6. Frontend Components

### StateSelector

```tsx
import StateSelector from '@/components/StateSelector';

<StateSelector
  value={stateId}
  onChange={setStateId}
  label="State"
  required
  showStateCode
  stateType="ALL" // STATE | UNION_TERRITORY | ALL
/>
```

### CitySelector

```tsx
import CitySelector from '@/components/CitySelector';

<CitySelector
  value={cityId}
  stateId={selectedStateId}
  onChange={setCityId}
  label="City"
  showTier
  allowSearch
/>
```

### GSTNumberInput

```tsx
import GSTNumberInput from '@/components/GSTNumberInput';

<GSTNumberInput
  value={gstData}
  onChange={setGstData}
  onRemove={handleRemove}
  showRemove={gstNumbers.length > 1}
  autoValidate
/>
```

### TaxBreakdown

```tsx
import TaxBreakdown from '@/components/TaxBreakdown';

<TaxBreakdown
  subtotal={10000}
  cgst={600}
  sgst={600}
  igst={0}
  cgstRate={6}
  sgstRate={6}
  igstRate={0}
  isInterstate={false}
  total={11200}
  showRates
/>
```

---

## 7. Configuration

### Environment Variables

```bash
# Required: Your company's state ID
COMPANY_STATE_ID="<uuid-of-your-state>"
```

### Backfill Existing Data

If you have existing customers without stateId:

```bash
cd backend
npx ts-node scripts/backfill-gst-states.ts
```

---

## 8. Testing Guide

### Test State API

```bash
# Get all states
curl http://localhost:5000/api/locations/states

# Get Maharashtra
curl http://localhost:5000/api/locations/states/code/27

# Get cities in Maharashtra
curl "http://localhost:5000/api/locations/cities?stateId=<ID>"

# Search cities
curl "http://localhost:5000/api/locations/cities?search=Mumbai"
```

### Test Customer with GST

```json
POST /api/customers
{
  "code": "CUST-B2B-001",
  "name": "Test Company",
  "billingStateId": "<MAHARASHTRA_ID>",
  "gstNumbers": [
    {
      "stateId": "<MAHARASHTRA_ID>",
      "stateName": "Maharashtra",
      "stateCode": "27",
      "gstNumber": "27AAAAA0000A1Z5",
      "isPrimary": true
    }
  ]
}
```

### Test Invoice GST

```json
POST /api/invoices
{
  "orderId": "<ORDER_ID>",
  "customerId": "<CUSTOMER_ID>",
  "subtotal": 10000,
  "taxRate": 12,
  "placeOfSupplyId": "<CUSTOMER_STATE_ID>"
}
```

**Response includes:**
```json
{
  "cgstAmount": 600,
  "sgstAmount": 600,
  "igstAmount": 0,
  "isInterstate": false,
  "totalAmount": 11200
}
```

---

## 9. GST Reference Data

### State Codes

| Code | State/UT | Code | State/UT |
|------|----------|------|----------|
| 01 | Jammu & Kashmir | 19 | West Bengal |
| 02 | Himachal Pradesh | 20 | Jharkhand |
| 03 | Punjab | 21 | Odisha |
| 04 | Chandigarh | 22 | Chhattisgarh |
| 05 | Uttarakhand | 23 | Madhya Pradesh |
| 06 | Haryana | 24 | Gujarat |
| 07 | Delhi | 26 | Dadra & Nagar Haveli |
| 08 | Rajasthan | 27 | Maharashtra |
| 09 | Uttar Pradesh | 29 | Karnataka |
| 10 | Bihar | 30 | Goa |
| 11 | Sikkim | 31 | Lakshadweep |
| 12 | Arunachal Pradesh | 32 | Kerala |
| 13 | Nagaland | 33 | Tamil Nadu |
| 14 | Manipur | 34 | Puducherry |
| 15 | Mizoram | 35 | Andaman & Nicobar |
| 16 | Tripura | 36 | Telangana |
| 17 | Meghalaya | 37 | Andhra Pradesh |
| 18 | Assam | 38 | Ladakh |

### GST Rates for Garments

| HSN Code | Category | GST Rate |
|----------|----------|----------|
| 61 | Knitted Garments | 12% |
| 62 | Woven Garments | 12% |
| 63 | Home Textiles | 12% |
| 56 | Technical Textiles | 12% |
| 42 | Bags & Leather | 18% |

### GST Number Format

- **Length:** Exactly 15 characters
- **Pattern:** `\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}`
- **Example:** `27AAAPL1234C1Z5`
  - `27` = State code (Maharashtra)
  - `AAAPL` = PAN first 5 characters
  - `1234` = PAN last 4 digits
  - `C` = Entity code
  - `1` = Registration number
  - `Z` = Default 'Z'
  - `5` = Check digit

### Garment Hubs

Cities with `isGarmentHub: true`:
- Tirupur (Tamil Nadu)
- Surat (Gujarat)
- Ludhiana (Punjab)
- Kolkata (West Bengal)
- Mumbai (Maharashtra)
- Delhi NCR
- Bangalore (Karnataka)

---

## 10. Troubleshooting

### GST Validation Fails

**Issue:** GST number rejected

**Solutions:**
1. Verify state code matches first 2 digits
2. Ensure exactly 15 characters
3. Check for lowercase (auto-converts to uppercase)
4. Verify format: `\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}`

### Tax Calculation Shows Zero

**Issue:** No tax calculated

**Solutions:**
1. Verify `COMPANY_STATE_ID` is set in `.env`
2. Check state IDs are valid UUIDs
3. Ensure customer has `billingStateId` set
4. Verify `placeOfSupplyId` is provided

### Cities Not Loading

**Issue:** City dropdown empty

**Solutions:**
1. Verify state is selected first
2. Check API: `GET /api/locations/cities?stateId=<ID>`
3. Ensure seed data was run: `npx prisma db seed`

### Backfill Script Errors

**Issue:** Migration script fails

**Solutions:**
1. Check `indian_states` table has data
2. Verify `stateCode` values in `customer_gst_numbers`
3. Run with `npx ts-node` not `node`

---

## Files Reference

### Backend Files

| File | Purpose |
|------|---------|
| `services/gst.service.ts` | GST validation & calculation |
| `services/location.service.ts` | State/city queries |
| `routes/gst.routes.ts` | GST API endpoints |
| `routes/location.routes.ts` | Location API endpoints |
| `prisma/seeds/indian-states.seed.ts` | State seed data |
| `prisma/seeds/indian-cities.seed.ts` | City seed data |

### Frontend Files

| File | Purpose |
|------|---------|
| `components/StateSelector.tsx` | State dropdown |
| `components/CitySelector.tsx` | City dropdown |
| `components/GSTNumberInput.tsx` | GST input with validation |
| `components/TaxBreakdown.tsx` | Tax display component |
| `types/location.types.ts` | Location type definitions |
| `types/gst.types.ts` | GST type definitions |

---

**Status:** Production Ready
**Coverage:** All 36 Indian States/UTs, 133 Major Cities
**Compliance:** GST 2017 Rules

---

## 11. Detailed Implementation (Frontend Forms)

This section provides step-by-step instructions for integrating GST components into existing forms.

### 11.1 CustomerForm.tsx Updates

**File:** `frontend/src/pages/CustomerForm.tsx`

#### A. Update Form Schema

Add these fields to `customerFormSchema` (around line 24):

```typescript
// Structured Address Fields
billingStateId: z.string().optional(),
billingCityId: z.string().optional(),
billingPincode: z.string().optional(),
shippingStateId: z.string().optional(),
shippingCityId: z.string().optional(),
shippingPincode: z.string().optional(),
```

#### B. Add State Imports

At the top of the file:

```typescript
import StateSelector from '@/components/StateSelector';
import CitySelector from '@/components/CitySelector';
import GSTNumberInput from '@/components/GSTNumberInput';
```

#### C. Add State for Address Fields

```typescript
// Billing Address
const [billingStateId, setBillingStateId] = useState<string | null>(null);
const [billingCityId, setBillingCityId] = useState<string | null>(null);
const [billingPincode, setBillingPincode] = useState<string>('');

// Shipping Address
const [shippingStateId, setShippingStateId] = useState<string | null>(null);
const [shippingCityId, setShippingCityId] = useState<string | null>(null);
const [shippingPincode, setShippingPincode] = useState<string>('');
const [sameAsBilling, setSameAsBilling] = useState<boolean>(false);
```

#### D. Update GST Numbers State

```typescript
const [gstNumbers, setGstNumbers] = useState<Array<{
  stateId?: string;
  stateName: string;
  stateCode: string;
  gstNumber: string;
  billingAddress?: string;
  isPrimary: boolean;
}>>([{
  stateId: undefined,
  stateName: '',
  stateCode: '',
  gstNumber: '',
  billingAddress: '',
  isPrimary: false
}]);
```

#### E. Load Address Data in Edit Mode

In the useEffect that loads customer data:

```typescript
// Load billing address
if (customer.billingStateId) setBillingStateId(customer.billingStateId);
if (customer.billingCityId) setBillingCityId(customer.billingCityId);
if (customer.billingPincode) setBillingPincode(customer.billingPincode);

// Load shipping address
if (customer.shippingStateId) setShippingStateId(customer.shippingStateId);
if (customer.shippingCityId) setShippingCityId(customer.shippingCityId);
if (customer.shippingPincode) setShippingPincode(customer.shippingPincode);

// Parse GST numbers with stateId
if (customer.customerGstNumbers && customer.customerGstNumbers.length > 0) {
  const parsedGstNumbers = customer.customerGstNumbers.map(gst => ({
    stateId: gst.stateId || undefined,
    stateName: gst.stateName || '',
    stateCode: gst.stateCode || '',
    gstNumber: gst.gstNumber || '',
    billingAddress: gst.billingAddress || '',
    isPrimary: gst.isPrimary || false
  }));
  setGstNumbers(parsedGstNumbers);
}
```

#### F. Add "Copy Billing to Shipping" Handler

```typescript
const handleCopyBillingToShipping = () => {
  setShippingStateId(billingStateId);
  setShippingCityId(billingCityId);
  setShippingPincode(billingPincode);
  setSameAsBilling(true);
};
```

#### G. Update Form JSX - Billing Address Section

```tsx
{/* Billing Address Section */}
<div className="md:col-span-2">
  <h3 className="text-lg font-semibold mb-3 text-gray-800">Billing Address</h3>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
    <StateSelector
      value={billingStateId}
      onChange={setBillingStateId}
      label="State"
      required
      showStateCode
    />
    <CitySelector
      value={billingCityId}
      stateId={billingStateId}
      onChange={setBillingCityId}
      label="City"
    />
    <div>
      <Label>Pincode</Label>
      <Input
        value={billingPincode}
        onChange={(e) => setBillingPincode(e.target.value)}
        placeholder="e.g., 400001"
        maxLength={6}
      />
    </div>
    <div className="md:col-span-3">
      <Label>Street Address</Label>
      <Textarea
        {...register('billingAddress')}
        placeholder="Building, street, area"
        rows={2}
      />
    </div>
  </div>
</div>
```

#### H. Update Form JSX - Shipping Address Section

```tsx
{/* Shipping Address Section */}
<div className="md:col-span-2">
  <div className="flex justify-between items-center mb-3">
    <h3 className="text-lg font-semibold text-gray-800">Shipping Address</h3>
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopyBillingToShipping}
    >
      Copy from Billing
    </Button>
  </div>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
    <StateSelector
      value={shippingStateId}
      onChange={setShippingStateId}
      label="State"
      showStateCode
    />
    <CitySelector
      value={shippingCityId}
      stateId={shippingStateId}
      onChange={setShippingCityId}
      label="City"
    />
    <div>
      <Label>Pincode</Label>
      <Input
        value={shippingPincode}
        onChange={(e) => setShippingPincode(e.target.value)}
        placeholder="e.g., 400001"
        maxLength={6}
      />
    </div>
    <div className="md:col-span-3">
      <Label>Street Address</Label>
      <Textarea
        {...register('shippingAddress')}
        placeholder="Building, street, area"
        rows={2}
      />
    </div>
  </div>
</div>
```

#### I. Update Form JSX - GST Numbers Section

```tsx
<div className="md:col-span-2">
  <Label>GST Registrations (State-wise)</Label>
  <p className="text-sm text-gray-500 mb-3">
    Add GST registration for each state where you have operations.
  </p>
  <div className="space-y-3">
    {gstNumbers.map((gst, index) => (
      <GSTNumberInput
        key={index}
        value={gst}
        onChange={(newValue) => {
          const updated = [...gstNumbers];
          updated[index] = newValue;
          setGstNumbers(updated);
        }}
        onRemove={() => {
          if (gstNumbers.length > 1) {
            setGstNumbers(gstNumbers.filter((_, i) => i !== index));
          }
        }}
        showRemove={gstNumbers.length > 1}
        autoValidate
      />
    ))}
    <Button
      type="button"
      variant="outline"
      onClick={() => setGstNumbers([
        ...gstNumbers,
        {
          stateId: undefined,
          stateName: '',
          stateCode: '',
          gstNumber: '',
          billingAddress: '',
          isPrimary: false
        }
      ])}
      className="w-full"
    >
      + Add Another GST Registration
    </Button>
  </div>
</div>
```

### 11.2 InvoiceForm.tsx Updates

**File:** `frontend/src/pages/InvoiceForm.tsx`

#### A. Add Imports

```typescript
import StateSelector from '@/components/StateSelector';
import TaxBreakdown from '@/components/TaxBreakdown';
```

#### B. Add State for Tax Calculation

```typescript
const [placeOfSupplyId, setPlaceOfSupplyId] = useState<string | null>(null);
const [taxRate, setTaxRate] = useState<number>(12);
const [gstCalculation, setGstCalculation] = useState<GSTCalculation | null>(null);
const [customerId, setCustomerId] = useState<string | null>(null);
```

#### C. Add Tax Calculation Function

```typescript
const calculateTaxes = async () => {
  if (!subtotal || !placeOfSupplyId) return;

  try {
    const response = await fetch('/api/gst/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: subtotal,
        taxRate,
        toStateId: placeOfSupplyId,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      setGstCalculation(data);
    }
  } catch (error) {
    console.error('Failed to calculate taxes:', error);
  }
};
```

#### D. Add useEffect for Auto-calculation

```typescript
useEffect(() => {
  if (subtotal && placeOfSupplyId) {
    calculateTaxes();
  }
}, [subtotal, placeOfSupplyId, taxRate]);
```

#### E. Update Form JSX - Add Tax Section

```tsx
{/* Tax Calculation Section */}
<Card>
  <CardHeader>
    <CardTitle>Tax Calculation</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <StateSelector
        value={placeOfSupplyId}
        onChange={setPlaceOfSupplyId}
        label="Place of Supply"
        required
        showStateCode
      />
      <div>
        <Label>Tax Rate (%)</Label>
        <Input
          type="number"
          value={taxRate}
          onChange={(e) => setTaxRate(parseFloat(e.target.value))}
          min={0}
          max={28}
          step={0.5}
        />
      </div>
    </div>

    {gstCalculation && (
      <TaxBreakdown
        subtotal={subtotal}
        cgst={gstCalculation.cgst}
        sgst={gstCalculation.sgst}
        igst={gstCalculation.igst}
        cgstRate={gstCalculation.cgstRate}
        sgstRate={gstCalculation.sgstRate}
        igstRate={gstCalculation.igstRate}
        isInterstate={gstCalculation.isInterstate}
        total={subtotal + gstCalculation.totalTax}
        showRates
      />
    )}
  </CardContent>
</Card>
```

### 11.3 QuotationForm.tsx Updates

**Similar to InvoiceForm with optional tax estimation:**

```tsx
const [includeTaxEstimate, setIncludeTaxEstimate] = useState<boolean>(false);
const [placeOfSupplyId, setPlaceOfSupplyId] = useState<string | null>(null);
const [taxRate, setTaxRate] = useState<number>(12);
const [gstCalculation, setGstCalculation] = useState<GSTCalculation | null>(null);
```

```tsx
{/* Tax Estimation Toggle */}
<div className="flex items-center space-x-2">
  <Switch
    checked={includeTaxEstimate}
    onCheckedChange={setIncludeTaxEstimate}
  />
  <Label>Include Tax Estimate</Label>
</div>

{includeTaxEstimate && (
  <div className="grid grid-cols-2 gap-4 mt-4">
    <StateSelector
      value={placeOfSupplyId}
      onChange={setPlaceOfSupplyId}
      label="Place of Supply"
      showStateCode
    />
    <div>
      <Label>Tax Rate (%)</Label>
      <Input
        type="number"
        value={taxRate}
        onChange={(e) => setTaxRate(parseFloat(e.target.value))}
        min={0}
        max={28}
        step={0.5}
      />
    </div>
  </div>
)}

{includeTaxEstimate && gstCalculation && (
  <TaxBreakdown
    subtotal={totalAmount}
    cgst={gstCalculation.cgst}
    sgst={gstCalculation.sgst}
    igst={gstCalculation.igst}
    cgstRate={gstCalculation.cgstRate}
    sgstRate={gstCalculation.sgstRate}
    igstRate={gstCalculation.igstRate}
    isInterstate={gstCalculation.isInterstate}
    total={totalAmount + gstCalculation.totalTax}
    showRates
  />
)}
```

---

## 12. Supplier GST Implementation

### 12.1 Overview

The Supplier module mirrors the Customer module's GST capabilities:
- **Multiple GST registrations** per supplier
- **Primary GST marking** for default invoicing
- **State-wise GST management** with full validation
- **Automatic state lookup** from GST number

### 12.2 Database Schema for Suppliers

**New Table: `supplier_gst_numbers`**

```sql
CREATE TABLE supplier_gst_numbers (
  id UUID PRIMARY KEY,
  supplierId UUID REFERENCES suppliers(id),
  stateId UUID REFERENCES indian_states(id),
  stateName VARCHAR NOT NULL,
  stateCode VARCHAR(2) NOT NULL,
  gstNumber VARCHAR(15) NOT NULL,
  billingAddress TEXT,
  isPrimary BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now(),
  UNIQUE(supplierId, gstNumber)
);
```

**Updated Table: `suppliers`**

New columns:
- `billingStateId` - Reference to indian_states
- `billingCityId` - Reference to indian_cities
- `billingPincode` - 6-digit PIN code
- `shippingStateId` - Reference to indian_states
- `shippingCityId` - Reference to indian_cities
- `shippingPincode` - 6-digit PIN code
- `shippingAddress` - Full shipping address

### 12.3 Prisma Schema Updates

```prisma
model suppliers {
  // ... existing fields ...

  // GST & Location Fields
  billingStateId        String?
  billingCityId         String?
  billingPincode        String?
  shippingStateId       String?
  shippingCityId        String?
  shippingPincode       String?
  shippingAddress       String?

  // Relations
  gst_numbers           supplier_gst_numbers[]
  billing_state         indian_states?  @relation("supplier_billing_state")
  billing_city          indian_cities?  @relation("supplier_billing_city")
  shipping_state        indian_states?  @relation("supplier_shipping_state")
  shipping_city         indian_cities?  @relation("supplier_shipping_city")
}

model supplier_gst_numbers {
  id             String         @id @default(uuid())
  supplierId     String
  stateId        String?
  stateName      String
  stateCode      String
  gstNumber      String
  billingAddress String?
  isPrimary      Boolean        @default(false)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  supplier       suppliers      @relation(fields: [supplierId])
  state          indian_states? @relation(fields: [stateId])

  @@unique([supplierId, gstNumber])
}
```

### 12.4 Supplier Service Updates

**File:** `backend/src/services/supplier.service.ts`

**New Interfaces:**

```typescript
export interface GstNumberInput {
  stateId?: string;
  stateName: string;
  stateCode: string;
  gstNumber: string;
  billingAddress?: string;
  isPrimary: boolean;
}

export interface CreateSupplierDTO {
  // ... existing fields ...
  billingStateId?: string;
  billingCityId?: string;
  billingPincode?: string;
  shippingStateId?: string;
  shippingCityId?: string;
  shippingPincode?: string;
  shippingAddress?: string;
  gstNumbers?: GstNumberInput[];
}
```

**New Methods:**
- `validateGstNumbers()` - Validates GST format and uniqueness
- `createGstNumbers()` - Batch creates GST registrations
- Enhanced `createSupplier()` - Handles GST validation and creation
- Enhanced `updateSupplier()` - Handles GST updates

### 12.5 Supplier Form Layout

The SupplierForm is organized into **8 color-coded sections**:

| Section | Content | Color |
|---------|---------|-------|
| 1. Basic Information | Supplier Code, Name, Categories | Gray |
| 2. Contact Details | Contact Person, Phone, Email, Office Address | Gray |
| 3. Billing Location | State, City, PIN Code | Blue gradient |
| 4. Shipping Location | State, City, PIN Code, "Same as Billing" | Green gradient |
| 5. GST Registration | Multi-state GST numbers | Amber gradient |
| 6. Payment & Credit | Payment Terms, Credit Limit, Rating | Gray |
| 7. Bank Account | Bank Name, IFSC, Account Number | Gray |
| 8. Category-Specific | Dynamic fields per category | Purple gradient |

### 12.6 Supplier Types (Frontend)

**File:** `frontend/src/types/supplier.types.ts`

```typescript
export interface SupplierGSTNumber {
  id: string;
  supplierId: string;
  stateId?: string | null;
  stateName: string;
  stateCode: string;
  gstNumber: string;
  billingAddress?: string | null;
  isPrimary: boolean;
  state?: {
    id: string;
    stateName: string;
    stateCode: string;
  } | null;
}

export interface Supplier {
  // ... existing fields ...
  billingStateId?: string | null;
  billingCityId?: string | null;
  billingPincode?: string | null;
  shippingStateId?: string | null;
  shippingCityId?: string | null;
  shippingPincode?: string | null;
  shippingAddress?: string | null;
  gstNumbers?: SupplierGSTNumber[];
  billingState?: { id: string; stateName: string; stateCode: string; };
  billingCity?: { id: string; cityName: string; };
  shippingState?: { id: string; stateName: string; stateCode: string; };
  shippingCity?: { id: string; cityName: string; };
}
```

### 12.7 Usage for Purchase Orders

When creating purchase orders, you can now:
1. Select supplier's primary GST state
2. Compare with company's state (from COMPANY_STATE_ID)
3. Automatically determine CGST+SGST vs IGST
4. Calculate correct tax based on supplier location

**API Response Example:**

```json
{
  "id": "...",
  "code": "SUP123456",
  "name": "ABC Fabrics",
  "gstNumbers": [
    {
      "id": "...",
      "stateCode": "27",
      "stateName": "Maharashtra",
      "gstNumber": "27AAACT1234E1Z5",
      "isPrimary": true
    }
  ],
  "billingState": {
    "id": "...",
    "stateName": "Maharashtra",
    "stateCode": "27"
  },
  "billingCity": {
    "id": "...",
    "cityName": "Mumbai"
  }
}
```

---

## 13. Quick Start Testing Guide

### 13.1 Setup (5 minutes)

#### Step 1: Set Company State ID

```bash
# Query for your state ID
SELECT id, stateName, stateCode FROM indian_states WHERE stateCode = '27';
```

Update `backend/.env`:

```env
COMPANY_STATE_ID="<paste-your-state-id-here>"
```

#### Step 2: Verify Seeds

```bash
# Check states count (should be 36)
curl http://localhost:5000/api/locations/states | jq '. | length'

# Check cities count (should be 133)
curl http://localhost:5000/api/locations/cities | jq '. | length'
```

If counts are 0:

```bash
cd backend
npx prisma db seed
```

### 13.2 Test GST Validation

**Valid GST Number:**

```bash
curl -X POST http://localhost:5000/api/gst/validate \
  -H "Content-Type: application/json" \
  -d '{
    "gstNumber": "27AAAAA0000A1Z5",
    "stateCode": "27"
  }'
```

**Expected Response:**

```json
{
  "isValid": true,
  "message": "GST number is valid"
}
```

**Invalid GST Number (Wrong State Code):**

```bash
curl -X POST http://localhost:5000/api/gst/validate \
  -H "Content-Type: application/json" \
  -d '{
    "gstNumber": "27AAAAA0000A1Z5",
    "stateCode": "24"
  }'
```

**Expected Response:**

```json
{
  "isValid": false,
  "message": "GST number state code (27) does not match provided state code (24)"
}
```

### 13.3 Test GST Calculation

**Get State IDs:**

```bash
# Get Maharashtra (27) ID
MAHARASHTRA_ID=$(curl -s http://localhost:5000/api/locations/states/code/27 | jq -r '.id')

# Get Gujarat (24) ID
GUJARAT_ID=$(curl -s http://localhost:5000/api/locations/states/code/24 | jq -r '.id')
```

**Intrastate Transaction (CGST + SGST):**

```bash
curl -X POST http://localhost:5000/api/gst/calculate \
  -H "Content-Type: application/json" \
  -d "{
    \"amount\": 10000,
    \"taxRate\": 12,
    \"fromStateId\": \"$MAHARASHTRA_ID\",
    \"toStateId\": \"$MAHARASHTRA_ID\"
  }"
```

**Expected Response:**

```json
{
  "cgst": 600,
  "sgst": 600,
  "igst": 0,
  "cgstRate": 6,
  "sgstRate": 6,
  "igstRate": 0,
  "totalTax": 1200,
  "isInterstate": false
}
```

**Interstate Transaction (IGST):**

```bash
curl -X POST http://localhost:5000/api/gst/calculate \
  -H "Content-Type: application/json" \
  -d "{
    \"amount\": 10000,
    \"taxRate\": 12,
    \"fromStateId\": \"$MAHARASHTRA_ID\",
    \"toStateId\": \"$GUJARAT_ID\"
  }"
```

**Expected Response:**

```json
{
  "cgst": 0,
  "sgst": 0,
  "igst": 1200,
  "cgstRate": 0,
  "sgstRate": 0,
  "igstRate": 12,
  "totalTax": 1200,
  "isInterstate": true
}
```

### 13.4 Test Frontend Components

Create a test page at `frontend/src/pages/TestGST.tsx`:

```tsx
import { useState } from 'react';
import StateSelector from '@/components/StateSelector';
import CitySelector from '@/components/CitySelector';
import GSTNumberInput from '@/components/GSTNumberInput';
import TaxBreakdown from '@/components/TaxBreakdown';

export default function TestGST() {
  const [stateId, setStateId] = useState<string | null>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [gstNumber, setGstNumber] = useState({
    stateId: '',
    stateName: '',
    stateCode: '',
    gstNumber: '',
    billingAddress: '',
    isPrimary: false,
  });

  return (
    <div className="container mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold">GST Components Test</h1>

      {/* State Selector Test */}
      <div className="border p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">1. State Selector</h2>
        <StateSelector
          value={stateId}
          onChange={setStateId}
          label="Select State"
          showStateCode
        />
        <p className="mt-2 text-sm text-gray-600">Selected: {stateId || 'None'}</p>
      </div>

      {/* City Selector Test */}
      <div className="border p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">2. City Selector</h2>
        <CitySelector
          value={cityId}
          stateId={stateId}
          onChange={setCityId}
          label="Select City"
          showTier
          allowSearch
        />
        <p className="mt-2 text-sm text-gray-600">Selected: {cityId || 'None'}</p>
      </div>

      {/* GST Number Input Test */}
      <div className="border p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">3. GST Number Input</h2>
        <GSTNumberInput
          value={gstNumber}
          onChange={setGstNumber}
          autoValidate
        />
        <pre className="mt-4 p-3 bg-gray-100 rounded text-xs">
          {JSON.stringify(gstNumber, null, 2)}
        </pre>
      </div>

      {/* Tax Breakdown Test */}
      <div className="border p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">4. Tax Breakdown (Intrastate)</h2>
        <TaxBreakdown
          subtotal={10000}
          cgst={600}
          sgst={600}
          igst={0}
          cgstRate={6}
          sgstRate={6}
          igstRate={0}
          isInterstate={false}
          total={11200}
          showRates
          size="md"
        />
      </div>

      <div className="border p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">5. Tax Breakdown (Interstate)</h2>
        <TaxBreakdown
          subtotal={10000}
          cgst={0}
          sgst={0}
          igst={1200}
          cgstRate={0}
          sgstRate={0}
          igstRate={12}
          isInterstate={true}
          total={11200}
          showRates
          size="md"
        />
      </div>
    </div>
  );
}
```

### 13.5 Test Customer with Multiple GST

```bash
# Get authentication token
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@kashayafabs.com",
    "password": "your-password"
  }' | jq -r '.token')

# Get state and city IDs
MAHARASHTRA_ID=$(curl -s http://localhost:5000/api/locations/states/code/27 | jq -r '.id')
MUMBAI_ID=$(curl -s "http://localhost:5000/api/locations/cities?search=Mumbai" | jq -r '.[0].id')
GUJARAT_ID=$(curl -s http://localhost:5000/api/locations/states/code/24 | jq -r '.id')
AHMEDABAD_ID=$(curl -s "http://localhost:5000/api/locations/cities?search=Ahmedabad" | jq -r '.[0].id')

# Create customer with multiple GST numbers
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"code\": \"CUST-B2B-DOM-TEST-001\",
    \"name\": \"Test Garments Pvt Ltd\",
    \"billingStateId\": \"$MAHARASHTRA_ID\",
    \"billingCityId\": \"$MUMBAI_ID\",
    \"billingPincode\": \"400001\",
    \"gstNumbers\": [
      {
        \"stateId\": \"$MAHARASHTRA_ID\",
        \"stateName\": \"Maharashtra\",
        \"stateCode\": \"27\",
        \"gstNumber\": \"27AAACT1234E1Z5\",
        \"isPrimary\": true
      },
      {
        \"stateId\": \"$GUJARAT_ID\",
        \"stateName\": \"Gujarat\",
        \"stateCode\": \"24\",
        \"gstNumber\": \"24AAACT1234E1Z5\",
        \"isPrimary\": false
      }
    ]
  }"
```

---

## 14. Complete Files Reference

### 14.1 Backend Files

| File | Purpose | Lines |
|------|---------|-------|
| `prisma/schema.prisma` | Database schema with state/city models | - |
| `prisma/seeds/indian-states.seed.ts` | 36 states/UTs seed data | ~200 |
| `prisma/seeds/indian-cities.seed.ts` | 133 cities seed data | ~700 |
| `services/gst.service.ts` | GST validation and calculation | ~250 |
| `services/location.service.ts` | State and city CRUD | ~200 |
| `routes/gst.routes.ts` | GST API endpoints | ~150 |
| `routes/location.routes.ts` | Location API endpoints | ~100 |
| `scripts/backfill-gst-states.ts` | Migration script | ~100 |

### 14.2 Frontend Files

| File | Purpose | Lines |
|------|---------|-------|
| `types/location.types.ts` | State/city type definitions | ~95 |
| `types/gst.types.ts` | GST type definitions | ~150 |
| `components/StateSelector.tsx` | State dropdown | ~110 |
| `components/CitySelector.tsx` | City dropdown | ~180 |
| `components/GSTNumberInput.tsx` | GST input with validation | ~210 |
| `components/TaxBreakdown.tsx` | Tax display component | ~190 |
| `services/location.service.ts` | Location API wrapper | ~120 |
| `services/gst.service.ts` | GST API wrapper | ~160 |

### 14.3 File Dependencies

**Backend Chain:**

```
schema.prisma
    ↓
seeds/indian-states.seed.ts
seeds/indian-cities.seed.ts
    ↓
services/location.service.ts
services/gst.service.ts
    ↓
routes/location.routes.ts
routes/gst.routes.ts
    ↓
routes/index.ts (registration)
    ↓
services/customer.service.ts (uses GST service)
services/invoice.service.ts (uses GST service)
services/quotation.service.ts (uses GST service)
```

**Frontend Chain:**

```
types/location.types.ts
types/gst.types.ts
    ↓
services/location.service.ts
services/gst.service.ts
    ↓
components/StateSelector.tsx
components/CitySelector.tsx
components/GSTNumberInput.tsx
components/TaxBreakdown.tsx
    ↓
pages/CustomerForm.tsx
pages/InvoiceForm.tsx
pages/QuotationForm.tsx
```

---

## 15. Validation Rules Reference

### 15.1 GST Number Validation

| Rule | Validation |
|------|------------|
| **Length** | Exactly 15 characters |
| **Pattern** | `\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}` |
| **State Code** | First 2 digits must match selected state |
| **Uniqueness** | No duplicate GST numbers for same customer/supplier |
| **Primary** | Only one GST can be marked as primary |

### 15.2 Location Validation

| Field | Validation |
|-------|------------|
| **State** | Required for GST validation |
| **City** | Optional but recommended |
| **PIN Code** | 6 digits, must start with 1-9 |

### 15.3 Bank Details Validation

| Field | Validation |
|-------|------------|
| **IFSC Code** | 11 characters (4 letters + 0 + 6 alphanumeric) |
| **Account Number** | 9-18 digits |

---

## 16. Customer vs Supplier Feature Comparison

| Feature | Customer Module | Supplier Module |
|---------|----------------|-----------------|
| Multi-state GST | ✅ | ✅ |
| Location fields | ✅ | ✅ |
| GST validation | ✅ | ✅ |
| State selectors | ✅ | ✅ |
| City selectors | ✅ | ✅ |
| Visual layout | ✅ | ✅ Enhanced |
| "Same as Billing" | ✅ | ✅ |
| Category-specific fields | ❌ | ✅ |

---

## 17. Success Criteria Checklist

You've successfully implemented GST features when:

- [ ] All 36 states returned from `/api/locations/states`
- [ ] All 133 cities returned from `/api/locations/cities`
- [ ] Valid GST numbers pass validation
- [ ] Invalid GST numbers fail with proper error messages
- [ ] Intrastate transactions show CGST + SGST (6% + 6%)
- [ ] Interstate transactions show only IGST (12%)
- [ ] Customer can be created with multiple GST registrations
- [ ] Supplier can be created with multiple GST registrations
- [ ] Frontend components load states and cities from API
- [ ] GST number input validates in real-time
- [ ] Tax breakdown displays correctly with proper formatting
- [ ] Invoice tax calculation is automatic
- [ ] Quotation tax estimation is optional

---

## 18. Production Deployment Checklist

1. **Set Environment Variable:**
   ```env
   COMPANY_STATE_ID="<your-state-uuid>"
   ```

2. **Run Database Migrations:**
   ```bash
   npx prisma migrate deploy
   ```

3. **Run Seed Data:**
   ```bash
   npx prisma db seed
   ```

4. **Run Backfill Script (if needed):**
   ```bash
   npx ts-node scripts/backfill-gst-states.ts
   ```

5. **Verify API Endpoints:**
   ```bash
   curl https://your-domain/api/locations/states | jq '. | length'
   curl https://your-domain/api/gst/rates
   ```

---

**Implementation Status:** ✅ Complete
**Backend Status:** Production Ready
**Frontend Status:** Production Ready
**Last Updated:** January 12, 2026
