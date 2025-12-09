import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { fabricService, greigeService } from '../services/fabricGreigeService';
import type { FabricMaster, FabricMasterFormData, GreigeMaster } from '../types/fabric-greige.types';
import { logError } from '../lib/logger';
import { API_URL } from '../config/api.config';
import ColorPicker from '../components/ColorPicker';
import type { ColorSearchResult } from '../types/color.types';

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
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FabricMasterFormData>({
    fabricCode: '',
    fabricName: '',
    greigeId: '',
    genericFabricName: '',
    colorName: '',
    colorCode: '',
    finishType: 'solid',
    printDesign: '',
    actualWidth: 0,
    cutableWidth: 0,
    finishedConstruction: '',
    actualGSM: undefined,
    valueAddition: '',
    valueAdditionCost: undefined,
    styleReference: '',
    componentType: '',
    description: '',
    notes: '',
    imageUrl: '',
    isGeneric: false,
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
      const fabric = await fabricService.getById(id!);
      setFormData({
        fabricCode: fabric.fabricCode,
        fabricName: fabric.fabricName,
        greigeId: fabric.greigeId,
        genericFabricName: fabric.genericFabricName || '',
        colorName: fabric.colorName || '',
        colorCode: fabric.colorCode || '',
        finishType: fabric.finishType || 'solid',
        printDesign: fabric.printDesign || '',
        actualWidth: fabric.actualWidth,
        cutableWidth: fabric.cutableWidth || (fabric.actualWidth - 2),
        finishedConstruction: fabric.finishedConstruction || '',
        actualGSM: fabric.actualGSM,
        valueAddition: fabric.valueAddition || '',
        valueAdditionCost: fabric.valueAdditionCost,
        styleReference: fabric.styleReference || '',
        componentType: fabric.componentType || '',
        description: fabric.description || '',
        notes: fabric.notes || '',
        imageUrl: fabric.imageUrl || '',
        isGeneric: fabric.isGeneric || false,
        isActive: fabric.isActive,
        suppliers: fabric.suppliers?.map((s: { supplier: { id: string }; isPreferred: boolean; isActive: boolean; notes?: string }) => ({
          supplierId: s.supplier.id,
          isPreferred: s.isPreferred,
          isActive: s.isActive,
          notes: s.notes || '',
        })) || [],
      });
    } catch (error) {
      logError('Error loading fabric:', error);
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
      logError('Error loading greige masters:', error);
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
      const numValue = value === '' ? undefined : parseFloat(value);
      setFormData(prev => {
        const updated = { ...prev, [name]: numValue };

        // Auto-calculate cutableWidth when actualWidth changes
        if (name === 'actualWidth' && numValue) {
          updated.cutableWidth = numValue - 2;
        }

        return updated;
      });
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
    } catch (error: unknown) {
      logError('Error saving fabric:', error);
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
                Generic Fabric Name
              </label>
              <select
                name="genericFabricName"
                value={formData.genericFabricName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select fabric type...</option>
                <option value="Cambric">Cambric</option>
                <option value="Poplin">Poplin</option>
                <option value="Denim">Denim</option>
                <option value="Jersey">Jersey</option>
                <option value="Twill">Twill</option>
                <option value="Satin">Satin</option>
                <option value="Dobby">Dobby</option>
                <option value="Oxford">Oxford</option>
                <option value="Linen">Linen</option>
                <option value="Voile">Voile</option>
                <option value="Chiffon">Chiffon</option>
                <option value="Crepe">Crepe</option>
                <option value="Canvas">Canvas</option>
                <option value="Gabardine">Gabardine</option>
                <option value="Flannel">Flannel</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Simplified fabric type for naming</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Finish Type <span className="text-red-500">*</span>
              </label>
              <select
                name="finishType"
                value={formData.finishType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="solid">Solid/Dyed</option>
                <option value="printed">Printed</option>
                <option value="yarn_dyed">Yarn Dyed</option>
                <option value="reactive">Reactive Dyed</option>
                <option value="pigment">Pigment Dyed</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <Label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </Label>
              <ColorPicker
                value={selectedColorId}
                onChange={(colorId, color) => {
                  setSelectedColorId(colorId);
                  if (color) {
                    setFormData(prev => ({
                      ...prev,
                      colorName: color.colorName,
                      colorCode: color.hexCode || '',
                    }));
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      colorName: '',
                      colorCode: '',
                    }));
                  }
                }}
                showFamilyFilter={true}
                placeholder="Select color from master..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Select from Color Master or{' '}
                <a href="/colors/new" target="_blank" className="text-blue-600 hover:underline">
                  add a new color
                </a>
              </p>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Style Reference
              </label>
              <Input
                type="text"
                name="styleReference"
                value={formData.styleReference}
                onChange={handleChange}
                placeholder="e.g., STY-001 (if style-specific)"
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank for generic fabrics</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Component Type
              </label>
              <select
                name="componentType"
                value={formData.componentType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select component...</option>
                <option value="BODY">BODY</option>
                <option value="SLEEVE">SLEEVE</option>
                <option value="COLLAR">COLLAR</option>
                <option value="CUFF">CUFF</option>
                <option value="POCKET">POCKET</option>
                <option value="YOKE">YOKE</option>
                <option value="PLACKET">PLACKET</option>
                <option value="PANEL">PANEL</option>
                <option value="LINING">LINING</option>
              </select>
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
              <p className="text-xs text-gray-500 mt-1">Finished fabric width after processing</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cutable Width (inches)
              </label>
              <Input
                type="number"
                name="cutableWidth"
                value={formData.cutableWidth || ''}
                onChange={handleChange}
                placeholder="Auto-calculated: Actual Width - 2 inches"
                step="0.1"
              />
              <p className="text-xs text-gray-500 mt-1">Auto: Actual Width - 2 inches, can override</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Finished Construction
              </label>
              <Input
                type="text"
                name="finishedConstruction"
                value={formData.finishedConstruction}
                onChange={handleChange}
                placeholder="e.g., 96x92 (post-processing)"
              />
              <p className="text-xs text-gray-500 mt-1">Construction after finishing (may differ from greige)</p>
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
                Value Addition
              </label>
              <Input
                type="text"
                name="valueAddition"
                value={formData.valueAddition}
                onChange={handleChange}
                placeholder="e.g., Embroidery, Special Wash"
              />
              <p className="text-xs text-gray-500 mt-1">Additional processes applied to fabric</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value Addition Cost
              </label>
              <Input
                type="number"
                name="valueAdditionCost"
                value={formData.valueAdditionCost || ''}
                onChange={handleChange}
                placeholder="e.g., 15.00"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">Additional cost per meter for value addition</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Is Generic Fabric
              </label>
              <div className="flex items-center mt-2">
                <input
                  type="checkbox"
                  name="isGeneric"
                  checked={formData.isGeneric}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">
                  Can be used across multiple styles
                </label>
              </div>
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
