# Coding Standards & Best Practices

**Garment ERP System - Development Guidelines**

This document establishes the coding standards, architectural patterns, and best practices for all development in the Garment ERP system. **ALL developers must follow these guidelines** to ensure consistency, maintainability, and scalability.

---

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Frontend Standards](#frontend-standards)
3. [Backend Standards](#backend-standards)
4. [Database Standards](#database-standards)
5. [Common Components Usage](#common-components-usage)
6. [Error Handling](#error-handling)
7. [State Management](#state-management)
8. [Form Patterns](#form-patterns)
9. [API Integration](#api-integration)
10. [Testing Standards](#testing-standards)
11. [Documentation Standards](#documentation-standards)
12. [Code Review Checklist](#code-review-checklist)

---

## Project Architecture

### Technology Stack

**Frontend:**
- React 18+ with TypeScript
- Vite for build tooling
- TailwindCSS + shadcn/ui components
- React Router for routing
- Zustand for state management
- React Hook Form + Zod for forms
- Axios for API calls

**Backend:**
- Node.js with TypeScript
- Express.js framework
- Prisma ORM
- PostgreSQL database
- JWT for authentication

### Directory Structure

```
frontend/src/
├── components/          # Reusable components
│   ├── ui/             # Base UI components (shadcn/ui)
│   ├── form/           # Form field components
│   └── ...             # Feature components
├── pages/              # Page components (routes)
├── services/           # API service layers
├── stores/             # Zustand stores
├── types/              # TypeScript type definitions
├── lib/                # Utility functions
└── App.tsx             # Main app component

backend/src/
├── controllers/        # Request handlers
├── routes/             # Route definitions
├── services/           # Business logic
├── middleware/         # Express middleware
├── utils/              # Utility functions
└── server.ts           # Entry point
```

---

## Frontend Standards

### 1. Component Structure

**✅ DO:**
```tsx
// Use functional components with TypeScript
interface Props {
  title: string;
  onSubmit: (data: FormData) => void;
}

export default function MyComponent({ title, onSubmit }: Props) {
  // Component logic
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

**❌ DON'T:**
- Use class components
- Mix business logic with presentation
- Create components without TypeScript types

### 2. Naming Conventions

- **Components:** PascalCase (`CustomerList.tsx`, `FormField.tsx`)
- **Files:** kebab-case for utilities (`api-error-handler.ts`)
- **Variables/Functions:** camelCase (`fetchCustomers`, `handleSubmit`)
- **Constants:** UPPER_SNAKE_CASE (`API_BASE_URL`, `MAX_RETRIES`)
- **Types/Interfaces:** PascalCase (`Customer`, `ApiResponse`)

### 3. Import Organization

```tsx
// 1. React and external libraries
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. UI components
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// 3. Custom components
import SearchInput from '@/components/SearchInput';
import EmptyState from '@/components/EmptyState';

// 4. Services and utilities
import { customerService } from '@/services/customer.service';
import { handleApiError } from '@/lib/api-error-handler';

// 5. Types
import type { Customer } from '@/types/customer.types';

// 6. Icons
import { Search, Plus } from 'lucide-react';
```

### 4. Component Organization

Structure components in this order:

```tsx
export default function MyComponent() {
  // 1. Hooks (useState, useEffect, etc.)
  const [data, setData] = useState([]);

  // 2. Derived state
  const filteredData = useMemo(() => data.filter(...), [data]);

  // 3. Event handlers
  const handleClick = () => {
    // ...
  };

  // 4. Effects
  useEffect(() => {
    // ...
  }, []);

  // 5. Helper functions
  const formatDate = (date: string) => {
    // ...
  };

  // 6. Early returns
  if (loading) return <LoadingSpinner />;

  // 7. Main render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

---

## Backend Standards

### 1. Controller Pattern

**ALWAYS use this structure:**

```typescript
export const getAllResources = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    // Business logic
    const result = await resourceService.getAll({ page, limit, search });

    res.status(200).json({
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('Error in getAllResources:', error);
    res.status(500).json({
      error: 'Server Error',
      message: error.message,
    });
  }
};
```

### 2. Response Format

**✅ Success Response:**
```json
{
  "data": { ... },
  "message": "Optional success message",
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

**✅ Error Response:**
```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "details": { "field": "error" }
}
```

### 3. Route Structure

```typescript
import { Router } from 'express';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import * as controller from '../controllers/resource.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Public routes (authenticated users)
router.get('/', controller.getAll);
router.get('/:id', controller.getById);

// Protected routes (specific roles)
router.post('/', authorize('ADMIN', 'SALES'), controller.create);
router.put('/:id', authorize('ADMIN', 'SALES'), controller.update);
router.delete('/:id', authorize('ADMIN'), controller.delete);

export default router;
```

---

## Database Standards

### 1. Naming Conventions

**✅ Tables:** snake_case
```prisma
model bill_of_materials { }
model order_items { }
```

**✅ Columns:** snake_case
```prisma
created_at
updated_at
customer_id
```

**✅ Enums:** PascalCase
```prisma
enum OrderStatus {
  DRAFT
  CONFIRMED
  IN_PRODUCTION
}
```

### 2. Standard Fields

**Every table MUST have:**

```prisma
model resource {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdById String?
  createdBy   users?   @relation(fields: [createdById], references: [id])
}
```

### 3. Relationships

```prisma
// Always use explicit @relation
orders Order[] @relation("CustomerOrders")

// Always specify onDelete behavior
customerId String
customer   customers @relation(fields: [customerId], references: [id], onDelete: Cascade)

// Always add indexes for foreign keys
@@index([customerId])
```

### 4. Soft Deletes

```prisma
model resource {
  isActive Boolean @default(true)
}
```

Never hard delete business-critical data. Use `isActive` flag.

---

## Common Components Usage

### MANDATORY: Use These Components

#### 1. Toast Notifications

**✅ ALWAYS use toast, NEVER use alert()**

```tsx
import { toast } from 'sonner';

// Success
toast.success('Customer created', {
  description: `${data.name} has been successfully created.`
});

// Error
toast.error('Error', {
  description: errorMessage
});

// Warning
toast.warning('Warning', {
  description: 'This action may have consequences.'
});

// Info
toast.info('Info', {
  description: 'Additional information.'
});
```

#### 2. Confirmation Dialogs

**✅ ALWAYS use ConfirmDialog, NEVER use window.confirm()**

```tsx
import { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';

const [dialogOpen, setDialogOpen] = useState(false);
const [itemToDelete, setItemToDelete] = useState(null);

<ConfirmDialog
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  title="Delete Customer"
  description="Are you sure? This action cannot be undone."
  confirmText="Delete"
  variant="destructive"
  onConfirm={confirmDelete}
/>
```

#### 3. Search Input

**✅ ALWAYS use SearchInput for search**

```tsx
import SearchInput from '@/components/SearchInput';

<SearchInput
  value={searchQuery}
  onChange={setSearchQuery}
  placeholder="Search customers..."
/>
```

#### 4. Empty States

**✅ ALWAYS use EmptyState**

```tsx
import EmptyState from '@/components/EmptyState';
import { Package } from 'lucide-react';

<EmptyState
  icon={<Package className="h-16 w-16" />}
  title="No customers found"
  description="Get started by creating your first customer"
  actionLabel="Create Customer"
  onAction={() => navigate('/customers/new')}
/>
```

#### 5. Loading States

**✅ Use appropriate spinner for context**

```tsx
import {
  LoadingSpinner,      // Page/section loading
  ButtonSpinner,       // Button loading
  TableSkeleton,       // Table loading
  InlineSpinner,       // Inline loading
  OverlaySpinner       // Overlay loading
} from '@/components/LoadingSpinner';

// Page loading
{loading && <LoadingSpinner text="Loading customers..." />}

// Button loading
<Button disabled={loading}>
  {loading ? <ButtonSpinner /> : 'Save'}
</Button>

// Table loading
{loading && <TableSkeleton rows={5} columns={6} />}
```

#### 6. Pagination

**✅ ALWAYS use Pagination component**

```tsx
import Pagination from '@/components/Pagination';

<Pagination
  currentPage={page}
  totalPages={totalPages}
  pageSize={pageSize}
  totalItems={total}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
/>
```

#### 7. Status Badges

**✅ Use StatusBadge for all status displays**

```tsx
import { StatusBadge } from '@/components/StatusBadge';

<StatusBadge status={order.status} />
// Auto-colors based on status text
```

#### 8. DataTable Component

**✅ Use for all list pages**

```tsx
import DataTable from '@/components/DataTable';

<DataTable
  data={customers}
  columns={columns}
  keyExtractor={(item) => item.id}
  loading={loading}
  error={error}
  emptyState={{
    title: 'No customers found',
    description: 'Create your first customer',
    actionLabel: 'Create Customer',
    onAction: () => navigate('/customers/new'),
  }}
  pagination={{
    currentPage: page,
    totalPages,
    pageSize,
    totalItems: total,
    onPageChange: setPage,
    onPageSizeChange: setPageSize,
  }}
/>
```

---

## Error Handling

### Frontend Error Handling

**✅ ALWAYS use the error handler utility**

```tsx
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

try {
  await customerService.create(data);
  handleApiSuccess('Customer created', `${data.name} has been created.`);
  navigate('/customers');
} catch (error) {
  handleApiError(error, 'Failed to create customer');
}
```

### Backend Error Handling

**✅ Standard pattern:**

```typescript
try {
  const result = await service.doSomething();
  res.status(200).json({ data: result });
} catch (error: any) {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Server Error',
    message: error.message,
  });
}
```

---

## State Management

### Global State (Zustand)

**Use for:**
- Authentication state
- User preferences
- Global UI state (sidebar, theme)

```tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface State {
  user: User | null;
  setUser: (user: User) => void;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
    }),
    { name: 'store-name' }
  )
);
```

### Local State (useState)

**Use for:**
- Component-specific state
- Form data
- UI state (modals, dropdowns)

---

## Form Patterns

### MANDATORY Form Structure

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { validators } from '@/lib/validators';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

// 1. Define schema with shared validators
const schema = z.object({
  email: validators.emailRequired,
  phone: validators.phoneRequired,
  gstNumber: validators.gst,
});

type FormData = z.infer<typeof schema>;

export default function MyForm() {
  // 2. Initialize form
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // 3. Submit handler
  const onSubmit = async (data: FormData) => {
    try {
      await service.create(data);
      handleApiSuccess('Created', 'Item has been created.');
      navigate('/list');
    } catch (error) {
      handleApiError(error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
}
```

### Shared Validators

**✅ ALWAYS use shared validators from `@/lib/validators`**

```tsx
import { validators } from '@/lib/validators';

const schema = z.object({
  email: validators.emailRequired,      // Required email
  phone: validators.phone,              // Optional phone (10 digits)
  gstNumber: validators.gst,            // Optional GST (15 chars)
  date: validators.date,                // Required date
  quantity: validators.positiveNumber,  // Positive number
});
```

---

## API Integration

### Service Layer Pattern

**✅ Create one service file per resource**

```typescript
// customer.service.ts
import api from '@/lib/api';
import type { Customer, CustomerListResponse } from '@/types/customer.types';

export const customerService = {
  getAll: async (params?: any) =>
    api.get<CustomerListResponse>('/customers', { params }),

  getById: async (id: string) =>
    api.get<{ data: Customer }>(`/customers/${id}`).then(res => res.data.data),

  create: async (data: any) =>
    api.post<{ data: Customer }>('/customers', data).then(res => res.data.data),

  update: async (id: string, data: any) =>
    api.put<{ data: Customer }>(`/customers/${id}`, data).then(res => res.data.data),

  delete: async (id: string) =>
    api.delete(`/customers/${id}`),
};
```

### API Client Setup

The API client is already configured in `frontend/src/lib/api.ts`:
- Automatic auth header injection
- 401 error handling (auto-logout)
- Base URL configuration

---

## Testing Standards

### Unit Tests

**File naming:** `ComponentName.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Integration Tests

Focus on:
- Form submissions
- API integrations
- User workflows

---

## Documentation Standards

### Code Comments

**✅ DO comment:**
- Complex business logic
- Non-obvious algorithms
- Workarounds and hacks
- Public API functions

**❌ DON'T comment:**
- Obvious code
- What the code does (self-documenting code)

### Component Documentation

```tsx
/**
 * Customer form component for creating and editing customers.
 *
 * @param mode - 'create' or 'edit'
 *
 * @example
 * ```tsx
 * <CustomerForm mode="create" />
 * ```
 */
export default function CustomerForm({ mode }: Props) {
  // ...
}
```

---

## Code Review Checklist

### Before Submitting PR

- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No ESLint warnings
- [ ] Code formatted with Prettier
- [ ] All tests passing
- [ ] Used shared components (no reinventing)
- [ ] Used shared validators
- [ ] Proper error handling with toast/handleApiError
- [ ] Loading states implemented
- [ ] Empty states handled
- [ ] Confirmation for destructive actions
- [ ] TypeScript types defined
- [ ] No console.logs (except for errors)
- [ ] Responsive design tested
- [ ] Accessibility considered

### List Page Checklist

- [ ] Uses DataTable component
- [ ] Uses SearchInput for search
- [ ] Uses Pagination component
- [ ] Uses StatusBadge for statuses
- [ ] Uses EmptyState when no data
- [ ] Uses ConfirmDialog for deletes
- [ ] Uses toast for feedback
- [ ] Uses handleApiError for errors
- [ ] Loading state with TableSkeleton

### Form Page Checklist

- [ ] Uses React Hook Form + Zod
- [ ] Uses shared validators
- [ ] Uses form field components (EmailField, PhoneField, etc.)
- [ ] Uses handleApiError for errors
- [ ] Uses toast for success/error
- [ ] Loading state on submit
- [ ] Proper validation messages
- [ ] Required fields marked

### Backend Checklist

- [ ] Standard controller pattern
- [ ] Proper error handling
- [ ] Consistent response format
- [ ] Authentication middleware
- [ ] Authorization for protected routes
- [ ] Proper TypeScript types
- [ ] Database queries optimized
- [ ] Proper indexes on foreign keys

---

## Quick Reference

### Common Imports

```tsx
// Toast notifications
import { toast } from 'sonner';

// Components
import SearchInput from '@/components/SearchInput';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import Pagination from '@/components/Pagination';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner, TableSkeleton } from '@/components/LoadingSpinner';

// Form components
import { EmailField, PhoneField, GSTField } from '@/components/form';

// Utilities
import { validators } from '@/lib/validators';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
```

### File Naming Reference

```
Components:    CustomerList.tsx, FormField.tsx
Pages:         CustomerForm.tsx, Dashboard.tsx
Services:      customer.service.ts
Types:         customer.types.ts
Utilities:     api-error-handler.ts
Stores:        auth.store.ts
```

---

## Enforcement

**These standards are MANDATORY.**

- All PRs will be reviewed against this document
- Non-compliant code will be rejected
- Repeated violations may require refactoring

---

## Updates

This document will be updated as new patterns emerge. Check the git history for changes.

**Last Updated:** January 19, 2025
**Version:** 1.0.0

---

**Questions?** Refer to example implementations in:
- `CustomerList.tsx` - Complete list page example
- `CustomerForm.tsx` - Complete form page example
- `PRODUCTION_GRADE_COMPONENTS.md` - Component usage guide
