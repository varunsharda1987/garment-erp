import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getMaterialById } from '@/services/material.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import type { Material } from '@/types/material.types';
import { UnitLabels } from '@/types/material.types';
import { handleApiError } from '@/lib/api-error-handler';
import { ArrowLeft, Edit, Package, Layers, Building2, FileText, AlertTriangle, Warehouse } from 'lucide-react';

export default function MaterialDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'PURCHASE' || currentUser?.role === 'MERCHANDISER';

  useEffect(() => {
    if (id) {
      fetchMaterialDetails();
    }
  }, [id]);

  const fetchMaterialDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const material = await getMaterialById(id!);
      setMaterial(material);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load material details', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading material details...</p>
        </div>
      </div>
    );
  }

  if (error || !material) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/materials')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Materials
            </Button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-red-600">{error || 'Material not found'}</p>
              <Button onClick={() => navigate('/materials')} className="mt-4">
                Return to Materials
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate('/materials')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Materials
          </Button>
          {canEdit && (
            <Button onClick={() => navigate(`/materials/raw/${material.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Material
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-3xl">{material.name}</CardTitle>
                  <StatusBadge
                    status={material.isActive ? 'Active' : 'Inactive'}
                    variant={material.isActive ? 'success' : 'secondary'}
                  />
                </div>
                <p className="text-gray-600">Material Code: {material.code}</p>
                {material.category && (
                  <p className="text-gray-500 text-sm">Category: {material.category.name}</p>
                )}
              </div>
              {material.image && (
                <img
                  src={material.image}
                  alt={material.name}
                  className="w-24 h-24 object-cover rounded-lg border"
                  loading="lazy"
                />
              )}
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Unit</label>
                <p className="text-gray-900">{UnitLabels[material.unit] || material.unit}</p>
              </div>
              {material.reorderLevel && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <div>
                    <label className="text-sm font-medium text-gray-600">Reorder Level</label>
                    <p className="text-gray-900">{material.reorderLevel} {UnitLabels[material.unit] || material.unit}</p>
                  </div>
                </div>
              )}
              {material.specifications && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Specifications</label>
                  <p className="text-gray-900 whitespace-pre-line">{material.specifications}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Data */}
          {material.categoryData && Object.keys(material.categoryData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Category Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(material.categoryData).map(([key, value]) => {
                  if (value === null || value === undefined) return null;
                  const displayKey = key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, (str) => str.toUpperCase())
                    .trim();
                  return (
                    <div key={key}>
                      <label className="text-sm font-medium text-gray-600">{displayKey}</label>
                      <p className="text-gray-900">{String(value)}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Suppliers */}
          <Card className={material.categoryData && Object.keys(material.categoryData).length > 0 ? '' : 'lg:col-span-1'}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Suppliers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {material.suppliers && material.suppliers.length > 0 ? (
                <div className="space-y-3">
                  {material.suppliers.map((supplierRel, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{supplierRel.supplier.name}</p>
                          <p className="text-sm text-gray-500">{supplierRel.supplier.code}</p>
                        </div>
                        <div className="flex gap-2">
                          {supplierRel.isPreferred && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                              Preferred
                            </span>
                          )}
                          <StatusBadge
                            status={supplierRel.isActive ? 'Active' : 'Inactive'}
                            variant={supplierRel.isActive ? 'success' : 'secondary'}
                          />
                        </div>
                      </div>
                      {supplierRel.supplier.contactPerson && (
                        <p className="text-sm text-gray-600 mt-1">Contact: {supplierRel.supplier.contactPerson}</p>
                      )}
                      {supplierRel.notes && (
                        <p className="text-sm text-gray-500 mt-1 italic">{supplierRel.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No suppliers assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Inventory Stock */}
          {material.inventoryStock && material.inventoryStock.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Warehouse className="h-5 w-5" />
                  Stock Levels
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {material.inventoryStock.map((stock) => (
                    <div key={stock.id} className="p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {stock.location?.locationName || 'Unknown Location'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {stock.location?.locationCode}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-semibold text-gray-900">
                            {stock.quantity.toLocaleString('en-IN')}
                          </p>
                          <p className="text-sm text-gray-500">
                            {UnitLabels[stock.unit] || stock.unit}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Description */}
          {material.description && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-900 whitespace-pre-line">{material.description}</p>
              </CardContent>
            </Card>
          )}

          {/* System Information */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Created At</label>
                  <p className="text-gray-900">{new Date(material.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Updated</label>
                  <p className="text-gray-900">{new Date(material.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
