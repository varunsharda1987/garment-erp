import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getZipperById } from '@/services/zipper.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import type { Zipper } from '@/types/zipper.types';
import { handleApiError } from '@/lib/api-error-handler';
import { ArrowLeft, Edit, Package, Palette, Ruler, DollarSign, Building2, FileText, Users, Star, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/currency';

export default function ZipperDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const [zipper, setZipper] = useState<Zipper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'PURCHASE' || currentUser?.role === 'MERCHANDISER';

  useEffect(() => {
    if (id) {
      fetchZipperDetails();
    }
  }, [id]);

  const fetchZipperDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getZipperById(id!);
      setZipper(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load zipper details', false);
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
          <p className="mt-4 text-gray-600">Loading zipper details...</p>
        </div>
      </div>
    );
  }

  if (error || !zipper) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/materials/zipper')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Zippers
            </Button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-red-600">{error || 'Zipper not found'}</p>
              <Button onClick={() => navigate('/materials/zipper')} className="mt-4">
                Return to Zippers
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
          <Button variant="ghost" onClick={() => navigate('/materials/zipper')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Zippers
          </Button>
          {canEdit && (
            <Button onClick={() => navigate(`/materials/zipper/${zipper.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Zipper
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
                  <CardTitle className="text-3xl">{zipper.zipperName}</CardTitle>
                  <StatusBadge
                    status={zipper.isActive ? 'Active' : 'Inactive'}
                    variant={zipper.isActive ? 'success' : 'secondary'}
                  />
                </div>
                <p className="text-gray-600">Zipper Code: {zipper.zipperCode}</p>
                {zipper.materialCode && (
                  <p className="text-gray-500 text-sm">Material Code: {zipper.materialCode}</p>
                )}
              </div>
              {zipper.image && (
                <img
                  src={zipper.image}
                  alt={zipper.zipperName}
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
              {zipper.brand && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Brand</label>
                  <p className="text-gray-900">{zipper.brand}</p>
                </div>
              )}
              {zipper.teethType && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Teeth Type</label>
                  <p className="text-gray-900">{zipper.teethType}</p>
                </div>
              )}
              {zipper.sliderType && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Slider Type</label>
                  <p className="text-gray-900">{zipper.sliderType}</p>
                </div>
              )}
              {!zipper.brand && !zipper.teethType && !zipper.sliderType && (
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
              {zipper.length && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Length</label>
                  <p className="text-gray-900 text-xl font-semibold">{zipper.length} cm</p>
                </div>
              )}
              {zipper.tapeWidth && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Tape Width</label>
                  <p className="text-gray-900">{zipper.tapeWidth} mm</p>
                </div>
              )}
              {zipper.color && (
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-gray-500" />
                  <div>
                    <label className="text-sm font-medium text-gray-600">Color</label>
                    <p className="text-gray-900">{zipper.color}</p>
                  </div>
                </div>
              )}
              {!zipper.length && !zipper.tapeWidth && !zipper.color && (
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
              {zipper.pricePerPiece ? (
                <div>
                  <label className="text-sm font-medium text-gray-600">Price per Piece</label>
                  <p className="text-gray-900 text-2xl font-semibold">
                    {formatCurrency(zipper.pricePerPiece)}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No pricing information available</p>
              )}
            </CardContent>
          </Card>

          {/* Reference Codes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Reference Codes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {zipper.supplierCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Supplier Reference Code</label>
                  <p className="text-gray-900 font-mono">{zipper.supplierCode}</p>
                </div>
              )}
              {zipper.buyerCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Buyer Code</label>
                  <p className="text-gray-900 font-mono">{zipper.buyerCode}</p>
                </div>
              )}
              {!zipper.supplierCode && !zipper.buyerCode && (
                <p className="text-gray-500 text-sm">No reference codes available</p>
              )}
            </CardContent>
          </Card>

          {/* Suppliers (Multi-supplier) */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Suppliers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {zipper.zipperSuppliers && zipper.zipperSuppliers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Piece</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {zipper.zipperSuppliers.map((s) => (
                        <tr key={s.id}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{s.supplier.name}</p>
                                <p className="text-xs text-gray-500">{s.supplier.code}</p>
                              </div>
                              {s.isPreferred && (
                                <Badge variant="default" className="text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  Preferred
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {s.pricePerPiece ? formatCurrency(s.pricePerPiece) : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {s.isActive ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                <Check className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500 border-gray-400">
                                <X className="h-3 w-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                            {s.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No suppliers linked to this zipper</p>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {zipper.description && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-900 whitespace-pre-line">{zipper.description}</p>
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
                  <p className="text-gray-900">{new Date(zipper.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Updated</label>
                  <p className="text-gray-900">{new Date(zipper.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
