// Template Manager - Admin page for managing export templates
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ConfirmDialog from '@/components/ConfirmDialog';
import templateService from '@/services/template.service';
import type { ExportTemplate, ModuleInfo, AvailableColumn } from '@/types/template.types';
import type { ExportColumn } from '@/types/export.types';
import { logError } from '@/lib/logger';

export default function TemplateManager() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [availableColumns, setAvailableColumns] = useState<AvailableColumn[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state for creating/editing templates
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ExportTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    moduleName: '',
    templateName: '',
    description: '',
    isDefault: false,
  });
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchModules();
  }, []);

  useEffect(() => {
    if (selectedModule) {
      fetchTemplates();
      fetchAvailableColumns();
    }
  }, [selectedModule]);

  const fetchModules = async () => {
    try {
      const data = await templateService.getAvailableModules();
      setModules(data);
      if (data.length > 0) {
        setSelectedModule(data[0].name);
      }
    } catch (err: unknown) {
      logError('Failed to fetch modules:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const data = await templateService.getTemplatesByModule(selectedModule);
      setTemplates(data);
    } catch (err: unknown) {
      logError('Failed to fetch templates:', err);
    }
  };

  const fetchAvailableColumns = async () => {
    try {
      const data = await templateService.getAvailableColumns(selectedModule);
      setAvailableColumns(data);
    } catch (err: unknown) {
      logError('Failed to fetch columns:', err);
    }
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setFormData({
      moduleName: selectedModule,
      templateName: '',
      description: '',
      isDefault: false,
    });
    setSelectedColumns(new Set());
    setIsFormOpen(true);
  };

  const handleEdit = (template: ExportTemplate) => {
    setEditingTemplate(template);
    setFormData({
      moduleName: template.moduleName,
      templateName: template.templateName,
      description: template.description || '',
      isDefault: template.isDefault,
    });
    const cols = new Set(template.columnConfig.map(c => c.fieldName));
    setSelectedColumns(cols);
    setIsFormOpen(true);
  };

  // Handle delete click - opens confirmation dialog
  const handleDeleteClick = (id: string, name: string) => {
    setTemplateToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  // Confirm delete - executes after user confirms
  const confirmDelete = async () => {
    if (!templateToDelete) return;

    try {
      await templateService.deleteTemplate(templateToDelete.id);
      fetchTemplates();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to delete template');
    } finally {
      setTemplateToDelete(null);
    }
  };

  const toggleColumn = (fieldName: string) => {
    const newSet = new Set(selectedColumns);
    if (newSet.has(fieldName)) {
      newSet.delete(fieldName);
    } else {
      newSet.add(fieldName);
    }
    setSelectedColumns(newSet);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build column config from selected columns
    const columnConfig: ExportColumn[] = availableColumns
      .filter(col => selectedColumns.has(col.fieldName))
      .map(col => ({
        fieldName: col.fieldName,
        displayName: col.displayName,
        format: col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text',
        width: 15,
      }));

    if (columnConfig.length === 0) {
      alert('Please select at least one column');
      return;
    }

    try {
      if (editingTemplate) {
        await templateService.updateTemplate(editingTemplate.id, {
          templateName: formData.templateName,
          description: formData.description,
          columnConfig,
          isDefault: formData.isDefault,
        });
      } else {
        await templateService.createTemplate({
          moduleName: formData.moduleName,
          templateName: formData.templateName,
          description: formData.description,
          columnConfig,
          isDefault: formData.isDefault,
        });
      }

      setIsFormOpen(false);
      fetchTemplates();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to save template');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                ← Back
              </Button>
              <div className="text-2xl">📋</div>
              <h1 className="text-xl font-bold text-gray-800">Export Template Manager</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Module Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Module</label>
          <Select value={selectedModule} onValueChange={setSelectedModule}>
            <SelectTrigger className="w-64 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modules.map(module => (
                <SelectItem key={module.name} value={module.name}>
                  {module.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Templates List */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Templates for {modules.find(m => m.name === selectedModule)?.displayName}</CardTitle>
                <CardDescription>Manage export templates for this module</CardDescription>
              </div>
              <Button onClick={handleCreateNew}>+ Create Template</Button>
            </div>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No templates found. Create your first template!
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{template.templateName}</h3>
                        {template.isDefault && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {template.columnConfig.length} columns selected
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(template.id, template.templateName)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsFormOpen(false)} />
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                  <div className="p-6">
                    <h2 className="text-2xl font-bold mb-6">
                      {editingTemplate ? 'Edit Template' : 'Create New Template'}
                    </h2>

                    {/* Template Name */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Template Name *
                      </label>
                      <Input
                        value={formData.templateName}
                        onChange={(e) => setFormData({ ...formData, templateName: e.target.value })}
                        placeholder="e.g., Full Export, Basic Info, etc."
                        required
                      />
                    </div>

                    {/* Description */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description (Optional)
                      </label>
                      <Input
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Describe what this template is for..."
                      />
                    </div>

                    {/* Default Checkbox */}
                    <div className="mb-6">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.isDefault}
                          onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Set as default template
                        </span>
                      </label>
                    </div>

                    {/* Column Selection */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Select Columns * ({selectedColumns.size} selected)
                      </label>
                      <div className="border rounded-lg p-4 max-h-64 overflow-y-auto bg-gray-50">
                        <div className="grid grid-cols-2 gap-3">
                          {availableColumns.map(column => (
                            <label
                              key={column.fieldName}
                              className="flex items-start gap-2 p-2 hover:bg-white rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedColumns.has(column.fieldName)}
                                onChange={() => toggleColumn(column.fieldName)}
                                className="mt-1"
                              />
                              <div>
                                <div className="font-medium text-sm">{column.displayName}</div>
                                <div className="text-xs text-gray-500">{column.fieldName}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingTemplate ? 'Update Template' : 'Create Template'}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={`Delete "${templateToDelete?.name}"?`}
          description="Are you sure you want to delete this template? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDelete}
          variant="destructive"
        />
      </main>
    </div>
  );
}
