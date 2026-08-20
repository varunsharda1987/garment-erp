# AI Update Actions (low-risk wave) + Change History page

## Context

The AI assistant can currently create 20 record types but cannot change anything — a deliberate choice, because a wrong create leaves a deletable row while a wrong update silently overwrites live data, and ordinary edits in this ERP write no audit trail today (`logUpdate` exists in `audit.service.ts` but is dead code).

This adds **12 update actions restricted to low-risk fields** (prices/rates, descriptive fields, contact details — chosen by the user), made safe by three things: a **before → after diff on the confirmation card**, a **re-check at confirm time**, and a **change trail** viewable on a new admin page.

Exploration found two hazards that shape the whole design:

1. **These PUT endpoints are not safely partial.** Omitting a field nulls it on fabric (6 fields), greige (2), supplier (4 FKs); and lace/button/thread **regenerate the name from attributes** when the name is omitted, overwriting a human-authored name — then cascade it into `materials` via `syncMasterToMaterials`.
2. **Relation arrays are delete-and-recreate.** Sending `suppliers: []`, `gstNumbers: []`, `styleCodes: []` or `brandCategories: []` deletes existing rows. Omitting them is safe.

Both are handled by design below, not by luck.

## Design

### 1. Extend the action registry (`backend/src/services/ai/ai-action-types.ts`)

- Widen `method: 'POST'` → `'POST' | 'PUT' | 'PATCH'` (all these endpoints are **PUT**; there are no PATCH routes).
- Add an optional `update` block to `ActionDefinition`:

```ts
update?: {
  entityLabel: string;              // 'Fabric' — used in questions and the card
  getPath: (id: string) => string;  // to fetch the BEFORE snapshot
  editableFields: string[];         // hard allowlist — nothing else can ever change
  preserveFields?: string[];        // fields the endpoint nulls when omitted; back-filled
  fieldLabels?: Record<string,string>; // 'costPerMeter' → 'Cost per meter'
}
```

- New payload keys (camelCase-stable so the response serializer leaves them intact, per the existing `DISPLAY_KEY` note): `diffRows: Array<{field,label,before,after}>` and `beforeSnapshot: Record<string,unknown>`. Neither is declared in `executionSchema`, so Zod's strip mode keeps them out of the request body automatically.

### 2. Shared update helpers (same file)

- `fetchCurrent(ctx, getPath)` → `internalFetch` GET, returning `body.data ?? body` (**the GET shape is not uniform**: colour/customer/supplier return `{data}`, the nine material masters return a bare object).
- `buildUpdateProposal(payload, ctx, def.update)` used as the actions' `prepare()`:
  1. fetch the current record;
  2. keep only keys present in `editableFields` **and** actually different → `diffRows`;
  3. if nothing differs → `{ok:false, question:'Those values are already set — nothing to change.'}`;
  4. back-fill every `preserveFields` entry from the current record (this is what stops the null-out hazard);
  5. return the payload plus `diffRows` + `beforeSnapshot` (only the touched fields).

### 3. Confirm-time safety (`ai-actions.service.ts` `confirmAction`)

Before executing an action that has an `update` block: re-fetch the record and compare the touched fields against `beforeSnapshot`. If any differs, refuse — *"This record was changed after I showed you the preview. Please ask again."* This is optimistic-concurrency: it makes the displayed diff a promise, not a snapshot that may have rotted.

After a successful update, write the trail via `createAuditLog` (it self-generates the uuid `audit_logs.id` needs, and is best-effort so it can never fail the update):

```
{ userId, action: 'AI_UPDATE', entityType: def.actionEntity, entityId,
  oldValues: beforeSnapshot, newValues: <changed fields>, ipAddress }
```

Add `'AI_UPDATE'` to the `AuditAction` union in `audit.service.ts` (additive; the DB column is a plain String). Thread `ipAddress` in: `confirmAction` currently takes `(messageId, userId, userRole, authHeader)` — add an `ipAddress` argument supplied from `req.ip` at the route.

### 4. The 12 actions (`backend/src/services/ai/actions/update.actions.ts`)

Every action's tool schema is: *which record* (name/code, resolved via the existing `resolveEntity`) + the editable fields, all optional.

| Action | PUT path | Editable (allowlist) | preserveFields |
|---|---|---|---|
| update_fabric | `/api/fabric-management/fabric/:id` | fabricName, composition, colorName, actualWidth, actualGSM, costPerMeter, finishType | genericGreigeName, finishedConstruction, actualGSM, valueAddition, valueAdditionCost, styleReference |
| update_greige | `/api/fabric-management/greige/:id` | greigeName, composition, yarnCount, construction, weaveType, greigeWidth, costPerMeter, averageShrinkagePercent | expectedFinishedWidthMin, expectedFinishedWidthMax |
| update_lace | `/api/materials/lace/:id` | laceName, laceType, composition, design, width, color, pricePerMeter | **laceName** (regenerated if omitted) |
| update_button | `/api/materials/button/:id` | buttonName, size, holes, color, material, shape, pricePerPiece | **buttonName** |
| update_thread | `/api/materials/thread/:id` | threadName, brand, color, ply, metersPerUnit, pricePerCone | **threadName** |
| update_zipper | `/api/materials/zipper/:id` | zipperName, brand, sliderType, length, teethType, color, pricePerPiece | — |
| update_elastic | `/api/materials/elastic/:id` | elasticName, elasticType, composition, width, stretchPercent, color, pricePerMeter | — |
| update_label | `/api/materials/label/:id` | labelName, labelType, content, fabricContent, washcareInstructions, pricePerPiece | — |
| update_packaging | `/api/materials/packaging/:id` | packagingName, packagingType, size, material, thickness, printDetails, pricePerPiece | — |
| update_color | `/api/colors/:id` | colorName, hexCode, colorFamily, description | — |
| update_customer | `/api/customers/:id` | contactPerson, email, phone, billingAddress, creditDays | — |
| update_supplier | `/api/suppliers/:id` | contactPerson, email, phone, address, paymentTerms, creditDays | billingStateId, billingCityId, shippingStateId, shippingCityId |

Deliberately **excluded** from every allowlist, and why:
- All relation arrays (`suppliers`, `gstNumbers`, `styleCodes`, `brandCategories`) — delete-and-recreate.
- `sizeCategoryId` / `generateSizeVariants` on label — would mass-create size variants **and** a materials row each.
- `packagingType` on **thread** — sending it without `piecesPerBox` silently rewrites `piecesPerBox`.
- `supplierCategories` on supplier — triggers auto-creation of a JOB_WORK warehouse (verified at `supplier.service.ts:315`); omitting it keeps that branch dormant.
- Codes, IDs, `isActive` (user did not select status changes for this wave).

Roles: mirror each route's own gate; only customer has one (ADMIN/SALES/MERCHANDISER). Others get ADMIN/MERCHANDISER/INVENTORY/PURCHASE, matching the create actions.

**Disclose the cascade:** renaming a fabric/greige/trim rewrites the linked `materials` registry row (`syncMasterToMaterials`). When a name is being changed, `prepare()` appends a display line: *"Also updates the linked material record's name."*

### 5. Prompt (`ai-actions.service.ts` `getPromptLinesForRole`)

Replace the now-false line `- You cannot update or delete anything.` with:
`- You can UPDATE only the specific fields listed for each update action. You cannot delete anything.`
`- For an update, name the record and ONLY the fields to change — never re-send fields the user did not mention.`

### 6. Confirmation card (`frontend/src/components/AIActionCard.tsx`)

- Exclude `diffRows` and `beforeSnapshot` from the field rows (alongside the existing `displayLines`).
- Render `diffRows` as a 3-column block — Field | Before | After — with the before muted/struck and the after emphasised; empty values show as "—" (today's filter drops empty strings entirely).
- Confirm button label: "Confirm & Update" when `actionType` starts with `update_` (it is hard-coded "Confirm & Create" today, and `actionLabel` is not a DB column so this must derive from actionType to survive a reload).

### 7. Change History page (admin)

- Backend: reuse the existing `GET /api/audit?action=AI_UPDATE&limit=` (`audit.routes.ts`, already gated ADMIN/PRODUCTION_MANAGER). No new endpoint.
- `frontend/src/services/audit.service.ts` — thin wrapper (none exists; no page consumes `/api/audit` today).
- `frontend/src/pages/AIChangeHistory.tsx` at `/ai-change-history`: table of time, user, record type, record, and the field-level before → after pairs from `oldValues`/`newValues`, with a row-detail dialog. `OverrideHistory.tsx` is the structural precedent (it already renders `from → to`).
- Register: `permissions.config.ts` (`aiChangeHistory: [ADMIN]` + route map), `lazy-routes.tsx`, `App.tsx`, and a **Team & Settings** sidebar entry in `navigation.ts` (icon `History` — add to `nav-icons.ts`).

### 8. Tests

- Extend `ai-actions-registry.test.ts`: switch the endpoint probe on `action.method` (it hard-codes `.post()` today, so a PUT action would be probed wrongly); assert every `update` action has a non-empty `editableFields`, and that no editable field is a relation-array name or one of the excluded keys above.
- New unit test for the diff builder: only-changed-fields, no-op → question, preserveFields back-filled, beforeSnapshot excluded from the execution body.

## Deploy

`cd backend && npm run build` → `cd frontend && npm run build` → `node C:\Users\NEW\ops\pm2-safe-restart.js garment-erp-api:5000 garment-erp-web:3000`. No migration (audit_logs and ai_messages already exist). Rollback: drop `UPDATE_ACTIONS` from the registry, rebuild, restart.

## Verification

1. *"change the cost of Cotton Cambric to 156"* → card shows **Cost per meter: 142.00 → 156.00**, button reads **Confirm & Update**; confirm → record updated.
2. Ask for the same value again → *"Those values are already set — nothing to change."*
3. Edit that fabric on its page, then confirm a proposal made before the edit → refused as changed-since-preview.
4. Rename a lace via chat → the linked materials row's name follows, and the card said it would.
5. Fabric/greige/supplier regression: after a chat price change, re-open the record and confirm `actualGSM` / `expectedFinishedWidth*` / billing state-city are **unchanged** (the null-out hazard).
6. Ask to change something outside the allowlist (e.g. a supplier's categories) → the AI declines rather than attempting it.
7. `/ai-change-history` lists every change with before → after and the user who made it.
8. `npx jest ai-actions-registry knowledge-retrieval persistence-smoke` green.
