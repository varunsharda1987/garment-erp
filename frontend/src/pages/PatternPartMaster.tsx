// Pattern Part Master Management Page
// Manages individual pattern pieces that make up garment components (Sleeve, Collar, Pocket, etc.)
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { notify } from '../lib/notify';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import {
  getAllPatternParts,
  createPatternPart,
  updatePatternPart,
  deletePatternPart,
} from '../services/patternPart.service';
import { componentGroupService } from '../services/componentGroup.service';
import type {
  PatternPart,
  PatternPartFormData,
} from '../types/patternPart.types';
import type { ComponentGroup } from '../types/componentGroup.types';

export default function PatternPartMaster() {
  const [patternParts, setPatternParts] = useState<PatternPart[]>([]);
  const [componentGroups, setComponentGroups] = useState<ComponentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatternPart, setEditingPatternPart] = useState<PatternPart | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [patternPartToDelete, setPatternPartToDelete] = useState<{ id: string; name: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState<PatternPartFormData>({
    code: '',
    name: '',
    description: '',
    sortOrder: 0,
    isActive: true,
    componentGroupIds: [],
  });

  // Load pattern parts
  const loadPatternParts = async () => {
    try {
      setLoading(true);
      const response = await getAllPatternParts({
        search: searchTerm,
        activeOnly: false,
        limit: 100,
      });
      setPatternParts(response.data);
    } catch (error: any) {
      notify.error(error.response?.data?.message || 'Failed to load pattern parts');
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
    } catch (error: any) {
      notify.error('Failed to load component groups');
    }
  };

  useEffect(() => {
    loadPatternParts();
    loadComponentGroups();
  }, [searchTerm]);

  // Handle create/update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPatternPart) {
        await updatePatternPart(editingPatternPart.id, formData);
        notify.success('Pattern part updated successfully');
      } else {
        await createPatternPart(formData);
        notify.success('Pattern part created successfully');
      }
      setIsDialogOpen(false);
      resetForm();
      loadPatternParts();
    } catch (error: any) {
      notify.error(error.response?.data?.message || 'Failed to save pattern part');
    }
  };

  // Handle delete click - opens confirmation dialog
  const handleDeleteClick = (id: string, name: string) => {
    setPatternPartToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  // Confirm delete - executes after user confirms
  const confirmDelete = async () => {
    if (!patternPartToDelete) return;

    try {
      await deletePatternPart(patternPartToDelete.id);
      notify.success('Pattern part deleted successfully');
      loadPatternParts();
    } catch (error: any) {
      notify.error(error.response?.data?.message || 'Failed to delete pattern part');
    } finally {
      setPatternPartToDelete(null);
    }
  };

  // Handle edit
  const handleEdit = (patternPart: PatternPart) => {
    setEditingPatternPart(patternPart);
    setFormData({
      code: patternPart.code,
      name: patternPart.name,
      description: patternPart.description || '',
      sortOrder: patternPart.sortOrder,
      isActive: patternPart.isActive,
      componentGroupIds: patternPart.componentGroups?.map(g => g.id) || [],
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
      componentGroupIds: [],
    });
    setEditingPatternPart(null);
  };

  // Open create dialog
  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Toggle component group selection
  const toggleGroupSelection = (groupId: string) => {
    const currentIds = formData.componentGroupIds || [];
    if (currentIds.includes(groupId)) {
      setFormData({
        ...formData,
        componentGroupIds: currentIds.filter(id => id !== groupId),
      });
    } else {
      setFormData({
        ...formData,
        componentGroupIds: [...currentIds, groupId],
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Pattern Parts</h1>
          <p className="text-gray-600 mt-1">
            Manage individual pattern pieces that make up garment components (Sleeve, Collar, Pocket, etc.)
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Pattern Part
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search pattern parts..."
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
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Component Groups</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Sort Order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : patternParts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No pattern parts found
                </TableCell>
              </TableRow>
            ) : (
              patternParts.map((patternPart) => (
                <TableRow key={patternPart.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {patternPart.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{patternPart.name}</TableCell>
                  <TableCell>
                    {patternPart.componentGroups && patternPart.componentGroups.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {patternPart.componentGroups.map((group) => (
                          <Badge key={group.id} variant="secondary" className="text-xs">
                            {group.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {patternPart.description || <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell>{patternPart.sortOrder}</TableCell>
                  <TableCell>
                    {patternPart.isActive ? (
                      <Badge variant="default" className="bg-green-500">
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
                      onClick={() => handleEdit(patternPart)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(patternPart.id, patternPart.name)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPatternPart ? 'Edit Pattern Part' : 'Create Pattern Part'}
            </DialogTitle>
            <DialogDescription>
              {editingPatternPart
                ? 'Update the pattern part details below.'
                : 'Add a new pattern part for garment construction.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="code">
                  Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., SLEEVE, COLLAR, POCKET"
                  required
                  className="font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Unique identifier code (auto-uppercased)
                </p>
              </div>

              <div>
                <Label htmlFor="name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Sleeve, Collar, Pocket"
                  required
                />
              </div>

              <div>
                <Label>Component Groups</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Select which garment types this pattern part applies to
                </p>
                <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-gray-50">
                  {componentGroups.map((group) => {
                    const isSelected = formData.componentGroupIds?.includes(group.id);
                    return (
                      <Badge
                        key={group.id}
                        variant={isSelected ? 'default' : 'outline'}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'hover:bg-gray-200'
                        }`}
                        onClick={() => toggleGroupSelection(group.id)}
                      >
                        {group.name}
                      </Badge>
                    );
                  })}
                </div>
                {formData.componentGroupIds && formData.componentGroupIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.componentGroupIds.length} group(s) selected
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Brief description of this pattern part"
                />
              </div>

              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingPatternPart ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete "${patternPartToDelete?.name}"?`}
        description="Are you sure you want to delete this pattern part? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
