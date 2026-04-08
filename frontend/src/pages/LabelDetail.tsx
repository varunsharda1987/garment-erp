import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getLabelById } from '@/services/label.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import type { Label } from '@/types/label.types';
import { getLabelCategoryTerm } from '@/types/label.types';
import { handleApiError } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Edit,
  Package,
  Palette,
  Tag,
  DollarSign,
  Building2,
  FileText,
  Printer,
  Users,
  Star,
  Check,
  X,
} from 'lucide-react';

export default function LabelDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const [label, setLabel] = useState<Label | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'PURCHASE' || currentUser?.role === 'MERCHANDISER';

  useEffect(() => {
    if (id) {
      fetchLabelDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchLabelDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLabelById(id!);
      setLabel(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load label details', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-info mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading details...</p>
        </div>
      </div>
    );
  }

  if (error || !label) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
        <header className="bg-card shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/materials/label')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Labels
            </Button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-destructive">{error || 'Label not found'}</p>
              <Button onClick={() => navigate('/materials/label')} className="mt-4">
                Return to Labels
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
      <header className="bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate('/materials/label')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Labels
          </Button>
          {canEdit && (
            <Button onClick={() => navigate(`/materials/label/${label.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit {getLabelCategoryTerm(label.labelCategory)}
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
                  <CardTitle className="text-3xl">{label.labelName}</CardTitle>
                  <StatusBadge
                    status={label.isActive ? 'Active' : 'Inactive'}
                    variant={label.isActive ? 'success' : 'secondary'}
                  />
                </div>
                <p className="text-muted-foreground">
                  {getLabelCategoryTerm(label.labelCategory)} Code: {label.labelCode}
                </p>
                {label.materialCode && (
                  <p className="text-muted-foreground text-sm">Material Code: {label.materialCode}</p>
                )}
              </div>
              {label.image && (
                <img
                  src={label.image}
                  alt={label.labelName}
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
              {label.labelType && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {getLabelCategoryTerm(label.labelCategory)} Type
                  </label>
                  <p className="text-foreground">{label.labelType}</p>
                </div>
              )}
              {label.material && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Material</label>
                  <p className="text-foreground">{label.material}</p>
                </div>
              )}
              {label.content && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Content</label>
                  <p className="text-foreground">{label.content}</p>
                </div>
              )}
              {!label.labelType && !label.material && !label.content && (
                <p className="text-muted-foreground text-sm">No basic information available</p>
              )}
            </CardContent>
          </Card>

          {/* Specifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {label.size && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Size</label>
                  <p className="text-foreground text-xl font-semibold">{label.size}</p>
                </div>
              )}
              {label.printMethod && (
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Print Method</label>
                    <p className="text-foreground">{label.printMethod}</p>
                  </div>
                </div>
              )}
              {label.color && (
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Color</label>
                    <p className="text-foreground">{label.color}</p>
                  </div>
                </div>
              )}
              {!label.size && !label.printMethod && !label.color && (
                <p className="text-muted-foreground text-sm">No specifications available</p>
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
              {label.pricePerPiece && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Price per Piece</label>
                  <p className="text-foreground text-2xl font-semibold">{formatCurrency(label.pricePerPiece)}</p>
                </div>
              )}
              {label.pricePerHundred && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Price per 100 pcs</label>
                  <p className="text-foreground text-2xl font-semibold">{formatCurrency(label.pricePerHundred)}</p>
                </div>
              )}
              {!label.pricePerPiece && !label.pricePerHundred && (
                <p className="text-muted-foreground text-sm">No pricing information available</p>
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
              {label.supplierCode && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Supplier Reference Code</label>
                  <p className="text-foreground font-mono">{label.supplierCode}</p>
                </div>
              )}
              {label.buyerCode && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Buyer Code</label>
                  <p className="text-foreground font-mono">{label.buyerCode}</p>
                </div>
              )}
              {!label.supplierCode && !label.buyerCode && (
                <p className="text-muted-foreground text-sm">No reference codes available</p>
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
              {label.labelSuppliers && label.labelSuppliers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Supplier
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Price/Piece
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Price/Hundred
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-gray-200">
                      {label.labelSuppliers.map((s) => (
                        <tr key={s.id}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">{s.supplier.name}</p>
                                <p className="text-xs text-muted-foreground">{s.supplier.code}</p>
                              </div>
                              {s.isPreferred && (
                                <Badge variant="default" className="text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  Preferred
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                            {s.pricePerPiece ? formatCurrency(s.pricePerPiece) : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                            {s.pricePerHundred ? formatCurrency(s.pricePerHundred) : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {s.isActive ? (
                              <Badge variant="outline" className="text-success border-success">
                                <Check className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground border-gray-400">
                                <X className="h-3 w-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                            {s.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No suppliers linked to this {getLabelCategoryTerm(label.labelCategory).toLowerCase()}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {label.description && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-line">{label.description}</p>
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
                  <label className="text-sm font-medium text-muted-foreground">Created At</label>
                  <p className="text-foreground">{new Date(label.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                  <p className="text-foreground">{new Date(label.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
