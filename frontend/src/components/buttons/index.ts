/**
 * Action Button Library
 *
 * Standardized buttons for common actions across the application.
 * All buttons use the unified Button component and follow consistent patterns.
 *
 * @example
 * import { SaveButton, CancelButton, DeleteButton } from '@/components/buttons';
 *
 * <SaveButton loading={isSaving} onClick={handleSave}>Save Changes</SaveButton>
 * <CancelButton to="/customers">Cancel</CancelButton>
 * <DeleteButton onConfirm={handleDelete} confirmTitle="Delete this item?" />
 */

export { SaveButton } from './SaveButton';
export type { SaveButtonProps } from './SaveButton';

export { CancelButton } from './CancelButton';
export type { CancelButtonProps } from './CancelButton';

export { DeleteButton } from './DeleteButton';
export type { DeleteButtonProps } from './DeleteButton';

export { EditButton } from './EditButton';
export type { EditButtonProps } from './EditButton';

export { AddButton } from './AddButton';
export type { AddButtonProps } from './AddButton';

export { BackButton } from './BackButton';
export type { BackButtonProps } from './BackButton';

export { RefreshButton } from './RefreshButton';
export type { RefreshButtonProps } from './RefreshButton';

export { PrintButton } from './PrintButton';
export type { PrintButtonProps } from './PrintButton';
