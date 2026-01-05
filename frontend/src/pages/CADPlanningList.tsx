/**
 * CAD Planning List Page
 *
 * Dedicated list page for CAD Planning module.
 * Shows styles that need CAD work with status tabs.
 * Route: /cad-planning
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { cadPlanningService, type CADPlanningStyle, type CADStatusCounts } from '@/services/cad-planning.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import SearchInput from '@/components/SearchInput';
import DataTable from '@/components/DataTable';
import { CADStatusBadge } from '@/components/CADStatusBadge';
import ExportButton from '@/components/ExportButton';
import { Ruler, Clock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { getUploadUrl } from '../config/api.config';

// Local type definition for DataTable columns
type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export default function CADPlanningList() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);

  // Tab state
  const [statusTab, setStatusTab] = useState<'PENDING' | 'IN_PROGRESS' | 'APPROVED'>('PENDING');

  // Status counts
  const [statusCounts, setStatusCounts] = useState<CADStatusCounts>({
    PENDING: 0,
    IN_PROGRESS: 0,
    APPROVED: 0,
  });

  // Styles state
  const [styles, setStyles] = useState<CADPlanningStyle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStyles, setTotalStyles] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Load status counts
  const loadStatusCounts = useCallback(async () => {
    try {
      const counts = await cadPlanningService.getCADStatusCounts();
      setStatusCounts(counts);
    } catch (err) {
      console.error('Failed to load CAD status counts:', err);
    }
  }, []);

  // Load styles
  const loadStyles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await cadPlanningService.getStylesForCADPlanning({
        status: statusTab,
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
      });

      if (response.success) {
        setStyles(response.data.styles);
        setTotalPages(response.data.pagination.totalPages);
        setTotalStyles(response.data.pagination.total);
      }
    } catch (err: any) {
      console.error('Failed to load styles:', err);
      setError(err.response?.data?.message || 'Failed to load styles');
    } finally {
      setIsLoading(false);
    }
  }, [statusTab, currentPage, pageSize, searchQuery]);

  // Load on mount and when dependencies change
  useEffect(() => {
    loadStatusCounts();
  }, [loadStatusCounts]);

  useEffect(() => {
    loadStyles();
  }, [loadStyles]);

  // Reset page when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusTab, searchQuery]);

  // Table columns
  const columns: Column<CADPlanningStyle>[] = [
    {
      key: 'image',
      header: 'Image',
      render: (style) => (
        <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex-shrink-0">
          {style.imageUrl ? (
            <img
              src={getUploadUrl(style.imageUrl)}
              alt={style.styleCode}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-style.png';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
              No img
            </div>
          )}
        </div>
      ),
      className: 'w-16',
    },
    {
      key: 'styleCode',
      header: 'Style Code',
      render: (style) => (
        <div>
          <div className="font-medium text-blue-600">{style.styleCode}</div>
          <div className="text-sm text-gray-500 truncate max-w-[180px]" title={style.styleName}>
            {style.styleName}
          </div>
        </div>
      ),
    },
    {
      key: 'buyer',
      header: 'Buyer / Brand',
      render: (style) => (
        <div>
          <div className="font-medium">{style.buyerName || '-'}</div>
          <div className="text-sm text-gray-500">{style.brandName || '-'}</div>
        </div>
      ),
    },
    {
      key: 'fabric',
      header: 'Fabric',
      render: (style) => (
        <div className="text-sm max-w-[200px]" title={style.fabricSummary}>
          <span className="truncate block">{style.fabricSummary}</span>
        </div>
      ),
    },
    {
      key: 'components',
      header: 'Components',
      render: (style) => (
        <Badge variant="outline" className="text-xs">
          {style.componentCount}
        </Badge>
      ),
      className: 'text-center',
    },
    {
      key: 'cadStatus',
      header: 'CAD Status',
      render: (style) => <CADStatusBadge status={style.cadStatus} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (style) => (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/cad-planning/${style.id}`);
          }}
        >
          Open CAD
        </Button>
      ),
      className: 'w-24',
    },
  ];

  // Get tab icon
  const getTabIcon = (status: 'PENDING' | 'IN_PROGRESS' | 'APPROVED') => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'IN_PROGRESS':
        return <AlertCircle className="h-4 w-4" />;
      case 'APPROVED':
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  // Get count badge color
  const getCountBadgeClass = (status: 'PENDING' | 'IN_PROGRESS' | 'APPROVED') => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-700';
      case 'APPROVED':
        return 'bg-green-100 text-green-700';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Ruler className="h-6 w-6" />
              CAD Planning
            </CardTitle>
            <CardDescription>
              Manage CAD planning for styles ({totalStyles} styles in {statusTab.replace('_', ' ').toLowerCase()} status)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <ExportButton
              module="styles"
              filters={{ cadStatus: statusTab }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Status Tabs */}
        <Tabs
          value={statusTab}
          onValueChange={(v) => setStatusTab(v as 'PENDING' | 'IN_PROGRESS' | 'APPROVED')}
          className="mb-6"
        >
          <TabsList>
            {(['PENDING', 'IN_PROGRESS', 'APPROVED'] as const).map((status) => (
              <TabsTrigger key={status} value={status} className="flex items-center gap-2">
                {getTabIcon(status)}
                {status === 'IN_PROGRESS' ? 'In Progress' : status.charAt(0) + status.slice(1).toLowerCase()}
                {statusCounts[status] > 0 && (
                  <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${getCountBadgeClass(status)}`}>
                    {statusCounts[status]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Content for all tabs is the same - just the data changes */}
          {(['PENDING', 'IN_PROGRESS', 'APPROVED'] as const).map((status) => (
            <TabsContent key={status} value={status}>
              {/* Search */}
              <div className="mb-4">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search by style code, name, buyer, or brand..."
                  className="max-w-md"
                />
              </div>

              {/* Loading state */}
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Error state */}
              {error && !isLoading && (
                <div className="text-center py-12 text-red-600">
                  <p>{error}</p>
                  <Button variant="outline" className="mt-4" onClick={loadStyles}>
                    Retry
                  </Button>
                </div>
              )}

              {/* Empty state */}
              {!isLoading && !error && styles.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Ruler className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No styles found</p>
                  <p className="text-sm mt-1">
                    {searchQuery
                      ? 'Try adjusting your search terms'
                      : status === 'PENDING'
                      ? 'All styles have CAD planning started or completed'
                      : status === 'IN_PROGRESS'
                      ? 'No styles currently in CAD planning progress'
                      : 'No styles have completed CAD planning yet'}
                  </p>
                </div>
              )}

              {/* Table */}
              {!isLoading && !error && styles.length > 0 && (
                <DataTable
                  data={styles}
                  columns={columns}
                  keyExtractor={(style) => style.id}
                  loading={isLoading}
                  emptyState={{
                    title: 'No styles found',
                    description: 'No styles match your search criteria',
                  }}
                  onRowClick={(style) => navigate(`/cad-planning/${style.id}`)}
                  pagination={{
                    currentPage,
                    totalPages,
                    pageSize,
                    totalItems: totalStyles,
                    onPageChange: setCurrentPage,
                  }}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
