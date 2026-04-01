import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { challanService } from '@/services/challan.service';
import type { Challan, ChallanFilters } from '@/types/challan.types';
import { ChallanTypeLabels, ChallanTypeColors, ChallanStatusLabels, ChallanStatusColors } from '@/types/challan.types';
import DataTable, { type Column } from '@/components/DataTable';
import { handleApiError } from '@/lib/api-error-handler';
import { Plus, Eye, FileText, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export default function ChallanList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [challans, setChallans] = useState<Challan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get('challanType') || 'all');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    loadChallans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, page, search]);

  async function loadChallans() {
    try {
      setIsLoading(true);
      const filters: ChallanFilters = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      if (typeFilter !== 'all') filters.challanType = typeFilter as ChallanFilters['challanType'];
      if (statusFilter !== 'all') filters.status = statusFilter as ChallanFilters['status'];
      if (search) filters.search = search;

      const result = await challanService.getChallans(filters);
      setChallans(result.data);
      setTotal(result.pagination.total);
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  }

  const columns: Column<Challan>[] = [
    {
      key: 'challanNumber',
      header: 'Challan No.',
      render: (challan) => (
        <button
          onClick={() => navigate(`/manufacturing/challans/${challan.id}`)}
          className="text-primary font-medium hover:underline"
        >
          {challan.challanNumber}
        </button>
      ),
    },
    {
      key: 'challanType',
      header: 'Type',
      render: (challan) => (
        <Badge className={ChallanTypeColors[challan.challanType] || 'bg-gray-100'}>
          {ChallanTypeLabels[challan.challanType] || challan.challanType}
        </Badge>
      ),
    },
    {
      key: 'movement',
      header: 'From → To',
      render: (challan) => (
        <div className="flex items-center gap-1 text-sm">
          <span className="font-medium">{challan.fromName}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{challan.toName}</span>
        </div>
      ),
    },
    {
      key: 'challanDate',
      header: 'Date',
      render: (challan) => format(new Date(challan.challanDate), 'dd MMM yyyy'),
    },
    {
      key: 'quantity',
      header: 'Qty',
      render: (challan) => (
        <span>
          {Number(challan.totalQuantity).toLocaleString()} {challan.unit}
          {challan.receivedQuantity ? (
            <span className="text-xs text-muted-foreground ml-1">
              ({Number(challan.receivedQuantity).toLocaleString()} rcvd)
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'linkedTo',
      header: 'Linked To',
      render: (challan) => (
        <div className="text-sm">
          {challan.purchaseOrder && <span className="text-blue-600">{challan.purchaseOrder.poNumber}</span>}
          {challan.order && <span className="text-purple-600">{challan.order.orderNumber}</span>}
          {challan.productionRun && <span className="text-orange-600">{challan.productionRun.workOrderNumber}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (challan) => (
        <Badge className={ChallanStatusColors[challan.status] || 'bg-gray-100'}>
          {ChallanStatusLabels[challan.status] || challan.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (challan) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/manufacturing/challans/${challan.id}`)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Challans
          </h1>
          <p className="text-muted-foreground">Material movement documents — internal and external</p>
        </div>
        <Button onClick={() => navigate('/manufacturing/challans/new')}>
          <Plus className="h-4 w-4 mr-2" />
          New Challan
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              placeholder="Search challans..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64"
            />
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(ChallanTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(ChallanStatusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-auto">
              {total} challan{total !== 1 ? 's' : ''}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={challans}
            columns={columns}
            keyExtractor={(c) => c.id}
            loading={isLoading}
            emptyState={{ title: 'No challans found' }}
          />
          {total > pageSize && (
            <div className="flex items-center justify-between mt-4">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {Math.ceil(total / pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
