import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Package, Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { StatusBadge } from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '../lib/api-error-handler';
import { greigeService, fabricService } from '../services/fabricGreigeService';
import { getGenericGreigeStock } from '../services/style-stock.service';
import type { GreigeMaster, FabricMaster } from '../types/fabric-greige.types';
import { logError } from '../lib/logger';

interface GreigeStock {
  greigeId: string;
  greigeCode: string;
  greigeName: string;
  composition: string;
  totalStock: number;
  unit: string;
}

export default function GreigeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [greige, setGreige] = useState<GreigeMaster | null>(null);
  const [finishedFabrics, setFinishedFabrics] = useState<FabricMaster[]>([]);
  const [stockEntries, setStockEntries] = useState<GreigeStock[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchGreigeDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Update document title when greige data is loaded
  useEffect(() => {
    if (greige) {
      document.title = `${greige.greigeName} - Kashaya Fabs ERP`;
    }
    return () => {
      document.title = 'Kashaya Fabs ERP';
    };
  }, [greige]);

  const fetchGreigeDetails = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch greige master details
      const greigeData = await greigeService.getById(id);
      setGreige(greigeData);

      // Fetch finished fabrics derived from this greige
      try {
        const fabrics = await fabricService.getByGreigeId(id);
        setFinishedFabrics(fabrics);
      } catch (err) {
        logError('Error loading finished fabrics:', err);
        setFinishedFabrics([]);
      }

      // Fetch stock entries for this greige
      try {
        const allStock = await getGenericGreigeStock();
        const filteredStock = allStock.filter((stock) => stock.greigeId === id);
        setStockEntries(filteredStock);
      } catch (err) {
        logError('Error loading stock entries:', err);
        setStockEntries([]);
      }
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load greige details', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !greige) return;

    try {
      await greigeService.delete(id);
      handleApiSuccess('Greige deleted', `${greige.greigeName} has been successfully deleted.`);
      navigate('/greige');
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete greige master');
    }
  };

  const getTotalStockQuantity = () => {
    return stockEntries.reduce((sum, stock) => sum + stock.totalStock, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading greige details...</div>
      </div>
    );
  }

  if (error || !greige) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-lg text-red-600 mb-4">{error || 'Greige not found'}</div>
        <Button onClick={() => navigate('/greige')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Greige Master
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={greige.greigeName}>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/greige')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <Link to={`/greige-stock-entry?greigeId=${id}`}>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Stock
            </Button>
          </Link>
          <Button variant="outline" onClick={() => navigate(`/greige/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </PageHeader>

      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-600">
        <Link to="/" className="hover:text-blue-600">
          Home
        </Link>
        {' > '}
        <Link to="/greige" className="hover:text-blue-600">
          Greige Master
        </Link>
        {' > '}
        <span className="font-medium text-gray-900">{greige.greigeCode}</span>
      </div>

      <div className="space-y-6">
        {/* Basic Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Basic Information</span>
              <StatusBadge
                status={greige.isActive ? 'Active' : 'Inactive'}
                variant={greige.isActive ? 'success' : 'secondary'}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Greige Code</label>
                <div className="text-base font-semibold text-gray-900">{greige.greigeCode}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Greige Name</label>
                <div className="text-base text-gray-900">{greige.greigeName}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Composition</label>
                <div className="text-base text-gray-900">{greige.composition}</div>
              </div>
              {greige.yarnCount && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Yarn Count</label>
                  <div className="text-base text-gray-900">{greige.yarnCount}</div>
                </div>
              )}
              {greige.construction && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Construction</label>
                  <div className="text-base text-gray-900">{greige.construction}</div>
                </div>
              )}
              {greige.weaveType && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Weave Type</label>
                  <div className="text-base text-gray-900">{greige.weaveType}</div>
                </div>
              )}
              {greige.gsmRange && (
                <div>
                  <label className="text-sm font-medium text-gray-500">GSM Range</label>
                  <div className="text-base text-gray-900">{greige.gsmRange}</div>
                </div>
              )}
            </div>

            {greige.description && (
              <div className="mt-6">
                <label className="text-sm font-medium text-gray-500">Description</label>
                <div className="text-base text-gray-900 mt-1">{greige.description}</div>
              </div>
            )}

            {greige.notes && (
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-500">Notes</label>
                <div className="text-base text-gray-900 mt-1">{greige.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Width & Shrinkage Information */}
        <Card>
          <CardHeader>
            <CardTitle>Width & Shrinkage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Greige Width</label>
                <div className="text-base font-semibold text-gray-900">{Number(greige.greigeWidth)}"</div>
              </div>
              {greige.expectedFinishedWidthMin && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Min Finished Width</label>
                  <div className="text-base text-gray-900">{Number(greige.expectedFinishedWidthMin)}"</div>
                </div>
              )}
              {greige.expectedFinishedWidthMax && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Max Finished Width</label>
                  <div className="text-base text-gray-900">{Number(greige.expectedFinishedWidthMax)}"</div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Avg Shrinkage</label>
                <div className="text-base text-gray-900">{Number(greige.averageShrinkagePercent).toFixed(1)}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Finished Fabrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Finished Fabrics ({finishedFabrics.length})</span>
              <Link to={`/fabric/new?greigeId=${id}`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Finished Fabric
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {finishedFabrics.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fabric Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fabric Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Finish Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Width</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {finishedFabrics.map((fabric) => (
                      <tr key={fabric.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-blue-600">
                          <Link to={`/fabric/${fabric.id}`} className="hover:text-blue-800">
                            {fabric.fabricCode}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{fabric.fabricName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{fabric.colorName || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{fabric.finishType || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{Number(fabric.actualWidth)}"</td>
                        <td className="px-4 py-3 text-sm">
                          <StatusBadge
                            status={fabric.isActive ? 'Active' : 'Inactive'}
                            variant={fabric.isActive ? 'success' : 'secondary'}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <Link to={`/fabric/${fabric.id}`}>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <div className="text-sm text-gray-500">No finished fabrics created from this greige yet</div>
                <Link to={`/fabric/new?greigeId=${id}`}>
                  <Button variant="outline" size="sm" className="mt-3">
                    Create First Finished Fabric
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock Entries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div>
                <div>Stock Entries ({stockEntries.length})</div>
                {stockEntries.length > 0 && (
                  <div className="text-sm font-normal text-gray-500 mt-1">
                    Total: {getTotalStockQuantity().toFixed(2)}m
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Link to={`/greige-stock?filter=${id}`}>
                  <Button variant="outline" size="sm">
                    View All Stock
                  </Button>
                </Link>
                <Link to={`/greige-stock-entry?greigeId=${id}`}>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Stock
                  </Button>
                </Link>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stockEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Greige Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Greige Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Composition</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Stock</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stockEntries.map((stock) => (
                      <tr key={stock.greigeId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{stock.greigeCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{stock.greigeName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{stock.composition}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">
                          {stock.totalStock.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{stock.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <div className="text-sm text-gray-500">No stock entries for this greige yet</div>
                <Link to={`/greige-stock-entry?greigeId=${id}`}>
                  <Button variant="outline" size="sm" className="mt-3">
                    Add First Stock Entry
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Information */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Created At</label>
                <div className="text-base text-gray-900">{new Date(greige.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Last Updated</label>
                <div className="text-base text-gray-900">{new Date(greige.updatedAt).toLocaleString()}</div>
              </div>
              {greige.createdBy && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Created By</label>
                  <div className="text-base text-gray-900">
                    {greige.createdBy.firstName} {greige.createdBy.lastName}
                  </div>
                  <div className="text-sm text-gray-500">{greige.createdBy.email}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Greige Master"
        description={`Are you sure you want to delete "${greige.greigeName}"? This action cannot be undone. ${
          finishedFabrics.length > 0 ? `This will also affect ${finishedFabrics.length} finished fabric(s).` : ''
        }`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
