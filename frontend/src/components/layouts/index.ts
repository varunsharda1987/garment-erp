/**
 * Layout Components
 *
 * Reusable layout components for list and form pages.
 *
 * @example
 * // List page
 * import { ListPageLayout } from '@/components/layouts';
 *
 * <ListPageLayout
 *   title="Customers"
 *   createButton={{ label: "New Customer", to: "/customers/new" }}
 *   search={search}
 *   onSearchChange={setSearch}
 *   loading={isLoading}
 *   empty={customers.length === 0}
 *   pagination={paginationProps}
 *   totalPages={totalPages}
 *   totalItems={totalItems}
 * >
 *   <DataTable columns={columns} data={customers} />
 * </ListPageLayout>
 *
 * // Form page
 * import { FormPageLayout } from '@/components/layouts';
 *
 * <FormPageLayout
 *   title="Edit Customer"
 *   backTo="/customers"
 *   onSave={handleSave}
 *   onCancel={() => navigate('/customers')}
 *   saving={isSaving}
 * >
 *   {form content}
 * </FormPageLayout>
 */

// List page components
export { ListPageLayout } from './ListPageLayout';
export type { ListPageLayoutProps } from './ListPageLayout';

export { ListPageHeader } from './ListPageHeader';
export type { ListPageHeaderProps, CreateButtonConfig } from './ListPageHeader';

export { ListPageToolbar } from './ListPageToolbar';
export type { ListPageToolbarProps } from './ListPageToolbar';

// Form page components
export { FormPageLayout } from './FormPageLayout';
export type { FormPageLayoutProps } from './FormPageLayout';

export { FormPageHeader } from './FormPageHeader';
export type { FormPageHeaderProps } from './FormPageHeader';

export { FormPageFooter } from './FormPageFooter';
export type { FormPageFooterProps } from './FormPageFooter';
