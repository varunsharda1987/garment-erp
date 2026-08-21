/**
 * Lace Costing Section Component
 * Section in cost sheet for managing lace items
 */

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import LaceCostingRow from './LaceCostingRow';
import type { LaceDetail } from '../../types/costSheet.types';
import type { Lace } from '../../types/lace.types';
import { getFinishedLace } from '../../services/lace.service';
import { useDefaultSettings } from '../../hooks/useDefaultSettings';

interface LaceCostingSectionProps {
  laceDetails: LaceDetail[];
  onLaceDetailsChange: (details: LaceDetail[]) => void;
  styleId?: string;
  orderQuantity?: number;
  disabled?: boolean;
}

export default function LaceCostingSection({
  laceDetails,
  onLaceDetailsChange,
  styleId,
  orderQuantity,
  disabled = false,
}: LaceCostingSectionProps) {
  const { laceWastagePercent } = useDefaultSettings();
  const [availableLaces, setAvailableLaces] = useState<Lace[]>([]);
  const [selectedLaceId, setSelectedLaceId] = useState<string>('');
  const [isLoadingLaces, setIsLoadingLaces] = useState(false);

  // Load available finished laces for selection
  useEffect(() => {
    const fetchLaces = async () => {
      setIsLoadingLaces(true);
      try {
        const response = await getFinishedLace({ limit: 100 });
        setAvailableLaces(response.data);
      } catch (err) {
        console.error('Failed to fetch laces:', err);
      } finally {
        setIsLoadingLaces(false);
      }
    };
    fetchLaces();
  }, []);

  const handleAddLace = () => {
    if (!selectedLaceId) return;

    const lace = availableLaces.find((l) => l.id === selectedLaceId);
    if (!lace) return;

    // Check if lace already exists in the list
    if (laceDetails.some((l) => l.laceId === selectedLaceId)) {
      alert('This lace is already added to the cost sheet.');
      return;
    }

    const newLaceDetail: LaceDetail = {
      laceId: lace.id,
      laceName: lace.laceName,
      colorName: lace.color || undefined,
      width: lace.width || undefined,
      quantityPerGarment: 0,
      wastagePercent: laceWastagePercent ?? 0,
      effectiveQuantity: 0,
      sourcingStrategy: 'READY_LACE',
      costPerMeter: 0,
      totalCost: 0,
    };

    onLaceDetailsChange([...laceDetails, newLaceDetail]);
    setSelectedLaceId('');
  };

  const handleUpdateLace = (index: number, updates: Partial<LaceDetail>) => {
    const updatedDetails = [...laceDetails];
    updatedDetails[index] = { ...updatedDetails[index], ...updates };

    // Recalculate effective quantity and total cost
    const item = updatedDetails[index];
    item.effectiveQuantity = item.quantityPerGarment * (1 + item.wastagePercent / 100);
    item.totalCost = item.effectiveQuantity * item.costPerMeter;

    onLaceDetailsChange(updatedDetails);
  };

  const handleRemoveLace = (index: number) => {
    const updatedDetails = laceDetails.filter((_, i) => i !== index);
    onLaceDetailsChange(updatedDetails);
  };

  const handleStrategyChange = (
    index: number,
    strategy: {
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
    }
  ) => {
    const updatedDetails = [...laceDetails];
    updatedDetails[index] = {
      ...updatedDetails[index],
      sourcingStrategy: strategy.sourcingStrategy,
      costPerMeter: strategy.costPerMeter,
      totalCost: strategy.cost,
      stockLotId: strategy.stockLotId,
      processorId: strategy.processorId,
      rateCardId: strategy.rateCardId,
      procurementId: strategy.procurementId,
      greigeCost: strategy.greigeCost,
      processingCost: strategy.processingCost,
      readyLaceCost: strategy.readyLaceCost,
      stockCost: strategy.stockCost,
      greigeLaceId: strategy.greigeLaceId,
      labDipId: strategy.labDipId,
      isManualOverride: strategy.isManualOverride,
      overrideReason: strategy.overrideReason,
    };
    onLaceDetailsChange(updatedDetails);
  };

  const handleNotApplicableChange = (index: number, isNotApplicable: boolean) => {
    const updatedDetails = [...laceDetails];
    updatedDetails[index] = {
      ...updatedDetails[index],
      isNotApplicable,
      // If marking as N/A, zero out all costs consistently
      totalCost: isNotApplicable ? 0 : updatedDetails[index].totalCost,
      costPerMeter: isNotApplicable ? 0 : updatedDetails[index].costPerMeter,
    };
    onLaceDetailsChange(updatedDetails);
  };

  // Calculate section totals
  const laceTotal = laceDetails.filter((l) => !l.isNotApplicable).reduce((sum, l) => sum + (l.totalCost || 0), 0);

  return (
    <div className="border rounded-lg p-4 bg-card">
      {/* Section Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          Lace Details
          <span className="text-sm font-normal text-muted-foreground">
            ({laceDetails.length} item{laceDetails.length !== 1 ? 's' : ''})
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <Select value={selectedLaceId} onValueChange={setSelectedLaceId} disabled={disabled || isLoadingLaces}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder={isLoadingLaces ? 'Loading...' : 'Select lace to add...'} />
            </SelectTrigger>
            <SelectContent>
              {availableLaces.map((lace) => (
                <SelectItem key={lace.id} value={lace.id}>
                  {lace.laceName} {lace.color ? `(${lace.color})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddLace}
            disabled={disabled || !selectedLaceId}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Lace
          </Button>
        </div>
      </div>

      {/* Lace Table */}
      {laceDetails.length === 0 ? (
        <div className="text-center py-8 bg-muted rounded-lg border-2 border-dashed border-border">
          <p className="text-muted-foreground">No lace items added yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Select a lace from the dropdown above to add it to the cost sheet.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-10">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Lace Name
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                  Qty/Garment
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                  Wastage
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                  Effective
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sourcing
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                  Cost
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">
                  N/A
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-gray-200">
              {laceDetails.map((lace, index) => (
                <LaceCostingRow
                  key={lace.laceId + '-' + index}
                  index={index}
                  laceId={lace.laceId}
                  laceName={lace.laceName}
                  colorName={lace.colorName}
                  width={lace.width}
                  quantityPerGarment={lace.quantityPerGarment}
                  wastagePercent={lace.wastagePercent}
                  orderQuantity={orderQuantity}
                  styleId={styleId}
                  currentStrategy={lace.sourcingStrategy}
                  currentCost={lace.totalCost}
                  onStrategyChange={(strategy) => handleStrategyChange(index, strategy)}
                  onRemove={() => handleRemoveLace(index)}
                  onQuantityChange={(qty) => handleUpdateLace(index, { quantityPerGarment: qty })}
                  onWastageChange={(wastage) => handleUpdateLace(index, { wastagePercent: wastage })}
                  isNotApplicable={lace.isNotApplicable}
                  onNotApplicableChange={(checked) => handleNotApplicableChange(index, checked)}
                />
              ))}
            </tbody>
            <tfoot className="bg-muted">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-foreground text-right">
                  Total Lace Cost:
                </td>
                <td className="px-4 py-3 text-sm font-bold text-foreground text-right">₹{laceTotal.toFixed(2)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Helper Text */}
      <div className="mt-3 text-xs text-muted-foreground">
        <p>
          <strong>Sourcing Strategies:</strong> Stock Reuse (use existing inventory), Ready Lace (purchase finished
          lace), or Greige + Dyeing (buy raw lace and process).
        </p>
      </div>
    </div>
  );
}
