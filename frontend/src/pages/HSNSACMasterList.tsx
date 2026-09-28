import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import Pagination from '@/components/Pagination';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import {
  getAllHSNSACMasters,
  createHSNSACMaster,
  updateHSNSACMaster,
  deleteHSNSACMaster,
} from '@/services/hsnSacMaster.service';
import type { HSNSACMaster, HSNSACType, CreateHSNSACRequest, UpdateHSNSACRequest } from '@/types/hsnSacMaster.types';

const GST_RATES = [0, 5, 12, 18, 28];

export default function HSNSACMasterList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState<HSNSACType | ''>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HSNSACMaster | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<HSNSACMaster | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateHSNSACRequest>({
    code: '',
    type: 'HSN',
    description: '',
    chapter: '',
    section: '',
    defaultGstRate: 5,
    unit: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['hsn-sac-masters', { page, pageSize, search, type: typeFilter, statusFilter }],
    queryFn: () =>
      getAllHSNSACMasters({
        page,
        limit: pageSize,
        search: search || undefined,
        type: typeFilter || undefined,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
      }),
  });

  const activeFilterCount = [search, typeFilter, statusFilter !== 'all'].filter(Boolean).length;

  // Clears every filter and goes back to page 1; the rows-per-page choice is not a filter, so it stays
  function clearFilters() {
    setSearch('');
    setTypeFilter('');
    setStatusFilter('all');
    setPage(1);
  }

  const createMutation = useMutation({
    mutationFn: createHSNSACMaster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hsn-sac-masters'] });
      toast.success('HSN/SAC code created successfully');
      closeDialog();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to create HSN/SAC code');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateHSNSACRequest }) => updateHSNSACMaster(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hsn-sac-masters'] });
      toast.success('HSN/SAC code updated successfully');
      closeDialog();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to update HSN/SAC code');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHSNSACMaster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hsn-sac-masters'] });
      toast.success('HSN/SAC code deleted successfully');
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Failed to delete HSN/SAC code');
    },
  });

  function openCreateDialog() {
    setSelectedItem(null);
    setFormData({
      code: '',
      type: 'HSN',
      description: '',
      chapter: '',
      section: '',
      defaultGstRate: 5,
      unit: '',
    });
    setDialogOpen(true);
  }

  function openEditDialog(item: HSNSACMaster) {
    setSelectedItem(item);
    setFormData({
      code: item.code,
      type: item.type,
      description: item.description,
      chapter: item.chapter || '',
      section: item.section || '',
      defaultGstRate: Number(item.defaultGstRate),
      unit: item.unit || '',
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setSelectedItem(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.code || !formData.description) {
      toast.error('Code and description are required');
      return;
    }

    if (selectedItem) {
      updateMutation.mutate({ id: selectedItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  const records = data?.data || [];
  const pagination = data?.pagination;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-medium tracking-tight">HSN/SAC Codes</h1>
          <p className="text-muted-foreground text-sm">
            Manage HSN codes for goods and SAC codes for services with default GST rates
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Code
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <FilterBar
            onClear={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
          >
            <SearchInput
              className="w-full max-w-sm"
              placeholder="Search code, description, chapter, section, unit…"
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
            />
            <Select
              value={typeFilter || 'ALL'}
              onValueChange={(val) => {
                setTypeFilter(val === 'ALL' ? '' : (val as HSNSACType));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                <SelectItem value="HSN">HSN (Goods)</SelectItem>
                <SelectItem value="SAC">SAC (Services)</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val as 'all' | 'active' | 'inactive');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="max-w-[300px]">Description</TableHead>
                <TableHead>Chapter</TableHead>
                <TableHead>Section</TableHead>
                <TableHead className="text-right">GST Rate %</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : records.length === 0 && activeFilterCount > 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    <p>No HSN/SAC codes match these filters.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No HSN/SAC codes found
                  </TableCell>
                </TableRow>
              ) : (
                records.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-medium">{item.code}</TableCell>
                    <TableCell>
                      <Badge variant={item.type === 'HSN' ? 'default' : 'secondary'}>{item.type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">{item.description}</TableCell>
                    <TableCell className="font-mono">{item.chapter}</TableCell>
                    <TableCell>{item.section}</TableCell>
                    <TableCell className="text-right font-medium">{Number(item.defaultGstRate)}%</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? 'default' : 'destructive'}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setItemToDelete(item);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

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
              itemLabel="codes"
            />
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Edit HSN/SAC Code' : 'Add HSN/SAC Code'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  placeholder="e.g., 62114210"
                  value={formData.code}
                  onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, type: val as HSNSACType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HSN">HSN (Goods)</SelectItem>
                    <SelectItem value="SAC">SAC (Services)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                placeholder="e.g., Ladies Garments - Cotton"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="chapter">Chapter</Label>
                <Input
                  id="chapter"
                  placeholder="e.g., 62"
                  value={formData.chapter}
                  onChange={(e) => setFormData((prev) => ({ ...prev, chapter: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="section">Section</Label>
                <Input
                  id="section"
                  placeholder="e.g., Apparel"
                  value={formData.section}
                  onChange={(e) => setFormData((prev) => ({ ...prev, section: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gstRate">Default GST Rate % *</Label>
                <Select
                  value={String(formData.defaultGstRate)}
                  onValueChange={(val) =>
                    setFormData((prev) => ({
                      ...prev,
                      defaultGstRate: Number(val),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map((rate) => (
                      <SelectItem key={rate} value={String(rate)}>
                        {rate}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  placeholder="e.g., PCS, MTR, KG"
                  value={formData.unit}
                  onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : selectedItem ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete HSN/SAC Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{itemToDelete?.code}</strong> ({itemToDelete?.description})? This
              will deactivate the code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && deleteMutation.mutate(itemToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
