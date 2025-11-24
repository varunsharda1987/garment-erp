import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { styleService } from '@/services/style.service';
import type { Style, ProductionStage } from '@/types/style.types';
import { PRODUCTION_STAGE_LABELS } from '@/types/style.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logError } from '@/lib/logger';

export default function StyleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [style, setStyle] = useState<Style | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStage, setUpdatingStage] = useState(false);

  useEffect(() => {
    if (id) {
      loadStyleData(id);
    }
  }, [id]);

  const loadStyleData = async (styleId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await styleService.getStyleById(styleId);
      setStyle(data);
    } catch (err: any) {
      logError('Error loading style:', err);
      setError(err.response?.data?.message || 'Failed to load style details');
    } finally {
      setLoading(false);
    }
  };

  const handleStageUpdate = async (newStage: ProductionStage) => {
    if (!id || !style) return;

    const confirmed = window.confirm(
      `Update production stage to "${PRODUCTION_STAGE_LABELS[newStage]}"?`
    );

    if (!confirmed) return;

    try {
      setUpdatingStage(true);
      await styleService.updateProductionStage(id, newStage);
      // Reload style data to get updated tracking
      await loadStyleData(id);
      alert('Production stage updated successfully!');
    } catch (err: any) {
      logError('Error updating stage:', err);
      alert(err.response?.data?.message || 'Failed to update production stage');
    } finally {
      setUpdatingStage(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-500">Loading style details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !style) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <p className="text-red-600">{error || 'Style not found'}</p>
              <Button onClick={() => navigate('/styles')} className="mt-4">
                Back to Styles
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{style.styleCode}</h1>
            {style.styleName && (
              <p className="text-lg text-gray-600 mt-1">{style.styleName}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/styles')}>
              Back to List
            </Button>
            <Button onClick={() => navigate(`/styles/${style.id}/edit`)}>
              Edit Style
            </Button>
          </div>
        </div>

        {/* Main Content with Tabs */}
        <Tabs defaultValue="basic" className="space-y-4">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="components">Components & Fabrics</TabsTrigger>
            <TabsTrigger value="trims">Garment Trims</TabsTrigger>
            <TabsTrigger value="value">Value Additions</TabsTrigger>
            <TabsTrigger value="packaging">Packaging</TabsTrigger>
            <TabsTrigger value="costing">Costing</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
          </TabsList>

          {/* Tab 1: Basic Information */}
          <TabsContent value="basic">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {/* Style Image */}
                  {style.imageUrl && (
                    <div className="flex justify-center mb-4">
                      <img
                        src={`http://localhost:5000${style.imageUrl}`}
                        alt={style.styleName}
                        className="max-w-md w-full h-auto rounded-lg shadow-md border border-gray-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Buyer Name</p>
                      <p className="text-base font-semibold">{style.customerName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Brand Name</p>
                      <p className="text-base font-semibold">{style.brandName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Style Code</p>
                      <p className="text-base font-semibold">{style.styleCode}</p>
                    </div>
                    {style.styleName && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">Style Name</p>
                        <p className="text-base font-semibold">{style.styleName}</p>
                      </div>
                    )}
                    {style.season && (
                      <div>
                        <p className="text-sm font-medium text-gray-500">Season</p>
                        <p className="text-base font-semibold">{style.season}</p>
                      </div>
                    )}
                  </div>
                  {style.description && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Description</p>
                      <p className="text-base">{style.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Create Order Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      This style is ready for orders. Create a new order to specify customer, quantities, colors, and sizes.
                    </p>
                    <Button
                      onClick={() => navigate(`/orders/new?styleId=${style.id}`)}
                      className="w-full sm:w-auto"
                      size="lg"
                    >
                      Create Order from This Style
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 2: Components & Fabrics */}
          <TabsContent value="components">
            <Card>
              <CardHeader>
                <CardTitle>Components & Fabrics</CardTitle>
              </CardHeader>
              <CardContent>
                {style.components && style.components.length > 0 ? (
                  <div className="space-y-6">
                    {style.components.map((component, index) => (
                      <div key={component.id} className="border rounded-lg p-4">
                        <h3 className="font-semibold text-lg mb-3">
                          Component {index + 1}: {component.componentName}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">Type: {component.componentType}</p>

                        {/* Fabrics for this component */}
                        {component.fabrics && component.fabrics.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Fabrics:</h4>
                            <div className="space-y-3">
                              {component.fabrics.map((fabric) => (
                                <div key={fabric.id} className="bg-gray-50 p-3 rounded">
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                    <div>
                                      <span className="font-medium">Name:</span> {fabric.fabricName}
                                    </div>
                                    <div>
                                      <span className="font-medium">Type:</span> {fabric.fabricType}
                                    </div>
                                    {fabric.fabricColor && (
                                      <div>
                                        <span className="font-medium">Color:</span> {fabric.fabricColor}
                                      </div>
                                    )}
                                    {fabric.fabricGSM && (
                                      <div>
                                        <span className="font-medium">GSM:</span> {fabric.fabricGSM}
                                      </div>
                                    )}
                                    {fabric.fabricWidth && (
                                      <div>
                                        <span className="font-medium">Width:</span> {fabric.fabricWidth}"
                                      </div>
                                    )}
                                    {fabric.supplierName && (
                                      <div>
                                        <span className="font-medium">Supplier:</span> {fabric.supplierName}
                                      </div>
                                    )}
                                    {fabric.cadAverageMeters && (
                                      <div>
                                        <span className="font-medium">CAD Average:</span> {fabric.cadAverageMeters}m
                                      </div>
                                    )}
                                    {fabric.unitPrice && (
                                      <div>
                                        <span className="font-medium">Unit Price:</span> ₹{fabric.unitPrice}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Accessories for this component */}
                        {component.accessories && component.accessories.length > 0 && (
                          <div className="mt-4">
                            <h4 className="font-medium mb-2">Accessories:</h4>
                            <div className="space-y-2">
                              {component.accessories.map((accessory) => (
                                <div key={accessory.id} className="bg-gray-50 p-3 rounded text-sm">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div>
                                      <span className="font-medium">Name:</span> {accessory.accessoryName}
                                    </div>
                                    <div>
                                      <span className="font-medium">Type:</span> {accessory.accessoryType}
                                    </div>
                                    <div>
                                      <span className="font-medium">Quantity:</span> {accessory.quantityPerPiece} {accessory.unit}
                                    </div>
                                    {accessory.supplierName && (
                                      <div>
                                        <span className="font-medium">Supplier:</span> {accessory.supplierName}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No components added yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Garment Trims */}
          <TabsContent value="trims">
            <Card>
              <CardHeader>
                <CardTitle>Garment Trims</CardTitle>
              </CardHeader>
              <CardContent>
                {style.garmentTrims && style.garmentTrims.length > 0 ? (
                  <div className="space-y-3">
                    {style.garmentTrims.map((trim) => (
                      <div key={trim.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="font-medium text-gray-500">Trim Name</p>
                            <p className="text-base font-semibold">{trim.trimName}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-500">Type</p>
                            <p className="text-base font-semibold">{trim.trimType}</p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-500">Quantity</p>
                            <p className="text-base font-semibold">
                              {trim.quantityPerPiece} {trim.unit} per piece
                            </p>
                          </div>
                          {trim.supplier && (
                            <div>
                              <p className="font-medium text-gray-500">Supplier</p>
                              <p className="text-base font-semibold">{trim.supplier}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No garment trims added</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: Value Additions */}
          <TabsContent value="value">
            <Card>
              <CardHeader>
                <CardTitle>Value Additions</CardTitle>
              </CardHeader>
              <CardContent>
                {style.valueAdditions && style.valueAdditions.length > 0 ? (
                  <div className="space-y-4">
                    {style.valueAdditions.map((addition) => (
                      <div key={addition.id} className="border rounded-lg p-4 bg-gradient-to-r from-purple-50 to-white">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg text-purple-700">{addition.additionType}</h3>
                          {addition.estimatedCost && (
                            <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full font-medium">
                              ₹{addition.estimatedCost}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {addition.description && (
                            <div>
                              <p className="font-medium text-gray-600">Description:</p>
                              <p className="text-gray-800">{addition.description}</p>
                            </div>
                          )}
                          {addition.vendor && (
                            <div>
                              <p className="font-medium text-gray-600">Vendor:</p>
                              <p className="text-gray-800">{addition.vendor}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No value additions added</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 5: Packaging */}
          <TabsContent value="packaging">
            <Card>
              <CardHeader>
                <CardTitle>Packaging Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                {style.packaging && style.packaging.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {style.packaging.map((pkg) => (
                      <div key={pkg.id} className="border rounded-lg p-4 bg-green-50">
                        <h3 className="font-semibold text-lg text-green-700 mb-3">{pkg.itemName}</h3>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-600">Type:</span>
                            <span className="ml-2 text-gray-800">{pkg.itemType}</span>
                          </div>
                          {pkg.specification && (
                            <div>
                              <span className="font-medium text-gray-600">Specification:</span>
                              <span className="ml-2 text-gray-800">{pkg.specification}</span>
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-gray-600">Quantity per Pack:</span>
                            <span className="ml-2 text-gray-800 font-semibold">{pkg.quantityPerPack} pcs</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No packaging requirements added</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 6: Costing */}
          <TabsContent value="costing">
            <Card>
              <CardHeader>
                <CardTitle>Costing Details</CardTitle>
              </CardHeader>
              <CardContent>
                {style.costing ? (
                  <div className="space-y-6">
                    {/* Material Costs */}
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Material Costs</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Fabric Cost</p>
                          <p className="text-lg font-semibold">₹{style.costing.totalFabricCost.toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Accessory Cost</p>
                          <p className="text-lg font-semibold">₹{style.costing.totalAccessoryCost.toLocaleString()}</p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded">
                          <p className="text-sm text-blue-600">Total Material Cost</p>
                          <p className="text-lg font-semibold text-blue-700">
                            ₹{style.costing.totalMaterialCost.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Processing Costs */}
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Processing Costs</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Printing</p>
                          <p className="text-base font-semibold">₹{style.costing.printingCost.toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Dying</p>
                          <p className="text-base font-semibold">₹{style.costing.dyingCost.toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Embroidery</p>
                          <p className="text-base font-semibold">₹{style.costing.embroideryCost.toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Handwork</p>
                          <p className="text-base font-semibold">₹{style.costing.handworkCost.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    {/* Production Costs */}
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Production Costs</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Cutting</p>
                          <p className="text-base font-semibold">₹{style.costing.cuttingCost.toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Stitching</p>
                          <p className="text-base font-semibold">₹{style.costing.stitchingCost.toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Finishing</p>
                          <p className="text-base font-semibold">₹{style.costing.finishingCost.toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Checking</p>
                          <p className="text-base font-semibold">₹{style.costing.checkingCost.toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Packing</p>
                          <p className="text-base font-semibold">₹{style.costing.packingCost.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    {/* Final Costing */}
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-lg mb-3">Final Costing</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-yellow-50 p-4 rounded">
                          <p className="text-sm text-yellow-600">Total Cost Per Piece</p>
                          <p className="text-2xl font-bold text-yellow-700">
                            ₹{style.costing.totalCostPerPiece.toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-green-50 p-4 rounded">
                          <p className="text-sm text-green-600">Selling Price Per Piece</p>
                          <p className="text-2xl font-bold text-green-700">
                            ₹{style.costing.sellingPricePerPiece.toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded">
                          <p className="text-sm text-purple-600">Profit Margin</p>
                          <p className="text-2xl font-bold text-purple-700">
                            {style.costing.profitMargin}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {style.costing.notes && (
                      <div className="bg-gray-50 p-4 rounded">
                        <p className="text-sm font-medium text-gray-600">Notes:</p>
                        <p className="text-base mt-1">{style.costing.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No costing data available</p>
                    <Button onClick={() => navigate(`/styles/${style.id}/costing`)}>
                      Add Costing
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 7: Production Tracking */}
          <TabsContent value="production">
            <Card>
              <CardHeader>
                <CardTitle>Production Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                {style.productionTracking && style.productionTracking.length > 0 ? (
                  <div className="space-y-6">
                    {style.productionTracking.map((tracking) => (
                      <div key={tracking.id}>
                        {/* Current Stage */}
                        <div className="mb-6">
                          <h3 className="font-semibold text-lg mb-4">Current Production Stage</h3>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Select
                                value={tracking.currentStage}
                                onValueChange={(value) => handleStageUpdate(value as ProductionStage)}
                                disabled={updatingStage}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ORDER_RECEIVED">Orders Received</SelectItem>
                                  <SelectItem value="PENDING_COSTING">Pending Costing</SelectItem>
                                  <SelectItem value="PENDING_GREIGE_ORDER">Pending Greige Order</SelectItem>
                                  <SelectItem value="TRIMS_NOT_ORDERED">Trims Not Ordered</SelectItem>
                                  <SelectItem value="IN_PRINTING">In Printing</SelectItem>
                                  <SelectItem value="IN_DYING">In Dying</SelectItem>
                                  <SelectItem value="IN_EMBROIDERY">In Embroidery</SelectItem>
                                  <SelectItem value="IN_HANDWORK">In Handwork</SelectItem>
                                  <SelectItem value="IN_CUTTING">In Cutting</SelectItem>
                                  <SelectItem value="IN_STITCHING">In Stitching</SelectItem>
                                  <SelectItem value="IN_FINISHING">In Finishing</SelectItem>
                                  <SelectItem value="READY_TO_SHIP">Ready to Ship</SelectItem>
                                  <SelectItem value="SHIPPED">Shipped</SelectItem>
                                  <SelectItem value="COMPLETED">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="bg-blue-50 p-4 rounded">
                              <p className="text-sm text-blue-600">Pieces in Stage</p>
                              <p className="text-2xl font-bold text-blue-700">{tracking.piecesInStage}</p>
                            </div>
                          </div>
                        </div>

                        {/* Stage-wise Breakdown */}
                        <div>
                          <h3 className="font-semibold text-lg mb-4">Stage-wise Piece Count</h3>

                          {/* Pre-Production */}
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-orange-700 mb-2">Pre-Production</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-orange-50 p-3 rounded border border-orange-200">
                                <p className="text-xs text-orange-600">Orders Received</p>
                                <p className="text-lg font-semibold text-orange-700">{tracking.piecesOrderReceived}</p>
                              </div>
                              <div className="bg-orange-50 p-3 rounded border border-orange-200">
                                <p className="text-xs text-orange-600">Pending Costing</p>
                                <p className="text-lg font-semibold text-orange-700">{tracking.piecesPendingCosting}</p>
                              </div>
                              <div className="bg-orange-50 p-3 rounded border border-orange-200">
                                <p className="text-xs text-orange-600">Pending Greige</p>
                                <p className="text-lg font-semibold text-orange-700">{tracking.piecesPendingGreige}</p>
                              </div>
                              <div className="bg-orange-50 p-3 rounded border border-orange-200">
                                <p className="text-xs text-orange-600">Trims Not Ordered</p>
                                <p className="text-lg font-semibold text-orange-700">{tracking.piecesTrimsNotOrdered}</p>
                              </div>
                            </div>
                          </div>

                          {/* Processing */}
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-purple-700 mb-2">Processing</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-purple-50 p-3 rounded border border-purple-200">
                                <p className="text-xs text-purple-600">In Printing</p>
                                <p className="text-lg font-semibold text-purple-700">{tracking.piecesInPrinting}</p>
                              </div>
                              <div className="bg-purple-50 p-3 rounded border border-purple-200">
                                <p className="text-xs text-purple-600">In Dying</p>
                                <p className="text-lg font-semibold text-purple-700">{tracking.piecesInDying}</p>
                              </div>
                              <div className="bg-purple-50 p-3 rounded border border-purple-200">
                                <p className="text-xs text-purple-600">In Embroidery</p>
                                <p className="text-lg font-semibold text-purple-700">{tracking.piecesInEmbroidery}</p>
                              </div>
                              <div className="bg-purple-50 p-3 rounded border border-purple-200">
                                <p className="text-xs text-purple-600">In Handwork</p>
                                <p className="text-lg font-semibold text-purple-700">{tracking.piecesInHandwork}</p>
                              </div>
                            </div>
                          </div>

                          {/* Production */}
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-blue-700 mb-2">Production</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                <p className="text-xs text-blue-600">In Cutting</p>
                                <p className="text-lg font-semibold text-blue-700">{tracking.piecesInCutting}</p>
                              </div>
                              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                <p className="text-xs text-blue-600">In Stitching</p>
                                <p className="text-lg font-semibold text-blue-700">{tracking.piecesInStitching}</p>
                              </div>
                              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                                <p className="text-xs text-blue-600">In Finishing</p>
                                <p className="text-lg font-semibold text-blue-700">{tracking.piecesInFinishing}</p>
                              </div>
                            </div>
                          </div>

                          {/* Completion */}
                          <div>
                            <h4 className="text-sm font-medium text-green-700 mb-2">Completion</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              <div className="bg-green-50 p-3 rounded border border-green-200">
                                <p className="text-xs text-green-600">Ready to Ship</p>
                                <p className="text-lg font-semibold text-green-700">{tracking.piecesReadyToShip}</p>
                              </div>
                              <div className="bg-green-50 p-3 rounded border border-green-200">
                                <p className="text-xs text-green-600">Shipped</p>
                                <p className="text-lg font-semibold text-green-700">{tracking.piecesShipped}</p>
                              </div>
                              <div className="bg-green-50 p-3 rounded border border-green-200">
                                <p className="text-xs text-green-600">Completed</p>
                                <p className="text-lg font-semibold text-green-700">{tracking.piecesCompleted}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Last Updated Info */}
                        {tracking.lastUpdatedDate && (
                          <div className="mt-6 bg-gray-50 p-4 rounded">
                            <p className="text-sm text-gray-600">
                              Last Updated: {new Date(tracking.lastUpdatedDate).toLocaleString()}
                            </p>
                            {tracking.lastUpdatedStage && (
                              <p className="text-sm text-gray-600">
                                Previous Stage: {PRODUCTION_STAGE_LABELS[tracking.lastUpdatedStage]}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Notes */}
                        {tracking.notes && (
                          <div className="mt-4 bg-yellow-50 p-4 rounded border border-yellow-200">
                            <p className="text-sm font-medium text-yellow-800">Notes:</p>
                            <p className="text-base mt-1 text-yellow-900">{tracking.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No production tracking data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
