import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { sampleService } from '@/services/sample.service';
import type { Sample, SampleStatus, SampleType } from '@/types/sample.types';
import { SampleTypeLabels, SampleStatusLabels, SampleStatusColors } from '@/types/sample.types';

interface RelatedSample {
  id: string;
  sampleNumber: string;
  sampleType: SampleType;
  status: string;
}
type SampleWithRelated = Sample & { relatedSamples?: RelatedSample[] };
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  TestTube,
  ArrowLeft,
  Pencil,
  Send,
  MessageSquare,
  RefreshCcw,
  CheckCircle,
  Clock,
  Ruler,
  Palette,
  Grid3X3,
  Truck,
  User,
  Calendar,
  Building2,
  ExternalLink,
  Copy,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SampleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [sample, setSample] = useState<Sample | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  // Form states
  const [sendForm, setSendForm] = useState({
    sentDate: new Date().toISOString().split('T')[0],
    courierMode: '',
    trackingNumber: '',
  });
  const [feedbackForm, setFeedbackForm] = useState({
    status: 'APPROVED' as 'APPROVED' | 'REJECTED' | 'REVISION_NEEDED' | 'APPROVED_WITH_COMMENTS',
    feedback: '',
    measurementComments: '',
  });
  const [newStatus, setNewStatus] = useState<SampleStatus>('IN_PROGRESS');

  useEffect(() => {
    if (id) {
      fetchSample();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchSample = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await sampleService.getSampleById(id!);
      setSample(data);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load sample', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsSent = async () => {
    try {
      await sampleService.markAsSent(id!, sendForm);
      handleApiSuccess('Sample sent', 'Sample has been marked as sent.');
      setSendDialogOpen(false);
      fetchSample();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to update sample');
    }
  };

  const handleRecordFeedback = async () => {
    try {
      await sampleService.recordFeedback(id!, {
        status: feedbackForm.status,
        feedback: feedbackForm.feedback,
        measurementComments: feedbackForm.measurementComments,
      });
      handleApiSuccess('Feedback recorded', 'Buyer feedback has been recorded.');
      setFeedbackDialogOpen(false);
      fetchSample();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to record feedback');
    }
  };

  const handleStatusChange = async () => {
    try {
      await sampleService.updateSampleStatus(id!, { status: newStatus });
      handleApiSuccess('Status updated', `Sample status changed to ${SampleStatusLabels[newStatus]}`);
      setStatusDialogOpen(false);
      fetchSample();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to update status');
    }
  };

  const handleCreateRevision = async () => {
    try {
      const revision = await sampleService.createRevision(id!);
      handleApiSuccess('Revision created', `New revision ${revision.sampleNumber} created.`);
      navigate(`/samples/${revision.id}`);
    } catch (err: unknown) {
      handleApiError(err, 'Failed to create revision');
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !sample) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <p className="text-destructive">{error || 'Sample not found'}</p>
        <Button variant="outline" onClick={() => navigate('/samples')} className="mt-4">
          Back to Samples
        </Button>
      </div>
    );
  }

  const isOverdue =
    !['APPROVED', 'APPROVED_WITH_COMMENTS', 'REJECTED'].includes(sample.status) &&
    new Date(sample.requiredDate) < new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/samples')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <TestTube className="h-8 w-8 text-primary" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-display font-medium text-foreground">{sample.sampleNumber}</h1>
                <Badge className={SampleStatusColors[sample.status]}>{SampleStatusLabels[sample.status]}</Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Overdue
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                {SampleTypeLabels[sample.sampleType]}
                {sample.sampleType === 'FIT_SAMPLE' && ` (Version ${sample.version})`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Action buttons based on status */}
          {sample.status === 'REQUESTED' && (
            <Button onClick={() => setStatusDialogOpen(true)}>
              <Clock className="h-4 w-4 mr-2" />
              Start Progress
            </Button>
          )}
          {sample.status === 'IN_PROGRESS' && (
            <Button
              onClick={() => {
                setNewStatus('SUBMITTED');
                setStatusDialogOpen(true);
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Complete
            </Button>
          )}
          {sample.status === 'SUBMITTED' && (
            <Button onClick={() => setSendDialogOpen(true)}>
              <Send className="h-4 w-4 mr-2" />
              Mark as Sent
            </Button>
          )}
          {['SENT', 'FEEDBACK_PENDING'].includes(sample.status) && (
            <Button onClick={() => setFeedbackDialogOpen(true)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Record Feedback
            </Button>
          )}
          {(sample.status === 'REJECTED' || sample.status === 'REVISION_NEEDED') &&
            sample.sampleType === 'FIT_SAMPLE' && (
              <Button onClick={handleCreateRevision}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Create Revision
              </Button>
            )}
          <Button variant="outline" onClick={() => navigate(`/samples/${id}/edit`)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sample Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Style</Label>
                {sample.style ? (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{sample.style.styleCode}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => navigate(`/styles/${sample.style?.id}`)}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground">No style linked</span>
                )}
                {sample.style && <p className="text-sm text-muted-foreground">{sample.style.styleName}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Customer</Label>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{sample.customer?.name}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Request Date</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(sample.requestDate)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Required By</Label>
                <div className={`flex items-center gap-2 ${isOverdue ? 'text-destructive' : ''}`}>
                  <Clock className="h-4 w-4" />
                  <span className={isOverdue ? 'font-medium' : ''}>{formatDate(sample.requiredDate)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Created By</Label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{sample.createdBy?.name}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Created On</Label>
                <span>{formatDate(sample.createdAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Tabs for different content */}
          <Tabs defaultValue="measurements">
            <TabsList>
              <TabsTrigger value="measurements" className="flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                Measurements
              </TabsTrigger>
              {sample.colorways && sample.colorways.length > 0 && (
                <TabsTrigger value="colorways" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Colorways
                </TabsTrigger>
              )}
              {sample.sizeSets && sample.sizeSets.length > 0 && (
                <TabsTrigger value="sizeSets" className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Size Set
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="measurements">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Measurements</CardTitle>
                  <CardDescription>Spec vs Actual measurements for quality check</CardDescription>
                </CardHeader>
                <CardContent>
                  {sample.measurements && sample.measurements.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3">Point</th>
                            <th className="text-right py-2 px-3">Spec</th>
                            <th className="text-right py-2 px-3">Actual</th>
                            <th className="text-right py-2 px-3">Tolerance</th>
                            <th className="text-center py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sample.measurements.map((m) => (
                            <tr key={m.id} className="border-b hover:bg-muted">
                              <td className="py-2 px-3 font-medium">{m.measurementPoint}</td>
                              <td className="py-2 px-3 text-right">{m.specValue}"</td>
                              <td className="py-2 px-3 text-right">{m.actualValue ? `${m.actualValue}"` : '-'}</td>
                              <td className="py-2 px-3 text-right">±{m.tolerance}"</td>
                              <td className="py-2 px-3 text-center">
                                {m.status ? (
                                  <Badge variant={m.status === 'PASS' ? 'default' : 'destructive'} className="text-xs">
                                    {m.status}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No measurements recorded yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="colorways">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Colorways (PP Sample)</CardTitle>
                  <CardDescription>Multiple colorways sent for buyer approval</CardDescription>
                </CardHeader>
                <CardContent>
                  {sample.colorways && sample.colorways.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3">Color</th>
                            <th className="text-left py-2 px-3">Size</th>
                            <th className="text-left py-2 px-3">Fabric Lot</th>
                            <th className="text-center py-2 px-3">Qty Sent</th>
                            <th className="text-center py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sample.colorways.map((c) => (
                            <tr key={c.id} className="border-b hover:bg-muted">
                              <td className="py-2 px-3 font-medium">{c.color?.colorName}</td>
                              <td className="py-2 px-3">{c.size?.sizeName || '-'}</td>
                              <td className="py-2 px-3">{c.fabricLot || '-'}</td>
                              <td className="py-2 px-3 text-center">{c.qtySent}</td>
                              <td className="py-2 px-3 text-center">
                                <Badge
                                  variant={
                                    c.status === 'APPROVED'
                                      ? 'default'
                                      : c.status === 'REJECTED'
                                        ? 'destructive'
                                        : 'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {c.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No colorways recorded.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sizeSets">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Size Set</CardTitle>
                  <CardDescription>Jumping sizes with mix of colors for buyer approval</CardDescription>
                </CardHeader>
                <CardContent>
                  {sample.sizeSets && sample.sizeSets.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3">Size</th>
                            <th className="text-left py-2 px-3">Color</th>
                            <th className="text-center py-2 px-3">Qty</th>
                            <th className="text-center py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sample.sizeSets.map((s) => (
                            <tr key={s.id} className="border-b hover:bg-muted">
                              <td className="py-2 px-3 font-medium">{s.size?.sizeName}</td>
                              <td className="py-2 px-3">{s.color?.colorName}</td>
                              <td className="py-2 px-3 text-center">{s.qty}</td>
                              <td className="py-2 px-3 text-center">
                                <Badge
                                  variant={
                                    s.status === 'APPROVED'
                                      ? 'default'
                                      : s.status === 'REJECTED'
                                        ? 'destructive'
                                        : 'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {s.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No size set recorded.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Timeline & Info */}
        <div className="space-y-6">
          {/* Shipping Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Shipping Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sent Date</Label>
                <p className="font-medium">{formatDate(sample.sentDate) || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Courier Mode</Label>
                <p>{sample.courierMode || '-'}</p>
              </div>
              {sample.trackingNumber && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tracking Number</Label>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded text-sm">{sample.trackingNumber}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => navigator.clipboard.writeText(sample.trackingNumber!)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Received Date</Label>
                <p>{formatDate(sample.receivedDate) || '-'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Feedback */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Buyer Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Feedback Date</Label>
                <p>{formatDate(sample.feedbackDate) || '-'}</p>
              </div>
              {sample.customerFeedback && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Comments</Label>
                  <p className="text-sm bg-muted p-3 rounded-lg">{sample.customerFeedback}</p>
                </div>
              )}
              {sample.measurementComments && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Measurement Notes</Label>
                  <p className="text-sm bg-muted p-3 rounded-lg">{sample.measurementComments}</p>
                </div>
              )}
              {sample.revisionRequired && (
                <Badge variant="destructive" className="w-full justify-center">
                  Revision Required
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Related Samples */}
          {(sample as SampleWithRelated).relatedSamples && (sample as SampleWithRelated).relatedSamples!.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Related Samples</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(sample as SampleWithRelated).relatedSamples!.map((rel) => (
                    <button
                      key={rel.id}
                      onClick={() => navigate(`/samples/${rel.id}`)}
                      className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div>
                        <span className="font-medium text-sm">{rel.sampleNumber}</span>
                        <span className="text-xs text-muted-foreground ml-2">{SampleTypeLabels[rel.sampleType]}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {rel.status}
                      </Badge>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {sample.remarks && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground">{sample.remarks}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Sample as Sent</DialogTitle>
            <DialogDescription>Enter shipping details for tracking</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sent Date</Label>
              <Input
                type="date"
                value={sendForm.sentDate}
                onChange={(e) => setSendForm({ ...sendForm, sentDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Courier Mode</Label>
              <Input
                placeholder="e.g., FedEx, DHL, Hand Delivery"
                value={sendForm.courierMode}
                onChange={(e) => setSendForm({ ...sendForm, courierMode: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tracking Number</Label>
              <Input
                placeholder="Optional tracking number"
                value={sendForm.trackingNumber}
                onChange={(e) => setSendForm({ ...sendForm, trackingNumber: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkAsSent}>
              <Send className="h-4 w-4 mr-2" />
              Mark as Sent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Buyer Feedback</DialogTitle>
            <DialogDescription>Enter the buyer's response to this sample</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={feedbackForm.status}
                onValueChange={(v) =>
                  setFeedbackForm({
                    ...feedbackForm,
                    status: v as 'APPROVED' | 'REJECTED' | 'REVISION_NEEDED' | 'APPROVED_WITH_COMMENTS',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="APPROVED_WITH_COMMENTS">Approved (with comments)</SelectItem>
                  <SelectItem value="REVISION_NEEDED">Revision Needed</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Feedback Comments</Label>
              <Textarea
                placeholder="Enter buyer's feedback..."
                value={feedbackForm.feedback}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Measurement Notes</Label>
              <Textarea
                placeholder="Any measurement-specific comments..."
                value={feedbackForm.measurementComments}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, measurementComments: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordFeedback}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Save Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
            <DialogDescription>Change the sample status</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as SampleStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REQUESTED">Requested</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="SUBMITTED">Submitted (Complete)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStatusChange}>Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
