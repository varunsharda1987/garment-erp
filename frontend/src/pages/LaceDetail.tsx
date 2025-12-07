import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getLaceById } from '@/services/lace.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import type { Lace } from '@/types/lace.types';
import { handleApiError } from '@/lib/api-error-handler';
import { ArrowLeft, Edit, Package, Palette, Ruler, DollarSign, Building2, FileText } from 'lucide-react';

export default function LaceDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const [lace, setLace] = useState<Lace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'PURCHASE' || currentUser?.role === 'MERCHANDISER';

  useEffect(() => {
    if (id) {
      fetchLaceDetails();
    }
  }, [id]);

  const fetchLaceDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLaceById(id!);
      setLace(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load lace details', false);
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
          <p className="mt-4 text-gray-600">Loading lace details...</p>
        </div>
      </div>
    );
  }

  if (error || !lace) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/materials/lace')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Lace
            </Button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-red-600">{error || 'Lace not found'}</p>
              <Button onClick={() => navigate('/materials/lace')} className="mt-4">
                Return to Lace
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
          <Button variant="ghost" onClick={() => navigate('/materials/lace')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lace
          </Button>
          {canEdit && (
            <Button onClick={() => navigate(`/materials/lace/${lace.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Lace
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
                  <CardTitle className="text-3xl">{lace.laceName}</CardTitle>
                  <StatusBadge
                    status={lace.isActive ? 'Active' : 'Inactive'}
                    variant={lace.isActive ? 'success' : 'secondary'}
                  />
                </div>
                <p className="text-gray-600">Lace Code: {lace.laceCode}</p>
                {lace.materialCode && (
                  <p className="text-gray-500 text-sm">Material Code: {lace.materialCode}</p>
                )}
              </div>
              {lace.image && (
                <img
                  src={lace.image}
                  alt={lace.laceName}
                  className="w-24 h-24 object-cover rounded-lg border"
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
              {lace.laceType && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Lace Type</label>
                  <p className="text-gray-900">{lace.laceType}</p>
                </div>
              )}
              {lace.design && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Design</label>
                  <p className="text-gray-900">{lace.design}</p>
                </div>
              )}
              {lace.composition && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Composition</label>
                  <p className="text-gray-900">{lace.composition}</p>
                </div>
              )}
              {!lace.laceType && !lace.design && !lace.composition && (
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
              {lace.width && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Width</label>
                  <p className="text-gray-900 text-xl font-semibold">{lace.width} mm</p>
                </div>
              )}
              {lace.color && (
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-gray-500" />
                  <div>
                    <label className="text-sm font-medium text-gray-600">Color</label>
                    <p className="text-gray-900">{lace.color}</p>
                  </div>
                </div>
              )}
              {!lace.width && !lace.color && (
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
            <CardContent>
              {lace.pricePerMeter ? (
                <div>
                  <label className="text-sm font-medium text-gray-600">Price per Meter</label>
                  <p className="text-gray-900 text-2xl font-semibold">
                    ₹{lace.pricePerMeter.toLocaleString('en-IN')}
                  </p>
                </div>
              ) : (
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
              {lace.supplierName && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Supplier</label>
                  <p className="text-gray-900">{lace.supplierName}</p>
                </div>
              )}
              {lace.supplierCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Supplier Code</label>
                  <p className="text-gray-900 font-mono">{lace.supplierCode}</p>
                </div>
              )}
              {lace.buyerCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Buyer Code</label>
                  <p className="text-gray-900 font-mono">{lace.buyerCode}</p>
                </div>
              )}
              {!lace.supplierName && !lace.supplierCode && !lace.buyerCode && (
                <p className="text-gray-500 text-sm">No supplier information available</p>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {lace.description && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-900 whitespace-pre-line">{lace.description}</p>
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
                  <p className="text-gray-900">{new Date(lace.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Updated</label>
                  <p className="text-gray-900">{new Date(lace.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
