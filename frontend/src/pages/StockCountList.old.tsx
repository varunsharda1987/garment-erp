// Stock Count List - View all physical inventory counts
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { Label } from '@/components/ui/label';
import stockCountService from '../services/stockCount.service';
import type { StockCount, CountStatus, CountType } from '../types/inventory.types';

export default function StockCountList() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<CountStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<CountType | ''>('');

  useEffect(() => {
    loadCounts();
  }, [statusFilter, typeFilter]);

  const loadCounts = async () => {
    try {
      setLoading(true);
      const data = await stockCountService.getAll({
        status: statusFilter || undefined,
        countType: typeFilter || undefined
      });
      setCounts(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load stock counts');
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: CountStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'DRAFT': return 'secondary';
      case 'IN_PROGRESS': return 'default';
      case 'COUNTED': return 'default';
      case 'VERIFIED': return 'default';
      case 'APPROVED': return 'default';
      case 'CANCELLED': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusClassName = (status: CountStatus) => {
    switch (status) {
      case 'DRAFT': return '';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'COUNTED': return 'bg-purple-100 text-purple-800';
      case 'VERIFIED': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return '';
      default: return '';
    }
  };

  const getProgressPercentage = (count: StockCount) => {
    if (count.totalItems === 0) return 0;
    return (count.countedItems / count.totalItems) * 100;
  };

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="Stock Counts">
        <Button onClick={() => navigate('/inventory/stock-counts/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Stock Count
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Label htmlFor="statusFilter">Status</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as CountStatus | '')}>
                <SelectTrigger id="statusFilter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COUNTED">Counted</SelectItem>
                  <SelectItem value="VERIFIED">Verified</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label htmlFor="typeFilter">Count Type</Label>
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as CountType | '')}>
                <SelectTrigger id="typeFilter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="FULL">Full</SelectItem>
                  <SelectItem value="PARTIAL">Partial</SelectItem>
                  <SelectItem value="CYCLE">Cycle</SelectItem>
                  <SelectItem value="SPOT_CHECK">Spot Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Count Number</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Count Date</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Variance Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <LoadingSpinner size="sm" />
                </TableCell>
              </TableRow>
            ) : counts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No stock counts found
                </TableCell>
              </TableRow>
            ) : (
              counts.map((count) => (
                <TableRow key={count.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{count.countNumber}</TableCell>
                  <TableCell>{count.warehouses?.warehouseName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{count.countType}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(count.countDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[150px]">
                      <Progress value={getProgressPercentage(count)} className="flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {count.countedItems}/{count.totalItems}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {count.varianceItems > 0 ? (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                        {count.varianceItems}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(count.status)} className={getStatusClassName(count.status)}>
                      {count.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/inventory/stock-counts/${count.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
