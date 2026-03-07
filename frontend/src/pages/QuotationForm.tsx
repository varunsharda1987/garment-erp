import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { customerService } from '@/services/customer.service';
import { styleService } from '@/services/style.service';
import { createQuotation, getQuotationById, updateQuotation } from '@/services/quotation.service';
import type { Customer } from '@/types/customer.types';
import type { Style } from '@/types/style.types';
import type { QuotationItemInput } from '@/types/quotation.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { ArrowLeft, FileText, Plus, Trash2 } from 'lucide-react';

interface QuotationItemRow extends QuotationItemInput {
  tempId: string;
}

export default function QuotationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [remarks, setRemarks] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [items, setItems] = useState<QuotationItemRow[]>([
    {
      tempId: Date.now().toString(),
      styleId: '',
      description: '',
      totalQuantity: 0,
      unitPrice: 0,
      deliveryDays: 30,
      remarks: '',
    },
  ]);

  useEffect(() => {
    fetchCustomers();
    fetchStyles();
    if (isEditMode && id) {
      fetchQuotation(id);
    }
  }, [id, isEditMode]);

  const fetchCustomers = async () => {
    try {
      // Reduced from 1000 to 200 for performance
      const response = await customerService.getAllCustomers({ limit: 200 });
      setCustomers(response.data);
    } catch (err) {
      handleApiError(err, 'Failed to load customers');
    }
  };

  const fetchStyles = async () => {
    try {
      // Reduced from 1000 to 200 for performance
      const response = await styleService.getAllStyles(1, 200, undefined, undefined, undefined, undefined, 'ACTIVE');
      setStyles(response.data);
    } catch (err) {
      handleApiError(err, 'Failed to load styles');
    }
  };

  const fetchQuotation = async (quotationId: string) => {
    try {
      setIsLoading(true);
      const quotation = await getQuotationById(quotationId);

      setCustomerId(quotation.customerId);
      setQuotationDate(quotation.quotationDate.split('T')[0]);
      setValidUntil(quotation.validUntil.split('T')[0]);
      setRemarks(quotation.remarks || '');
      setTermsAndConditions(quotation.termsAndConditions || '');

      if (quotation.quotationItems && quotation.quotationItems.length > 0) {
        setItems(
          quotation.quotationItems.map((item) => ({
            tempId: item.id,
            styleId: item.styleId,
            description: item.description || '',
            totalQuantity: item.totalQuantity,
            unitPrice: Number(item.unitPrice),
            deliveryDays: item.deliveryDays,
            remarks: item.remarks || '',
          }))
        );
      }
    } catch (err) {
      handleApiError(err, 'Failed to load quotation');
      navigate('/quotations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        tempId: Date.now().toString(),
        styleId: '',
        description: '',
        totalQuantity: 0,
        unitPrice: 0,
        deliveryDays: 30,
        remarks: '',
      },
    ]);
  };

  const handleRemoveItem = (tempId: string) => {
    if (items.length === 1) {
      handleApiError(new Error('At least one item is required'), 'Validation Error');
      return;
    }
    setItems(items.filter((item) => item.tempId !== tempId));
  };

  const handleItemChange = (tempId: string, field: keyof QuotationItemInput, value: any) => {
    setItems(
      items.map((item) =>
        item.tempId === tempId ? { ...item, [field]: value } : item
      )
    );
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      return sum + (item.totalQuantity * item.unitPrice);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId || !validUntil) {
      handleApiError(new Error('Please fill in all required fields'), 'Validation Error');
      return;
    }

    // Validate items
    for (const item of items) {
      if (!item.styleId || item.totalQuantity <= 0 || item.unitPrice < 0) {
        handleApiError(
          new Error('All items must have a style, quantity > 0, and unit price >= 0'),
          'Validation Error'
        );
        return;
      }
    }

    const data = {
      customerId,
      quotationDate,
      validUntil,
      remarks: remarks.trim() || undefined,
      termsAndConditions: termsAndConditions.trim() || undefined,
      items: items.map((item) => ({
        styleId: item.styleId,
        description: item.description?.trim() || undefined,
        totalQuantity: item.totalQuantity,
        unitPrice: item.unitPrice,
        deliveryDays: item.deliveryDays,
        remarks: item.remarks?.trim() || undefined,
      })),
    };

    try {
      setIsLoading(true);

      if (isEditMode && id) {
        await updateQuotation(id, data);
        handleApiSuccess('Quotation updated', 'Quotation has been successfully updated.');
      } else {
        const quotation = await createQuotation(data);
        handleApiSuccess(
          'Quotation created',
          `Quotation ${quotation.quotationNumber} has been successfully created.`
        );
      }

      navigate('/quotations');
    } catch (err) {
      handleApiError(err, `Failed to ${isEditMode ? 'update' : 'create'} quotation`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/quotations')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <FileText className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? 'Edit Quotation' : 'Create Quotation'}
            </h1>
            <p className="text-sm text-gray-500">
              {isEditMode ? 'Update quotation details' : 'Generate a new quotation for a customer'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {/* Basic Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quotation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerId">
                  Customer <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={customerId}
                  onValueChange={setCustomerId}
                  disabled={isEditMode}
                >
                  <SelectTrigger id="customerId">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.billingName || customer.name} ({customer.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quotationDate">Quotation Date</Label>
                <Input
                  id="quotationDate"
                  type="date"
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="validUntil">
                  Valid Until <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any additional notes..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="termsAndConditions">Terms and Conditions</Label>
              <Textarea
                id="termsAndConditions"
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                placeholder="Payment terms, delivery conditions, etc."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Quotation Items</CardTitle>
              <Button type="button" onClick={handleAddItem} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={item.tempId} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-gray-700">Item {index + 1}</h4>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.tempId)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>
                      Style <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={item.styleId}
                      onValueChange={(value) => handleItemChange(item.tempId, 'styleId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        {styles?.map((style) => (
                          <SelectItem key={style.id} value={style.id}>
                            {style.styleCode} - {style.styleName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Quantity <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.totalQuantity || ''}
                      onChange={(e) =>
                        handleItemChange(item.tempId, 'totalQuantity', parseInt(e.target.value) || 0)
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Unit Price (₹) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unitPrice || ''}
                      onChange={(e) =>
                        handleItemChange(item.tempId, 'unitPrice', parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Delivery Days</Label>
                    <Input
                      type="number"
                      min="0"
                      value={item.deliveryDays || ''}
                      onChange={(e) =>
                        handleItemChange(item.tempId, 'deliveryDays', parseInt(e.target.value) || undefined)
                      }
                      placeholder="30"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Description</Label>
                    <Input
                      value={item.description || ''}
                      onChange={(e) => handleItemChange(item.tempId, 'description', e.target.value)}
                      placeholder="Item description or specifications"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-sm text-gray-600">Item Total:</div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(item.totalQuantity * item.unitPrice)}
                  </div>
                </div>
              </div>
            ))}

            {/* Total */}
            <div className="flex items-center justify-between pt-4 border-t-2 border-gray-300">
              <div className="text-lg font-semibold text-gray-900">Quotation Total:</div>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(calculateTotal())}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/quotations')}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? isEditMode
                ? 'Updating...'
                : 'Creating...'
              : isEditMode
              ? 'Update Quotation'
              : 'Create Quotation'}
          </Button>
        </div>
      </form>
    </div>
  );
}
