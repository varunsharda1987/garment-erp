/**
 * CancelButton Component
 *
 * A standardized cancel button for dismissing dialogs or navigating back.
 *
 * @example
 * <CancelButton onClick={() => navigate('/list')}>Cancel</CancelButton>
 * <CancelButton to="/customers">Cancel</CancelButton>
 */
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import type { ButtonProps } from '../ui/button';

export interface CancelButtonProps extends Omit<ButtonProps, 'variant'> {
  /** Route to navigate to on click (alternative to onClick) */
  to?: string;
  /** Whether to show the X icon (default: false) */
  showIcon?: boolean;
}

export function CancelButton({ children = 'Cancel', to, onClick, showIcon = false, ...props }: CancelButtonProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e);
    } else if (to) {
      navigate(to);
    }
  };

  return (
    <Button variant="outline" onClick={handleClick} {...props}>
      {showIcon && <X className="h-4 w-4 mr-2" />}
      {children}
    </Button>
  );
}

export default CancelButton;
