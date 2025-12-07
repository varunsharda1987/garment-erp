import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getThreadById } from '@/services/thread.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import type { Thread } from '@/types/thread.types';
import { handleApiError } from '@/lib/api-error-handler';
import { ArrowLeft, Edit, Package, Palette, Hash, DollarSign, Building2, FileText } from 'lucide-react';

export default function ThreadDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'PURCHASE' || currentUser?.role === 'MERCHANDISER';

  useEffect(() => {
    if (id) {
      fetchThreadDetails();
    }
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading thread details...</p>
        </div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="bg-white shadow-sm">
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
              <p className="text-red-600">{error || 'Thread not found'}</p>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
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
                <p className="text-gray-600">Thread Code: {thread.threadCode}</p>
                {thread.materialCode && (
                  <p className="text-gray-500 text-sm">Material Code: {thread.materialCode}</p>
                )}
              </div>
              {thread.image && (
                <img
                  src={thread.image}
                  alt={thread.threadName}
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
              {thread.threadType && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Thread Type</label>
                  <p className="text-gray-900">{thread.threadType}</p>
                </div>
              )}
              {thread.composition && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Composition</label>
                  <p className="text-gray-900">{thread.composition}</p>
                </div>
              )}
              {!thread.threadType && !thread.composition && (
                <p className="text-gray-500 text-sm">No basic information available</p>
              )}
            </CardContent>
          </Card>

          {/* Specifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {thread.threadCount && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Thread Count</label>
                  <p className="text-gray-900 text-xl font-semibold">{thread.threadCount}</p>
                </div>
              )}
              {thread.coneSize && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Cone Size</label>
                  <p className="text-gray-900">{thread.coneSize}</p>
                </div>
              )}
              {thread.color && (
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-gray-500" />
                  <div>
                    <label className="text-sm font-medium text-gray-600">Color</label>
                    <p className="text-gray-900">{thread.color}</p>
                  </div>
                </div>
              )}
              {thread.colorCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Color Code</label>
                  <p className="text-gray-900 font-mono">{thread.colorCode}</p>
                </div>
              )}
              {!thread.threadCount && !thread.coneSize && !thread.color && (
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
              {thread.pricePerCone ? (
                <div>
                  <label className="text-sm font-medium text-gray-600">Price per Cone</label>
                  <p className="text-gray-900 text-2xl font-semibold">
                    ₹{thread.pricePerCone.toLocaleString('en-IN')}
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
              {thread.supplierName && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Supplier</label>
                  <p className="text-gray-900">{thread.supplierName}</p>
                </div>
              )}
              {thread.supplierCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Supplier Code</label>
                  <p className="text-gray-900 font-mono">{thread.supplierCode}</p>
                </div>
              )}
              {thread.buyerCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Buyer Code</label>
                  <p className="text-gray-900 font-mono">{thread.buyerCode}</p>
                </div>
              )}
              {!thread.supplierName && !thread.supplierCode && !thread.buyerCode && (
                <p className="text-gray-500 text-sm">No supplier information available</p>
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
                <p className="text-gray-900 whitespace-pre-line">{thread.description}</p>
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
                  <p className="text-gray-900">{new Date(thread.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Updated</label>
                  <p className="text-gray-900">{new Date(thread.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
