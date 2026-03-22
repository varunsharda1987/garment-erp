/**
 * Product Category Master Management Page
 * Hierarchical tree view for managing product categories
 */

import { useState, useEffect, useCallback } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { notify } from '../lib/notify';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Tag,
  Search,
  RefreshCw,
  Layers,
  X,
} from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import { productCategoryService } from '../services/productCategory.service';
import { getAllComponentMasters } from '../services/componentMaster.service';
import type { ComponentMaster } from '../types/componentMaster.types';
import type {
  ProductCategory,
  ProductCategoryHierarchy,
  CreateProductCategoryRequest,
  UpdateProductCategoryRequest,
  CategoryComponentDefault,
  ComponentDefaultInput,
} from '../types/productCategory.types';

interface TreeNodeProps {
  category: ProductCategoryHierarchy;
  level: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit: (category: ProductCategory) => void;
  onDelete: (category: ProductCategory) => void;
  onAddChild: (parentId: string, parentName: string) => void;
  onToggleActive: (category: ProductCategory) => void;
  onManageComponents: (category: ProductCategory) => void;
}

function TreeNode({
  category,
  level,
  expandedIds,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddChild,
  onToggleActive,
  onManageComponents,
}: TreeNodeProps) {
  const isExpanded = expandedIds.has(category.id);
  const hasChildren = category.children && category.children.length > 0;
  const paddingLeft = level * 24;

  return (
    <div>
      <div
        className={`flex items-center py-2 px-3 hover:bg-gray-50 border-b border-gray-100 ${
          !category.isActive ? 'opacity-50' : ''
        }`}
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        {/* Expand/Collapse Toggle */}
        <button
          className="w-6 h-6 flex items-center justify-center mr-2"
          onClick={() => hasChildren && onToggleExpand(category.id)}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>

        {/* Icon */}
        {hasChildren ? (
          isExpanded ? (
            <FolderOpen className="h-5 w-5 text-amber-500 mr-2" />
          ) : (
            <Folder className="h-5 w-5 text-amber-500 mr-2" />
          )
        ) : (
          <Tag className="h-4 w-4 text-blue-500 mr-2" />
        )}

        {/* Category Info */}
        <div className="flex-1 flex items-center">
          <span className="font-mono text-xs text-gray-400 mr-2">[{category.code}]</span>
          <span className="font-medium">{category.name}</span>
          <Badge variant="outline" className="ml-2 text-xs">
            Level {category.level}
          </Badge>
          {!category.isActive && (
            <Badge variant="secondary" className="ml-2 text-xs">
              Inactive
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {category.level < 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddChild(category.id, category.name)}
              title="Add sub-category"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {category.level >= 2 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onManageComponents(category)}
              title="Manage default components"
              className="text-purple-600 hover:text-purple-800"
            >
              <Layers className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onEdit(category)} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleActive(category)}
            title={category.isActive ? 'Deactivate' : 'Activate'}
          >
            <Switch checked={category.isActive} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(category)}
            title="Delete"
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {category.children.map((child) => (
            <TreeNode
              key={child.id}
              category={child}
              level={level + 1}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onToggleActive={onToggleActive}
              onManageComponents={onManageComponents}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductCategoryMaster() {
  const [hierarchy, setHierarchy] = useState<ProductCategoryHierarchy[]>([]);
  const [mainCategories, setMainCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<ProductCategory | null>(null);

  // Components Dialog State
  const [isComponentsDialogOpen, setIsComponentsDialogOpen] = useState(false);
  const [componentsCategory, setComponentsCategory] = useState<ProductCategory | null>(null);
  const [componentMasters, setComponentMasters] = useState<ComponentMaster[]>([]);
  const [, setCategoryDefaults] = useState<CategoryComponentDefault[]>([]);
  const [selectedComponentIds, setSelectedComponentIds] = useState<Set<string>>(new Set());
  const [requiredComponentIds, setRequiredComponentIds] = useState<Set<string>>(new Set());
  const [savingComponents, setSavingComponents] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateProductCategoryRequest>({
    code: '',
    name: '',
    description: '',
    parentId: null,
    sortOrder: 0,
    minComponents: 1,
    maxComponents: 1,
  });
  const [formParentName, setFormParentName] = useState<string>('None (Main Category)');

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [hierarchyData, mainCats, components] = await Promise.all([
        productCategoryService.getHierarchy(),
        productCategoryService.getMainCategories(),
        getAllComponentMasters({ activeOnly: true, limit: 100 }),
      ]);
      setHierarchy(hierarchyData);
      setMainCategories(mainCats);
      setComponentMasters(components.data);
      // Expand all main categories by default
      setExpandedIds(new Set(mainCats.map((c) => c.id)));
    } catch (error: unknown) {
      notify.error(
        (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to load categories'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle opening the components dialog
  const handleManageComponents = async (category: ProductCategory) => {
    setComponentsCategory(category);
    setIsComponentsDialogOpen(true);

    try {
      const defaults = await productCategoryService.getDefaultComponents(category.id);
      setCategoryDefaults(defaults);

      // Initialize selected and required sets from existing defaults
      const selected = new Set(defaults.map((d) => d.componentMasterId));
      const required = new Set(defaults.filter((d) => d.isRequired).map((d) => d.componentMasterId));
      setSelectedComponentIds(selected);
      setRequiredComponentIds(required);
    } catch (error) {
      console.error('Failed to load default components:', error);
      notify.error('Failed to load default components');
      setCategoryDefaults([]);
      setSelectedComponentIds(new Set());
      setRequiredComponentIds(new Set());
    }
  };

  // Handle toggling a component selection
  const handleToggleComponent = (componentId: string) => {
    setSelectedComponentIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(componentId)) {
        newSet.delete(componentId);
        // Also remove from required if it was required
        setRequiredComponentIds((reqPrev) => {
          const newReqSet = new Set(reqPrev);
          newReqSet.delete(componentId);
          return newReqSet;
        });
      } else {
        newSet.add(componentId);
      }
      return newSet;
    });
  };

  // Handle toggling required status
  const handleToggleRequired = (componentId: string) => {
    setRequiredComponentIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(componentId)) {
        newSet.delete(componentId);
      } else {
        newSet.add(componentId);
      }
      return newSet;
    });
  };

  // Save default components
  const handleSaveComponents = async () => {
    if (!componentsCategory) return;

    setSavingComponents(true);
    try {
      const components: ComponentDefaultInput[] = Array.from(selectedComponentIds).map((id, index) => ({
        componentMasterId: id,
        isRequired: requiredComponentIds.has(id),
        sortOrder: index,
      }));

      await productCategoryService.setDefaultComponents(componentsCategory.id, components);
      notify.success('Default components saved successfully');
      setIsComponentsDialogOpen(false);
    } catch (error: unknown) {
      notify.error(
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
          'Failed to save default components'
      );
    } finally {
      setSavingComponents(false);
    }
  };

  // Toggle expand/collapse
  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Expand all
  const handleExpandAll = () => {
    const getAllIds = (cats: ProductCategoryHierarchy[]): string[] => {
      return cats.flatMap((cat) => [cat.id, ...getAllIds(cat.children || [])]);
    };
    setExpandedIds(new Set(getAllIds(hierarchy)));
  };

  // Collapse all
  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate min/max components
    if (formData.minComponents && formData.maxComponents && formData.minComponents > formData.maxComponents) {
      notify.error('Min components cannot be greater than max components');
      return;
    }

    try {
      if (editingCategory) {
        const updateData: UpdateProductCategoryRequest = {
          ...formData,
        };
        await productCategoryService.updateCategory(editingCategory.id, updateData);
        notify.success('Category updated successfully');
      } else {
        await productCategoryService.createCategory(formData);
        notify.success('Category created successfully');
      }
      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: unknown) {
      notify.error(
        (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to save category'
      );
    }
  };

  // Handle delete click - opens confirmation dialog
  const handleDeleteClick = (category: ProductCategory) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  // Confirm delete - executes after user confirms
  const confirmDelete = async () => {
    if (!categoryToDelete) return;

    try {
      await productCategoryService.deleteCategory(categoryToDelete.id);
      notify.success('Category deleted successfully');
      loadData();
    } catch (error: unknown) {
      notify.error(
        (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to delete category'
      );
    } finally {
      setCategoryToDelete(null);
    }
  };

  // Handle toggle active
  const handleToggleActive = async (category: ProductCategory) => {
    try {
      await productCategoryService.toggleActive(category.id);
      notify.success(`Category ${category.isActive ? 'deactivated' : 'activated'} successfully`);
      loadData();
    } catch (error: unknown) {
      notify.error(
        (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to update category'
      );
    }
  };

  // Handle edit
  const handleEdit = (category: ProductCategory) => {
    setEditingCategory(category);
    setFormData({
      code: category.code,
      name: category.name,
      description: category.description || '',
      parentId: category.parentId || null,
      sortOrder: category.sortOrder,
      minComponents: category.minComponents || 1,
      maxComponents: category.maxComponents || 1,
    });
    setFormParentName(category.parent?.name || 'None (Main Category)');
    setIsDialogOpen(true);
  };

  // Handle add child
  const handleAddChild = (parentId: string, parentName: string) => {
    resetForm();
    setFormData((prev) => ({
      ...prev,
      parentId,
    }));
    setFormParentName(parentName);
    setIsDialogOpen(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      parentId: null,
      sortOrder: 0,
      minComponents: 1,
      maxComponents: 1,
    });
    setFormParentName('None (Main Category)');
    setEditingCategory(null);
  };

  // Open create dialog
  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Filter hierarchy based on search
  const filterHierarchy = (cats: ProductCategoryHierarchy[], term: string): ProductCategoryHierarchy[] => {
    if (!term) return cats;

    const termLower = term.toLowerCase();
    return cats
      .map((cat) => ({
        ...cat,
        children: filterHierarchy(cat.children || [], term),
      }))
      .filter(
        (cat) =>
          cat.name.toLowerCase().includes(termLower) ||
          cat.code.toLowerCase().includes(termLower) ||
          cat.children.length > 0
      );
  };

  const filteredHierarchy = filterHierarchy(hierarchy, searchTerm);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Product Category Master</h1>
          <p className="text-gray-600 mt-1">Manage hierarchical product categories (Western Wear, Ethnic Wear, etc.)</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Search & Actions */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={handleExpandAll}>
          Expand All
        </Button>
        <Button variant="outline" onClick={handleCollapseAll}>
          Collapse All
        </Button>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Tree View */}
      <div className="bg-white border rounded-lg">
        <div className="border-b bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600">Category Hierarchy</div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading categories...</div>
        ) : filteredHierarchy.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm
              ? 'No categories found matching your search.'
              : 'No categories found. Click "Add Category" to create one.'}
          </div>
        ) : (
          <div>
            {filteredHierarchy.map((category) => (
              <TreeNode
                key={category.id}
                category={category}
                level={0}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onAddChild={handleAddChild}
                onToggleActive={handleToggleActive}
                onManageComponents={handleManageComponents}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription>
              {editingCategory
                ? 'Update the category details below.'
                : formData.parentId
                  ? `Add a new sub-category under "${formParentName}".`
                  : 'Add a new main category.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., WW or WW-TSH"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Western Wear"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentId">Parent Category</Label>
                <Select
                  value={formData.parentId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, parentId: value === 'none' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Main Category)</SelectItem>
                    {mainCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minComponents">Min Components</Label>
                  <Input
                    id="minComponents"
                    type="number"
                    value={formData.minComponents || 1}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      setFormData({ ...formData, minComponents: value });
                    }}
                    min={1}
                    placeholder="1"
                  />
                  <p className="text-xs text-gray-500">Minimum required components</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxComponents">Max Components</Label>
                  <Input
                    id="maxComponents"
                    type="number"
                    value={formData.maxComponents || 1}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      setFormData({ ...formData, maxComponents: value });
                    }}
                    min={formData.minComponents || 1}
                    placeholder="1"
                  />
                  <p className="text-xs text-gray-500">Maximum allowed components</p>
                </div>
              </div>
              {formData.minComponents && formData.maxComponents && formData.minComponents > formData.maxComponents && (
                <p className="text-sm text-red-500">Min components cannot be greater than max components</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingCategory ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Default Components Dialog */}
      <Dialog open={isComponentsDialogOpen} onOpenChange={setIsComponentsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-600" />
              Default Components for "{componentsCategory?.name}"
            </DialogTitle>
            <DialogDescription>
              Select which components (garment articles) are typically included when creating styles in this category.
              Mark components as "Required" if they must always be included.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {componentMasters.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No components available. Please create components in Component Master first.
              </div>
            ) : (
              <div className="space-y-2">
                {componentMasters.map((component) => {
                  const isSelected = selectedComponentIds.has(component.id);
                  const isRequired = requiredComponentIds.has(component.id);

                  return (
                    <div
                      key={component.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isSelected ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`component-${component.id}`}
                          checked={isSelected}
                          onCheckedChange={() => handleToggleComponent(component.id)}
                        />
                        <div>
                          <label htmlFor={`component-${component.id}`} className="font-medium cursor-pointer">
                            {component.name}
                          </label>
                          {component.description && <p className="text-sm text-gray-500">{component.description}</p>}
                          {component.componentCategory && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {component.componentCategory}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <label htmlFor={`required-${component.id}`} className="text-sm text-gray-600 cursor-pointer">
                            Required
                          </label>
                          <Checkbox
                            id={`required-${component.id}`}
                            checked={isRequired}
                            onCheckedChange={() => handleToggleRequired(component.id)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary */}
          {selectedComponentIds.size > 0 && (
            <div className="border-t pt-3">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-600">Selected:</span>
                {Array.from(selectedComponentIds).map((id) => {
                  const component = componentMasters.find((c) => c.id === id);
                  const isRequired = requiredComponentIds.has(id);
                  return component ? (
                    <Badge key={id} variant={isRequired ? 'default' : 'secondary'} className="flex items-center gap-1">
                      {component.name}
                      {isRequired && <span className="text-xs">*</span>}
                      <button
                        type="button"
                        onClick={() => handleToggleComponent(id)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsComponentsDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveComponents} disabled={savingComponents}>
              {savingComponents ? 'Saving...' : 'Save Defaults'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete "${categoryToDelete?.name}"?`}
        description="Are you sure you want to delete this category? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
