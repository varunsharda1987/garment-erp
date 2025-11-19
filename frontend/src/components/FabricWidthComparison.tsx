import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Check, TrendingDown, Star } from 'lucide-react';
import type { CadAverage } from '../types/style.types';

interface FabricWidthComparisonProps {
  fabricName: string;
  cadAverages: CadAverage[];
  materialRate?: number; // Cost per meter/yard
  orderQuantity?: number; // For scaling calculations
  onSelectWidth?: (width: number, cadAverage: number) => void;
  selectedWidth?: number;
}

export const FabricWidthComparison: React.FC<FabricWidthComparisonProps> = ({
  fabricName,
  cadAverages,
  materialRate = 0,
  orderQuantity = 1,
  onSelectWidth,
  selectedWidth,
}) => {
  const comparisons = useMemo(() => {
    if (!cadAverages || cadAverages.length === 0) return [];

    return cadAverages
      .map((cad) => {
        const consumption = cad.cadAverageMeters || cad.cadAverageYards || 0;
        const unit = cad.cadAverageMeters ? 'm' : 'yd';
        const costPerPiece = consumption * materialRate;
        const totalCost = costPerPiece * orderQuantity;
        const wastage = cad.cadWastagePercent || 0;
        const efficiency = cad.markerEfficiency || 0;

        return {
          width: cad.fabricWidth,
          consumption,
          unit,
          costPerPiece,
          totalCost,
          wastage,
          efficiency,
          isPreferred: cad.isPreferred,
          notes: cad.notes,
        };
      })
      .sort((a, b) => a.costPerPiece - b.costPerPiece); // Sort by cost (cheapest first)
  }, [cadAverages, materialRate, orderQuantity]);

  if (comparisons.length === 0) {
    return null;
  }

  const cheapest = comparisons[0];
  const preferred = comparisons.find((c) => c.isPreferred);

  return (
    <Card className="mt-4 border-blue-200 bg-blue-50/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-blue-600">📊</span>
          Width Comparison for {fabricName}
          {materialRate > 0 && (
            <Badge variant="outline" className="ml-auto">
              Rate: ₹{materialRate.toFixed(2)}/{comparisons[0].unit}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-white/50">
                <th className="text-left p-3 font-semibold">Width</th>
                <th className="text-right p-3 font-semibold">Consumption</th>
                <th className="text-right p-3 font-semibold">Wastage</th>
                <th className="text-right p-3 font-semibold">Efficiency</th>
                <th className="text-right p-3 font-semibold">Cost/Piece</th>
                {orderQuantity > 1 && (
                  <th className="text-right p-3 font-semibold">
                    Total ({orderQuantity} pcs)
                  </th>
                )}
                <th className="text-center p-3 font-semibold">Status</th>
                {onSelectWidth && (
                  <th className="text-center p-3 font-semibold">Select</th>
                )}
              </tr>
            </thead>
            <tbody>
              {comparisons.map((comp, index) => {
                const isCheapest = comp.width === cheapest.width;
                const isSelected = selectedWidth === comp.width;
                const rowClass = isSelected
                  ? 'bg-green-100 border-green-300'
                  : isCheapest
                  ? 'bg-yellow-50'
                  : 'bg-white';

                return (
                  <tr
                    key={comp.width}
                    className={`border-b hover:bg-gray-50 transition-colors ${rowClass}`}
                  >
                    <td className="p-3 font-medium">
                      {comp.width}"
                      {comp.isPreferred && (
                        <Badge variant="default" className="ml-2 text-xs gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          Preferred
                        </Badge>
                      )}
                    </td>
                    <td className="text-right p-3">
                      {comp.consumption.toFixed(3)} {comp.unit}
                    </td>
                    <td className="text-right p-3">{comp.wastage.toFixed(1)}%</td>
                    <td className="text-right p-3">
                      {comp.efficiency > 0 ? `${comp.efficiency.toFixed(1)}%` : '-'}
                    </td>
                    <td className="text-right p-3 font-semibold">
                      ₹{comp.costPerPiece.toFixed(2)}
                    </td>
                    {orderQuantity > 1 && (
                      <td className="text-right p-3 font-medium">
                        ₹{comp.totalCost.toFixed(2)}
                      </td>
                    )}
                    <td className="text-center p-3">
                      {isCheapest && (
                        <Badge className="gap-1 bg-yellow-500">
                          <TrendingDown className="h-3 w-3" />
                          Cheapest
                        </Badge>
                      )}
                      {isSelected && !isCheapest && (
                        <Badge variant="default" className="gap-1 bg-green-600">
                          <Check className="h-3 w-3" />
                          Selected
                        </Badge>
                      )}
                    </td>
                    {onSelectWidth && (
                      <td className="text-center p-3">
                        <button
                          type="button"
                          onClick={() => onSelectWidth(comp.width, comp.consumption)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Use This'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Savings Analysis */}
        {comparisons.length > 1 && materialRate > 0 && (
          <div className="mt-4 p-3 bg-white rounded border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  💰 Cost Savings Analysis
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Comparing cheapest ({cheapest.width}") vs preferred (
                  {preferred?.width || 'N/A'}")
                </p>
              </div>
              <div className="text-right">
                {preferred && preferred.width !== cheapest.width ? (
                  <>
                    <p className="text-lg font-bold text-green-600">
                      ₹{(preferred.costPerPiece - cheapest.costPerPiece).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600">savings per piece</p>
                    {orderQuantity > 1 && (
                      <p className="text-xs font-semibold text-green-700 mt-1">
                        ₹{((preferred.costPerPiece - cheapest.costPerPiece) * orderQuantity).toFixed(2)} total savings
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-green-600 font-medium">
                    ✓ Using optimal width
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes Display */}
        {comparisons.some((c) => c.notes) && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold text-gray-600">Notes:</p>
            {comparisons
              .filter((c) => c.notes)
              .map((c) => (
                <p key={c.width} className="text-xs text-gray-500 pl-2">
                  • {c.width}": {c.notes}
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
