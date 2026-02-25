/**
 * Component Group Master Management Page
 * Manage component groups (TOP, BOTTOM, OUTER, etc.)
 */

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { notify } from '../lib/notify';
import { Plus, Pencil, Trash2, Search, MoveUp, MoveDown } from 'lucide-react';
import { componentGroupService } from '../services/componentGroup.service';
import type {
  ComponentGroup,
  CreateComponentGroupInput,
  UpdateComponentGroupInput,
} from '../types/componentGroup.types';

export default function ComponentGroupMaster() {
  const [componentGroups, setComponentGroups] = useState<ComponentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ComponentGroup | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<{ id: string; name: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateComponentGroupInput>({
    code: '',
    name: '',
    description: '',
    sortOrder: 0,
    isActive: true,
  });

  // Load component groups
  const loadComponentGroups = async () => {
    try {
      setLoading(true);
      const response = await componentGroupService.getAll({
        search: searchTerm,
        isActive: undefined, // Show both active and inactive
        limit: 100,
      });
      setComponentGroups(response.data);
    } catch (error: any) {
      notify.error(error.response?.data?.message || 'Failed to load component groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComponentGroups();
  }, [searchTerm]);

  // Handle create/update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.code || !formData.name) {
      notify.error('Code and Name are required');
      return;
    }

    try {
      if (editingGroup) {
        await componentGroupService.update(editingGroup.id, formData as UpdateComponentGroupInput);
        notify.success('Component group updated successfully');
      } else {
        await componentGroupService.create(formData);
        notify.success('Component group created successfully');
      }
      setIsDialogOpen(false);
      resetForm();
      loadComponentGroups();
    } catch (error: any) {
      notify.error(error.response?.data?.message || 'Failed to save component group');
    }
  };

  // Handle delete click - opens confirmation dialog
  const handleDeleteClick = (id: string, name: string) => {
    setGroupToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  // Confirm delete - executes after user confirms
  const confirmDelete = async () => {
    if (!groupToDelete) return;

    try {
      await componentGroupService.delete(groupToDelete.id);
      notify.success('Component group deleted successfully');
      loadComponentGroups();
    } catch (error: any) {
      notify.error(error.response?.data?.message || 'Failed to delete component group');
    } finally {
      setGroupToDelete(null);
    }
  };

  // Handle edit
  const handleEdit = (group: ComponentGroup) => {
    setEditingGroup(group);
    setFormData({
      code: group.code,
      name: group.name,
      description: group.description || '',
      sortOrder: group.sortOrder,
      isActive: group.isActive,
    });
    setIsDialogOpen(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      sortOrder: 0,
      isActive: true,
    });
    setEditingGroup(null);
  };

  // Open create dialog
  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Handle reorder (move up/down)
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === componentGroups.length - 1)
    ) {
      return;
    }

    const newGroups = [...componentGroups];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    // Swap
    [newGroups[index], newGroups[targetIndex]] = [newGroups[targetIndex], newGroups[index]];

    // Update sort orders
    const orders = newGroups.map((group, idx) => ({
      id: group.id,
      sortOrder: idx,
    }));

    try {
      await componentGroupService.reorder({ orders });
      setComponentGroups(newGroups);
      notify.success('Order updated successfully');
    } catch (error: any) {
      notify.error(error.response?.data?.message || 'Failed to update order');
      loadComponentGroups(); // Reload on error
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Component Group Master</h1>
          <p className="text-gray-600 mt-1">
            Manage component groups for organizing garment components
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Component Group
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search component groups..."
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
              <TableHead className="w-[100px]">Order</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px]">Components</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="text-right w-[200px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : componentGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No component groups found
                </TableCell>
              </TableRow>
            ) : (
              componentGroups.map((group, index) => (
                <TableRow key={group.id} className={!group.isActive ? 'opacity-50' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        title="Move up"
                      >
                        <MoveUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === componentGroups.length - 1}
                        title="Move down"
                      >
                        <MoveDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {group.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {group.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {group._count?.components || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {group.isActive ? (
                      <Badge variant="default" className="bg-green-500">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(group)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(group.id, group.name)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
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
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? 'Edit Component Group' : 'Create Component Group'}
            </DialogTitle>
            <DialogDescription>
              {editingGroup
                ? 'Update the component group details below.'
                : 'Add a new component group for organizing garment components.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* Code */}
              <div className="grid gap-2">
                <Label htmlFor="code">
                  Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., TOP, BOTTOM, OUTER"
                  required
                  className="font-mono"
                  disabled={!!editingGroup} // Don't allow code change on edit
                />
                <p className="text-xs text-gray-500">
                  Unique identifier (will be auto-converted to uppercase)
                </p>
              </div>

              {/* Name */}
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Top Wear, Bottom Wear"
                  required
                />
              </div>

              {/* Description */}
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this component group..."
                  rows={3}
                />
              </div>

              {/* Sort Order */}
              <div className="grid gap-2">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                  }
                  min="0"
                />
                <p className="text-xs text-gray-500">Lower numbers appear first</p>
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="isActive">Active Status</Label>
                  <p className="text-xs text-gray-500">
                    Inactive groups won't appear in dropdowns
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{editingGroup ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete "${groupToDelete?.name}"?`}
        description="Are you sure you want to delete this component group? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
