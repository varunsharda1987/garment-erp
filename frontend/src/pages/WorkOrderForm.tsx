// Work Order Form Page - Edit production run details
// Note: Work orders are auto-created when orders are saved, so this is primarily for editing
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import workOrderService from '../services/workOrder.service';
import warehouseService from '../services/warehouse.service';
import { handleApiError, handleApiSuccess } from '../lib/api-error-handler';
import type { WorkOrder, Priority, UpdateWorkOrderDTO } from '../types/production.types';
import type { Warehouse } from '../types/inventory.types';

export default function WorkOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Work order data
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);

  // Editable form fields
  const [locationId, setLocationId] = useState<string>('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [remarks, setRemarks] = useState('');

  // Lookup data
  const [locations, setLocations] = useState<Warehouse[]>([]);

  useEffect(() => {
    if (id) {
      loadData();
    } else {
      // No ID means trying to create - redirect to list
      navigate('/production/work-orders');
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [workOrderData, locationsData] = await Promise.all([
        workOrderService.getById(id!),
        warehouseService.getAll({})
      ]);

      setWorkOrder(workOrderData);
      setLocations(locationsData);

      // Populate form fields with defensive date parsing
      setLocationId(workOrderData.locationId || '');
      setPlannedStartDate(workOrderData.plannedStartDate ? workOrderData.plannedStartDate.split('T')[0] : '');
      setPlannedEndDate(workOrderData.plannedEndDate ? workOrderData.plannedEndDate.split('T')[0] : '');
      setPriority(workOrderData.priority);
      setRemarks(workOrderData.remarks || '');

    } catch (err: unknown) {
      setError(handleApiError(err, 'Failed to load production run', false) || 'Failed to load production run');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setSaving(true);

      const updateData: UpdateWorkOrderDTO = {
        locationId: locationId || undefined,
        plannedStartDate: new Date(plannedStartDate),
        plannedEndDate: new Date(plannedEndDate),
        priority,
        remarks: remarks || undefined,
      };

      await workOrderService.update(id!, updateData);
      setSuccess('Production run updated successfully');

      setTimeout(() => {
        navigate(`/production/work-orders/${id}`);
      }, 1500);
    } catch (err: unknown) {
      setError(handleApiError(err, 'Failed to update production run', false) || 'Failed to update production run');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertDescription>Production run not found</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/production/work-orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Production Runs
        </Button>
      </div>
    );
  }

  // Check if editing is allowed
  if (workOrder.status !== 'PENDING') {
    return (
      <div className="container mx-auto py-6">
        <Alert>
          <AlertDescription>
            This production run cannot be edited because its status is "{workOrder.status.replace(/_/g, ' ')}".
            Only PENDING production runs can be edited.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/production/work-orders/${id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Details
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={`Edit Production Run: ${workOrder.workOrderNumber}`}>
        <Button variant="outline" onClick={() => navigate(`/production/work-orders/${id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Details
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-50 text-green-900 border-green-200">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Order Details (Read-only) */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-gray-500">Order Number</Label>
                  <div className="font-medium mt-1">
                    <span
                      className="text-blue-600 cursor-pointer hover:underline"
                      onClick={() => navigate(`/orders/${workOrder.orderId}`)}
                    >
                      {workOrder.orders?.orderNumber || '-'}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500">Customer</Label>
                  <div className="font-medium mt-1">{workOrder.orders?.customers?.name || '-'}</div>
                </div>
                <div>
                  <Label className="text-gray-500">Style</Label>
                  <div className="font-medium mt-1">
                    {workOrder.styles?.styleCode} - {workOrder.styles?.styleName}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500">Total Quantity</Label>
                  <div className="font-medium mt-1">{workOrder.totalQuantity} pcs</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Editable Production Details */}
          <Card>
            <CardHeader>
              <CardTitle>Production Planning</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="locationId">Production Location</Label>
                  <Select value={locationId || 'NONE'} onValueChange={(v) => setLocationId(v === 'NONE' ? '' : v)}>
                    <SelectTrigger id="locationId">
                      <SelectValue placeholder="Select location (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Not Assigned</SelectItem>
                      {locations.filter(loc => loc.id && loc.id.trim() !== '').map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.warehouseName} ({loc.city || 'N/A'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Where production will take place</p>
                </div>

                <div>
                  <Label htmlFor="priority">Priority *</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Priority)} required>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="plannedStartDate">Planned Start Date *</Label>
                  <Input
                    id="plannedStartDate"
                    type="date"
                    value={plannedStartDate}
                    onChange={(e) => setPlannedStartDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="plannedEndDate">Planned End Date *</Label>
                  <Input
                    id="plannedEndDate"
                    type="date"
                    value={plannedEndDate}
                    onChange={(e) => setPlannedEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  placeholder="Any special instructions..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Color x Size Breakup (Read-only) */}
          {workOrder.workOrderBreakup && workOrder.workOrderBreakup.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Color × Size Breakup</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Color
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Size
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Planned Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {workOrder.workOrderBreakup.map((breakup) => (
                        <tr key={breakup.id}>
                          <td className="px-4 py-3 text-sm">
                            {breakup.colorOptions?.colorName || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {breakup.sizeOptions?.sizeName || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            {breakup.plannedQuantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Quantities are derived from the order and cannot be changed. Use "Split Production Run" for partial dispatch.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/production/work-orders/${id}`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
