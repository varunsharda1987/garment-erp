// Fabric Physical Test Create Form
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, FlaskConical, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fabricPhysicalTestsService, testingLabsService } from '@/services/testing.service';
import { fabricService } from '@/services/fabricGreigeService';
import { styleService } from '@/services/style.service';
import { customerService } from '@/services/customer.service';
import type { CreateFabricPhysicalTestInput } from '@/types/testing.types';
import type { FabricMaster } from '@/types/fabric-greige.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

interface SelectableItem {
  id: string;
  code: string;
  name: string;
}

export default function FabricPhysicalTestForm() {
  const navigate = useNavigate();

  // Form state
  const [fabricId, setFabricId] = useState<string>('');
  const [selectedFabric, setSelectedFabric] = useState<SelectableItem | null>(null);
  const [fabricSearchOpen, setFabricSearchOpen] = useState(false);
  const [fabricSearch, setFabricSearch] = useState('');

  const [testingLabId, setTestingLabId] = useState<string>('');
  const [selectedLab, setSelectedLab] = useState<SelectableItem | null>(null);
  const [labSearchOpen, setLabSearchOpen] = useState(false);
  const [labSearch, setLabSearch] = useState('');

  const [styleId, setStyleId] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<SelectableItem | null>(null);
  const [styleSearchOpen, setStyleSearchOpen] = useState(false);
  const [styleSearch, setStyleSearch] = useState('');

  const [customerId, setCustomerId] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<SelectableItem | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const [sentToLabDate, setSentToLabDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sampleQuantity, setSampleQuantity] = useState<number>(0);
  const [batchNumber, setBatchNumber] = useState('');
  const [expectedGSM, setExpectedGSM] = useState<number>(0);
  const [expectedConstruction, setExpectedConstruction] = useState('');
  const [expectedCount, setExpectedCount] = useState('');
  const [toleranceGSM, setToleranceGSM] = useState<number>(5);

  // Fetch fabrics
  const { data: fabricsData, isLoading: fabricsLoading } = useQuery({
    queryKey: ['fabrics-search', fabricSearch],
    queryFn: () => fabricService.getAll({ search: fabricSearch, limit: 20 }),
    enabled: fabricSearchOpen || !!fabricSearch,
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
  const fabrics: SelectableItem[] = (fabricsData?.data || []).map((f: FabricMaster) => ({
    id: f.id,
    code: f.fabricCode,
    name: f.fabricName,
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

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateFabricPhysicalTestInput) => fabricPhysicalTestsService.create(data),
    onSuccess: () => {
      handleApiSuccess('Fabric physical test created successfully');
      navigate(`/fabric-physical-tests`);
    },
    onError: (err) => handleApiError(err, 'Failed to create fabric physical test'),
  });

  const handleSubmit = () => {
    if (!fabricId) {
      handleApiError(new Error('No fabric selected'), 'Please select a fabric');
      return;
    }

    const request: CreateFabricPhysicalTestInput = {
      fabricId,
      sentToLabDate: sentToLabDate || undefined,
      testingLabId: testingLabId || undefined,
      sampleQuantity: sampleQuantity > 0 ? sampleQuantity : undefined,
      batchNumber: batchNumber || undefined,
      expectedGSM: expectedGSM > 0 ? expectedGSM : undefined,
      expectedConstruction: expectedConstruction || undefined,
      expectedCount: expectedCount || undefined,
      toleranceGSM: toleranceGSM > 0 ? toleranceGSM : undefined,
      styleId: styleId || undefined,
      customerId: customerId || undefined,
    };

    createMutation.mutate(request);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/fabric-physical-tests')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <FlaskConical className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-display font-medium">New Fabric Physical Test</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Create a new fabric physical test record</p>
        </div>
      </div>

      {/* Fabric Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Fabric *</CardTitle>
          <CardDescription>Choose the fabric to test</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={fabricSearchOpen} onOpenChange={setFabricSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between">
                {selectedFabric ? (
                  <span>
                    {selectedFabric.code} — {selectedFabric.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Search for a fabric...</span>
                )}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[500px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search by code or name..."
                  value={fabricSearch}
                  onValueChange={setFabricSearch}
                />
                <CommandList>
                  <CommandEmpty>{fabricsLoading ? 'Searching...' : 'No fabrics found.'}</CommandEmpty>
                  <CommandGroup>
                    {fabrics.map((fabric) => (
                      <CommandItem
                        key={fabric.id}
                        value={fabric.id}
                        onSelect={() => {
                          setFabricId(fabric.id);
                          setSelectedFabric(fabric);
                          setFabricSearchOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{fabric.code}</span>
                          <span className="text-sm text-muted-foreground">{fabric.name}</span>
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
              <Label htmlFor="sampleQuantity">Sample Quantity (meters)</Label>
              <Input
                id="sampleQuantity"
                type="number"
                min={0}
                step={0.01}
                value={sampleQuantity || ''}
                onChange={(e) => setSampleQuantity(parseFloat(e.target.value) || 0)}
                placeholder="e.g., 2"
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
        </CardContent>
      </Card>

      {/* Expected Values */}
      <Card>
        <CardHeader>
          <CardTitle>Expected Values</CardTitle>
          <CardDescription>Set the expected test parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expectedGSM">Expected GSM</Label>
              <Input
                id="expectedGSM"
                type="number"
                min={0}
                step={1}
                value={expectedGSM || ''}
                onChange={(e) => setExpectedGSM(parseFloat(e.target.value) || 0)}
                placeholder="e.g., 180"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toleranceGSM">GSM Tolerance (%)</Label>
              <Input
                id="toleranceGSM"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={toleranceGSM || ''}
                onChange={(e) => setToleranceGSM(parseFloat(e.target.value) || 0)}
                placeholder="e.g., 5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedConstruction">Expected Construction</Label>
              <Input
                id="expectedConstruction"
                value={expectedConstruction}
                onChange={(e) => setExpectedConstruction(e.target.value)}
                placeholder="e.g., 40s x 40s / 120 x 60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedCount">Expected Count</Label>
              <Input
                id="expectedCount"
                value={expectedCount}
                onChange={(e) => setExpectedCount(e.target.value)}
                placeholder="e.g., 40s"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optional: Style and Customer */}
      <Card>
        <CardHeader>
          <CardTitle>Related Information (Optional)</CardTitle>
          <CardDescription>Link to a specific style or customer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Style */}
            <div className="space-y-2">
              <Label>Style</Label>
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
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search styles..." value={styleSearch} onValueChange={setStyleSearch} />
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
            </div>

            {/* Customer */}
            <div className="space-y-2">
              <Label>Customer</Label>
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate('/fabric-physical-tests')}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending || !fabricId}>
          {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create Test
        </Button>
      </div>
    </div>
  );
}
