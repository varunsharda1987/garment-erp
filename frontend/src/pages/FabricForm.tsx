import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { fabricService, greigeService } from '../services/fabricGreigeService';
import type { FabricMaster, FabricMasterFormData, GreigeMaster } from '../types/fabric-greige.types';

interface FabricFormProps {
  mode?: 'create' | 'edit';
}

export default function FabricForm({ mode = 'create' }: FabricFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [greigeMasters, setGreigeMasters] = useState<GreigeMaster[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [formData, setFormData] = useState<FabricMasterFormData>({
    fabricCode: '',
    fabricName: '',
    greigeId: '',
    colorName: '',
    colorCode: '',
    finishType: 'solid',
    finishProcess: '',
    printDesign: '',
    actualWidth: 0,
    actualGSM: undefined,
    actualShrinkage: undefined,
    description: '',
    notes: '',
    imageUrl: '',
    isActive: true,
    suppliers: [],
  });

  useEffect(() => {
    if (mode === 'edit' && id) {
      loadFabric();
    }
    loadGreigeMasters();
    loadSuppliers();
  }, [mode, id]);

  const loadFabric = async () => {
    try {
      setLoading(true);
      const fabric: any = await fabricService.getById(id!);
      setFormData({
        fabricCode: fabric.fabricCode,
        fabricName: fabric.fabricName,
        greigeId: fabric.greigeId,
        colorName: fabric.colorName || '',
        colorCode: fabric.colorCode || '',
        finishType: fabric.finishType || 'solid',
        finishProcess: fabric.finishProcess || '',
        printDesign: fabric.printDesign || '',
        actualWidth: fabric.actualWidth,
        actualGSM: fabric.actualGSM,
        actualShrinkage: fabric.actualShrinkage,
        description: fabric.description || '',
        notes: fabric.notes || '',
        imageUrl: fabric.imageUrl || '',
        isActive: fabric.isActive,
        suppliers: fabric.suppliers?.map((s: any) => ({
          supplierId: s.supplier.id,
          isPreferred: s.isPreferred,
          isActive: s.isActive,
          notes: s.notes || '',
        })) || [],
      });
    } catch (error) {
      console.error('Error loading fabric:', error);
      alert('Failed to load fabric master');
    } finally {
      setLoading(false);
    }
  };

  const loadGreigeMasters = async () => {
    try {
      const response = await greigeService.getAll({ limit: 100, isActive: 'true' });
      setGreigeMasters(response.data);
    } catch (error) {
      console.error('Error loading greige masters:', error);
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
          console.error('Error parsing auth storage:', e);
        }
      }

      const response = await fetch('http://localhost:5000/api/suppliers?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setSuppliers(data.data || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
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

  const handleSupplierChange = (index: number, field: string, value: any) => {
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
    if (!formData.fabricCode || !formData.fabricName || !formData.greigeId || !formData.actualWidth) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.actualWidth <= 0) {
      alert('Actual width must be greater than 0');
      return;
    }

    try {
      setSaving(true);
      if (mode === 'edit' && id) {
        await fabricService.update(id, formData);
        alert('Fabric master updated successfully');
      } else {
        await fabricService.create(formData);
        alert('Fabric master created successfully');
      }
      navigate('/fabric');
    } catch (error: any) {
      console.error('Error saving fabric:', error);
      alert(error.response?.data?.error || 'Failed to save fabric master');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={mode === 'edit' ? 'Edit Fabric Master' : 'New Fabric Master'} />

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fabric Code <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                name="fabricCode"
                value={formData.fabricCode}
                onChange={handleChange}
                placeholder="e.g., FAB-001-COTTON-BLUE"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fabric Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                name="fabricName"
                value={formData.fabricName}
                onChange={handleChange}
                placeholder='e.g., Blue Cotton Poplin 56"'
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Greige Base <span className="text-red-500">*</span>
              </label>
              <select
                name="greigeId"
                value={formData.greigeId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select greige fabric...</option>
                {greigeMasters.map(greige => (
                  <option key={greige.id} value={greige.id}>
                    {greige.greigeCode} - {greige.greigeName} ({Number(greige.greigeWidth)}")
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Finish Type
              </label>
              <select
                name="finishType"
                value={formData.finishType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="solid">Solid/Dyed</option>
                <option value="printed">Printed</option>
                <option value="yarn_dyed">Yarn Dyed</option>
                <option value="reactive">Reactive Dyed</option>
                <option value="pigment">Pigment Dyed</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color Name
              </label>
              <Input
                type="text"
                name="colorName"
                value={formData.colorName}
                onChange={handleChange}
                placeholder="e.g., Navy Blue"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color Code
              </label>
              <Input
                type="text"
                name="colorCode"
                value={formData.colorCode}
                onChange={handleChange}
                placeholder="e.g., PMS 2965C"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Finish Process
              </label>
              <Input
                type="text"
                name="finishProcess"
                value={formData.finishProcess}
                onChange={handleChange}
                placeholder="e.g., Enzyme Wash, Sanforized"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Print Design
              </label>
              <Input
                type="text"
                name="printDesign"
                value={formData.printDesign}
                onChange={handleChange}
                placeholder="e.g., Floral Pattern #123"
              />
            </div>
          </div>
        </div>

        {/* Fabric Specifications */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Fabric Specifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Actual Width (inches) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                name="actualWidth"
                value={formData.actualWidth || ''}
                onChange={handleChange}
                placeholder="e.g., 56"
                step="0.1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Actual GSM
              </label>
              <Input
                type="number"
                name="actualGSM"
                value={formData.actualGSM || ''}
                onChange={handleChange}
                placeholder="e.g., 140"
                step="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Actual Shrinkage (%)
              </label>
              <Input
                type="number"
                name="actualShrinkage"
                value={formData.actualShrinkage || ''}
                onChange={handleChange}
                placeholder="e.g., 8.5"
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
                Image URL
              </label>
              <Input
                type="text"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleChange}
                placeholder="https://example.com/fabric-image.jpg"
              />
            </div>

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
            onClick={() => navigate('/fabric')}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : mode === 'edit' ? 'Update Fabric' : 'Create Fabric'}
          </Button>
        </div>
      </form>
    </>
  );
}
