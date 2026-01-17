/**
 * Cost Sheet Comparison Modal
 * Side-by-side comparison of approved cost sheets for order creation
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Calculator, GitBranch, Check, ArrowRight, Info, ChevronDown, ChevronUp } from 'lucide-react';
import type { CostSheet } from '../../types/costSheet.types';

interface CostSheetComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  costSheets: CostSheet[];
  selectedStyleName?: string;
  selectedStyleCode?: string;
  onSelectCostSheet: (costSheet: CostSheet) => void;
  loadingCostSheets?: boolean;
}

export default function CostSheetComparisonModal({
  isOpen,
  onClose,
  costSheets,
  selectedStyleName,
  selectedStyleCode,
  onSelectCostSheet,
  loadingCostSheets,
}: CostSheetComparisonModalProps) {
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(1)}%`;
  };

  const toggleComparison = (id: string) => {
    setSelectedForComparison((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : prev.length < 3
          ? [...prev, id]
          : prev
    );
  };

  // Filter to only approved cost sheets
  const approvedSheets = costSheets.filter(
    (cs) => cs.approvalStatus === 'APPROVED' || cs.isApproved
  );

  // Get sheets to display in comparison (either selected or first 3)
  const sheetsToCompare =
    selectedForComparison.length > 0
      ? approvedSheets.filter((cs) => selectedForComparison.includes(cs.id))
      : approvedSheets.slice(0, 3);

  // Find lowest and highest cost
  const lowestCost = Math.min(...approvedSheets.map((cs) => cs.totalCostPerPiece || 0));
  const highestPrice = Math.max(...approvedSheets.map((cs) => cs.sellingPricePerPiece || 0));

  const handleSelect = (cs: CostSheet) => {
    onSelectCostSheet(cs);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Compare Cost Sheets
          </DialogTitle>
          <DialogDescription>
            Compare approved cost sheets side-by-side to select the best pricing for your order.
            {selectedStyleCode && (
              <span className="block mt-1 font-medium text-gray-700">
                Style: {selectedStyleCode} {selectedStyleName && `- ${selectedStyleName}`}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loadingCostSheets ? (
          <div className="text-center py-12 text-gray-500">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            Loading cost sheets...
          </div>
        ) : approvedSheets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calculator className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-lg font-medium">No Approved Cost Sheets</p>
            <p className="text-sm mt-2">
              Create and approve a cost sheet for this style before creating orders.
            </p>
          </div>
        ) : (
          <>
            {/* Selection Helper */}
            {approvedSheets.length > 3 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Multiple cost sheets available</p>
                    <p className="text-blue-600">
                      Click on cost sheets below to select up to 3 for comparison.
                      {selectedForComparison.length > 0 && (
                        <button
                          onClick={() => setSelectedForComparison([])}
                          className="ml-2 underline hover:no-underline"
                        >
                          Clear selection
                        </button>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Comparison Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b font-medium text-gray-600 w-40">
                      Cost Component
                    </th>
                    {sheetsToCompare.map((cs) => (
                      <th
                        key={cs.id}
                        className={`text-center p-3 border-b cursor-pointer transition-colors ${
                          selectedForComparison.includes(cs.id)
                            ? 'bg-blue-100'
                            : 'hover:bg-gray-100'
                        }`}
                        onClick={() => toggleComparison(cs.id)}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              <GitBranch className="w-3 h-3 mr-1" />
                              v{cs.version || 1}
                            </Badge>
                            {cs.lockedForOrders && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                                Locked
                              </Badge>
                            )}
                          </div>
                          {cs.widthCombinationDescription && (
                            <span className="text-xs text-blue-600 font-normal">
                              {cs.widthCombinationDescription}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Fabric Cost */}
                  <tr className="hover:bg-gray-50">
                    <td className="p-3 border-b text-sm text-gray-600">Fabric</td>
                    {sheetsToCompare.map((cs) => (
                      <td key={cs.id} className="p-3 border-b text-center font-medium">
                        {formatCurrency(cs.fabricTotal)}
                      </td>
                    ))}
                  </tr>

                  {/* Trims Cost */}
                  <tr className="hover:bg-gray-50">
                    <td className="p-3 border-b text-sm text-gray-600">Trims</td>
                    {sheetsToCompare.map((cs) => (
                      <td key={cs.id} className="p-3 border-b text-center font-medium">
                        {formatCurrency(cs.trimsTotal)}
                      </td>
                    ))}
                  </tr>

                  {/* CMT Cost */}
                  <tr className="hover:bg-gray-50">
                    <td className="p-3 border-b text-sm text-gray-600">CMT</td>
                    {sheetsToCompare.map((cs) => (
                      <td key={cs.id} className="p-3 border-b text-center font-medium">
                        {formatCurrency(cs.cmtTotal)}
                      </td>
                    ))}
                  </tr>

                  {/* Embroidery Cost */}
                  <tr className="hover:bg-gray-50">
                    <td className="p-3 border-b text-sm text-gray-600">Embroidery</td>
                    {sheetsToCompare.map((cs) => (
                      <td key={cs.id} className="p-3 border-b text-center font-medium">
                        {formatCurrency(cs.embroideryTotal)}
                      </td>
                    ))}
                  </tr>

                  {/* Accessories Cost */}
                  <tr className="hover:bg-gray-50">
                    <td className="p-3 border-b text-sm text-gray-600">Accessories</td>
                    {sheetsToCompare.map((cs) => (
                      <td key={cs.id} className="p-3 border-b text-center font-medium">
                        {formatCurrency(cs.accessoriesTotal)}
                      </td>
                    ))}
                  </tr>

                  {/* Detailed Breakdown Toggle */}
                  {showDetails && (
                    <>
                      {/* Value Loss */}
                      <tr className="hover:bg-gray-50 bg-amber-50/30">
                        <td className="p-3 border-b text-sm text-gray-600 pl-6">
                          Value Loss ({sheetsToCompare[0]?.valueLossPercent}%)
                        </td>
                        {sheetsToCompare.map((cs) => (
                          <td key={cs.id} className="p-3 border-b text-center text-red-600">
                            +{formatCurrency(cs.valueLossAmount)}
                          </td>
                        ))}
                      </tr>

                      {/* Markup */}
                      <tr className="hover:bg-gray-50 bg-green-50/30">
                        <td className="p-3 border-b text-sm text-gray-600 pl-6">
                          Markup ({sheetsToCompare[0]?.markupPercent}%)
                        </td>
                        {sheetsToCompare.map((cs) => (
                          <td key={cs.id} className="p-3 border-b text-center text-green-600">
                            +{formatCurrency(cs.markupAmount)}
                          </td>
                        ))}
                      </tr>
                    </>
                  )}

                  {/* Toggle Details Button */}
                  <tr>
                    <td
                      colSpan={sheetsToCompare.length + 1}
                      className="p-1 text-center border-b"
                    >
                      <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 mx-auto"
                      >
                        {showDetails ? (
                          <>
                            <ChevronUp className="w-3 h-3" /> Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" /> Show Details
                          </>
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Total Material Cost */}
                  <tr className="bg-gray-100">
                    <td className="p-3 border-b text-sm font-medium text-gray-700">
                      Total Material
                    </td>
                    {sheetsToCompare.map((cs) => (
                      <td key={cs.id} className="p-3 border-b text-center font-semibold">
                        {formatCurrency(cs.totalMaterialCost)}
                      </td>
                    ))}
                  </tr>

                  {/* Total Processing Cost */}
                  <tr className="bg-gray-100">
                    <td className="p-3 border-b text-sm font-medium text-gray-700">
                      Total Processing
                    </td>
                    {sheetsToCompare.map((cs) => (
                      <td key={cs.id} className="p-3 border-b text-center font-semibold">
                        {formatCurrency(cs.totalProcessingCost)}
                      </td>
                    ))}
                  </tr>

                  {/* Total Cost Per Piece */}
                  <tr className="bg-blue-50">
                    <td className="p-3 border-b text-sm font-bold text-blue-800">
                      Cost Per Piece
                    </td>
                    {sheetsToCompare.map((cs) => (
                      <td
                        key={cs.id}
                        className={`p-3 border-b text-center font-bold ${
                          cs.totalCostPerPiece === lowestCost
                            ? 'text-green-700 bg-green-100'
                            : 'text-blue-800'
                        }`}
                      >
                        {formatCurrency(cs.totalCostPerPiece)}
                        {cs.totalCostPerPiece === lowestCost && (
                          <span className="block text-xs font-normal">Lowest Cost</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Selling Price Per Piece */}
                  <tr className="bg-green-50">
                    <td className="p-3 text-sm font-bold text-green-800">Selling Price</td>
                    {sheetsToCompare.map((cs) => (
                      <td
                        key={cs.id}
                        className={`p-3 text-center font-bold text-lg ${
                          cs.sellingPricePerPiece === highestPrice
                            ? 'text-green-700 bg-green-100'
                            : 'text-green-800'
                        }`}
                      >
                        {formatCurrency(cs.sellingPricePerPiece)}
                      </td>
                    ))}
                  </tr>

                  {/* Variance Info */}
                  <tr className="bg-gray-50">
                    <td className="p-3 text-sm text-gray-500">Variance</td>
                    {sheetsToCompare.map((cs) => (
                      <td key={cs.id} className="p-3 text-center">
                        {cs.costVariancePercent !== undefined &&
                        cs.costVariancePercent !== null ? (
                          <span
                            className={`text-xs ${
                              Number(cs.costVariancePercent) > 0
                                ? 'text-red-600'
                                : Number(cs.costVariancePercent) < 0
                                  ? 'text-green-600'
                                  : 'text-gray-500'
                            }`}
                          >
                            {Number(cs.costVariancePercent) > 0 ? '+' : ''}
                            {formatPercent(cs.costVariancePercent)} from prev
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Action Row */}
                  <tr>
                    <td className="p-3"></td>
                    {sheetsToCompare.map((cs) => (
                      <td key={cs.id} className="p-3 text-center">
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleSelect(cs)}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Use This
                        </Button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* All Cost Sheets List (for selection when more than 3) */}
            {approvedSheets.length > 3 && (
              <div className="mt-6 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  All Approved Cost Sheets ({approvedSheets.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {approvedSheets.map((cs) => (
                    <button
                      key={cs.id}
                      onClick={() => toggleComparison(cs.id)}
                      className={`p-3 border rounded-lg text-left text-sm transition-all ${
                        selectedForComparison.includes(cs.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <Badge variant="outline" className="text-xs">
                          v{cs.version || 1}
                        </Badge>
                        {selectedForComparison.includes(cs.id) && (
                          <Check className="w-3 h-3 text-blue-600" />
                        )}
                      </div>
                      {cs.widthCombinationDescription && (
                        <p className="text-xs text-blue-600 truncate">
                          {cs.widthCombinationDescription}
                        </p>
                      )}
                      <p className="font-medium text-green-700 mt-1">
                        {formatCurrency(cs.sellingPricePerPiece)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Select Footer */}
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <p className="text-sm text-gray-500">
                <ArrowRight className="w-4 h-4 inline mr-1" />
                Click "Use This" to apply the selling price to your order
              </p>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
