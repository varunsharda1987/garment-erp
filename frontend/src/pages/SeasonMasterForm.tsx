import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { seasonService } from '@/services/season.service';
import type { SeasonType, CreateSeasonRequest } from '@/types/season.types';
import { SEASON_TYPES, SEASON_TYPE_NAMES, getSeasonYearOptions } from '@/types/season.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Calendar, ArrowLeft, Loader2 } from 'lucide-react';

interface SeasonMasterFormProps {
  mode?: 'create' | 'edit';
}

interface FormData {
  code: string;
  name: string;
  year: number;
}

export default function SeasonMasterForm({ mode = 'create' }: SeasonMasterFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seasonType, setSeasonType] = useState<SeasonType>('SS');
  const [isActive, setIsActive] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      code: '',
      name: '',
      year: new Date().getFullYear(),
    },
  });

  const isNewSeason = mode === 'create' || !id;
  const watchYear = watch('year');
  const watchCode = watch('code');

  // Auto-generate code and name when year or type changes
  useEffect(() => {
    if (isNewSeason && watchYear) {
      const yearSuffix = watchYear.toString().slice(-2);
      const generatedCode = `${seasonType}${yearSuffix}`;
      const generatedName = `${SEASON_TYPE_NAMES[seasonType]} ${watchYear}`;
      setValue('code', generatedCode);
      setValue('name', generatedName);
    }
  }, [watchYear, seasonType, isNewSeason, setValue]);

  // Load season data for edit mode
  useEffect(() => {
    if (!isNewSeason && id) {
      const fetchSeason = async () => {
        try {
          setIsLoading(true);
          const season = await seasonService.getById(id);

          setValue('code', season.code);
          setValue('name', season.name);
          setValue('year', season.year);
          setSeasonType(season.seasonType);
          setIsActive(season.isActive);
        } catch (err: unknown) {
          const errorMessage = handleApiError(err, 'Failed to load season', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchSeason();
    }
  }, [id, isNewSeason, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      setIsSaving(true);
      setError(null);

      // Validate required fields
      if (!data.code?.trim()) {
        setError('Season code is required');
        return;
      }
      if (!data.name?.trim()) {
        setError('Season name is required');
        return;
      }
      if (!data.year) {
        setError('Year is required');
        return;
      }

      const payload: CreateSeasonRequest = {
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        year: Number(data.year),
        seasonType,
        isActive,
      };

      if (isNewSeason) {
        await seasonService.create(payload);
        handleApiSuccess('Season created', `${data.code} has been successfully created.`);
      } else if (id) {
        await seasonService.update(id, payload);
        handleApiSuccess('Season updated', `${data.code} has been successfully updated.`);
      }

      navigate('/seasons');
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, `Failed to ${isNewSeason ? 'create' : 'update'} season`, false);
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const yearOptions = getSeasonYearOptions();

  if (isLoading && !isNewSeason) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading season...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/seasons')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Seasons
        </Button>
        <div className="flex items-center gap-3">
          <Calendar className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-medium">{isNewSeason ? 'Add New Season' : 'Edit Season'}</h1>
            {!isNewSeason && watchCode && (
              <Badge variant="outline" className="mt-1 font-mono">
                {watchCode}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {error && <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-6">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Season Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Season Type and Year */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="seasonType">
                  Season Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={seasonType}
                  onValueChange={(value) => setSeasonType(value as SeasonType)}
                  disabled={!isNewSeason}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEASON_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        <span className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              type === 'SS'
                                ? 'bg-warning-muted text-yellow-700 border-yellow-200'
                                : 'bg-info-muted text-info border-info/20'
                            }
                          >
                            {type}
                          </Badge>
                          {SEASON_TYPE_NAMES[type]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">SS = Spring/Summer, AW = Autumn/Winter</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">
                  Year <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={watchYear?.toString() || ''}
                  onValueChange={(value) => setValue('year', Number(value))}
                  disabled={!isNewSeason}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Code and Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="code">
                  Season Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="code"
                  {...register('code', { required: 'Season code is required' })}
                  placeholder="e.g., SS26"
                  className="font-mono uppercase"
                  disabled={!isNewSeason}
                />
                {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
                <p className="text-xs text-muted-foreground">Auto-generated from type and year</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">
                  Season Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  {...register('name', { required: 'Season name is required' })}
                  placeholder="e.g., Spring/Summer 2026"
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between border rounded-lg p-4">
              <div>
                <Label htmlFor="isActive" className="text-base font-medium">
                  Active Status
                </Label>
                <p className="text-sm text-muted-foreground">Inactive seasons won't appear in dropdown selections</p>
              </div>
              <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
            </div>

            {/* Preview */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <Label className="text-sm font-medium mb-2 block">Preview</Label>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={
                    seasonType === 'SS'
                      ? 'bg-warning-muted text-yellow-700 border-yellow-200'
                      : 'bg-info-muted text-info border-info/20'
                  }
                >
                  {watchCode || `${seasonType}XX`}
                </Badge>
                <span className="text-lg font-medium">
                  {watch('name') || `${SEASON_TYPE_NAMES[seasonType]} ${watchYear || 'XXXX'}`}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => navigate('/seasons')}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isNewSeason ? 'Creating...' : 'Saving...'}
                  </>
                ) : (
                  <>{isNewSeason ? 'Create Season' : 'Save Changes'}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
