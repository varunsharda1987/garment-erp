/**
 * Lace Costing Row Component
 * Displays lace details with sourcing strategy and cost breakdown
 */

import { useState } from 'react';
import { Trash2, Info, RefreshCw } from 'lucide-react';

interface LaceCostingRowProps {
  laceId: string;
  laceName: string;
  colorName?: string;
  quantityPerGarment: number;
  wastagePercent: number;
  width?: number;
  orderQuantity?: number;
  styleId?: string;
  currentStrategy?: 'STOCK_REUSE' | 'READY_LACE' | 'GREIGE_PROCESSED';
  currentCost?: number;
  onStrategyChange: (strategy: {
    sourcingStrategy: 'STOCK_REUSE' | 'READY_LACE' | 'GREIGE_PROCESSED';
    cost: number;
    costPerMeter: number;
    stockLotId?: string;
    processorId?: string;
    rateCardId?: string;
    procurementId?: string;
    greigeCost?: number;
    processingCost?: number;
    readyLaceCost?: number;
    stockCost?: number;
    greigeLaceId?: string;
    labDipId?: string;
    isManualOverride?: boolean;
    overrideReason?: string;
  }) => void;
  onRemove?: () => void;
  onQuantityChange?: (quantity: number) => void;
  onWastageChange?: (wastage: number) => void;
  index: number;
  isNotApplicable?: boolean;
  onNotApplicableChange?: (checked: boolean) => void;
}

export default function LaceCostingRow({
  laceId,
  laceName,
  colorName,
  quantityPerGarment,
  wastagePercent,
  width,
  currentStrategy,
  currentCost,
  onStrategyChange,
  onRemove,
  onQuantityChange,
  onWastageChange,
  index,
  isNotApplicable = false,
  onNotApplicableChange,
}: LaceCostingRowProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate effective quantity with wastage
  const effectiveQuantity = quantityPerGarment * (1 + wastagePercent / 100);

  const handleOpenSourcingModal = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Implement lace costing calculation service
      // For now, show a placeholder modal or use simplified calculation

      // Temporary: Use a simple cost calculation
      const defaultCostPerMeter = 30; // Placeholder rate
      const totalCost = effectiveQuantity * defaultCostPerMeter;

      onStrategyChange({
        sourcingStrategy: 'READY_LACE',
        cost: totalCost,
        costPerMeter: defaultCostPerMeter,
        readyLaceCost: defaultCostPerMeter,
      });
    } catch (err: unknown) {
      console.error('Error calculating lace cost:', err);
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to calculate lace cost');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return `₹${amount.toFixed(2)}`;
  };

  const getStrategyBadgeColor = (strategy?: string) => {
    switch (strategy) {
      case 'STOCK_REUSE':
        return 'bg-success-muted text-success border-success/20';
      case 'READY_LACE':
        return 'bg-info-muted text-info border-info/20';
      case 'GREIGE_PROCESSED':
        return 'bg-accent/10 text-accent border-accent/20';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  const getStrategyLabel = (strategy?: string) => {
    switch (strategy) {
      case 'STOCK_REUSE':
        return 'Stock Reuse';
      case 'READY_LACE':
        return 'Ready Lace';
      case 'GREIGE_PROCESSED':
        return 'Greige + Dyeing';
      default:
        return 'Not Selected';
    }
  };

  // Check if lace is properly linked
  const isLaceLinked = laceId && laceId.length > 10 && !laceId.includes('temp');
  const hasRequiredFields = isLaceLinked && quantityPerGarment > 0;

  return (
    <>
      <tr className={`border-b hover:bg-muted ${isNotApplicable ? 'bg-muted opacity-60' : ''}`}>
        {/* Index */}
        <td className="px-4 py-3 text-sm text-foreground">{index + 1}</td>

        {/* Lace Name */}
        <td className="px-4 py-3">
          <div className="text-sm font-medium text-foreground">{laceName}</div>
          {colorName && <div className="text-xs text-muted-foreground">Color: {colorName}</div>}
          {width && <div className="text-xs text-muted-foreground">Width: {width}"</div>}
        </td>

        {/* Quantity per Garment */}
        <td className="px-4 py-3 text-center">
          <input
            type="number"
            step="0.01"
            min="0"
            value={quantityPerGarment}
            onChange={(e) => onQuantityChange?.(parseFloat(e.target.value) || 0)}
            className="w-20 px-2 py-1 text-sm border border-border rounded text-center"
            disabled={isNotApplicable}
          />
          <span className="text-xs text-muted-foreground ml-1">m</span>
        </td>

        {/* Wastage % */}
        <td className="px-4 py-3 text-center">
          <input
            type="number"
            step="0.5"
            min="0"
            max="50"
            value={wastagePercent}
            onChange={(e) => onWastageChange?.(parseFloat(e.target.value) || 0)}
            className="w-16 px-2 py-1 text-sm border border-border rounded text-center"
            disabled={isNotApplicable}
          />
          <span className="text-xs text-muted-foreground ml-1">%</span>
        </td>

        {/* Effective Quantity */}
        <td className="px-4 py-3 text-sm text-foreground text-center">{effectiveQuantity.toFixed(3)}m</td>

        {/* Sourcing Strategy */}
        <td className="px-4 py-3">
          {currentStrategy ? (
            <div className="flex items-center space-x-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStrategyBadgeColor(
                  currentStrategy
                )}`}
              >
                {getStrategyLabel(currentStrategy)}
              </span>
              <button
                onClick={handleOpenSourcingModal}
                disabled={isLoading || !hasRequiredFields}
                className="text-info hover:text-info text-xs underline disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Change'}
              </button>
            </div>
          ) : !isLaceLinked ? (
            <div className="flex flex-col">
              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
                Not Linked
              </span>
              <span className="text-xs text-primary mt-1">Select lace from master</span>
            </div>
          ) : (
            <button
              onClick={handleOpenSourcingModal}
              disabled={isLoading || !hasRequiredFields}
              className="inline-flex items-center px-3 py-1 border border-info/30 text-xs font-medium rounded text-info bg-info-muted hover:bg-info-muted disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" />
                  Loading...
                </>
              ) : (
                'Choose Sourcing'
              )}
            </button>
          )}
        </td>

        {/* Cost */}
        <td
          className={`px-4 py-3 text-sm font-semibold text-right ${isNotApplicable ? 'text-muted-foreground line-through' : 'text-foreground'}`}
        >
          {isNotApplicable ? 'N/A' : formatCurrency(currentCost)}
        </td>

        {/* N/A Checkbox */}
        <td className="px-4 py-3 text-center">
          {onNotApplicableChange && (
            <label className="flex items-center justify-center cursor-pointer">
              <input
                type="checkbox"
                checked={isNotApplicable}
                onChange={(e) => onNotApplicableChange(e.target.checked)}
                className="w-4 h-4 text-primary border-border rounded focus:ring-orange-500"
                title={isNotApplicable ? 'Item marked as Not Applicable' : 'Mark as Not Applicable'}
              />
            </label>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end space-x-2">
            <button
              onClick={handleOpenSourcingModal}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              title="View cost breakdown"
            >
              <Info className="h-5 w-5" />
            </button>
            {onRemove && (
              <button onClick={onRemove} className="text-destructive hover:text-destructive" title="Remove lace">
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Error Row */}
      {error && (
        <tr>
          <td colSpan={9} className="px-4 py-2 bg-destructive/10">
            <div className="flex items-center text-destructive text-sm">
              <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
