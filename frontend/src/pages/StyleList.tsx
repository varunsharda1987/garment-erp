import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { styleService } from '@/services/style.service';
import type { Style } from '@/types/style.types';
import { PRODUCTION_STAGE_LABELS } from '@/types/style.types';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function StyleList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentUser = useAuthStore((state) => state.user);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const limit = 10;

  // Get stage filter from URL params (from dashboard drill-down)
  const stageFilter = searchParams.get('stage') || undefined;

  // Check if current user can create/edit styles
  const canCreateEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'MERCHANDISER';

  // Fetch styles
  const fetchStyles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await styleService.getAllStyles(page, limit, searchQuery, stageFilter);
      setStyles(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load styles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset to page 1 when first landing or when stage filter changes
    setPage(1);
  }, [location.pathname, stageFilter]);

  useEffect(() => {
    fetchStyles();
  }, [page, searchQuery, stageFilter]);

  // Handle search with debounce
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  // Handle delete style
  const handleDelete = async (id: string, styleCode: string) => {
    if (!window.confirm(`Are you sure you want to delete style ${styleCode}?`)) {
      return;
    }

    try {
      await styleService.deleteStyle(id);
      fetchStyles();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete style');
    }
  };

  // Handle logout
  const handleLogout = () => {
    useAuthStore.getState().clearAuth();
    navigate('/login');
  };

  // Get production stage label
  const getProductionStageInfo = (style: Style) => {
    const tracking = style.productionTracking?.[0];
    if (!tracking) return { stage: 'No tracking', pieces: 0, color: 'gray' };

    const stageLabel = PRODUCTION_STAGE_LABELS[tracking.currentStage] || tracking.currentStage;

    // Color coding based on stage
    let color = 'gray';
    if (tracking.currentStage.startsWith('ORDER_') || tracking.currentStage.startsWith('PENDING_') || tracking.currentStage.includes('NOT_ORDERED')) {
      color = 'orange';
    } else if (tracking.currentStage.startsWith('IN_PRINT') || tracking.currentStage.startsWith('IN_DY') || tracking.currentStage.startsWith('IN_EMB') || tracking.currentStage.startsWith('IN_HAND')) {
      color = 'purple';
    } else if (tracking.currentStage.startsWith('IN_CUT') || tracking.currentStage.startsWith('IN_STIT') || tracking.currentStage.startsWith('IN_FIN')) {
      color = 'blue';
    } else if (tracking.currentStage === 'READY_TO_SHIP') {
      color = 'green';
    } else if (tracking.currentStage === 'SHIPPED' || tracking.currentStage === 'COMPLETED') {
      color = 'gray';
    }

    return {
      stage: stageLabel,
      pieces: tracking.piecesInStage,
      color
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="text-2xl cursor-pointer" onClick={() => navigate('/dashboard')}>🏭</div>
              <h1 className="text-xl font-bold text-gray-800">Kashaya Fabs ERP</h1>
              <span className="text-gray-400">|</span>
              <h2 className="text-lg text-gray-600">Style Master</h2>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{currentUser?.name}</span>
                <span className="mx-2">•</span>
                <span className="text-gray-500">{currentUser?.role}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl">Style Master</CardTitle>
                <CardDescription>
                  {stageFilter
                    ? `Showing styles in stage: ${PRODUCTION_STAGE_LABELS[stageFilter as keyof typeof PRODUCTION_STAGE_LABELS] || stageFilter}`
                    : 'Manage and track all garment styles'}
                </CardDescription>
              </div>
              {canCreateEdit && (
                <Button onClick={() => navigate('/styles/new')}>
                  Create New Style
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Search Bar */}
            <div className="mb-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Search by style code, name, buyer, or brand..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full"
                  />
                </div>
                {stageFilter && (
                  <Button variant="outline" onClick={() => navigate('/styles')}>
                    Clear Filter
                  </Button>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
                {error}
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="text-center py-12">
                <div className="text-gray-500">Loading styles...</div>
              </div>
            ) : styles.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">
                  {searchQuery || stageFilter ? 'No styles found matching your criteria' : 'No styles yet'}
                </div>
                {canCreateEdit && !searchQuery && !stageFilter && (
                  <Button onClick={() => navigate('/styles/new')}>
                    Create Your First Style
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Styles Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Image
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Style Code
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Style Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Buyer / Brand
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Order Qty
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {styles.map((style) => {
                        const stageInfo = getProductionStageInfo(style);
                        return (
                          <tr
                            key={style.id}
                            className="hover:bg-gray-50"
                            // onClick={() => navigate(`/styles/${style.id}`)} // Disabled until StyleDetail page is created
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              {style.imageUrl ? (
                                <img
                                  src={style.imageUrl}
                                  alt={style.styleName}
                                  className="w-12 h-12 object-cover rounded"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                                  No Image
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{style.styleCode}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-gray-900">{style.styleName}</div>
                              {style.description && (
                                <div className="text-xs text-gray-500 truncate max-w-xs">
                                  {style.description}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-gray-900">{style.buyerName}</div>
                              <div className="text-xs text-gray-500">{style.brandName}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {style.orderQuantity || '-'}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-${stageInfo.color}-100 text-${stageInfo.color}-800`}>
                                {stageInfo.stage}
                              </span>
                              <div className="text-xs text-gray-500 mt-1">
                                {stageInfo.pieces} pcs
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                              <div className="flex space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/styles/${style.id}`);
                                  }}
                                >
                                  View
                                </Button>
                                {canCreateEdit && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/styles/${style.id}/edit`);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    {currentUser?.role === 'ADMIN' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(style.id, style.styleCode);
                                        }}
                                      >
                                        Delete
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(page * limit, total)}</span> of{' '}
                    <span className="font-medium">{total}</span> styles
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">
                        Page {page} of {totalPages}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
