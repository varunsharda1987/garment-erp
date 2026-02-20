import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calculator, ArrowRight, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MRPCalculationPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCalculate: () => Promise<void>;
  onSkip: () => void;
  bomVersion?: number;
  orderNumber?: string;
}

export default function MRPCalculationPrompt({
  open,
  onOpenChange,
  onCalculate,
  onSkip,
  bomVersion,
  orderNumber,
}: MRPCalculationPromptProps) {
  const [isCalculating, setIsCalculating] = useState(false);

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      await onCalculate();
      onOpenChange(false);
    } catch (error) {
      // Error handling done by parent component
      console.error('MRP calculation failed:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calculator className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle>Calculate Material Requirements?</DialogTitle>
              {orderNumber && (
                <p className="text-sm text-muted-foreground mt-1">
                  Order: {orderNumber} {bomVersion && `• BOM v${bomVersion}`}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <DialogDescription className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-md border">
            <p className="text-sm text-foreground">
              The BOM has been approved successfully. Would you like to calculate material
              requirements now?
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">What happens next:</p>
            <ul className="text-sm space-y-2 ml-1">
              <li className="flex items-start gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>
                  MRP will calculate total material requirements based on order quantities
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>System will check available stock for each material</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>
                  Items needing procurement will be flagged for PO generation
                </span>
              </li>
            </ul>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 rounded-md">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Tip:</strong> You can also calculate MRP manually later from the BOM detail
              page if you skip this step.
            </p>
          </div>
        </DialogDescription>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleSkip}
            disabled={isCalculating}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Skip for Now
          </Button>
          <Button
            type="button"
            onClick={handleCalculate}
            disabled={isCalculating}
            className={cn('gap-2', isCalculating && 'cursor-not-allowed')}
          >
            {isCalculating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4" />
                Calculate Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
