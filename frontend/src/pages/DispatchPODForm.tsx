import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { deliveryNoteService } from '@/services/dispatch.service';
import type { DeliveryNote, RecordPODRequest, DeliveryConfirmation } from '@/types/dispatch.types';
import { DeliveryConfirmationLabels } from '@/types/dispatch.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { ArrowLeft, Save, Truck, Package, FileText, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';

export default function DispatchPODForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [deliveryNote, setDeliveryNote] = useState<DeliveryNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // POD Form state
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryTime, setDeliveryTime] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [designation, setDesignation] = useState('');
  const [customerSignOff, setCustomerSignOff] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryConfirmation>('DELIVERED');
  const [shortageQty, setShortageQty] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Customer GRN details
  const [customerGrnNumber, setCustomerGrnNumber] = useState('');
  const [customerGrnDate, setCustomerGrnDate] = useState('');

  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (id) {
      fetchDeliveryNote(id);
    }
  }, [id]);

  const fetchDeliveryNote = async (noteId: string) => {
    try {
      setIsLoading(true);
      const data = await deliveryNoteService.getById(noteId);
      setDeliveryNote(data);

      // Check if already delivered
      if (data.status === 'DELIVERED') {
        handleApiError(new Error('POD already recorded for this delivery'), 'Cannot record POD');
        navigate('/manufacturing/dispatch');
        return;
      }

      if (data.status !== 'IN_TRANSIT') {
        handleApiError(new Error('Delivery must be in transit to record POD'), 'Invalid status');
        navigate('/manufacturing/dispatch');
        return;
      }
    } catch (err) {
      handleApiError(err, 'Failed to load delivery note');
      navigate('/manufacturing/dispatch');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!deliveryDate) {
      handleApiError(new Error('Please enter delivery date'), 'Validation Error');
      return false;
    }
    if (!receivedBy.trim()) {
      handleApiError(new Error('Please enter receiver name'), 'Validation Error');
      return false;
    }
    if (!deliveryStatus) {
      handleApiError(new Error('Please select delivery status'), 'Validation Error');
      return false;
    }
    if (deliveryStatus === 'PARTIAL' && !shortageQty) {
      handleApiError(new Error('Please enter shortage quantity for partial delivery'), 'Validation Error');
      return false;
    }
    if (deliveryStatus === 'REJECTED' && !rejectionReason.trim()) {
      handleApiError(new Error('Please enter rejection reason'), 'Validation Error');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !id) return;

    try {
      setIsSaving(true);

      const podData: RecordPODRequest = {
        deliveryDate,
        deliveryTime: deliveryTime || undefined,
        receivedBy: receivedBy.trim(),
        designation: designation.trim() || undefined,
        customerSignOff,
        deliveryStatus,
        shortageQty: shortageQty ? parseInt(shortageQty) : undefined,
        rejectionReason: rejectionReason.trim() || undefined,
        customerGrnNumber: customerGrnNumber.trim() || undefined,
        customerGrnDate: customerGrnDate || undefined,
        remarks: remarks.trim() || undefined,
      };

      await deliveryNoteService.recordPOD(id, podData);
      handleApiSuccess('POD recorded successfully');
      navigate('/manufacturing/dispatch');
    } catch (err) {
      handleApiError(err, 'Failed to record POD');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate total pieces from items
  const totalPieces = deliveryNote?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading delivery note...</div>
      </div>
    );
  }

  if (!deliveryNote) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Delivery note not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/manufacturing/dispatch')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Record Proof of Delivery</h1>
            <p className="text-gray-500">DN# {deliveryNote.deliveryNumber}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Delivery Note Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Delivery Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-gray-500">Delivery Number</Label>
                <p className="font-medium">{deliveryNote.deliveryNumber}</p>
              </div>
              <div>
                <Label className="text-gray-500">Order</Label>
                <p className="font-medium">{deliveryNote.order?.orderNumber || '-'}</p>
              </div>
              <div>
                <Label className="text-gray-500">Customer</Label>
                <p className="font-medium">
                  {deliveryNote.customer?.billingName || deliveryNote.customer?.name || '-'}
                </p>
              </div>
              <div>
                <Label className="text-gray-500">Dispatch Date</Label>
                <p className="font-medium">
                  {deliveryNote.deliveryDate ? format(new Date(deliveryNote.deliveryDate), 'dd MMM yyyy') : '-'}
                </p>
              </div>
            </div>

            {/* Transport Info */}
            {deliveryNote.vehicleNumber && (
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-500">Vehicle Number</Label>
                    <p className="font-medium">{deliveryNote.vehicleNumber}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Driver Name</Label>
                    <p className="font-medium">{deliveryNote.driverName || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Driver Phone</Label>
                    <p className="font-medium">{deliveryNote.driverPhone || '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items Summary
              <Badge variant="secondary" className="ml-2">
                {deliveryNote.items?.length || 0} items | {totalPieces} pcs
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Style</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryNote.items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.style?.styleCode || '-'}
                      <span className="text-gray-500 ml-2">{item.style?.styleName}</span>
                    </TableCell>
                    <TableCell>{item.color?.colorName || '-'}</TableCell>
                    <TableCell>{item.size?.sizeName || '-'}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* POD Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Proof of Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Delivery Confirmation */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryDate">Delivery Date *</Label>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryTime">Delivery Time</Label>
                <Input
                  id="deliveryTime"
                  type="time"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receivedBy">Received By *</Label>
                <Input
                  id="receivedBy"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="Receiver's name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Store Manager"
                />
              </div>
            </div>

            {/* Delivery Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryStatus">Delivery Status *</Label>
                <Select
                  value={deliveryStatus}
                  onValueChange={(value) => setDeliveryStatus(value as DeliveryConfirmation)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DeliveryConfirmationLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {deliveryStatus === 'PARTIAL' && (
                <div className="space-y-2">
                  <Label htmlFor="shortageQty">Shortage Quantity *</Label>
                  <Input
                    id="shortageQty"
                    type="number"
                    min="0"
                    value={shortageQty}
                    onChange={(e) => setShortageQty(e.target.value)}
                    placeholder="Enter shortage qty"
                  />
                </div>
              )}

              {deliveryStatus === 'REJECTED' && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                  <Input
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection"
                  />
                </div>
              )}
            </div>

            {/* Customer Sign-off */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="customerSignOff"
                checked={customerSignOff}
                onCheckedChange={(checked) => setCustomerSignOff(checked === true)}
              />
              <Label htmlFor="customerSignOff" className="cursor-pointer">
                Customer sign-off received
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Customer GRN Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Customer GRN Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerGrnNumber">Customer GRN Number</Label>
                <Input
                  id="customerGrnNumber"
                  value={customerGrnNumber}
                  onChange={(e) => setCustomerGrnNumber(e.target.value)}
                  placeholder="Enter customer's GRN number"
                />
                <p className="text-xs text-gray-500">The GRN number issued by the customer upon receiving goods</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerGrnDate">Customer GRN Date</Label>
                <Input
                  id="customerGrnDate"
                  type="date"
                  value={customerGrnDate}
                  onChange={(e) => setCustomerGrnDate(e.target.value)}
                />
                <p className="text-xs text-gray-500">The date when customer issued the GRN</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remarks */}
        <Card>
          <CardHeader>
            <CardTitle>Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any additional notes or observations..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/manufacturing/dispatch')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Record POD'}
          </Button>
        </div>
      </form>
    </div>
  );
}
