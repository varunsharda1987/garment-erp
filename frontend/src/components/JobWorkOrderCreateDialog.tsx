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
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { GreigeCombobox } from '@/components/GreigeCombobox';
import ColorPicker from '@/components/ColorPicker';
import { billableFromGreige } from '@/utils/shrinkage';
import { processorRateCardV2Service } from '@/services/processorRateCardV2.service';
import type { GreigeForRateCard, PrintingTypeV2 } from '@/types/processorRateCardV2.types';
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
/** The print types a rate card is keyed on — a printer quotes pigment and discharge differently. */
const PRINTING_TYPES: Array<{ value: PrintingTypeV2; label: string }> = [
  { value: 'PIGMENT', label: 'Pigment' },
  { value: 'PROCIAN', label: 'Procian' },
  { value: 'DISCHARGE', label: 'Discharge' },
  { value: 'PIGMENT_DISCHARGE', label: 'Pigment + Discharge' },
];

/** Processes a processor rate card can be quoted for (cards exist for these two only). */
const RATE_CARD_PROCESS_TYPES: string[] = ['DYEING', 'PRINTING'];

/** What the processor's rate card says for the chosen greige at this job's metres. */
interface CardQuote {
  ratePerMeter: number | null;
  shrinkagePercent: number | null;
  slabLabel: string | null;
  /** 'CARD' the processor's own card · 'NONE' no card for this pair · 'FORBIDDEN' a 403 */
  status: 'CARD' | 'NONE' | 'FORBIDDEN';
}

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

/** Holds a value back until it stops changing — the quantity drives a rate lookup per keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
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
  // Stock (style-less) fabric job — the things an order-linked job reads off its chain
  const [colorMasterId, setColorMasterId] = useState<string>('');
  const [sentWidthInches, setSentWidthInches] = useState<string>('');
  const [expectedShrinkage, setExpectedShrinkage] = useState<string>('');
  // The greige going out: the processor rate card's key, and the job's contract once saved.
  const [greigeId, setGreigeId] = useState<string>('');
  const [greige, setGreige] = useState<GreigeForRateCard | null>(null);
  const [printingType, setPrintingType] = useState<PrintingTypeV2 | ''>('');
  const [cardQuote, setCardQuote] = useState<CardQuote | null>(null);
  // Typing in either field pins it: the card may re-quote (a new slab, another greige) but it
  // must never overwrite a number the user put there deliberately.
  const rateTouched = useRef(false);
  const shrinkageTouched = useRef(false);
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

  /**
   * The processor's rate card, read the moment there is enough to key it on.
   *
   * Until 2026-09-21 this dialog asked for neither the greige nor the print type, so the card —
   * which is keyed on processor + process + greige (+ print type) + quantity slab — could not be
   * found, and the operator typed the rate and the shrinkage from memory while every other screen
   * filled them in (owner's report).
   *
   * Two lookups, deliberately: the card's shrinkage decides the metres the processor will BILL
   * for, and the slab is chosen on those billable metres — the same basis the server records. A
   * single lookup at the metres sent would put a boundary job in the wrong slab and file an
   * honest card rate as a manual variance.
   */
  const qtyNum = parseFloat(quantity);
  const debouncedQty = useDebounced(Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0, 300);
  // The quantity is part of the card's key (the slab), so there is nothing to ask until it is
  // typed. Quoting at a placeholder 1 m picks the lowest slab and reports "no rate card" for a
  // processor who has one at the real quantity — the shape live data actually has (Aryan Dyeing
  // holds a single card for GRG-0035, on the 1000-1500 m slab).
  const canQuote =
    RATE_CARD_PROCESS_TYPES.includes(processType) &&
    !!processorId &&
    !!greigeId &&
    debouncedQty > 0 &&
    (processType !== 'PRINTING' || !!printingType);

  useEffect(() => {
    if (!canQuote) {
      setCardQuote(null);
      return;
    }
    let cancelled = false;
    const quoteAt = (meters: number) =>
      processorRateCardV2Service.lookupRate(
        processorId,
        processType as 'DYEING' | 'PRINTING',
        greigeId,
        meters,
        (printingType || undefined) as PrintingTypeV2 | undefined
      );

    (async () => {
      try {
        const sentQty = debouncedQty;
        const first = await quoteAt(sentQty);
        if (cancelled) return;

        const shrink = first?.shrinkagePercent ?? null;
        // Re-quote on the billable metres when shrinkage moves them into another slab.
        const billable = shrink != null ? billableFromGreige(sentQty, shrink) : sentQty;
        const onBasis = billable !== sentQty ? await quoteAt(billable) : first;
        if (cancelled) return;

        const card = onBasis ?? first;
        setCardQuote({
          ratePerMeter: card?.ratePerMeter ?? null,
          shrinkagePercent: shrink,
          slabLabel: card?.slabLabel ?? null,
          status: card ? 'CARD' : 'NONE',
        });
        if (shrink != null && !shrinkageTouched.current) setExpectedShrinkage(String(shrink));
        if (card?.ratePerMeter != null && card.ratePerMeter > 0 && !rateTouched.current) {
          setAgreedRate(String(card.ratePerMeter));
        }
      } catch (error) {
        if (cancelled) return;
        const status = (error as { response?: { status?: number } })?.response?.status;
        // A 403 is not "no rate card" — saying so would send the user looking for a card that
        // exists. (The lookup routes were opened to every job-work role on 2026-09-21; this
        // stays as the honest message if a deployment is ever mid-flight.)
        setCardQuote({
          ratePerMeter: null,
          shrinkagePercent: null,
          slabLabel: null,
          status: status === 403 ? 'FORBIDDEN' : 'NONE',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canQuote, processorId, processType, greigeId, printingType, debouncedQty]);

  /** Everything is chosen except the quantity the card's slab is keyed on. */
  const needsQtyToQuote =
    RATE_CARD_PROCESS_TYPES.includes(processType) &&
    !!processorId &&
    !!greigeId &&
    (processType !== 'PRINTING' || !!printingType) &&
    debouncedQty <= 0;

  // No card for this pair: the greige's own average is the honest starting figure, never invented.
  // Held back until the card has actually been asked, so a figure never appears under a message
  // that has not been earned.
  useEffect(() => {
    if (!greige || shrinkageTouched.current || !canQuote) return;
    if (cardQuote?.shrinkagePercent != null) return;
    if (greige.averageShrinkagePercent != null) setExpectedShrinkage(String(greige.averageShrinkagePercent));
  }, [greige, cardQuote, canQuote]);

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
    setGreigeId('');
    setGreige(null);
    setPrintingType('');
    setCardQuote(null);
    rateTouched.current = false;
    shrinkageTouched.current = false;
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
    // The greige is what the rate card is quoted on and what issuance will hold the job to, so a
    // dyeing/printing stock job cannot be raised without naming it. Finishing has no cards.
    (!isStockFabricJob || !RATE_CARD_PROCESS_TYPES.includes(processType) || !!greigeId) &&
    (!isStockFabricJob || processType !== 'PRINTING' || !!printingType) &&
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
              greigeId: greigeId || null,
              printingType: processType === 'PRINTING' ? printingType || null : null,
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
                    <Label>
                      Greige (cloth going out) {RATE_CARD_PROCESS_TYPES.includes(processType) ? '*' : '(optional)'}
                    </Label>
                    <GreigeCombobox
                      value={greigeId}
                      onValueChange={setGreigeId}
                      onGreigeChange={setGreige}
                      placeholder="Select the greige being sent"
                    />
                    <p className="text-xs text-muted-foreground">
                      {RATE_CARD_PROCESS_TYPES.includes(processType)
                        ? "The rate and shrinkage come from this processor's rate card for this cloth. It is also what the job is held to — only lots of this greige can be issued against it."
                        : 'Used for the expected shrinkage and to hold the job to one cloth at issue.'}
                    </p>
                  </div>

                  {processType === 'PRINTING' && (
                    <div className="space-y-2">
                      <Label>Print type *</Label>
                      <Select value={printingType} onValueChange={(v) => setPrintingType(v as PrintingTypeV2)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select the print type" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRINTING_TYPES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Printers quote each type separately, so the rate card needs it.
                      </p>
                    </div>
                  )}

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
                        onChange={(e) => {
                          shrinkageTouched.current = true;
                          setExpectedShrinkage(e.target.value);
                        }}
                      />
                      {cardQuote?.shrinkagePercent != null ? (
                        <p className="text-xs text-muted-foreground">
                          From this processor&apos;s rate card: {cardQuote.shrinkagePercent}%
                          {cardQuote.slabLabel ? ` (${cardQuote.slabLabel})` : ''}
                        </p>
                      ) : cardQuote?.status === 'FORBIDDEN' ? (
                        <p className="text-xs text-amber-600">
                          Rate cards are not readable for your role — ask an admin, or type the contracted figure.
                        </p>
                      ) : greige?.averageShrinkagePercent != null && canQuote ? (
                        <p className="text-xs text-amber-600">
                          No rate card for this processor on this greige at {debouncedQty} {selected?.uom || 'MTR'} —
                          using {greige.greigeCode}&apos;s average {greige.averageShrinkagePercent}%. Enter the
                          contracted figure if it differs.
                        </p>
                      ) : greige && needsQtyToQuote ? (
                        <p className="text-xs text-muted-foreground">
                          Enter the quantity to read this processor&apos;s rate card — the rate depends on it.
                        </p>
                      ) : null}
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
                      onChange={(e) => {
                        rateTouched.current = true;
                        setAgreedRate(e.target.value);
                      }}
                    />
                    {cardQuote?.ratePerMeter != null && cardQuote.ratePerMeter > 0 ? (
                      <p
                        className={
                          Math.abs((parseFloat(agreedRate) || 0) - cardQuote.ratePerMeter) >= 0.005
                            ? 'text-xs text-amber-600'
                            : 'text-xs text-muted-foreground'
                        }
                      >
                        Rate card: ₹
                        {cardQuote.ratePerMeter.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        /m{cardQuote.slabLabel ? ` @ ${cardQuote.slabLabel}` : ''} for this quantity
                        {Math.abs((parseFloat(agreedRate) || 0) - cardQuote.ratePerMeter) >= 0.005
                          ? ' — differs from the typed rate'
                          : ''}
                      </p>
                    ) : cardQuote?.status === 'NONE' && canQuote ? (
                      <p className="text-xs text-amber-600">
                        No rate card for this processor on this greige at {debouncedQty} {selected?.uom || 'MTR'} —
                        enter the agreed rate.
                      </p>
                    ) : needsQtyToQuote ? (
                      <p className="text-xs text-muted-foreground">
                        Enter the quantity to read this processor&apos;s rate card.
                      </p>
                    ) : null}
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
