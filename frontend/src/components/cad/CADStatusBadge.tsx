/**
 * CADStatusBadge Component
 *
 * Visual indicator for CAD Planning status across the application.
 * Shows color-coded badge with appropriate icon and label.
 *
 * Used in: StylesPage, StyleForm, CostSheetForm, CADPlanningPage
 */

import React from 'react';
import { CheckCircle, Clock, AlertCircle, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type CADStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | null | undefined;

interface CADStatusBadgeProps {
  status: CADStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CAD_STATUS_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ReactNode;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className: string;
  }
> = {
  APPROVED: {
    label: 'CAD Approved',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    variant: 'default',
    className: 'bg-success-muted text-success border-success/25 hover:bg-success-muted',
  },
  IN_PROGRESS: {
    label: 'CAD In Progress',
    icon: <Clock className="h-3.5 w-3.5" />,
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100',
  },
  PENDING: {
    label: 'CAD Pending',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    variant: 'outline',
    className: 'bg-muted text-foreground border-border hover:bg-muted',
  },
  UNKNOWN: {
    label: 'No CAD Status',
    icon: <Circle className="h-3.5 w-3.5" />,
    variant: 'outline',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export const CADStatusBadge: React.FC<CADStatusBadgeProps> = ({ status, showIcon = true, size = 'md', className }) => {
  const config = status && CAD_STATUS_CONFIG[status] ? CAD_STATUS_CONFIG[status] : CAD_STATUS_CONFIG.UNKNOWN;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, sizeClasses[size], 'inline-flex items-center gap-1.5 font-medium', className)}
    >
      {showIcon && config.icon}
      {config.label}
    </Badge>
  );
};

/**
 * Utility function to check if CAD is approved for workflow guards
 */
// eslint-disable-next-line react-refresh/only-export-components
export const isCADApproved = (status: CADStatus): boolean => {
  return status === 'APPROVED';
};

/**
 * Utility function to get workflow message based on CAD status
 */
// eslint-disable-next-line react-refresh/only-export-components
export const getCADWorkflowMessage = (status: CADStatus): string => {
  switch (status) {
    case 'APPROVED':
      return 'CAD plan is approved. You can now generate cost sheet.';
    case 'IN_PROGRESS':
      return 'CAD planning is in progress. Complete CAD planning before generating cost sheet.';
    case 'PENDING':
      return 'CAD planning is pending. Start CAD planning to proceed.';
    default:
      return 'CAD status unknown. Please check with administrator.';
  }
};

export default CADStatusBadge;
