import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { embroideryService } from '@/services/embroidery.service';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Embroidery } from '@/types/embroidery.types';
import { handleApiError } from '@/lib/api-error-handler';
import {
  ArrowLeft,
  Edit,
  Sparkles,
  Ruler,
  DollarSign,
  Building2,
  FileText,
  Scissors,
  Palette,
  Clock,
  Hash,
} from 'lucide-react';

export default function EmbroideryDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const [embroidery, setEmbroidery] = useState<Embroidery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'PURCHASE' || currentUser?.role === 'MERCHANDISER';

  useEffect(() => {
    if (id) {
      fetchEmbroideryDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchEmbroideryDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await embroideryService.getEmbroideryById(id!);
      setEmbroidery(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load embroidery details', false);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '-';
    return `₹${numValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/5 to-primary/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading embroidery details...</p>
        </div>
      </div>
    );
  }

  if (error || !embroidery) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-accent/5 to-primary/10">
        <header className="bg-card shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/embroidery')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Embroidery
            </Button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-destructive">{error || 'Embroidery design not found'}</p>
              <Button onClick={() => navigate('/embroidery')} className="mt-4">
                Return to Embroidery
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/5 to-primary/10">
      <header className="bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate('/embroidery')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Embroidery
          </Button>
          {canEdit && (
            <Button onClick={() => navigate(`/embroidery/${embroidery.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Design
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
                  <Sparkles className="h-6 w-6 text-accent" />
                  <CardTitle className="text-3xl">{embroidery.designName}</CardTitle>
                  <Badge variant={embroidery.isActive ? 'default' : 'secondary'}>
                    {embroidery.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-muted-foreground font-mono">{embroidery.embroideryCode}</p>
              </div>
              {embroidery.designImage && (
                <img
                  src={embroidery.designImage}
                  alt={embroidery.designName}
                  className="w-32 h-32 object-cover rounded-lg border shadow-sm"
                  loading="lazy"
                />
              )}
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Design Specifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Design Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stitch Count</label>
                  <p className="text-foreground text-xl font-semibold">
                    {embroidery.stitchCount ? embroidery.stitchCount.toLocaleString() : '-'}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Palette className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Thread Colors</label>
                    <p className="text-foreground text-xl font-semibold">{embroidery.threadColors || '-'}</p>
                  </div>
                </div>
              </div>
              {(embroidery.repeatWidth || embroidery.repeatHeight) && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Pattern Repeat</label>
                  <p className="text-foreground">
                    {embroidery.repeatWidth ? `${embroidery.repeatWidth}"` : '-'} x{' '}
                    {embroidery.repeatHeight ? `${embroidery.repeatHeight}"` : '-'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Width Impact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Ruler className="h-5 w-5" />
                Width Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {embroidery.minFabricWidth && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Minimum Fabric Width</label>
                  <p className="text-foreground text-lg">{embroidery.minFabricWidth}" (input)</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Usable Width After Embroidery</label>
                <div className="flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-accent" />
                  <p className="text-accent text-2xl font-semibold">{embroidery.usableWidthAfter}"</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Cuttable width for CAD planning</p>
              </div>
            </CardContent>
          </Card>

          {/* Costing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Costing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Cost per Meter</label>
                <p className="text-foreground text-3xl font-semibold">{formatCurrency(embroidery.costPerMeter)}</p>
              </div>
              {embroidery.leadTimeDays && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Lead Time</label>
                    <p className="text-foreground">{embroidery.leadTimeDays} days</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Supplier Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Supplier
              </CardTitle>
            </CardHeader>
            <CardContent>
              {embroidery.supplier ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Supplier Name</label>
                    <p className="text-foreground font-medium">{embroidery.supplier.name}</p>
                  </div>
                  {embroidery.supplier.code && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Supplier Code</label>
                      <p className="text-foreground font-mono">{embroidery.supplier.code}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No supplier assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {embroidery.description && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-line">{embroidery.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Usage in Styles */}
          {embroidery.usedInStyles && embroidery.usedInStyles.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Used in Styles ({embroidery.usedInStyles.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {embroidery.usedInStyles.map((usage, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => navigate(`/styles/${usage.styleId}`)}
                    >
                      <div className="font-medium text-foreground">{usage.styleCode}</div>
                      <div className="text-sm text-muted-foreground">{usage.styleName}</div>
                      <div className="text-xs text-muted-foreground mt-1">Component: {usage.componentName}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Design Files */}
          {embroidery.designFile && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Design File</CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={embroidery.designFile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info hover:underline flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Download Design File
                </a>
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
                  <p className="text-foreground">{new Date(embroidery.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                  <p className="text-foreground">{new Date(embroidery.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
