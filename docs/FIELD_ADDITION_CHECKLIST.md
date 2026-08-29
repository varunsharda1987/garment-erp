# Adding a New Field Checklist

When adding a new field to an existing entity, check ALL of these:

## Backend (5 items)
- [ ] `backend/src/schemas/*.schema.ts` - Zod schema (create + update)
- [ ] `backend/src/types/*.types.ts` - TypeScript interface
- [ ] `backend/src/services/*.service.ts` - create() and update() data blocks
- [ ] Run `cd backend && npx tsc --noEmit` - **MUST PASS**
- [ ] Restart API: `node C:\Users\NEW\ops\pm2-safe-restart.js garment-erp-api:5000`

## Frontend (4 items)
- [ ] `frontend/src/types/*.types.ts` - TypeScript interface
- [ ] Form component - add input field
- [ ] Form component - include in save payload (`styleData`)
- [ ] Form component - load from API in edit mode (`loadStyleData` or similar)

## Combobox fields (extra step)
- [ ] If using a Combobox, ensure it fetches the selected value by ID if not in initial options

## Verify
- [ ] Run `cd frontend && npx tsc -b` - **MUST PASS**
- [ ] Rebuild frontend: `cd frontend && npm run build`
- [ ] Hard refresh browser
- [ ] Test: create new, edit existing, refresh page
