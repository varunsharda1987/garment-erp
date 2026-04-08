/**
 * OrderWorkflowTracker Component
 * Visual workflow progress component showing the Order → BOM → MRP → PO flow
 */

import { Check, Circle, AlertCircle, ArrowRight, FileText, Calculator, ShoppingCart, Package } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

export interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  action?: () => void;
  actionLabel?: string;
  actionLoading?: boolean;
}

export interface OrderWorkflowTrackerProps {
  steps: WorkflowStep[];
  className?: string;
}

const stepIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  order: FileText,
  bom: Package,
  mrp: Calculator,
  po: ShoppingCart,
};

const statusStyles: Record<
  WorkflowStep['status'],
  { icon: React.ReactNode; bg: string; text: string; border: string }
> = {
  completed: {
    icon: <Check className="h-4 w-4" />,
    bg: 'bg-success-muted',
    text: 'text-success',
    border: 'border-success',
  },
  in_progress: {
    icon: <Circle className="h-4 w-4 fill-current" />,
    bg: 'bg-info-muted',
    text: 'text-info',
    border: 'border-info',
  },
  pending: {
    icon: <Circle className="h-4 w-4" />,
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
  },
  blocked: {
    icon: <AlertCircle className="h-4 w-4" />,
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
  },
};

export function OrderWorkflowTracker({ steps, className }: OrderWorkflowTrackerProps) {
  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const totalCount = steps.length;

  return (
    <Card className={cn('mb-6', className)}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Production Workflow</h3>
          <Badge variant="outline">
            {completedCount} of {totalCount} steps completed
          </Badge>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const styles = statusStyles[step.status];
            const StepIcon = stepIcons[step.id] || Circle;
            const isLast = index === steps.length - 1;

            return (
              <div key={step.id} className="flex items-center flex-1">
                {/* Step Circle */}
                <div className="flex flex-col items-center min-w-[120px]">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center border-2',
                      styles.bg,
                      styles.border
                    )}
                  >
                    <span className={styles.text}>
                      {step.status === 'completed' ? styles.icon : <StepIcon className="h-5 w-5" />}
                    </span>
                  </div>
                  <span className={cn('mt-2 text-sm font-medium', styles.text)}>{step.label}</span>
                  <span className="text-xs text-muted-foreground text-center mt-1 max-w-[100px]">
                    {step.description}
                  </span>
                  {step.action && step.status !== 'blocked' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={step.action}
                      disabled={step.actionLoading}
                    >
                      {step.actionLoading ? 'Loading...' : step.actionLabel || 'Action'}
                    </Button>
                  )}
                </div>

                {/* Connector Arrow */}
                {!isLast && (
                  <div className="flex-1 flex items-center justify-center px-2">
                    <ArrowRight
                      className={cn('h-5 w-5', step.status === 'completed' ? 'text-success' : 'text-gray-300')}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Helper function to build workflow steps for Order Detail page
 */
export interface OrderWorkflowData {
  order: {
    id: string;
    orderNumber: string;
    totalQuantity: number;
    expectedDeliveryDate: string;
  };
  orderBom?: {
    id: string;
    version: number;
    status: string;
  } | null;
  mrpSummary?: {
    totalRequirements: number;
    requirementsNeedingPO: number;
    hasShortfall: boolean;
  } | null;
  generatedPOs?: number;
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildWorkflowSteps(
  data: OrderWorkflowData,
  handlers: {
    onCreateBOM?: () => void;
    onReviewBOM?: () => void;
    onCalculateMRP?: () => void;
    onViewMRP?: () => void;
    onViewPOs?: () => void;
  },
  loading?: {
    bom?: boolean;
    mrp?: boolean;
  }
): WorkflowStep[] {
  const { order, orderBom, mrpSummary, generatedPOs = 0 } = data;

  // Step 1: Order (always completed if we're viewing it)
  const orderStep: WorkflowStep = {
    id: 'order',
    label: 'Order Created',
    description: `${order.orderNumber} - ${order.totalQuantity} pcs`,
    status: 'completed',
  };

  // Step 2: Order BOM
  let bomStep: WorkflowStep;
  if (!orderBom) {
    bomStep = {
      id: 'bom',
      label: 'Order BOM',
      description: 'Not created yet',
      status: 'pending',
      action: handlers.onCreateBOM,
      actionLabel: 'Create BOM',
      actionLoading: loading?.bom,
    };
  } else if (orderBom.status === 'LOCKED') {
    bomStep = {
      id: 'bom',
      label: 'Order BOM',
      description: `v${orderBom.version} - Locked`,
      status: 'completed',
    };
  } else if (orderBom.status === 'APPROVED') {
    bomStep = {
      id: 'bom',
      label: 'Order BOM',
      description: `v${orderBom.version} - Approved`,
      status: 'in_progress',
      action: handlers.onReviewBOM,
      actionLabel: 'Lock BOM',
    };
  } else {
    bomStep = {
      id: 'bom',
      label: 'Order BOM',
      description: `v${orderBom.version} - ${orderBom.status}`,
      status: 'in_progress',
      action: handlers.onReviewBOM,
      actionLabel: 'Review',
    };
  }

  // Step 3: MRP Calculation
  let mrpStep: WorkflowStep;
  const bomLocked = orderBom?.status === 'LOCKED';

  if (!bomLocked) {
    mrpStep = {
      id: 'mrp',
      label: 'MRP',
      description: 'Waiting for BOM',
      status: 'blocked',
    };
  } else if (!mrpSummary || mrpSummary.totalRequirements === 0) {
    mrpStep = {
      id: 'mrp',
      label: 'MRP',
      description: 'Ready to calculate',
      status: 'pending',
      action: handlers.onCalculateMRP,
      actionLabel: 'Calculate',
      actionLoading: loading?.mrp,
    };
  } else {
    mrpStep = {
      id: 'mrp',
      label: 'MRP',
      description: `${mrpSummary.totalRequirements} requirements`,
      status: mrpSummary.hasShortfall ? 'in_progress' : 'completed',
      action: mrpSummary.hasShortfall ? handlers.onViewMRP : undefined,
      actionLabel: 'View',
    };
  }

  // Step 4: Purchase Orders
  let poStep: WorkflowStep;
  const mrpComplete = mrpSummary && mrpSummary.totalRequirements > 0;

  if (!mrpComplete) {
    poStep = {
      id: 'po',
      label: 'Purchase Orders',
      description: 'Waiting for MRP',
      status: 'blocked',
    };
  } else if (mrpSummary.requirementsNeedingPO > 0) {
    poStep = {
      id: 'po',
      label: 'Purchase Orders',
      description: `${mrpSummary.requirementsNeedingPO} items need PO`,
      status: 'in_progress',
      action: handlers.onViewMRP,
      actionLabel: 'Generate POs',
    };
  } else {
    poStep = {
      id: 'po',
      label: 'Purchase Orders',
      description: generatedPOs > 0 ? `${generatedPOs} POs created` : 'All materials in stock',
      status: 'completed',
      action: generatedPOs > 0 ? handlers.onViewPOs : undefined,
      actionLabel: 'View POs',
    };
  }

  return [orderStep, bomStep, mrpStep, poStep];
}
