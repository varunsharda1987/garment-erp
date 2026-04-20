# Generic Material System - Implementation Plan

## Overview

**Goal:** Allow adding new material types via UI without code changes (no migrations, no new controllers, no new routes).

**Current Problem:**
- 20+ specialized master tables (`button_master`, `thread_master`, `lace_master`, etc.)
- Each requires: Prisma model + migration + controller + routes + frontend pages
- Adding a new material type = 4-6 hours of developer work

**Solution:**
- Unified `materials` table with dynamic `specifications` JSON field
- UI-editable `material_type_config` table defines fields per type
- Dynamic forms render based on config

---

## Current Architecture (Problem)

```
button_master (id: UUID)
├── buttonCode, buttonName
├── holes, shape, material, color    ← Type-specific fields
└── pricePerPiece, pricePerGross

thread_master (id: UUID)
├── threadCode, threadName
├── ply, coneSize, metersPerUnit     ← Different type-specific fields
└── pricePerCone

zipper_master (id: UUID)
├── zipperCode, zipperName
├── length, type, teeth              ← Yet another set of fields
└── pricePerPiece

... 17 more specialized tables
```

**Issues:**
1. Schema changes needed for new types
2. Duplicate CRUD logic across 20+ controllers
3. Hard to maintain consistency
4. No UI-based customization

---

## Proposed Architecture (Solution)

### Database Schema

```prisma
// Unified materials table (replaces 20+ specialized masters)
model materials {
  id              String   @id @default(uuid())
  code            String   @unique
  name            String
  materialType    String   // "BUTTON", "THREAD", etc. - NOT an enum
  categoryId      String
  unit            String   @default("PIECE")
  
  // Type-specific fields stored as JSON
  specifications  Json?    // { "holes": 4, "shape": "round", "color": "white" }
  
  // Common fields
  hsnCode         String?
  gstRate         Decimal? @db.Decimal(5, 2)
  image           String?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  category        material_categories @relation(...)
  suppliers       material_suppliers[]
  stockLevels     stock_levels[]
}

// Configuration table (UI-editable)
model material_type_config {
  id              String   @id @default(uuid())
  typeName        String   @unique  // "BUTTON", "THREAD", etc.
  displayName     String             // "Button", "Thread"
  codePrefix      String             // "BTN", "THR"
  defaultUnit     String   @default("PIECE")
  
  // Field definitions as JSON array
  fields          Json     // See field definition structure below
  
  // UI hints
  icon            String?  // Icon name for sidebar/lists
  color           String?  // Badge color
  sortOrder       Int      @default(100)
  
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Field Definition Structure

```typescript
interface MaterialTypeField {
  name: string;           // "holes"
  label: string;          // "Number of Holes"
  type: 'text' | 'number' | 'decimal' | 'select' | 'multiselect' | 'boolean' | 'date';
  required: boolean;
  
  // For select/multiselect
  options?: { value: string; label: string }[];
  
  // Validation
  min?: number;
  max?: number;
  pattern?: string;       // Regex for text validation
  
  // UI hints
  placeholder?: string;
  helpText?: string;
  width?: 'full' | 'half' | 'third';
  group?: string;         // Group fields visually
}
```

### Example Configuration

```json
{
  "typeName": "BUTTON",
  "displayName": "Button",
  "codePrefix": "BTN",
  "defaultUnit": "PIECE",
  "fields": [
    {
      "name": "holes",
      "label": "Number of Holes",
      "type": "select",
      "required": true,
      "options": [
        { "value": "2", "label": "2 Holes" },
        { "value": "4", "label": "4 Holes" },
        { "value": "shank", "label": "Shank" }
      ],
      "width": "third"
    },
    {
      "name": "shape",
      "label": "Shape",
      "type": "select",
      "required": false,
      "options": [
        { "value": "round", "label": "Round" },
        { "value": "square", "label": "Square" },
        { "value": "oval", "label": "Oval" }
      ],
      "width": "third"
    },
    {
      "name": "material",
      "label": "Material",
      "type": "text",
      "required": false,
      "placeholder": "e.g., Pearl, Metal, Plastic",
      "width": "third"
    },
    {
      "name": "diameter",
      "label": "Diameter (mm)",
      "type": "number",
      "required": false,
      "min": 1,
      "max": 100,
      "width": "half"
    },
    {
      "name": "color",
      "label": "Color",
      "type": "text",
      "required": false,
      "width": "half"
    },
    {
      "name": "pricePerPiece",
      "label": "Price per Piece",
      "type": "decimal",
      "required": false,
      "min": 0,
      "group": "Pricing"
    },
    {
      "name": "pricePerGross",
      "label": "Price per Gross (144 pcs)",
      "type": "decimal",
      "required": false,
      "min": 0,
      "group": "Pricing"
    }
  ]
}
```

---

## Implementation Phases

### Phase 1: Database Schema (1 day)

**Tasks:**
1. Add `material_type_config` table to schema
2. Run migration
3. Create seed script with 20 existing type configurations

**Files to modify:**
- `backend/prisma/schema.prisma`
- `backend/scripts/seed-material-type-config.ts` (new)

**Migration:**
```sql
CREATE TABLE material_type_config (
  id VARCHAR(36) PRIMARY KEY,
  typeName VARCHAR(50) UNIQUE NOT NULL,
  displayName VARCHAR(100) NOT NULL,
  codePrefix VARCHAR(10) NOT NULL,
  defaultUnit VARCHAR(20) DEFAULT 'PIECE',
  fields JSON NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(20),
  sortOrder INT DEFAULT 100,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

### Phase 2: Backend API (1-2 days)

**Tasks:**
1. Create `material-type-config.service.ts`
2. Create `material-type-config.controller.ts`
3. Create `material-type-config.routes.ts`
4. Update `materials.service.ts` to validate specifications against config

**New Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/material-type-config` | List all types |
| GET | `/material-type-config/:typeName` | Get single type config |
| POST | `/material-type-config` | Create new type (admin) |
| PUT | `/material-type-config/:id` | Update type config (admin) |
| DELETE | `/material-type-config/:id` | Deactivate type (admin) |

**Validation Logic:**
```typescript
// In materials.service.ts
async function validateSpecifications(
  materialType: string,
  specifications: Record<string, unknown>
): Promise<void> {
  const config = await prisma.material_type_config.findUnique({
    where: { typeName: materialType }
  });
  
  if (!config) {
    throw new ValidationError(`Unknown material type: ${materialType}`);
  }
  
  const fields = config.fields as MaterialTypeField[];
  
  for (const field of fields) {
    const value = specifications[field.name];
    
    if (field.required && (value === undefined || value === null || value === '')) {
      throw new ValidationError(`${field.label} is required`);
    }
    
    if (value !== undefined && value !== null) {
      // Type-specific validation
      if (field.type === 'number' || field.type === 'decimal') {
        if (field.min !== undefined && Number(value) < field.min) {
          throw new ValidationError(`${field.label} must be at least ${field.min}`);
        }
        if (field.max !== undefined && Number(value) > field.max) {
          throw new ValidationError(`${field.label} must be at most ${field.max}`);
        }
      }
      
      if (field.type === 'select' && field.options) {
        const validValues = field.options.map(o => o.value);
        if (!validValues.includes(String(value))) {
          throw new ValidationError(`Invalid ${field.label} value`);
        }
      }
    }
  }
}
```

---

### Phase 3: Frontend Dynamic Forms (2-3 days)

**Tasks:**
1. Create `DynamicMaterialForm.tsx` component
2. Create `MaterialTypeConfigPage.tsx` (admin)
3. Update `MaterialList.tsx` to use dynamic columns
4. Create `useMaterialTypeConfig` hook

**Key Component:**
```tsx
// DynamicMaterialForm.tsx
interface Props {
  materialType: string;
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void;
}

export function DynamicMaterialForm({ materialType, initialValues, onSubmit }: Props) {
  const { data: config, isLoading } = useQuery(
    ['material-type-config', materialType],
    () => getMaterialTypeConfig(materialType)
  );
  
  if (isLoading) return <Skeleton />;
  if (!config) return <Alert>Unknown material type</Alert>;
  
  const form = useForm({
    defaultValues: initialValues || {},
  });
  
  // Group fields
  const groupedFields = groupBy(config.fields, 'group');
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {Object.entries(groupedFields).map(([group, fields]) => (
          <div key={group} className="space-y-4">
            {group && <h3 className="font-medium">{group}</h3>}
            <div className="grid grid-cols-6 gap-4">
              {fields.map(field => (
                <DynamicField 
                  key={field.name} 
                  field={field} 
                  control={form.control} 
                />
              ))}
            </div>
          </div>
        ))}
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}

function DynamicField({ field, control }: { field: MaterialTypeField; control: Control }) {
  const widthClass = {
    full: 'col-span-6',
    half: 'col-span-3',
    third: 'col-span-2',
  }[field.width || 'full'];
  
  return (
    <FormField
      control={control}
      name={field.name}
      render={({ field: formField }) => (
        <FormItem className={widthClass}>
          <FormLabel>{field.label}</FormLabel>
          <FormControl>
            {field.type === 'select' ? (
              <Select {...formField}>
                <SelectTrigger>
                  <SelectValue placeholder={field.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === 'number' || field.type === 'decimal' ? (
              <Input type="number" {...formField} />
            ) : field.type === 'boolean' ? (
              <Switch checked={formField.value} onCheckedChange={formField.onChange} />
            ) : (
              <Input {...formField} placeholder={field.placeholder} />
            )}
          </FormControl>
          {field.helpText && <FormDescription>{field.helpText}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
```

---

### Phase 4: Data Migration (3-4 days)

**Tasks:**
1. Create migration script to copy specialized masters → unified materials
2. Map type-specific columns → specifications JSON
3. Update FKs in dependent tables (PO items, GRN items, stock, etc.)
4. Keep old tables read-only for backward compatibility

**Migration Script:**
```typescript
// scripts/migrate-to-unified-materials.ts

async function migrateButtonMaster() {
  const buttons = await prisma.button_master.findMany();
  
  for (const button of buttons) {
    await prisma.materials.upsert({
      where: { code: button.buttonCode },
      update: {},
      create: {
        id: button.id, // Keep same UUID
        code: button.buttonCode,
        name: button.buttonName,
        materialType: 'BUTTON',
        categoryId: await getOrCreateCategory('BUTTON'),
        unit: 'PIECE',
        specifications: {
          holes: button.holes,
          shape: button.shape,
          material: button.material,
          color: button.color,
          pricePerPiece: button.pricePerPiece,
          pricePerGross: button.pricePerGross,
        },
        isActive: button.isActive,
        createdAt: button.createdAt,
      },
    });
  }
}

// Repeat for all 20+ specialized masters...
```

---

### Phase 5: Update Dependent Modules (2 days)

**Tasks:**
1. Update PO item creation to use `materials.id`
2. Update GRN item creation to use `materials.id`
3. Update Stock modules to use `materials.id`
4. Update BOM/MRP to use `materials.id`

**Key Changes:**
- Replace `buttonId`, `threadId`, etc. FKs with single `materialId`
- Query specifications JSON for type-specific fields
- Update rate resolver to use unified lookup

---

## Timeline Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Database Schema | 1 day | None |
| 2. Backend API | 1-2 days | Phase 1 |
| 3. Frontend Forms | 2-3 days | Phase 2 |
| 4. Data Migration | 3-4 days | Phase 3 |
| 5. Update Modules | 2 days | Phase 4 |

**Total: 9-12 days**

---

## Benefits After Implementation

| Before | After |
|--------|-------|
| Add material type = 4-6 hours dev work | Add material type = 5 minutes via UI |
| 20+ specialized tables | 1 unified table |
| 20+ controllers with duplicate logic | 1 generic controller |
| Hard-coded field definitions | UI-configurable fields |
| Schema migration for new types | No migration needed |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Performance with JSON queries | Index specifications JSON, cache configs |
| Complex reporting on type-specific fields | Create views per type for reports |
| Breaking existing integrations | Keep old tables read-only, dual-write during transition |
| Lost type safety | Runtime validation via config, TypeScript generics for known types |

---

## Open Questions

1. **Keep specialized tables?** Read-only for backward compat, or full migration?
2. **Field versioning?** What happens when field config changes for existing materials?
3. **Permissions?** Who can create/modify material type configs?
4. **Validation complexity?** Support conditional fields (show X if Y is selected)?

---

## Next Steps

1. Review this plan with stakeholders
2. Decide on open questions
3. Create detailed tickets for each phase
4. Begin Phase 1 implementation

---

*Document created: 2026-04-17*
*Author: Claude Code*
*Status: Planning*
