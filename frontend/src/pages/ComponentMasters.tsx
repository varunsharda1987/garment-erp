// Component Masters Management Page
import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { notify } from '../lib/notify';
import { Plus, Pencil, Trash2, Search, Puzzle } from 'lucide-react';
import ComponentPatternPartsDialog from '../components/masters/ComponentPatternPartsDialog';
import {
  getAllComponentMasters,
  createComponentMaster,
  updateComponentMaster,
  deleteComponentMaster,
} from '../services/componentMaster.service';
import { componentGroupService } from '../services/componentGroup.service';
import type { ComponentMaster, ComponentMasterFormData } from '../types/componentMaster.types';
import type { ComponentGroup } from '../types/componentGroup.types';

export default function ComponentMasters() {
  const [components, setComponents] = useState<ComponentMaster[]>([]);
  const [componentGroups, setComponentGroups] = useState<ComponentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<ComponentMaster | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [componentToDelete, setComponentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [partsDialogOpen, setPartsDialogOpen] = useState(false);
  const [partsComponent, setPartsComponent] = useState<{ id: string; name: string } | null>(null);

  // Form state
  // TODO [BUG-CM6]: componentCategory is DEPRECATED - kept only for backward compatibility
  // with existing records. All new components should use componentGroupId exclusively.
  // Migration path: Once all existing components have componentGroupId assigned,
  // remove componentCategory from forms, types, and API payloads.
  const [formData, setFormData] = useState<ComponentMasterFormData>({
    name: '',
    description: '',
    componentCategory: '', // DEPRECATED - use componentGroupId instead
    componentGroupId: undefined, // BUG-CM4 fix: use undefined, not '' (backend expects UUID or undefined)
    sortOrder: 0,
    isActive: true,
  });

  // Load components
  const loadComponents = async () => {
    try {
      setLoading(true);
      const response = await getAllComponentMasters({
        search: searchTerm,
        activeOnly: false,
        limit: 100,
      });
      setComponents(response.data);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      notify.error(err.response?.data?.message || 'Failed to load component masters');
    } finally {
      setLoading(false);
    }
  };

  // Load component groups
  const loadComponentGroups = async () => {
    try {
      const response = await componentGroupService.getAll({
        page: 1,
        limit: 100,
        isActive: true,
      });
      setComponentGroups(response.data);
    } catch {
      notify.error('Failed to load component groups');
    }
  };

  useEffect(() => {
    loadComponents();
    loadComponentGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Handle create/update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate Component Group is selected
    if (!formData.componentGroupId) {
      notify.error('Component Group is required. Please select a component group.');
      return;
    }

    try {
      if (editingComponent) {
        await updateComponentMaster(editingComponent.id, formData);
        notify.success('Component master updated successfully');
      } else {
        await createComponentMaster(formData);
        notify.success('Component master created successfully');
      }
      setIsDialogOpen(false);
      resetForm();
      loadComponents();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      notify.error(err.response?.data?.message || 'Failed to save component master');
    }
  };

  // Handle delete click - opens confirmation dialog
  const handleDeleteClick = (id: string, name: string) => {
    setComponentToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  // Confirm delete - executes after user confirms
  const confirmDelete = async () => {
    if (!componentToDelete) return;

    try {
      await deleteComponentMaster(componentToDelete.id);
      notify.success('Component master deleted successfully');
      loadComponents();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      notify.error(err.response?.data?.message || 'Failed to delete component master');
    } finally {
      setComponentToDelete(null);
    }
  };

  // Handle edit
  const handleEdit = (component: ComponentMaster) => {
    setEditingComponent(component);
    setFormData({
      name: component.name,
      description: component.description || '',
      componentCategory: component.componentCategory || '', // DEPRECATED - kept for backward compat
      componentGroupId: component.componentGroupId || undefined, // BUG-CM4 fix: use undefined, not ''
      sortOrder: component.sortOrder,
      isActive: component.isActive,
    });
    setIsDialogOpen(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      componentCategory: '', // DEPRECATED - kept for backward compat
      componentGroupId: undefined, // BUG-CM4 fix: use undefined, not ''
      sortOrder: 0,
      isActive: true,
    });
    setEditingComponent(null);
  };

  // Open create dialog
  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-display font-medium">Component Masters</h1>
          <p className="text-muted-foreground mt-1">Manage garment component types (Blouse, Top, Pajama, etc.)</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Component
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search components..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Component Group</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : components.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No component masters found
                </TableCell>
              </TableRow>
            ) : (
              components.map((component) => (
                <TableRow key={component.id}>
                  <TableCell className="font-medium">{component.name}</TableCell>
                  {/* TODO [BUG-CM6]: componentCategory display is DEPRECATED - shown only for
                      legacy records that haven't been migrated to componentGroupId yet.

                      BUG-CM10 MIGRATION PATH: Once all existing components have componentGroupId
                      assigned (run a DB migration script to backfill), remove this fallback:
                      1. Remove the `component.componentCategory` branch below
                      2. Remove componentCategory from ComponentMaster type
                      3. Remove componentCategory from Prisma schema
                      4. Remove componentCategory from formData state and handlers in this file */}
                  <TableCell>
                    {component.componentGroup ? (
                      <Badge variant="outline">{component.componentGroup.name}</Badge>
                    ) : component.componentCategory ? (
                      // DEPRECATED: This fallback displays legacy componentCategory for records
                      // not yet migrated to componentGroupId. Remove after migration is complete.
                      <Badge variant="secondary">{component.componentCategory}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {component.description || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>{component.sortOrder}</TableCell>
                  <TableCell>
                    {component.isActive ? (
                      <Badge variant="default" className="bg-success-muted">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Manage pattern parts (CAD Part dropdown options)"
                      onClick={() => {
                        setPartsComponent({ id: component.id, name: component.name });
                        setPartsDialogOpen(true);
                      }}
                    >
                      <Puzzle className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(component)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(component.id, component.name)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingComponent ? 'Edit Component Master' : 'Create Component Master'}</DialogTitle>
            <DialogDescription>
              {editingComponent
                ? 'Update the component master details below.'
                : 'Add a new component master for garment types.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Blouse, Top, Pajama"
                  required
                />
              </div>

              <div>
                <Label htmlFor="componentGroupId">
                  Component Group <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.componentGroupId}
                  onValueChange={(value) => setFormData({ ...formData, componentGroupId: value })}
                  required
                >
                  <SelectTrigger id="componentGroupId">
                    <SelectValue placeholder="Select a component group" />
                  </SelectTrigger>
                  <SelectContent>
                    {componentGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Component Group determines which pattern parts (Front, Back, Sleeve, etc.) are available for CAD
                  planning
                </p>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Component description"
                />
              </div>

              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingComponent ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pattern Parts Management Dialog */}
      <ComponentPatternPartsDialog
        open={partsDialogOpen}
        onOpenChange={setPartsDialogOpen}
        componentId={partsComponent?.id || null}
        componentName={partsComponent?.name || ''}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete "${componentToDelete?.name}"?`}
        description="Are you sure you want to delete this component master? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
