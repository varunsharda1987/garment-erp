import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Plus, Package, DollarSign, Ruler, Palette } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { StatusBadge } from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { handleApiError, handleApiSuccess } from '../lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { fabricService } from '../services/fabricGreigeService';
import type { FabricMaster, FabricWidthCAD, FabricStyleAllocation } from '../types/fabric-greige.types';
import { logError } from '../lib/logger';
import AllocatedStylesCard from '../components/fabric/AllocatedStylesCard';

interface FabricStock {
  id: string;
  fabricId: string;
  width: number;
  quantityAvailable: number;
  quantityReserved: number;
  quantityConsumed: number;
  unit: string;
  status: string;
  stockType: string;
  weightedAvgCost?: number;
  purchaseCost?: number;
  qualityGrade: string;
  warehouseLocation?: string;
  rackNumber?: string;
  receivedDate: string;
  agingDays?: number;
}

export default function FabricDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fabric, setFabric] = useState<FabricMaster | null>(null);
  const [widthCADs, setWidthCADs] = useState<FabricWidthCAD[]>([]);
  const [stockEntries, setStockEntries] = useState<FabricStock[]>([]);
  const [allocations, setAllocations] = useState<FabricStyleAllocation[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchFabricDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Update document title when fabric data is loaded
  useEffect(() => {
    if (fabric) {
      document.title = `${fabric.fabricName} - Kashaya Fabs ERP`;
    }
    return () => {
      document.title = 'Kashaya Fabs ERP';
    };
  }, [fabric]);

  const fetchFabricDetails = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch fabric master details
      const fabricData = await fabricService.getById(id);
      setFabric(fabricData);

      // Get auth token
      const getAuthHeaders = (): Record<string, string> => {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          try {
            const { state } = JSON.parse(authStorage);
            return state?.token ? { Authorization: `Bearer ${state.token}` } : {};
          } catch {
            return {};
          }
        }
        return {};
      };

      // Fetch width CADs for this fabric
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/fabric-management/cad/fabric/${id}`, {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setWidthCADs(data);
        }
      } catch (err) {
        logError('Error loading width CADs:', err);
        setWidthCADs([]);
      }

      // Fetch stock entries for this fabric
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/stock?fabricId=${id}`, {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setStockEntries(data.data || []);
        }
      } catch (err) {
        logError('Error loading stock entries:', err);
        setStockEntries([]);
      }

      // Fetch style allocations for this fabric
      try {
        setLoadingAllocations(true);
        const allocData = await fabricService.getStyleAllocations(id);
        setAllocations(allocData.allocations || []);
      } catch (err) {
        logError('Error loading style allocations:', err);
        setAllocations([]);
      } finally {
        setLoadingAllocations(false);
      }
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load fabric details', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !fabric) return;

    try {
      await fabricService.delete(id);
      handleApiSuccess('Fabric deleted', `${fabric.fabricName} has been successfully deleted.`);
      navigate('/fabric');
    } catch (err: unknown) {
      handleApiError(err, 'Failed to delete fabric master');
    }
  };

  const getTotalStockQuantity = () => {
    return stockEntries.reduce((sum, stock) => sum + stock.quantityAvailable, 0);
  };

  const getTotalStockValue = () => {
    return stockEntries.reduce((sum, stock) => {
      const cost = stock.weightedAvgCost || stock.purchaseCost || 0;
      return sum + stock.quantityAvailable * cost;
    }, 0);
  };

  const getPreferredCAD = () => {
    return widthCADs.find((cad) => cad.isPreferred);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Loading fabric details...</div>
      </div>
    );
  }

  if (error || !fabric) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-lg text-destructive mb-4">{error || 'Fabric not found'}</div>
        <Button onClick={() => navigate('/fabric')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Fabric Master
        </Button>
      </div>
    );
  }

  const preferredCAD = getPreferredCAD();

  return (
    <>
      <PageHeader title={fabric.fabricName}>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/fabric')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const styleAllocation = allocations?.[0];
              if (styleAllocation?.component?.style?.id) {
                navigate(`/styles/${styleAllocation.component.style.id}/stock-entry`);
              } else {
                navigate(`/fabric-stock-entry?fabricId=${id}`);
              }
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Stock
          </Button>
          <Button variant="outline" onClick={() => navigate(`/fabric/${id}/edit`)}>
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
      <div className="mb-4 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-info">
          Home
        </Link>
        {' > '}
        <Link to="/fabric" className="hover:text-info">
          Fabric Master
        </Link>
        {' > '}
        <span className="font-medium text-foreground">{fabric.fabricCode}</span>
      </div>

      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Stock</p>
                  <p className="text-2xl font-bold text-foreground">{getTotalStockQuantity().toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">meters</p>
                </div>
                <Package className="h-8 w-8 text-info" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Stock Value</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(getTotalStockValue())}</p>
                  <p className="text-xs text-muted-foreground mt-1">total value</p>
                </div>
                <DollarSign className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Actual Width</p>
                  <p className="text-2xl font-bold text-foreground">{Number(fabric.actualWidth)}"</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fabric.cutableWidth ? `${Number(fabric.cutableWidth)}" cutable` : 'no cutable width'}
                  </p>
                </div>
                <Ruler className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Width CADs</p>
                  <p className="text-2xl font-bold text-foreground">{widthCADs.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {preferredCAD ? `${preferredCAD.availableWidth}" preferred` : 'no preferred'}
                  </p>
                </div>
                <Palette className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Basic Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Basic Information</span>
              <div className="flex gap-2">
                <StatusBadge
                  status={fabric.isGeneric ? 'Generic' : 'Style-Specific'}
                  variant={fabric.isGeneric ? 'info' : 'warning'}
                />
                <StatusBadge
                  status={fabric.isActive ? 'Active' : 'Inactive'}
                  variant={fabric.isActive ? 'success' : 'secondary'}
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Fabric Code</label>
                <div className="text-base font-semibold text-foreground">{fabric.fabricCode}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Fabric Name</label>
                <div className="text-base text-foreground">{fabric.fabricName}</div>
              </div>
              {fabric.genericGreigeName && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Generic Greige Name</label>
                  <div className="text-base text-foreground">{fabric.genericGreigeName}</div>
                </div>
              )}
              {fabric.styleReference && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Style Reference</label>
                  <div className="text-base text-foreground">{fabric.styleReference}</div>
                </div>
              )}
              {fabric.colorName && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Color</label>
                  <div className="flex items-center gap-2">
                    <div className="text-base text-foreground">{fabric.colorName}</div>
                    {fabric.colorCode && (
                      <div
                        className="w-6 h-6 rounded border border-border"
                        style={{ backgroundColor: fabric.colorCode }}
                        title={fabric.colorCode}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {fabric.description && (
              <div className="mt-6">
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <div className="text-base text-foreground mt-1">{fabric.description}</div>
              </div>
            )}

            {fabric.notes && (
              <div className="mt-4">
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                <div className="text-base text-foreground mt-1">{fabric.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Greige Base Information */}
        {fabric.greige && (
          <Card>
            <CardHeader>
              <CardTitle>Greige Base</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Greige Code</label>
                  <Link to={`/greige/${fabric.greige.id}`} className="text-base text-info hover:underline font-medium">
                    {fabric.greige.greigeCode}
                  </Link>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Greige Name</label>
                  <div className="text-base text-foreground">{fabric.greige.greigeName}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Composition</label>
                  <div className="text-base text-foreground">{fabric.greige.composition}</div>
                </div>
                {fabric.greige.yarnCount && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Yarn Count</label>
                    <div className="text-base text-foreground">{fabric.greige.yarnCount}</div>
                  </div>
                )}
                {fabric.greige.construction && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Greige Construction</label>
                    <div className="text-base text-foreground">{fabric.greige.construction}</div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Greige Width</label>
                  <div className="text-base text-foreground">{Number(fabric.greige.greigeWidth)}"</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Finished Fabric Specifications */}
        <Card>
          <CardHeader>
            <CardTitle>Finished Fabric Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Actual Width</label>
                <div className="text-base font-semibold text-foreground">{Number(fabric.actualWidth)}"</div>
              </div>
              {fabric.cutableWidth && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cutable Width</label>
                  <div className="text-base font-semibold text-foreground">{Number(fabric.cutableWidth)}"</div>
                </div>
              )}
              {fabric.finishedConstruction && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Finished Construction</label>
                  <div className="text-base text-foreground">{fabric.finishedConstruction}</div>
                </div>
              )}
              {fabric.actualGSM && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Actual GSM</label>
                  <div className="text-base text-foreground">{fabric.actualGSM}</div>
                </div>
              )}
              {fabric.finishType && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Finish Type</label>
                  <div className="text-base text-foreground">{fabric.finishType}</div>
                </div>
              )}
              {fabric.printDesign && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Print Design</label>
                  <div className="text-base text-foreground">{fabric.printDesign}</div>
                </div>
              )}
              {(fabric.yarnCount || fabric.greige?.yarnCount) && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Yarn Count</label>
                  <div className="text-base text-foreground">{fabric.yarnCount || fabric.greige?.yarnCount}</div>
                </div>
              )}
              {(fabric.composition || fabric.greige?.composition) && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Composition</label>
                  <div className="text-base text-foreground">{fabric.composition || fabric.greige?.composition}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Value Addition */}
        {(fabric.valueAddition || fabric.valueAdditionCost) && (
          <Card>
            <CardHeader>
              <CardTitle>Value Addition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {fabric.valueAddition && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Value Addition Type</label>
                    <div className="text-base text-foreground">{fabric.valueAddition}</div>
                  </div>
                )}
                {fabric.valueAdditionCost && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Value Addition Cost</label>
                    <div className="text-base font-semibold text-foreground">
                      {formatCurrency(fabric.valueAdditionCost)}/meter
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Width CADs */}
        {widthCADs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Width CAD Options</span>
                <Link to={`/fabric/${id}/cad/new`}>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add CAD
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Width</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        CAD (m)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        CAD (yd)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Wastage %
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Efficiency %
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Availability
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-gray-200">
                    {widthCADs.map((cad) => (
                      <tr key={cad.id} className="hover:bg-muted">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {cad.availableWidth} {cad.widthUnit}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">{cad.cadMeters?.toFixed(3) || '-'}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{cad.cadYards?.toFixed(3) || '-'}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{cad.cadWastagePercent}%</td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {cad.markerEfficiency?.toFixed(2) || '-'}%
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">{cad.supplierAvailability || '-'}</td>
                        <td className="px-4 py-3">
                          {cad.isPreferred && <StatusBadge status="Preferred" variant="success" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stock Entries */}
        {stockEntries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Stock Entries ({stockEntries.length})</span>
                <Link to="/fabric-stock">
                  <Button size="sm" variant="outline">
                    View All Stock
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Width</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Available
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Reserved
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Quality
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Cost/m
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Aging</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-gray-200">
                    {stockEntries.map((stock) => (
                      <tr key={stock.id} className="hover:bg-muted">
                        <td className="px-4 py-3 text-sm text-foreground">{stock.width}"</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {stock.quantityAvailable.toFixed(2)} {stock.unit}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {stock.quantityReserved.toFixed(2)} {stock.unit}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={stock.qualityGrade}
                            variant={
                              stock.qualityGrade === 'A'
                                ? 'success'
                                : stock.qualityGrade === 'B'
                                  ? 'warning'
                                  : 'destructive'
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {stock.warehouseLocation || '-'}
                          {stock.rackNumber && ` / ${stock.rackNumber}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {formatCurrency(stock.weightedAvgCost || stock.purchaseCost || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {stock.agingDays !== undefined ? `${stock.agingDays} days` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={stock.status}
                            variant={
                              stock.status === 'AVAILABLE'
                                ? 'success'
                                : stock.status === 'RESERVED'
                                  ? 'warning'
                                  : 'secondary'
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Suppliers */}
        {fabric.supplier && fabric.supplier.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Suppliers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fabric.supplier.map((supplierRel, index) => (
                  <div key={index} className="border-b pb-4 last:border-b-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-foreground">{supplierRel.supplier.name}</div>
                      <div className="flex gap-2">
                        {supplierRel.isPreferred && <StatusBadge status="Preferred" variant="success" />}
                        <StatusBadge
                          status={supplierRel.isActive ? 'Active' : 'Inactive'}
                          variant={supplierRel.isActive ? 'success' : 'secondary'}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Code:</span> {supplierRel.supplier.code}
                      </div>
                      {supplierRel.supplier.contactPerson && (
                        <div>
                          <span className="font-medium">Contact:</span> {supplierRel.supplier.contactPerson}
                        </div>
                      )}
                      {supplierRel.supplier.phone && (
                        <div>
                          <span className="font-medium">Phone:</span> {supplierRel.supplier.phone}
                        </div>
                      )}
                    </div>
                    {supplierRel.notes && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <span className="font-medium">Notes:</span> {supplierRel.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Allocated Styles - Read Only */}
        <AllocatedStylesCard allocations={allocations} editable={false} isLoading={loadingAllocations} />
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Fabric Master"
        description={`Are you sure you want to delete ${fabric.fabricName}? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
