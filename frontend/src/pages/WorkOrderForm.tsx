// Work Order Form Page - Create work orders from customer orders
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import workOrderService from '../services/workOrder.service';
import { getAllOrders } from '../services/order.service';
import warehouseService from '../services/warehouse.service';
import type { CreateWorkOrderDTO, Priority, OrderItemForWorkOrder } from '../types/production.types';
import type { Order } from '../types/order.types';
import type { Warehouse } from '../types/inventory.types';

export default function WorkOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form data
  const [orderId, setOrderId] = useState('');
  const [orderItemId, setOrderItemId] = useState('');
  const [styleId, setStyleId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [remarks, setRemarks] = useState('');

  // Lookup data
  const [orders, setOrders] = useState<Order[]>([]);
  const [locations, setLocations] = useState<Warehouse[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [colorSizeBreakup, setColorSizeBreakup] = useState<Array<{
    colorId: string;
    sizeId: string;
    quantity: number;
  }>>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [ordersResponse, locationsData] = await Promise.all([
        getAllOrders({ status: 'PENDING' }),
        warehouseService.getAll({})  // Fetch all warehouses/locations
      ]);
      setOrders(ordersResponse.orders || []);
      setLocations(locationsData);
    } catch (err: unknown) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderChange = async (newOrderId: string) => {
    setOrderId(newOrderId);
    const order = orders.find(o => o.id === newOrderId);
    if (order) {
      setSelectedOrder(order);
      setOrderItems(order.order_items || []);
    }
  };

  const handleOrderItemChange = (itemId: string) => {
    setOrderItemId(itemId);
    const item = orderItems.find(i => i.id === itemId);
    if (item) {
      setStyleId(item.styleId);
      setTotalQuantity(item.totalQuantity);

      // Load color x size breakup from order_item_breakup
      if (item.order_item_breakup) {
        setColorSizeBreakup(item.order_item_breakup.map((b: { colorId: string; sizeId: string; quantity: number }) => ({
          colorId: b.colorId,
          sizeId: b.sizeId,
          quantity: b.quantity
        })));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setLoading(true);

      const workOrderData: CreateWorkOrderDTO = {
        orderId,
        orderItemId,
        styleId,
        locationId,
        plannedStartDate: new Date(plannedStartDate),
        plannedEndDate: new Date(plannedEndDate),
        totalQuantity,
        priority,
        remarks,
        colorSizeBreakup
      };

      await workOrderService.create(workOrderData);
      setSuccess('Work order created successfully');

      setTimeout(() => {
        navigate('/production/work-orders');
      }, 1500);
    } catch (err: unknown) {
      setError(err.response?.data?.message || 'Failed to create work order');
    } finally {
      setLoading(false);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="container mx-auto py-6">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <PageHeader title={isEdit ? 'Edit Work Order' : 'Create Work Order'}>
        <Button variant="outline" onClick={() => navigate('/production/work-orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to List
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
          {/* Order Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="orderId">Customer Order *</Label>
                  <Select value={orderId || undefined} onValueChange={handleOrderChange} required>
                    <SelectTrigger id="orderId">
                      <SelectValue placeholder="Select an order" />
                    </SelectTrigger>
                    <SelectContent>
                      {orders.filter(order => order.id && order.id.trim() !== '').map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.orderNumber} - {order.customers?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="orderItemId">Order Item / Style *</Label>
                  <Select
                    value={orderItemId || undefined}
                    onValueChange={handleOrderItemChange}
                    required
                    disabled={!orderId}
                  >
                    <SelectTrigger id="orderItemId">
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent>
                      {orderItems.filter(item => item.id && item.id.trim() !== '').map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.styles?.styleCode} - {item.styles?.styleName} ({item.totalQuantity} pcs)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Production Details */}
          <Card>
            <CardHeader>
              <CardTitle>Production Planning</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="locationId">Production Location *</Label>
                  <Select value={locationId || undefined} onValueChange={setLocationId} required>
                    <SelectTrigger id="locationId">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.filter(loc => loc.id && loc.id.trim() !== '').map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.warehouseName} ({loc.city || 'N/A'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                <div>
                  <Label htmlFor="totalQuantity">Total Quantity *</Label>
                  <Input
                    id="totalQuantity"
                    type="number"
                    value={totalQuantity}
                    onChange={(e) => setTotalQuantity(parseInt(e.target.value))}
                    required
                    readOnly
                  />
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

          {/* Color x Size Breakup (if available) */}
          {colorSizeBreakup.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Color x Size Breakup</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-2">
                  {colorSizeBreakup.length} color/size combinations
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/production/work-orders')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="mr-2 h-4 w-4" />
              {loading ? 'Creating...' : 'Create Work Order'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
