/**
 * Test Requirement Form — create and edit.
 *
 * A full page rather than a dialog: there are ~60 checkboxes and ~25 fields, and a picker
 * inside a dialog is where the Radix focus-scope trap lives.
 *
 * The sections follow the printed sheet top to bottom, so what you fill on screen is in the
 * order you will read it on paper. Every label and the print order of the tick groups come
 * from GET /buyer-trfs/form-options — the backend catalogue is the only copy of the buyer's
 * wording, so nothing here is re-typed.
 *
 * Opened from a sample's Lab Tests tab it carries `?sampleId=` (a new lab round for that sample) or
 * `?sampleId=&retestOf=<trfId>` (the next round after a failed one — the server's prefill carries the
 * previous sheet over and switches it to RETEST), plus `?returnTo=` so Save goes back to the sample.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Loader2, Printer, Save, AlertTriangle, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { StyleCombobox } from '@/components/StyleCombobox';
import { usePickerOptions, type PickerPage } from '@/hooks/usePickerOptions';
import { buyerTrfService } from '@/services/buyerTrf.service';
import { getAllSaleOrders } from '@/services/saleOrder.service';
import { sampleService } from '@/services/sample.service';
import { openPDF } from '@/lib/document-utils';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import type { BuyerTrf, CreateBuyerTrfInput, TrfOption } from '@/types/buyerTrf.types';
import type { SaleOrder } from '@/types/saleOrder.types';
import { SampleTypeLabels } from '@/types/sample.types';

type Draft = Partial<BuyerTrf> & { styleId?: string; buyingDepartment?: string };

/**
 * The sale-orders list caps `limit` at 100 (saleOrder.schema.ts), below the shared
 * PICKER_LIMIT of 200 — asking for 200 makes every load a 400 and the picker sits on
 * "Could not load — open to retry" with no other clue.
 */
const SALE_ORDER_PAGE = 100;

/** "None" in the Sample select — Radix Select cannot hold an empty-string value. */
const NO_SAMPLE = '__none__';

/** Only an in-app sample page may be a return target — never an arbitrary URL from the query string. */
function safeReturnTo(value: string | null): string | null {
  return value && value.startsWith('/samples/') ? value : null;
}

/** One row of the identity block: label on the left, free text on the right. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A single-choice tick row (Package, Stage, Finish, Service, Department). */
function TickRow({
  options,
  value,
  onChange,
}: {
  options: TrfOption[];
  value: string | undefined;
  onChange: (code: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {options.map((o) => (
        <label key={o.code} className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={value === o.code} onCheckedChange={() => onChange(o.code)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/**
 * YES / NO / neither.
 *
 * The third state is the point: null prints two empty boxes for someone to tick by hand, and
 * is genuinely different from NO. Clicking the selected box clears it back to null.
 */
function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-1.5 last:border-0">
      <span className="text-sm">{label}</span>
      <div className="flex shrink-0 gap-4">
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <Checkbox checked={value === true} onCheckedChange={() => onChange(value === true ? null : true)} />
          Yes
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-sm">
          <Checkbox checked={value === false} onCheckedChange={() => onChange(value === false ? null : false)} />
          No
        </label>
      </div>
    </div>
  );
}

export default function BuyerTrfForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [searchParams] = useSearchParams();
  // Only a NEW form takes its sample / retest source from the URL; an existing form has its own.
  const sampleIdParam = isEdit ? null : searchParams.get('sampleId');
  const retestOfParam = isEdit ? null : searchParams.get('retestOf');
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  const [draft, setDraft] = useState<Draft>({});
  const [anchorKind, setAnchorKind] = useState<'saleOrder' | 'workOrder'>('saleOrder');
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [printing, setPrinting] = useState(false);

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  const { data: optionsData } = useQuery({
    queryKey: ['buyer-trf-form-options'],
    queryFn: () => buyerTrfService.getFormOptions(),
    staleTime: Infinity, // a static catalogue
  });
  const options = optionsData?.data;

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['buyer-trf', id],
    queryFn: () => buyerTrfService.getById(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing?.data) {
      setDraft(existing.data);
      setAnchorKind(existing.data.workOrderId ? 'workOrder' : 'saleOrder');
    }
  }, [existing]);

  /* ── Opened for a sample (new round) or as a retest (next round) ── */
  const { data: sourceSample } = useQuery({
    queryKey: ['sample', sampleIdParam],
    queryFn: () => sampleService.getSampleById(sampleIdParam!),
    enabled: Boolean(sampleIdParam),
  });
  const { data: previousRound } = useQuery({
    queryKey: ['buyer-trf', retestOfParam],
    queryFn: () => buyerTrfService.getById(retestOfParam!),
    enabled: Boolean(retestOfParam),
  });

  // Seed the draft once the sample / previous round arrives. Adjusting state while rendering,
  // guarded so it runs once per source (React's pattern for this, rather than an effect).
  const seedSource = isEdit ? null : (previousRound?.data ?? (sourceSample?.styleId ? sourceSample : null));
  const [seededFrom, setSeededFrom] = useState<object | null>(null);
  if (seedSource && seededFrom !== seedSource) {
    setSeededFrom(seedSource);
    const prev = previousRound?.data;
    if (prev) {
      // The next round goes to the same style and order as the one it retests.
      setAnchorKind(prev.workOrderId ? 'workOrder' : 'saleOrder');
      setDraft((d) => ({
        ...d,
        styleId: prev.styleId,
        saleOrderId: prev.saleOrderId,
        workOrderId: prev.workOrderId,
        sampleId: prev.sampleId ?? sampleIdParam,
      }));
    } else if (sourceSample?.styleId) {
      const styleId = sourceSample.styleId;
      setDraft((d) => ({ ...d, styleId, sampleId: sourceSample.id }));
    }
  }

  /** Style and buyer are fixed when the form is for a sample: the sample decides both. */
  const styleLocked = isEdit || Boolean(sampleIdParam || retestOfParam);
  const orderCustomerId = sourceSample?.customerId ?? previousRound?.data.customerId;

  /* ── Sale order picker ──
     Uses the LIST endpoint, not /sale-orders/search: both match on the buyer's PO number, but
     only the list returns buyerPoNumber in the payload — and the PO is what the merchant has
     in front of them, so it has to be visible in the option, not just matchable. */
  const lockedStyleId = styleLocked && !isEdit ? draft.styleId : undefined;
  const fetchSaleOrders = useCallback(
    async (search: string): Promise<PickerPage<SaleOrder>> => {
      const page = await getAllSaleOrders({
        search: search || undefined,
        limit: SALE_ORDER_PAGE,
        customerId: orderCustomerId,
      });
      const items = page.data ?? [];
      // For a sample, only the buyer's orders that carry this style. Filtered here rather than via a
      // new query param: the sale-order list is part of the B2B app's contract.
      if (!lockedStyleId) return { items, total: page.pagination?.total };
      const forStyle = items.filter((so) => so.items?.some((i) => i.style?.id === lockedStyleId));
      return { items: forStyle, total: forStyle.length };
    },
    [orderCustomerId, lockedStyleId]
  );

  const saleOrderPicker = usePickerOptions<SaleOrder>({
    fetch: fetchSaleOrders,
    // The picker's own limit, so "Showing N of M" counts against what we actually asked for.
    limit: SALE_ORDER_PAGE,
    toOption: (so): ComboboxOption => ({
      value: so.id,
      label: `${so.saleOrderNumber}${so.buyerPoNumber ? ` — PO ${so.buyerPoNumber.trim()}` : ''}`,
      searchText: `${so.saleOrderNumber} ${so.buyerPoNumber ?? ''}`,
    }),
    narrowHint: 'type a sale order or buyer PO number',
  });

  // A sample's style usually sits on exactly one of the buyer's orders: pick it for them.
  // Adjusting state while rendering; the guard makes it a one-shot.
  if (
    lockedStyleId &&
    !draft.saleOrderId &&
    !draft.workOrderId &&
    saleOrderPicker.initialLoaded &&
    saleOrderPicker.items.length === 1
  ) {
    setAnchorKind('saleOrder');
    setDraft((d) => ({ ...d, saleOrderId: saleOrderPicker.items[0].id }));
  }

  /* ── The sample this round is for (optional; the style's samples for this buyer) ── */
  const { data: styleSamples = [] } = useQuery({
    queryKey: ['samples', { styleId: draft.styleId }],
    queryFn: () => sampleService.getSamplesByStyle(draft.styleId!),
    enabled: Boolean(draft.styleId),
  });
  const sampleChoices = styleSamples.filter((s) => !draft.customerId || s.customerId === draft.customerId);
  const linkedSample =
    styleSamples.find((s) => s.id === draft.sampleId) ??
    (sourceSample?.id === draft.sampleId ? sourceSample : undefined);

  /**
   * Pull the prefill whenever the style and its anchor are both known.
   *
   * Only fills fields the user has not already typed into — the same rule the server applies
   * on create, so an edited fibre content is never quietly put back to what we hold.
   */
  const runPrefill = useCallback(
    async (
      styleId: string,
      anchor: { saleOrderId?: string; workOrderId?: string },
      round: { sampleId?: string; retestOfTrfId?: string }
    ) => {
      try {
        const { data } = await buyerTrfService.getPrefill({ styleId, ...anchor, ...round });
        setMissingFields(data.missingFields ?? []);
        setDraft((d) => {
          const next = { ...d };
          for (const [key, value] of Object.entries(data.values)) {
            const current = next[key as keyof Draft];
            if (current === undefined || current === null || current === '') {
              (next as Record<string, unknown>)[key] = value;
            }
          }
          return next;
        });
      } catch (error) {
        handleApiError(error, 'Could not pre-fill from the style');
      }
    },
    []
  );

  const prefillSampleId = sampleIdParam ?? undefined;
  const prefillRetestOf = retestOfParam ?? undefined;
  useEffect(() => {
    if (isEdit || !draft.styleId) return;
    // A retest round waits for the previous sheet; its anchor comes from there.
    if (prefillRetestOf && !previousRound) return;
    const round = { sampleId: prefillSampleId, retestOfTrfId: prefillRetestOf };
    if (anchorKind === 'saleOrder' && draft.saleOrderId) {
      void runPrefill(draft.styleId, { saleOrderId: draft.saleOrderId }, round);
    } else if (anchorKind === 'workOrder' && draft.workOrderId) {
      void runPrefill(draft.styleId, { workOrderId: draft.workOrderId }, round);
    }
  }, [
    isEdit,
    draft.styleId,
    draft.saleOrderId,
    draft.workOrderId,
    anchorKind,
    runPrefill,
    prefillSampleId,
    prefillRetestOf,
    previousRound,
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...draft } as CreateBuyerTrfInput;
      // The anchor is exclusive; send only the one in play so the server never sees both.
      if (anchorKind === 'saleOrder') payload.workOrderId = null;
      else payload.saleOrderId = null;

      return isEdit ? buyerTrfService.update(id!, payload) : buyerTrfService.create(payload);
    },
    onSuccess: (res) => {
      handleApiSuccess(isEdit ? 'Form saved' : `Form ${res.data.trfNumber} created`);
      void queryClient.invalidateQueries({ queryKey: ['buyer-trfs'] });
      void queryClient.invalidateQueries({ queryKey: ['buyer-trf', res.data.id] });
      navigate(returnTo ?? `/test-requirement-forms/${res.data.id}`);
    },
    onError: (error) => handleApiError(error, 'Could not save the form'),
  });

  const handlePrint = async () => {
    if (!id) return;
    setPrinting(true);
    try {
      await openPDF(`/documents/buyer-trfs/${id}/pdf`);
    } catch (error) {
      handleApiError(error, 'Could not open the form');
    } finally {
      setPrinting(false);
    }
  };

  const subCategoriesForDepartment = useMemo(
    () => (options?.buyingSubCategories ?? []).filter((s) => s.department === draft.buyingDepartment),
    [options, draft.buyingDepartment]
  );

  const toggleInArray = (key: 'selectedTests' | 'buyingSubCategories', code: string) => {
    const current = (draft[key] as string[] | undefined) ?? [];
    set(key, current.includes(code) ? current.filter((c) => c !== code) : [...current, code]);
  };

  if (isEdit && loadingExisting) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const canSave = Boolean(draft.styleId && draft.buyingDepartment && (draft.saleOrderId || draft.workOrderId));

  return (
    <div className="space-y-4 p-6 pb-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1"
            onClick={() => navigate(returnTo ?? '/test-requirement-forms')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {returnTo ? 'Back to sample' : 'All forms'}
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FileText className="h-6 w-6" />
            {isEdit ? `Test Requirement Form ${draft.trfNumber ?? ''}` : 'New Test Requirement Form'}
          </h1>
          {(linkedSample || retestOfParam) && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {linkedSample && (
                <Badge variant="secondary" className="gap-1">
                  <TestTube className="h-3 w-3" />
                  For sample {linkedSample.sampleNumber}
                </Badge>
              )}
              {previousRound?.data && <Badge variant="outline">Retest of {previousRound.data.trfNumber}</Badge>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <Button variant="outline" onClick={() => void handlePrint()} disabled={printing}>
              {printing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Print
            </Button>
          )}
          <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* ── What this form is about ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Style &amp; order</CardTitle>
          <CardDescription>
            Pick the style and the order it belongs to. Everything below fills itself from these two.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Style</Label>
            <StyleCombobox
              value={draft.styleId ?? ''}
              onChange={(styleId) => set('styleId', styleId)}
              status={null}
              disabled={styleLocked}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sale order</Label>
            <Combobox
              options={saleOrderPicker.options}
              value={draft.saleOrderId ?? ''}
              onValueChange={(v) => {
                setAnchorKind('saleOrder');
                set('saleOrderId', v);
              }}
              placeholder={
                !saleOrderPicker.initialLoaded
                  ? saleOrderPicker.loadError
                    ? 'Could not load — open to retry'
                    : 'Loading orders…'
                  : 'Select the buyer order…'
              }
              searchPlaceholder="Search sale order or buyer PO…"
              emptyText="No orders found."
              isLoading={saleOrderPicker.isLoading}
              footer={saleOrderPicker.footer}
              onOpenChange={(open) => {
                if (open && !saleOrderPicker.initialLoaded && !saleOrderPicker.isLoading) {
                  saleOrderPicker.load('');
                }
              }}
              // Without this the list never re-queries and typing filters only the first page —
              // the buyer's PO would be unfindable past the first 200 orders.
              onSearchChange={saleOrderPicker.load}
              disabled={isEdit}
            />
            <p className="text-xs text-muted-foreground">
              The buyer&rsquo;s PO number on this order becomes the form&rsquo;s Order Number.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sample</Label>
            <Select
              value={draft.sampleId ?? NO_SAMPLE}
              onValueChange={(v) => set('sampleId', v === NO_SAMPLE ? null : v)}
              disabled={!draft.styleId || Boolean(sampleIdParam) || Boolean(retestOfParam)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not linked to a sample" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SAMPLE}>Not linked to a sample</SelectItem>
                {sampleChoices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.sampleNumber} — {SampleTypeLabels[s.sampleType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The sample this lab round is for. Its Lab Tests tab then shows this form and the lab&rsquo;s result.
            </p>
          </div>
        </CardContent>
      </Card>

      {missingFields.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Some fields could not be filled in</AlertTitle>
          <AlertDescription>
            {missingFields.join(', ')}. Type them below, or leave them — they print as a hatched box for someone to
            complete by hand.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Section 01/02 of the sheet ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sample identity</CardTitle>
          <CardDescription>These print in the buyer&rsquo;s own field order.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field
            label="Sample Description"
            value={draft.sampleDescription}
            onChange={(v) => set('sampleDescription', v)}
          />
          <Field label="BO No" value={draft.boNumber} onChange={(v) => set('boNumber', v)} />
          <Field label="Style No." value={draft.styleNo} onChange={(v) => set('styleNo', v)} />
          <Field label="Color" value={draft.colour} onChange={(v) => set('colour', v)} />
          <Field
            label="Fiber Content"
            value={draft.fibreContent}
            onChange={(v) => set('fibreContent', v)}
            hint="Editable — the buyer may want a trade name (RAYON) where we hold the fibre (Viscose)."
          />
          <Field
            label="Age Range/Category"
            value={draft.ageRangeCategory}
            onChange={(v) => set('ageRangeCategory', v)}
          />
          <Field label="End Use" value={draft.endUse} onChange={(v) => set('endUse', v)} />
          <Field label="Order Number" value={draft.orderNumber} onChange={(v) => set('orderNumber', v)} />
          <Field label="Fabric Weight" value={draft.fabricWeightGsm} onChange={(v) => set('fabricWeightGsm', v)} />
          <Field label="Count" value={draft.yarnCount} onChange={(v) => set('yarnCount', v)} />
          <Field
            label="Season"
            value={draft.season}
            onChange={(v) => set('season', v)}
            placeholder="S10-26"
            hint="The buyer's own season code, not ours."
          />
          <Field label="Construction" value={draft.construction} onChange={(v) => set('construction', v)} />
          <Field label="Brand Name" value={draft.brandName} onChange={(v) => set('brandName', v)} />
          <Field
            label="Fabric Supplier Name"
            value={draft.fabricSupplierName}
            onChange={(v) => set('fabricSupplierName', v)}
          />
          <Field label="Vendor Code" value={draft.vendorCode} onChange={(v) => set('vendorCode', v)} />
          <Field label="Dyeing House Name" value={draft.dyeingHouse} onChange={(v) => set('dyeingHouse', v)} />
          <Field
            label="Processing House Name"
            value={draft.processingHouse}
            onChange={(v) => set('processingHouse', v)}
          />
          <Field
            label="Wash Care Code"
            value={draft.washCareCode}
            onChange={(v) => set('washCareCode', v)}
            hint="Remembered against this buyer and fabric when you save, so the next form fills it in."
          />
          <Field
            label="Easy Buy Merchandise (name)"
            value={draft.merchandiserName}
            onChange={(v) => set('merchandiserName', v)}
          />
          <Field
            label="Merchandise E-Mail I'd"
            value={draft.merchandiserEmail}
            onChange={(v) => set('merchandiserEmail', v)}
          />
        </CardContent>
      </Card>

      {/* ── Section 03 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Package, stage, finish &amp; service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Packages</Label>
            <TickRow
              options={options?.packageTypes ?? []}
              value={draft.packageType}
              onChange={(c) => set('packageType', c as BuyerTrf['packageType'])}
            />
            {draft.packageType === 'RETEST' && (
              <Input
                className="max-w-xs"
                placeholder="Previous report no."
                value={draft.previousReportNo ?? ''}
                onChange={(e) => set('previousReportNo', e.target.value)}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sample testing stage</Label>
            <TickRow
              options={options?.sampleStages ?? []}
              value={draft.sampleStage}
              onChange={(c) => set('sampleStage', c as BuyerTrf['sampleStage'])}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Finish type</Label>
            <TickRow
              options={options?.finishTypes ?? []}
              value={draft.finishType}
              onChange={(c) => set('finishType', c as BuyerTrf['finishType'])}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Service required</Label>
            <TickRow
              options={options?.serviceLevels ?? []}
              value={draft.serviceRequired}
              onChange={(c) => set('serviceRequired', c as BuyerTrf['serviceRequired'])}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Section 04 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Buying department</CardTitle>
          <CardDescription>
            The sub-options belong to the department — that is why &ldquo;Denim&rdquo; appears under both Men&rsquo;s
            and Women&rsquo;s on the buyer&rsquo;s sheet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <TickRow
            options={options?.buyingDepartments ?? []}
            value={draft.buyingDepartment}
            onChange={(c) => {
              set('buyingDepartment', c);
              set('buyingSubCategories', []); // the old sub-ticks belong to another department
            }}
          />
          {subCategoriesForDepartment.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t pt-3">
              {subCategoriesForDepartment.map((s) => (
                <label key={s.code} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={(draft.buyingSubCategories ?? []).includes(s.code)}
                    onCheckedChange={() => toggleInArray('buyingSubCategories', s.code)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 05 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Individual tests</CardTitle>
          <CardDescription>
            Only needed on top of the package — leave all unticked when the package covers it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-1 md:grid-cols-3">
            {([1, 2, 3] as const).map((col) => (
              <div key={col} className="space-y-1">
                {(options?.tests ?? [])
                  .filter((t) => t.column === col)
                  .map((t) => (
                    <label key={t.code} className="flex cursor-pointer items-start gap-2 text-sm">
                      <Checkbox
                        className="mt-0.5"
                        checked={(draft.selectedTests ?? []).includes(t.code)}
                        onCheckedChange={() => toggleInArray('selectedTests', t.code)}
                      />
                      {t.label}
                    </label>
                  ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 06 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Declarations</CardTitle>
          <CardDescription>Leave both boxes clear to print an empty pair for someone to tick by hand.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <YesNo
            label="Contrast/Trim Fabric is used within Garment"
            value={draft.contrastTrimUsed}
            onChange={(v) => set('contrastTrimUsed', v)}
          />
          <YesNo
            label="Style With Sets Packing Together with Different Color"
            value={draft.setsPackingDifferentColour}
            onChange={(v) => set('setsPackingDifferentColour', v)}
          />
          <YesNo
            label="Report Delivery Service"
            value={draft.reportDeliveryService}
            onChange={(v) => set('reportDeliveryService', v)}
          />
          <YesNo
            label="Return Remained Sample"
            value={draft.returnRemainedSample}
            onChange={(v) => set('returnRemainedSample', v)}
          />
          <div className="pt-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Remarks</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={draft.remarks ?? ''}
              onChange={(e) => set('remarks', e.target.value)}
              placeholder="e.g. PP sample, 2 pcs"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
