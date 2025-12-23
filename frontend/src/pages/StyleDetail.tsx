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
import { getUploadUrl } from '../config/api.config';
import StyleLabelConfig from '@/components/StyleLabelConfig';

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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bom">Bill of Materials</TabsTrigger>
            <TabsTrigger value="labels">Labels</TabsTrigger>
            <TabsTrigger value="value">Value Additions</TabsTrigger>
            <TabsTrigger value="costing">Costing</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
          </TabsList>

          {/* Tab 1: Overview */}
          <TabsContent value="overview">
            <div className="grid gap-6">
              {/* Summary Cards Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Cost Per Piece Card */}
                <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-green-600">Total Cost Per Piece</p>
                    <p className="text-2xl font-bold text-green-700">
                      {style.costing ? `₹${style.costing.totalCostPerPiece?.toLocaleString() || 0}` : 'Not Set'}
                    </p>
                    {style.costing?.sellingPricePerPiece && (
                      <p className="text-xs text-green-600 mt-1">
                        Selling Price: ₹{style.costing.sellingPricePerPiece.toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Components Count Card */}
                <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-blue-600">Number of Components</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {style.components?.length || style.numberOfComponents || 0}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Garment parts in this style
                    </p>
                  </CardContent>
                </Card>

                {/* BOM Summary Card */}
                <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-purple-600">Bill of Materials</p>
                    <p className="text-lg font-bold text-purple-700">
                      {style.garmentTrims?.length || 0} Trims
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      {style.packaging?.length || 0} Packaging Items
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Main Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Style Image */}
                    {style.imageUrl && (
                      <div className="lg:col-span-1">
                        <p className="text-sm font-medium text-gray-500 mb-2">Product Image</p>
                        <img
                          src={getUploadUrl(style.imageUrl)}
                          alt={style.styleName}
                          className="w-full h-auto rounded-lg shadow-md border border-gray-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* Basic Info Grid */}
                    <div className={style.imageUrl ? "lg:col-span-2" : "lg:col-span-3"}>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                        <div>
                          <p className="text-sm font-medium text-gray-500">Customer/Buyer</p>
                          <p className="text-base font-semibold">{style.customerName}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Brand</p>
                          <p className="text-base font-semibold">{style.brandName}</p>
                        </div>
                        {style.internalCode && (
                          <div>
                            <p className="text-sm font-medium text-gray-500">Internal Code</p>
                            <p className="text-base font-semibold text-blue-600">{style.internalCode}</p>
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
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-500">Description</p>
                          <p className="text-base text-gray-700">{style.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => navigate(`/orders/new?styleId=${style.id}`)}
                      size="lg"
                    >
                      Create Order from This Style
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/styles/${style.id}/costing`)}
                    >
                      {style.costing ? 'View Costing' : 'Add Costing'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 2: Bill of Materials */}
          <TabsContent value="bom">
            <div className="space-y-6">
              {/* Section 1: Components & Fabrics */}
              <Card>
                <CardHeader className="bg-blue-50 border-b">
                  <CardTitle className="text-blue-800">Components & Fabrics</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {style.components && style.components.length > 0 ? (
                    <div className="space-y-6">
                      {style.components.map((component, index) => (
                        <div key={component.id} className="border rounded-lg p-4">
                          <h3 className="font-semibold text-lg mb-3">
                            Component {index + 1}: {component.componentName}
                          </h3>
                          <p className="text-sm text-gray-600 mb-4">Component Type: {component.componentType}</p>

                          {/* Fabrics for this component */}
                          {component.fabrics && component.fabrics.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2 text-blue-700">Fabrics:</h4>
                              <div className="space-y-3">
                                {component.fabrics.map((fabric) => (
                                  <div key={fabric.id} className="bg-blue-50 p-3 rounded border border-blue-100">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                      <div>
                                        <span className="font-medium text-gray-600">Generic Fabric Name:</span>
                                        <span className="ml-1">{fabric.fabricName}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-600">Fabric Finish Type:</span>
                                        <span className="ml-1">{fabric.fabricType}</span>
                                      </div>
                                      {fabric.fabricColor && (
                                        <div>
                                          <span className="font-medium text-gray-600">Color:</span>
                                          <span className="ml-1">{fabric.fabricColor}</span>
                                        </div>
                                      )}
                                      {fabric.fabricGSM && (
                                        <div>
                                          <span className="font-medium text-gray-600">GSM:</span>
                                          <span className="ml-1">{fabric.fabricGSM}</span>
                                        </div>
                                      )}
                                      {fabric.fabricWidth && (
                                        <div>
                                          <span className="font-medium text-gray-600">Width:</span>
                                          <span className="ml-1">{fabric.fabricWidth}"</span>
                                        </div>
                                      )}
                                      {fabric.supplierName && (
                                        <div>
                                          <span className="font-medium text-gray-600">Supplier:</span>
                                          <span className="ml-1">{fabric.supplierName}</span>
                                        </div>
                                      )}
                                      {fabric.cadAverageMeters && (
                                        <div>
                                          <span className="font-medium text-gray-600">CAD Average:</span>
                                          <span className="ml-1">{fabric.cadAverageMeters}m</span>
                                        </div>
                                      )}
                                      {fabric.unitPrice && (
                                        <div>
                                          <span className="font-medium text-gray-600">Unit Price:</span>
                                          <span className="ml-1">₹{fabric.unitPrice}</span>
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
                              <h4 className="font-medium mb-2 text-amber-700">Materials/Accessories:</h4>
                              <div className="space-y-2">
                                {component.accessories.map((accessory) => (
                                  <div key={accessory.id} className="bg-amber-50 p-3 rounded border border-amber-100 text-sm">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <div>
                                        <span className="font-medium text-gray-600">Material Name:</span>
                                        <span className="ml-1">{accessory.accessoryName}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-600">Material Type:</span>
                                        <span className="ml-1">{accessory.accessoryType}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-600">Quantity Per Garment:</span>
                                        <span className="ml-1">{accessory.quantityPerPiece} {accessory.unit}</span>
                                      </div>
                                      {accessory.supplierName && (
                                        <div>
                                          <span className="font-medium text-gray-600">Supplier:</span>
                                          <span className="ml-1">{accessory.supplierName}</span>
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
                    <p className="text-gray-500 text-center py-6">No components added yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Section 2: Garment Trims */}
              <Card>
                <CardHeader className="bg-orange-50 border-b">
                  <CardTitle className="text-orange-800">Garment Trims</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {style.garmentTrims && style.garmentTrims.length > 0 ? (
                    <div className="space-y-3">
                      {style.garmentTrims.map((trim) => {
                        const isBulkItem = trim.trimType?.toUpperCase() === 'THREAD';
                        return (
                          <div key={trim.id} className="border rounded-lg p-4 bg-orange-50 border-orange-100">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">Trim Name</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-base font-semibold">{trim.trimName}</p>
                                  {isBulkItem && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                      Bulk Item
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">Trim Type</p>
                                <p className="text-base font-semibold">{trim.trimType}</p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">
                                  {isBulkItem ? 'Estimated Order Cost' : 'Quantity Per Piece'}
                                </p>
                                <p className="text-base font-semibold">
                                  {isBulkItem
                                    ? `₹ ${trim.quantityPerPiece}`
                                    : `${trim.quantityPerPiece} ${trim.unit}`
                                  }
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
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-6">No garment trims added</p>
                  )}
                </CardContent>
              </Card>

              {/* Section 3: Packaging */}
              <Card>
                <CardHeader className="bg-green-50 border-b">
                  <CardTitle className="text-green-800">Packaging Materials</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {style.packaging && style.packaging.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {style.packaging.map((pkg) => (
                        <div key={pkg.id} className="border rounded-lg p-4 bg-green-50 border-green-100">
                          <h3 className="font-semibold text-lg text-green-700 mb-3">{pkg.itemName}</h3>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-gray-600">Item Type:</span>
                              <span className="ml-2 text-gray-800">{pkg.itemType}</span>
                            </div>
                            {pkg.specification && (
                              <div>
                                <span className="font-medium text-gray-600">Specification:</span>
                                <span className="ml-2 text-gray-800">{pkg.specification}</span>
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-gray-600">Quantity Per Pack:</span>
                              <span className="ml-2 text-gray-800 font-semibold">{pkg.quantityPerPack} pcs</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-6">No packaging materials added</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Labels Configuration */}
          <TabsContent value="labels">
            {style && (
              <StyleLabelConfig
                styleId={style.id}
                styleSizes={style.sizeOptions?.map(so => so.size) || ['XS', 'S', 'M', 'L', 'XL', 'XXL']}
                customerId={style.customerName ? undefined : undefined}
              />
            )}
          </TabsContent>

          {/* Tab 3: Value Additions */}
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

          {/* Tab 4: Costing */}
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
                          <p className="text-lg font-semibold">₹{(style.costing.totalFabricCost ?? 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Accessory Cost</p>
                          <p className="text-lg font-semibold">₹{(style.costing.totalAccessoryCost ?? 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded">
                          <p className="text-sm text-blue-600">Total Material Cost</p>
                          <p className="text-lg font-semibold text-blue-700">
                            ₹{(style.costing.totalMaterialCost ?? 0).toLocaleString()}
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
                          <p className="text-base font-semibold">₹{(style.costing.printingCost ?? 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Dying</p>
                          <p className="text-base font-semibold">₹{(style.costing.dyingCost ?? 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Embroidery</p>
                          <p className="text-base font-semibold">₹{(style.costing.embroideryCost ?? 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Handwork</p>
                          <p className="text-base font-semibold">₹{(style.costing.handworkCost ?? 0).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    {/* Production Costs */}
                    <div>
                      <h3 className="font-semibold text-lg mb-3">Production Costs</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Cutting</p>
                          <p className="text-base font-semibold">₹{(style.costing.cuttingCost ?? 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Stitching</p>
                          <p className="text-base font-semibold">₹{(style.costing.stitchingCost ?? 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Finishing</p>
                          <p className="text-base font-semibold">₹{(style.costing.finishingCost ?? 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Checking</p>
                          <p className="text-base font-semibold">₹{(style.costing.checkingCost ?? 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm text-gray-600">Packing</p>
                          <p className="text-base font-semibold">₹{(style.costing.packingCost ?? 0).toLocaleString()}</p>
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
                            ₹{(style.costing.totalCostPerPiece ?? 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-green-50 p-4 rounded">
                          <p className="text-sm text-green-600">Selling Price Per Piece</p>
                          <p className="text-2xl font-bold text-green-700">
                            ₹{(style.costing.sellingPricePerPiece ?? 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded">
                          <p className="text-sm text-purple-600">Profit Margin</p>
                          <p className="text-2xl font-bold text-purple-700">
                            {style.costing.profitMargin ?? 0}%
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

          {/* Tab 5: Production Tracking */}
          <TabsContent value="production">
            <Card>
              <CardHeader>
                <CardTitle>Production Status</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Aggregated production status across all orders for this style
                </p>
              </CardHeader>
              <CardContent>
                {style.productionTracking && style.productionTracking.length > 0 ? (
                  <div className="space-y-6">
                    {style.productionTracking.map((tracking) => (
                      <div key={tracking.id}>
                        {/* Current Stage */}
                        <div className="mb-6">
                          <h3 className="font-semibold text-lg mb-4">Current Stage</h3>
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
