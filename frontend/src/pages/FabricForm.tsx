import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { fabricService, greigeService } from '../services/fabricGreigeService';
import type { FabricMaster, FabricMasterFormData, GreigeMaster } from '../types/fabric-greige.types';
import { logError } from '../lib/logger';
import { notify } from '../lib/notify';
import { API_URL } from '../config/api.config';
import ColorPicker from '../components/ColorPicker';
import type { ColorSearchResult } from '../types/color.types';
import { GenericFabricSelector } from '../components/GenericFabricSelector';

type FabricSource = 'style_linked' | 'ready_purchase' | 'stock';

interface Style {
  id: string;
  styleCode: string;
  styleName: string;
}

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

  // New state for fabric source and styles
  const [fabricSource, setFabricSource] = useState<FabricSource>('stock');
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [selectedStyleCode, setSelectedStyleCode] = useState<string>('');

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

  // Helper function to get auth token
  const getAuthToken = useCallback(() => {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      try {
        const parsed = JSON.parse(authStorage);
        return parsed.state?.token || null;
      } catch (e) {
        logError('Error parsing auth storage:', e);
      }
    }
    return null;
  }, []);

  // Load styles for style_linked source
  const loadStyles = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/styles?limit=200&isActive=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setStyles(data.data || []);
    } catch (error) {
      logError('Error loading styles:', error);
    }
  }, [getAuthToken]);

  // Fetch next fabric code from backend
  const fetchNextFabricCode = useCallback(async (source: FabricSource, styleCode?: string) => {
    try {
      const token = getAuthToken();
      let url = `${API_URL}/fabric-management/fabric/next-code?source=${source}`;
      if (source === 'style_linked' && styleCode) {
        url += `&styleCode=${styleCode}`;
      }
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      return data.nextCode || '';
    } catch (error) {
      logError('Error fetching next fabric code:', error);
      return '';
    }
  }, [getAuthToken]);

  // Generate fabric name based on selected fields
  const generateFabricName = useCallback(() => {
    const parts: string[] = [];

    // Add style code for style_linked
    if (fabricSource === 'style_linked' && selectedStyleCode) {
      parts.push(selectedStyleCode);
    }

    // Add greige name or generic fabric name
    if (formData.greigeId) {
      const greige = greigeMasters.find(g => g.id === formData.greigeId);
      if (greige) {
        // Extract fabric type from greige name (e.g., "Cambric 40×40" → "Cambric")
        const match = greige.greigeName.match(/^([A-Za-z\s]+?)(?:\s*\d|×)/);
        const fabricType = match ? match[1].trim() : greige.greigeName.split('/')[0].trim();
        parts.push(fabricType);
      }
    } else if (formData.genericFabricName) {
      parts.push(formData.genericFabricName);
    }

    // Add finish type display
    const finishDisplay = getFinishTypeDisplay(formData.finishType);
    if (finishDisplay) {
      parts.push(finishDisplay);
    }

    // Add color
    if (formData.colorName) {
      parts.push(formData.colorName);
    }

    // Add width
    if (formData.actualWidth) {
      parts.push(`${formData.actualWidth}"`);
    }

    return parts.join(' - ');
  }, [fabricSource, selectedStyleCode, formData.greigeId, formData.genericFabricName, formData.finishType, formData.colorName, formData.actualWidth, greigeMasters]);

  // Helper to get finish type display text
  const getFinishTypeDisplay = (finishType: string): string => {
    switch (finishType) {
      case 'solid':
      case 'reactive':
      case 'pigment':
        return 'Dyed';
      case 'printed':
        return 'Printed';
      case 'yarn_dyed':
        return 'Yarn Dyed';
      default:
        return '';
    }
  };

  useEffect(() => {
    if (mode === 'edit' && id) {
      loadFabric();
    }
    loadGreigeMasters();
    loadSuppliers();
    loadStyles();
  }, [mode, id]);

  // Auto-generate fabric code when source or style changes (create mode only)
  useEffect(() => {
    if (mode === 'create') {
      const generateCode = async () => {
        if (fabricSource === 'style_linked') {
          if (selectedStyleCode) {
            const code = await fetchNextFabricCode(fabricSource, selectedStyleCode);
            setFormData(prev => ({ ...prev, fabricCode: code }));
          }
        } else {
          const code = await fetchNextFabricCode(fabricSource);
          setFormData(prev => ({ ...prev, fabricCode: code }));
        }
      };
      generateCode();
    }
  }, [mode, fabricSource, selectedStyleCode, fetchNextFabricCode]);

  // Auto-generate fabric name when relevant fields change (create mode only)
  useEffect(() => {
    if (mode === 'create') {
      const generatedName = generateFabricName();
      if (generatedName) {
        setFormData(prev => ({ ...prev, fabricName: generatedName }));
      }
    }
  }, [mode, generateFabricName]);

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
      notify.error('Failed to load fabric master');
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
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/suppliers?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setSuppliers(data.data || []);
    } catch (error) {
      logError('Error loading suppliers:', error);
    }
  };

  // Handle fabric source change
  const handleFabricSourceChange = (newSource: FabricSource) => {
    setFabricSource(newSource);
    // Reset style selection when changing source
    if (newSource !== 'style_linked') {
      setSelectedStyleId('');
      setSelectedStyleCode('');
    }
    // Set isGeneric based on source
    setFormData(prev => ({
      ...prev,
      isGeneric: newSource === 'stock',
    }));
  };

  // Handle style selection
  const handleStyleChange = (styleId: string) => {
    setSelectedStyleId(styleId);
    const style = styles.find(s => s.id === styleId);
    setSelectedStyleCode(style?.styleCode || '');
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

    // Validation based on fabric source
    const missingFields: string[] = [];

    // Source-specific validation
    if (fabricSource === 'style_linked') {
      if (!selectedStyleId) missingFields.push('Style');
      if (!formData.greigeId) missingFields.push('Greige Base');
    } else {
      // Ready Purchase or Stock - require generic fabric name if no greige
      if (!formData.greigeId && !formData.genericFabricName) {
        missingFields.push('Generic Fabric Name (or select a Greige Base)');
      }
    }

    // Common validation
    if (!formData.fabricCode) missingFields.push('Fabric Code');
    if (!formData.fabricName) missingFields.push('Fabric Name');
    if (!formData.finishType) missingFields.push('Finish Type');
    if (!formData.actualWidth) missingFields.push('Actual Width');

    if (missingFields.length > 0) {
      notify.error(`Please fill in: ${missingFields.join(', ')}`);
      return;
    }

    if (formData.actualWidth <= 0) {
      notify.error('Actual width must be greater than 0');
      return;
    }

    try {
      setSaving(true);
      if (mode === 'edit' && id) {
        await fabricService.update(id, formData);
        notify.success('Fabric master updated successfully');
      } else {
        await fabricService.create(formData);
        notify.success('Fabric master created successfully');
      }
      navigate('/fabric');
    } catch (error: unknown) {
      logError('Error saving fabric:', error);
      notify.error((error as any).response?.data?.error || 'Failed to save fabric master');
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
            {/* Fabric Source - First field */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fabric Source <span className="text-red-500">*</span>
              </label>
              <select
                value={fabricSource}
                onChange={(e) => handleFabricSourceChange(e.target.value as FabricSource)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={mode === 'edit'}
              >
                <option value="style_linked">Style-Linked (from Greige processing)</option>
                <option value="ready_purchase">Ready Purchase (from Vendor)</option>
                <option value="stock">Stock/Generic Fabric</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {fabricSource === 'style_linked' && 'Fabric processed from greige for a specific style order'}
                {fabricSource === 'ready_purchase' && 'Ready processed fabric purchased directly from vendor'}
                {fabricSource === 'stock' && 'General inventory fabric not tied to a specific style'}
              </p>
            </div>

            {/* Style dropdown - only for style_linked */}
            {fabricSource === 'style_linked' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Style <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedStyleId}
                  onChange={(e) => handleStyleChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select style...</option>
                  {styles.map(style => (
                    <option key={style.id} value={style.id}>
                      {style.styleCode} - {style.styleName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fabric Code <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                name="fabricCode"
                value={formData.fabricCode}
                onChange={handleChange}
                placeholder="e.g., FAB-STY001-001"
                required
                readOnly={mode === 'create'}
                className={mode === 'create' ? 'bg-gray-50' : ''}
              />
              <p className="text-xs text-gray-500 mt-1">
                {mode === 'create' ? 'Auto-generated based on fabric source' : 'Unique fabric identifier'}
              </p>
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
                placeholder='e.g., STY-001 - Cambric - Dyed - Navy Blue - 56"'
                required
                readOnly={mode === 'create'}
                className={mode === 'create' ? 'bg-gray-50' : ''}
              />
              <p className="text-xs text-gray-500 mt-1">
                {mode === 'create' ? 'Auto-generated from selected fields' : 'Descriptive fabric name'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Greige Base {fabricSource === 'style_linked' && <span className="text-red-500">*</span>}
              </label>
              <select
                name="greigeId"
                value={formData.greigeId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={fabricSource === 'style_linked'}
              >
                <option value="">Select greige fabric...</option>
                {greigeMasters.map(greige => (
                  <option key={greige.id} value={greige.id}>
                    {greige.greigeCode} - {greige.greigeName} ({Number(greige.greigeWidth)}")
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {fabricSource === 'style_linked' ? 'Required - Select the source greige' : 'Optional - Select if processing from greige'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Generic Fabric Name {(fabricSource !== 'style_linked' && !formData.greigeId) && <span className="text-red-500">*</span>}
              </label>
              <GenericFabricSelector
                value={formData.genericFabricName}
                onChange={(value) => setFormData(prev => ({ ...prev, genericFabricName: value }))}
                label=""
                placeholder="Search or type fabric name..."
                required={fabricSource !== 'style_linked' && !formData.greigeId}
              />
              <p className="text-xs text-gray-500 mt-1">
                {fabricSource === 'style_linked'
                  ? 'Auto-derived from greige selection'
                  : 'Required if no greige selected'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Finish Type (Dyed/Printed) <span className="text-red-500">*</span>
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
              <p className="text-xs text-gray-500 mt-1">How the fabric was processed</p>
            </div>

            {/* Print Design - only shown when finish type is printed */}
            {formData.finishType === 'printed' && (
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
                <p className="text-xs text-gray-500 mt-1">Pattern or design reference</p>
              </div>
            )}

            {/* Component Type - only shown for style_linked */}
            {fabricSource === 'style_linked' && (
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
                <p className="text-xs text-gray-500 mt-1">Which garment component this fabric is for</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                Cutable Width (inches)
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Auto-calculated</span>
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
              <p className="text-xs text-gray-500 mt-1">Grams per square meter</p>
            </div>

            {/* isGeneric is now automatically set based on fabricSource */}
            <div className="hidden">
              <input
                type="checkbox"
                name="isGeneric"
                checked={formData.isGeneric}
                onChange={handleChange}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            <div className="flex items-center pt-6">
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

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description / Notes
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter description or notes about this fabric..."
              />
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
