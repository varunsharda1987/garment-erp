/**
 * Cost Comparison Table Component
 * Side-by-side comparison of all sourcing options for multiple fabrics
 */

import type { FabricCostCalculationResult } from '../../types/fabricCosting.types';

interface CostComparisonTableProps {
  fabricResults: FabricCostCalculationResult[];
  className?: string;
}

export default function CostComparisonTable({ fabricResults, className = '' }: CostComparisonTableProps) {
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return `₹${amount.toFixed(2)}`;
  };

  const calculateTotals = () => {
    const stockTotal = fabricResults.reduce(
      (sum, fabric) => sum + (fabric.stockReuse.available ? fabric.stockReuse.totalCost || 0 : 0),
      0
    );
    const readyTotal = fabricResults.reduce(
      (sum, fabric) => sum + (fabric.readyFabric.available ? fabric.readyFabric.totalCost || 0 : 0),
      0
    );
    const greigeTotal = fabricResults.reduce(
      (sum, fabric) => sum + (fabric.greigeProcessing.available ? fabric.greigeProcessing.totalCost || 0 : 0),
      0
    );
    const recommendedTotal = fabricResults.reduce((sum, fabric) => sum + (fabric.recommendedCost || 0), 0);
    const totalSavings = fabricResults.reduce((sum, fabric) => sum + (fabric.savings || 0), 0);

    return {
      stockTotal,
      readyTotal,
      greigeTotal,
      recommendedTotal,
      totalSavings,
    };
  };

  const totals = calculateTotals();

  if (fabricResults.length === 0) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-6 text-center ${className}`}>
        <p className="text-gray-600">No fabric cost data available</p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">Fabric Sourcing Cost Comparison</h3>
        <p className="text-sm text-gray-600 mt-1">
          Compare all available sourcing options across {fabricResults.length} fabric
          {fabricResults.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fabric</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-green-700 uppercase tracking-wider bg-green-50">
                Stock Reuse
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-blue-700 uppercase tracking-wider bg-blue-50">
                Ready Fabric
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-purple-700 uppercase tracking-wider bg-purple-50">
                Greige + Processing
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider bg-yellow-50">
                Recommended
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider bg-yellow-50">
                Savings
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {fabricResults.map((fabric, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {/* Fabric Name */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{fabric.fabricName}</div>
                  <div className="text-xs text-gray-500">{fabric.width}" width</div>
                </td>

                {/* Quantity */}
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                  {fabric.cadMeters.toFixed(2)}m
                </td>

                {/* Stock Reuse */}
                <td className="px-6 py-4 whitespace-nowrap text-right bg-green-50">
                  {fabric.stockReuse.available ? (
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(fabric.stockReuse.totalCost)}
                      </div>
                      <div className="text-xs text-gray-600">{formatCurrency(fabric.stockReuse.stockCost)}/m</div>
                      {fabric.recommendedStrategy === 'STOCK_REUSE' && (
                        <div className="text-xs text-green-700 font-medium mt-1">✓ Recommended</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">N/A</span>
                  )}
                </td>

                {/* Ready Fabric */}
                <td className="px-6 py-4 whitespace-nowrap text-right bg-blue-50">
                  {fabric.readyFabric.available ? (
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(fabric.readyFabric.totalCost)}
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatCurrency(fabric.readyFabric.readyFabricCost)}/m
                      </div>
                      {fabric.recommendedStrategy === 'READY_FABRIC' && (
                        <div className="text-xs text-blue-700 font-medium mt-1">✓ Recommended</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">N/A</span>
                  )}
                </td>

                {/* Greige + Processing */}
                <td className="px-6 py-4 whitespace-nowrap text-right bg-purple-50">
                  {fabric.greigeProcessing.available ? (
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(fabric.greigeProcessing.totalCost)}
                      </div>
                      <div className="text-xs text-gray-600">
                        Greige: {formatCurrency(fabric.greigeProcessing.greigeCost)}/m
                        <br />
                        Process: {formatCurrency(fabric.greigeProcessing.processingCost)}/m
                      </div>
                      {fabric.recommendedStrategy === 'GREIGE_PROCESSED' && (
                        <div className="text-xs text-purple-700 font-medium mt-1">✓ Recommended</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">N/A</span>
                  )}
                </td>

                {/* Recommended */}
                <td className="px-6 py-4 whitespace-nowrap text-right bg-yellow-50">
                  <div className="text-sm font-bold text-gray-900">{formatCurrency(fabric.recommendedCost)}</div>
                  <div className="text-xs text-gray-600 capitalize">
                    {fabric.recommendedStrategy.replace('_', ' ').toLowerCase()}
                  </div>
                </td>

                {/* Savings */}
                <td className="px-6 py-4 whitespace-nowrap text-right bg-yellow-50">
                  {fabric.savings ? (
                    <div className="text-sm font-semibold text-green-700">{formatCurrency(fabric.savings)}</div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}

            {/* Totals Row */}
            <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
              <td className="px-6 py-4 text-sm text-gray-900" colSpan={2}>
                TOTAL
              </td>
              <td className="px-6 py-4 text-right bg-green-100">
                <div className="text-sm font-bold text-gray-900">{formatCurrency(totals.stockTotal)}</div>
              </td>
              <td className="px-6 py-4 text-right bg-blue-100">
                <div className="text-sm font-bold text-gray-900">{formatCurrency(totals.readyTotal)}</div>
              </td>
              <td className="px-6 py-4 text-right bg-purple-100">
                <div className="text-sm font-bold text-gray-900">{formatCurrency(totals.greigeTotal)}</div>
              </td>
              <td className="px-6 py-4 text-right bg-yellow-100">
                <div className="text-base font-bold text-gray-900">{formatCurrency(totals.recommendedTotal)}</div>
              </td>
              <td className="px-6 py-4 text-right bg-yellow-100">
                <div className="text-base font-bold text-green-700">{formatCurrency(totals.totalSavings)}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="bg-gray-50 px-6 py-4 border-t">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">
              Recommended Total Cost: {formatCurrency(totals.recommendedTotal)}
            </div>
            {totals.totalSavings > 0 && (
              <div className="text-sm text-green-700 mt-1">
                Total Potential Savings: {formatCurrency(totals.totalSavings)}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-200 rounded mr-1"></div>
              <span className="text-gray-600">Stock Reuse</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-200 rounded mr-1"></div>
              <span className="text-gray-600">Ready Fabric</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-purple-200 rounded mr-1"></div>
              <span className="text-gray-600">Greige + Processing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
