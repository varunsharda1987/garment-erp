// Component Masters Management Page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
  getAllComponentMasters,
  createComponentMaster,
  updateComponentMaster,
  deleteComponentMaster,
} from '../services/componentMaster.service';
import { componentGroupService } from '../services/componentGroup.service';
import type {
  ComponentMaster,
  ComponentMasterFormData,
} from '../types/componentMaster.types';
import type { ComponentGroup } from '../types/componentGroup.types';

export default function ComponentMasters() {
  const navigate = useNavigate();
  const [components, setComponents] = useState<ComponentMaster[]>([]);
  const [componentGroups, setComponentGroups] = useState<ComponentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<ComponentMaster | null>(null);

  // Form state
  const [formData, setFormData] = useState<ComponentMasterFormData>({
    name: '',
    description: '',
    componentCategory: '',
    componentGroupId: '',
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
      notify.error(error.response?.data?.message || 'Failed to load component masters');
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
    } catch (error: unknown) {
      notify.error('Failed to load component groups');
    }
  };

  useEffect(() => {
    loadComponents();
    loadComponentGroups();
  }, [searchTerm]);

  // Handle create/update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      notify.error(error.response?.data?.message || 'Failed to save component master');
    }
  };

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await deleteComponentMaster(id);
      notify.success('Component master deleted successfully');
      loadComponents();
    } catch (error: unknown) {
      notify.error(error.response?.data?.message || 'Failed to delete component master');
    }
  };

  // Handle edit
  const handleEdit = (component: ComponentMaster) => {
    setEditingComponent(component);
    setFormData({
      name: component.name,
      description: component.description || '',
      componentCategory: component.componentCategory || '',
      componentGroupId: component.componentGroupId || '',
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
      componentCategory: '',
      componentGroupId: '',
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
          <h1 className="text-3xl font-bold">Component Masters</h1>
          <p className="text-gray-600 mt-1">
            Manage garment component types (Blouse, Top, Pajama, etc.)
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Component
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No component masters found
                </TableCell>
              </TableRow>
            ) : (
              components.map((component) => (
                <TableRow key={component.id}>
                  <TableCell className="font-medium">{component.name}</TableCell>
                  <TableCell>
                    {component.componentGroup ? (
                      <Badge variant="outline">{component.componentGroup.name}</Badge>
                    ) : component.componentCategory ? (
                      <Badge variant="secondary">{component.componentCategory}</Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {component.description || <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell>{component.sortOrder}</TableCell>
                  <TableCell>
                    {component.isActive ? (
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
                      onClick={() => handleEdit(component)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(component.id, component.name)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingComponent ? 'Edit Component Master' : 'Create Component Master'}
            </DialogTitle>
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
                  Name <span className="text-red-500">*</span>
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
                <Label htmlFor="componentGroupId">Component Group</Label>
                <Select
                  value={formData.componentGroupId}
                  onValueChange={(value) => setFormData({ ...formData, componentGroupId: value })}
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
                <p className="text-xs text-gray-500 mt-1">
                  Broad grouping: Top Wear, Bottom Wear, etc.
                </p>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Component description"
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
                {editingComponent ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
