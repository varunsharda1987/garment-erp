/**
 * OrderWorkflowTracker Component
 * Visual workflow progress component showing the full production pipeline:
 * Order → BOM → MRP → PO → GRN → Processing → Production → Dispatch
 */

import {
  Check,
  Circle,
  AlertCircle,
  ArrowRight,
  FileText,
  Calculator,
  ShoppingCart,
  Package,
  Truck,
  Factory,
  Scissors,
  Send,
} from 'lucide-react';
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
  grn: Truck,
  processing: Factory,
  production: Scissors,
  dispatch: Send,
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
 * Extended to show full pipeline: Order → BOM → MRP → PO → GRN → Processing → Production → Dispatch
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
    // P5.1: GRN tracking
    receivedCount?: number;
    totalPOCount?: number;
  } | null;
  generatedPOs?: number;
  // P5.1: Extended workflow data
  grnSummary?: {
    totalGRNs: number;
    pendingGRNs: number;
    materialsReceived: boolean;
  } | null;
  processingSummary?: {
    totalJobs: number;
    completedJobs: number;
    inProgressJobs: number;
  } | null;
  productionSummary?: {
    totalWorkOrders: number;
    completedQuantity: number;
    inCutting: number;
    inStitching: number;
    inFinishing: number;
  } | null;
  dispatchSummary?: {
    totalDeliveryNotes: number;
    dispatchedQuantity: number;
    pendingDispatch: number;
  } | null;
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
    onViewGRNs?: () => void;
    onViewProcessing?: () => void;
    onViewProduction?: () => void;
    onViewDispatch?: () => void;
  },
  loading?: {
    bom?: boolean;
    mrp?: boolean;
  }
): WorkflowStep[] {
  const {
    order,
    orderBom,
    mrpSummary,
    generatedPOs = 0,
    grnSummary,
    processingSummary,
    productionSummary,
    dispatchSummary,
  } = data;

  // Step 1: Order (always completed if we're viewing it)
  const orderStep: WorkflowStep = {
    id: 'order',
    label: 'Order',
    description: `${order.orderNumber} - ${order.totalQuantity} pcs`,
    status: 'completed',
  };

  // Step 2: Order BOM
  let bomStep: WorkflowStep;
  if (!orderBom) {
    bomStep = {
      id: 'bom',
      label: 'BOM',
      description: 'Not created yet',
      status: 'pending',
      action: handlers.onCreateBOM,
      actionLabel: 'Create',
      actionLoading: loading?.bom,
    };
  } else if (orderBom.status === 'LOCKED') {
    bomStep = {
      id: 'bom',
      label: 'BOM',
      description: `v${orderBom.version} Locked`,
      status: 'completed',
    };
  } else if (orderBom.status === 'APPROVED') {
    bomStep = {
      id: 'bom',
      label: 'BOM',
      description: `v${orderBom.version} Approved`,
      status: 'in_progress',
      action: handlers.onReviewBOM,
      actionLabel: 'Lock',
    };
  } else {
    bomStep = {
      id: 'bom',
      label: 'BOM',
      description: `v${orderBom.version} ${orderBom.status}`,
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
      description: `${mrpSummary.totalRequirements} items`,
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
      label: 'PO',
      description: 'Waiting for MRP',
      status: 'blocked',
    };
  } else if (mrpSummary.requirementsNeedingPO > 0) {
    poStep = {
      id: 'po',
      label: 'PO',
      description: `${mrpSummary.requirementsNeedingPO} need PO`,
      status: 'in_progress',
      action: handlers.onViewMRP,
      actionLabel: 'Generate',
    };
  } else {
    poStep = {
      id: 'po',
      label: 'PO',
      description: generatedPOs > 0 ? `${generatedPOs} created` : 'In stock',
      status: 'completed',
      action: generatedPOs > 0 ? handlers.onViewPOs : undefined,
      actionLabel: 'View',
    };
  }

  // Step 5: GRN (Goods Received)
  let grnStep: WorkflowStep;
  const poComplete = poStep.status === 'completed';

  if (!poComplete) {
    grnStep = {
      id: 'grn',
      label: 'GRN',
      description: 'Waiting for PO',
      status: 'blocked',
    };
  } else if (!grnSummary || !grnSummary.materialsReceived) {
    const pending = grnSummary?.pendingGRNs || 0;
    grnStep = {
      id: 'grn',
      label: 'GRN',
      description: pending > 0 ? `${pending} pending` : 'Awaiting receipt',
      status: pending > 0 ? 'in_progress' : 'pending',
      action: handlers.onViewGRNs,
      actionLabel: 'View',
    };
  } else {
    grnStep = {
      id: 'grn',
      label: 'GRN',
      description: `${grnSummary.totalGRNs} received`,
      status: 'completed',
      action: handlers.onViewGRNs,
      actionLabel: 'View',
    };
  }

  // Step 6: Processing (Dyeing/Printing/External Work)
  let processingStep: WorkflowStep;
  const grnComplete = grnStep.status === 'completed';

  if (!grnComplete) {
    processingStep = {
      id: 'processing',
      label: 'Processing',
      description: 'Waiting for GRN',
      status: 'blocked',
    };
  } else if (!processingSummary || processingSummary.totalJobs === 0) {
    // No processing jobs = skip this step (direct to production)
    processingStep = {
      id: 'processing',
      label: 'Processing',
      description: 'Not required',
      status: 'completed',
    };
  } else if (processingSummary.completedJobs < processingSummary.totalJobs) {
    processingStep = {
      id: 'processing',
      label: 'Processing',
      description: `${processingSummary.completedJobs}/${processingSummary.totalJobs} done`,
      status: 'in_progress',
      action: handlers.onViewProcessing,
      actionLabel: 'View',
    };
  } else {
    processingStep = {
      id: 'processing',
      label: 'Processing',
      description: `${processingSummary.totalJobs} completed`,
      status: 'completed',
      action: handlers.onViewProcessing,
      actionLabel: 'View',
    };
  }

  // Step 7: Production (Cutting/Stitching/Finishing)
  let productionStep: WorkflowStep;
  const processingComplete = processingStep.status === 'completed';

  if (!processingComplete) {
    productionStep = {
      id: 'production',
      label: 'Production',
      description: 'Waiting for processing',
      status: 'blocked',
    };
  } else if (!productionSummary || productionSummary.totalWorkOrders === 0) {
    productionStep = {
      id: 'production',
      label: 'Production',
      description: 'No work orders',
      status: 'pending',
      action: handlers.onViewProduction,
      actionLabel: 'Start',
    };
  } else {
    const { completedQuantity, inCutting, inStitching, inFinishing } = productionSummary;
    const inProgress = inCutting + inStitching + inFinishing;
    const allComplete = completedQuantity >= order.totalQuantity;

    if (allComplete) {
      productionStep = {
        id: 'production',
        label: 'Production',
        description: `${completedQuantity} pcs done`,
        status: 'completed',
        action: handlers.onViewProduction,
        actionLabel: 'View',
      };
    } else {
      // Show current stage with most activity
      let stageDesc = `${completedQuantity}/${order.totalQuantity}`;
      if (inFinishing > 0) stageDesc = `Finishing: ${inFinishing}`;
      else if (inStitching > 0) stageDesc = `Stitching: ${inStitching}`;
      else if (inCutting > 0) stageDesc = `Cutting: ${inCutting}`;

      productionStep = {
        id: 'production',
        label: 'Production',
        description: stageDesc,
        status: inProgress > 0 || completedQuantity > 0 ? 'in_progress' : 'pending',
        action: handlers.onViewProduction,
        actionLabel: 'View',
      };
    }
  }

  // Step 8: Dispatch
  let dispatchStep: WorkflowStep;
  const productionComplete = productionStep.status === 'completed';

  if (!productionComplete) {
    dispatchStep = {
      id: 'dispatch',
      label: 'Dispatch',
      description: 'Waiting for production',
      status: 'blocked',
    };
  } else if (!dispatchSummary || dispatchSummary.dispatchedQuantity === 0) {
    dispatchStep = {
      id: 'dispatch',
      label: 'Dispatch',
      description: 'Ready to ship',
      status: 'pending',
      action: handlers.onViewDispatch,
      actionLabel: 'Create DN',
    };
  } else if (Number(dispatchSummary.dispatchedQuantity) < Number(order.totalQuantity)) {
    dispatchStep = {
      id: 'dispatch',
      label: 'Dispatch',
      description: `${dispatchSummary.dispatchedQuantity}/${order.totalQuantity} shipped`,
      status: 'in_progress',
      action: handlers.onViewDispatch,
      actionLabel: 'View',
    };
  } else {
    dispatchStep = {
      id: 'dispatch',
      label: 'Dispatch',
      description: `${dispatchSummary.totalDeliveryNotes} DN(s)`,
      status: 'completed',
      action: handlers.onViewDispatch,
      actionLabel: 'View',
    };
  }

  return [orderStep, bomStep, mrpStep, poStep, grnStep, processingStep, productionStep, dispatchStep];
}
