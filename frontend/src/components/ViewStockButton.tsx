import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Package } from 'lucide-react';

interface ViewStockButtonProps {
  materialType: string;
  stockCount?: number;
}

export function ViewStockButton({ materialType, stockCount }: ViewStockButtonProps) {
  const navigate = useNavigate();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate(`/inventory/stock-levels?materialType=${materialType}`)}
    >
      <Package className="mr-2 h-4 w-4" />
      View Stock
      {stockCount !== undefined && stockCount > 0 && (
        <Badge variant="secondary" className="ml-2">
          {stockCount}
        </Badge>
      )}
    </Button>
  );
}
