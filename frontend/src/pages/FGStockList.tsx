import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/currency';

interface FGStockItem {
  id: string;
  styleId: string;
  colorId: string;
  sizeId: string;
  variantId: string | null;
  quantity: number;
  locationId: string;
  workOrderId: string | null;
  receivedDate: string;
  lastUpdated: string;
  style: {
    id: string;
    styleCode: string;
    styleName: string;
    buyerStyleRef: string | null;
  } | null;
  color: {
    id: string;
    colorCode: string | null;
    colorName: string;
  } | null;
  size: {
    id: string;
    sizeName: string;
    sortOrder: number;
  } | null;
  location: {
    id: string;
    code: string;
    name: string;
  } | null;
  workOrder: {
    id: string;
    workOrderNumber: string;
  } | null;
  variant: {
    id: string;
    sku: string;
  } | null;
  // P6.3: Costing data
  costing: {
    estimatedCostPerPiece: number | null;
    actualCostPerPiece: number | null;
    costVariancePercent: number | null;
  } | null;
}

interface FGStockResponse {
  data: FGStockItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function FGStockList() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<FGStockResponse>({
    queryKey: ['fg-stock', { page, search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (search) params.set('search', search);
      const response = await api.get(`/fg-stock?${params.toString()}`);
      return response.data;
    },
  });

  const items = data?.data || [];
  const pagination = data?.pagination;

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => {
    if (!item.costing) return sum;
    const unitCost = item.costing.actualCostPerPiece || item.costing.estimatedCostPerPiece || 0;
    return sum + unitCost * item.quantity;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finished Goods Stock</h1>
          <p className="text-muted-foreground">View all finished goods inventory with valuation</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Package className="h-5 w-5 mr-2" />
            {totalQuantity.toLocaleString()} pcs
          </Badge>
          {totalValue > 0 && (
            <Badge variant="secondary" className="text-lg px-4 py-2">
              Value: {formatCurrency(totalValue)}
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>FG Stock Inventory</CardTitle>
          <CardDescription>Ready-to-ship finished garments by style, color, and size</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by style, color, size..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No finished goods stock found</p>
              <p className="text-sm mt-2">Stock is created when production batches are completed</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Style</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Stock Value</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Work Order</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.style?.styleCode || '-'}</div>
                            <div className="text-sm text-muted-foreground">{item.style?.styleName}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.color?.colorCode && (
                              <div
                                className="h-4 w-4 rounded border"
                                style={{ backgroundColor: item.color.colorCode }}
                              />
                            )}
                            <span>{item.color?.colorName || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{item.size?.sizeName || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{item.quantity.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {item.costing ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className={
                                      item.costing.actualCostPerPiece ? 'font-medium' : 'text-muted-foreground'
                                    }
                                  >
                                    {formatCurrency(
                                      item.costing.actualCostPerPiece || item.costing.estimatedCostPerPiece || 0
                                    )}
                                    {!item.costing.actualCostPerPiece && item.costing.estimatedCostPerPiece && (
                                      <span className="text-xs ml-1 text-muted-foreground">*</span>
                                    )}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs space-y-1">
                                    {item.costing.actualCostPerPiece ? (
                                      <p>Actual: {formatCurrency(item.costing.actualCostPerPiece)}</p>
                                    ) : (
                                      <p>Estimated: {formatCurrency(item.costing.estimatedCostPerPiece || 0)}</p>
                                    )}
                                    {item.costing.costVariancePercent !== null && (
                                      <p
                                        className={
                                          item.costing.costVariancePercent > 0 ? 'text-destructive' : 'text-success'
                                        }
                                      >
                                        Variance: {item.costing.costVariancePercent > 0 ? '+' : ''}
                                        {item.costing.costVariancePercent.toFixed(1)}%
                                      </p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.costing ? (
                            formatCurrency(
                              (item.costing.actualCostPerPiece || item.costing.estimatedCostPerPiece || 0) *
                                item.quantity
                            )
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.location?.name || item.location?.code || '-'}</Badge>
                        </TableCell>
                        <TableCell>{item.workOrder?.workOrderNumber || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(item.lastUpdated).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, pagination.total)} of {pagination.total} items
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
