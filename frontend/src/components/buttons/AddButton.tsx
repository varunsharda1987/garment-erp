/**
 * AddButton Component
 *
 * A standardized add/create button for creating new records.
 *
 * @example
 * <AddButton to="/customers/new">New Customer</AddButton>
 * <AddButton onClick={handleAddRow}>Add Row</AddButton>
 * <AddButton iconOnly onClick={handleAdd} />
 */
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import type { ButtonProps } from '../ui/button';

export interface AddButtonProps extends Omit<ButtonProps, 'variant'> {
  /** Route to navigate to on click */
  to?: string;
  /** Whether to show the plus icon (default: true) */
  showIcon?: boolean;
  /** Use outline variant instead of default (default: false) */
  outline?: boolean;
  /** Icon-only mode (no text) */
  iconOnly?: boolean;
}

export function AddButton({
  children = 'Add New',
  to,
  onClick,
  showIcon = true,
  outline = false,
  iconOnly = false,
  size,
  ...props
}: AddButtonProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e);
    } else if (to) {
      navigate(to);
    }
  };

  if (iconOnly) {
    return (
      <Button
        variant={outline ? 'outline' : 'default'}
        size="icon"
        onClick={handleClick}
        {...props}
      >
        <Plus className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant={outline ? 'outline' : 'default'}
      size={size}
      onClick={handleClick}
      {...props}
    >
      {showIcon && <Plus className="h-4 w-4 mr-2" />}
      {children}
    </Button>
  );
}

export default AddButton;
