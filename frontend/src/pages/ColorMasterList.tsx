import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { colorService } from '@/services/colorService';
import type { ColorMaster } from '@/types/color.types';
import { COLOR_FAMILIES } from '@/types/color.types';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Palette, Plus, Pencil, Trash2, Upload } from 'lucide-react';

// Local type definition
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function ColorMasterList() {
  const navigate = useNavigate();
  const [colors, setColors] = useState<ColorMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState<string>('all');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [colorToDelete, setColorToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchColors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchQuery, familyFilter]);

  const fetchColors = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await colorService.getAll({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        colorFamily: familyFilter !== 'all' ? familyFilter : undefined,
        isActive: true,
      });
      setColors(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load colors', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setColorToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!colorToDelete) return;

    try {
      await colorService.delete(colorToDelete.id);
      handleApiSuccess('Color deleted', `${colorToDelete.name} has been successfully deleted.`);
      fetchColors();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete color');
    } finally {
      setColorToDelete(null);
    }
  };

  // Color swatch component
  const ColorSwatch = ({ hexCode }: { hexCode: string | null }) => {
    if (!hexCode) {
      return (
        <div className="h-6 w-6 rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
          <span className="text-xs text-gray-400">?</span>
        </div>
      );
    }
    return (
      <div className="h-6 w-6 rounded border border-gray-200" style={{ backgroundColor: hexCode }} title={hexCode} />
    );
  };

  // Define columns for DataTable
  const columns: Column<ColorMaster>[] = [
    {
      key: 'colorCode',
      header: 'Code',
      render: (item) => (
        <Badge variant="outline" className="font-mono text-xs">
          {item.colorCode}
        </Badge>
      ),
    },
    {
      key: 'colorName',
      header: 'Color Name',
      render: (item) => (
        <div className="flex items-center gap-3">
          <ColorSwatch hexCode={item.hexCode} />
          <div>
            <div className="text-sm font-medium text-gray-900">{item.colorName}</div>
            {item.hexCode && <div className="text-xs text-gray-500 font-mono">{item.hexCode}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'colorFamily',
      header: 'Family',
      render: (item) => <Badge variant="secondary">{item.colorFamily || 'Uncategorized'}</Badge>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (item) => <div className="text-sm text-gray-500 max-w-[200px] truncate">{item.description || '-'}</div>,
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (item) => (
        <Badge variant={item.isActive ? 'default' : 'secondary'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
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
              navigate(`/colors/${item.id}/edit`);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(item.id, item.colorName);
            }}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <Palette className="h-6 w-6 text-primary" />
            <CardTitle>Color Master</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/colors/import')}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button onClick={() => navigate('/colors/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Color
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                placeholder="Search colors..."
                value={searchQuery}
                onChange={(value) => {
                  setSearchQuery(value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-[180px]">
              <Select
                value={familyFilter}
                onValueChange={(value) => {
                  setFamilyFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Families" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Families</SelectItem>
                  {COLOR_FAMILIES.map((family) => (
                    <SelectItem key={family} value={family}>
                      {family}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Error */}
          {error && <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">{error}</div>}

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span>Total: {totalItems} colors</span>
            {familyFilter !== 'all' && <span>• Filtered by: {familyFilter}</span>}
          </div>

          {/* Data Table */}
          <DataTable
            columns={columns}
            data={colors}
            keyExtractor={(item) => item.id}
            loading={isLoading}
            onRowClick={(item) => navigate(`/colors/${item.id}/edit`)}
            emptyState={{
              title: 'No colors found',
              description: 'Add your first color to get started.',
              actionLabel: 'Add Color',
              onAction: () => navigate('/colors/new'),
            }}
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
        title="Delete Color"
        description={`Are you sure you want to delete "${colorToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </div>
  );
}
