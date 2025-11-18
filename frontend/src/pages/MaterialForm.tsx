import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import MaterialCategoryFields from '../components/material/MaterialCategoryFields';
import { createMaterial, getMaterialById, updateMaterial, getParentCategories, getChildCategories } from '../services/material.service';
import { getAllSuppliers } from '../services/supplier.service';
import { Unit, UnitLabels } from '../types/material.types';
import type { CreateMaterialRequest, MaterialCategory } from '../types/material.types';
import type { Supplier } from '../types/supplier.types';

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
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [categoryData, setCategoryData] = useState<any>({});

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateMaterialRequest>();

  const isNewMaterial = mode === 'create' || !id;

  // Auto-generate material code for new materials
  useEffect(() => {
    if (isNewMaterial) {
      const generateCode = () => {
        const timestamp = Date.now().toString().slice(-6);
        const randomNum = Math.floor(Math.random() * 100).toString().padStart(2, '0');
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
        console.error('Failed to fetch data:', err);
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
          console.error('Failed to fetch child categories:', err);
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
          setValue('costPrice', material.costPrice.toString());
          setValue('reorderLevel', material.reorderLevel?.toString() || '');
          setValue('supplierId', material.supplierId || '');
          setSelectedSupplierId(material.supplierId || '');
          if (material.categoryData) {
            setCategoryData(material.categoryData);
          }
        } catch (err: any) {
          setError(err.response?.data?.message || 'Failed to load material');
        } finally {
          setIsLoading(false);
        }
      };
      fetchMaterial();
    }
  }, [id, isNewMaterial, setValue]);

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
        supplierId: selectedSupplierId || undefined,
        costPrice: data.costPrice ? Number(data.costPrice) : 0,
        reorderLevel: data.reorderLevel ? Number(data.reorderLevel) : undefined,
        categoryData: Object.keys(categoryData).length > 0 ? categoryData : undefined,
      };

      if (isNewMaterial) {
        await createMaterial(payload);
      } else if (id) {
        await updateMaterial(id, payload);
      }

      navigate('/materials');
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to ${isNewMaterial ? 'create' : 'update'} material`);
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
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md">
                {error}
              </div>
            )}

            {/* MATERIAL INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Material Information</h3>
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
                      <SelectValue placeholder={selectedParentCategoryId ? "Select material category" : "Select category type first"} />
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
                    placeholder="e.g., Cotton Fabric, Metal Button"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="code">Material Code *</Label>
                  <Input
                    id="code"
                    {...register('code', { required: 'Material code is required' })}
                    readOnly
                    className="bg-gray-100"
                  />
                  {errors.code && (
                    <p className="text-sm text-red-600 mt-1">{errors.code.message}</p>
                  )}
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
                  <Label htmlFor="costPrice">Base Price (Optional)</Label>
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    {...register('costPrice')}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Base price varies by vendor</p>
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
            {selectedCategoryId && childCategories.find(c => c.id === selectedCategoryId) && (
              <div className="border-t pt-6">
                <MaterialCategoryFields
                  categoryName={childCategories.find(c => c.id === selectedCategoryId)?.name || ''}
                  data={categoryData}
                  onChange={setCategoryData}
                />
              </div>
            )}

            {/* SUPPLIER, DESCRIPTION & SPECIFICATIONS */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Additional Information</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="supplierId">Supplier (Optional)</Label>
                  <Select value={selectedSupplierId || 'none'} onValueChange={(value) => setSelectedSupplierId(value === 'none' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name} ({supplier.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/materials')}
                disabled={isLoading}
              >
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
