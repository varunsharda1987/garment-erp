import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import MaterialCategoryFields from '../components/material/MaterialCategoryFields';
import {
  createMaterial,
  getMaterialById,
  updateMaterial,
  getParentCategories,
  getChildCategories,
} from '../services/material.service';
import { getAllSuppliers } from '../services/supplier.service';
import { searchHSNSACMasters } from '../services/hsnSacMaster.service';
import { Unit, UnitLabels } from '../types/material.types';
import type { CreateMaterialRequest, MaterialCategory, SupplierRelationship } from '../types/material.types';
import type { HSNSACSearchResult } from '../types/hsnSacMaster.types';
import type { Supplier } from '../types/supplier.types';
import { logError } from '../lib/logger';
import { getRelevantSupplierCategories } from '../lib/supplier-category-mapping';

interface MaterialFormProps {
  mode?: 'create' | 'edit';
}

export default function MaterialForm({ mode = 'create' }: MaterialFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parentCategories, setParentCategories] = useState<MaterialCategory[]>([]);
  const [childCategories, setChildCategories] = useState<MaterialCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | ''>('');
  const [selectedParentCategoryId, setSelectedParentCategoryId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [materialSuppliers, setMaterialSuppliers] = useState<SupplierRelationship[]>([]);
  const [categoryData, setCategoryData] = useState<Record<string, string | number | boolean | null | undefined>>({});

  // HSN autocomplete state
  const [hsnSearch, setHsnSearch] = useState('');
  const [hsnResults, setHsnResults] = useState<HSNSACSearchResult[]>([]);
  const [hsnDropdownOpen, setHsnDropdownOpen] = useState(false);
  const [selectedGstRate, setSelectedGstRate] = useState('');
  const hsnDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateMaterialRequest>();

  const searchHSN = useCallback(async (query: string) => {
    if (query.length < 2) {
      setHsnResults([]);
      return;
    }
    try {
      const results = await searchHSNSACMasters({ search: query, type: 'HSN', limit: 10 });
      setHsnResults(results);
      setHsnDropdownOpen(true);
    } catch {
      setHsnResults([]);
    }
  }, []);

  const handleHsnSearchChange = useCallback(
    (value: string) => {
      setHsnSearch(value);
      setValue('hsnCode', value);
      if (hsnDebounceRef.current) clearTimeout(hsnDebounceRef.current);
      hsnDebounceRef.current = setTimeout(() => searchHSN(value), 300);
    },
    [searchHSN, setValue]
  );

  const selectHsnCode = useCallback(
    (item: HSNSACSearchResult) => {
      setHsnSearch(item.code);
      setValue('hsnCode', item.code);
      const rate = String(Number(item.defaultGstRate));
      setValue('gstRate', rate);
      setSelectedGstRate(rate);
      setHsnDropdownOpen(false);
    },
    [setValue]
  );

  // Get filtered suppliers based on selected material category
  const filteredSuppliers = (() => {
    const selectedCategory = childCategories.find((c) => c.id === selectedCategoryId);
    if (!selectedCategory) {
      return suppliers; // Show all if no category selected
    }

    const relevantCategories = getRelevantSupplierCategories(selectedCategory.name);
    if (relevantCategories.length === 0) {
      return suppliers; // Show all if no mapping defined
    }

    return suppliers.filter((s) => (s.supplierCategories || []).some((cat) => relevantCategories.includes(cat)));
  })();

  const isNewMaterial = mode === 'create' || !id;

  // Auto-generate material code for new materials
  useEffect(() => {
    if (isNewMaterial) {
      const generateCode = () => {
        const timestamp = Date.now().toString().slice(-6);
        const randomNum = Math.floor(Math.random() * 100)
          .toString()
          .padStart(2, '0');
        return `MAT${timestamp}${randomNum}`;
      };
      setValue('code', generateCode());
    }
  }, [isNewMaterial, setValue]);

  // Load parent categories and suppliers
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [parentsData, suppliersData] = await Promise.all([
          getParentCategories(),
          getAllSuppliers({ limit: 100 }),
        ]);
        setParentCategories(parentsData);
        setSuppliers(suppliersData.data);
      } catch (err) {
        logError('Failed to fetch data:', err);
      }
    };
    fetchData();
  }, []);

  // Load child categories when parent changes
  useEffect(() => {
    if (selectedParentCategoryId) {
      const fetchChildren = async () => {
        try {
          const children = await getChildCategories(selectedParentCategoryId);
          setChildCategories(children);
        } catch (err) {
          logError('Failed to fetch child categories:', err);
        }
      };
      fetchChildren();
    } else {
      setChildCategories([]);
      setSelectedCategoryId('');
    }
  }, [selectedParentCategoryId]);

  // Load material data for edit mode
  useEffect(() => {
    if (!isNewMaterial && id) {
      const fetchMaterial = async () => {
        try {
          setIsLoading(true);
          const material = await getMaterialById(id);

          setValue('code', material.code);
          setValue('name', material.name);
          setValue('categoryId', material.categoryId);
          setSelectedCategoryId(material.categoryId);

          // Set parent category if category has parent
          if (material.category?.parentCategoryId) {
            setSelectedParentCategoryId(material.category.parentCategoryId);
          }

          setValue('description', material.description || '');
          setValue('specifications', material.specifications || '');
          setValue('unit', material.unit);
          setSelectedUnit(material.unit);
          setValue('reorderLevel', material.reorderLevel?.toString() || '');
          setValue('hsnCode', material.hsnCode || '');
          setHsnSearch(material.hsnCode || '');
          const gstRateStr = material.gstRate?.toString() || '';
          setValue('gstRate', gstRateStr);
          setSelectedGstRate(gstRateStr);

          // Load suppliers
          if (material.supplier && material.supplier.length > 0) {
            setMaterialSuppliers(
              material.supplier.map(
                (s: {
                  supplier: { id: string };
                  isPreferred: boolean;
                  isActive: boolean;
                  notes?: string | null;
                  supplierPrice?: number | null;
                  leadTimeDays?: number | null;
                  moq?: number | null;
                  moqUnit?: string | null;
                  isPrimary?: boolean;
                }) => ({
                  supplierId: s.supplier.id,
                  isPreferred: s.isPreferred,
                  isActive: s.isActive,
                  notes: s.notes || '',
                  supplierPrice: s.supplierPrice ?? null,
                  leadTimeDays: s.leadTimeDays ?? null,
                  moq: s.moq ?? null,
                  moqUnit: s.moqUnit || '',
                  isPrimary: s.isPrimary || false,
                })
              )
            );
          }

          if (material.categoryData) {
            setCategoryData(material.categoryData);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load material';
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchMaterial();
    }
  }, [id, isNewMaterial, setValue]);

  const handleAddSupplier = () => {
    setMaterialSuppliers((prev) => [...prev, { supplierId: '', isPreferred: false, isActive: true, notes: '' }]);
  };

  const handleRemoveSupplier = (index: number) => {
    setMaterialSuppliers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSupplierChange = (index: number, field: string, value: string | boolean | number | null) => {
    setMaterialSuppliers((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const onSubmit = async (data: CreateMaterialRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!selectedUnit) {
        setError('Please select a unit');
        setIsLoading(false);
        return;
      }

      if (!selectedCategoryId) {
        setError('Please select a category');
        setIsLoading(false);
        return;
      }

      const payload: CreateMaterialRequest = {
        ...data,
        categoryId: selectedCategoryId,
        unit: selectedUnit as Unit,
        suppliers: materialSuppliers.length > 0 ? materialSuppliers : undefined,
        reorderLevel: data.reorderLevel ? Number(data.reorderLevel) : undefined,
        hsnCode: data.hsnCode || undefined,
        gstRate: data.gstRate ? Number(data.gstRate) : undefined,
        categoryData:
          Object.keys(categoryData).length > 0
            ? (Object.fromEntries(Object.entries(categoryData).filter(([, v]) => v !== undefined)) as Record<
                string,
                string | number | boolean | null
              >)
            : undefined,
      };

      if (isNewMaterial) {
        await createMaterial(payload);
      } else if (id) {
        await updateMaterial(id, payload);
      }

      navigate('/materials');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : `Failed to ${isNewMaterial ? 'create' : 'update'} material`;
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewMaterial) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading material...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>{isNewMaterial ? 'Create New Material' : 'Edit Material'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && <div className="bg-destructive/10 text-destructive p-4 rounded-md">{error}</div>}

            {/* MATERIAL INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-foreground">Material Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Parent Category Selector */}
                <div>
                  <Label htmlFor="parentCategoryId">Category Type *</Label>
                  <Select value={selectedParentCategoryId} onValueChange={setSelectedParentCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category type" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Child Category Selector */}
                <div>
                  <Label htmlFor="categoryId">Material Category *</Label>
                  <Select
                    value={selectedCategoryId}
                    onValueChange={(value) => {
                      setSelectedCategoryId(value);
                      setValue('categoryId', value);
                    }}
                    disabled={!selectedParentCategoryId}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          selectedParentCategoryId ? 'Select material category' : 'Select category type first'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {childCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="name">Material Name *</Label>
                  <Input
                    id="name"
                    {...register('name', { required: 'Material name is required' })}
                    placeholder="e.g., Metal Button, Poly Thread"
                  />
                  {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <Label htmlFor="code">Material Code *</Label>
                  <Input
                    id="code"
                    {...register('code', { required: 'Material code is required' })}
                    readOnly
                    className="bg-muted"
                  />
                  {errors.code && <p className="text-sm text-destructive mt-1">{errors.code.message}</p>}
                </div>

                <div>
                  <Label htmlFor="unit">Unit *</Label>
                  <Select value={selectedUnit} onValueChange={(value) => setSelectedUnit(value as Unit)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(UnitLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="reorderLevel">Reorder Level</Label>
                  <Input
                    id="reorderLevel"
                    type="number"
                    {...register('reorderLevel')}
                    placeholder="Minimum stock level"
                  />
                </div>
              </div>
            </div>

            {/* CATEGORY-SPECIFIC FIELDS */}
            {selectedCategoryId && childCategories.find((c) => c.id === selectedCategoryId) && (
              <div className="border-t pt-6">
                <MaterialCategoryFields
                  categoryName={childCategories.find((c) => c.id === selectedCategoryId)?.name || ''}
                  data={categoryData}
                  onChange={setCategoryData}
                />
              </div>
            )}

            {/* SUPPLIERS */}
            <div className="border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">Suppliers</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddSupplier}>
                  + Add Supplier
                </Button>
              </div>

              {materialSuppliers.length === 0 ? (
                <div className="text-center py-8 bg-muted rounded-lg border-2 border-dashed border-border">
                  <p className="text-muted-foreground">No suppliers added yet. Click "Add Supplier" to add one.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {materialSuppliers.map((supplier, index) => (
                    <div key={index} className="border border-border rounded-lg p-4 bg-muted">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <Label>Supplier *</Label>
                          <Select
                            value={supplier.supplierId}
                            onValueChange={(value) => handleSupplierChange(index, 'supplierId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select supplier..." />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredSuppliers.length === 0 ? (
                                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                  No relevant suppliers found for this material category
                                </div>
                              ) : (
                                filteredSuppliers.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.code} - {s.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-6">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={supplier.isPreferred}
                              onChange={(e) => handleSupplierChange(index, 'isPreferred', e.target.checked)}
                              className="h-4 w-4 text-info focus:ring-blue-500 border-border rounded"
                            />
                            <span className="ml-2 text-sm text-foreground">Preferred Supplier</span>
                          </label>

                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={supplier.isActive}
                              onChange={(e) => handleSupplierChange(index, 'isActive', e.target.checked)}
                              className="h-4 w-4 text-info focus:ring-blue-500 border-border rounded"
                            />
                            <span className="ml-2 text-sm text-foreground">Active</span>
                          </label>
                        </div>

                        <div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveSupplier(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            Remove
                          </Button>
                        </div>

                        <div>
                          <Label>Supplier Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={supplier.supplierPrice ?? ''}
                            onChange={(e) =>
                              handleSupplierChange(
                                index,
                                'supplierPrice',
                                e.target.value ? Number(e.target.value) : null
                              )
                            }
                            placeholder="Price per unit"
                          />
                        </div>

                        <div>
                          <Label>Lead Time (days)</Label>
                          <Input
                            type="number"
                            value={supplier.leadTimeDays ?? ''}
                            onChange={(e) =>
                              handleSupplierChange(
                                index,
                                'leadTimeDays',
                                e.target.value ? Number(e.target.value) : null
                              )
                            }
                            placeholder="Lead time in days"
                          />
                        </div>

                        <div>
                          <Label>MOQ</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={supplier.moq ?? ''}
                            onChange={(e) =>
                              handleSupplierChange(index, 'moq', e.target.value ? Number(e.target.value) : null)
                            }
                            placeholder="Minimum order quantity"
                          />
                        </div>

                        <div>
                          <Label>MOQ Unit</Label>
                          <Input
                            type="text"
                            value={supplier.moqUnit || ''}
                            onChange={(e) => handleSupplierChange(index, 'moqUnit', e.target.value)}
                            placeholder="e.g., PCS, MTR, KG"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <Label>Notes</Label>
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

            {/* HSN & GST */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Tax Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Label htmlFor="hsnCode">HSN Code</Label>
                  <Input
                    id="hsnCode"
                    value={hsnSearch}
                    onChange={(e) => handleHsnSearchChange(e.target.value)}
                    onFocus={() => hsnSearch.length >= 2 && setHsnDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setHsnDropdownOpen(false), 200)}
                    placeholder="Search HSN code..."
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Type to search HSN codes from master data</p>
                  {hsnDropdownOpen && hsnResults.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {hsnResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-muted text-sm flex justify-between items-center"
                          onMouseDown={() => selectHsnCode(item)}
                        >
                          <span>
                            <span className="font-mono font-medium">{item.code}</span>
                            <span className="text-muted-foreground ml-2 text-xs">{item.description}</span>
                          </span>
                          <span className="text-xs font-medium text-info">{Number(item.defaultGstRate)}%</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="gstRate">GST Rate (%)</Label>
                  <Select
                    value={selectedGstRate}
                    onValueChange={(val) => {
                      setSelectedGstRate(val);
                      setValue('gstRate', val);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select GST rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Auto (from HSN)</SelectItem>
                      <SelectItem value="0">0% (Exempt)</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="18">18%</SelectItem>
                      <SelectItem value="28">28%</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" {...register('gstRate')} />
                  <p className="text-xs text-muted-foreground mt-1">Auto-filled from HSN code, or select manually</p>
                </div>
              </div>
            </div>

            {/* DESCRIPTION & SPECIFICATIONS */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Additional Information</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    rows={3}
                    placeholder="Brief description of the material"
                  />
                </div>

                <div>
                  <Label htmlFor="specifications">Specifications</Label>
                  <Textarea
                    id="specifications"
                    {...register('specifications')}
                    rows={3}
                    placeholder="Technical specifications, dimensions, etc."
                  />
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-4 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => navigate('/materials')} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isNewMaterial ? 'Create Material' : 'Update Material'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
