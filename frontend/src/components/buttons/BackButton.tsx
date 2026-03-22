/**
 * BackButton Component
 *
 * A standardized back button for navigation.
 *
 * @example
 * <BackButton /> // Uses router.back()
 * <BackButton to="/customers" /> // Goes to specific route
 * <BackButton to="/customers">Back to List</BackButton>
 */
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import type { ButtonProps } from '../ui/button';

export interface BackButtonProps extends Omit<ButtonProps, 'variant'> {
  /** Route to navigate to (if not provided, uses browser history back) */
  to?: string;
  /** Whether to show the arrow icon (default: true) */
  showIcon?: boolean;
  /** Use ghost variant instead of outline (default: false) */
  ghost?: boolean;
}

export function BackButton({
  children = 'Back',
  to,
  onClick,
  showIcon = true,
  ghost = false,
  ...props
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e);
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <Button variant={ghost ? 'ghost' : 'outline'} onClick={handleClick} {...props}>
      {showIcon && <ArrowLeft className="h-4 w-4 mr-2" />}
      {children}
    </Button>
  );
}

export default BackButton;
