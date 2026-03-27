import { useState } from 'react';
import { Package, Plus, CheckCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Local interface to avoid import issues
interface StockSummaryItem {
  id: string;
  fabricId: string;
  fabricName: string;
  fabricCode: string;
  greigeId: string;
  greigeName: string;
  cutableWidth: number;
  finishedWidth: number;
  quantityAvailable: number;
  qualityGrade: string;
  // Style fabric linkage
  styleFabricId?: string | null;
  componentId?: string | null;
  // PRODUCTION CAD tracking
  hasProductionCad?: boolean;
  productionCadId?: string | null;
  productionCadStatus?: string | null;
  stockLotNumber?: string | null;
}

interface Props {
  stockSummary: StockSummaryItem[];
  styleId?: string;
  onCreateProductionCAD?: (
    stockId: string,
    fabricId: string,
    greigeId: string,
    styleFabricId?: string | null,
    componentId?: string | null
  ) => Promise<void>;
}

export function StockSummaryBanner({ stockSummary, onCreateProductionCAD }: Props) {
  const [creatingCadFor, setCreatingCadFor] = useState<string | null>(null);

  if (!stockSummary || stockSummary.length === 0) return null;

  // Group by greige name for display
  const byGreige = stockSummary.reduce(
    (acc, item) => {
      const key = item.greigeName || 'Unknown Greige';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, StockSummaryItem[]>
  );

  // Calculate total quantity
  const totalQuantity = stockSummary.reduce((sum, item) => sum + item.quantityAvailable, 0);

  // Count CAD status
  const withCad = stockSummary.filter((s) => s.hasProductionCad).length;
  const withoutCad = stockSummary.length - withCad;

  const handleCreateCAD = async (item: StockSummaryItem) => {
    if (!onCreateProductionCAD || creatingCadFor) return;
    setCreatingCadFor(item.id);
    try {
      await onCreateProductionCAD(item.id, item.fabricId, item.greigeId, item.styleFabricId, item.componentId);
    } finally {
      setCreatingCadFor(null);
    }
  };

  const getStatusBadge = (item: StockSummaryItem) => {
    if (!item.hasProductionCad) {
      return null;
    }

    switch (item.productionCadStatus) {
      case 'APPROVED':
        return (
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300 ml-1">
            <CheckCircle className="h-3 w-3 mr-0.5" />
            CAD
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300 ml-1">
            <Clock className="h-3 w-3 mr-0.5" />
            CAD
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300 ml-1">
            <AlertTriangle className="h-3 w-3 mr-0.5" />
            CAD
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 ml-1">
            CAD
          </Badge>
        );
    }
  };

  const getTooltipText = (item: StockSummaryItem) => {
    const lines = [
      item.fabricName,
      item.stockLotNumber ? `Lot: ${item.stockLotNumber}` : '',
      `Width: ${item.cutableWidth}" (${item.finishedWidth}" finished)`,
      `Available: ${item.quantityAvailable.toLocaleString()} meters`,
      item.hasProductionCad ? `PRODUCTION CAD: ${item.productionCadStatus || 'Created'}` : 'No PRODUCTION CAD yet',
    ].filter(Boolean);
    return lines.join(' | ');
  };

  return (
    <Card className="mb-4 border-green-200 bg-green-50">
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Package className="h-4 w-4 text-green-600" />
          <span className="font-semibold text-sm text-green-800">Fabric Stock Available</span>
          <Badge variant="outline" className="text-xs bg-white border-green-300">
            {stockSummary.length} lot{stockSummary.length > 1 ? 's' : ''} ({totalQuantity.toLocaleString()}m)
          </Badge>
          {withCad > 0 && (
            <Badge variant="outline" className="text-xs bg-green-100 border-green-400 text-green-700">
              {withCad} with CAD
            </Badge>
          )}
          {withoutCad > 0 && onCreateProductionCAD && (
            <Badge variant="outline" className="text-xs bg-amber-100 border-amber-400 text-amber-700">
              {withoutCad} need CAD
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {Object.entries(byGreige).map(([greige, items]) => (
            <div key={greige} className="space-y-1.5">
              <span className="font-medium text-sm text-gray-700">{greige}:</span>
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2 pl-2" title={getTooltipText(item)}>
                  <Badge
                    variant="secondary"
                    className={`cursor-help ${
                      item.hasProductionCad
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}
                  >
                    {item.cutableWidth}" &bull; {item.quantityAvailable.toLocaleString()}m
                    {item.qualityGrade && item.qualityGrade !== 'A' && (
                      <span className="ml-1 text-xs opacity-75">({item.qualityGrade})</span>
                    )}
                    {getStatusBadge(item)}
                  </Badge>
                  <div className="flex-1" />
                  {!item.hasProductionCad && onCreateProductionCAD && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-sm font-medium bg-white hover:bg-green-50 border-green-400 text-green-700"
                      onClick={() => handleCreateCAD(item)}
                      disabled={creatingCadFor === item.id}
                      title="Create PRODUCTION CAD from this stock"
                    >
                      {creatingCadFor === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Create CAD
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
