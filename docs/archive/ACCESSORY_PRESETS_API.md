# Customer Accessory Presets API Reference

## Overview

Customer Accessory Presets allow you to define standard sets of accessories (labels, packaging, etc.) for customers. These presets can be applied when creating styles to automatically populate accessory items.

## API Endpoints

### Base URL
```
/api/customers/:customerId/accessory-presets
```

---

## GET All Presets

Get all accessory presets for a customer.

**Endpoint:** `GET /api/customers/:customerId/accessory-presets`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "customerId": "customer-uuid",
      "presetName": "Standard Export Package",
      "description": "Standard accessories for export orders",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z",
      "items": [
        {
          "id": "item-uuid",
          "presetId": "preset-uuid",
          "materialType": "LABEL",
          "materialId": "label-uuid",
          "quantity": "2.000",
          "usageCategory": "PACKAGING",
          "sortOrder": 0,
          "createdAt": "2025-01-15T10:00:00Z",
          "updatedAt": "2025-01-15T10:00:00Z"
        }
      ]
    }
  ],
  "total": 1
}
```

---

## GET Single Preset

Get a specific preset by ID.

**Endpoint:** `GET /api/customers/:customerId/accessory-presets/:presetId`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "presetName": "Premium Package",
    "items": [...]
  }
}
```

---

## GET Default Preset

Get the default preset for a customer.

**Endpoint:** `GET /api/customers/:customerId/accessory-presets/default`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "presetName": "Standard Package",
    "isDefault": true,
    "items": [...]
  }
}
```

---

## POST Create Preset

Create a new accessory preset.

**Endpoint:** `POST /api/customers/:customerId/accessory-presets`

**Request Body:**
```json
{
  "presetName": "Standard Export Package",
  "description": "Standard accessories for export orders",
  "items": [
    {
      "materialType": "LABEL",
      "materialId": "label-uuid-123",
      "quantity": 2,
      "usageCategory": "PACKAGING",
      "sortOrder": 0
    },
    {
      "materialType": "POLY_BAG",
      "materialId": "bag-uuid-456",
      "quantity": 1,
      "usageCategory": "PACKAGING",
      "sortOrder": 1
    }
  ],
  "isDefault": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Accessory preset created successfully",
  "data": {
    "id": "new-preset-uuid",
    "presetName": "Standard Export Package",
    "items": [...]
  }
}
```

**Validation:**
- `presetName` (required): Must be unique per customer
- `items` (required): Must be a non-empty array
- Each item must have `materialType`, `materialId`, and `quantity`

---

## PUT Update Preset

Update an existing preset.

**Endpoint:** `PUT /api/customers/:customerId/accessory-presets/:presetId`

**Request Body:**
```json
{
  "presetName": "Updated Preset Name",
  "description": "Updated description",
  "items": [
    {
      "materialType": "LABEL",
      "materialId": "label-uuid",
      "quantity": 3,
      "usageCategory": "PACKAGING",
      "sortOrder": 0
    }
  ]
}
```

**Notes:**
- Providing `items` array will **replace all existing items**
- Omit `items` to keep existing items unchanged
- Only provided fields will be updated

---

## DELETE Delete Preset

Soft delete a preset (sets `isActive = false`).

**Endpoint:** `DELETE /api/customers/:customerId/accessory-presets/:presetId`

**Response:**
```json
{
  "success": true,
  "message": "Accessory preset deleted successfully"
}
```

---

## POST Set Default

Set a preset as the default for a customer.

**Endpoint:** `POST /api/customers/:customerId/accessory-presets/:presetId/set-default`

**Response:**
```json
{
  "success": true,
  "message": "Default preset updated successfully",
  "data": {
    "id": "preset-uuid",
    "isDefault": true,
    "items": [...]
  }
}
```

**Notes:**
- Only one preset can be default per customer
- Setting a new default automatically unsets the previous one

---

## POST Clone Preset

Create a copy of an existing preset.

**Endpoint:** `POST /api/customers/:customerId/accessory-presets/:presetId/clone`

**Request Body:**
```json
{
  "newPresetName": "Copy of Standard Package"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Preset cloned successfully",
  "data": {
    "id": "new-preset-uuid",
    "presetName": "Copy of Standard Package",
    "description": "Copy of: Standard accessories for export orders",
    "isDefault": false,
    "items": [...]
  }
}
```

---

## Material Types

Valid material types for preset items:

- `LABEL` - Labels, tags, stickers
- `POLY_BAG` - Polybags, plastic bags
- `CARTON` - Cartons, boxes
- `HANGER` - Hangers
- `POLY_INNER` - Inner polybags
- `BARCODE` - Barcodes, QR codes
- `PRICE_TAG` - Price tags
- `CARE_LABEL` - Care instruction labels
- `SIZE_LABEL` - Size labels
- `HEADER_CARD` - Header cards
- `STICKER` - Stickers
- `TISSUE_PAPER` - Tissue paper
- And all other `MaterialType` enum values

## Usage Categories

- `PACKAGING` - Packaging materials
- `GARMENT_TRIM` - Garment trims/accessories
- `VALUE_ADDITION` - Value addition items

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Preset name is required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Accessory preset not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "A preset with this name already exists for this customer"
}
```

---

## Frontend Integration

### Using the API

```typescript
import { customerService } from '../services/customer.service';

// Get all presets
const presets = await customerService.getAccessoryPresets(customerId);

// Create new preset
const newPreset = await customerService.createAccessoryPreset(customerId, {
  presetName: "Premium Package",
  items: [
    {
      materialType: "LABEL",
      materialId: "label-123",
      quantity: 2,
      usageCategory: "PACKAGING",
      sortOrder: 0
    }
  ]
});

// Apply to style form
const defaultPreset = await customerService.getDefaultAccessoryPreset(customerId);
if (defaultPreset) {
  applyPresetToAccessories(defaultPreset);
}
```

### Type Definitions

```typescript
interface AccessoryPreset {
  id: string;
  customerId: string;
  presetName: string;
  description?: string;
  items: AccessoryPresetItem[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AccessoryPresetItem {
  id: string;
  materialType: string;
  materialId: string;
  quantity: number;
  usageCategory?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
```

---

## Database Schema

### customer_accessories_presets
```sql
CREATE TABLE customer_accessories_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  preset_name VARCHAR NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(customer_id, preset_name)
);
```

### customer_accessories_preset_items
```sql
CREATE TABLE customer_accessories_preset_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  preset_id UUID NOT NULL REFERENCES customer_accessories_presets(id) ON DELETE CASCADE,
  material_type MaterialType NOT NULL,
  material_id UUID NOT NULL,
  quantity DECIMAL(10, 3) DEFAULT 1,
  usage_category VARCHAR,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_preset_items_preset_id ON customer_accessories_preset_items(preset_id);
CREATE INDEX idx_preset_items_material_id ON customer_accessories_preset_items(material_id);
CREATE INDEX idx_preset_items_material_type ON customer_accessories_preset_items(material_type);
```

---

## Notes

- All responses use **camelCase** for JSON keys (handled by serializer)
- Database uses **snake_case** for column names
- Items are automatically deleted when parent preset is deleted (CASCADE)
- Quantities are stored as DECIMAL(10, 3) for precision
- Items maintain sort order for consistent display
