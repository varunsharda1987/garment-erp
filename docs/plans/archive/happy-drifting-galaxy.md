# Indian States, Cities & GST Compliance Implementation Plan

## Overview
Add comprehensive Indian state and city master data with full GST compliance features including automatic CGST/SGST/IGST calculation, GST number validation, and structured address management across all forms (Customer, Invoice, Quotation).

---

## Phase 1: Database Schema & Seed Data

### 1.1 Create New Master Tables

**File**: `backend/prisma/schema.prisma`

Add two new models after the existing master tables:

```prisma
model indian_states {
  id                String   @id @default(uuid())
  stateName         String   @unique // "Maharashtra"
  stateCode         String   @unique // "27" (2-digit GST code)
  stateType         StateType // STATE or UNION_TERRITORY
  sortOrder         Int      @default(0)
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  cities                    indian_cities[]
  customer_gst_numbers      customer_gst_numbers[]
  customers_billing         customers[] @relation("CustomerBillingState")
  customers_shipping        customers[] @relation("CustomerShippingState")
  invoices_place_of_supply  invoices[] @relation("InvoicePlaceOfSupply")
  quotations_place_of_supply quotations[] @relation("QuotationPlaceOfSupply")

  @@index([stateCode])
  @@index([isActive])
}

model indian_cities {
  id                String   @id @default(uuid())
  stateId           String
  cityName          String
  tier              CityTier // TIER_1, TIER_2, TIER_3
  sortOrder         Int      @default(0)
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  state             indian_states @relation(fields: [stateId], references: [id])
  customers_billing customers[] @relation("CustomerBillingCity")
  customers_shipping customers[] @relation("CustomerShippingCity")

  @@unique([stateId, cityName])
  @@index([stateId])
  @@index([isActive])
}

enum StateType {
  STATE
  UNION_TERRITORY
}

enum CityTier {
  TIER_1
  TIER_2
  TIER_3
}
```

### 1.2 Update Existing Models

**In `customers` model**, add structured address fields:

```prisma
// After existing address fields
billingStateId      String?
billingCityId       String?
billingPincode      String?
shippingStateId     String?
shippingCityId      String?
shippingPincode     String?

// Add relations at the end
billingState   indian_states? @relation("CustomerBillingState", fields: [billingStateId], references: [id])
billingCity    indian_cities? @relation("CustomerBillingCity", fields: [billingCityId], references: [id])
shippingState  indian_states? @relation("CustomerShippingState", fields: [shippingStateId], references: [id])
shippingCity   indian_cities? @relation("CustomerShippingCity", fields: [shippingCityId], references: [id])

// Add indexes
@@index([billingStateId])
@@index([shippingStateId])
```

**In `customer_gst_numbers` model**, add foreign key:

```prisma
stateId  String?

// Add relation
state    indian_states? @relation(fields: [stateId], references: [id])

// Add index
@@index([stateId])
```

**In `invoices` model**, add GST breakdown fields:

```prisma
// GST Compliance Fields
placeOfSupplyId  String?
cgstAmount       Decimal @default(0) @db.Decimal(12, 2)
sgstAmount       Decimal @default(0) @db.Decimal(12, 2)
igstAmount       Decimal @default(0) @db.Decimal(12, 2)
cgstRate         Decimal? @db.Decimal(5, 2)
sgstRate         Decimal? @db.Decimal(5, 2)
igstRate         Decimal? @db.Decimal(5, 2)
isInterstate     Boolean @default(false)

// Add relation
placeOfSupply indian_states? @relation("InvoicePlaceOfSupply", fields: [placeOfSupplyId], references: [id])

// Add index
@@index([placeOfSupplyId])
```

**In `quotations` model**, add tax estimation fields:

```prisma
// Tax Estimation
placeOfSupplyId  String?
estimatedCGST    Decimal @default(0) @db.Decimal(12, 2)
estimatedSGST    Decimal @default(0) @db.Decimal(12, 2)
estimatedIGST    Decimal @default(0) @db.Decimal(12, 2)
taxRate          Decimal? @db.Decimal(5, 2)
totalWithTax     Decimal? @db.Decimal(12, 2)

// Add relation
placeOfSupply indian_states? @relation("QuotationPlaceOfSupply", fields: [placeOfSupplyId], references: [id])

// Add index
@@index([placeOfSupplyId])
```

### 1.3 Create Seed Data Files

**File**: `backend/prisma/seeds/indian-states.seed.ts`

Create comprehensive seed data with all 36 states/UTs:
- 28 States (Maharashtra-27, Gujarat-24, Karnataka-29, Tamil Nadu-33, etc.)
- 8 Union Territories (Delhi-07, Puducherry-34, Chandigarh-04, etc.)

**File**: `backend/prisma/seeds/indian-cities.seed.ts`

Create major cities (~250-300 total):
- Tier 1: Mumbai, Delhi, Bangalore, Chennai, Kolkata, Hyderabad, Pune, Ahmedabad (metro cities)
- Tier 2: Garment hubs like Tiruppur, Ludhiana, Surat, Coimbatore, Jaipur, Indore (~50-60 cities)
- Tier 3: District headquarters and manufacturing towns (~150-200 cities)

Strategy: Focus on 5-10 major cities per state, emphasizing garment manufacturing centers.

### 1.4 Generate Migration

```bash
npx prisma migrate dev --name add_indian_states_cities_gst_compliance
npx ts-node backend/prisma/seeds/indian-states.seed.ts
npx ts-node backend/prisma/seeds/indian-cities.seed.ts
```

---

## Phase 2: Backend Services

### 2.1 GST Service (New)

**File**: `backend/src/services/gst.service.ts`

Core GST validation and calculation logic:

```typescript
interface GSTCalculation {
  cgst: number;
  sgst: number;
  igst: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  totalTax: number;
  isInterstate: boolean;
}

class GSTService {
  // Validate GST number format and state code match
  validateGSTNumber(gstNumber: string, stateCode: string): boolean

  // Calculate GST breakdown based on states
  calculateGST(
    amount: number,
    taxRate: number,
    supplierStateId: string,
    customerStateId: string
  ): Promise<GSTCalculation>

  // Get default GST rate (12% for garments HSN 61/62/63)
  getDefaultGSTRate(hsnCode?: string): number

  // Extract state code from GST number
  extractStateCodeFromGST(gstNumber: string): string
}
```

**Validation Rules**:
- Format: 15 alphanumeric characters
- Pattern: `\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}`
- State code (first 2 digits) must match selected state's GST code

**Tax Calculation Logic**:
- **Intra-state** (same state): Split rate equally → CGST (9%) + SGST (9%) = 18%
- **Inter-state** (different states): Full rate → IGST (18%)

### 2.2 Location Service (New)

**File**: `backend/src/services/location.service.ts`

```typescript
class LocationService extends BaseService {
  // Get all active states with optional city count
  getAllStates(includeCityCount?: boolean): Promise<State[]>

  // Get state by GST code
  getStateByCode(stateCode: string): Promise<State | null>

  // Get cities filtered by state, sorted by tier
  getCitiesByState(stateId: string): Promise<City[]>

  // Search cities with autocomplete support
  searchCities(searchTerm: string, stateId?: string): Promise<City[]>
}
```

### 2.3 Update Customer Service

**File**: `backend/src/services/customer.service.ts`

**Modify `createGstNumbers()` method**:
```typescript
private async createGstNumbers(customerId: string, gstNumbers: GstNumberInput[]) {
  for (const gst of gstNumbers) {
    // Validate GST number format
    if (!gstService.validateGSTNumber(gst.gstNumber, gst.stateCode)) {
      throw new ValidationError(
        `Invalid GST number ${gst.gstNumber}. State code mismatch.`
      );
    }

    // Lookup stateId from stateCode
    const state = await this.prisma.indian_states.findUnique({
      where: { stateCode: gst.stateCode }
    });

    if (!state) {
      throw new ValidationError(`Invalid state code: ${gst.stateCode}`);
    }

    await this.prisma.customer_gst_numbers.create({
      data: {
        customerId,
        stateId: state.id,
        stateName: gst.stateName,
        stateCode: gst.stateCode,
        gstNumber: gst.gstNumber,
        billingAddress: gst.billingAddress,
        isPrimary: gst.isPrimary || false,
      }
    });
  }
}
```

**Update `CreateCustomerDTO` interface**:
```typescript
export interface CreateCustomerDTO {
  // ... existing fields
  billingStateId?: string;
  billingCityId?: string;
  billingPincode?: string;
  shippingStateId?: string;
  shippingCityId?: string;
  shippingPincode?: string;
}
```

### 2.4 Update Invoice Service

**File**: `backend/src/services/invoice.service.ts`

**Modify `createInvoice()` method**:
```typescript
async createInvoice(data: CreateInvoiceDTO): Promise<invoices> {
  // ... existing validation

  // Get customer's billing state
  const customer = await this.prisma.customers.findUnique({
    where: { id: data.customerId },
    select: { billingStateId: true }
  });

  if (!customer?.billingStateId) {
    throw new ValidationError('Customer must have a billing state for GST calculation');
  }

  // Get company's registered state (configure in .env or settings)
  const COMPANY_STATE_ID = process.env.COMPANY_STATE_ID || 'default-state-id';

  // Calculate GST breakdown
  const gstCalc = await gstService.calculateGST(
    data.subtotal,
    data.taxRate || 12, // Default 12% or from order items
    COMPANY_STATE_ID,
    customer.billingStateId
  );

  // Create invoice with GST breakdown
  return await this.prisma.invoices.create({
    data: {
      ...existingInvoiceData,
      placeOfSupplyId: customer.billingStateId,
      cgstAmount: gstCalc.cgst,
      sgstAmount: gstCalc.sgst,
      igstAmount: gstCalc.igst,
      cgstRate: gstCalc.cgstRate,
      sgstRate: gstCalc.sgstRate,
      igstRate: gstCalc.igstRate,
      isInterstate: gstCalc.isInterstate,
      taxAmount: gstCalc.totalTax, // Keep for backward compatibility
    }
  });
}
```

**Update `CreateInvoiceDTO` interface**:
```typescript
export interface CreateInvoiceDTO {
  // ... existing fields
  taxRate?: number; // Optional, defaults to 12%
}
```

### 2.5 Update Quotation Service

**File**: `backend/src/services/quotation.service.ts`

**Add method for tax estimation**:
```typescript
async estimateGST(quotationId: string, placeOfSupplyId: string): Promise<Quotation> {
  const quotation = await this.findById(quotationId);

  if (!quotation) {
    throw new NotFoundError('Quotation not found');
  }

  const COMPANY_STATE_ID = process.env.COMPANY_STATE_ID || 'default-state-id';
  const subtotal = quotation.totalAmount || 0;

  const gstCalc = await gstService.calculateGST(
    Number(subtotal),
    12, // Default rate
    COMPANY_STATE_ID,
    placeOfSupplyId
  );

  return await this.prisma.quotations.update({
    where: { id: quotationId },
    data: {
      placeOfSupplyId,
      estimatedCGST: gstCalc.cgst,
      estimatedSGST: gstCalc.sgst,
      estimatedIGST: gstCalc.igst,
      taxRate: 12,
      totalWithTax: Number(subtotal) + gstCalc.totalTax,
    }
  });
}
```

---

## Phase 3: Backend API Routes

### 3.1 Location Routes

**File**: `backend/src/routes/location.routes.ts`

```typescript
import express from 'express';
import { locationService } from '../services/location.service';

const router = express.Router();

// GET /api/locations/states - All states
router.get('/states', async (req, res) => {
  const states = await locationService.getAllStates(true);
  res.json(states);
});

// GET /api/locations/states/:stateCode - State by code
router.get('/states/:stateCode', async (req, res) => {
  const state = await locationService.getStateByCode(req.params.stateCode);
  res.json(state);
});

// GET /api/locations/cities?stateId=xxx - Cities by state
router.get('/cities', async (req, res) => {
  const { stateId, search } = req.query;

  if (search) {
    const cities = await locationService.searchCities(search, stateId);
    return res.json(cities);
  }

  if (stateId) {
    const cities = await locationService.getCitiesByState(stateId);
    return res.json(cities);
  }

  res.status(400).json({ error: 'stateId or search parameter required' });
});

export default router;
```

### 3.2 GST Routes

**File**: `backend/src/routes/gst.routes.ts`

```typescript
import express from 'express';
import { gstService } from '../services/gst.service';
import { z } from 'zod';

const router = express.Router();

// POST /api/gst/validate - Validate GST number
router.post('/validate', async (req, res) => {
  const { gstNumber, stateCode } = req.body;
  const isValid = gstService.validateGSTNumber(gstNumber, stateCode);
  res.json({ isValid });
});

// POST /api/gst/calculate - Calculate GST breakdown
router.post('/calculate', async (req, res) => {
  const { amount, rate, supplierStateId, customerStateId } = req.body;

  const calculation = await gstService.calculateGST(
    Number(amount),
    Number(rate),
    supplierStateId,
    customerStateId
  );

  res.json(calculation);
});

export default router;
```

### 3.3 Register Routes

**File**: `backend/src/routes/index.ts`

Add after existing route registrations:

```typescript
import locationRoutes from './location.routes';
import gstRoutes from './gst.routes';

// ... existing routes

router.use('/locations', locationRoutes);
router.use('/gst', gstRoutes);
```

---

## Phase 4: Frontend Components

### 4.1 StateSelector Component

**File**: `frontend/src/components/StateSelector.tsx`

```tsx
interface StateSelectorProps {
  value: string;
  onChange: (stateId: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export function StateSelector({ value, onChange, label, required, disabled, error }: StateSelectorProps) {
  const [states, setStates] = useState<State[]>([]);

  useEffect(() => {
    fetch('/api/locations/states')
      .then(res => res.json())
      .then(setStates);
  }, []);

  return (
    <div>
      <Label>{label || 'State'} {required && '*'}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Select state" />
        </SelectTrigger>
        <SelectContent>
          {states.map(state => (
            <SelectItem key={state.id} value={state.id}>
              {state.stateName} ({state.stateCode})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
```

### 4.2 CitySelector Component

**File**: `frontend/src/components/CitySelector.tsx`

```tsx
interface CitySelectorProps {
  stateId: string;
  value: string;
  onChange: (cityId: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export function CitySelector({ stateId, value, onChange, label, required, disabled, error }: CitySelectorProps) {
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    if (!stateId) {
      setCities([]);
      return;
    }

    fetch(`/api/locations/cities?stateId=${stateId}`)
      .then(res => res.json())
      .then(setCities);
  }, [stateId]);

  // Auto-clear value when state changes
  useEffect(() => {
    if (value && !cities.find(c => c.id === value)) {
      onChange('');
    }
  }, [cities]);

  return (
    <div>
      <Label>{label || 'City'} {required && '*'}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled || !stateId}>
        <SelectTrigger>
          <SelectValue placeholder={stateId ? "Select city" : "Select state first"} />
        </SelectTrigger>
        <SelectContent>
          {cities.map(city => (
            <SelectItem key={city.id} value={city.id}>
              {city.cityName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
```

### 4.3 GSTNumberInput Component

**File**: `frontend/src/components/GSTNumberInput.tsx`

```tsx
interface GSTNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  stateCode: string;
  onValidationChange?: (isValid: boolean) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

export function GSTNumberInput({
  value,
  onChange,
  stateCode,
  onValidationChange,
  label,
  required,
  error
}: GSTNumberInputProps) {
  const [validationError, setValidationError] = useState<string>('');

  const validateGST = async (gstNumber: string) => {
    if (!gstNumber || gstNumber.length !== 15) return;

    const response = await fetch('/api/gst/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gstNumber, stateCode })
    });

    const { isValid } = await response.json();

    if (!isValid) {
      setValidationError(`GST number does not match state code ${stateCode}`);
      onValidationChange?.(false);
    } else {
      setValidationError('');
      onValidationChange?.(true);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => validateGST(value), 500);
    return () => clearTimeout(timer);
  }, [value, stateCode]);

  return (
    <div>
      <Label>{label || 'GST Number'} {required && '*'}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="27AAAAA0000A1Z5"
        maxLength={15}
      />
      <p className="text-xs text-gray-500 mt-1">
        Format: 15 characters (e.g., 27AAAAA0000A1Z5)
      </p>
      {validationError && <p className="text-sm text-red-500">{validationError}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
```

### 4.4 TaxBreakdown Component

**File**: `frontend/src/components/TaxBreakdown.tsx`

```tsx
interface TaxBreakdownProps {
  isInterstate: boolean;
  cgst: number;
  sgst: number;
  igst: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
}

export function TaxBreakdown({ isInterstate, cgst, sgst, igst, cgstRate, sgstRate, igstRate }: TaxBreakdownProps) {
  const totalTax = isInterstate ? igst : (cgst + sgst);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Tax Breakdown
          {isInterstate ? (
            <Badge variant="secondary">Inter-state (IGST)</Badge>
          ) : (
            <Badge variant="secondary">Intra-state (CGST + SGST)</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isInterstate ? (
          <div className="flex justify-between">
            <span>IGST {igstRate ? `@ ${igstRate}%` : ''}</span>
            <span className="font-semibold">₹{igst.toFixed(2)}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between">
              <span>CGST {cgstRate ? `@ ${cgstRate}%` : ''}</span>
              <span className="font-semibold">₹{cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>SGST {sgstRate ? `@ ${sgstRate}%` : ''}</span>
              <span className="font-semibold">₹{sgst.toFixed(2)}</span>
            </div>
          </>
        )}
        <Separator />
        <div className="flex justify-between text-lg font-bold">
          <span>Total Tax:</span>
          <span>₹{totalTax.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 4.5 Frontend Type Definitions

**File**: `frontend/src/types/location.types.ts`

```typescript
export interface State {
  id: string;
  stateName: string;
  stateCode: string;
  stateType: 'STATE' | 'UNION_TERRITORY';
  isActive: boolean;
}

export interface City {
  id: string;
  stateId: string;
  cityName: string;
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3';
  isActive: boolean;
}
```

**File**: `frontend/src/types/gst.types.ts`

```typescript
export interface GSTCalculation {
  cgst: number;
  sgst: number;
  igst: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  totalTax: number;
  isInterstate: boolean;
}
```

**Update**: `frontend/src/types/customer.types.ts`

```typescript
export interface Customer {
  // ... existing fields
  billingStateId?: string;
  billingCityId?: string;
  billingPincode?: string;
  shippingStateId?: string;
  shippingCityId?: string;
  shippingPincode?: string;

  // Relations (camelCase due to serializer)
  billingState?: State;
  billingCity?: City;
  shippingState?: State;
  shippingCity?: City;
}

export interface GstNumberInput {
  stateId?: string; // Add optional stateId
  stateName: string;
  stateCode: string;
  gstNumber: string;
  billingAddress?: string;
  isPrimary?: boolean;
}
```

**Update**: `frontend/src/types/invoice.types.ts`

```typescript
export interface Invoice {
  // ... existing fields
  placeOfSupplyId?: string;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  isInterstate: boolean;

  // Relations
  placeOfSupply?: State;
}
```

**Update**: `frontend/src/types/quotation.types.ts`

```typescript
export interface Quotation {
  // ... existing fields
  placeOfSupplyId?: string;
  estimatedCGST: number;
  estimatedSGST: number;
  estimatedIGST: number;
  taxRate?: number;
  totalWithTax?: number;

  // Relations
  placeOfSupply?: State;
}
```

---

## Phase 5: Form Integrations

### 5.1 CustomerForm.tsx Updates

**File**: `frontend/src/pages/CustomerForm.tsx`

**Import new components**:
```typescript
import { StateSelector } from '@/components/StateSelector';
import { CitySelector } from '@/components/CitySelector';
import { GSTNumberInput } from '@/components/GSTNumberInput';
```

**Add state/city fields to form schema**:
```typescript
const customerFormSchema = z.object({
  // ... existing fields
  billingStateId: z.string().optional(),
  billingCityId: z.string().optional(),
  billingPincode: validators.pincode,
  shippingStateId: z.string().optional(),
  shippingCityId: z.string().optional(),
  shippingPincode: validators.pincode,
});
```

**Update Billing Address section** (around line 300):
```tsx
<Card>
  <CardHeader>
    <CardTitle>Billing Address</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <Textarea
      {...register('billingAddress')}
      placeholder="Street Address, Building Name, Floor"
      rows={2}
    />

    <div className="grid grid-cols-2 gap-4">
      <StateSelector
        value={watch('billingStateId') || ''}
        onChange={(id) => setValue('billingStateId', id)}
        label="State"
        required
      />
      <CitySelector
        stateId={watch('billingStateId') || ''}
        value={watch('billingCityId') || ''}
        onChange={(id) => setValue('billingCityId', id)}
        label="City"
        required
      />
    </div>

    <Input
      {...register('billingPincode')}
      placeholder="Pincode (6 digits)"
      maxLength={6}
    />
  </CardContent>
</Card>
```

**Update Shipping Address section** (similar structure):
```tsx
<Card>
  <CardHeader>
    <CardTitle>Shipping Address</CardTitle>
    <div className="flex items-center space-x-2">
      <Switch
        checked={sameAsBilling}
        onCheckedChange={(checked) => {
          setSameAsBilling(checked);
          if (checked) copyBillingToShipping();
        }}
      />
      <Label>Same as Billing Address</Label>
    </div>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Same structure as billing address */}
  </CardContent>
</Card>
```

**Update GST Numbers section** (around line 400):
```tsx
{gstNumbers.map((gst, index) => (
  <Card key={index}>
    <CardContent className="space-y-4 pt-6">
      <StateSelector
        value={gst.stateId || ''}
        onChange={(id) => handleGSTStateChange(index, id)}
        label="GST Registration State"
        required
      />

      <GSTNumberInput
        value={gst.gstNumber}
        onChange={(val) => updateGSTNumber(index, 'gstNumber', val)}
        stateCode={gst.stateCode}
        onValidationChange={(valid) => setGSTValid(index, valid)}
        required
      />

      <Textarea
        value={gst.billingAddress}
        onChange={(e) => updateGSTNumber(index, 'billingAddress', e.target.value)}
        placeholder="Registered office address for this GSTIN"
        rows={2}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Switch
            checked={gst.isPrimary}
            onCheckedChange={(checked) => updateGSTNumber(index, 'isPrimary', checked)}
          />
          <Label>Primary GSTIN</Label>
        </div>

        {index > 0 && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => removeGSTNumber(index)}
          >
            Remove
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
))}
```

**Add helper function for state change**:
```typescript
const handleGSTStateChange = async (index: number, stateId: string) => {
  // Fetch state details
  const response = await fetch(`/api/locations/states/${stateId}`);
  const state = await response.json();

  // Update GST number entry
  const updated = [...gstNumbers];
  updated[index] = {
    ...updated[index],
    stateId,
    stateName: state.stateName,
    stateCode: state.stateCode,
  };
  setGstNumbers(updated);
};
```

### 5.2 InvoiceForm.tsx Updates

**File**: `frontend/src/pages/InvoiceForm.tsx`

**Import components**:
```typescript
import { StateSelector } from '@/components/StateSelector';
import { TaxBreakdown } from '@/components/TaxBreakdown';
import type { GSTCalculation } from '@/types/gst.types';
```

**Add state for GST calculation**:
```typescript
const [gstBreakdown, setGstBreakdown] = useState<GSTCalculation | null>(null);
const [placeOfSupplyId, setPlaceOfSupplyId] = useState<string>('');
```

**Add auto-calculation effect**:
```typescript
useEffect(() => {
  if (customerId && subtotal && placeOfSupplyId) {
    calculateGSTBreakdown();
  }
}, [customerId, subtotal, placeOfSupplyId]);

const calculateGSTBreakdown = async () => {
  const customer = customers.find(c => c.id === customerId);
  if (!customer?.billingStateId) return;

  const COMPANY_STATE_ID = 'your-company-state-id'; // Get from config or env

  const response = await fetch('/api/gst/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: parseFloat(subtotal),
      rate: 12, // Default or from order
      supplierStateId: COMPANY_STATE_ID,
      customerStateId: placeOfSupplyId || customer.billingStateId
    })
  });

  const calc = await response.json();
  setGstBreakdown(calc);
  setValue('taxAmount', calc.totalTax.toFixed(2));
};
```

**Add Tax Details section** (after existing fields):
```tsx
<Card>
  <CardHeader>
    <CardTitle>Tax Details</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <StateSelector
      value={placeOfSupplyId}
      onChange={(id) => {
        setPlaceOfSupplyId(id);
        calculateGSTBreakdown();
      }}
      label="Place of Supply"
      required
    />

    {gstBreakdown && (
      <TaxBreakdown
        isInterstate={gstBreakdown.isInterstate}
        cgst={gstBreakdown.cgst}
        sgst={gstBreakdown.sgst}
        igst={gstBreakdown.igst}
        cgstRate={gstBreakdown.cgstRate}
        sgstRate={gstBreakdown.sgstRate}
        igstRate={gstBreakdown.igstRate}
      />
    )}

    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center">
        <span className="font-medium">Subtotal:</span>
        <span className="text-lg">₹{parseFloat(subtotal || '0').toFixed(2)}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="font-medium">Tax:</span>
        <span className="text-lg">₹{parseFloat(taxAmount || '0').toFixed(2)}</span>
      </div>
      <Separator className="my-2" />
      <div className="flex justify-between items-center">
        <span className="text-lg font-bold">Total Amount:</span>
        <span className="text-xl font-bold text-green-700">
          ₹{totalAmount.toFixed(2)}
        </span>
      </div>
    </div>
  </CardContent>
</Card>
```

**Update submit handler** to include GST data:
```typescript
const onSubmit = async (data: InvoiceFormData) => {
  const invoiceData = {
    ...data,
    placeOfSupplyId,
    cgstAmount: gstBreakdown?.cgst || 0,
    sgstAmount: gstBreakdown?.sgst || 0,
    igstAmount: gstBreakdown?.igst || 0,
    cgstRate: gstBreakdown?.cgstRate,
    sgstRate: gstBreakdown?.sgstRate,
    igstRate: gstBreakdown?.igstRate,
    isInterstate: gstBreakdown?.isInterstate || false,
  };

  // ... rest of submit logic
};
```

### 5.3 QuotationForm.tsx Updates

**File**: `frontend/src/pages/QuotationForm.tsx`

**Import components**:
```typescript
import { StateSelector } from '@/components/StateSelector';
import { TaxBreakdown } from '@/components/TaxBreakdown';
import type { GSTCalculation } from '@/types/gst.types';
```

**Add state**:
```typescript
const [placeOfSupplyId, setPlaceOfSupplyId] = useState<string>('');
const [taxEstimate, setTaxEstimate] = useState<GSTCalculation | null>(null);
```

**Add Tax Estimation section** (after items section):
```tsx
<Card>
  <CardHeader>
    <CardTitle>Tax Estimation (Optional)</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <StateSelector
      value={placeOfSupplyId}
      onChange={setPlaceOfSupplyId}
      label="Expected Delivery State"
    />

    <Button
      type="button"
      onClick={estimateTax}
      variant="outline"
      disabled={!placeOfSupplyId || quotationItems.length === 0}
    >
      Calculate Tax Estimate
    </Button>

    {taxEstimate && (
      <>
        <TaxBreakdown
          isInterstate={taxEstimate.isInterstate}
          cgst={taxEstimate.cgst}
          sgst={taxEstimate.sgst}
          igst={taxEstimate.igst}
          cgstRate={taxEstimate.cgstRate}
          sgstRate={taxEstimate.sgstRate}
          igstRate={taxEstimate.igstRate}
        />

        <div className="p-4 bg-green-50 rounded-lg">
          <div className="flex justify-between">
            <span className="font-medium">Quotation Subtotal:</span>
            <span className="text-lg">₹{calculateSubtotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Estimated Tax:</span>
            <span className="text-lg">₹{taxEstimate.totalTax.toFixed(2)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between">
            <span className="text-lg font-bold">Total (with tax):</span>
            <span className="text-xl font-bold text-green-700">
              ₹{(calculateSubtotal() + taxEstimate.totalTax).toFixed(2)}
            </span>
          </div>
        </div>
      </>
    )}
  </CardContent>
</Card>
```

**Add estimation function**:
```typescript
const estimateTax = async () => {
  if (!placeOfSupplyId || !customerId) return;

  const customer = customers.find(c => c.id === customerId);
  const COMPANY_STATE_ID = 'your-company-state-id';

  const response = await fetch('/api/gst/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: calculateSubtotal(),
      rate: 12,
      supplierStateId: COMPANY_STATE_ID,
      customerStateId: placeOfSupplyId
    })
  });

  const calc = await response.json();
  setTaxEstimate(calc);
};
```

---

## Phase 6: Data Migration

### 6.1 Backfill GST Numbers with State IDs

**File**: `backend/scripts/backfill-gst-states.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillGSTStates() {
  const gstNumbers = await prisma.customer_gst_numbers.findMany({
    where: { stateId: null }
  });

  console.log(`Found ${gstNumbers.length} GST numbers without stateId`);

  for (const gst of gstNumbers) {
    const state = await prisma.indian_states.findUnique({
      where: { stateCode: gst.stateCode }
    });

    if (state) {
      await prisma.customer_gst_numbers.update({
        where: { id: gst.id },
        data: { stateId: state.id }
      });
      console.log(`Updated GST ${gst.gstNumber} with state ${state.stateName}`);
    } else {
      console.warn(`No state found for code ${gst.stateCode} (GST: ${gst.gstNumber})`);
    }
  }

  console.log('Backfill complete');
}

backfillGSTStates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run: `npx ts-node backend/scripts/backfill-gst-states.ts`

---

## Phase 7: Environment Configuration

### 7.1 Add Company State to .env

**File**: `backend/.env`

Add:
```
COMPANY_STATE_ID=<your-company-registered-state-id>
```

Get the ID after running state seeds, for example if your company is in Maharashtra:
```sql
SELECT id FROM indian_states WHERE stateCode = '27';
```

---

## Implementation Sequence

### Week 1: Database & Backend Foundation
1. ✅ Update `schema.prisma` with new models and modifications
2. ✅ Generate migration: `npx prisma migrate dev --name add_indian_states_cities_gst_compliance`
3. ✅ Create `indian-states.seed.ts` with all 36 states/UTs
4. ✅ Create `indian-cities.seed.ts` with ~250-300 major cities
5. ✅ Run seed scripts
6. ✅ Implement `gst.service.ts`
7. ✅ Implement `location.service.ts`
8. ✅ Create `location.routes.ts` and `gst.routes.ts`
9. ✅ Register routes in `index.ts`
10. ✅ Test endpoints with Thunder Client/Postman

### Week 2: Backend Service Updates
11. ✅ Update `customer.service.ts` with GST validation
12. ✅ Update `invoice.service.ts` with auto-calculation
13. ✅ Update `quotation.service.ts` with tax estimation
14. ✅ Run backfill script for existing GST numbers
15. ✅ Add `COMPANY_STATE_ID` to `.env`
16. ✅ Write unit tests for `gst.service.ts`

### Week 3: Frontend Components
17. ✅ Create `StateSelector.tsx`
18. ✅ Create `CitySelector.tsx`
19. ✅ Create `GSTNumberInput.tsx`
20. ✅ Create `TaxBreakdown.tsx`
21. ✅ Add type definitions (`location.types.ts`, `gst.types.ts`)
22. ✅ Update existing types (customer, invoice, quotation)
23. ✅ Test components in isolation

### Week 4: Form Integrations
24. ✅ Update `CustomerForm.tsx` - billing/shipping address sections
25. ✅ Update `CustomerForm.tsx` - GST numbers section
26. ✅ Update `InvoiceForm.tsx` - tax calculation and breakdown
27. ✅ Update `QuotationForm.tsx` - tax estimation
28. ✅ Add form validation for new fields
29. ✅ Test full customer creation workflow

### Week 5: Testing & Validation
30. ✅ Integration testing (customer → invoice → GST calculation)
31. ✅ Test inter-state vs intra-state scenarios
32. ✅ Test GST validation with various state codes
33. ✅ Verify serialization (snake_case → camelCase)
34. ✅ User acceptance testing
35. ✅ Performance testing for city/state dropdowns

### Week 6: Deployment
36. ✅ Run migrations on production database
37. ✅ Run seed scripts on production
38. ✅ Run backfill script for existing data
39. ✅ Deploy backend changes
40. ✅ Deploy frontend changes
41. ✅ Monitor for errors
42. ✅ User training on new features

---

## Critical Files Summary

### Must Modify (Existing Files):
1. `backend/prisma/schema.prisma` - Add models and update existing ones
2. `backend/src/services/customer.service.ts` - GST validation
3. `backend/src/services/invoice.service.ts` - Auto-calculate GST
4. `backend/src/routes/index.ts` - Register new routes
5. `frontend/src/pages/CustomerForm.tsx` - Address and GST sections
6. `frontend/src/pages/InvoiceForm.tsx` - Tax calculation
7. `frontend/src/pages/QuotationForm.tsx` - Tax estimation
8. `frontend/src/types/customer.types.ts` - Add address fields
9. `frontend/src/types/invoice.types.ts` - Add GST fields
10. `frontend/src/types/quotation.types.ts` - Add tax fields

### Must Create (New Files):
1. `backend/prisma/seeds/indian-states.seed.ts` - States seed data
2. `backend/prisma/seeds/indian-cities.seed.ts` - Cities seed data
3. `backend/src/services/gst.service.ts` - GST logic
4. `backend/src/services/location.service.ts` - Location CRUD
5. `backend/src/routes/location.routes.ts` - Location endpoints
6. `backend/src/routes/gst.routes.ts` - GST endpoints
7. `backend/scripts/backfill-gst-states.ts` - Migration script
8. `frontend/src/components/StateSelector.tsx` - State dropdown
9. `frontend/src/components/CitySelector.tsx` - City dropdown
10. `frontend/src/components/GSTNumberInput.tsx` - GST input with validation
11. `frontend/src/components/TaxBreakdown.tsx` - Tax display
12. `frontend/src/types/location.types.ts` - Location types
13. `frontend/src/types/gst.types.ts` - GST types

---

## Validation Rules

### GST Number
- **Format**: 15 alphanumeric characters
- **Pattern**: `\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}`
- **State Code**: First 2 digits must match selected state's GST code
- **Example**: `27AAAAA0000A1Z5` (Maharashtra - state code 27)

### Tax Calculation
- **Intra-state** (same billing state): CGST + SGST (split equally)
  - Example: 18% total → CGST 9% + SGST 9%
- **Inter-state** (different states): IGST (full rate)
  - Example: 18% total → IGST 18%
- **Default Rate**: 12% for garments (HSN codes 61, 62, 63)
- **Precision**: 2 decimal places for all amounts

### Address Fields
- **Billing State**: Required
- **Billing City**: Required
- **Pincode**: Required, 6 digits, numeric only
- **Shipping fields**: Optional (can copy from billing)

### State/City Data
- **States**: 36 total (28 states + 8 UTs)
- **Cities**: ~250-300 major cities (5-10 per state)
- **Focus**: Garment manufacturing hubs (Tiruppur, Ludhiana, Surat, etc.)

---

## Testing Checklist

- [ ] Create customer with multiple GST numbers (different states)
- [ ] Validate GST number with correct state code
- [ ] Validate GST number with incorrect state code (should fail)
- [ ] Create invoice for intra-state customer (verify CGST+SGST)
- [ ] Create invoice for inter-state customer (verify IGST)
- [ ] Create quotation with tax estimation
- [ ] Test city dropdown auto-clears when state changes
- [ ] Verify all serialized responses use camelCase
- [ ] Test with legacy customers (no state/city data)
- [ ] Performance test: Load 300 cities in dropdown

---

## Notes

1. **Backward Compatibility**: Keep existing text fields (`billingAddress`, `stateName`, `stateCode`) for backward compatibility. New structured fields are optional initially.

2. **Migration Strategy**: Existing customers continue to work. New customers must use structured state/city fields. Gradually migrate existing data using admin tools.

3. **Company State Configuration**: Store your company's registered state ID in `.env` for GST calculations. This is used to determine intra-state vs inter-state.

4. **Default Tax Rate**: Currently hardcoded to 12% for garments. Future enhancement: lookup from `tax_masters` table by HSN code and date.

5. **Serialization**: Remember that API responses convert `indian_states` → `indianStates`, `customer_gst_numbers` → `customerGstNumbers`, etc.

6. **GST Validation**: Real-time validation on frontend, backend validation on submit. Prevents invalid GST numbers from being saved.

7. **City Data Focus**: Prioritize tier 1 & 2 cities and major garment manufacturing hubs over comprehensive coverage.

---

## End of Plan
