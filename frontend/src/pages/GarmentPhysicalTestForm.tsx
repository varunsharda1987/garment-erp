// Garment Physical Test Create Form
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Shirt, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { garmentPhysicalTestsService, testingLabsService } from '@/services/testing.service';
import { workOrderService } from '@/services/workOrder.service';
import { styleService } from '@/services/style.service';
import { customerService } from '@/services/customer.service';
import type { CreateGarmentPhysicalTestInput } from '@/types/testing.types';
import type { WorkOrder } from '@/types/production.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

interface SelectableItem {
  id: string;
  code: string;
  name: string;
}

export default function GarmentPhysicalTestForm() {
  const navigate = useNavigate();

  // Form state
  const [workOrderId, setWorkOrderId] = useState<string>('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<SelectableItem | null>(null);
  const [workOrderSearchOpen, setWorkOrderSearchOpen] = useState(false);
  const [workOrderSearch, setWorkOrderSearch] = useState('');

  const [styleId, setStyleId] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<SelectableItem | null>(null);
  const [styleSearchOpen, setStyleSearchOpen] = useState(false);
  const [styleSearch, setStyleSearch] = useState('');

  const [testingLabId, setTestingLabId] = useState<string>('');
  const [selectedLab, setSelectedLab] = useState<SelectableItem | null>(null);
  const [labSearchOpen, setLabSearchOpen] = useState(false);
  const [labSearch, setLabSearch] = useState('');

  const [customerId, setCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<SelectableItem | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const [sentToLabDate, setSentToLabDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sampleQuantity, setSampleQuantity] = useState<number>(0);
  const [batchNumber, setBatchNumber] = useState('');
  const [buyerApprovalRequired, setBuyerApprovalRequired] = useState(false);

  // Fetch work orders
  const { data: workOrdersData, isLoading: workOrdersLoading } = useQuery({
    queryKey: ['work-orders-search', workOrderSearch],
    queryFn: () => workOrderService.getAll({ search: workOrderSearch }),
    enabled: workOrderSearchOpen || !!workOrderSearch,
  });

  // Fetch testing labs
  const { data: labsData, isLoading: labsLoading } = useQuery({
    queryKey: ['testing-labs-search', labSearch],
    queryFn: () => testingLabsService.getAll({ search: labSearch, limit: 20 }),
    enabled: labSearchOpen || !!labSearch,
  });

  // Fetch styles
  const { data: stylesData, isLoading: stylesLoading } = useQuery({
    queryKey: ['styles-search', styleSearch],
    queryFn: () => styleService.getAllStyles(1, 20, styleSearch),
    enabled: styleSearchOpen || !!styleSearch,
  });

  // Fetch customers
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => customerService.getAllCustomers({ search: customerSearch, limit: 20 }),
    enabled: customerSearchOpen || !!customerSearch,
  });

  // Transform to common format
  const workOrders: SelectableItem[] = (workOrdersData || []).map((wo: WorkOrder) => ({
    id: wo.id,
    code: wo.workOrderNumber,
    name: wo.style?.styleName || 'Unknown Style',
  }));

  const labs: SelectableItem[] = (labsData?.data || []).map((l) => ({
    id: l.id,
    code: l.labCode,
    name: l.labName,
  }));

  const styles: SelectableItem[] = (stylesData?.data || []).map(
    (s: { id: string; styleCode: string; styleName: string }) => ({
      id: s.id,
      code: s.styleCode,
      name: s.styleName,
    })
  );

  const customers: SelectableItem[] = (customersData?.data || []).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));

  // Auto-fill style when work order is selected
  const handleWorkOrderSelect = (wo: SelectableItem) => {
    setWorkOrderId(wo.id);
    setSelectedWorkOrder(wo);
    setWorkOrderSearchOpen(false);

    // Find the work order to get its style
    const fullWO = workOrdersData?.find((w: WorkOrder) => w.id === wo.id);
    if (fullWO?.style) {
      setStyleId(fullWO.style.id);
      setSelectedStyle({
        id: fullWO.style.id,
        code: fullWO.style.styleCode,
        name: fullWO.style.styleName,
      });
    }
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateGarmentPhysicalTestInput) => garmentPhysicalTestsService.create(data),
    onSuccess: () => {
      handleApiSuccess('Garment physical test created successfully');
      navigate(`/garment-physical-tests`);
    },
    onError: (err) => handleApiError(err, 'Failed to create garment physical test'),
  });

  const handleSubmit = () => {
    if (!workOrderId) {
      handleApiError(new Error('No work order selected'), 'Please select a work order');
      return;
    }

    if (!styleId) {
      handleApiError(new Error('No style selected'), 'Please select a style');
      return;
    }

    const request: CreateGarmentPhysicalTestInput = {
      workOrderId,
      styleId,
      sentToLabDate: sentToLabDate || undefined,
      testingLabId: testingLabId || undefined,
      sampleQuantity: sampleQuantity > 0 ? sampleQuantity : undefined,
      batchNumber: batchNumber || undefined,
      customerId: customerId || undefined,
      buyerApprovalRequired,
    };

    createMutation.mutate(request);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/garment-physical-tests')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <Shirt className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-display font-medium">New Garment Physical Test</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Create a new garment physical test record</p>
        </div>
      </div>

      {/* Work Order Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Work Order *</CardTitle>
          <CardDescription>Choose the work order for this test</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={workOrderSearchOpen} onOpenChange={setWorkOrderSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between">
                {selectedWorkOrder ? (
                  <span>
                    {selectedWorkOrder.code} — {selectedWorkOrder.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Search for a work order...</span>
                )}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[500px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search by work order number..."
                  value={workOrderSearch}
                  onValueChange={setWorkOrderSearch}
                />
                <CommandList>
                  <CommandEmpty>{workOrdersLoading ? 'Searching...' : 'No work orders found.'}</CommandEmpty>
                  <CommandGroup>
                    {workOrders.map((wo) => (
                      <CommandItem key={wo.id} value={wo.id} onSelect={() => handleWorkOrderSelect(wo)}>
                        <div className="flex flex-col">
                          <span className="font-medium">{wo.code}</span>
                          <span className="text-sm text-muted-foreground">{wo.name}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Style Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Style *</CardTitle>
          <CardDescription>The style is auto-filled from work order, or select manually</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={styleSearchOpen} onOpenChange={setStyleSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between">
                {selectedStyle ? (
                  <span>
                    {selectedStyle.code} — {selectedStyle.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Search for a style...</span>
                )}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[500px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search by style code or name..."
                  value={styleSearch}
                  onValueChange={setStyleSearch}
                />
                <CommandList>
                  <CommandEmpty>{stylesLoading ? 'Searching...' : 'No styles found.'}</CommandEmpty>
                  <CommandGroup>
                    {styles.map((style) => (
                      <CommandItem
                        key={style.id}
                        value={style.id}
                        onSelect={() => {
                          setStyleId(style.id);
                          setSelectedStyle(style);
                          setStyleSearchOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{style.code}</span>
                          <span className="text-sm text-muted-foreground">{style.name}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Testing Lab Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Lab</CardTitle>
          <CardDescription>Select the lab where the sample will be tested</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={labSearchOpen} onOpenChange={setLabSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between">
                {selectedLab ? (
                  <span>
                    {selectedLab.code} — {selectedLab.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Search for a lab...</span>
                )}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[500px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search labs..." value={labSearch} onValueChange={setLabSearch} />
                <CommandList>
                  <CommandEmpty>{labsLoading ? 'Searching...' : 'No labs found.'}</CommandEmpty>
                  <CommandGroup>
                    {labs.map((lab) => (
                      <CommandItem
                        key={lab.id}
                        value={lab.id}
                        onSelect={() => {
                          setTestingLabId(lab.id);
                          setSelectedLab(lab);
                          setLabSearchOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{lab.code}</span>
                          <span className="text-sm text-muted-foreground">{lab.name}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Sample Details */}
      <Card>
        <CardHeader>
          <CardTitle>Sample Details</CardTitle>
          <CardDescription>Provide sample and testing information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sentToLabDate">Sent to Lab Date</Label>
              <Input
                id="sentToLabDate"
                type="date"
                value={sentToLabDate}
                onChange={(e) => setSentToLabDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sampleQuantity">Sample Quantity (pcs)</Label>
              <Input
                id="sampleQuantity"
                type="number"
                min={0}
                step={1}
                value={sampleQuantity || ''}
                onChange={(e) => setSampleQuantity(parseInt(e.target.value) || 0)}
                placeholder="e.g., 5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batchNumber">Batch Number</Label>
              <Input
                id="batchNumber"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="e.g., BT-2026-001"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center space-x-2">
            <Checkbox
              id="buyerApprovalRequired"
              checked={buyerApprovalRequired}
              onCheckedChange={(checked) => setBuyerApprovalRequired(checked === true)}
            />
            <Label htmlFor="buyerApprovalRequired" className="cursor-pointer">
              Buyer approval required for this test
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Customer (Optional) */}
      <Card>
        <CardHeader>
          <CardTitle>Customer (Optional)</CardTitle>
          <CardDescription>Link to a specific customer</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between">
                {selectedCustomer ? (
                  <span>
                    {selectedCustomer.code} — {selectedCustomer.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Search for a customer...</span>
                )}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search customers..."
                  value={customerSearch}
                  onValueChange={setCustomerSearch}
                />
                <CommandList>
                  <CommandEmpty>{customersLoading ? 'Searching...' : 'No customers found.'}</CommandEmpty>
                  <CommandGroup>
                    {customers.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        value={customer.id}
                        onSelect={() => {
                          setCustomerId(customer.id);
                          setSelectedCustomer(customer);
                          setCustomerSearchOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{customer.code}</span>
                          <span className="text-sm text-muted-foreground">{customer.name}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate('/garment-physical-tests')}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending || !workOrderId || !styleId}>
          {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create Test
        </Button>
      </div>
    </div>
  );
}
