import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, RefreshCw, ListChecks } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { PageHeader } from '../components/PageHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { usePagination } from '../hooks/usePagination';
import { handleApiError } from '../lib/api-error-handler';
import { formatCurrency } from '../lib/currency';
import { listOrderBOMs, getStatusBadgeColor } from '../services/orderBom.service';
import type { OrderBOM, OrderBOMStatus } from '../types/orderBom.types';

const OrderBOMList = () => {
  const navigate = useNavigate();
  const [boms, setBoms] = useState<OrderBOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const { currentPage, pageSize, paginationProps, apiParams } = usePagination();

  const fetchBOMs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listOrderBOMs({
        ...apiParams,
        status: statusFilter !== 'all' ? (statusFilter as OrderBOMStatus) : undefined,
        isActive: true,
      });
      setBoms(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to fetch Order BOMs', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBOMs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, statusFilter]);

  return (
    <>
      <PageHeader title="Order BOM">
        <Button variant="outline" onClick={fetchBOMs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="w-48">
              <label className="text-sm font-medium text-foreground mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="LOCKED">Locked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              {totalItems} Order BOM{totalItems !== 1 ? 's' : ''} found
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchBOMs}>Retry</Button>
          </CardContent>
        </Card>
      ) : boms.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-12 w-12" />}
          title="No Order BOMs"
          description="Order BOMs are created from approved Cost Sheets. Approve a Cost Sheet to generate an Order BOM."
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Order</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Style</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                        Version
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                        Items
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                        Total Cost
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Created
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-gray-200">
                    {boms.map((bom) => (
                      <tr key={bom.id} className="hover:bg-muted">
                        <td className="px-4 py-3 text-sm font-medium">{bom.order?.orderNumber || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium">{bom.style?.styleCode || '-'}</div>
                          <div className="text-muted-foreground text-xs">{bom.style?.styleName}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <Badge variant="outline">v{bom.version}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(bom.status)}`}
                          >
                            {bom.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{bom.items?.length || 0}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          {bom.totalMaterialCost ? formatCurrency(bom.totalMaterialCost) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(bom.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/order-bom/${bom.id}`)}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4">
            <Pagination {...paginationProps} totalPages={totalPages} totalItems={totalItems} />
          </div>
        </>
      )}
    </>
  );
};

export default OrderBOMList;
