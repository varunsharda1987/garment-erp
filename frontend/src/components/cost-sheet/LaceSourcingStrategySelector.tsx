/**
 * Lace Sourcing Strategy Selector Component
 * Modal showing 3 sourcing options with cost comparison for lace
 */

import { useState } from 'react';
import type { LaceCostCalculationResult } from '../../types/laceCosting.types';
import { createDyedLaceVariant, calculateLaceCost } from '../../services/lace.service';
import ColorPicker from '../ColorPicker';
import { SupplierCombobox } from '../SupplierCombobox';

export interface LaceStrategySelection {
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
  /**
   * Set when a greige row was costed as a DYED VARIANT: the row must re-point at the newly
   * created finished master, which is the dyed lace's stock identity.
   */
  newLaceId?: string;
  newLaceName?: string;
  colorName?: string;
}

interface LaceSourcingStrategySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  laceCostData: LaceCostCalculationResult;
  /** Garment count, needed to re-cost after a dyed variant is created. */
  orderQuantity?: number;
  styleId?: string;
  onSelectStrategy: (strategy: LaceStrategySelection) => void;
}

type TabType = 'stock' | 'ready' | 'greige';

export default function LaceSourcingStrategySelector({
  isOpen,
  onClose,
  laceCostData,
  orderQuantity,
  styleId,
  onSelectStrategy,
}: LaceSourcingStrategySelectorProps) {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (laceCostData.recommendedStrategy === 'STOCK_REUSE') return 'stock';
    if (laceCostData.recommendedStrategy === 'READY_LACE') return 'ready';
    if (laceCostData.recommendedStrategy === 'GREIGE_PROCESSED') return 'greige';
    return 'stock';
  });

  const [manualGreigeCost, setManualGreigeCost] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState('');
  const [useManualOverride, setUseManualOverride] = useState(false);

  // Manual override for READY_LACE when master price is missing
  const [manualReadyLaceCost, setManualReadyLaceCost] = useState<string>('');
  const [readyLaceOverrideReason, setReadyLaceOverrideReason] = useState('');

  // "Dye this greige" flow — only reachable when the selected lace is itself greige
  const [dyeColorId, setDyeColorId] = useState<string | null>(null);
  const [dyeColorName, setDyeColorName] = useState<string>('');
  const [dyeProcessorId, setDyeProcessorId] = useState<string>('');
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  if (!isOpen) return null;

  const { stockReuse, readyLace, greigeProcessing, recommendedCost, savings, totalQuantityNeeded } = laceCostData;

  const handleSelectStock = () => {
    if (!stockReuse.available || stockReuse.totalCost == null || !stockReuse.stockLotId) return;
    onSelectStrategy({
      sourcingStrategy: 'STOCK_REUSE',
      cost: stockReuse.totalCost,
      costPerMeter: stockReuse.stockCost || 0,
      stockLotId: stockReuse.stockLotId,
      stockCost: stockReuse.stockCost ?? undefined,
    });
    onClose();
  };

  const handleSelectReady = () => {
    if (!readyLace.available || readyLace.totalCost == null) return;
    onSelectStrategy({
      sourcingStrategy: 'READY_LACE',
      cost: readyLace.totalCost,
      costPerMeter: readyLace.readyLaceCost || 0,
      readyLaceCost: readyLace.readyLaceCost ?? undefined,
    });
    onClose();
  };

  // Handle manual ready lace price entry (when master price is missing)
  const handleSelectReadyManual = () => {
    const manualCost = parseFloat(manualReadyLaceCost);
    if (!manualCost || manualCost <= 0 || !readyLaceOverrideReason.trim()) return;
    const totalCost = manualCost * totalQuantityNeeded;
    onSelectStrategy({
      sourcingStrategy: 'READY_LACE',
      cost: totalCost,
      costPerMeter: manualCost,
      readyLaceCost: manualCost,
      isManualOverride: true,
      overrideReason: readyLaceOverrideReason,
    });
    onClose();
  };

  /**
   * Dye this greige: create (or reuse) its finished variant for the chosen colour, then re-cost
   * against that variant and apply the resulting GREIGE_PROCESSED option.
   *
   * The row's laceId re-points at the finished master because that master is the dyed lace's
   * stock identity — lace_stock is keyed by laceId and has no colour column, so costing a dyed
   * lace against the greige itself would pool dyed and undyed meters together.
   */
  const handleCreateDyedVariant = async () => {
    const color = dyeColorName.trim();
    if (!color) return;

    setIsCreatingVariant(true);
    setVariantError(null);

    try {
      const variant = await createDyedLaceVariant({
        greigeLaceId: laceCostData.laceId,
        color,
        processorId: dyeProcessorId || undefined,
      });

      // Re-cost against the finished variant. The processor choice is passed through so the
      // server prices the dyer the user picked rather than the cheapest one.
      const recosted = await calculateLaceCost({
        laceId: variant.lace.id,
        laceName: variant.lace.laceName,
        quantityPerGarment: laceCostData.quantityPerGarment,
        orderQuantity,
        wastagePercent: laceCostData.wastagePercent,
        styleId,
        processorId: dyeProcessorId || undefined,
      });

      const gp = recosted.greigeProcessing;
      if (!gp.available || gp.totalCost == null) {
        setVariantError(
          `${variant.message}, but it cannot be costed yet: ${gp.details}. Set up the processor rate card (including shrinkage %) for this lace, then try again.`
        );
        return;
      }

      onSelectStrategy({
        sourcingStrategy: 'GREIGE_PROCESSED',
        cost: gp.totalCost,
        costPerMeter: gp.costBreakdown.effectiveCostPerMeter || 0,
        processorId: gp.processorId || undefined,
        // PER METRE, not the order total. greigeCost/processingCost are stored in
        // style_costing_lace_items -> order_bom_items, where MRP and the PO rate resolver read
        // them as ₹/m rates. The calculation service's top-level greigeCost/processingCost are
        // ORDER TOTALS despite their "cost per meter" comment, so take the rates from
        // costBreakdown — the same shape the fabric selector sends.
        greigeCost: gp.costBreakdown.greigeCostPerMeter ?? undefined,
        processingCost: gp.costBreakdown.processingCostPerMeter ?? undefined,
        greigeLaceId: gp.greigeLaceId ?? laceCostData.laceId,
        labDipId: gp.labDipId ?? undefined,
        newLaceId: variant.lace.id,
        newLaceName: variant.lace.laceName,
        colorName: color,
      });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      setVariantError(e.response?.data?.message || e.response?.data?.error || 'Failed to create the dyed variant');
    } finally {
      setIsCreatingVariant(false);
    }
  };

  const handleSelectGreige = () => {
    if (!greigeProcessing.available || greigeProcessing.totalCost == null) return;

    if (useManualOverride && manualGreigeCost) {
      const manualGreige = parseFloat(manualGreigeCost);
      const processingCost = greigeProcessing.costBreakdown.processingCostPerMeter || 0;
      const shrinkageFactor = greigeProcessing.costBreakdown.shrinkageFactor || 1;
      const effectiveCostPerMeter = (manualGreige + processingCost) / shrinkageFactor;
      const totalCost = effectiveCostPerMeter * totalQuantityNeeded;

      onSelectStrategy({
        sourcingStrategy: 'GREIGE_PROCESSED',
        cost: totalCost,
        costPerMeter: effectiveCostPerMeter,
        processorId: greigeProcessing.processorId || undefined,
        // PER METRE — see the note in handleCreateDyedVariant. This used to multiply by the
        // greige quantity, storing an order TOTAL in a ₹/m column.
        greigeCost: manualGreige,
        processingCost: greigeProcessing.costBreakdown.processingCostPerMeter ?? undefined,
        greigeLaceId: greigeProcessing.greigeLaceId ?? undefined,
        labDipId: greigeProcessing.labDipId ?? undefined,
        isManualOverride: true,
        overrideReason,
      });
    } else {
      onSelectStrategy({
        sourcingStrategy: 'GREIGE_PROCESSED',
        cost: greigeProcessing.totalCost,
        costPerMeter: greigeProcessing.costBreakdown.effectiveCostPerMeter || 0,
        processorId: greigeProcessing.processorId || undefined,
        // PER METRE — see the note in handleCreateDyedVariant.
        greigeCost: greigeProcessing.costBreakdown.greigeCostPerMeter ?? undefined,
        processingCost: greigeProcessing.costBreakdown.processingCostPerMeter ?? undefined,
        greigeLaceId: greigeProcessing.greigeLaceId ?? undefined,
        labDipId: greigeProcessing.labDipId ?? undefined,
      });
    }
    onClose();
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return `₹${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return null;
    }
  };

  const getRateSourceLabel = (source: string | null | undefined) => {
    if (!source) return null;
    const labels: Record<string, string> = {
      STOCK_WAC: 'Stock WAC',
      LACE_MASTER: 'Lace Master',
      SUPPLIER_PRICE: 'Supplier Price',
      GREIGE_LACE_MASTER: 'Greige Lace Master',
      RATE_CARD: 'Rate Card',
      PROCUREMENT: 'Procurement',
    };
    return labels[source] || source;
  };

  const calculateSavings = (currentCost: number | null) => {
    if (!currentCost || !recommendedCost) return null;
    const savingsAmount = currentCost - recommendedCost;
    if (savingsAmount <= 0) return null;
    const savingsPercent = (savingsAmount / currentCost) * 100;
    return { amount: savingsAmount, percent: savingsPercent };
  };

  const isRecommended = (strategy: string) => {
    const strategyMap: Record<string, string> = {
      stock: 'STOCK_REUSE',
      ready: 'READY_LACE',
      greige: 'GREIGE_PROCESSED',
    };
    return laceCostData.recommendedStrategy === strategyMap[strategy];
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-card rounded-lg shadow-xl">
          {/* Header */}
          <div className="border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-display font-semibold text-foreground">Select Lace Sourcing Strategy</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {laceCostData.laceName} - {laceCostData.totalQuantityNeeded.toFixed(2)}m needed
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Choose how to source this lace: use existing stock, purchase ready lace, or process greige lace.
                </p>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {recommendedCost && savings && (
              <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full bg-success-muted text-success text-sm">
                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Recommended: {formatCurrency(recommendedCost)} (Save {formatCurrency(savings)})
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b">
            <div className="flex px-6">
              <button
                onClick={() => setActiveTab('stock')}
                className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === 'stock'
                    ? 'border-info text-info'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Stock Reuse
                {isRecommended('stock') && (
                  <span className="ml-2 text-xs bg-success-muted text-success px-2 py-0.5 rounded">Recommended</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('ready')}
                className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === 'ready'
                    ? 'border-info text-info'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Ready Lace
                {isRecommended('ready') && (
                  <span className="ml-2 text-xs bg-success-muted text-success px-2 py-0.5 rounded">Recommended</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('greige')}
                className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === 'greige'
                    ? 'border-info text-info'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Greige + Dyeing
                {isRecommended('greige') && (
                  <span className="ml-2 text-xs bg-success-muted text-success px-2 py-0.5 rounded">Recommended</span>
                )}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="px-6 py-6">
            {/* Stock Reuse Tab */}
            {activeTab === 'stock' && (
              <div>
                {stockReuse.available ? (
                  <div className="space-y-4">
                    <div className="bg-success-muted border border-success/20 rounded-lg p-4">
                      <div className="flex items-center text-success mb-2">
                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="font-medium">Stock Available</span>
                      </div>
                      <p className="text-sm text-success">{stockReuse.details}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm text-muted-foreground">Cost per Meter</div>
                        <div className="text-2xl font-bold text-foreground mt-1">
                          {formatCurrency(stockReuse.stockCost)}
                        </div>
                        {stockReuse.rateSource && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-info-muted text-info">
                              {getRateSourceLabel(stockReuse.rateSource)}
                            </span>
                            {stockReuse.lastUpdated && (
                              <span className="text-xs text-muted-foreground">
                                as of {formatDate(stockReuse.lastUpdated)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm text-muted-foreground">Total Cost</div>
                        <div className="text-2xl font-bold text-foreground mt-1">
                          {formatCurrency(stockReuse.totalCost)}
                        </div>
                      </div>
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm text-muted-foreground">Available Quantity</div>
                        <div className="text-lg font-semibold text-foreground mt-1">
                          {stockReuse.quantityAvailable?.toFixed(2)}m
                        </div>
                      </div>
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm text-muted-foreground">Warehouse</div>
                        <div className="text-lg font-semibold text-foreground mt-1">
                          {stockReuse.warehouseLocation || 'Main'}
                        </div>
                      </div>
                    </div>

                    {stockReuse.dyeLotNumber && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Dye Lot:</span> {stockReuse.dyeLotNumber}
                      </div>
                    )}

                    {stockReuse.originStyleCode && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Origin Style:</span> {stockReuse.originStyleCode}
                      </div>
                    )}

                    {(() => {
                      const savingsData = calculateSavings(stockReuse.totalCost);
                      return (
                        savingsData && (
                          <div className="bg-warning-muted border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                            Using this option saves {formatCurrency(savingsData.amount)} (
                            {savingsData.percent.toFixed(1)}%)
                          </div>
                        )
                      );
                    })()}

                    <button
                      onClick={handleSelectStock}
                      className="w-full bg-info hover:bg-info/90 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      Select Stock Reuse
                    </button>
                  </div>
                ) : (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
                    <svg
                      className="h-12 w-12 text-destructive mx-auto mb-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <h3 className="text-lg font-medium text-destructive mb-1">Stock Not Available</h3>
                    <p className="text-sm text-destructive">{stockReuse.details}</p>
                  </div>
                )}
              </div>
            )}

            {/* Ready Lace Tab */}
            {activeTab === 'ready' && (
              <div>
                {readyLace.available ? (
                  <div className="space-y-4">
                    <div className="bg-info-muted border border-info/20 rounded-lg p-4">
                      <div className="flex items-center text-info mb-2">
                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="font-medium">Ready Lace Available</span>
                      </div>
                      <p className="text-sm text-info">{readyLace.details}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm text-muted-foreground">Cost per Meter</div>
                        <div className="text-2xl font-bold text-foreground mt-1">
                          {formatCurrency(readyLace.readyLaceCost)}
                        </div>
                        {readyLace.rateSource && (
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-info-muted text-info">
                              {getRateSourceLabel(readyLace.rateSource)}
                            </span>
                            {readyLace.lastUpdated && (
                              <span className="text-xs text-muted-foreground">
                                as of {formatDate(readyLace.lastUpdated)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm text-muted-foreground">Total Cost</div>
                        <div className="text-2xl font-bold text-foreground mt-1">
                          {formatCurrency(readyLace.totalCost)}
                        </div>
                      </div>
                      {readyLace.supplierName && (
                        <div className="bg-muted p-4 rounded-lg col-span-2">
                          <div className="text-sm text-muted-foreground">Supplier</div>
                          <div className="text-lg font-semibold text-foreground mt-1">{readyLace.supplierName}</div>
                        </div>
                      )}
                    </div>

                    {(() => {
                      const savingsData = calculateSavings(readyLace.totalCost);
                      return (
                        savingsData && (
                          <div className="bg-warning-muted border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                            Using this option saves {formatCurrency(savingsData.amount)} (
                            {savingsData.percent.toFixed(1)}%)
                          </div>
                        )
                      );
                    })()}

                    <button
                      onClick={handleSelectReady}
                      className="w-full bg-info hover:bg-info/90 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      Select Ready Lace
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* No master price - allow manual entry */}
                    <div className="bg-warning-muted border border-warning/20 rounded-lg p-4">
                      <div className="flex items-center text-warning mb-2">
                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="font-medium">No Master Price Set</span>
                      </div>
                      <p className="text-sm text-warning">{readyLace.details}</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Enter a custom price below to use this lace in the cost sheet.
                      </p>
                    </div>

                    {/* Manual price entry form */}
                    <div className="bg-muted p-4 rounded-lg space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Ready Lace Price (₹/m) <span className="text-destructive">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={manualReadyLaceCost}
                          onChange={(e) => setManualReadyLaceCost(e.target.value)}
                          placeholder="Enter price per meter"
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-info"
                        />
                      </div>

                      {manualReadyLaceCost && parseFloat(manualReadyLaceCost) > 0 && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-background p-3 rounded-lg border">
                            <div className="text-sm text-muted-foreground">Cost per Meter</div>
                            <div className="text-xl font-bold text-foreground">
                              ₹{parseFloat(manualReadyLaceCost).toFixed(2)}
                            </div>
                          </div>
                          <div className="bg-background p-3 rounded-lg border">
                            <div className="text-sm text-muted-foreground">Total Cost</div>
                            <div className="text-xl font-bold text-foreground">
                              ₹{(parseFloat(manualReadyLaceCost) * totalQuantityNeeded).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Reason for Custom Price <span className="text-destructive">*</span>
                        </label>
                        <textarea
                          value={readyLaceOverrideReason}
                          onChange={(e) => setReadyLaceOverrideReason(e.target.value)}
                          placeholder="e.g., Quoted price from supplier XYZ, negotiated rate, etc."
                          rows={2}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-info"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSelectReadyManual}
                      disabled={
                        !manualReadyLaceCost || parseFloat(manualReadyLaceCost) <= 0 || !readyLaceOverrideReason.trim()
                      }
                      className="w-full bg-info hover:bg-info/90 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Use Custom Price
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Greige + Dyeing Tab */}
            {activeTab === 'greige' && (
              <div>
                {greigeProcessing.available ? (
                  <div className="space-y-4">
                    <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                      <div className="flex items-center text-accent mb-2">
                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="font-medium">Greige + Dyeing Available</span>
                      </div>
                      <p className="text-sm text-accent">{greigeProcessing.details}</p>
                    </div>

                    {/* Lab Dip Status (unique to lace) */}
                    {greigeProcessing.labDipRequired && (
                      <div
                        className={`rounded-lg p-4 ${
                          greigeProcessing.labDipApproved
                            ? 'bg-success-muted border border-success/20'
                            : 'bg-warning-muted border border-warning/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${
                              greigeProcessing.labDipApproved ? 'text-success' : 'text-warning'
                            }`}
                          >
                            Lab Dip: {greigeProcessing.labDipApproved ? 'Approved' : 'Pending Approval'}
                          </span>
                          {greigeProcessing.labDipStatus && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded">
                              {greigeProcessing.labDipStatus}
                            </span>
                          )}
                        </div>
                        {!greigeProcessing.labDipApproved && (
                          <p className="text-xs text-warning mt-1">
                            Lab dip must be approved before generating processing PO
                          </p>
                        )}
                      </div>
                    )}

                    {/* Manual Override Toggle */}
                    <div className="bg-muted p-4 rounded-lg">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useManualOverride}
                          onChange={(e) => setUseManualOverride(e.target.checked)}
                          className="h-4 w-4 text-info rounded border-border"
                        />
                        <span className="ml-2 text-sm font-medium text-foreground">Manually override greige cost</span>
                      </label>

                      {useManualOverride && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              Greige Cost per Meter (₹)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={manualGreigeCost}
                              onChange={(e) => setManualGreigeCost(e.target.value)}
                              placeholder={greigeProcessing.costBreakdown.greigeCostPerMeter?.toFixed(2) || '0.00'}
                              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-info"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                              Justification for Override
                            </label>
                            <textarea
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                              placeholder="Explain why you're overriding the system cost..."
                              rows={2}
                              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-info"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm text-muted-foreground">Greige Cost/m</div>
                        <div className="text-2xl font-bold text-foreground mt-1">
                          {useManualOverride && manualGreigeCost
                            ? formatCurrency(parseFloat(manualGreigeCost))
                            : formatCurrency(greigeProcessing.costBreakdown.greigeCostPerMeter)}
                        </div>
                        {useManualOverride ? (
                          <span className="text-xs text-primary">Manual Override</span>
                        ) : (
                          greigeProcessing.greigeRateSource && (
                            <div className="mt-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent">
                                {getRateSourceLabel(greigeProcessing.greigeRateSource)}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm text-muted-foreground">Dyeing Cost/m</div>
                        <div className="text-2xl font-bold text-foreground mt-1">
                          {formatCurrency(greigeProcessing.costBreakdown.processingCostPerMeter)}
                        </div>
                        {greigeProcessing.slabLabel && (
                          <span className="text-xs text-muted-foreground">{greigeProcessing.slabLabel}</span>
                        )}
                        {greigeProcessing.processingRateSource && (
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                              {getRateSourceLabel(greigeProcessing.processingRateSource)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm text-muted-foreground">Effective Cost/m</div>
                        <div className="text-xl font-bold text-foreground mt-1">
                          {formatCurrency(greigeProcessing.costBreakdown.effectiveCostPerMeter)}
                        </div>
                        {greigeProcessing.shrinkagePercent && (
                          <span className="text-xs text-muted-foreground">
                            incl. {greigeProcessing.shrinkagePercent}% shrinkage
                          </span>
                        )}
                      </div>
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="text-sm text-muted-foreground">Greige Qty Needed</div>
                        <div className="text-xl font-bold text-foreground mt-1">
                          {greigeProcessing.greigeQuantityNeeded?.toFixed(2)}m
                        </div>
                      </div>
                      <div className="bg-muted p-4 rounded-lg col-span-2">
                        <div className="text-sm text-muted-foreground">Total Cost</div>
                        <div className="text-3xl font-bold text-foreground mt-1">
                          {formatCurrency(greigeProcessing.totalCost)}
                        </div>
                      </div>
                      {greigeProcessing.processorName && (
                        <div className="bg-muted p-4 rounded-lg">
                          <div className="text-sm text-muted-foreground">Processor</div>
                          <div className="text-lg font-semibold text-foreground mt-1">
                            {greigeProcessing.processorName}
                          </div>
                        </div>
                      )}
                      {greigeProcessing.greigeLaceName && (
                        <div className="bg-muted p-4 rounded-lg">
                          <div className="text-sm text-muted-foreground">Greige Lace</div>
                          <div className="text-lg font-semibold text-foreground mt-1">
                            {greigeProcessing.greigeLaceName}
                          </div>
                        </div>
                      )}
                    </div>

                    {(() => {
                      const savingsData = calculateSavings(greigeProcessing.totalCost);
                      return (
                        savingsData && (
                          <div className="bg-warning-muted border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                            Using this option saves {formatCurrency(savingsData.amount)} (
                            {savingsData.percent.toFixed(1)}%)
                          </div>
                        )
                      );
                    })()}

                    <button
                      onClick={handleSelectGreige}
                      disabled={useManualOverride && (!manualGreigeCost || !overrideReason.trim())}
                      className="w-full bg-info hover:bg-info/90 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {useManualOverride ? 'Select Greige + Dyeing (Manual Override)' : 'Select Greige + Dyeing'}
                    </button>
                  </div>
                ) : laceCostData.isGreige ? (
                  /* This lace IS greige: offer to dye it rather than dead-ending. Creating the
                     finished variant is what gives the dyed lace its own stock identity, so the
                     same greige can stay as-is in one style and be dyed in another. */
                  <div className="space-y-4">
                    <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                      <p className="font-medium text-accent">Dye this greige lace</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Pick the colour to dye it to. A finished lace is created for that colour (reused if it already
                        exists) and this line is costed as Greige + Dyeing against it. The greige itself stays available
                        for styles that use it undyed.
                      </p>
                    </div>

                    <div className="bg-muted p-4 rounded-lg space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Dye to Colour <span className="text-destructive">*</span>
                        </label>
                        <ColorPicker
                          value={dyeColorId}
                          onChange={(colorId, color) => {
                            setDyeColorId(colorId);
                            setDyeColorName(color?.colorName || '');
                          }}
                          showFamilyFilter={true}
                          placeholder="Select colour from master..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Processor (optional)</label>
                        <SupplierCombobox
                          value={dyeProcessorId}
                          onValueChange={setDyeProcessorId}
                          placeholder="Let the system pick the cheapest rate..."
                          categoryFilter="DYEING_PRINTING"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Choose a dyer to price their rate card specifically. Leave empty to use the cheapest available
                          rate. An approved lab dip for this colour always wins.
                        </p>
                      </div>
                    </div>

                    {variantError && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                        {variantError}
                      </div>
                    )}

                    <button
                      onClick={handleCreateDyedVariant}
                      disabled={!dyeColorName.trim() || isCreatingVariant}
                      className="w-full bg-info hover:bg-info/90 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isCreatingVariant ? 'Creating and costing...' : 'Create Dyed Variant & Cost'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
                    <svg
                      className="h-12 w-12 text-destructive mx-auto mb-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <h3 className="text-lg font-medium text-destructive mb-1">Greige + Dyeing Not Available</h3>
                    <p className="text-sm text-destructive">{greigeProcessing.details}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comparison Table */}
          <div className="border-t px-6 py-4 bg-muted">
            <h3 className="text-sm font-medium text-foreground mb-3">Cost Comparison</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-foreground">Strategy</th>
                    <th className="text-right py-2 font-medium text-foreground">Cost/m</th>
                    <th className="text-right py-2 font-medium text-foreground">Total</th>
                    <th className="text-center py-2 font-medium text-foreground">Status</th>
                    <th className="text-left py-2 font-medium text-foreground">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {laceCostData.comparisonTable.map((row, idx) => {
                    const strategyKey =
                      row.strategy === 'Stock Reuse'
                        ? 'STOCK_REUSE'
                        : row.strategy === 'Ready Lace'
                          ? 'READY_LACE'
                          : 'GREIGE_PROCESSED';
                    const isRowRecommended = laceCostData.recommendedStrategy === strategyKey;
                    return (
                      <tr key={idx} className={isRowRecommended ? 'bg-success-muted' : ''}>
                        <td className="py-2">
                          {row.strategy}
                          {isRowRecommended && (
                            <span className="ml-2 text-xs text-success font-medium">Recommended</span>
                          )}
                        </td>
                        <td className="text-right py-2">{formatCurrency(row.costPerMeter)}</td>
                        <td className="text-right py-2 font-semibold">{formatCurrency(row.totalCost)}</td>
                        <td className="text-center py-2">
                          {row.available ? (
                            <span className="text-success">✓</span>
                          ) : (
                            <span className="text-destructive">✗</span>
                          )}
                        </td>
                        <td className="text-left py-2 text-xs text-muted-foreground">{row.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
