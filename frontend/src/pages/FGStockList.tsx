import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import { StyleCombobox } from '@/components/StyleCombobox';
import { StyleColourCombobox } from '@/components/StyleColourCombobox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Pagination from '@/components/Pagination';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { formatDate } from '@/lib/date';
import { StyleIdentity } from '@/components/StyleIdentity';
import { BUYER_STYLE_CODE_LABEL, STYLE_CODE_LABEL, ourStyleCode } from '@/lib/style-code';

interface FGStockItem {
  id: string;
  styleId: string;
  colorId: string | null;
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
  const [styleId, setStyleId] = useState('');
  const [colorId, setColorId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const activeFilterCount = [search, styleId, colorId].filter(Boolean).length;
  const clearFilters = () => {
    setSearch('');
    setStyleId('');
    setColorId('');
    setPage(1);
  };

  const { data, isLoading } = useQuery<FGStockResponse>({
    queryKey: ['fg-stock', { page, pageSize, search, styleId, colorId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      if (search) params.set('search', search);
      if (styleId) params.set('styleId', styleId);
      if (colorId) params.set('colorId', colorId);
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
          <FilterBar
            className="mb-4"
            onClear={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
          >
            <SearchInput
              className="flex-1 min-w-[240px]"
              placeholder="Search buyer style code, style, colour, size, work order, location..."
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
            />
            {/* Any status: stock can outlive a style being archived */}
            <StyleCombobox
              value={styleId}
              onValueChange={(v) => {
                setStyleId(v);
                // A colour option belongs to one style: the old style's colour cannot filter the new one
                setColorId('');
                setPage(1);
              }}
              status={null}
              allowAll
              placeholder="All styles"
              className="w-[260px]"
            />
            {/* FG stock's colour is the style's colour option, so the list is the chosen style's colours */}
            <StyleColourCombobox
              styleId={styleId}
              value={colorId}
              onValueChange={(v) => {
                setColorId(v);
                setPage(1);
              }}
              allowAll
              placeholder="All colours"
              className="w-[200px]"
            />
          </FilterBar>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              {activeFilterCount > 0 ? (
                <>
                  <p>No finished goods stock matches these filters.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear filters
                  </Button>
                </>
              ) : (
                <>
                  <p>No finished goods stock found</p>
                  <p className="text-sm mt-2">Stock is created when production batches are completed</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{BUYER_STYLE_CODE_LABEL}</TableHead>
                      <TableHead>{STYLE_CODE_LABEL}</TableHead>
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
                          <StyleIdentity
                            style={item.style}
                            name={item.style?.styleName}
                            layout="stacked"
                            showStyleCode={false}
                            fallback="-"
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{ourStyleCode(item.style)}</span>
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
                          {formatDate(new Date(item.lastUpdated))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && (
                <Pagination
                  currentPage={page}
                  totalPages={pagination.totalPages}
                  pageSize={pageSize}
                  totalItems={pagination.total}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  pageSizeOptions={[20, 50, 100]}
                  itemLabel="items"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
