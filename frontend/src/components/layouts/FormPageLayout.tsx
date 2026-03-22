/**
 * FormPageLayout Component
 *
 * Complete layout for form pages combining header, content, and footer.
 *
 * @example
 * <FormPageLayout
 *   title="Edit Customer"
 *   backTo="/customers"
 *   onSave={handleSave}
 *   onCancel={() => navigate('/customers')}
 *   saving={isSaving}
 *   isDirty={form.formState.isDirty}
 * >
 *   <Card>
 *     <CardContent>
 *       {form fields}
 *     </CardContent>
 *   </Card>
 * </FormPageLayout>
 */
import type { ReactNode } from 'react';
import { Card, CardContent } from '../ui/card';
import { LoadingSpinner } from '../LoadingSpinner';
import { FormPageHeader } from './FormPageHeader';
import type { FormPageHeaderProps } from './FormPageHeader';
import { FormPageFooter } from './FormPageFooter';
import type { FormPageFooterProps } from './FormPageFooter';

export interface FormPageLayoutProps
  extends Omit<FormPageHeaderProps, 'className'>, Omit<FormPageFooterProps, 'className' | 'position'> {
  /** Form content */
  children: ReactNode;
  /** Whether the form is loading (initial load) */
  loading?: boolean;
  /** Loading message */
  loadingMessage?: string;
  /** Whether to track dirty state for unsaved changes warning */
  isDirty?: boolean;
  /** Footer button position */
  footerPosition?: 'left' | 'right' | 'between';
  /** Whether footer should be sticky */
  stickyFooter?: boolean;
  /** Whether to wrap content in a Card */
  useCard?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Header CSS class */
  headerClassName?: string;
  /** Footer CSS class */
  footerClassName?: string;
}

export function FormPageLayout({
  // Header props
  title,
  subtitle,
  backTo,
  onBack,
  backLabel,
  showBack,
  actions,

  // Footer props
  onSave,
  onCancel,
  onDelete,
  saving,
  deleting,
  saveDisabled,
  saveText,
  savingText,
  cancelText,
  deleteText,
  showSaveIcon,
  showDelete,

  // Layout props
  children,
  loading = false,
  loadingMessage = 'Loading...',
  isDirty: _isDirty,
  footerPosition = 'right',
  stickyFooter = false,
  useCard = false,
  className = '',
  headerClassName = '',
  footerClassName = '',
}: FormPageLayoutProps) {
  // Render loading state
  if (loading) {
    return (
      <div className={className}>
        <FormPageHeader
          title={title}
          subtitle={subtitle}
          backTo={backTo}
          onBack={onBack}
          backLabel={backLabel}
          showBack={showBack}
          actions={actions}
          className={headerClassName}
        />
        <Card>
          <CardContent className="py-12">
            <LoadingSpinner />
            {loadingMessage && <p className="text-center text-muted-foreground mt-4">{loadingMessage}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  const content = useCard ? (
    <Card>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  ) : (
    children
  );

  const hasFooterActions = onSave || onCancel || (showDelete && onDelete);

  return (
    <div className={className}>
      <FormPageHeader
        title={title}
        subtitle={subtitle}
        backTo={backTo}
        onBack={onBack}
        backLabel={backLabel}
        showBack={showBack}
        actions={actions}
        className={headerClassName}
      />

      {content}

      {hasFooterActions && (
        <FormPageFooter
          onSave={onSave}
          onCancel={onCancel}
          onDelete={onDelete}
          saving={saving}
          deleting={deleting}
          saveDisabled={saveDisabled}
          saveText={saveText}
          savingText={savingText}
          cancelText={cancelText}
          deleteText={deleteText}
          showSaveIcon={showSaveIcon}
          showDelete={showDelete}
          position={footerPosition}
          sticky={stickyFooter}
          className={footerClassName}
        />
      )}
    </div>
  );
}

export default FormPageLayout;
