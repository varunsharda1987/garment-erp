/**
 * ListPageHeader Component
 *
 * Header section for list pages with title and action buttons.
 *
 * @example
 * <ListPageHeader
 *   title="Customers"
 *   createButton={{ label: "New Customer", to: "/customers/new" }}
 * />
 */
import React from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';

export interface CreateButtonConfig {
  /** Button label */
  label: string;
  /** Route to navigate to */
  to?: string;
  /** Click handler (alternative to `to`) */
  onClick?: () => void;
  /** Whether to show the plus icon (default: true) */
  showIcon?: boolean;
}

export interface ListPageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Create button configuration */
  createButton?: CreateButtonConfig;
  /** Additional action buttons to render */
  actions?: React.ReactNode;
  /** Additional CSS class */
  className?: string;
}

export function ListPageHeader({
  title,
  subtitle,
  createButton,
  actions,
  className = '',
}: ListPageHeaderProps) {
  const navigate = useNavigate();

  const handleCreateClick = () => {
    if (createButton?.onClick) {
      createButton.onClick();
    } else if (createButton?.to) {
      navigate(createButton.to);
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 ${className}`}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {createButton && (
          <Button onClick={handleCreateClick}>
            {createButton.showIcon !== false && <Plus className="h-4 w-4 mr-2" />}
            {createButton.label}
          </Button>
        )}
      </div>
    </div>
  );
}

export default ListPageHeader;
