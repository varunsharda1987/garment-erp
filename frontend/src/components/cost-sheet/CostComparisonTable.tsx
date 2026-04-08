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
      <div className={`bg-muted border border-border rounded-lg p-6 text-center ${className}`}>
        <p className="text-muted-foreground">No fabric cost data available</p>
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-muted px-6 py-4 border-b">
        <h3 className="text-lg font-semibold text-foreground">Fabric Sourcing Cost Comparison</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Compare all available sourcing options across {fabricResults.length} fabric
          {fabricResults.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Fabric
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-success uppercase tracking-wider bg-success-muted">
                Stock Reuse
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-info uppercase tracking-wider bg-info-muted">
                Ready Fabric
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-accent uppercase tracking-wider bg-accent/10">
                Greige + Processing
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-foreground uppercase tracking-wider bg-warning-muted">
                Recommended
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-foreground uppercase tracking-wider bg-warning-muted">
                Savings
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-gray-200">
            {fabricResults.map((fabric, index) => (
              <tr key={index} className="hover:bg-muted">
                {/* Fabric Name */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-foreground">{fabric.fabricName}</div>
                  <div className="text-xs text-muted-foreground">{fabric.width}" width</div>
                </td>

                {/* Quantity */}
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-foreground">
                  {fabric.cadMeters.toFixed(2)}m
                </td>

                {/* Stock Reuse */}
                <td className="px-6 py-4 whitespace-nowrap text-right bg-success-muted">
                  {fabric.stockReuse.available ? (
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {formatCurrency(fabric.stockReuse.totalCost)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(fabric.stockReuse.stockCost)}/m
                      </div>
                      {fabric.recommendedStrategy === 'STOCK_REUSE' && (
                        <div className="text-xs text-success font-medium mt-1">✓ Recommended</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">N/A</span>
                  )}
                </td>

                {/* Ready Fabric */}
                <td className="px-6 py-4 whitespace-nowrap text-right bg-info-muted">
                  {fabric.readyFabric.available ? (
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {formatCurrency(fabric.readyFabric.totalCost)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(fabric.readyFabric.readyFabricCost)}/m
                      </div>
                      {fabric.recommendedStrategy === 'READY_FABRIC' && (
                        <div className="text-xs text-info font-medium mt-1">✓ Recommended</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">N/A</span>
                  )}
                </td>

                {/* Greige + Processing */}
                <td className="px-6 py-4 whitespace-nowrap text-right bg-accent/10">
                  {fabric.greigeProcessing.available ? (
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {formatCurrency(fabric.greigeProcessing.totalCost)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Greige: {formatCurrency(fabric.greigeProcessing.greigeCost)}/m
                        <br />
                        Process: {formatCurrency(fabric.greigeProcessing.processingCost)}/m
                      </div>
                      {fabric.recommendedStrategy === 'GREIGE_PROCESSED' && (
                        <div className="text-xs text-accent font-medium mt-1">✓ Recommended</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">N/A</span>
                  )}
                </td>

                {/* Recommended */}
                <td className="px-6 py-4 whitespace-nowrap text-right bg-warning-muted">
                  <div className="text-sm font-bold text-foreground">{formatCurrency(fabric.recommendedCost)}</div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {fabric.recommendedStrategy.replace('_', ' ').toLowerCase()}
                  </div>
                </td>

                {/* Savings */}
                <td className="px-6 py-4 whitespace-nowrap text-right bg-warning-muted">
                  {fabric.savings ? (
                    <div className="text-sm font-semibold text-success">{formatCurrency(fabric.savings)}</div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}

            {/* Totals Row */}
            <tr className="bg-muted font-semibold border-t-2 border-border">
              <td className="px-6 py-4 text-sm text-foreground" colSpan={2}>
                TOTAL
              </td>
              <td className="px-6 py-4 text-right bg-success-muted">
                <div className="text-sm font-bold text-foreground">{formatCurrency(totals.stockTotal)}</div>
              </td>
              <td className="px-6 py-4 text-right bg-info-muted">
                <div className="text-sm font-bold text-foreground">{formatCurrency(totals.readyTotal)}</div>
              </td>
              <td className="px-6 py-4 text-right bg-accent/10">
                <div className="text-sm font-bold text-foreground">{formatCurrency(totals.greigeTotal)}</div>
              </td>
              <td className="px-6 py-4 text-right bg-yellow-100">
                <div className="text-base font-bold text-foreground">{formatCurrency(totals.recommendedTotal)}</div>
              </td>
              <td className="px-6 py-4 text-right bg-yellow-100">
                <div className="text-base font-bold text-success">{formatCurrency(totals.totalSavings)}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="bg-muted px-6 py-4 border-t">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">
              Recommended Total Cost: {formatCurrency(totals.recommendedTotal)}
            </div>
            {totals.totalSavings > 0 && (
              <div className="text-sm text-success mt-1">
                Total Potential Savings: {formatCurrency(totals.totalSavings)}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-success/15 rounded mr-1"></div>
              <span className="text-muted-foreground">Stock Reuse</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-info/15 rounded mr-1"></div>
              <span className="text-muted-foreground">Ready Fabric</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-accent/15 rounded mr-1"></div>
              <span className="text-muted-foreground">Greige + Processing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
