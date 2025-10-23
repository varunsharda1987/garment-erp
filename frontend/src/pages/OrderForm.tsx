import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { customerService } from '../services/customer.service';
import { createOrder, getOrderById, updateOrder } from '../services/order.service';
import { styleService } from '../services/style.service';
import type { Customer } from '../types/customer.types';
import type { Style } from '../types/style.types';
import type { CreateOrderItem, Priority } from '../types/order.types';
import { PriorityLabels } from '../types/order.types';

interface ColorOption {
  id: string;
  colorName: string;
  colorCode?: string;
}

interface SizeOption {
  id: string;
  sizeName: string;
  sizeCode: string;
}

interface OrderItemForm extends CreateOrderItem {
  tempId: string;
  style?: Style;
  colors: ColorOption[];
  sizes: SizeOption[];
}

export default function OrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [remarks, setRemarks] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItemForm[]>([]);

  useEffect(() => {
    fetchCustomers();
    fetchStyles();
    if (isEditMode && id) {
      fetchOrder(id);
    }
  }, [id, isEditMode]);

  const fetchCustomers = async () => {
    try {
      const response = await customerService.getAllCustomers({ limit: 1000 });
      setCustomers(response.data);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  };

  const fetchStyles = async () => {
    try {
      const response = await styleService.getAllStyles({ limit: 1000 });
      setStyles(response.data);
    } catch (err) {
      console.error('Failed to fetch styles:', err);
    }
  };

  const fetchOrder = async (orderId: string) => {
    try {
      setIsLoading(true);
      const order = await getOrderById(orderId);

      setCustomerId(order.customerId);
      setExpectedDeliveryDate(order.expectedDeliveryDate.split('T')[0]);
      setPriority(order.priority);
      setPaymentTerms(order.paymentTerms || '');
      setShippingAddress(order.shippingAddress || '');
      setRemarks(order.remarks || '');

      // TODO: Load order items

    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch order');
    } finally {
      setIsLoading(false);
    }
  };

  const addOrderItem = () => {
    const newItem: OrderItemForm = {
      tempId: Date.now().toString(),
      styleId: '',
      itemDescription: '',
      unitPrice: '',
      deliveryDate: '',
      remarks: '',
      breakup: [],
      colors: [],
      sizes: [],
    };
    setOrderItems([...orderItems, newItem]);
  };

  const removeOrderItem = (tempId: string) => {
    setOrderItems(orderItems.filter((item) => item.tempId !== tempId));
  };

  const updateOrderItem = (tempId: string, field: keyof OrderItemForm, value: any) => {
    setOrderItems(
      orderItems.map((item) =>
        item.tempId === tempId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleStyleChange = async (tempId: string, styleId: string) => {
    const style = styles.find((s) => s.id === styleId);
    if (!style) return;

    // Fetch style details with colors and sizes
    try {
      const fullStyle = await styleService.getStyleById(styleId);

      const colors = (fullStyle as any).colorOptions || [];
      const sizes = (fullStyle as any).sizeOptions || [];

      // Initialize breakup matrix
      const breakup = colors.flatMap((color: ColorOption) =>
        sizes.map((size: SizeOption) => ({
          colorId: color.id,
          sizeId: size.id,
          quantity: 0,
        }))
      );

      updateOrderItem(tempId, 'styleId', styleId);
      updateOrderItem(tempId, 'style', fullStyle);
      updateOrderItem(tempId, 'colors', colors);
      updateOrderItem(tempId, 'sizes', sizes);
      updateOrderItem(tempId, 'breakup', breakup);
    } catch (err) {
      console.error('Failed to fetch style details:', err);
    }
  };

  const updateBreakupQuantity = (
    tempId: string,
    colorId: string,
    sizeId: string,
    quantity: number
  ) => {
    setOrderItems(
      orderItems.map((item) => {
        if (item.tempId !== tempId) return item;

        const breakup = item.breakup.map((b) =>
          b.colorId === colorId && b.sizeId === sizeId ? { ...b, quantity } : b
        );

        return { ...item, breakup };
      })
    );
  };

  const calculateItemTotal = (item: OrderItemForm): number => {
    const totalQty = item.breakup.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
    const unitPrice = Number(item.unitPrice) || 0;
    return totalQty * unitPrice;
  };

  const calculateGrandTotal = (): number => {
    return orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate
      if (!customerId) {
        setError('Please select a customer');
        setIsLoading(false);
        return;
      }

      if (orderItems.length === 0) {
        setError('Please add at least one order item');
        setIsLoading(false);
        return;
      }

      // Filter out items with no breakup or zero quantities
      const validItems = orderItems
        .filter((item) => item.styleId && item.breakup.some((b) => b.quantity > 0))
        .map((item) => ({
          styleId: item.styleId,
          itemDescription: item.itemDescription,
          unitPrice: item.unitPrice,
          deliveryDate: item.deliveryDate || undefined,
          remarks: item.remarks || undefined,
          breakup: item.breakup.filter((b) => b.quantity > 0),
        }));

      if (validItems.length === 0) {
        setError('Please add quantities to at least one order item');
        setIsLoading(false);
        return;
      }

      const orderData = {
        customerId,
        expectedDeliveryDate,
        priority,
        paymentTerms: paymentTerms || undefined,
        shippingAddress: shippingAddress || undefined,
        remarks: remarks || undefined,
        items: validItems,
      };

      if (isEditMode && id) {
        // await updateOrder(id, orderData);
        setError('Edit mode not yet implemented');
      } else {
        await createOrder(orderData);
        navigate('/orders');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save order');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? 'Edit Order' : 'Create New Order'}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Order Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customer">Customer *</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.code} - {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="expectedDeliveryDate">Expected Delivery Date *</Label>
                <Input
                  id="expectedDeliveryDate"
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PriorityLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Input
                  id="paymentTerms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g., 30 days net"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="shippingAddress">Shipping Address</Label>
              <Textarea
                id="shippingAddress"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
              />
            </div>

            {/* Order Items */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Order Items</h3>
                <Button type="button" onClick={addOrderItem} variant="outline">
                  + Add Item
                </Button>
              </div>

              {orderItems.map((item, index) => (
                <Card key={item.tempId} className="p-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Item {index + 1}</h4>
                      <Button
                        type="button"
                        onClick={() => removeOrderItem(item.tempId)}
                        variant="destructive"
                        size="sm"
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Style *</Label>
                        <Select
                          value={item.styleId}
                          onValueChange={(value) => handleStyleChange(item.tempId, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select style" />
                          </SelectTrigger>
                          <SelectContent>
                            {styles.map((style) => (
                              <SelectItem key={style.id} value={style.id}>
                                {style.styleCode} - {style.styleName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Unit Price *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateOrderItem(item.tempId, 'unitPrice', e.target.value)
                          }
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <Label>Delivery Date</Label>
                        <Input
                          type="date"
                          value={item.deliveryDate}
                          onChange={(e) =>
                            updateOrderItem(item.tempId, 'deliveryDate', e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Item Description</Label>
                      <Input
                        value={item.itemDescription}
                        onChange={(e) =>
                          updateOrderItem(item.tempId, 'itemDescription', e.target.value)
                        }
                        placeholder="Optional description"
                      />
                    </div>

                    {/* Color/Size Matrix */}
                    {item.colors.length > 0 && item.sizes.length > 0 && (
                      <div className="overflow-x-auto">
                        <Label>Quantity Breakup (Color x Size)</Label>
                        <table className="min-w-full border mt-2">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border p-2 text-left">Color</th>
                              {item.sizes.map((size) => (
                                <th key={size.id} className="border p-2 text-center">
                                  {size.sizeName}
                                </th>
                              ))}
                              <th className="border p-2 text-center font-bold">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.colors.map((color) => {
                              const rowTotal = item.breakup
                                .filter((b) => b.colorId === color.id)
                                .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);

                              return (
                                <tr key={color.id}>
                                  <td className="border p-2 font-medium">
                                    {color.colorName}
                                  </td>
                                  {item.sizes.map((size) => {
                                    const breakupItem = item.breakup.find(
                                      (b) => b.colorId === color.id && b.sizeId === size.id
                                    );
                                    return (
                                      <td key={size.id} className="border p-1">
                                        <Input
                                          type="number"
                                          min="0"
                                          value={breakupItem?.quantity || 0}
                                          onChange={(e) =>
                                            updateBreakupQuantity(
                                              item.tempId,
                                              color.id,
                                              size.id,
                                              parseInt(e.target.value) || 0
                                            )
                                          }
                                          className="text-center"
                                        />
                                      </td>
                                    );
                                  })}
                                  <td className="border p-2 text-center font-bold">
                                    {rowTotal}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-gray-50 font-bold">
                              <td className="border p-2">Total</td>
                              {item.sizes.map((size) => {
                                const colTotal = item.breakup
                                  .filter((b) => b.sizeId === size.id)
                                  .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
                                return (
                                  <td key={size.id} className="border p-2 text-center">
                                    {colTotal}
                                  </td>
                                );
                              })}
                              <td className="border p-2 text-center">
                                {item.breakup.reduce(
                                  (sum, b) => sum + (Number(b.quantity) || 0),
                                  0
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <div className="mt-2 text-sm font-semibold">
                          Item Total: ₹{calculateItemTotal(item).toFixed(2)}
                        </div>
                      </div>
                    )}

                    {item.styleId && item.colors.length === 0 && (
                      <p className="text-sm text-gray-500">
                        This style has no color/size options defined. Please add them in Style Master first.
                      </p>
                    )}
                  </div>
                </Card>
              ))}

              {orderItems.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  No items added yet. Click "Add Item" to start.
                </p>
              )}
            </div>

            {/* Summary */}
            {orderItems.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex justify-end">
                  <div className="text-right space-y-2">
                    <div className="text-lg font-semibold">
                      Grand Total: ₹{calculateGrandTotal().toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/orders')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isEditMode ? 'Update Order' : 'Create Order'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
