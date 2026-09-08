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
import { getGreigeLace, getFinishedLace, createDyedLaceVariant } from '@/services/lace.service';
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
  // Lace dyeing: greige out, dyed variant back
  const [material, setMaterial] = useState<'FABRIC' | 'LACE'>('FABRIC');
  const [greigeLaceId, setGreigeLaceId] = useState<string>('');
  const [finishedLaceId, setFinishedLaceId] = useState<string>('');
  const [newVariantColor, setNewVariantColor] = useState<string>('');
  const [creatingVariant, setCreatingVariant] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selected = PROCESS_OPTIONS.find((p) => p.value === processType);
  const isKaaj = processType === 'KAAJ_BUTTON';
  const isEmbroidery = processType === 'EMBROIDERY';
  /**
   * Lace dyeing. Only DYEING: printing and finishing lace are not processes this system costs,
   * and the server refuses lace on any other type.
   */
  const isLaceJob = processType === 'DYEING' && material === 'LACE';
  /**
   * Dyeing/Printing FOR A STYLE belongs to the Processing page's PO+JWO flow, not here.
   * A lace job is exempt — that flow issues greige CLOTH and mints a fabric master, so it has
   * no door for lace even when the job is for a style.
   */
  const isProcessRedirect = !!selected?.existingFlow && !!styleId && !isLaceJob;
  /** Cloth process with no style: dye/print to stock now, allocate to a style later. */
  const isStockFabricJob = FABRIC_PROCESS_TYPES.includes(processType) && !styleId && !isLaceJob;
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

  const { data: greigeLaceResponse } = useQuery({
    queryKey: ['greige-lace-for-jwo'],
    queryFn: () => getGreigeLace({ limit: 200 }),
    enabled: open && isLaceJob,
    staleTime: 5 * 60 * 1000,
  });
  const greigeLaces = greigeLaceResponse?.data || [];
  const selectedGreigeLace = greigeLaces.find((l) => l.id === greigeLaceId);

  // Only the dyed variants OF THE CHOSEN GREIGE — the server refuses any other lace, because a
  // variant that did not come from this greige is a different material coming back.
  const { data: variantsResponse, refetch: refetchVariants } = useQuery({
    queryKey: ['dyed-lace-variants-for-jwo', greigeLaceId],
    queryFn: () => getFinishedLace({ limit: 200, sourceGreigeLaceId: greigeLaceId }),
    enabled: open && isLaceJob && !!greigeLaceId,
    staleTime: 60 * 1000,
  });
  const variants = variantsResponse?.data || [];

  const handleCreateVariant = async () => {
    const color = newVariantColor.trim();
    if (!greigeLaceId || !color) return;
    setCreatingVariant(true);
    try {
      // Deduped on (greige, colour) by the server, so re-typing an existing shade reuses it
      // instead of minting a twin that would split the dyed lace's stock in two.
      const result = await createDyedLaceVariant({ greigeLaceId, color });
      setFinishedLaceId(result.lace.id);
      setNewVariantColor('');
      await refetchVariants();
      toast.success(result.created ? `Created ${result.lace.laceName}` : `Using existing ${result.lace.laceName}`);
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to create the dyed variant');
    } finally {
      setCreatingVariant(false);
    }
  };

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
    setMaterial('FABRIC');
    setGreigeLaceId('');
    setFinishedLaceId('');
    setNewVariantColor('');
  };

  const canSubmit =
    !!processType &&
    !isProcessRedirect &&
    !!processorId &&
    (parseFloat(quantity) || 0) > 0 &&
    (!shadeRequired || !!colorMasterId) &&
    (!isLaceJob || (!!greigeLaceId && !!finishedLaceId)) &&
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
        ...(isLaceJob
          ? {
              greigeLaceId: greigeLaceId || null,
              finishedLaceId: finishedLaceId || null,
              // Left blank, the server falls back to the greige lace master's expected loss.
              expectedShrinkage: parseFloat(expectedShrinkage) || null,
            }
          : {}),
      };
      const result = await jobWorkOrderService.create(payload);
      toast.success(
        isLaceJob
          ? `Lace job ${result.data.jobWorkNumber} created as Draft — approve it, then issue the greige lace.`
          : isStockFabricJob
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

          {/*
            Lace dyeing is the same trade as cloth dyeing but a different material end to end:
            different stock table, different masters, and no fabric is minted on receipt. The
            choice sits above Style because it decides whether this dialog handles the job at all.
          */}
          {processType === 'DYEING' && (
            <div className="space-y-2">
              <Label>Material *</Label>
              <Select
                value={material}
                onValueChange={(val) => {
                  setMaterial(val as 'FABRIC' | 'LACE');
                  setGreigeLaceId('');
                  setFinishedLaceId('');
                  setNewVariantColor('');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FABRIC">Fabric (cloth)</SelectItem>
                  <SelectItem value="LACE">Lace</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

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

              {isLaceJob && (
                <div className="border rounded-md p-3 space-y-3">
                  <div className="space-y-2">
                    <Label>Greige Lace *</Label>
                    <Select
                      value={greigeLaceId}
                      onValueChange={(val) => {
                        setGreigeLaceId(val);
                        setFinishedLaceId('');
                        const lace = greigeLaces.find((l) => l.id === val);
                        // The master's own expected loss is the starting figure; the operator
                        // can still overwrite it with what this dyer has actually contracted.
                        if (lace?.expectedShrinkagePercent != null) {
                          setExpectedShrinkage(String(lace.expectedShrinkagePercent));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={greigeLaces.length ? 'Select greige lace' : 'No greige lace found'} />
                      </SelectTrigger>
                      <SelectContent>
                        {greigeLaces.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.laceCode} — {l.laceName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">This is what goes out on the challan.</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Dyed Variant Expected Back *</Label>
                    <Select value={finishedLaceId} onValueChange={setFinishedLaceId} disabled={!greigeLaceId}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !greigeLaceId
                              ? 'Pick the greige lace first'
                              : variants.length
                                ? 'Select the shade coming back'
                                : 'No dyed variants yet — create one below'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {variants.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.color || l.laceName} ({l.laceCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {greigeLaceId && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Or type a new shade, e.g. Navy"
                          value={newVariantColor}
                          onChange={(e) => setNewVariantColor(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!newVariantColor.trim() || creatingVariant}
                          onClick={handleCreateVariant}
                        >
                          {creatingVariant ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Each shade is its own lace, so dyed stock never pools with the greige or with another colour.
                    </p>
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
                    {expectedBack !== null ? (
                      <p className="text-sm text-muted-foreground">
                        Dyed lace expected back:{' '}
                        <span className="font-semibold text-foreground">
                          {expectedBack.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          m
                        </span>{' '}
                        — the dyer bills on the metres returned, so this is also what the rate is charged on.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Left blank, {selectedGreigeLace?.laceName || 'the greige lace'}&apos;s own expected loss is
                        used. With no figure at all the dyer bills on every metre sent.
                      </p>
                    )}
                  </div>
                </div>
              )}

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
