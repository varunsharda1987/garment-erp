import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { seasonService } from '@/services/season.service';
import type { SeasonMaster, SeasonType } from '@/types/season.types';
import { SEASON_TYPES, SEASON_TYPE_NAMES, getSeasonYearOptions } from '@/types/season.types';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Calendar, Plus, Pencil, Trash2, Sparkles } from 'lucide-react';

// Local type definition for DataTable columns
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function SeasonMasterList() {
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState<SeasonMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [seasonToDelete, setSeasonToDelete] = useState<{ id: string; code: string } | null>(null);

  // Generate dialog state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateStartYear, setGenerateStartYear] = useState(new Date().getFullYear());
  const [generateEndYear, setGenerateEndYear] = useState(new Date().getFullYear() + 3);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchSeasons();
  }, [currentPage, pageSize, searchQuery, yearFilter, typeFilter]);

  const fetchSeasons = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await seasonService.getAll({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        year: yearFilter !== 'all' ? Number(yearFilter) : undefined,
        seasonType: typeFilter !== 'all' ? (typeFilter as SeasonType) : undefined,
        isActive: true,
      });
      setSeasons(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load seasons', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, code: string) => {
    setSeasonToDelete({ id, code });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!seasonToDelete) return;

    try {
      await seasonService.delete(seasonToDelete.id);
      handleApiSuccess('Season deleted', `${seasonToDelete.code} has been successfully deleted.`);
      fetchSeasons();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete season');
    } finally {
      setSeasonToDelete(null);
    }
  };

  const handleGenerateSeasons = async () => {
    if (generateStartYear > generateEndYear) {
      handleApiError(null, 'Start year must be less than or equal to end year');
      return;
    }

    try {
      setIsGenerating(true);
      const result = await seasonService.generate({
        startYear: generateStartYear,
        endYear: generateEndYear,
      });
      handleApiSuccess(
        'Seasons generated',
        `Created ${result.data.created} new seasons, skipped ${result.data.skipped} existing.`
      );
      setGenerateDialogOpen(false);
      fetchSeasons();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to generate seasons');
    } finally {
      setIsGenerating(false);
    }
  };

  // Season type badge component
  const SeasonTypeBadge = ({ type }: { type: SeasonType }) => (
    <Badge
      variant="outline"
      className={
        type === 'SS'
          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
          : 'bg-blue-50 text-blue-700 border-blue-200'
      }
    >
      {type}
    </Badge>
  );

  // Define columns for DataTable
  const columns: Column<SeasonMaster>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (item) => (
        <div className="flex items-center gap-2">
          <SeasonTypeBadge type={item.seasonType} />
          <span className="font-mono font-medium">{item.code}</span>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Season Name',
      render: (item) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{item.name}</span>
        </div>
      ),
    },
    {
      key: 'year',
      header: 'Year',
      render: (item) => (
        <Badge variant="secondary" className="font-mono">
          {item.year}
        </Badge>
      ),
    },
    {
      key: 'seasonType',
      header: 'Type',
      render: (item) => (
        <span className="text-sm text-gray-600">
          {SEASON_TYPE_NAMES[item.seasonType]}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (item) => (
        <Badge variant={item.isActive ? 'default' : 'secondary'}>
          {item.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/seasons/${item.id}/edit`);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(item.id, item.code);
            }}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  // Get unique years from data for filter
  const yearOptions = getSeasonYearOptions();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <CardTitle>Season Master</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setGenerateDialogOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Seasons
            </Button>
            <Button onClick={() => navigate('/seasons/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Season
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                placeholder="Search seasons..."
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={() => setCurrentPage(1)}
              />
            </div>
            <div className="w-[140px]">
              <Select
                value={yearFilter}
                onValueChange={(value) => {
                  setYearFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Select
                value={typeFilter}
                onValueChange={(value) => {
                  setTypeFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {SEASON_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type} - {SEASON_TYPE_NAMES[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span>Total: {totalItems} seasons</span>
            {yearFilter !== 'all' && <span>• Year: {yearFilter}</span>}
            {typeFilter !== 'all' && <span>• Type: {SEASON_TYPE_NAMES[typeFilter as SeasonType]}</span>}
          </div>

          {/* Data Table */}
          <DataTable
            columns={columns}
            data={seasons}
            keyExtractor={(item) => item.id}
            isLoading={isLoading}
            onRowClick={(item) => navigate(`/seasons/${item.id}/edit`)}
            emptyMessage="No seasons found. Generate seasons or add your first season to get started."
            pagination={{
              currentPage,
              pageSize,
              totalPages,
              totalItems,
              onPageChange: setCurrentPage,
              onPageSizeChange: (size) => {
                setPageSize(size);
                setCurrentPage(1);
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Season"
        description={`Are you sure you want to delete "${seasonToDelete?.code}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />

      {/* Generate Seasons Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Seasons</DialogTitle>
            <DialogDescription>
              Automatically generate seasons for a range of years. This will create both SS
              (Spring/Summer) and AW (Autumn/Winter) seasons for each year.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startYear">Start Year</Label>
                <Input
                  id="startYear"
                  type="number"
                  value={generateStartYear}
                  onChange={(e) => setGenerateStartYear(Number(e.target.value))}
                  min={2000}
                  max={2100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endYear">End Year</Label>
                <Input
                  id="endYear"
                  type="number"
                  value={generateEndYear}
                  onChange={(e) => setGenerateEndYear(Number(e.target.value))}
                  min={2000}
                  max={2100}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              This will generate {(generateEndYear - generateStartYear + 1) * 2} seasons (
              {generateEndYear - generateStartYear + 1} years × 2 seasons per year). Existing
              seasons will be skipped.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateSeasons} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Seasons'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
