import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getThreadById } from '@/services/thread.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import type { Thread } from '@/types/thread.types';
import { handleApiError } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import {
  ArrowLeft,
  Edit,
  Package,
  Palette,
  DollarSign,
  Building2,
  FileText,
  Users,
  Star,
  Check,
  X,
  Ruler,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ThreadDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'PURCHASE' || currentUser?.role === 'MERCHANDISER';

  useEffect(() => {
    if (id) {
      fetchThreadDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchThreadDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getThreadById(id!);
      setThread(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load thread details', false);
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
          <p className="mt-4 text-muted-foreground">Loading thread details...</p>
        </div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10">
        <header className="bg-card shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/materials/thread')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Threads
            </Button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-destructive">{error || 'Thread not found'}</p>
              <Button onClick={() => navigate('/materials/thread')} className="mt-4">
                Return to Threads
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
          <Button variant="ghost" onClick={() => navigate('/materials/thread')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Threads
          </Button>
          {canEdit && (
            <Button onClick={() => navigate(`/materials/thread/${thread.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Thread
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
                  <CardTitle className="text-3xl">{thread.threadName}</CardTitle>
                  <StatusBadge
                    status={thread.isActive ? 'Active' : 'Inactive'}
                    variant={thread.isActive ? 'success' : 'secondary'}
                  />
                </div>
                <p className="text-muted-foreground">Thread Code: {thread.threadCode}</p>
                {thread.materialCode && (
                  <p className="text-muted-foreground text-sm">Material Code: {thread.materialCode}</p>
                )}
              </div>
              {thread.image && (
                <img
                  src={thread.image}
                  alt={thread.threadName}
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
              {thread.brand && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Brand</label>
                  <p className="text-foreground text-lg font-semibold">{thread.brand}</p>
                </div>
              )}
              {thread.packagingType && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Packaging Type</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={thread.packagingType === 'CONE' ? 'default' : 'secondary'}>
                      {thread.packagingType}
                    </Badge>
                    <span className="text-muted-foreground">
                      ({thread.piecesPerBox || (thread.packagingType === 'CONE' ? 6 : 10)} pieces per box)
                    </span>
                  </div>
                </div>
              )}
              {!thread.brand && !thread.packagingType && (
                <p className="text-muted-foreground text-sm">No basic information available</p>
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
              {thread.metersPerUnit && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Meters per Unit</label>
                  <p className="text-foreground text-xl font-semibold">{thread.metersPerUnit}m</p>
                </div>
              )}
              {thread.color && (
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Color</label>
                    <p className="text-foreground">{thread.color}</p>
                  </div>
                </div>
              )}
              {thread.colorCode && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Color Code</label>
                  <p className="text-foreground font-mono">{thread.colorCode}</p>
                </div>
              )}
              {!thread.metersPerUnit && !thread.color && (
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
            <CardContent>
              {thread.pricePerCone ? (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Price per Cone</label>
                  <p className="text-foreground text-2xl font-semibold">{formatCurrency(thread.pricePerCone)}</p>
                </div>
              ) : (
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
              {thread.supplierCode && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Supplier Reference Code</label>
                  <p className="text-foreground font-mono">{thread.supplierCode}</p>
                </div>
              )}
              {thread.buyerCode && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Buyer Code</label>
                  <p className="text-foreground font-mono">{thread.buyerCode}</p>
                </div>
              )}
              {!thread.supplierCode && !thread.buyerCode && (
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
              {thread.threadSuppliers && thread.threadSuppliers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Supplier
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Price/Cone
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
                      {thread.threadSuppliers.map((s) => (
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
                            {s.pricePerCone ? formatCurrency(s.pricePerCone) : '-'}
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
                <p className="text-muted-foreground text-sm">No suppliers linked to this thread</p>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {thread.description && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-line">{thread.description}</p>
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
                  <p className="text-foreground">{new Date(thread.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                  <p className="text-foreground">{new Date(thread.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
