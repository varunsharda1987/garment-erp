import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getElasticById } from '@/services/elastic.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import type { Elastic } from '@/types/elastic.types';
import { handleApiError } from '@/lib/api-error-handler';
import { ArrowLeft, Edit, Package, Palette, Ruler, DollarSign, Building2, FileText, Percent } from 'lucide-react';

export default function ElasticDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const [elastic, setElastic] = useState<Elastic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'PURCHASE' || currentUser?.role === 'MERCHANDISER';

  useEffect(() => {
    if (id) {
      fetchElasticDetails();
    }
  }, [id]);

  const fetchElasticDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getElasticById(id!);
      setElastic(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load elastic details', false);
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
          <p className="mt-4 text-gray-600">Loading elastic details...</p>
        </div>
      </div>
    );
  }

  if (error || !elastic) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/materials/elastic')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Elastics
            </Button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-red-600">{error || 'Elastic not found'}</p>
              <Button onClick={() => navigate('/materials/elastic')} className="mt-4">
                Return to Elastics
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
          <Button variant="ghost" onClick={() => navigate('/materials/elastic')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Elastics
          </Button>
          {canEdit && (
            <Button onClick={() => navigate(`/materials/elastic/${elastic.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Elastic
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
                  <CardTitle className="text-3xl">{elastic.elasticName}</CardTitle>
                  <StatusBadge
                    status={elastic.isActive ? 'Active' : 'Inactive'}
                    variant={elastic.isActive ? 'success' : 'secondary'}
                  />
                </div>
                <p className="text-gray-600">Elastic Code: {elastic.elasticCode}</p>
                {elastic.materialCode && (
                  <p className="text-gray-500 text-sm">Material Code: {elastic.materialCode}</p>
                )}
              </div>
              {elastic.image && (
                <img
                  src={elastic.image}
                  alt={elastic.elasticName}
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
              {elastic.elasticType && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Elastic Type</label>
                  <p className="text-gray-900">{elastic.elasticType}</p>
                </div>
              )}
              {elastic.composition && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Composition</label>
                  <p className="text-gray-900">{elastic.composition}</p>
                </div>
              )}
              {!elastic.elasticType && !elastic.composition && (
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
              {elastic.width && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Width</label>
                  <p className="text-gray-900 text-xl font-semibold">{elastic.width} mm</p>
                </div>
              )}
              {elastic.stretchPercent && (
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-gray-500" />
                  <div>
                    <label className="text-sm font-medium text-gray-600">Stretch</label>
                    <p className="text-gray-900 text-xl font-semibold">{elastic.stretchPercent}%</p>
                  </div>
                </div>
              )}
              {elastic.color && (
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-gray-500" />
                  <div>
                    <label className="text-sm font-medium text-gray-600">Color</label>
                    <p className="text-gray-900">{elastic.color}</p>
                  </div>
                </div>
              )}
              {!elastic.width && !elastic.stretchPercent && !elastic.color && (
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
              {elastic.pricePerMeter ? (
                <div>
                  <label className="text-sm font-medium text-gray-600">Price per Meter</label>
                  <p className="text-gray-900 text-2xl font-semibold">
                    ₹{elastic.pricePerMeter.toLocaleString('en-IN')}
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
              {elastic.supplierName && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Supplier</label>
                  <p className="text-gray-900">{elastic.supplierName}</p>
                </div>
              )}
              {elastic.supplierCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Supplier Code</label>
                  <p className="text-gray-900 font-mono">{elastic.supplierCode}</p>
                </div>
              )}
              {elastic.buyerCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Buyer Code</label>
                  <p className="text-gray-900 font-mono">{elastic.buyerCode}</p>
                </div>
              )}
              {!elastic.supplierName && !elastic.supplierCode && !elastic.buyerCode && (
                <p className="text-gray-500 text-sm">No supplier information available</p>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {elastic.description && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-900 whitespace-pre-line">{elastic.description}</p>
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
                  <p className="text-gray-900">{new Date(elastic.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Updated</label>
                  <p className="text-gray-900">{new Date(elastic.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
