import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  getAllTaxMasters,
  createTaxMaster,
  updateTaxMaster,
  deleteTaxMaster,
} from '@/services/taxMaster.service';
import type {
  TaxMaster,
  TaxType,
  CreateTaxMasterRequest,
  UpdateTaxMasterRequest,
} from '@/types/taxMaster.types';

const TAX_TYPES: TaxType[] = ['GST', 'IGST', 'CGST', 'SGST', 'CESS', 'CUSTOM', 'TDS', 'TCS'];

export default function TaxMasterList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<TaxType | ''>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TaxMaster | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<TaxMaster | null>(null);

  const [formData, setFormData] = useState<CreateTaxMasterRequest>({
    taxCode: '',
    taxName: '',
    taxType: 'GST',
    taxRate: 0,
    hsnSacCode: '',
    description: '',
    applicableFrom: new Date().toISOString().split('T')[0],
    applicableTo: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['tax-masters', { page, search, taxType: typeFilter }],
    queryFn: () =>
      getAllTaxMasters({
        page,
        limit: 20,
        search: search || undefined,
        taxType: typeFilter || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: createTaxMaster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-masters'] });
      toast.success('Tax master created successfully');
      closeDialog();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to create tax master');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaxMasterRequest }) =>
      updateTaxMaster(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-masters'] });
      toast.success('Tax master updated successfully');
      closeDialog();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update tax master');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTaxMaster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-masters'] });
      toast.success('Tax master deleted successfully');
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to delete tax master');
    },
  });

  function openCreateDialog() {
    setSelectedItem(null);
    setFormData({
      taxCode: '',
      taxName: '',
      taxType: 'GST',
      taxRate: 0,
      hsnSacCode: '',
      description: '',
      applicableFrom: new Date().toISOString().split('T')[0],
      applicableTo: '',
    });
    setDialogOpen(true);
  }

  function openEditDialog(item: TaxMaster) {
    setSelectedItem(item);
    setFormData({
      taxCode: item.taxCode,
      taxName: item.taxName,
      taxType: item.taxType,
      taxRate: Number(item.taxRate),
      hsnSacCode: item.hsnSacCode || '',
      description: item.description || '',
      applicableFrom: item.applicableFrom ? new Date(item.applicableFrom).toISOString().split('T')[0] : '',
      applicableTo: item.applicableTo ? new Date(item.applicableTo).toISOString().split('T')[0] : '',
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setSelectedItem(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.taxCode || !formData.taxName || !formData.applicableFrom) {
      toast.error('Tax code, name, and applicable from date are required');
      return;
    }

    const submitData = {
      ...formData,
      applicableTo: formData.applicableTo || undefined,
      hsnSacCode: formData.hsnSacCode || undefined,
      description: formData.description || undefined,
    };

    if (selectedItem) {
      updateMutation.mutate({ id: selectedItem.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  }

  const records = data?.data || [];
  const pagination = data?.pagination;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax Masters</h1>
          <p className="text-muted-foreground text-sm">
            Manage tax rates (GST, IGST, CGST, SGST, CESS, TDS, TCS) with validity periods
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Tax Rate
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code or name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(val) => {
                setTypeFilter(val === 'ALL' ? '' : val as TaxType);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {TAX_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tax Code</TableHead>
                <TableHead>Tax Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Rate %</TableHead>
                <TableHead>HSN/SAC</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
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
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No tax masters found
                  </TableCell>
                </TableRow>
              ) : (
                records.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-medium">{item.taxCode}</TableCell>
                    <TableCell>{item.taxName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.taxType}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{Number(item.taxRate)}%</TableCell>
                    <TableCell className="font-mono">{item.hsnSacCode || '-'}</TableCell>
                    <TableCell>{new Date(item.applicableFrom).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {item.applicableTo ? new Date(item.applicableTo).toLocaleDateString() : 'No end'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? 'default' : 'destructive'}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(item)}
                        >
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

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedItem ? 'Edit Tax Rate' : 'Add Tax Rate'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxCode">Tax Code *</Label>
                <Input
                  id="taxCode"
                  placeholder="e.g., GST_12"
                  value={formData.taxCode}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, taxCode: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxType">Tax Type *</Label>
                <Select
                  value={formData.taxType}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, taxType: val as TaxType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxName">Tax Name *</Label>
              <Input
                id="taxName"
                placeholder="e.g., GST 12%"
                value={formData.taxName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, taxName: e.target.value }))
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate % *</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.taxRate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      taxRate: parseFloat(e.target.value) || 0,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hsnSacCode">HSN/SAC Code</Label>
                <Input
                  id="hsnSacCode"
                  placeholder="e.g., 62114210"
                  value={formData.hsnSacCode}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, hsnSacCode: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="applicableFrom">Applicable From *</Label>
                <Input
                  id="applicableFrom"
                  type="date"
                  value={formData.applicableFrom}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, applicableFrom: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="applicableTo">Applicable To</Label>
                <Input
                  id="applicableTo"
                  type="date"
                  value={formData.applicableTo}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, applicableTo: e.target.value }))
                  }
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
            <AlertDialogTitle>Delete Tax Rate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong>{itemToDelete?.taxCode}</strong> ({itemToDelete?.taxName})?
              This will deactivate the tax rate.
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
