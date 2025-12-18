# Garment ERP - Claude Code Instructions

## Project Structure
- `frontend/` - React + TypeScript + Vite frontend
- `backend/` - Node.js + Express + Prisma backend

## Critical: API Response Serialization

The backend uses a serializer (`backend/src/utils/serializer.ts`) that automatically converts ALL snake_case keys to camelCase before sending responses to the frontend.

### What this means:
- Database/Prisma uses snake_case for relation names (e.g., `brand_categories`, `style_components`)
- API responses use camelCase (e.g., `brandCategories`, `styleComponents`)
- **Frontend must ALWAYS use camelCase** when accessing API response data

### Common mistakes to avoid:
```typescript
// WRONG - snake_case won't work in frontend
const category = style.brand_categories?.category;

// CORRECT - use camelCase
const category = style.brandCategories?.category;
```

### Affected relations (examples):
- `brand_categories` → `brandCategories`
- `style_components` → `styleComponents`
- `style_fabrics` → `styleFabrics`
- `style_variants` → `styleVariants`
- All Prisma relations follow this pattern

## TypeScript Types

When defining types for API responses in frontend (`frontend/src/types/`), always use camelCase for nested relation properties to match the serialized response.

## Running the App
- Frontend: `cd frontend && npm run dev`
- Backend: `cd backend && npm run dev`
