/**
 * EditButton Component
 *
 * A standardized edit button for navigating to edit pages or triggering edit mode.
 *
 * @example
 * <EditButton to={`/customers/${id}/edit`} />
 * <EditButton onClick={() => setEditMode(true)}>Edit Profile</EditButton>
 */
import { Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import type { ButtonProps } from '../ui/button';

export interface EditButtonProps extends Omit<ButtonProps, 'variant'> {
  /** Route to navigate to on click */
  to?: string;
  /** Whether to show the pencil icon (default: true) */
  showIcon?: boolean;
  /** Use default (primary) variant instead of outline (default: false) */
  primary?: boolean;
  /** Icon-only mode (no text) */
  iconOnly?: boolean;
}

export function EditButton({
  children = 'Edit',
  to,
  onClick,
  showIcon = true,
  primary = false,
  iconOnly = false,
  size,
  ...props
}: EditButtonProps) {
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
        variant="ghost"
        size="icon"
        onClick={handleClick}
        {...props}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant={primary ? 'default' : 'outline'}
      size={size}
      onClick={handleClick}
      {...props}
    >
      {showIcon && <Pencil className="h-4 w-4 mr-2" />}
      {children}
    </Button>
  );
}

export default EditButton;
