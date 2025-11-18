// Warehouse List Page
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import warehouseService from '../services/warehouse.service';
import type { Warehouse, WarehouseType } from '../types/inventory.types';

export default function WarehouseList() {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<WarehouseType | ''>('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadWarehouses();
  }, [typeFilter, activeFilter]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const data = await warehouseService.getAll({
        warehouseType: typeFilter || undefined,
        isActive: activeFilter ? activeFilter === 'true' : undefined,
        search: searchTerm || undefined
      });
      setWarehouses(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this warehouse?')) return;

    try {
      await warehouseService.delete(id);
      loadWarehouses();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete warehouse');
    }
  };

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="Warehouses">
        <Button onClick={() => navigate('/inventory/warehouses/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Warehouse
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
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search warehouses..."
              />
            </div>
            <div className="w-40">
              <Label htmlFor="typeFilter">Type</Label>
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as WarehouseType | '')}>
                <SelectTrigger id="typeFilter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="RAW_MATERIAL">Raw Material</SelectItem>
                  <SelectItem value="FINISHED_GOODS">Finished Goods</SelectItem>
                  <SelectItem value="WORK_IN_PROGRESS">WIP</SelectItem>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="TRANSIT">Transit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label htmlFor="statusFilter">Status</Label>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger id="statusFilter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={loadWarehouses} variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <LoadingSpinner size="sm" />
                </TableCell>
              </TableRow>
            ) : warehouses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No warehouses found
                </TableCell>
              </TableRow>
            ) : (
              warehouses.map((wh) => (
                <TableRow key={wh.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{wh.warehouseCode}</TableCell>
                  <TableCell>{wh.warehouseName}</TableCell>
                  <TableCell className="capitalize">{wh.warehouseType.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{wh.city || '-'}</TableCell>
                  <TableCell>{wh.contactPerson || '-'}</TableCell>
                  <TableCell>
                    <StatusBadge status={wh.isActive ? 'Active' : 'Inactive'} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/inventory/warehouses/${wh.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/inventory/warehouses/${wh.id}/edit`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(wh.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
