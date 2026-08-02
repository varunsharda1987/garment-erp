import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { colorService } from '@/services/colorService';
import type { CreateColorRequest } from '@/types/color.types';
import { COLOR_FAMILIES } from '@/types/color.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Palette, ArrowLeft } from 'lucide-react';

interface ColorMasterFormProps {
  mode?: 'create' | 'edit';
}

interface FormData {
  colorName: string;
  hexCode: string;
  colorFamily: string;
  description: string;
  sortOrder: number;
}

export default function ColorMasterForm({ mode = 'create' }: ColorMasterFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorCode, setColorCode] = useState<string>('');
  const [selectedFamily, setSelectedFamily] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [previewColor, setPreviewColor] = useState<string>('#CCCCCC');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      colorName: '',
      hexCode: '',
      colorFamily: '',
      description: '',
      sortOrder: 0,
    },
  });

  const isNewColor = mode === 'create' || !id;
  const watchHexCode = watch('hexCode');

  // Update preview color when hex code changes
  useEffect(() => {
    if (watchHexCode && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(watchHexCode)) {
      setPreviewColor(watchHexCode);
    } else {
      setPreviewColor('#CCCCCC');
    }
  }, [watchHexCode]);

  // Load color data for edit mode
  useEffect(() => {
    if (!isNewColor && id) {
      const fetchColor = async () => {
        try {
          setIsLoading(true);
          const color = await colorService.getById(id);

          setColorCode(color.colorCode);
          setValue('colorName', color.colorName);
          setValue('hexCode', color.hexCode || '');
          setValue('description', color.description || '');
          setValue('sortOrder', color.sortOrder ?? 0);
          setSelectedFamily(color.colorFamily || '');
          setIsActive(color.isActive);

          if (color.hexCode) {
            setPreviewColor(color.hexCode);
          }
        } catch (err: unknown) {
          const errorMessage = handleApiError(err, 'Failed to load color', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchColor();
    }
  }, [id, isNewColor, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate required fields
      if (!data.colorName?.trim()) {
        setError('Color name is required');
        return;
      }

      // Validate hex code format if provided
      if (data.hexCode && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.hexCode)) {
        setError('Invalid hex color code format (e.g., #FF0000 or #F00)');
        return;
      }

      const payload: CreateColorRequest = {
        colorName: data.colorName.trim(),
        hexCode: data.hexCode?.trim() || null,
        colorFamily: selectedFamily || null,
        description: data.description?.trim() || null,
        sortOrder: data.sortOrder ?? 0,
      };

      if (isNewColor) {
        await colorService.create(payload);
        handleApiSuccess('Color created', `${data.colorName} has been successfully created.`);
      } else if (id) {
        await colorService.update(id, { ...payload, isActive });
        handleApiSuccess('Color updated', `${data.colorName} has been successfully updated.`);
      }

      navigate('/colors');
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, `Failed to ${isNewColor ? 'create' : 'update'} color`, false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewColor) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading color...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/colors')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Colors
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {isNewColor ? 'Add New Color' : `Edit Color: ${colorCode}`}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && <div className="bg-destructive/10 text-destructive p-4 rounded-md">{error}</div>}

            {/* Color Code (auto-generated, display only) */}
            {!isNewColor && (
              <div className="space-y-2">
                <Label>Color Code</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-sm py-1 px-3">
                    {colorCode}
                  </Badge>
                  <span className="text-xs text-muted-foreground">(Auto-generated)</span>
                </div>
              </div>
            )}

            {/* Color Preview and Hex */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Color Name */}
              <div className="space-y-2">
                <Label htmlFor="colorName">
                  Color Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="colorName"
                  {...register('colorName', { required: 'Color name is required' })}
                  placeholder="e.g., Navy Blue"
                />
                {errors.colorName && <span className="text-sm text-destructive">{errors.colorName.message}</span>}
              </div>

              {/* Hex Code with Preview */}
              <div className="space-y-2">
                <Label htmlFor="hexCode">Hex Code</Label>
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded border-2 border-border flex-shrink-0"
                    style={{ backgroundColor: previewColor }}
                  />
                  <Input id="hexCode" {...register('hexCode')} placeholder="#000080" className="font-mono" />
                  <input
                    type="color"
                    value={previewColor}
                    onChange={(e) => {
                      setValue('hexCode', e.target.value.toUpperCase());
                      setPreviewColor(e.target.value);
                    }}
                    className="h-10 w-10 cursor-pointer rounded border border-border"
                    title="Pick a color"
                  />
                </div>
                <span className="text-xs text-muted-foreground">Enter hex code manually or use the color picker</span>
              </div>
            </div>

            {/* Color Family and Sort Order */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Color Family */}
              <div className="space-y-2">
                <Label>Color Family</Label>
                <Select
                  value={selectedFamily || 'none'}
                  onValueChange={(val) => setSelectedFamily(val === 'none' ? '' : val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a color family" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Family</SelectItem>
                    {COLOR_FAMILIES.map((family) => (
                      <SelectItem key={family} value={family}>
                        {family}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">Group colors by family for easier filtering</span>
              </div>

              {/* Sort Order */}
              <div className="space-y-2">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  min={0}
                  {...register('sortOrder', { valueAsNumber: true })}
                  placeholder="0"
                  className="w-full md:w-[150px]"
                />
                <span className="text-xs text-muted-foreground">Lower numbers appear first in lists</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Optional description or notes about this color"
                rows={3}
              />
            </div>

            {/* Active Status (edit mode only) */}
            {!isNewColor && (
              <div className="flex items-center space-x-3 py-2">
                <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="isActive" className="cursor-pointer">
                  Active
                </Label>
                <span className="text-xs text-muted-foreground">Inactive colors won't appear in dropdowns</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-4 pt-4 border-t">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isNewColor ? 'Create Color' : 'Update Color'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/colors')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
