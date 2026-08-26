/**
 * Job Work Order Create Dialog (Consolidation Phase 3)
 *
 * Generic create surface for job work. Service process types (embroidery, washing,
 * kaaj-button, ...) are created directly as DRAFT JWOs.
 *
 * Dyeing/Printing FOR A STYLE route to the Processing pages, whose greige-stock-backed flow
 * creates the PO + JWO pair. Dyeing/Printing with NO style is a stock job — dye now, allocate
 * the cloth to a style later — and is created right here. That distinction is why Process Type
 * and Style sit ABOVE the branch: previously the Style field lived inside the service-process
 * branch, so on Dyeing it never rendered and the field could not be left blank on purpose.
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
import { styleService } from '@/services/style.service';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import ColorPicker from '@/components/ColorPicker';
import { billableFromGreige } from '@/utils/shrinkage';
import api from '@/lib/api';
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

/** process_type_master.processCategory = 'FABRIC' — the jobs whose output is cloth. */
const FABRIC_PROCESS_TYPES: string[] = ['DYEING', 'PRINTING', 'FINISHING'];

/**
 * Processes where the shade IS the instruction, so a stock job cannot be raised without one:
 * the processor would get a document that doesn't say what colour to dye, and every stock run
 * of the same greige would dedup into a single fabric master sharing stock and cost.
 * Finishing is deliberately absent — two finishing runs of one greige ARE the same cloth.
 */
const SHADE_REQUIRED_PROCESS_TYPES: string[] = ['DYEING', 'PRINTING'];

/**
 * Maps JWO process types to supplier categories for filtering the processor dropdown.
 * This ensures only relevant processors appear for each process type.
 */
const PROCESS_TO_CATEGORY: Record<string, string> = {
  DYEING: 'DYEING_PRINTING',
  PRINTING: 'DYEING_PRINTING',
  EMBROIDERY: 'EMBROIDERY',
  WASHING: 'WASHING',
  FINISHING: 'FINISHING_CONTRACTOR',
  CUTTING: 'CMT_UNIT',
  STITCHING: 'CMT_UNIT',
  HANDWORK: 'HAND_WORK',
  SMOCKING: 'SMOCKING',
  KAAJ_BUTTON: 'OTHER_SERVICES',
  TRANSPORTATION: 'OTHER_SERVICES',
};

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
  // EMBROIDERY (Phase 5b: fabric-roll embroidery is a JWO)
  const [fabricStockLotId, setFabricStockLotId] = useState<string>('');
  const [embroideryId, setEmbroideryId] = useState<string>('');
  // Stock (style-less) fabric job — the three things an order-linked job reads off its chain
  const [colorMasterId, setColorMasterId] = useState<string>('');
  const [sentWidthInches, setSentWidthInches] = useState<string>('');
  const [expectedShrinkage, setExpectedShrinkage] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const selected = PROCESS_OPTIONS.find((p) => p.value === processType);
  const isKaaj = processType === 'KAAJ_BUTTON';
  const isEmbroidery = processType === 'EMBROIDERY';
  /** Dyeing/Printing FOR A STYLE belongs to the Processing page's PO+JWO flow, not here. */
  const isProcessRedirect = !!selected?.existingFlow && !!styleId;
  /** Cloth process with no style: dye/print to stock now, allocate to a style later. */
  const isStockFabricJob = FABRIC_PROCESS_TYPES.includes(processType) && !styleId;
  const shadeRequired = isStockFabricJob && SHADE_REQUIRED_PROCESS_TYPES.includes(processType);

  const expectedBack = useMemo(() => {
    const qty = parseFloat(quantity);
    const shrink = parseFloat(expectedShrinkage);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(shrink) || shrink <= 0) return null;
    return billableFromGreige(qty, shrink);
  }, [quantity, expectedShrinkage]);

  interface EmbroideryLotOption {
    id: string;
    quantityAvailable: number | string;
    needsEmbroidery?: boolean;
    fabricMaster?: { fabricCode?: string; fabricName?: string };
    fabric?: { fabricCode?: string; fabricName?: string };
  }
  const { data: embLotsResponse } = useQuery({
    queryKey: ['embroidery-pending-lots'],
    queryFn: () => api.get('/embroidery-stock/pending-embroidery?limit=100').then((r) => r.data),
    enabled: open && isEmbroidery,
    staleTime: 60 * 1000,
  });
  const embLots: EmbroideryLotOption[] = embLotsResponse?.data || [];

  const { data: designsResponse } = useQuery({
    queryKey: ['embroidery-designs-for-jwo'],
    queryFn: () => api.get('/embroidery?limit=100').then((r) => r.data),
    enabled: open && isEmbroidery,
    staleTime: 5 * 60 * 1000,
  });
  const designs: Array<{ id: string; embroideryCode?: string; designName?: string }> = designsResponse?.data || [];

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
    setFabricStockLotId('');
    setEmbroideryId('');
    setColorMasterId('');
    setSentWidthInches('');
    setExpectedShrinkage('');
  };

  const canSubmit =
    !!processType &&
    !isProcessRedirect &&
    !!processorId &&
    (parseFloat(quantity) || 0) > 0 &&
    (!shadeRequired || !!colorMasterId) &&
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
        ...(isEmbroidery
          ? {
              fabricStockLotId: fabricStockLotId || null,
              embroideryId: embroideryId || null,
            }
          : {}),
        ...(isStockFabricJob
          ? {
              colorMasterId: colorMasterId || null,
              sentWidthInches: parseFloat(sentWidthInches) || null,
              expectedShrinkage: parseFloat(expectedShrinkage) || null,
            }
          : {}),
      };
      const result = await jobWorkOrderService.create(payload);
      toast.success(
        isStockFabricJob
          ? `Stock job ${result.data.jobWorkNumber} created as Draft — approve it, then issue the greige.`
          : `Job Work Order ${result.data.jobWorkNumber} created`
      );
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
            <Select
              value={processType}
              onValueChange={(val) => {
                setProcessType(val);
                // Reset processor when process type changes (filtered list changes)
                setProcessorId('');
              }}
            >
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

          {processType && (
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
          )}

          {isProcessRedirect ? (
            <Alert>
              <AlertDescription className="space-y-2">
                <span className="block">
                  {selected?.label} for a style is created from the Processing page, where greige stock is selected and
                  the linked PO is raised automatically.
                </span>
                <span className="block text-muted-foreground">
                  Clear the Style field to create a stock {selected?.label.toLowerCase()} order here — process now, map
                  the cloth to a style later.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/processing');
                  }}
                >
                  Go to Processing <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </AlertDescription>
            </Alert>
          ) : processType ? (
            <>
              {isStockFabricJob && (
                <Alert>
                  <AlertDescription className="text-sm">
                    <span className="font-medium">Stock job — no style.</span> The cloth that comes back is registered
                    as a generic fabric you can allocate to a style later. Because there is no style, the shade, the
                    finished width and the shrinkage have to be stated here instead of being read from the order.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Processor *</Label>
                <SupplierCombobox
                  value={processorId}
                  onValueChange={setProcessorId}
                  placeholder="Select processor..."
                  categoryFilter={PROCESS_TO_CATEGORY[processType]}
                />
              </div>

              {isStockFabricJob && (
                <div className="border rounded-md p-3 space-y-3">
                  <div className="space-y-2">
                    <Label>Colour {shadeRequired ? '*' : '(optional)'}</Label>
                    <ColorPicker
                      value={colorMasterId || null}
                      onChange={(colorId) => setColorMasterId(colorId || '')}
                      placeholder="Select the shade to process"
                      showFamilyFilter
                    />
                    <p className="text-xs text-muted-foreground">
                      {shadeRequired
                        ? 'Printed on the challan as the instruction to the processor, and what keeps each shade a separate fabric in stock.'
                        : 'Finishing does not change the shade, so this can be left blank.'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Finished Width (inches)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={sentWidthInches}
                        onChange={(e) => setSentWidthInches(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expected Shrinkage (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={99.99}
                        step={0.1}
                        value={expectedShrinkage}
                        onChange={(e) => setExpectedShrinkage(e.target.value)}
                      />
                    </div>
                  </div>
                  {expectedBack !== null && (
                    <p className="text-sm text-muted-foreground">
                      Expected fabric back:{' '}
                      <span className="font-semibold text-foreground">
                        {expectedBack.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m
                      </span>{' '}
                      — this is what the processor is held to, and what the loss split is measured against.
                    </p>
                  )}
                </div>
              )}

              {isEmbroidery && (
                <>
                  <div className="space-y-2">
                    <Label>Fabric Lot (source roll — can also be picked at issue)</Label>
                    <Select value={fabricStockLotId} onValueChange={setFabricStockLotId}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={embLots.length ? 'Select fabric lot' : 'No lots pending embroidery'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {embLots.map((lot) => (
                          <SelectItem key={lot.id} value={lot.id}>
                            {lot.fabricMaster?.fabricCode ||
                              lot.fabric?.fabricCode ||
                              lot.fabricMaster?.fabricName ||
                              lot.fabric?.fabricName ||
                              lot.id.slice(0, 8)}{' '}
                            — {Number(lot.quantityAvailable)}m
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Embroidery Design (optional)</Label>
                    <Select value={embroideryId} onValueChange={setEmbroideryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select design" />
                      </SelectTrigger>
                      <SelectContent>
                        {designs.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.embroideryCode ? `${d.embroideryCode} — ` : ''}
                            {d.designName || d.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

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
          {!isProcessRedirect && (
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
