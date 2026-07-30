# Season Management Module Guide

> **Complete Guide to Season Master & Seasonal Collections**
> **Last Updated:** February 6, 2026
> **Coverage:** Season Types (SS/AW), Bulk Generation, Style Integration, Year-based Planning

---

## Table of Contents

1. [Overview](#1-overview)
2. [Database Schema](#2-database-schema)
3. [Season Lifecycle](#3-season-lifecycle)
4. [API Reference](#4-api-reference)
5. [Frontend Integration](#5-frontend-integration)
6. [Integration Points](#6-integration-points)
7. [Use Cases](#7-use-cases)
8. [Bulk Season Generation](#8-bulk-season-generation)
9. [Best Practices](#9-best-practices)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview

### 1.1 What is the Season Module?

The Season Module manages garment collections organized by fashion seasons (Spring/Summer and Autumn/Winter). It provides a standardized way to categorize styles, orders, and collections based on seasonal fashion cycles.

### 1.2 Key Concepts

**Season Types:**
- **SS (Spring/Summer):** Lightweight garments for warm weather (March-August)
- **AW (Autumn/Winter):** Heavy garments for cold weather (September-February)

**Season Code Format:**
```
{SeasonType}{Year}
Examples:
  SS26 = Spring/Summer 2026
  AW25 = Autumn/Winter 2025
```

**Use Cases:**
- Organize style collections by season
- Plan production timelines
- Track seasonal trends and performance
- Manage inventory by season
- Filter orders and reports by season

### 1.3 Key Features

- ✅ Standardized season codes (SS/AW + Year)
- ✅ Bulk generation for multi-year planning
- ✅ Year-based filtering and search
- ✅ Integration with styles and orders
- ✅ Sort order for chronological display
- ✅ Active/inactive status management
- ✅ Unique code validation

---

## 2. Database Schema

### 2.1 season_master Table

```prisma
model season_master {
  id         String     @id @default(cuid())
  code       String     @unique          // "SS26", "AW26"
  name       String                      // "Spring/Summer 2026"
  year       Int                         // 2026
  seasonType SeasonType                  // SS or AW
  sortOrder  Int        @default(0)      // Chronological sorting
  isActive   Boolean    @default(true)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  // Relations
  styles     styles[]                    // Styles using this season

  @@index([year, seasonType])            // Performance: filter by year + type
  @@index([isActive])                    // Performance: filter active seasons
  @@index([sortOrder])                   // Performance: chronological sorting
}
```

### 2.2 SeasonType Enum

```prisma
enum SeasonType {
  SS  // Spring/Summer (lightweight fabrics, bright colors)
  AW  // Autumn/Winter (heavy fabrics, dark colors)
}
```

### 2.3 Field Descriptions

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | String | Yes | UUID identifier | "clx1234..." |
| `code` | String | Yes | Unique season code | "SS26" |
| `name` | String | Yes | Display name | "Spring/Summer 2026" |
| `year` | Int | Yes | Calendar year | 2026 |
| `seasonType` | Enum | Yes | SS or AW | SS |
| `sortOrder` | Int | No | Chronological order (auto-generated) | 51 |
| `isActive` | Boolean | No | Active status (default: true) | true |

### 2.4 Unique Constraints

- **code:** Each season code must be unique (prevents duplicate SS26, AW26, etc.)

### 2.5 Indexes

Three indexes for optimal query performance:
1. **Composite (year + seasonType):** Fast filtering by year and season
2. **isActive:** Quick retrieval of active seasons only
3. **sortOrder:** Efficient chronological sorting

---

## 3. Season Lifecycle

### 3.1 Season Creation Workflow

```
1. Manual Creation
   └─> User creates single season
       └─> Validates uniqueness
           └─> Assigns sort order
               └─> Activates season

2. Bulk Generation
   └─> User specifies year range (e.g., 2025-2030)
       └─> System generates SS + AW for each year
           └─> Skips existing seasons (idempotent)
               └─> Returns created vs skipped count
```

### 3.2 Season States

| State | Description | Use Case |
|-------|-------------|----------|
| **Active** | Available for new styles/orders | Current and upcoming seasons |
| **Inactive** | Hidden from dropdowns | Past seasons, archived collections |

### 3.3 Season Usage Flow

```
Season Created (SS26)
    ↓
Used in Style Creation
    ├─> StyleForm sets seasonId
    ├─> Collections organized by season
    └─> Reports filtered by season
    ↓
Used in Order Management
    ├─> Orders reference style's season
    └─> Production planning by season
    ↓
Season Archive (After 2 years)
    └─> Mark isActive = false
        └─> Hidden from dropdowns
            └─> Historical data preserved
```

### 3.4 Sort Order Calculation

**Formula:** `sortOrder = (year - 2000) * 2 + (seasonType === 'SS' ? 0 : 1)`

**Examples:**
- SS2025: (2025 - 2000) * 2 + 0 = **50**
- AW2025: (2025 - 2000) * 2 + 1 = **51**
- SS2026: (2026 - 2000) * 2 + 0 = **52**
- AW2026: (2026 - 2000) * 2 + 1 = **53**

**Purpose:** Enables chronological sorting without date comparisons (SS comes before AW in same year).

---

## 4. API Reference

### Base URL
```
http://localhost:5000/api/seasons
```

### Authentication
All endpoints require JWT authentication:
```http
Authorization: Bearer <token>
```

---

### 4.1 Create Season

**Endpoint:** `POST /api/seasons`

**Request Body:**
```json
{
  "code": "SS26",
  "name": "Spring/Summer 2026",
  "year": 2026,
  "seasonType": "SS",
  "sortOrder": 52,  // Optional (auto-calculated if not provided)
  "isActive": true  // Optional (default: true)
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "clx123...",
    "code": "SS26",
    "name": "Spring/Summer 2026",
    "year": 2026,
    "seasonType": "SS",
    "sortOrder": 52,
    "isActive": true,
    "createdAt": "2026-02-06T10:00:00Z",
    "updatedAt": "2026-02-06T10:00:00Z"
  },
  "message": "Season created successfully"
}
```

**Error Responses:**
- **409 Conflict:** Season code already exists
- **400 Bad Request:** Invalid seasonType (must be SS or AW)
- **500 Internal Server Error:** Database error

---

### 4.2 Get All Seasons (Paginated)

**Endpoint:** `GET /api/seasons`

**Query Parameters:**

| Parameter | Type | Description | Default | Example |
|-----------|------|-------------|---------|---------|
| `page` | Number | Page number | 1 | `?page=2` |
| `limit` | Number | Items per page | 50 | `?limit=20` |
| `search` | String | Search code or name | - | `?search=SS26` |
| `year` | Number | Filter by year | - | `?year=2026` |
| `seasonType` | String | Filter by SS or AW | - | `?seasonType=SS` |
| `isActive` | Boolean | Filter active/inactive | - | `?isActive=true` |
| `sortBy` | String | Sort field | sortOrder | `?sortBy=year` |
| `sortOrder` | String | asc or desc | asc | `?sortOrder=desc` |

**Example Request:**
```http
GET /api/seasons?year=2026&seasonType=SS&isActive=true&page=1&limit=10
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "clx123...",
      "code": "SS26",
      "name": "Spring/Summer 2026",
      "year": 2026,
      "seasonType": "SS",
      "sortOrder": 52,
      "isActive": true,
      "createdAt": "2026-02-06T10:00:00Z",
      "updatedAt": "2026-02-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 4.3 Get Season by ID

**Endpoint:** `GET /api/seasons/:id`

**Response (200 OK):**
```json
{
  "data": {
    "id": "clx123...",
    "code": "SS26",
    "name": "Spring/Summer 2026",
    "year": 2026,
    "seasonType": "SS",
    "sortOrder": 52,
    "isActive": true,
    "createdAt": "2026-02-06T10:00:00Z",
    "updatedAt": "2026-02-06T10:00:00Z",
    "styles": [
      {
        "id": "style1...",
        "styleNumber": "ST-001",
        "name": "Denim Jacket"
      }
    ]
  }
}
```

**Error Responses:**
- **404 Not Found:** Season does not exist

---

### 4.4 Update Season

**Endpoint:** `PUT /api/seasons/:id`

**Request Body (all fields optional):**
```json
{
  "code": "SS26-UPDATED",
  "name": "Spring/Summer 2026 - Updated",
  "year": 2026,
  "seasonType": "SS",
  "sortOrder": 53,
  "isActive": false
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "clx123...",
    "code": "SS26-UPDATED",
    "name": "Spring/Summer 2026 - Updated",
    "year": 2026,
    "seasonType": "SS",
    "sortOrder": 53,
    "isActive": false,
    "createdAt": "2026-02-06T10:00:00Z",
    "updatedAt": "2026-02-06T11:30:00Z"
  },
  "message": "Season updated successfully"
}
```

**Error Responses:**
- **404 Not Found:** Season does not exist
- **409 Conflict:** Updated code conflicts with existing season

---

### 4.5 Delete Season (Soft Delete)

**Endpoint:** `DELETE /api/seasons/:id`

**Response (200 OK):**
```json
{
  "message": "Season deleted successfully"
}
```

**Note:** This is a soft delete (sets `isActive = false`). To permanently delete, use database operations.

**Error Responses:**
- **404 Not Found:** Season does not exist

---

### 4.6 Search Seasons (Dropdown)

**Endpoint:** `GET /api/seasons/search`

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `search` | String | Search code or name | `?search=SS` |
| `year` | Number | Filter by year | `?year=2026` |
| `seasonType` | String | Filter by SS or AW | `?seasonType=SS` |
| `limit` | Number | Max results | `?limit=20` (default: 50) |

**Example Request:**
```http
GET /api/seasons/search?search=2026&limit=10
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "clx123...",
      "code": "SS26",
      "name": "Spring/Summer 2026",
      "year": 2026,
      "seasonType": "SS"
    },
    {
      "id": "clx456...",
      "code": "AW26",
      "name": "Autumn/Winter 2026",
      "year": 2026,
      "seasonType": "AW"
    }
  ]
}
```

**Purpose:** Lightweight endpoint for dropdowns (returns minimal data, no pagination).

---

### 4.7 Get Season Types

**Endpoint:** `GET /api/seasons/types`

**Response (200 OK):**
```json
{
  "data": [
    {
      "code": "SS",
      "name": "Spring/Summer"
    },
    {
      "code": "AW",
      "name": "Autumn/Winter"
    }
  ]
}
```

**Purpose:** Get available season types for forms and filters.

---

### 4.8 Generate Seasons (Bulk)

**Endpoint:** `POST /api/seasons/generate`

**Request Body:**
```json
{
  "startYear": 2025,
  "endYear": 2030,
  "seasonTypes": ["SS", "AW"]  // Optional (default: both)
}
```

**Response (200 OK):**
```json
{
  "data": {
    "created": 10,
    "skipped": 2,
    "seasons": [
      {
        "id": "clx789...",
        "code": "SS25",
        "name": "Spring/Summer 2025",
        "year": 2025,
        "seasonType": "SS",
        "sortOrder": 50,
        "isActive": true,
        "createdAt": "2026-02-06T10:00:00Z",
        "updatedAt": "2026-02-06T10:00:00Z"
      }
      // ... 9 more seasons
    ]
  },
  "message": "Generated 10 seasons, skipped 2 existing"
}
```

**Validation:**
- `startYear` and `endYear` are required
- `startYear` must be ≤ `endYear`
- Year range cannot exceed 20 years (prevents accidental bulk creation)

**Behavior:**
- Generates both SS and AW for each year (unless `seasonTypes` specified)
- Skips existing seasons (idempotent - safe to re-run)
- Auto-calculates sort order
- All generated seasons are active by default

**Example Use Cases:**
- Initial setup: Generate seasons for next 5 years
- Annual planning: Generate next year's seasons
- Historical data: Generate past seasons for data migration

---

## 5. Frontend Integration

### 5.1 Season Selector Component

**Location:** `frontend/src/components/SeasonSelector.tsx`

**Usage:**
```tsx
import { SeasonSelector } from '@/components/SeasonSelector';

function StyleForm() {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');

  return (
    <SeasonSelector
      value={selectedSeasonId}
      onChange={setSelectedSeasonId}
      year={2026}              // Optional: filter by year
      seasonType="SS"          // Optional: filter by type
      includeInactive={false}  // Optional: show inactive seasons
    />
  );
}
```

**Features:**
- Autocomplete search by code or name
- Filter by year and season type
- Display format: "SS26 - Spring/Summer 2026"
- Shows only active seasons by default

---

### 5.2 Season Master List Page

**Location:** `frontend/src/pages/SeasonMasterList.tsx`

**Features:**
- Paginated table view
- Search by code or name
- Filter by year, season type, active status
- Sort by year, season type, sort order
- Quick actions: Edit, Delete, Toggle Active

**Table Columns:**
| Column | Data | Sortable | Filterable |
|--------|------|----------|------------|
| Code | SS26, AW25 | Yes | Yes (search) |
| Name | Spring/Summer 2026 | No | Yes (search) |
| Year | 2026 | Yes | Yes (dropdown) |
| Type | SS, AW | Yes | Yes (dropdown) |
| Status | Active/Inactive | No | Yes (toggle) |
| Actions | Edit, Delete | - | - |

---

### 5.3 Season Master Form Page

**Location:** `frontend/src/pages/SeasonMasterForm.tsx`

**Form Fields:**
1. **Season Code** (Text Input, Required)
   - Format: SS26, AW25
   - Validation: Unique, 4-6 characters

2. **Season Name** (Text Input, Required)
   - Example: "Spring/Summer 2026"

3. **Year** (Number Input, Required)
   - Range: 2020-2050

4. **Season Type** (Dropdown, Required)
   - Options: Spring/Summer (SS), Autumn/Winter (AW)

5. **Sort Order** (Number Input, Optional)
   - Auto-calculated if not provided

6. **Active Status** (Checkbox, Default: true)

**Validation:**
- Code must be unique
- Year must be valid (2020-2050)
- Season type must be SS or AW

---

## 6. Integration Points

### 6.1 Style Management Integration

**Purpose:** Categorize styles by season

**Database Relation:**
```prisma
model styles {
  seasonId    String?
  seasonMaster season_master? @relation(fields: [seasonId], references: [id])
}
```

**Usage:**
- Style form includes season selector
- Collections grouped by season
- Reports filtered by season

**Example:**
```typescript
const style = {
  styleNumber: "ST-001",
  name: "Denim Jacket",
  seasonId: "clx123...",  // Links to SS26
  // ... other fields
};
```

---

### 6.2 Order Management Integration

**Purpose:** Track orders by season (via style's season)

**Data Flow:**
```
Order → Style → Season
```

**Queries:**
- "Show all orders for SS26"
- "Revenue by season"
- "Production capacity by season"

**Example Report:**
```typescript
// Get orders for SS26 season
const orders = await prisma.orders.findMany({
  where: {
    items: {
      some: {
        style: {
          season: {
            code: "SS26"
          }
        }
      }
    }
  }
});
```

---

### 6.3 Collection Management

**Purpose:** Group styles into seasonal collections

**Workflow:**
1. Create season (e.g., SS26)
2. Create styles linked to season
3. View collection: All styles for SS26
4. Production planning: Schedule SS26 production timeline

**Example Collection Query:**
```typescript
// Get all styles for SS26 season
const ss26Collection = await prisma.styles.findMany({
  where: {
    season: {
      code: "SS26"
    }
  },
  include: {
    seasonMaster: true
  }
});
```

---

## 7. Use Cases

### 7.1 Seasonal Collection Planning

**Scenario:** Fashion brand plans SS26 collection

**Steps:**
1. Create SS26 season (or use bulk generation)
2. Design team creates 50 new style designs
3. Link each style to SS26 season
4. Production team views SS26 collection
5. Plan manufacturing timeline (Oct 2025 - Feb 2026)
6. Monitor production progress by season

**Benefits:**
- Centralized collection management
- Clear timeline boundaries
- Performance tracking by season

---

### 7.2 Multi-Year Planning

**Scenario:** Brand wants to plan next 5 years

**Steps:**
1. Use bulk generation: 2025-2030
2. System creates SS and AW for each year (12 seasons)
3. Planning team allocates resources by season
4. Track historical trends (SS24 sales vs SS25 projections)

**Benefits:**
- Long-term visibility
- Trend analysis
- Capacity planning

---

### 7.3 Seasonal Inventory Management

**Scenario:** Manage inventory by season

**Steps:**
1. Tag fabrics and trims with season metadata
2. Track stock levels by season
3. Clear seasonal inventory after production
4. Archive past season data

**Example:**
```typescript
// Get fabric stock for SS26 styles
const fabricStock = await prisma.fabricStock.findMany({
  where: {
    fabric: {
      styles: {
        some: {
          season: {
            code: "SS26"
          }
        }
      }
    }
  }
});
```

---

### 7.4 Trend Analysis

**Scenario:** Compare seasonal performance

**Query Example:**
```typescript
// Compare SS24 vs SS25 sales
const comparison = await prisma.orders.groupBy({
  by: ['seasonId'],
  where: {
    items: {
      some: {
        style: {
          season: {
            code: {
              in: ['SS24', 'SS25']
            }
          }
        }
      }
    }
  },
  _sum: {
    totalAmount: true
  }
});
```

**Insights:**
- Revenue growth by season
- Best-selling styles per season
- Production efficiency trends

---

## 8. Bulk Season Generation

### 8.1 When to Use Bulk Generation

**Use Cases:**
1. **Initial Setup:** Generate seasons for next 5 years
2. **Annual Planning:** Generate next year at year-end
3. **Data Migration:** Backfill historical seasons
4. **Long-term Planning:** Generate 10-20 years for forecasting

### 8.2 Bulk Generation Logic

**Algorithm:**
```javascript
for (let year = startYear; year <= endYear; year++) {
  for (const type of ['SS', 'AW']) {
    const code = `${type}${year % 100}`;  // SS26, AW26
    const name = `${type === 'SS' ? 'Spring/Summer' : 'Autumn/Winter'} ${year}`;
    const sortOrder = (year - 2000) * 2 + (type === 'SS' ? 0 : 1);

    // Check if exists
    const existing = await checkExists(code);
    if (existing) {
      skipped++;
      continue;
    }

    // Create season
    await createSeason({ code, name, year, seasonType: type, sortOrder });
    created++;
  }
}
```

### 8.3 Idempotency

**Safe to re-run:** The bulk generation endpoint is idempotent - it skips existing seasons.

**Example:**
- First run (2025-2027): Creates 6 seasons (SS25, AW25, SS26, AW26, SS27, AW27)
- Second run (2025-2030): Creates 6 new seasons (SS28-SS30, AW28-AW30), skips existing 6

### 8.4 Performance Considerations

**Limits:**
- Maximum 20-year range (40 seasons max)
- Prevents accidental bulk creation of hundreds of seasons
- Typical use: 5-10 year range (10-20 seasons)

**Execution Time:**
- ~10 seconds for 10-year range (20 seasons)
- Database transaction ensures atomicity

---

## 9. Best Practices

### 9.1 Season Code Naming

**✅ DO:**
- Use standard format: `{Type}{YY}` (SS26, AW25)
- Keep codes short and consistent
- Use 2-digit year for compactness

**❌ DON'T:**
- Use verbose codes: "SPRING_SUMMER_2026"
- Mix formats: "SS26" vs "Spring26"
- Use 4-digit year: "SS2026" (too long)

---

### 9.2 Season Lifecycle Management

**✅ DO:**
- Mark old seasons inactive after 2 years
- Keep historical data (soft delete only)
- Use bulk generation for initial setup
- Set sort order for chronological display

**❌ DON'T:**
- Delete seasons with linked styles
- Create seasons ad-hoc (use bulk generation)
- Skip sort order (breaks chronological sorting)

---

### 9.3 Integration Best Practices

**✅ DO:**
- Link styles to seasons during creation
- Filter reports by season
- Use season for production planning
- Track seasonal trends

**❌ DON'T:**
- Leave seasonId null on styles (loses categorization)
- Hardcode season codes in queries (use dynamic filters)
- Mix seasonal and non-seasonal data

---

### 9.4 Search & Filter Optimization

**✅ DO:**
- Use indexed fields (year, seasonType, isActive)
- Limit search results (default: 50)
- Cache frequently accessed seasons

**❌ DON'T:**
- Query all seasons without filters
- Load inactive seasons in dropdowns
- Skip pagination on large lists

---

## 10. Troubleshooting

### 10.1 Duplicate Season Code Error

**Error:** `409 Conflict - Season code already exists`

**Cause:** Attempting to create season with existing code (e.g., SS26)

**Solution:**
- Check existing seasons: `GET /api/seasons?search=SS26`
- Use different code or update existing season
- For bulk generation: Endpoint automatically skips duplicates

---

### 10.2 Styles Not Showing in Season Filter

**Symptom:** Season dropdown shows season, but no styles appear

**Cause:** Styles not linked to season (seasonId is null)

**Solution:**
```sql
-- Check unlinked styles
SELECT id, styleNumber, seasonId FROM styles WHERE seasonId IS NULL;

-- Update style to link season
UPDATE styles SET seasonId = 'clx123...' WHERE id = 'style-id';
```

---

### 10.3 Sort Order Incorrect

**Symptom:** Seasons displayed out of chronological order

**Cause:** Missing or incorrect sortOrder values

**Solution:**
- Use bulk generation (auto-calculates sortOrder)
- Or manually set: sortOrder = (year - 2000) * 2 + (type === 'SS' ? 0 : 1)

**Example Fix:**
```typescript
// Recalculate sort orders for all seasons
const seasons = await prisma.seasonMaster.findMany();
for (const season of seasons) {
  const sortOrder = (season.year - 2000) * 2 + (season.seasonType === 'SS' ? 0 : 1);
  await prisma.seasonMaster.update({
    where: { id: season.id },
    data: { sortOrder }
  });
}
```

---

### 10.4 Bulk Generation Validation Errors

**Error:** `Year range cannot exceed 20 years`

**Cause:** startYear and endYear difference > 20

**Solution:**
- Split into multiple requests (e.g., 2025-2035, then 2036-2045)
- Or reduce range to 20 years max

**Error:** `startYear must be less than or equal to endYear`

**Cause:** Incorrect year order

**Solution:**
- Swap startYear and endYear values

---

## Related Documentation

- [MATERIALS_MASTER_GUIDE.md](./MATERIALS_MASTER_GUIDE.md) - Material categorization by season
- [BOM_MRP_GUIDE.md](./BOM_MRP_GUIDE.md) - Seasonal production planning
- [ORDER_PROCUREMENT_GUIDE.md](./ORDER_PROCUREMENT_GUIDE.md) - Seasonal order tracking
- [PROJECT_BIBLE.md](./PROJECT_BIBLE.md) - Main system documentation

---

**Last Updated:** February 6, 2026
**Version:** 1.0
**Maintained By:** Development Team

---

## Changelog

### v1.0 (2026-02-06)
- Initial documentation
- Covered all 8 API endpoints
- Documented bulk generation feature
- Added integration patterns with styles and orders
- Included troubleshooting guide
