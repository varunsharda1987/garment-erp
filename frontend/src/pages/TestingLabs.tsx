import { useState, useEffect } from 'react';
import { Building2, Plus, Edit, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Pagination from '@/components/Pagination';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { testingLabsService } from '@/services/testing.service';
import type { TestingLab, CreateTestingLabInput } from '@/types/testing.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { notify } from '@/lib/notify';

interface LabFormState {
  labCode: string;
  labName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  averageTurnaroundDays: string;
  accreditations: string;
  isActive: boolean;
}

const EMPTY_FORM: LabFormState = {
  labCode: '',
  labName: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  averageTurnaroundDays: '7',
  accreditations: '',
  isActive: true,
};

export default function TestingLabs() {
  const [labs, setLabs] = useState<TestingLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Inline create/edit dialog (replaces dead /new, /:id, /:id/edit routes)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLab, setEditingLab] = useState<TestingLab | null>(null);
  const [form, setForm] = useState<LabFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Every filter change goes back to page 1 (set together, so the old page is never fetched with the new filter)
  const changeFilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  const activeFilterCount = [search, activeFilter !== 'all'].filter(Boolean).length;
  const clearFilters = () => {
    setSearch('');
    setActiveFilter('all');
    setPage(1);
  };

  useEffect(() => {
    fetchLabs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, activeFilter]);

  const fetchLabs = async () => {
    try {
      setLoading(true);
      const result = await testingLabsService.getAll({
        page,
        limit: pageSize,
        search: search || undefined,
        isActive: activeFilter === 'all' ? undefined : activeFilter,
      });
      setLabs(result.data);
      setTotalPages(result.pagination.totalPages);
      setTotalItems(result.pagination.total);
    } catch (error) {
      handleApiError(error, 'Failed to load testing labs');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingLab(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (lab: TestingLab) => {
    setEditingLab(lab);
    setForm({
      labCode: lab.labCode ?? '',
      labName: lab.labName ?? '',
      contactPerson: lab.contactPerson ?? '',
      contactEmail: lab.contactEmail ?? '',
      contactPhone: lab.contactPhone ?? '',
      address: lab.address ?? '',
      city: lab.city ?? '',
      state: lab.state ?? '',
      pincode: lab.pincode ?? '',
      averageTurnaroundDays: lab.averageTurnaroundDays != null ? String(lab.averageTurnaroundDays) : '7',
      accreditations: (lab.accreditations ?? []).join(', '),
      isActive: lab.isActive,
    });
    setDialogOpen(true);
  };

  const setField = <K extends keyof LabFormState>(key: K, value: LabFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = (): CreateTestingLabInput => {
    // Omit empty optional strings so backend validators (e.g. email) don't reject ''
    const opt = (s: string) => {
      const t = s.trim();
      return t.length ? t : undefined;
    };
    const accreditations = form.accreditations
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      labCode: form.labCode.trim(),
      labName: form.labName.trim(),
      contactPerson: opt(form.contactPerson),
      contactEmail: opt(form.contactEmail),
      contactPhone: opt(form.contactPhone),
      address: opt(form.address),
      city: opt(form.city),
      state: opt(form.state),
      pincode: opt(form.pincode),
      averageTurnaroundDays: form.averageTurnaroundDays ? Number(form.averageTurnaroundDays) : undefined,
      accreditations: accreditations.length ? accreditations : undefined,
      isActive: form.isActive,
    };
  };

  const handleSubmit = async () => {
    if (!form.labCode.trim() || !form.labName.trim()) {
      notify.error('Lab code and lab name are required');
      return;
    }
    try {
      setSaving(true);
      const payload = buildPayload();
      if (editingLab) {
        await testingLabsService.update(editingLab.id, payload);
        handleApiSuccess('Testing lab updated', `${payload.labName} has been updated.`);
      } else {
        await testingLabsService.create(payload);
        handleApiSuccess('Testing lab created', `${payload.labName} has been added.`);
      }
      setDialogOpen(false);
      fetchLabs();
    } catch (error) {
      handleApiError(error, 'Failed to save testing lab');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-medium text-foreground flex items-center gap-3">
            <Building2 className="h-8 w-8 text-success" />
            Testing Labs
          </h1>
          <p className="text-muted-foreground mt-1">Manage external testing laboratory information</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Testing Lab
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <FilterBar
          onClear={clearFilters}
          hasActiveFilters={activeFilterCount > 0}
          clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
        >
          <SearchInput
            className="flex-1 min-w-[240px]"
            placeholder="Search lab code, name, contact, city, state or accreditation..."
            value={search}
            onChange={changeFilter(setSearch)}
          />
          <Select
            value={activeFilter}
            onValueChange={changeFilter((value: string) => setActiveFilter(value as 'all' | 'true' | 'false'))}
          >
            <SelectTrigger className="w-[160px]" aria-label="Status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>
      </Card>

      {/* Labs List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-info mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading testing labs...</p>
        </div>
      ) : labs.length === 0 && activeFilterCount > 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-4">No testing labs match these filters.</h3>
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </Card>
      ) : labs.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Testing Labs Found</h3>
          <p className="text-muted-foreground mb-4">Get started by adding your first testing lab</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Testing Lab
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {labs.map((lab) => (
            <Card key={lab.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-foreground">{lab.labName}</h3>
                    {lab.isActive ? (
                      <Badge className="bg-success-muted text-success border-success/25">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">{lab.labCode}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4">
                {lab.contactPerson && (
                  <div className="flex items-start">
                    <span className="text-muted-foreground w-24">Contact:</span>
                    <span className="text-foreground font-medium">{lab.contactPerson}</span>
                  </div>
                )}
                {lab.contactPhone && (
                  <div className="flex items-start">
                    <span className="text-muted-foreground w-24">Phone:</span>
                    <span className="text-foreground">{lab.contactPhone}</span>
                  </div>
                )}
                {lab.contactEmail && (
                  <div className="flex items-start">
                    <span className="text-muted-foreground w-24">Email:</span>
                    <span className="text-foreground text-xs">{lab.contactEmail}</span>
                  </div>
                )}
                {lab.city && (
                  <div className="flex items-start">
                    <span className="text-muted-foreground w-24">Location:</span>
                    <span className="text-foreground">
                      {lab.city}
                      {lab.state && `, ${lab.state}`}
                    </span>
                  </div>
                )}
                <div className="flex items-start">
                  <span className="text-muted-foreground w-24">Turnaround:</span>
                  <span className="text-foreground font-medium">{lab.averageTurnaroundDays} days</span>
                </div>
              </div>

              {/* Accreditations */}
              {lab.accreditations && lab.accreditations.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Accreditations:</p>
                  <div className="flex flex-wrap gap-1">
                    {lab.accreditations.map((acc, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-info-muted">
                        {acc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(lab)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(lab)}>
                  View
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        pageSizeOptions={[20, 50, 100]}
        itemLabel="labs"
      />

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLab ? 'Edit Testing Lab' : 'Add Testing Lab'}</DialogTitle>
            <DialogDescription>
              {editingLab ? 'Update the testing laboratory details.' : 'Register a new external testing laboratory.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="labCode">
                Lab Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="labCode"
                value={form.labCode}
                onChange={(e) => setField('labCode', e.target.value)}
                placeholder="e.g. LAB-001"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="labName">
                Lab Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="labName"
                value={form.labName}
                onChange={(e) => setField('labName', e.target.value)}
                placeholder="e.g. SGS India"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                value={form.contactPerson}
                onChange={(e) => setField('contactPerson', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setField('contactEmail', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                value={form.contactPhone}
                onChange={(e) => setField('contactPhone', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="averageTurnaroundDays">Avg. Turnaround (days)</Label>
              <Input
                id="averageTurnaroundDays"
                type="number"
                min={1}
                max={60}
                value={form.averageTurnaroundDays}
                onChange={(e) => setField('averageTurnaroundDays', e.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={(e) => setField('city', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={form.state} onChange={(e) => setField('state', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pincode">Pincode</Label>
              <Input id="pincode" value={form.pincode} onChange={(e) => setField('pincode', e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="accreditations">Accreditations (comma separated)</Label>
              <Input
                id="accreditations"
                value={form.accreditations}
                onChange={(e) => setField('accreditations', e.target.value)}
                placeholder="e.g. NABL, ISO 17025"
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <Switch id="isActive" checked={form.isActive} onCheckedChange={(v) => setField('isActive', v)} />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : editingLab ? 'Save Changes' : 'Create Lab'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
