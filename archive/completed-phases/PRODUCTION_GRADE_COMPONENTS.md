# Production-Grade Components Guide

This document describes the production-grade common components and patterns implemented in the Garment ERP system.

## Table of Contents
1. [Toast Notification System](#toast-notification-system)
2. [Confirmation Dialog](#confirmation-dialog)
3. [Shared Validators](#shared-validators)
4. [Form Field Components](#form-field-components)
5. [Empty State Component](#empty-state-component)
6. [Search Input Component](#search-input-component)
7. [Error Boundary](#error-boundary)
8. [Design Tokens](#design-tokens)

---

## Toast Notification System

### Library: Sonner

**Location:** `frontend/src/components/ui/toaster.tsx`

### Usage

```tsx
import { toast } from 'sonner';

// Success notification
toast.success('Customer created', {
  description: 'John Doe has been successfully created.'
});

// Error notification
toast.error('Delete failed', {
  description: 'Failed to delete customer. Please try again.'
});

// Info notification
toast.info('Information', {
  description: 'This is an informational message.'
});

// Warning notification
toast.warning('Warning', {
  description: 'This action may have consequences.'
});

// Loading notification
toast.loading('Processing...', {
  description: 'Please wait while we process your request.'
});
```

### Features
- Auto-dismiss after 4 seconds (configurable)
- Positioned at top-right
- Supports success, error, warning, info variants
- Custom styling with CSS variables
- Action buttons support
- Dismissible by user

---

## Confirmation Dialog

### Component: ConfirmDialog

**Location:** `frontend/src/components/ConfirmDialog.tsx`

### Usage

```tsx
import { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';

function MyComponent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    // Perform delete operation
    await deleteItem(itemToDelete.id);
    toast.success('Item deleted');
  };

  return (
    <>
      <Button onClick={() => handleDeleteClick(item)}>Delete</Button>

      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Delete Customer"
        description="Are you sure you want to delete this customer? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive" // or "default"
      />
    </>
  );
}
```

### Props
- `open`: boolean - Controls dialog visibility
- `onOpenChange`: (open: boolean) => void - Callback when dialog state changes
- `title`: string - Dialog title
- `description`: string - Dialog description
- `confirmText`: string - Confirm button text (default: "Continue")
- `cancelText`: string - Cancel button text (default: "Cancel")
- `onConfirm`: () => void - Callback when user confirms
- `variant`: 'default' | 'destructive' - Button variant (default: "default")

---

## Shared Validators

### Library: Zod

**Location:** `frontend/src/lib/validators.ts`

### Available Validators

```tsx
import { validators } from '@/lib/validators';
import { z } from 'zod';

const schema = z.object({
  // Required field
  code: validators.required('Customer code'),

  // Email (optional)
  email: validators.email,

  // Email (required)
  emailRequired: validators.emailRequired,

  // Phone (optional, 10 digits)
  phone: validators.phone,

  // Phone (required)
  phoneRequired: validators.phoneRequired,

  // GST Number (optional, 15 chars)
  gstNumber: validators.gst,

  // GST Number (required)
  gstRequired: validators.gstRequired,

  // PAN (optional, 10 chars)
  pan: validators.pan,

  // Date (required)
  date: validators.date,

  // Positive number
  quantity: validators.positiveNumber,

  // Percentage (0-100)
  discount: validators.percentage,

  // Pincode (6 digits)
  pincode: validators.pincode,

  // IFSC Code (11 chars)
  ifsc: validators.ifsc,

  // Bank Account Number (9-18 digits)
  accountNumber: validators.bankAccount,

  // URL
  website: validators.url,
});
```

### Helper Functions

```tsx
import { createRequiredValidator, createNumberRangeValidator } from '@/lib/validators';

// Custom required field
const customField = createRequiredValidator('Custom Field Name');

// Number range validator
const ageValidator = createNumberRangeValidator(18, 65, 'Age');
```

---

## Form Field Components

### Components
- `FormField` - Base input field
- `TextareaField` - Textarea field
- `EmailField` - Email input with validation
- `PhoneField` - Phone input with auto-formatting
- `GSTField` - GST number input with auto-uppercase
- `DateField` - Date input field

**Location:** `frontend/src/components/form/`

### Usage

```tsx
import { EmailField, PhoneField, GSTField } from '@/components/form';

function MyForm() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gst, setGst] = useState('');

  return (
    <form>
      <EmailField
        value={email}
        onChange={setEmail}
        error={errors.email?.message}
        required
      />

      <PhoneField
        value={phone}
        onChange={setPhone}
        error={errors.phone?.message}
        required
      />

      <GSTField
        value={gst}
        onChange={setGst}
        error={errors.gstNumber?.message}
      />
    </form>
  );
}
```

### Props (Common to all field components)
- `label`: string - Field label (some have defaults)
- `value`: string - Field value
- `onChange`: (value: string) => void - Change handler
- `error`: string - Error message to display
- `required`: boolean - Show required indicator
- `disabled`: boolean - Disable the field
- `className`: string - Additional CSS classes
- `placeholder`: string - Placeholder text

### Field-Specific Features

**PhoneField:**
- Auto-removes non-digit characters
- Limits to 10 digits
- Shows helper text

**GSTField:**
- Auto-converts to uppercase
- Limits to 15 characters
- Shows format helper text

**EmailField:**
- Email validation
- Custom placeholder

---

## Empty State Component

### Component: EmptyState

**Location:** `frontend/src/components/EmptyState.tsx`

### Usage

```tsx
import EmptyState from '@/components/EmptyState';
import { Package } from 'lucide-react';

function CustomerList() {
  return (
    <>
      {customers.length === 0 && (
        <EmptyState
          icon={<Package className="h-16 w-16" />}
          title="No customers found"
          description="Get started by creating your first customer"
          actionLabel="Create First Customer"
          onAction={() => navigate('/customers/new')}
        />
      )}
    </>
  );
}
```

### Props
- `icon`: ReactNode - Icon to display (optional)
- `title`: string - Main heading
- `description`: string - Descriptive text (optional)
- `actionLabel`: string - Action button text (optional)
- `onAction`: () => void - Action button callback (optional)
- `className`: string - Additional CSS classes (optional)

---

## Search Input Component

### Component: SearchInput

**Location:** `frontend/src/components/SearchInput.tsx`

### Usage

```tsx
import { useState } from 'react';
import SearchInput from '@/components/SearchInput';

function CustomerList() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <SearchInput
      value={searchQuery}
      onChange={setSearchQuery}
      placeholder="Search by code, name, or email..."
      debounceMs={300}
    />
  );
}
```

### Features
- Debounced search (default 300ms)
- Clear button when input has value
- Search icon
- Auto-syncs with external value changes

### Props
- `value`: string - Search value
- `onChange`: (value: string) => void - Change handler
- `placeholder`: string - Placeholder text (default: "Search...")
- `debounceMs`: number - Debounce delay in ms (default: 300)
- `className`: string - Additional CSS classes

---

## Error Boundary

### Component: ErrorBoundary

**Location:** `frontend/src/components/ErrorBoundary.tsx`

### Usage

```tsx
import ErrorBoundary from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <YourApp />
    </ErrorBoundary>
  );
}

// With custom fallback
function MyComponent() {
  return (
    <ErrorBoundary
      fallback={
        <div>Custom error message</div>
      }
    >
      <RiskyComponent />
    </ErrorBoundary>
  );
}
```

### Features
- Catches JavaScript errors in child components
- Displays user-friendly error message
- Shows error details in development mode
- "Try Again" button to reset error state
- "Reload Page" button for full refresh
- Custom fallback UI support

### Props
- `children`: ReactNode - Components to wrap
- `fallback`: ReactNode - Custom error UI (optional)

---

## Design Tokens

### CSS Variables

**Location:** `frontend/src/index.css`

### Color Palette

```css
/* Light Mode */
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
--primary: 222.2 47.4% 11.2%;
--secondary: 210 40% 96.1%;
--destructive: 0 84.2% 60.2%;
--success: 142.1 76.2% 36.3%;        /* NEW */
--warning: 38 92% 50%;                /* NEW */
--info: 221.2 83.2% 53.3%;           /* NEW */
--muted: 210 40% 96.1%;
--accent: 210 40% 96.1%;
--border: 214.3 31.8% 91.4%;
--radius: 0.5rem;
```

### Usage in Components

```tsx
// Using in className
<Button className="bg-success text-success-foreground">
  Success Button
</Button>

// Using with variants
const buttonVariants = cva("...", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      destructive: "bg-destructive text-destructive-foreground",
      success: "bg-success text-success-foreground",      // NEW
      warning: "bg-warning text-warning-foreground",      // NEW
      info: "bg-info text-info-foreground",              // NEW
    }
  }
});
```

### Semantic Color Meanings

- **Primary**: Main brand color, primary actions
- **Secondary**: Less important actions, supporting UI
- **Destructive**: Delete, remove, critical errors (red)
- **Success**: Confirmations, successful operations (green)
- **Warning**: Cautions, alerts (yellow/orange)
- **Info**: Informational messages (blue)
- **Muted**: Disabled states, secondary text
- **Accent**: Highlights, focused states

---

## Best Practices

### 1. Toast Notifications

✅ **DO:**
- Use for transient feedback (success, error)
- Include descriptive text
- Use appropriate variant for context
- Keep messages concise

❌ **DON'T:**
- Use for critical errors that need user action
- Show multiple toasts simultaneously
- Use for permanent information display

### 2. Confirmation Dialogs

✅ **DO:**
- Use for destructive actions (delete, cancel)
- Clearly state what will happen
- Use descriptive button text
- Use "destructive" variant for dangerous actions

❌ **DON'T:**
- Overuse for every action
- Use vague descriptions
- Skip confirmation for destructive actions

### 3. Form Validation

✅ **DO:**
- Use shared validators for consistency
- Show errors below fields
- Validate on submit and on blur
- Use red color for errors
- Show required field indicators

❌ **DON'T:**
- Write custom validators for common fields
- Show errors before user interaction
- Use generic error messages

### 4. Empty States

✅ **DO:**
- Show helpful message
- Include call-to-action
- Use relevant icon
- Consider search/filter state

❌ **DON'T:**
- Leave page blank
- Show technical error messages
- Forget about filtered/searched states

### 5. Error Boundaries

✅ **DO:**
- Wrap entire app
- Wrap critical sections separately
- Log errors for debugging
- Provide recovery options

❌ **DON'T:**
- Catch errors that should propagate
- Show technical details to users in production
- Ignore error logs

---

## Migration Guide

### Updating Existing Pages

1. **Add Toast Notifications**
```tsx
// Before
alert('Customer deleted');

// After
import { toast } from 'sonner';
toast.success('Customer deleted', {
  description: 'Customer has been successfully deleted.'
});
```

2. **Replace window.confirm with ConfirmDialog**
```tsx
// Before
if (window.confirm('Delete customer?')) {
  deleteCustomer();
}

// After
const [dialogOpen, setDialogOpen] = useState(false);

<ConfirmDialog
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  title="Delete Customer"
  description="Are you sure?"
  onConfirm={deleteCustomer}
  variant="destructive"
/>
```

3. **Use Shared Validators**
```tsx
// Before
email: z.string().email().optional().or(z.literal('')),

// After
import { validators } from '@/lib/validators';
email: validators.email,
```

4. **Replace Empty Divs with EmptyState**
```tsx
// Before
{items.length === 0 && <div>No items found</div>}

// After
{items.length === 0 && (
  <EmptyState
    title="No items found"
    description="Get started by creating your first item"
    actionLabel="Create Item"
    onAction={() => navigate('/items/new')}
  />
)}
```

---

## Examples

### Complete CRUD Page Example

See `frontend/src/pages/CustomerList.tsx` for a complete example implementing:
- ✅ Toast notifications
- ✅ Confirmation dialogs
- ✅ Search with debounce
- ✅ Empty states
- ✅ Error handling

### Complete Form Example

See `frontend/src/pages/CustomerForm.tsx` for a complete example implementing:
- ✅ Shared validators
- ✅ Toast notifications on submit
- ✅ Error handling
- ✅ Form field validation

---

## Component Checklist

When creating a new page, ensure you use:

**List Pages:**
- [ ] SearchInput for search functionality
- [ ] EmptyState when no data
- [ ] ConfirmDialog for delete actions
- [ ] Toast for success/error feedback
- [ ] LoadingSpinner during data fetch

**Form Pages:**
- [ ] Shared validators from `@/lib/validators`
- [ ] Form field components (EmailField, PhoneField, etc.)
- [ ] Toast for success/error on submit
- [ ] Error display below fields
- [ ] LoadingSpinner on submit

**All Pages:**
- [ ] ErrorBoundary wrapper (if critical)
- [ ] Consistent color usage (CSS variables)
- [ ] Proper TypeScript types
- [ ] Accessibility (labels, ARIA)

---

## Support

For questions or issues with these components:
1. Check this documentation
2. Review example implementations in CustomerList and CustomerForm
3. Check component source code for inline comments
4. Raise an issue in the project repository

---

**Last Updated:** January 2025
**Version:** 1.0.0
