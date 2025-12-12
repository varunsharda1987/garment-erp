import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CircleDot,
  ToggleRight,
  Scissors,
  Cable,
  Wind,
  Tag,
  Plus,
  Layers
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import { trimService, type TrimItem, type TrimSummary, type TrimType } from '@/services/trim.service';
import { handleApiError } from '@/lib/api-error-handler';

// Column type definition
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

// Trim type configuration
const TRIM_TYPES = [
  { type: 'BUTTON' as TrimType, label: 'Buttons', icon: CircleDot, path: '/materials/button', formPath: '/materials/button/new', color: 'bg-blue-100 text-blue-800' },
  { type: 'ZIPPER' as TrimType, label: 'Zippers', icon: ToggleRight, path: '/materials/zipper', formPath: '/materials/zipper/new', color: 'bg-purple-100 text-purple-800' },
  { type: 'LACE' as TrimType, label: 'Laces', icon: Scissors, path: '/materials/lace', formPath: '/materials/lace/new', color: 'bg-pink-100 text-pink-800' },
  { type: 'THREAD' as TrimType, label: 'Threads', icon: Cable, path: '/materials/thread', formPath: '/materials/thread/new', color: 'bg-green-100 text-green-800' },
  { type: 'ELASTIC' as TrimType, label: 'Elastic', icon: Wind, path: '/materials/elastic', formPath: '/materials/elastic/new', color: 'bg-orange-100 text-orange-800' },
  { type: 'LABEL' as TrimType, label: 'Labels', icon: Tag, path: '/materials/label', formPath: '/materials/label/new', color: 'bg-cyan-100 text-cyan-800' },
];

// Get trim type config
const getTrimConfig = (type: string) => TRIM_TYPES.find(t => t.type === type);

// Get detail page path based on type
const getDetailPath = (type: string, id: string) => {
  const config = getTrimConfig(type);
  return config ? `${config.path}/${id}` : '#';
};

// Get edit page path based on type
const getEditPath = (type: string, id: string) => {
  const config = getTrimConfig(type);
  return config ? `${config.path}/${id}/edit` : '#';
};

export default function TrimMastersDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary data
  const [summary, setSummary] = useState<TrimSummary | null>(null);
  const [totalTrims, setTotalTrims] = useState(0);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<TrimType>('');

  // Table data
  const [trims, setTrims] = useState<TrimItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);

  // Load summary on mount
  useEffect(() => {
    loadSummary();
  }, []);

  // Load trims when search/filter changes
  useEffect(() => {
    loadTrims();
  }, [currentPage, pageSize, searchQuery, selectedType]);

  const loadSummary = async () => {
    try {
      const response = await trimService.getSummary();
      setSummary(response.data);
      setTotalTrims(response.total);
    } catch (err: unknown) {
      console.error('Failed to load trim summary:', err);
    }
  };

  const loadTrims = async () => {
    try {
      setTableLoading(true);
      setError(null);
      const response = await trimService.searchAll({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        type: selectedType || undefined,
      });
      setTrims(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load trims', false);
      setError(errorMessage);
    } finally {
      setTableLoading(false);
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setSelectedType(value as TrimType);
    setCurrentPage(1);
  };

  const formatPrice = (price: number | null, unit: string) => {
    if (price === null || price === undefined) return '-';
    return `₹${price.toFixed(2)}/${unit === 'PIECE' ? 'pc' : unit === 'METER' ? 'm' : unit === 'CONE' ? 'cone' : unit.toLowerCase()}`;
  };

  // Define columns for DataTable
  const columns: Column<TrimItem>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (item) => (
        <Badge variant="outline" className="font-mono text-xs">
          {item.code}
        </Badge>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (item) => (
        <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate">
          {item.name}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item) => {
        const config = getTrimConfig(item.type);
        return (
          <Badge className={config?.color || 'bg-gray-100 text-gray-800'}>
            {config?.label || item.type}
          </Badge>
        );
      },
    },
    {
      key: 'color',
      header: 'Color',
      render: (item) => (
        <div className="text-sm text-gray-700">
          {item.color || '-'}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: (item) => (
        <div className="text-sm font-medium text-gray-900">
          {formatPrice(item.price, item.unit)}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (item) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(getDetailPath(item.type, item.id));
            }}
          >
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(getEditPath(item.type, item.id));
            }}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <PageHeader title="Trim Masters">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Trim
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {TRIM_TYPES.map((trim) => (
              <DropdownMenuItem
                key={trim.type}
                onClick={() => navigate(trim.formPath)}
              >
                <trim.icon className="mr-2 h-4 w-4" />
                New {trim.label.slice(0, -1)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {TRIM_TYPES.map((trim) => {
          const Icon = trim.icon;
          const count = summary?.[trim.type.toLowerCase() as keyof TrimSummary]?.count || 0;
          const active = summary?.[trim.type.toLowerCase() as keyof TrimSummary]?.active || 0;

          return (
            <Card
              key={trim.type}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(trim.path)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <Icon className="h-6 w-6 text-gray-500" />
                  <Badge variant="secondary" className="text-xs">
                    {active} active
                  </Badge>
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-muted-foreground">{trim.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Total Summary */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Trim Items</p>
                <p className="text-2xl font-bold">{totalTrims}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Across all categories</p>
              <p className="text-sm font-medium text-primary">
                {TRIM_TYPES.length} trim types
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>All Trims</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="flex-1 max-w-md">
              <SearchInput
                placeholder="Search by code, name, or color..."
                value={searchQuery}
                onChange={(value) => {
                  setSearchQuery(value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          {/* Tabs for filtering by type */}
          <Tabs value={selectedType} onValueChange={handleTabChange} className="mb-4">
            <TabsList>
              <TabsTrigger value="">All</TabsTrigger>
              {TRIM_TYPES.map((trim) => (
                <TabsTrigger key={trim.type} value={trim.type}>
                  {trim.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* DataTable */}
          <DataTable
            data={trims}
            columns={columns}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            loading={tableLoading}
            error={error}
            onRowClick={(item) => navigate(getDetailPath(item.type, item.id))}
            emptyState={{
              icon: <Layers className="h-16 w-16" />,
              title: 'No trims found',
              description: searchQuery || selectedType
                ? 'Try adjusting your search or filter criteria'
                : 'Get started by creating your first trim item',
              actionLabel: 'Add Trim',
              onAction: () => navigate('/materials/button/new'),
            }}
            pagination={{
              currentPage,
              totalPages,
              pageSize,
              totalItems,
              onPageChange: setCurrentPage,
              onPageSizeChange: setPageSize,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
