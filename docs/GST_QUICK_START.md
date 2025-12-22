# GST Implementation - Quick Start Guide

## 1. Setup (5 minutes)

### Step 1: Set Company State ID

Find your company's state ID from the database:

```bash
# Start your backend server
cd backend
npm run dev

# In another terminal, query for your state
# For Maharashtra (GST code 27):
```

```sql
SELECT id, stateName, stateCode FROM indian_states WHERE stateCode = '27';
```

Copy the `id` value and update `backend/.env`:

```env
COMPANY_STATE_ID="<paste-your-state-id-here>"
```

### Step 2: Restart Backend

```bash
# Restart the backend to load the new environment variable
# Stop the current process (Ctrl+C) and restart:
npm run dev
```

### Step 3: Verify Seeds are Loaded

```bash
# Check states count (should be 36)
curl http://localhost:5000/api/locations/states | jq '. | length'

# Check cities count (should be 133)
curl http://localhost:5000/api/locations/cities | jq '. | length'
```

If counts are 0, run the seed command:

```bash
cd backend
npx prisma db seed
```

## 2. Test GST Validation (2 minutes)

### Valid GST Number
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

### Invalid GST Number (Wrong State Code)
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

## 3. Test GST Calculation (2 minutes)

You'll need two state IDs for this test. Get them first:

```bash
# Get Maharashtra (27) ID
MAHARASHTRA_ID=$(curl -s http://localhost:5000/api/locations/states/code/27 | jq -r '.id')

# Get Gujarat (24) ID
GUJARAT_ID=$(curl -s http://localhost:5000/api/locations/states/code/24 | jq -r '.id')

echo "Maharashtra ID: $MAHARASHTRA_ID"
echo "Gujarat ID: $GUJARAT_ID"
```

### Intrastate Transaction (Same State = CGST + SGST)
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

### Interstate Transaction (Different States = IGST)
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

## 4. Test Frontend Components (5 minutes)

### Step 1: Start Frontend
```bash
cd frontend
npm run dev
```

### Step 2: Test StateSelector Component

Create a test page: `frontend/src/pages/TestGST.tsx`

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

Add route to `frontend/src/routes/lazy-routes.tsx`:

```tsx
{
  path: '/test-gst',
  element: <TestGST />,
},
```

Visit `http://localhost:5173/test-gst` to test all components.

## 5. Test with Real Customer Creation (10 minutes)

### Step 1: Get Authentication Token

Login to get a JWT token:

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@kashayafabs.com",
    "password": "your-password"
  }' | jq -r '.token')

echo "Token: $TOKEN"
```

### Step 2: Get State IDs

```bash
# Get Maharashtra ID
MAHARASHTRA_ID=$(curl -s http://localhost:5000/api/locations/states/code/27 | jq -r '.id')

# Get Mumbai ID
MUMBAI_ID=$(curl -s "http://localhost:5000/api/locations/cities?search=Mumbai" | jq -r '.[0].id')

# Get Gujarat ID
GUJARAT_ID=$(curl -s http://localhost:5000/api/locations/states/code/24 | jq -r '.id')

# Get Ahmedabad ID
AHMEDABAD_ID=$(curl -s "http://localhost:5000/api/locations/cities?search=Ahmedabad" | jq -r '.[0].id')

echo "Maharashtra: $MAHARASHTRA_ID"
echo "Mumbai: $MUMBAI_ID"
echo "Gujarat: $GUJARAT_ID"
echo "Ahmedabad: $AHMEDABAD_ID"
```

### Step 3: Create Customer with Multiple GST Numbers

```bash
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"code\": \"CUST-B2B-DOM-TEST-001\",
    \"name\": \"Test Garments Pvt Ltd\",
    \"billingName\": \"Test Garments\",
    \"type\": \"BUYER\",
    \"category\": \"DOMESTIC\",
    \"businessType\": \"B2B\",
    \"market\": \"DOMESTIC\",
    \"email\": \"test@testgarments.com\",
    \"phone\": \"+919876543210\",
    \"billingStateId\": \"$MAHARASHTRA_ID\",
    \"billingCityId\": \"$MUMBAI_ID\",
    \"billingPincode\": \"400001\",
    \"billingAddress\": \"123 Fashion Street, Nariman Point\",
    \"shippingStateId\": \"$GUJARAT_ID\",
    \"shippingCityId\": \"$AHMEDABAD_ID\",
    \"shippingPincode\": \"380001\",
    \"shippingAddress\": \"456 Textile Road, CG Road\",
    \"gstNumbers\": [
      {
        \"stateId\": \"$MAHARASHTRA_ID\",
        \"stateName\": \"Maharashtra\",
        \"stateCode\": \"27\",
        \"gstNumber\": \"27AAACT1234E1Z5\",
        \"billingAddress\": \"123 Fashion Street, Mumbai\",
        \"isPrimary\": true
      },
      {
        \"stateId\": \"$GUJARAT_ID\",
        \"stateName\": \"Gujarat\",
        \"stateCode\": \"24\",
        \"gstNumber\": \"24AAACT1234E1Z5\",
        \"billingAddress\": \"456 Textile Road, Ahmedabad\",
        \"isPrimary\": false
      }
    ]
  }" | jq '.'
```

**Expected Response:** Customer object with structured addresses and validated GST numbers.

### Step 4: Verify Customer Data

```bash
# Get the customer ID from the previous response
CUSTOMER_ID="<paste-customer-id-here>"

# Fetch customer details
curl -s http://localhost:5000/api/customers/$CUSTOMER_ID \
  -H "Authorization: Bearer $TOKEN" | jq '{
    name: .name,
    billingState: .billingState.stateName,
    billingCity: .billingCity.cityName,
    shippingState: .shippingState.stateName,
    shippingCity: .shippingCity.cityName,
    gstNumbers: .customerGstNumbers | map({
      state: .state.stateName,
      gstNumber: .gstNumber,
      isPrimary: .isPrimary
    })
  }'
```

## 6. Common Test Scenarios

### Scenario 1: Invalid GST Format
```bash
curl -X POST http://localhost:5000/api/gst/validate \
  -H "Content-Type: application/json" \
  -d '{
    "gstNumber": "INVALID123",
    "stateCode": "27"
  }'
```

Should return: `"isValid": false, "message": "Invalid GST number format"`

### Scenario 2: GST State Code Mismatch
```bash
curl -X POST http://localhost:5000/api/gst/validate \
  -H "Content-Type: application/json" \
  -d '{
    "gstNumber": "27AAACT1234E1Z5",
    "stateCode": "24"
  }'
```

Should return: `"isValid": false, "message": "GST number state code (27) does not match..."`

### Scenario 3: Search Cities by Name
```bash
# Find all cities with "Mumbai" in the name
curl -s "http://localhost:5000/api/locations/cities?search=Mumbai" | jq '.[] | {cityName, stateName: .state.stateName, tier}'

# Find garment manufacturing hubs
curl -s http://localhost:5000/api/locations/cities/hubs | jq '.[] | {cityName, stateName: .state.stateName, isGarmentHub}'
```

### Scenario 4: Filter States by Type
```bash
# Get only Union Territories
curl -s "http://localhost:5000/api/locations/states?stateType=UNION_TERRITORY" | jq '.[] | {stateName, stateCode}'

# Get only States (not UTs)
curl -s "http://localhost:5000/api/locations/states?stateType=STATE" | jq '.[] | {stateName, stateCode}'
```

### Scenario 5: Bulk GST Calculation
```bash
curl -X POST http://localhost:5000/api/gst/calculate-bulk \
  -H "Content-Type: application/json" \
  -d "{
    \"items\": [
      {\"amount\": 5000, \"toStateId\": \"$MAHARASHTRA_ID\"},
      {\"amount\": 3000, \"toStateId\": \"$GUJARAT_ID\"},
      {\"amount\": 2000, \"toStateId\": \"$MAHARASHTRA_ID\"}
    ],
    \"fromStateId\": \"$MAHARASHTRA_ID\",
    \"taxRate\": 12
  }" | jq '.'
```

## 7. Troubleshooting Checklist

### Backend Not Starting?
- [ ] Check `COMPANY_STATE_ID` is set in `.env`
- [ ] Verify database is running: `psql -U postgres -d garment_erp -c "SELECT COUNT(*) FROM indian_states;"`
- [ ] Check for TypeScript errors: `cd backend && npx tsc --noEmit`

### API Returns Empty Arrays?
- [ ] Run seed data: `cd backend && npx prisma db seed`
- [ ] Check database connection in `.env`
- [ ] Verify tables exist: `psql -U postgres -d garment_erp -c "\dt indian_*"`

### GST Validation Not Working?
- [ ] Check GST number is exactly 15 characters
- [ ] Verify state code matches first 2 digits
- [ ] Ensure GST number is uppercase
- [ ] Test with known valid format: `27AAACT1234E1Z5`

### Tax Calculation Shows Zero?
- [ ] Verify `COMPANY_STATE_ID` environment variable is set
- [ ] Check state IDs are valid UUIDs
- [ ] Ensure both `fromStateId` and `toStateId` exist in database
- [ ] Test with curl command above to isolate issue

### Frontend Components Not Loading?
- [ ] Check API endpoints are accessible: `curl http://localhost:5000/api/locations/states`
- [ ] Verify CORS is configured: Check `FRONTEND_URL` in backend `.env`
- [ ] Check browser console for errors
- [ ] Ensure components are imported correctly

## 8. Success Criteria

You've successfully implemented GST features when:

✅ All 36 states are returned from `/api/locations/states`
✅ All 133 cities are returned from `/api/locations/cities`
✅ Valid GST numbers pass validation
✅ Invalid GST numbers fail validation with proper error messages
✅ Intrastate transactions show CGST + SGST (e.g., 6% + 6%)
✅ Interstate transactions show only IGST (e.g., 12%)
✅ Customer can be created with multiple GST registrations
✅ Frontend components load states and cities from API
✅ GST number input validates in real-time
✅ Tax breakdown displays correctly with proper formatting

## 9. Next Steps

Once all tests pass:

1. **Update Forms**: Follow [GST_IMPLEMENTATION_GUIDE.md](./GST_IMPLEMENTATION_GUIDE.md) to integrate components into CustomerForm, InvoiceForm, and QuotationForm

2. **Production Setup**:
   - Set actual `COMPANY_STATE_ID` for your business
   - Update `.env.production` with production database
   - Run migrations: `npx prisma migrate deploy`
   - Run seeds: `npx prisma db seed`

3. **User Training**:
   - Train users on multi-state GST registration
   - Explain intrastate vs interstate tax rules
   - Provide state code reference chart

## 10. Support

If you encounter issues:

1. Check [GST_IMPLEMENTATION_GUIDE.md](./GST_IMPLEMENTATION_GUIDE.md) for detailed documentation
2. Review error logs: `cd backend && npm run dev` (watch console)
3. Test individual components using the test page
4. Verify database schema matches Prisma schema: `npx prisma db pull`

---

**Estimated Total Time**: 20-30 minutes for complete testing

**Result**: Fully functional GST compliance system ready for production use
