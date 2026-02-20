/**
 * Thread Stock Indicator Component (shadcn/ui)
 *
 * Displays stock availability with color-coded status:
 * - ✅ In Stock (green) - Sufficient stock available
 * - ⚠️ Low Stock (yellow) - Stock below reorder level
 * - ❌ Shortage (red) - Insufficient stock for requirement
 */

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import api from '../../lib/api';

interface StockStatus {
  available: boolean;
  totalUnits: number;
  totalBoxes: number;
  shortage: number;
  reorderSuggested: boolean;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'SHORTAGE';
}

interface ThreadStockIndicatorProps {
  threadId: string;
  requiredUnits: number;
  warehouseId?: string;
  compact?: boolean;
}

const ThreadStockIndicator: React.FC<ThreadStockIndicatorProps> = ({
  threadId,
  requiredUnits,
  warehouseId,
  compact = false,
}) => {
  const [stockStatus, setStockStatus] = useState<StockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStockStatus();
  }, [threadId, requiredUnits, warehouseId]);

  const fetchStockStatus = async () => {
    if (!threadId || requiredUnits <= 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/materials/thread/${threadId}/stock`, {
        params: { requiredUnits, warehouseId }
      });

      const data = response.data.data;

      // Map API response to StockStatus interface
      const stockData: StockStatus = {
        available: data.available,
        totalUnits: data.totalUnits,
        totalBoxes: data.totalBoxes,
        shortage: data.shortage,
        reorderSuggested: data.reorderSuggested,
        status: data.status,
      };

      setStockStatus(stockData);
    } catch (err: any) {
      console.error('Failed to fetch stock status:', err);
      setError(err.message || 'Failed to fetch stock status');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking stock...</span>
      </div>
    );
  }

  if (error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1">
              <XCircle className="h-3 w-3" />
              Error
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!stockStatus) {
    return null;
  }

  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  // Render based on status
  switch (stockStatus.status) {
    case 'IN_STOCK':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {compact ? (
                <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-3 w-3" />
                  In Stock
                </Badge>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-600 font-medium">
                    In Stock: {formatNumber(stockStatus.totalUnits)} units ({formatNumber(stockStatus.totalBoxes)} boxes)
                  </span>
                </div>
              )}
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 text-xs">
                <p className="font-semibold">In Stock</p>
                <p>Available: {formatNumber(stockStatus.totalUnits)} units ({formatNumber(stockStatus.totalBoxes)} boxes)</p>
                <p>Required: {formatNumber(requiredUnits)} units</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    case 'LOW_STOCK':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {compact ? (
                <Badge variant="default" className="gap-1 bg-amber-500 hover:bg-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  Low Stock
                </Badge>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-600 font-medium">
                    Low Stock: {formatNumber(stockStatus.totalUnits)} units ({formatNumber(stockStatus.totalBoxes)} boxes) - Reorder suggested
                  </span>
                </div>
              )}
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 text-xs">
                <p className="font-semibold">Low Stock - Reorder Suggested</p>
                <p>Available: {formatNumber(stockStatus.totalUnits)} units ({formatNumber(stockStatus.totalBoxes)} boxes)</p>
                <p>Required: {formatNumber(requiredUnits)} units</p>
                <p className="text-amber-500">⚠️ Stock is running low. Consider reordering soon.</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    case 'SHORTAGE':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {compact ? (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Short: {formatNumber(stockStatus.shortage)}
                </Badge>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-red-600 font-medium">
                    ⚠️ SHORTAGE: Need {formatNumber(requiredUnits)}, Have {formatNumber(stockStatus.totalUnits)}
                    (Short: {formatNumber(stockStatus.shortage)} units / {formatNumber(stockStatus.shortage / 10)} boxes)
                  </span>
                </div>
              )}
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 text-xs">
                <p className="font-semibold">Shortage Detected</p>
                <p>Required: {formatNumber(requiredUnits)} units</p>
                <p>Available: {formatNumber(stockStatus.totalUnits)} units</p>
                <p className="text-red-500 font-semibold">
                  Short: {formatNumber(stockStatus.shortage)} units ({formatNumber(stockStatus.shortage / 10)} boxes approx.)
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

    default:
      return null;
  }
};

export default ThreadStockIndicator;
