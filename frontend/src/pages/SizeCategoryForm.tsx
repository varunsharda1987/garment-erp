import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createSizeCategory,
  getSizeCategoryById,
  updateSizeCategory,
} from '@/services/sizeCategory.service';
import type { SizeCategoryFormData } from '@/types/sizeCategory.types';
import { SIZE_CATEGORY_TEMPLATES } from '@/types/sizeCategory.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { X, Plus } from 'lucide-react';

interface SizeCategoryFormProps {
  mode?: 'create' | 'edit';
}

export default function SizeCategoryForm({ mode = 'create' }: SizeCategoryFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sizes, setSizes] = useState<string[]>([]);
  const [currentSize, setCurrentSize] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SizeCategoryFormData>();

  const isNewCategory = mode === 'create' || !id;

  useEffect(() => {
    if (!isNewCategory && id) {
      const fetchCategory = async () => {
        try {
          setIsLoading(true);
          const category = await getSizeCategoryById(id);

          setValue('name', category.name);
          setValue('description', category.description || '');
          if (Array.isArray(category.sizes)) {
            setSizes(category.sizes);
          }
        } catch (err: unknown) {
          const errorMessage = handleApiError(err, 'Failed to load size category', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchCategory();
    }
  }, [id, isNewCategory, setValue]);

  const handleAddSize = () => {
    const trimmedSize = currentSize.trim();
    if (trimmedSize && !sizes.includes(trimmedSize)) {
      setSizes([...sizes, trimmedSize]);
      setCurrentSize('');
    }
  };

  const handleRemoveSize = (index: number) => {
    setSizes(sizes.filter((_, i) => i !== index));
  };

  const handleLoadTemplate = (templateName: string) => {
    const template = SIZE_CATEGORY_TEMPLATES.find((t) => t.name === templateName);
    if (template) {
      setValue('name', template.name);
      setValue('description', template.description);
      setSizes([...template.sizes]);
    }
  };

  const onSubmit = async (data: SizeCategoryFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!data.name || data.name.trim() === '') {
        setError('Category name is required');
        setIsLoading(false);
        return;
      }

      if (sizes.length === 0) {
        setError('At least one size is required');
        setIsLoading(false);
        return;
      }

      const payload: SizeCategoryFormData = {
        ...data,
        sizes,
      };

      if (isNewCategory) {
        await createSizeCategory(payload);
        handleApiSuccess(
          'Size category created',
          'Size category has been successfully created.'
        );
      } else if (id) {
        await updateSizeCategory(id, payload);
        handleApiSuccess(
          'Size category updated',
          'Size category has been successfully updated.'
        );
      }

      navigate('/masters/size-categories');
    } catch (err: unknown) {
      const errorMessage = handleApiError(
        err,
        `Failed to ${isNewCategory ? 'create' : 'update'} size category`,
        false
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewCategory) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading size category...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {isNewCategory ? 'Create New Size Category' : 'Edit Size Category'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md">{error}</div>
            )}

            {/* Template Selection - Only for new categories */}
            {isNewCategory && (
              <div>
                <Label htmlFor="template">Load from Template (Optional)</Label>
                <Select onValueChange={handleLoadTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_CATEGORY_TEMPLATES.map((template) => (
                      <SelectItem key={template.name} value={template.name}>
                        {template.name} - {template.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Start with a predefined size set or create your own
                </p>
              </div>
            )}

            {/* Category Name */}
            <div>
              <Label htmlFor="name">Category Name *</Label>
              <Input
                id="name"
                {...register('name', { required: 'Category name is required' })}
                placeholder="e.g., Men's Standard, Kids Age, European Sizes"
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                rows={2}
                placeholder="Optional description for this size category"
              />
            </div>

            {/* Sizes Management */}
            <div>
              <Label>Sizes *</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={currentSize}
                  onChange={(e) => setCurrentSize(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSize();
                    }
                  }}
                  placeholder="Enter size (e.g., S, M, L, 38, 2Y)"
                  className="flex-1"
                />
                <Button type="button" onClick={handleAddSize} variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Add sizes one by one. Press Enter or click Add button.
              </p>

              {/* Size Badges */}
              {sizes.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-4 p-4 bg-gray-50 rounded-md">
                  {sizes.map((size, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-sm px-3 py-1 flex items-center gap-2"
                    >
                      {size}
                      <button
                        type="button"
                        onClick={() => handleRemoveSize(index)}
                        className="hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="mt-4 p-4 bg-gray-50 rounded-md text-center text-gray-500 text-sm">
                  No sizes added yet. Add sizes using the input above.
                </div>
              )}
              <p className="text-xs text-gray-600 mt-2">
                Total: <strong>{sizes.length}</strong> size(s)
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/masters/size-categories')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || sizes.length === 0}>
                {isLoading
                  ? 'Saving...'
                  : isNewCategory
                    ? 'Create Size Category'
                    : 'Update Size Category'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
