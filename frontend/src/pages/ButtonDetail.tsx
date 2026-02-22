import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getButtonById } from '@/services/button.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button as UIButton } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import type { Button } from '@/types/button.types';
import { handleApiError } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { ArrowLeft, Edit, Package, Palette, Circle, DollarSign, Building2, FileText, Users, Star, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ButtonDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const [button, setButton] = useState<Button | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'PURCHASE' || currentUser?.role === 'MERCHANDISER';

  useEffect(() => {
    if (id) {
      fetchButtonDetails();
    }
  }, [id]);

  const fetchButtonDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getButtonById(id!);
      setButton(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load button details', false);
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
          <p className="mt-4 text-gray-600">Loading button details...</p>
        </div>
      </div>
    );
  }

  if (error || !button) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <UIButton variant="ghost" onClick={() => navigate('/materials/button')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Buttons
            </UIButton>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-red-600">{error || 'Button not found'}</p>
              <UIButton onClick={() => navigate('/materials/button')} className="mt-4">
                Return to Buttons
              </UIButton>
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
          <UIButton variant="ghost" onClick={() => navigate('/materials/button')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Buttons
          </UIButton>
          {canEdit && (
            <UIButton onClick={() => navigate(`/materials/button/${button.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Button
            </UIButton>
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
                  <CardTitle className="text-3xl">{button.buttonName}</CardTitle>
                  <StatusBadge
                    status={button.isActive ? 'Active' : 'Inactive'}
                    variant={button.isActive ? 'success' : 'secondary'}
                  />
                </div>
                <p className="text-gray-600">Button Code: {button.buttonCode}</p>
                {button.materialCode && (
                  <p className="text-gray-500 text-sm">Material Code: {button.materialCode}</p>
                )}
              </div>
              {button.image && (
                <img
                  src={button.image}
                  alt={button.buttonName}
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
              {button.material && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Material</label>
                  <p className="text-gray-900">{button.material}</p>
                </div>
              )}
              {button.shape && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Shape</label>
                  <p className="text-gray-900">{button.shape}</p>
                </div>
              )}
              {!button.material && !button.shape && (
                <p className="text-gray-500 text-sm">No basic information available</p>
              )}
            </CardContent>
          </Card>

          {/* Specifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Circle className="h-5 w-5" />
                Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {button.size && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Size</label>
                  <p className="text-gray-900 text-xl font-semibold">{button.size}</p>
                </div>
              )}
              {button.holes && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Number of Holes</label>
                  <p className="text-gray-900 text-xl font-semibold">{button.holes}</p>
                </div>
              )}
              {button.color && (
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-gray-500" />
                  <div>
                    <label className="text-sm font-medium text-gray-600">Color</label>
                    <p className="text-gray-900">{button.color}</p>
                  </div>
                </div>
              )}
              {!button.size && !button.holes && !button.color && (
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
              {button.pricePerPiece && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Price per Piece</label>
                  <p className="text-gray-900 text-2xl font-semibold">
                    {formatCurrency(button.pricePerPiece)}
                  </p>
                </div>
              )}
              {button.pricePerGross && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Price per Gross (144 pcs)</label>
                  <p className="text-gray-900 text-2xl font-semibold">
                    {formatCurrency(button.pricePerGross)}
                  </p>
                </div>
              )}
              {!button.pricePerPiece && !button.pricePerGross && (
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
              {button.supplierCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Supplier Reference Code</label>
                  <p className="text-gray-900 font-mono">{button.supplierCode}</p>
                </div>
              )}
              {button.buyerCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Buyer Code</label>
                  <p className="text-gray-900 font-mono">{button.buyerCode}</p>
                </div>
              )}
              {!button.supplierCode && !button.buyerCode && (
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
              {button.buttonSuppliers && button.buttonSuppliers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Piece</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price/Gross</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {button.buttonSuppliers.map((s) => (
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
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {s.pricePerGross ? formatCurrency(s.pricePerGross) : '-'}
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
                <p className="text-gray-500 text-sm">No suppliers linked to this button</p>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {button.description && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-900 whitespace-pre-line">{button.description}</p>
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
                  <p className="text-gray-900">{new Date(button.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Updated</label>
                  <p className="text-gray-900">{new Date(button.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
