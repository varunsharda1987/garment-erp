import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { genericTrimService } from '@/services/genericTrim.service';
import { TRIM_TYPE_CONFIGS } from '@/types/genericTrim.types';
import type { GenericTrimItem } from '@/types/genericTrim.types';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { Package, ArrowLeft } from 'lucide-react';

// Column type for DataTable
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function GenericTrimList() {
  const navigate = useNavigate();
  const { trimType } = useParams<{ trimType: string }>();
  const [items, setItems] = useState<GenericTrimItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get config for this trim type
  const config = trimType ? TRIM_TYPE_CONFIGS[trimType] : null;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (trimType && config) {
      fetchItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimType, currentPage, pageSize, searchQuery]);

  const fetchItems = async () => {
    if (!trimType) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await genericTrimService.getAll(trimType, {
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
      });
      setItems(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, `Failed to load ${config?.label || 'items'}`, false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setItemToDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !trimType) return;

    try {
      await genericTrimService.remove(trimType, itemToDelete.id);
      handleApiSuccess(`${config?.label || 'Item'} deleted`, `${itemToDelete.name} has been successfully deleted.`);
      fetchItems();
    } catch (err: unknown) {
      handleApiError(err, `Failed to delete ${config?.label?.toLowerCase() || 'item'}`);
    } finally {
      setItemToDelete(null);
    }
  };

  // Get the value from item using dynamic field name.
  // Spreading into a fresh object gives it an implicit index signature, so no cast is needed;
  // the result is narrowed to the primitive types trim fields can actually hold.
  const getFieldValue = (item: GenericTrimItem, field: string): string | number | boolean | null => {
    const record: Record<string, unknown> = { ...item };
    const value = record[field];
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null;
  };

  if (!trimType || !config) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Invalid trim type specified.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/trim-masters')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Trim Masters
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build columns dynamically based on config
  const columns: Column<GenericTrimItem>[] = [
    {
      key: config.codeField,
      header: 'Code',
      render: (item) => (
        <Badge variant="outline" className="font-mono text-xs">
          {getFieldValue(item, config.codeField)}
        </Badge>
      ),
    },
    {
      key: config.nameField,
      header: 'Name',
      render: (item) => (
        <div>
          <div className="text-sm font-medium text-foreground">{getFieldValue(item, config.nameField)}</div>
          {item.description && <div className="text-xs text-muted-foreground line-clamp-1">{item.description}</div>}
        </div>
      ),
    },
  ];

  // Add dynamic fields from config (up to 4 additional columns)
  const additionalFields = config.fields.slice(0, 4);
  additionalFields.forEach((field) => {
    if (field.type !== 'number') {
      columns.push({
        key: field.name,
        header: field.label,
        render: (item) => {
          const value = getFieldValue(item, field.name);
          if (field.type === 'boolean') {
            return value ? <Badge variant="outline">Yes</Badge> : <span className="text-muted-foreground">No</span>;
          }
          return <div className="text-sm text-foreground">{value || '-'}</div>;
        },
      });
    }
  });

  // Add price column if available
  const priceField = config.fields.find((f) => f.name.includes('price'));
  if (priceField) {
    columns.push({
      key: priceField.name,
      header: priceField.label,
      render: (item) => {
        const price = getFieldValue(item, priceField.name);
        return (
          <div className="text-sm font-medium text-foreground">
            {price && typeof price !== 'boolean' ? formatCurrency(price) : '-'}
          </div>
        );
      },
    });
  }

  // Add supplier column
  columns.push({
    key: 'supplier',
    header: 'Supplier',
    render: (item) => <div className="text-sm text-foreground">{item.supplier?.name || '-'}</div>,
  });

  // Add status column
  columns.push({
    key: 'isActive',
    header: 'Status',
    render: (item) => <StatusBadge status={item.isActive ? 'Active' : 'Inactive'} />,
  });

  // Add actions column
  columns.push({
    key: 'actions',
    header: 'Actions',
    render: (item) => (
      <div className="flex space-x-2">
        <Button variant="outline" size="sm" onClick={() => navigate(`/materials/${trimType}/${item.id}/edit`)}>
          Edit
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleDeleteClick(item.id, String(getFieldValue(item, config.nameField) ?? ''))}
        >
          Delete
        </Button>
      </div>
    ),
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/trim-masters')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-display font-medium text-foreground">{config.label} Master</h1>
            <p className="text-sm text-muted-foreground">
              Manage {config.label.toLowerCase()} items ({totalItems} total)
            </p>
          </div>
        </div>
        <Button onClick={() => navigate(`/materials/${trimType}/new`)}>Add New {config.label}</Button>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={`Search ${config.label.toLowerCase()}...`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {config.label} Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchItems}>
                Retry
              </Button>
            </div>
          ) : (
            <DataTable
              data={items}
              columns={columns}
              keyExtractor={(item) => item.id}
              loading={isLoading}
              pagination={{
                currentPage,
                totalPages,
                totalItems,
                pageSize,
                onPageChange: setCurrentPage,
                onPageSizeChange: setPageSize,
              }}
              emptyState={{
                title: `No ${config.label.toLowerCase()} items found`,
                description: `Add your first ${config.label.toLowerCase()}!`,
                actionLabel: `Add ${config.label}`,
                onAction: () => navigate(`/materials/${trimType}/new`),
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete ${config.label}`}
        description={`Are you sure you want to delete "${itemToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
