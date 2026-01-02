import { Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
}

interface Props {
  stockSummary: StockSummaryItem[];
}

export function StockSummaryBanner({ stockSummary }: Props) {
  if (!stockSummary || stockSummary.length === 0) return null;

  // Group by greige name for display
  const byGreige = stockSummary.reduce((acc, item) => {
    const key = item.greigeName || 'Unknown Greige';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, StockSummaryItem[]>);

  // Calculate total quantity
  const totalQuantity = stockSummary.reduce((sum, item) => sum + item.quantityAvailable, 0);

  return (
    <Card className="mb-4 border-green-200 bg-green-50">
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Package className="h-4 w-4 text-green-600" />
          <span className="font-semibold text-sm text-green-800">
            Fabric Stock Available
          </span>
          <Badge variant="outline" className="text-xs bg-white border-green-300">
            {stockSummary.length} lot{stockSummary.length > 1 ? 's' : ''} ({totalQuantity.toLocaleString()}m)
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(byGreige).map(([greige, items]) => (
            <div key={greige} className="flex items-center gap-1.5 text-sm">
              <span className="font-medium text-gray-700">{greige}:</span>
              {items.map(item => (
                <Badge
                  key={item.id}
                  variant="secondary"
                  className="bg-green-100 text-green-800 border-green-200"
                >
                  {item.cutableWidth}" &bull; {item.quantityAvailable.toLocaleString()}m
                  {item.qualityGrade && item.qualityGrade !== 'A' && (
                    <span className="ml-1 text-xs opacity-75">({item.qualityGrade})</span>
                  )}
                </Badge>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
