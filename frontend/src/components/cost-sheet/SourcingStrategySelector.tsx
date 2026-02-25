/**
 * Sourcing Strategy Selector Component
 * Modal/drawer showing 3 sourcing options with cost comparison
 */

import { useState } from 'react';
import type { FabricCostCalculationResult } from '../../types/fabricCosting.types';

interface SourcingStrategySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  fabricCostData: FabricCostCalculationResult;
  onSelectStrategy: (strategy: {
    sourcingStrategy: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED';
    cost: number;
    stockLotId?: string;
    processorId?: string;
    rateCardId?: string;
    procurementId?: string;
    greigeCost?: number;
    processingCost?: number;
    isManualOverride?: boolean;
    overrideReason?: string;
  }) => void;
}

type TabType = 'stock' | 'ready' | 'greige';

export default function SourcingStrategySelector({
  isOpen,
  onClose,
  fabricCostData,
  onSelectStrategy,
}: SourcingStrategySelectorProps) {
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    // Set initial tab based on recommended strategy
    if (fabricCostData.recommendedStrategy === 'STOCK_REUSE') return 'stock';
    if (fabricCostData.recommendedStrategy === 'READY_FABRIC') return 'ready';
    if (fabricCostData.recommendedStrategy === 'GREIGE_PROCESSED') return 'greige';
    return 'stock';
  });

  const [manualGreigeCost, setManualGreigeCost] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState('');
  const [useManualOverride, setUseManualOverride] = useState(false);

  if (!isOpen) return null;

  const { stockReuse, readyFabric, greigeProcessing, recommendedCost, savings } = fabricCostData;

  const handleSelectStock = () => {
    if (!stockReuse.available) return;
    onSelectStrategy({
      sourcingStrategy: 'STOCK_REUSE',
      cost: stockReuse.totalCost!,
      stockLotId: stockReuse.stockLotId!,
    });
    onClose();
  };

  const handleSelectReady = () => {
    if (!readyFabric.available) return;
    onSelectStrategy({
      sourcingStrategy: 'READY_FABRIC',
      cost: readyFabric.totalCost!,
      procurementId: readyFabric.procurementId || undefined,
    });
    onClose();
  };

  const handleSelectGreige = () => {
    if (!greigeProcessing.available) return;

    if (useManualOverride && manualGreigeCost) {
      const manualGreige = parseFloat(manualGreigeCost);
      const totalCost = manualGreige + (greigeProcessing.processingCost || 0);

      onSelectStrategy({
        sourcingStrategy: 'GREIGE_PROCESSED',
        cost: totalCost,
        processorId: greigeProcessing.processorId || undefined,
        rateCardId: greigeProcessing.rateCardId || undefined,
        greigeCost: manualGreige,
        processingCost: greigeProcessing.processingCost || undefined,
        isManualOverride: true,
        overrideReason,
      });
    } else {
      onSelectStrategy({
        sourcingStrategy: 'GREIGE_PROCESSED',
        cost: greigeProcessing.totalCost!,
        processorId: greigeProcessing.processorId || undefined,
        rateCardId: greigeProcessing.rateCardId || undefined,
        greigeCost: greigeProcessing.greigeCost || undefined,
        processingCost: greigeProcessing.processingCost || undefined,
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
      'STOCK_WAC': 'Stock WAC',
      'PROCUREMENT': 'Procurement',
      'FABRIC_MASTER': 'Fabric Master',
      'GREIGE_MASTER': 'Greige Master',
      'RATE_CARD': 'Rate Card',
      'PROCESSOR_DEFAULT': 'Processor Default',
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Select Sourcing Strategy
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {fabricCostData.fabricName} - {fabricCostData.cadMeters}m × {fabricCostData.width}"
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Choose how to source this fabric: use existing stock, purchase ready fabric, or process greige fabric.
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Recommended Badge */}
            {recommendedCost && savings && (
              <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm">
                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Stock Reuse
                {fabricCostData.recommendedStrategy === 'STOCK_REUSE' && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                    Recommended
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('ready')}
                className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === 'ready'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Ready Fabric
                {fabricCostData.recommendedStrategy === 'READY_FABRIC' && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                    Recommended
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('greige')}
                className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === 'greige'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Greige + Processing
                {fabricCostData.recommendedStrategy === 'GREIGE_PROCESSED' && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                    Recommended
                  </span>
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
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center text-green-800 mb-2">
                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Stock Available</span>
                      </div>
                      <p className="text-sm text-green-700">{stockReuse.details}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">Cost per Meter</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {formatCurrency(stockReuse.stockCost)}
                        </div>
                        {/* Rate Source Badge */}
                        {stockReuse.rateSource && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {getRateSourceLabel(stockReuse.rateSource)}
                            </span>
                            {stockReuse.lastUpdated && (
                              <span className="text-xs text-gray-500">
                                as of {formatDate(stockReuse.lastUpdated)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">Total Cost</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {formatCurrency(stockReuse.totalCost)}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">Available Quantity</div>
                        <div className="text-lg font-semibold text-gray-900 mt-1">
                          {stockReuse.quantityAvailable?.toFixed(2)}m
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">Warehouse</div>
                        <div className="text-lg font-semibold text-gray-900 mt-1">
                          {stockReuse.warehouseLocation || 'Main'}
                        </div>
                      </div>
                    </div>

                    {stockReuse.originStyleName && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Origin Style:</span> {stockReuse.originStyleName}
                      </div>
                    )}

                    {(() => {
                      const savingsData = calculateSavings(stockReuse.totalCost);
                      return savingsData && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                          Using this option saves {formatCurrency(savingsData.amount)} ({savingsData.percent.toFixed(1)}%)
                        </div>
                      );
                    })()}

                    <button
                      onClick={handleSelectStock}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      Select Stock Reuse
                    </button>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <svg className="h-12 w-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <h3 className="text-lg font-medium text-red-900 mb-1">Stock Not Available</h3>
                    <p className="text-sm text-red-700">{stockReuse.details}</p>
                  </div>
                )}
              </div>
            )}

            {/* Ready Fabric Tab */}
            {activeTab === 'ready' && (
              <div>
                {readyFabric.available ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center text-blue-800 mb-2">
                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Ready Fabric Available</span>
                      </div>
                      <p className="text-sm text-blue-700">{readyFabric.details}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">Cost per Meter</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {formatCurrency(readyFabric.readyFabricCost)}
                        </div>
                        {/* Rate Source Badge */}
                        {readyFabric.rateSource && (
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {getRateSourceLabel(readyFabric.rateSource)}
                            </span>
                            {readyFabric.rateSource === 'PROCUREMENT' && readyFabric.procurementDate && (
                              <span className="text-xs text-gray-500">
                                PO dated {formatDate(readyFabric.procurementDate)}
                              </span>
                            )}
                            {readyFabric.rateSource === 'FABRIC_MASTER' && readyFabric.lastUpdated && (
                              <span className="text-xs text-gray-500">
                                as of {formatDate(readyFabric.lastUpdated)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">Total Cost</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {formatCurrency(readyFabric.totalCost)}
                        </div>
                      </div>
                      {readyFabric.leadTimeDays && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm text-gray-600">Lead Time</div>
                          <div className="text-lg font-semibold text-gray-900 mt-1">
                            {readyFabric.leadTimeDays} days
                          </div>
                        </div>
                      )}
                      {readyFabric.supplierName && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm text-gray-600">Supplier</div>
                          <div className="text-lg font-semibold text-gray-900 mt-1">
                            {readyFabric.supplierName}
                          </div>
                        </div>
                      )}
                    </div>

                    {(() => {
                      const savingsData = calculateSavings(readyFabric.totalCost);
                      return savingsData && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                          Using this option saves {formatCurrency(savingsData.amount)} ({savingsData.percent.toFixed(1)}%)
                        </div>
                      );
                    })()}

                    <button
                      onClick={handleSelectReady}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      Select Ready Fabric
                    </button>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <svg className="h-12 w-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <h3 className="text-lg font-medium text-red-900 mb-1">Ready Fabric Not Available</h3>
                    <p className="text-sm text-red-700">{readyFabric.details}</p>
                  </div>
                )}
              </div>
            )}

            {/* Greige + Processing Tab */}
            {activeTab === 'greige' && (
              <div>
                {greigeProcessing.available ? (
                  <div className="space-y-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center text-purple-800 mb-2">
                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Greige + Processing Available</span>
                      </div>
                      <p className="text-sm text-purple-700">{greigeProcessing.details}</p>
                    </div>

                    {/* Manual Override Toggle */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useManualOverride}
                          onChange={(e) => setUseManualOverride(e.target.checked)}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-900">
                          Manually override greige cost
                        </span>
                      </label>

                      {useManualOverride && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Greige Cost per Meter (₹)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={manualGreigeCost}
                              onChange={(e) => setManualGreigeCost(e.target.value)}
                              placeholder={greigeProcessing.greigeCost?.toFixed(2) || '0.00'}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Justification for Override
                            </label>
                            <textarea
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                              placeholder="Explain why you're overriding the system cost..."
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">Greige Cost/m</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {useManualOverride && manualGreigeCost
                            ? formatCurrency(parseFloat(manualGreigeCost))
                            : formatCurrency(greigeProcessing.greigeCost)}
                        </div>
                        {useManualOverride ? (
                          <span className="text-xs text-orange-600">Manual Override</span>
                        ) : greigeProcessing.greigeRateSource && (
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              {getRateSourceLabel(greigeProcessing.greigeRateSource)}
                            </span>
                            {greigeProcessing.greigeRateSource === 'PROCUREMENT' && greigeProcessing.greigeProcurementDate && (
                              <span className="text-xs text-gray-500">
                                PO dated {formatDate(greigeProcessing.greigeProcurementDate)}
                              </span>
                            )}
                            {(greigeProcessing.greigeRateSource === 'STOCK_WAC' || greigeProcessing.greigeRateSource === 'GREIGE_MASTER') && greigeProcessing.lastUpdated && (
                              <span className="text-xs text-gray-500">
                                as of {formatDate(greigeProcessing.lastUpdated)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">Processing Cost/m</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {formatCurrency(greigeProcessing.processingCost)}
                        </div>
                        {/* Processing Rate Source Badge */}
                        {greigeProcessing.processingRateSource && (
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                              {getRateSourceLabel(greigeProcessing.processingRateSource)}
                            </span>
                            {greigeProcessing.processingRateSource === 'RATE_CARD' && greigeProcessing.rateCardEffectiveDate && (
                              <span className="text-xs text-gray-500">
                                effective {formatDate(greigeProcessing.rateCardEffectiveDate)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg col-span-2">
                        <div className="text-sm text-gray-600">Total Cost</div>
                        <div className="text-3xl font-bold text-gray-900 mt-1">
                          {useManualOverride && manualGreigeCost
                            ? formatCurrency(
                                parseFloat(manualGreigeCost) * fabricCostData.cadMeters +
                                  (greigeProcessing.processingCost || 0) * fabricCostData.cadMeters
                              )
                            : formatCurrency(greigeProcessing.totalCost)}
                        </div>
                      </div>
                      {greigeProcessing.processorName && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm text-gray-600">Processor</div>
                          <div className="text-lg font-semibold text-gray-900 mt-1">
                            {greigeProcessing.processorName}
                          </div>
                        </div>
                      )}
                      {greigeProcessing.turnaroundDays && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm text-gray-600">Turnaround</div>
                          <div className="text-lg font-semibold text-gray-900 mt-1">
                            {greigeProcessing.turnaroundDays} days
                          </div>
                        </div>
                      )}
                    </div>

                    {(() => {
                      const currentCost = useManualOverride && manualGreigeCost
                        ? parseFloat(manualGreigeCost) * fabricCostData.cadMeters +
                          (greigeProcessing.processingCost || 0) * fabricCostData.cadMeters
                        : greigeProcessing.totalCost;
                      const savingsData = calculateSavings(currentCost);
                      return savingsData && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                          Using this option saves {formatCurrency(savingsData.amount)} ({savingsData.percent.toFixed(1)}%)
                        </div>
                      );
                    })()}

                    <button
                      onClick={handleSelectGreige}
                      disabled={useManualOverride && (!manualGreigeCost || !overrideReason.trim())}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {useManualOverride
                        ? 'Select Greige + Processing (Manual Override)'
                        : 'Select Greige + Processing'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <svg className="h-12 w-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <h3 className="text-lg font-medium text-red-900 mb-1">Greige + Processing Not Available</h3>
                    <p className="text-sm text-red-700">{greigeProcessing.details}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comparison Table */}
          <div className="border-t px-6 py-4 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Cost Comparison</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium text-gray-700">Strategy</th>
                    <th className="text-right py-2 font-medium text-gray-700">Cost/m</th>
                    <th className="text-right py-2 font-medium text-gray-700">Total</th>
                    <th className="text-center py-2 font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fabricCostData.comparisonTable.map((row, idx) => (
                    <tr key={idx} className={row.isRecommended ? 'bg-green-50' : ''}>
                      <td className="py-2">
                        {row.strategy}
                        {row.isRecommended && (
                          <span className="ml-2 text-xs text-green-600 font-medium">Recommended</span>
                        )}
                      </td>
                      <td className="text-right py-2">{formatCurrency(row.costPerMeter)}</td>
                      <td className="text-right py-2 font-semibold">{formatCurrency(row.totalCost)}</td>
                      <td className="text-center py-2">
                        {row.available ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-red-600">✗</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
