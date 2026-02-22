import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPackagingById } from '@/services/packaging.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import type { Packaging } from '@/types/packaging.types';
import { handleApiError } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { ArrowLeft, Edit, Package, Ruler, DollarSign, Building2, FileText, Printer, Layers } from 'lucide-react';

export default function PackagingDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const [packaging, setPackaging] = useState<Packaging | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'PURCHASE' || currentUser?.role === 'MERCHANDISER';

  useEffect(() => {
    if (id) {
      fetchPackagingDetails();
    }
  }, [id]);

  const fetchPackagingDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPackagingById(id!);
      setPackaging(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load packaging details', false);
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
          <p className="mt-4 text-gray-600">Loading packaging details...</p>
        </div>
      </div>
    );
  }

  if (error || !packaging) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/materials/packaging')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Packaging
            </Button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-red-600">{error || 'Packaging not found'}</p>
              <Button onClick={() => navigate('/materials/packaging')} className="mt-4">
                Return to Packaging
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
          <Button variant="ghost" onClick={() => navigate('/materials/packaging')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Packaging
          </Button>
          {canEdit && (
            <Button onClick={() => navigate(`/materials/packaging/${packaging.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Packaging
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
                  <CardTitle className="text-3xl">{packaging.packagingName}</CardTitle>
                  <StatusBadge
                    status={packaging.isActive ? 'Active' : 'Inactive'}
                    variant={packaging.isActive ? 'success' : 'secondary'}
                  />
                </div>
                <p className="text-gray-600">Packaging Code: {packaging.packagingCode}</p>
                {packaging.materialCode && (
                  <p className="text-gray-500 text-sm">Material Code: {packaging.materialCode}</p>
                )}
              </div>
              {packaging.image && (
                <img
                  src={packaging.image}
                  alt={packaging.packagingName}
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
              {packaging.packagingType && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Packaging Type</label>
                  <p className="text-gray-900">{packaging.packagingType}</p>
                </div>
              )}
              {packaging.material && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Material</label>
                  <p className="text-gray-900">{packaging.material}</p>
                </div>
              )}
              {!packaging.packagingType && !packaging.material && (
                <p className="text-gray-500 text-sm">No basic information available</p>
              )}
            </CardContent>
          </Card>

          {/* Specifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Ruler className="h-5 w-5" />
                Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {packaging.size && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Size</label>
                  <p className="text-gray-900 text-xl font-semibold">{packaging.size}</p>
                </div>
              )}
              {packaging.thickness && (
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-gray-500" />
                  <div>
                    <label className="text-sm font-medium text-gray-600">Thickness</label>
                    <p className="text-gray-900">{packaging.thickness}</p>
                  </div>
                </div>
              )}
              {packaging.printDetails && (
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-gray-500" />
                  <div>
                    <label className="text-sm font-medium text-gray-600">Print Details</label>
                    <p className="text-gray-900">{packaging.printDetails}</p>
                  </div>
                </div>
              )}
              {!packaging.size && !packaging.thickness && !packaging.printDetails && (
                <p className="text-gray-500 text-sm">No specifications available</p>
              )}
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {packaging.pricePerPiece && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Price per Piece</label>
                  <p className="text-gray-900 text-2xl font-semibold">
                    {formatCurrency(packaging.pricePerPiece)}
                  </p>
                </div>
              )}
              {packaging.pricePerHundred && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Price per 100 pcs</label>
                  <p className="text-gray-900 text-2xl font-semibold">
                    {formatCurrency(packaging.pricePerHundred)}
                  </p>
                </div>
              )}
              {!packaging.pricePerPiece && !packaging.pricePerHundred && (
                <p className="text-gray-500 text-sm">No pricing information available</p>
              )}
            </CardContent>
          </Card>

          {/* Supplier Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Supplier & Codes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {packaging.supplierName && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Supplier</label>
                  <p className="text-gray-900">{packaging.supplierName}</p>
                </div>
              )}
              {packaging.supplierCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Supplier Code</label>
                  <p className="text-gray-900 font-mono">{packaging.supplierCode}</p>
                </div>
              )}
              {packaging.buyerCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Buyer Code</label>
                  <p className="text-gray-900 font-mono">{packaging.buyerCode}</p>
                </div>
              )}
              {!packaging.supplierName && !packaging.supplierCode && !packaging.buyerCode && (
                <p className="text-gray-500 text-sm">No supplier information available</p>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {packaging.description && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-900 whitespace-pre-line">{packaging.description}</p>
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
                  <p className="text-gray-900">{new Date(packaging.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Updated</label>
                  <p className="text-gray-900">{new Date(packaging.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
