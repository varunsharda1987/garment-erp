/**
 * Job Work Order Create Dialog (Consolidation Phase 3)
 *
 * Generic create surface for job work. Service process types (embroidery, washing,
 * kaaj-button, ...) are created directly as DRAFT JWOs. Dyeing/Printing route to the
 * existing Processing pages, whose greige-stock-backed flow creates the PO + JWO pair.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { jobWorkOrderService } from '@/services/jobWorkOrder.service';
import { getAllSuppliers } from '@/services/supplier.service';
import { styleService } from '@/services/style.service';
import type { CreateJobWorkOrderRequest } from '@/types/jobWorkOrder.types';

const PROCESS_OPTIONS = [
  { value: 'DYEING', label: 'Dyeing', existingFlow: true, uom: 'MTR' },
  { value: 'PRINTING', label: 'Printing', existingFlow: true, uom: 'MTR' },
  { value: 'EMBROIDERY', label: 'Embroidery', existingFlow: false, uom: 'MTR' },
  { value: 'WASHING', label: 'Washing', existingFlow: false, uom: 'PCS' },
  { value: 'FINISHING', label: 'Finishing', existingFlow: false, uom: 'MTR' },
  { value: 'CUTTING', label: 'Cutting', existingFlow: false, uom: 'PCS' },
  { value: 'STITCHING', label: 'Stitching / CMT', existingFlow: false, uom: 'PCS' },
  { value: 'HANDWORK', label: 'Handwork', existingFlow: false, uom: 'PCS' },
  { value: 'SMOCKING', label: 'Smocking', existingFlow: false, uom: 'PCS' },
  { value: 'KAAJ_BUTTON', label: 'Kaaj-Button (Buttonhole & Attachment)', existingFlow: false, uom: 'PCS' },
  { value: 'TRANSPORTATION', label: 'Transportation', existingFlow: false, uom: 'TRIP' },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function JobWorkOrderCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const navigate = useNavigate();
  const [processType, setProcessType] = useState<string>('');
  const [processorId, setProcessorId] = useState<string>('');
  const [styleId, setStyleId] = useState<string>('');
  const [styleSearch, setStyleSearch] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [agreedRate, setAgreedRate] = useState<string>('');
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');
  const [remarks, setRemarks] = useState('');
  // KAAJ_BUTTON
  const [buttonholeCount, setButtonholeCount] = useState<string>('');
  const [buttonCount, setButtonCount] = useState<string>('');
  const [buttonholeRate, setButtonholeRate] = useState<string>('0.30');
  const [buttonRate, setButtonRate] = useState<string>('0.30');
  const [submitting, setSubmitting] = useState(false);

  const selected = PROCESS_OPTIONS.find((p) => p.value === processType);
  const isKaaj = processType === 'KAAJ_BUTTON';

  const { data: suppliersResponse } = useQuery({
    queryKey: ['suppliers-for-jwo'],
    queryFn: () => getAllSuppliers({ limit: 200 }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const suppliers = (suppliersResponse as { data?: Array<{ id: string; name: string; code?: string }> })?.data || [];

  const { data: stylesResponse } = useQuery({
    queryKey: ['styles-for-jwo', styleSearch],
    queryFn: () => styleService.getAllStyles(1, 20, styleSearch || undefined),
    enabled: open,
    staleTime: 60 * 1000,
  });
  const styles =
    (stylesResponse as { data?: Array<{ id: string; styleCode: string; styleName?: string }> })?.data || [];

  const kaajTotal = useMemo(() => {
    if (!isKaaj) return 0;
    return (
      (parseInt(buttonholeCount) || 0) * (parseFloat(buttonholeRate) || 0) +
      (parseInt(buttonCount) || 0) * (parseFloat(buttonRate) || 0)
    );
  }, [isKaaj, buttonholeCount, buttonCount, buttonholeRate, buttonRate]);

  const reset = () => {
    setProcessType('');
    setProcessorId('');
    setStyleId('');
    setStyleSearch('');
    setQuantity('');
    setAgreedRate('');
    setExpectedReturnDate('');
    setRemarks('');
    setButtonholeCount('');
    setButtonCount('');
    setButtonholeRate('0.30');
    setButtonRate('0.30');
  };

  const canSubmit =
    !!processType &&
    !selected?.existingFlow &&
    !!processorId &&
    (parseFloat(quantity) || 0) > 0 &&
    (isKaaj
      ? (parseInt(buttonholeCount) || 0) > 0 || (parseInt(buttonCount) || 0) > 0
      : (parseFloat(agreedRate) || 0) > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload: CreateJobWorkOrderRequest = {
        processType,
        processorId,
        styleId: styleId || null,
        quantity: parseFloat(quantity),
        agreedRate: isKaaj ? 0 : parseFloat(agreedRate),
        expectedReturnDate: expectedReturnDate || null,
        remarks: remarks || undefined,
        ...(isKaaj
          ? {
              buttonholeCount: parseInt(buttonholeCount) || 0,
              buttonCount: parseInt(buttonCount) || 0,
              buttonholeRatePerUnit: parseFloat(buttonholeRate) || 0,
              buttonRatePerUnit: parseFloat(buttonRate) || 0,
            }
          : {}),
      };
      const result = await jobWorkOrderService.create(payload);
      toast.success(`Job Work Order ${result.data.jobWorkNumber} created`);
      if (result.warning) toast.warning(result.warning);
      reset();
      onOpenChange(false);
      onCreated();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to create job work order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Job Work Order</DialogTitle>
          <DialogDescription>Create a commercial document for outsourced work. It starts as a Draft.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Process Type *</Label>
            <Select value={processType} onValueChange={setProcessType}>
              <SelectTrigger>
                <SelectValue placeholder="Select process type" />
              </SelectTrigger>
              <SelectContent>
                {PROCESS_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected?.existingFlow ? (
            <Alert>
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>
                  {selected.label} orders are created from the Processing page, where greige stock is selected and the
                  linked PO is raised automatically.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/processing');
                  }}
                >
                  Go <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </AlertDescription>
            </Alert>
          ) : processType ? (
            <>
              <div className="space-y-2">
                <Label>Processor *</Label>
                <Select value={processorId} onValueChange={setProcessorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select processor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Style (optional)</Label>
                <Input
                  placeholder="Search style code..."
                  value={styleSearch}
                  onChange={(e) => {
                    setStyleSearch(e.target.value);
                    setStyleId('');
                  }}
                />
                {styleSearch && !styleId && styles.length > 0 && (
                  <div className="border rounded-md max-h-36 overflow-y-auto">
                    {styles.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                        onClick={() => {
                          setStyleId(s.id);
                          setStyleSearch(`${s.styleCode}${s.styleName ? ` — ${s.styleName}` : ''}`);
                        }}
                      >
                        {s.styleCode}
                        {s.styleName ? ` — ${s.styleName}` : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantity ({selected?.uom || 'PCS'}) *</Label>
                  <Input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>
                {!isKaaj && (
                  <div className="space-y-2">
                    <Label>Rate (₹/{selected?.uom || 'unit'}) *</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={agreedRate}
                      onChange={(e) => setAgreedRate(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Expected Return</Label>
                  <Input
                    type="date"
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                  />
                </div>
              </div>

              {isKaaj && (
                <div className="border rounded-md p-3 space-y-3">
                  <p className="text-sm font-medium">Kaaj-Button operations</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Buttonholes (count)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={buttonholeCount}
                        onChange={(e) => setButtonholeCount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rate/buttonhole (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={buttonholeRate}
                        onChange={(e) => setButtonholeRate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Buttons (count)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={buttonCount}
                        onChange={(e) => setButtonCount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rate/button (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={buttonRate}
                        onChange={(e) => setButtonRate(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Estimated total:{' '}
                    <span className="font-semibold text-foreground">
                      ₹{kaajTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>{' '}
                    + GST
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea rows={2} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          {!selected?.existingFlow && (
            <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Draft JWO
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default JobWorkOrderCreateDialog;
