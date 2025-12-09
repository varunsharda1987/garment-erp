import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { greigeService } from '../services/fabricGreigeService';
import type { GreigeMaster, GreigeMasterFormData } from '../types/fabric-greige.types';
import { logError } from '../lib/logger';
import { API_URL } from '../config/api.config';

interface GreigeFormProps {
  mode?: 'create' | 'edit';
}

export default function GreigeForm({ mode = 'create' }: GreigeFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [formData, setFormData] = useState<GreigeMasterFormData>({
    greigeCode: '',
    greigeName: '',
    composition: '',
    weaveType: '',
    yarnCount: '',
    construction: '',
    greigeWidth: 0,
    expectedFinishedWidthMin: undefined,
    expectedFinishedWidthMax: undefined,
    averageShrinkagePercent: 8.0,
    gsmRange: '',
    description: '',
    notes: '',
    isActive: true,
    suppliers: [],
  });

  const [genericFabricName, setGenericFabricName] = useState('');

  useEffect(() => {
    if (mode === 'edit' && id) {
      loadGreige();
    } else if (mode === 'create') {
      // Generate greige code for new greige
      generateGreigeCode();
    }
    loadSuppliers();
  }, [mode, id]);

  // Auto-generate greige name when relevant fields change
  useEffect(() => {
    if (mode === 'create' && genericFabricName && formData.yarnCount && formData.construction && formData.greigeWidth) {
      const autoName = `${genericFabricName} ${formData.yarnCount} / ${formData.construction} / ${formData.greigeWidth}"`;
      setFormData(prev => ({ ...prev, greigeName: autoName }));
    }
  }, [genericFabricName, formData.yarnCount, formData.construction, formData.greigeWidth, mode]);

  const generateGreigeCode = async () => {
    try {
      // Get token from Zustand auth store
      const authStorage = localStorage.getItem('auth-storage');
      let token = null;
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          token = parsed.state?.token || null;
        } catch (e) {
          logError('Error parsing auth storage:', e);
        }
      }

      // Fetch all greige masters to determine next code
      const response = await fetch(`${API_URL}/fabric-management/greige?limit=1&page=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      // Generate next sequential code
      const totalCount = data.pagination?.total || 0;
      const nextNumber = totalCount + 1;
      const greigeCode = `GRG-${String(nextNumber).padStart(4, '0')}`;

      setFormData(prev => ({ ...prev, greigeCode }));
    } catch (error) {
      logError('Error generating greige code:', error);
      // Fallback to manual entry if auto-generation fails
    }
  };

  const loadGreige = async () => {
    try {
      setLoading(true);
      const greige = await greigeService.getById(id!);

      // Use stored genericFabricName if available, otherwise extract from greigeName for legacy data
      if (greige.genericFabricName) {
        setGenericFabricName(greige.genericFabricName);
      } else {
        // Fallback extraction for legacy data without stored genericFabricName
        const match = greige.greigeName.match(/^([A-Za-z\s]+?)(?:\s*\d|×)/);
        if (match) {
          setGenericFabricName(match[1].trim());
        } else {
          const fallback = greige.greigeName.split('/')[0].trim();
          setGenericFabricName(fallback);
        }
      }

      setFormData({
        greigeCode: greige.greigeCode,
        greigeName: greige.greigeName,
        composition: greige.composition,
        weaveType: greige.weaveType || '',
        yarnCount: greige.yarnCount || '',
        construction: greige.construction || '',
        greigeWidth: greige.greigeWidth,
        expectedFinishedWidthMin: greige.expectedFinishedWidthMin,
        expectedFinishedWidthMax: greige.expectedFinishedWidthMax,
        averageShrinkagePercent: greige.averageShrinkagePercent,
        gsmRange: greige.gsmRange || '',
        description: greige.description || '',
        notes: greige.notes || '',
        isActive: greige.isActive,
        suppliers: greige.suppliers?.map((s: { supplier: { id: string }; isPreferred: boolean; isActive: boolean; notes?: string }) => ({
          supplierId: s.supplier.id,
          isPreferred: s.isPreferred,
          isActive: s.isActive,
          notes: s.notes || '',
        })) || [],
      });
    } catch (error) {
      logError('Error loading greige:', error);
      alert('Failed to load greige master');
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      // Get token from Zustand auth store
      const authStorage = localStorage.getItem('auth-storage');
      let token = null;
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          token = parsed.state?.token || null;
        } catch (e) {
          logError('Error parsing auth storage:', e);
        }
      }

      const response = await fetch(`${API_URL}/suppliers?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setSuppliers(data.data || []);
    } catch (error) {
      logError('Error loading suppliers:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddSupplier = () => {
    setFormData(prev => ({
      ...prev,
      suppliers: [...prev.suppliers, { supplierId: '', isPreferred: false, isActive: true, notes: '' }],
    }));
  };

  const handleRemoveSupplier = (index: number) => {
    setFormData(prev => ({
      ...prev,
      suppliers: prev.suppliers.filter((_, i) => i !== index),
    }));
  };

  const handleSupplierChange = (index: number, field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      suppliers: prev.suppliers.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!genericFabricName) {
      alert('Please enter a Generic Fabric Name');
      return;
    }

    if (!formData.greigeCode || !formData.greigeName || !formData.composition || !formData.greigeWidth) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.greigeWidth <= 0) {
      alert('Greige width must be greater than 0');
      return;
    }

    try {
      setSaving(true);
      // Include genericFabricName in the data sent to API
      const dataToSave = { ...formData, genericFabricName };
      if (mode === 'edit' && id) {
        await greigeService.update(id, dataToSave);
        alert('Greige master updated successfully');
      } else {
        await greigeService.create(dataToSave);
        alert('Greige master created successfully');
      }
      navigate('/greige');
    } catch (error: unknown) {
      logError('Error saving greige:', error);
      alert(error.response?.data?.error || 'Failed to save greige master');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={mode === 'edit' ? 'Edit Greige Master' : 'New Greige Master'} />

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                Greige Code <span className="text-red-500">*</span>
                {mode === 'create' && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Auto-generated</span>
                )}
              </label>
              <Input
                type="text"
                name="greigeCode"
                value={formData.greigeCode}
                onChange={handleChange}
                placeholder="e.g., GRG-0001"
                required
                readOnly={mode === 'create'}
                className={mode === 'create' ? 'bg-gray-50 cursor-not-allowed' : ''}
              />
              {mode === 'create' && (
                <p className="text-xs text-gray-500 mt-1">Format: GRG-XXXX (automatically assigned)</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Generic Fabric Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={genericFabricName}
                onChange={(e) => setGenericFabricName(e.target.value)}
                placeholder="e.g., Cambric, Poplin, Denim, Jersey"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Common fabric type (e.g., Cambric, Poplin, Twill)</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                Greige Name <span className="text-red-500">*</span>
                {mode === 'create' && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Auto-generated</span>
                )}
              </label>
              <Input
                type="text"
                name="greigeName"
                value={formData.greigeName}
                onChange={handleChange}
                placeholder='Will be auto-generated: e.g., Cambric 40×40 / 92×88 / 63"'
                required
                readOnly={mode === 'create'}
                className={mode === 'create' ? 'bg-gray-50 cursor-not-allowed' : ''}
              />
              {mode === 'create' && (
                <p className="text-xs text-gray-500 mt-1">
                  Format: Generic Name + Yarn Count / Construction / Width
                  {genericFabricName && formData.yarnCount && formData.construction && formData.greigeWidth && (
                    <span className="block mt-1 text-green-600 font-medium">
                      Preview: {genericFabricName} {formData.yarnCount} / {formData.construction} / {formData.greigeWidth}"
                    </span>
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Yarn Count
              </label>
              <Input
                type="text"
                name="yarnCount"
                value={formData.yarnCount}
                onChange={handleChange}
                placeholder="e.g., 40x40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Construction
              </label>
              <Input
                type="text"
                name="construction"
                value={formData.construction}
                onChange={handleChange}
                placeholder="e.g., 133x72"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Composition <span className="text-red-500">*</span>
              </label>
              <textarea
                name="composition"
                value={formData.composition}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 100% Cotton"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weave Type
              </label>
              <select
                name="weaveType"
                value={formData.weaveType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                <option value="Plain">Plain</option>
                <option value="Twill">Twill</option>
                <option value="Satin">Satin</option>
                <option value="Jersey">Jersey</option>
                <option value="Rib">Rib</option>
                <option value="Interlock">Interlock</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GSM Range
              </label>
              <Input
                type="text"
                name="gsmRange"
                value={formData.gsmRange}
                onChange={handleChange}
                placeholder="e.g., 120-140"
              />
            </div>
          </div>
        </div>

        {/* Width & Shrinkage */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Width & Shrinkage</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Greige Width (inches) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                name="greigeWidth"
                value={formData.greigeWidth || ''}
                onChange={handleChange}
                placeholder="e.g., 60"
                step="0.1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Average Shrinkage (%) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                name="averageShrinkagePercent"
                value={formData.averageShrinkagePercent}
                onChange={handleChange}
                placeholder="e.g., 8.0"
                step="0.1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Finished Width Min (inches)
              </label>
              <Input
                type="number"
                name="expectedFinishedWidthMin"
                value={formData.expectedFinishedWidthMin || ''}
                onChange={handleChange}
                placeholder="e.g., 54"
                step="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Finished Width Max (inches)
              </label>
              <Input
                type="number"
                name="expectedFinishedWidthMax"
                value={formData.expectedFinishedWidthMax || ''}
                onChange={handleChange}
                placeholder="e.g., 58"
                step="0.1"
              />
            </div>
          </div>
        </div>

        {/* Suppliers */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Suppliers</h3>
            <Button type="button" variant="outline" size="sm" onClick={handleAddSupplier}>
              + Add Supplier
            </Button>
          </div>

          {formData.suppliers.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500">No suppliers added yet. Click "Add Supplier" to add one.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {formData.suppliers.map((supplier, index) => (
                <div key={index} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Supplier <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={supplier.supplierId}
                        onChange={(e) => handleSupplierChange(index, 'supplierId', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select supplier...</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.code} - {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-6">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={supplier.isPreferred}
                          onChange={(e) => handleSupplierChange(index, 'isPreferred', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Preferred Supplier</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={supplier.isActive}
                          onChange={(e) => handleSupplierChange(index, 'isActive', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Active</span>
                      </label>
                    </div>

                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveSupplier(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <Input
                        type="text"
                        value={supplier.notes}
                        onChange={(e) => handleSupplierChange(index, 'notes', e.target.value)}
                        placeholder="Optional notes about this supplier..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Additional Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter detailed description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Internal notes..."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-900">
                Active
              </label>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/greige')}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : mode === 'edit' ? 'Update Greige' : 'Create Greige'}
          </Button>
        </div>
      </form>
    </>
  );
}
