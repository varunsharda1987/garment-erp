/**
 * FormPageHeader Component
 *
 * Header section for form pages with title and back button.
 *
 * @example
 * <FormPageHeader
 *   title="Edit Customer"
 *   backTo="/customers"
 * />
 */
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';

export interface FormPageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Route to navigate back to */
  backTo?: string;
  /** Back button click handler (alternative to backTo) */
  onBack?: () => void;
  /** Back button label (default: "Back") */
  backLabel?: string;
  /** Whether to show back button (default: true if backTo or onBack provided) */
  showBack?: boolean;
  /** Additional action buttons to render on the right */
  actions?: React.ReactNode;
  /** Additional CSS class */
  className?: string;
}

export function FormPageHeader({
  title,
  subtitle,
  backTo,
  onBack,
  backLabel = 'Back',
  showBack,
  actions,
  className = '',
}: FormPageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  const shouldShowBack = showBack ?? (backTo !== undefined || onBack !== undefined);

  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {shouldShowBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {backLabel}
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-display font-medium text-foreground">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export default FormPageHeader;
