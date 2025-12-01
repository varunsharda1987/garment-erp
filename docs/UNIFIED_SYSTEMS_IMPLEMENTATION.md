# Unified Systems Implementation Plan

This document outlines all the system-wide components and utilities that need to be unified across the garment ERP application.

---

## Table of Contents

1. [Unified Export System](#1-unified-export-system)
2. [Unified Notification Service](#2-unified-notification-service)
3. [Pagination Hook & Standardization](#3-pagination-hook--standardization)
4. [Action Button Library](#4-action-button-library)
5. [List Page Template](#5-list-page-template)
6. [Form Page Template](#6-form-page-template)
7. [Confirmation Dialog System](#7-confirmation-dialog-system)
8. [Filter/Search System](#8-filtersearch-system)
9. [Bulk Actions System](#9-bulk-actions-system)
10. [Print Functionality](#10-print-functionality)

---

## 1. Unified Export System

### Current State
- Backend export service exists at `backend/src/services/export.service.ts` (CSV, Excel, PDF)
- ~~Frontend `ExportButton.tsx` exists but uses custom button styling instead of `Button` component~~
- ~~Export works but UI is inconsistent~~

### Status: PARTIALLY COMPLETE

### Tasks
- [x] **1.1** Refactor `ExportButton.tsx` to use the unified `Button` component *(Completed 2025-01-30)*
- [x] **1.1b** Refactor `ImportButton.tsx` to use the unified `Button` component *(Completed 2025-01-30)*
- [ ] **1.2** Add "Export All" vs "Export Selected" options
- [ ] **1.3** Add print functionality to export dropdown
- [ ] **1.4** Create standardized column configurations per module
- [ ] **1.5** Add export progress indicator for large datasets

### Implementation Notes (2025-01-30)
- Refactored `ExportButton.tsx` to use:
  - `Button` component with `variant="outline"`
  - `DropdownMenu` component from Radix UI
  - Lucide React icons (`Download`, `FileSpreadsheet`, `FileText`, `ChevronDown`, `Loader2`)
  - Unified `notify` service for success/error messages
- Refactored `ImportButton.tsx` to use:
  - Same component pattern as ExportButton
  - `DropdownMenuSeparator` and `DropdownMenuLabel` for better UX
  - Unified `notify` service for success/error messages

### Files Modified
- `frontend/src/components/ExportButton.tsx` - Completely refactored
- `frontend/src/components/ImportButton.tsx` - Completely refactored

### New Files
- `frontend/src/config/export-columns.ts` - Centralized column configs per module (TODO)

---

## 2. Unified Notification Service

### Current State
- ~~Mixed usage of `react-hot-toast` and `sonner`~~
- ~~No centralized notification wrapper~~
- ~~Inconsistent toast styling and positioning~~

### Status: COMPLETE

### Tasks
- [x] **2.1** Create `notify` service wrapper around `sonner` *(Completed 2025-01-30)*
- [x] **2.2** Remove all `react-hot-toast` usage *(Completed 2025-01-30)*
- [x] **2.3** Standardize notification patterns (success, error, warning, info, loading) *(Completed 2025-01-30)*
- [x] **2.4** Add notification for async operations with loading state *(Completed 2025-01-30)*

### Implementation Notes (2025-01-30)
- Created `frontend/src/lib/notify.ts` with unified notification API
- Removed duplicate `react-hot-toast` Toaster from `main.tsx`
- Only `sonner` Toaster remains in `App.tsx`
- Updated all files to use `notify` instead of direct toast imports:
  - `StyleFormRedesigned.tsx`
  - `CostSheetForm.tsx`
  - `ComponentMasters.tsx`
  - `CadAverageManagement.tsx`
  - `CADPlanningPage.tsx`
  - `CustomerForm.tsx`
  - `FileUpload.tsx`
  - `api-error-handler.ts`
  - `useStyleFormData.ts`

### Files Created
- `frontend/src/lib/notify.ts`

### Files Modified
- `frontend/src/main.tsx` - Removed react-hot-toast Toaster
- All files listed above - Updated to use `notify`

### API Design
```typescript
// Usage examples:
notify.success("Record saved successfully")
notify.error("Failed to save")
notify.warning("Unsaved changes will be lost")
notify.info("Processing your request...")
notify.loading("Saving...")
notify.promise(promise, { loading: "...", success: "...", error: "..." })
notify.dismiss(toastId)
```

---

## 3. Pagination Hook & Standardization

### Current State
- `Pagination.tsx` component exists and is well-built
- ~~Every list page repeats pagination state logic~~
- ~~`CostSheetList.tsx` uses custom inline pagination~~
- Inconsistent naming (`page` vs `currentPage`) - TODO: fix remaining pages
- Inconsistent default page sizes (10 vs 20) - TODO: standardize

### Status: PARTIALLY COMPLETE

### Tasks
- [x] **3.1** Create `usePagination` hook to eliminate boilerplate *(Completed 2025-01-30)*
- [x] **3.2** Fix `CostSheetList.tsx` to use Pagination component *(Completed 2025-01-30)*
- [ ] **3.3** Standardize naming to `currentPage`/`setCurrentPage` in remaining pages
- [ ] **3.4** Standardize default page size to 10 in all pages
- [ ] **3.5** (Optional) Add URL query param sync for pagination

### Implementation Notes (2025-01-30)
- Created `frontend/src/hooks/usePagination.ts` with:
  - `currentPage`, `pageSize` state management
  - `resetPage()` function for filter changes
  - `paginationProps` object to spread on Pagination component
  - `apiParams` object for API calls ({ page, limit })
  - `offset` and `limit` for alternative API patterns
- Created `frontend/src/hooks/index.ts` barrel export
- Updated `CostSheetList.tsx` to use the hook and Pagination component

### Files Created
- `frontend/src/hooks/usePagination.ts`
- `frontend/src/hooks/index.ts`

### Files Modified
- `frontend/src/pages/CostSheetList.tsx` - Now uses usePagination hook and Pagination component

### Files to Update (TODO)
- `frontend/src/pages/CustomerList.tsx` - Rename `page` to `currentPage`
- `frontend/src/pages/BOMList.tsx` - Change default from 20 to 10

### Hook API Design
```typescript
const {
  currentPage,
  pageSize,
  setCurrentPage,
  setPageSize,
  resetPage,           // Reset to page 1 (for filter changes)
  paginationProps,     // Spread into <Pagination {...paginationProps} />
  apiParams,           // { page, limit } for API calls
  offset,              // (currentPage - 1) * pageSize
  limit,               // same as pageSize
} = usePagination({ defaultPageSize: 10 });
```

---

## 4. Action Button Library

### Current State
- `Button` component exists with variants (default, destructive, outline, etc.)
- ~~No pre-built action buttons with icons and loading states~~
- ~~Each page creates its own Save/Cancel/Delete buttons~~

### Status: COMPLETE

### Tasks
- [x] **4.1** Create `SaveButton` with loading state *(Completed 2025-01-30)*
- [x] **4.2** Create `CancelButton` *(Completed 2025-01-30)*
- [x] **4.3** Create `DeleteButton` with confirmation integration *(Completed 2025-01-30)*
- [x] **4.4** Create `EditButton` *(Completed 2025-01-30)*
- [x] **4.5** Create `AddButton` *(Completed 2025-01-30)*
- [x] **4.6** Create `BackButton` *(Completed 2025-01-30)*
- [x] **4.7** Create `RefreshButton` *(Completed 2025-01-30)*
- [ ] **4.8** Create `PrintButton` (deferred to Print Functionality section)

### Implementation Notes (2025-01-30)
- Created 7 standardized action buttons in `frontend/src/components/buttons/`
- All buttons:
  - Use the unified `Button` component
  - Include Lucide icons
  - Support loading states where applicable
  - Have TypeScript interfaces exported
  - Include JSDoc documentation with examples

**Button Features:**
| Button | Features |
|--------|----------|
| SaveButton | loading state, loadingText, showIcon option |
| CancelButton | `to` prop for navigation, showIcon option |
| DeleteButton | built-in confirmation dialog, loading state, outline option |
| EditButton | `to` prop for navigation, iconOnly mode, primary option |
| AddButton | `to` prop for navigation, iconOnly mode, outline option |
| BackButton | `to` prop or history.back(), ghost option |
| RefreshButton | loading state with spinning icon, iconOnly mode |

### Files Created
- `frontend/src/components/buttons/SaveButton.tsx`
- `frontend/src/components/buttons/CancelButton.tsx`
- `frontend/src/components/buttons/DeleteButton.tsx`
- `frontend/src/components/buttons/EditButton.tsx`
- `frontend/src/components/buttons/AddButton.tsx`
- `frontend/src/components/buttons/BackButton.tsx`
- `frontend/src/components/buttons/RefreshButton.tsx`
- `frontend/src/components/buttons/index.ts` - Barrel export

### Component API Design
```typescript
// Import
import { SaveButton, CancelButton, DeleteButton, EditButton, AddButton, BackButton, RefreshButton } from '@/components/buttons';

// SaveButton
<SaveButton loading={isSaving} onClick={handleSave}>Save</SaveButton>
<SaveButton loading={isSaving} loadingText="Saving..." showIcon={false}>Save</SaveButton>

// CancelButton
<CancelButton onClick={handleCancel}>Cancel</CancelButton>
<CancelButton to="/customers">Cancel</CancelButton>

// DeleteButton - with built-in confirmation
<DeleteButton onClick={handleDelete}>Delete</DeleteButton>
<DeleteButton
  onConfirm={handleDelete}
  confirmTitle="Delete Customer?"
  confirmDescription="This action cannot be undone."
/>

// EditButton
<EditButton to={`/customers/${id}/edit`} />
<EditButton onClick={() => setEditMode(true)} iconOnly />

// AddButton
<AddButton to="/customers/new">New Customer</AddButton>
<AddButton onClick={handleAddRow} iconOnly />

// BackButton
<BackButton /> // Uses router.back()
<BackButton to="/customers">Back to List</BackButton>

// RefreshButton
<RefreshButton onClick={refetch} loading={isRefreshing} />
<RefreshButton onClick={refetch} iconOnly />
```

---

## 5. List Page Template

### Current State
- ~~All list pages repeat the same structure~~
- ~~Lots of duplicated code~~

### Status: COMPLETE

### Tasks
- [x] **5.1** Create `ListPageLayout` component *(Completed 2025-01-30)*
- [x] **5.2** Create `ListPageHeader` component *(Completed 2025-01-30)*
- [x] **5.3** Create `ListPageToolbar` component (search + filters + actions) *(Completed 2025-01-30)*
- [ ] **5.4** Create `useListPage` hook for common state management (optional enhancement)
- [ ] **5.5** Refactor one list page as proof of concept (optional)

### Implementation Notes (2025-01-30)
- Created complete list page template system in `frontend/src/components/layouts/`
- **ListPageHeader**: Title + subtitle + create button + custom actions
- **ListPageToolbar**: Search + filters + export/import buttons + clear filters
- **ListPageLayout**: Complete layout combining header, toolbar, content, and pagination
  - Handles loading, error, and empty states automatically
  - Integrates with ExportButton and ImportButton
  - Accepts filter components as children
  - Uses Pagination component with usePagination hook

### Files Created
- `frontend/src/components/layouts/ListPageLayout.tsx`
- `frontend/src/components/layouts/ListPageHeader.tsx`
- `frontend/src/components/layouts/ListPageToolbar.tsx`
- `frontend/src/components/layouts/index.ts`

### Component API Design
```typescript
import { ListPageLayout } from '@/components/layouts';

<ListPageLayout
  title="Customers"
  subtitle="Manage your customer records"
  createButton={{ label: "New Customer", to: "/customers/new" }}
  search={search}
  onSearchChange={setSearch}
  searchPlaceholder="Search customers..."
  exportModule="customers"
  exportFilters={{ status: statusFilter }}
  importModule="customers"
  onImportSuccess={refetch}
  filters={<CustomerFilters />}
  onClearFilters={resetFilters}
  hasActiveFilters={!!search || statusFilter !== 'all'}
  loading={isLoading}
  error={error}
  onRetry={refetch}
  empty={customers.length === 0}
  emptyTitle="No customers found"
  emptyDescription="Create your first customer to get started"
  pagination={paginationProps}
  totalPages={totalPages}
  totalItems={totalItems}
>
  <DataTable columns={columns} data={customers} />
</ListPageLayout>
```

---

## 6. Form Page Template

### Current State
- ~~Form pages have common patterns implemented independently~~
- ~~Each form implements header/footer/unsaved changes independently~~

### Status: COMPLETE

### Tasks
- [x] **6.1** Create `FormPageLayout` component *(Completed 2025-01-30)*
- [x] **6.2** Create `FormPageHeader` component *(Completed 2025-01-30)*
- [x] **6.3** Create `FormPageFooter` component (Save/Cancel) *(Completed 2025-01-30)*
- [ ] **6.4** Create `useFormPage` hook for common logic (optional enhancement)
- [x] **6.5** Add unsaved changes warning (beforeunload + route change) *(Completed 2025-01-30)*
- [ ] **6.6** Refactor one form page as proof of concept (optional)

### Implementation Notes (2025-01-30)
- Created complete form page template system in `frontend/src/components/layouts/`
- **FormPageHeader**: Title + subtitle + back button + custom actions
- **FormPageFooter**: Save + Cancel + Delete buttons with loading states
- **FormPageLayout**: Complete layout combining header, content, footer
  - Handles loading state automatically
  - Integrates with useUnsavedChanges hook
  - Shows UnsavedChangesDialog when navigating with unsaved changes
  - Built-in dirty state tracking
- **useUnsavedChanges hook**:
  - Handles browser beforeunload event
  - Handles React Router navigation blocking via useBlocker
  - Returns dialog component and state management functions

### Files Created
- `frontend/src/components/layouts/FormPageLayout.tsx`
- `frontend/src/components/layouts/FormPageHeader.tsx`
- `frontend/src/components/layouts/FormPageFooter.tsx`
- `frontend/src/hooks/useUnsavedChanges.ts`

### Files Modified
- `frontend/src/components/layouts/index.ts` - Added form page exports
- `frontend/src/hooks/index.ts` - Added useUnsavedChanges export

### Component API Design
```typescript
import { FormPageLayout } from '@/components/layouts';

// Basic usage
<FormPageLayout
  title="Edit Customer"
  backTo="/customers"
  onSave={handleSave}
  onCancel={() => navigate('/customers')}
  saving={isSaving}
>
  <FormSection title="Basic Information">
    {/* form fields */}
  </FormSection>
</FormPageLayout>

// With unsaved changes tracking
<FormPageLayout
  title="Edit Customer"
  backTo="/customers"
  onSave={handleSave}
  onCancel={() => navigate('/customers')}
  saving={isSaving}
  isDirty={form.formState.isDirty}
  enableUnsavedWarning
>
  {/* form content */}
</FormPageLayout>

// With delete button
<FormPageLayout
  title="Edit Customer"
  backTo="/customers"
  onSave={handleSave}
  onCancel={() => navigate('/customers')}
  onDelete={handleDelete}
  saving={isSaving}
  deleting={isDeleting}
  showDelete={!!customerId}
>
  {/* form content */}
</FormPageLayout>
```

### useUnsavedChanges Hook API
```typescript
import { useUnsavedChanges } from '@/hooks';

const {
  isDirty,
  setIsDirty,
  showDialog,
  setShowDialog,
  UnsavedDialog,
  promptUnsaved,  // Returns Promise<'cancel' | 'discard' | 'save'>
} = useUnsavedChanges({
  enabled: true,
  message: 'You have unsaved changes that will be lost.',
});

// Render the dialog
<UnsavedDialog onDiscard={handleDiscard} onSave={handleSave} />
```

---

## 7. Confirmation Dialog System

### Current State
- `ConfirmDialog.tsx` exists and works well
- ~~Some pages use inline confirmation logic~~
- ~~No specialized dialogs for common actions~~

### Status: COMPLETE

### Tasks
- [x] **7.1** Create `ConfirmDeleteDialog` preset *(Completed 2025-01-30)*
- [x] **7.2** Create `UnsavedChangesDialog` preset *(Completed 2025-01-30)*
- [ ] **7.3** Create `BulkActionConfirmDialog` for bulk operations (deferred to Bulk Actions section)
- [x] **7.4** Create `useConfirmDialog` hook for imperative usage *(Completed 2025-01-30)*

### Implementation Notes (2025-01-30)
- Created `useConfirmDialog` hook with promise-based API
- Created `ConfirmDeleteDialog` preset with:
  - Auto-generated title/description from `itemName`
  - Loading state support
  - Destructive styling
- Created `UnsavedChangesDialog` preset with:
  - Cancel/Discard/Save options
  - Saving state support

### Files Created
- `frontend/src/hooks/useConfirmDialog.ts`
- `frontend/src/components/dialogs/ConfirmDeleteDialog.tsx`
- `frontend/src/components/dialogs/UnsavedChangesDialog.tsx`
- `frontend/src/components/dialogs/index.ts`

### Hook API Design
```typescript
import { useConfirmDialog } from '@/hooks';
import { ConfirmDeleteDialog, UnsavedChangesDialog } from '@/components/dialogs';

// Imperative usage with useConfirmDialog
const { confirm, ConfirmDialog } = useConfirmDialog();

const handleDelete = async () => {
  const confirmed = await confirm({
    title: "Delete Item?",
    description: "This cannot be undone.",
    confirmText: "Delete",
    destructive: true
  });

  if (confirmed) {
    await deleteItem();
  }
};

// Don't forget to render the dialog in JSX:
<ConfirmDialog />

// Or use preset dialogs declaratively:
<ConfirmDeleteDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  itemName="Customer ABC"
  onConfirm={handleDelete}
  loading={isDeleting}
/>

<UnsavedChangesDialog
  open={showWarning}
  onOpenChange={setShowWarning}
  onDiscard={handleDiscard}
  onSave={handleSave}
  saving={isSaving}
/>
```

---

## 8. Filter/Search System

### Current State
- `SearchInput.tsx` exists with debouncing
- ~~Filters are implemented differently on each page~~
- ~~No unified filter bar component~~
- Filter state not synced with URL (optional future enhancement)

### Status: COMPLETE

### Tasks
- [x] **8.1** Create `FilterBar` container component *(Completed 2025-01-30)*
- [x] **8.2** Create `DateRangeFilter` component *(Completed 2025-01-30)*
- [x] **8.3** Create `StatusFilter` component *(Completed 2025-01-30)*
- [x] **8.4** Create `SelectFilter` component *(Completed 2025-01-30)*
- [ ] **8.5** Create `useFilters` hook with URL sync (optional enhancement)
- [x] **8.6** Add "Clear All Filters" button (built into FilterBar) *(Completed 2025-01-30)*

### Implementation Notes (2025-01-30)
- Created 4 filter components in `frontend/src/components/filters/`
- **FilterBar**: Container with clear button, shows when `hasActiveFilters` is true
- **SelectFilter**: Generic dropdown with label, options array
- **StatusFilter**: Specialized dropdown with common status presets (active/inactive/pending/etc.)
- **DateRangeFilter**: From/To date inputs with validation (to >= from)

### Files Created
- `frontend/src/components/filters/FilterBar.tsx`
- `frontend/src/components/filters/SelectFilter.tsx`
- `frontend/src/components/filters/StatusFilter.tsx`
- `frontend/src/components/filters/DateRangeFilter.tsx`
- `frontend/src/components/filters/index.ts`

### Component API Design
```typescript
import { FilterBar, SelectFilter, StatusFilter, DateRangeFilter } from '@/components/filters';
import SearchInput from '@/components/SearchInput';

// Check if any filters are active
const hasActiveFilters = search || status !== 'all' || fromDate || toDate;

// Reset all filters
const resetFilters = () => {
  setSearch('');
  setStatus('all');
  setFromDate('');
  setToDate('');
};

<FilterBar onClear={resetFilters} hasActiveFilters={hasActiveFilters}>
  <SearchInput value={search} onChange={setSearch} placeholder="Search..." />

  <SelectFilter
    label="Category"
    value={category}
    onChange={setCategory}
    options={[
      { value: 'all', label: 'All Categories' },
      { value: 'fabric', label: 'Fabric' },
      { value: 'trim', label: 'Trim' },
    ]}
  />

  <StatusFilter
    value={status}
    onChange={setStatus}
    statuses={['active', 'inactive', 'pending']}
  />

  <DateRangeFilter
    label="Date Range"
    from={fromDate}
    to={toDate}
    onChange={({ from, to }) => {
      setFromDate(from);
      setToDate(to);
    }}
  />
</FilterBar>
```

---

## 9. Bulk Actions System

### Current State
- ~~No bulk selection/action capability~~
- ~~Users must act on items one by one~~
- ~~No "Select All" functionality~~

### Status: COMPLETE

### Tasks
- [x] **9.1** Create `useRowSelection` hook *(Completed 2025-01-30)*
- [x] **9.2** Add checkbox column to DataTable *(Completed 2025-01-30)*
- [x] **9.3** Create `BulkActionsBar` component *(Completed 2025-01-30)*
- [ ] **9.4** Implement bulk delete (per-page implementation)
- [ ] **9.5** Implement bulk export (per-page implementation)
- [ ] **9.6** Implement bulk status change (per-page implementation)

### Implementation Notes (2025-01-30)
- Created `useRowSelection` hook with:
  - `selectedIds`, `isSelected()`, `isAllSelected`, `isIndeterminate`
  - `toggleRow()`, `toggleAll()`, `selectRows()`, `clearSelection()`
  - `selectionCount`, `getSelectedItems()`
  - Callback support via `onSelectionChange`
- Created `BulkActionsBar` component:
  - Shows selection count with clear button
  - Accepts action buttons as children
  - Responsive layout
- Created `SelectionColumn` helper:
  - `createSelectionColumn()` - creates checkbox column for DataTable
  - `SelectionHeader`, `SelectionCell` - standalone checkbox components
  - Works with existing DataTable without modification

### Files Created
- `frontend/src/hooks/useRowSelection.ts`
- `frontend/src/components/BulkActionsBar.tsx`
- `frontend/src/components/SelectionColumn.tsx`

### Files Modified
- `frontend/src/hooks/index.ts` - Added useRowSelection export

### Component API Design
```typescript
import { useRowSelection } from '@/hooks';
import { createSelectionColumn } from '@/components/SelectionColumn';
import BulkActionsBar from '@/components/BulkActionsBar';

// Setup selection
const selection = useRowSelection(data, { idKey: 'id' });
const selectionColumn = createSelectionColumn(selection);

// Add to columns
const columns = [
  selectionColumn,
  { key: 'name', header: 'Name' },
  // ... other columns
];

// Render bulk actions bar when items selected
{selection.selectionCount > 0 && (
  <BulkActionsBar count={selection.selectionCount} onClear={selection.clearSelection}>
    <Button variant="destructive" onClick={handleBulkDelete}>
      Delete Selected
    </Button>
    <Button variant="outline" onClick={handleBulkExport}>
      Export Selected
    </Button>
  </BulkActionsBar>
)}

// Get selected items for operations
const handleBulkDelete = async () => {
  const selectedItems = selection.getSelectedItems(data);
  // Process items...
  selection.clearSelection();
};
```

---

## 10. Print Functionality

### Current State
- ~~No print functionality~~
- ~~Users must export to PDF then print~~

### Status: COMPLETE

### Tasks
- [x] **10.1** Create `usePrint` hook *(Completed 2025-01-30)*
- [x] **10.2** Create print-friendly CSS styles *(Completed 2025-01-30)*
- [x] **10.3** Create PrintButton component *(Completed 2025-01-30)*
- [ ] **10.4** Create printable versions of key pages (per-page implementation)
- [ ] **10.5** Add print option to export dropdown (optional enhancement)

### Implementation Notes (2025-01-30)
- Created `usePrint` hook with:
  - `print()` - triggers window.print()
  - `isPrinting` - loading state
  - `printRef` - ref for printable content
  - `setTitle()` - set document title for printing
  - Adds/removes `.printing` class on body for CSS targeting
- Created `print.css` with:
  - `.no-print` - hides elements when printing
  - `.print-only` - shows elements only when printing
  - `.print-break-before/after` - page break utilities
  - `.print-avoid-break` - prevents page breaks inside element
  - `.print-header`, `.print-footer` - special print sections
  - Automatic hiding of nav, buttons, dialogs, etc.
  - Table formatting for print
- Created `PrintButton` component:
  - Loading state with spinner
  - Icon-only mode
  - Consistent with other action buttons

### Files Created
- `frontend/src/hooks/usePrint.ts`
- `frontend/src/styles/print.css`
- `frontend/src/components/buttons/PrintButton.tsx`

### Files Modified
- `frontend/src/hooks/index.ts` - Added usePrint export
- `frontend/src/components/buttons/index.ts` - Added PrintButton export

### Usage Notes
Import print.css in your main entry point to enable print styles:
```typescript
// In main.tsx or App.tsx
import '@/styles/print.css';
```

### Component API Design
```typescript
import { usePrint, PrintButton } from '@/hooks';

// Setup print
const { print, isPrinting, printRef, setTitle } = usePrint({
  title: 'Invoice #1234',
  onBeforePrint: () => console.log('Preparing to print...'),
  onAfterPrint: () => console.log('Print complete'),
});

// Wrap printable content
<div ref={printRef}>
  <div className="print-header">
    <h1>Invoice #1234</h1>
    <p className="print-date">{new Date().toLocaleDateString()}</p>
  </div>

  {/* Content that will be printed */}
  <InvoiceContent />

  {/* Elements to hide when printing */}
  <div className="no-print">
    <Button>Edit Invoice</Button>
  </div>
</div>

// Print button
<PrintButton onClick={print} loading={isPrinting} />
<PrintButton onClick={print} iconOnly />
```

---

## Implementation Priority

| Priority | System | Effort | Impact | Dependencies |
|----------|--------|--------|--------|--------------|
| 1 | Unified Notification Service | Low | High | None |
| 2 | Pagination Hook | Low | Medium | None |
| 3 | Export System Fix | Low | High | None |
| 4 | Action Button Library | Medium | High | None |
| 5 | Confirmation Dialog System | Low | Medium | Action Buttons |
| 6 | Filter/Search System | Medium | High | None |
| 7 | List Page Template | High | Very High | Pagination, Filters, Buttons |
| 8 | Form Page Template | High | Very High | Action Buttons, Dialogs |
| 9 | Bulk Actions System | Medium | Medium | DataTable, Dialogs |
| 10 | Print Functionality | Low | Low | None |

---

## Recommended Implementation Order

### Phase 1: Quick Wins (Low effort, High impact)
1. Unified Notification Service
2. Pagination Hook & Fixes
3. Export/Import Button Fix

### Phase 2: Foundation Components
4. Action Button Library
5. Confirmation Dialog System
6. Filter/Search System

### Phase 3: Templates (Biggest impact, needs foundation)
7. List Page Template
8. Form Page Template

### Phase 4: Enhancements
9. Bulk Actions System
10. Print Functionality

---

## File Structure After Implementation

```
frontend/src/
├── components/
│   ├── buttons/
│   │   ├── SaveButton.tsx
│   │   ├── CancelButton.tsx
│   │   ├── DeleteButton.tsx
│   │   ├── EditButton.tsx
│   │   ├── AddButton.tsx
│   │   ├── BackButton.tsx
│   │   ├── RefreshButton.tsx
│   │   ├── PrintButton.tsx
│   │   └── index.ts
│   ├── dialogs/
│   │   ├── ConfirmDeleteDialog.tsx
│   │   ├── UnsavedChangesDialog.tsx
│   │   ├── BulkActionConfirmDialog.tsx
│   │   └── index.ts
│   ├── filters/
│   │   ├── FilterBar.tsx
│   │   ├── DateRangeFilter.tsx
│   │   ├── StatusFilter.tsx
│   │   ├── SelectFilter.tsx
│   │   └── index.ts
│   ├── layouts/
│   │   ├── ListPageLayout.tsx
│   │   ├── ListPageHeader.tsx
│   │   ├── ListPageToolbar.tsx
│   │   ├── FormPageLayout.tsx
│   │   ├── FormPageHeader.tsx
│   │   ├── FormPageFooter.tsx
│   │   └── index.ts
│   ├── BulkActionsBar.tsx
│   ├── DataTable.tsx (modified)
│   ├── ExportButton.tsx (modified)
│   ├── ImportButton.tsx (modified)
│   └── Pagination.tsx (existing)
├── hooks/
│   ├── usePagination.ts
│   ├── useListPage.ts
│   ├── useFormPage.ts
│   ├── useUnsavedChanges.ts
│   ├── useConfirmDialog.ts
│   ├── useFilters.ts
│   ├── useRowSelection.ts
│   └── usePrint.ts
├── lib/
│   ├── notify.ts
│   └── ... (existing)
├── config/
│   └── export-columns.ts
└── styles/
    └── print.css
```

---

## Notes

- Each implementation should include TypeScript types
- Add JSDoc comments for public APIs
- Write unit tests for hooks
- Update existing pages incrementally (don't refactor all at once)
- Maintain backwards compatibility during transition
