/**
 * Record (or correct) a lab result — a garment test (GPT) on a sample's lab round, or a fabric test
 * (FPT) on the Fabric Physical Tests page.
 *
 * The owner's process (2026-09-23): the GPT is done on the PP sample BEFORE it is sent, so it is
 * recorded from the sample's Lab Tests tab against that round's test requirement form (TRF) — no work
 * order. The FPT is done on the fabric lot after it is inwarded, so it lives on the Fabric Physical
 * Tests page; a retest there may name the new round's TRF.
 *
 * Which call this dialog makes is decided in exactly one place, `saveResult()` below:
 *   - an existing test is being corrected           → PUT
 *   - the earlier result of this kind failed        → POST /retest (keeps the retest chain, so the
 *     earlier failure stops counting as unresolved on the Manufacturing Control Center)
 *   - otherwise, a first result on a lab round       → POST
 * Each is ONE request that writes the result with the row — no half-saved PENDING test, which would
 * block cutting for the style (Easybuy has "FPT blocks production" on). One result of each kind per
 * TRF: the API refuses a second with a 409.
 *
 * Blank inputs are omitted on create and sent as null on edit — never '' (the API's numeric and URL
 * fields refuse an empty string).
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, FlaskConical, Loader2 } from 'lucide-react';
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
import { fabricPhysicalTestsService, garmentPhysicalTestsService } from '@/services/testing.service';
import { buyerTrfService } from '@/services/buyerTrf.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { toDateInputValue } from '@/lib/date';
import type { BuyerTrf, LabRoundTest } from '@/types/buyerTrf.types';
import type {
  TestResult,
  UpdateFabricPhysicalTestInput,
  UpdateGarmentPhysicalTestInput,
  CreateFabricPhysicalTestInput,
} from '@/types/testing.types';

export type LabTestKind = 'fabric' | 'garment';

/** The fields of an earlier test a retest needs. */
export type PreviousLabTest = Pick<
  LabRoundTest,
  'id' | 'testNumber' | 'testReportNumber' | 'overallTestResult' | 'adminOverride' | 'failureReason'
>;

/** A recorded result is never PENDING — the lab has answered. */
const RESULT_OPTIONS: { value: TestResult; label: string }[] = [
  { value: 'PASS', label: 'Pass' },
  { value: 'CONDITIONAL_PASS', label: 'Conditional pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'RETEST_REQUIRED', label: 'Retest required' },
];
const FAILING: TestResult[] = ['FAIL', 'RETEST_REQUIRED'];

/** "No form" in the round picker — Radix Select cannot hold an empty-string value. */
const NO_ROUND = '__none__';

type ReadingField = { key: string; label: string; numeric: boolean };

const READINGS: Record<LabTestKind, ReadingField[]> = {
  fabric: [
    { key: 'testedGSM', label: 'GSM', numeric: true },
    { key: 'testedConstruction', label: 'Construction', numeric: false },
    { key: 'testedCount', label: 'Count', numeric: false },
    { key: 'shrinkageLength', label: 'Shrinkage length %', numeric: true },
    { key: 'shrinkageWidth', label: 'Shrinkage width %', numeric: true },
    { key: 'colorFastness', label: 'Colour fastness', numeric: false },
    { key: 'pilling', label: 'Pilling', numeric: false },
    { key: 'spirality', label: 'Spirality %', numeric: true },
  ],
  garment: [
    { key: 'lengthShrinkage', label: 'Shrinkage length %', numeric: true },
    { key: 'widthShrinkage', label: 'Shrinkage width %', numeric: true },
    { key: 'seamStrength', label: 'Seam strength', numeric: true },
    { key: 'colorFastnessWash', label: 'Colour fastness — wash', numeric: false },
    { key: 'colorFastnessRub', label: 'Colour fastness — rub', numeric: false },
    { key: 'colorFastnessLight', label: 'Colour fastness — light', numeric: false },
    { key: 'pilling', label: 'Pilling', numeric: false },
    { key: 'spirality', label: 'Spirality %', numeric: true },
    { key: 'apparenceAfterWash', label: 'Appearance after wash', numeric: false },
  ],
};

interface LabResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LabTestKind;
  /** The test being corrected (edit). */
  existingTestId?: string | null;
  /** This kind's earlier result; a failed one makes this save a retest of it. */
  previousTest?: PreviousLabTest | null;
  /** The lab round a new result is recorded against (the sample's Lab Tests tab always has one). */
  round?: Pick<BuyerTrf, 'id' | 'trfNumber' | 'styleId' | 'customerId'> | null;
  /** The test's style, so a retest without a round can pick the new round's form. */
  styleId?: string | null;
  onSaved: () => void;
}

type FormState = {
  testReportNumber: string;
  testResultReceivedDate: string;
  overallTestResult: TestResult | '';
  failureReason: string;
  testReportUrl: string;
  remarks: string;
  retestReason: string;
  roundId: string;
  readings: Record<string, string>;
};

const emptyForm = (): FormState => ({
  testReportNumber: '',
  testResultReceivedDate: toDateInputValue(new Date()),
  overallTestResult: '',
  failureReason: '',
  testReportUrl: '',
  remarks: '',
  retestReason: '',
  roundId: NO_ROUND,
  readings: {},
});

/** The form for a stored test row (edit mode). */
function formFromRow(row: Record<string, unknown>, kind: LabTestKind): FormState {
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  const form = emptyForm();
  form.testReportNumber = str(row.testReportNumber);
  form.testResultReceivedDate = row.testResultReceivedDate
    ? toDateInputValue(row.testResultReceivedDate as string)
    : '';
  form.overallTestResult = row.overallTestResult === 'PENDING' ? '' : (row.overallTestResult as TestResult);
  form.failureReason = str(row.failureReason);
  form.testReportUrl = str(row.testReportUrl);
  form.remarks = str(row.remarks);
  for (const f of READINGS[kind]) form.readings[f.key] = str(row[f.key]);
  return form;
}

export function LabResultDialog({
  open,
  onOpenChange,
  kind,
  existingTestId,
  previousTest,
  round,
  styleId,
  onSaved,
}: LabResultDialogProps) {
  const mode: 'edit' | 'retest' | 'create' = existingTestId
    ? 'edit'
    : previousTest && FAILING.includes(previousTest.overallTestResult) && !previousTest.adminOverride
      ? 'retest'
      : 'create';
  const kindLabel = kind === 'fabric' ? 'fabric' : 'garment';

  // The caller mounts this dialog fresh each time it opens, so the starting form is set once, here.
  const [form, setForm] = useState<FormState>(() => {
    const start = emptyForm();
    if (mode === 'retest' && previousTest) {
      start.retestReason = previousTest.failureReason ?? `${previousTest.testNumber} did not pass`;
    }
    return start;
  });
  const [showReadings, setShowReadings] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit needs the full row (readings are not in the round summary).
  const { data: fullExisting, isLoading: loadingExisting } = useQuery({
    queryKey: [kind === 'fabric' ? 'fabric-physical-test' : 'garment-physical-test', existingTestId],
    queryFn: async (): Promise<Record<string, unknown>> => {
      const res =
        kind === 'fabric'
          ? await fabricPhysicalTestsService.getById(existingTestId!)
          : await garmentPhysicalTestsService.getById(existingTestId!);
      return res.data as unknown as Record<string, unknown>;
    },
    enabled: open && !!existingTestId,
  });

  // A retest with no round given (the Fabric Physical Tests page): offer this style's forms that do not
  // yet carry a result of this kind — a second test goes on a second form.
  const pickRound = mode === 'retest' && !round && !!styleId;
  const { data: roundPage } = useQuery({
    queryKey: ['buyer-trfs', { styleId, purpose: `${kind}-retest-round` }],
    queryFn: () => buyerTrfService.getAll({ styleId: styleId!, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: open && pickRound,
  });
  const roundChoices = (roundPage?.data ?? []).filter((t) => !(kind === 'fabric' ? t.fabricTest : t.garmentTest));

  // Edit mode: fill the form once the stored row arrives. Adjusting state while rendering, guarded
  // so it happens once per row (React's pattern for this, rather than an effect).
  const [hydratedFrom, setHydratedFrom] = useState<Record<string, unknown> | null>(null);
  if (fullExisting && hydratedFrom !== fullExisting) {
    setHydratedFrom(fullExisting);
    setForm(formFromRow(fullExisting, kind));
  }

  const readingError = useMemo(() => {
    for (const f of READINGS[kind]) {
      const raw = form.readings[f.key]?.trim();
      if (f.numeric && raw && Number.isNaN(Number(raw))) return `${f.label} must be a number`;
    }
    return null;
  }, [form.readings, kind]);

  const isFailing = form.overallTestResult !== '' && FAILING.includes(form.overallTestResult);
  const canSave =
    !saving &&
    !loadingExisting &&
    form.overallTestResult !== '' &&
    !readingError &&
    (mode !== 'retest' || form.retestReason.trim() !== '') &&
    (mode !== 'create' || !!round);

  /** '' → omitted on create/retest, null on edit. */
  const buildResultPayload = (): Record<string, unknown> => {
    const blank = mode === 'edit' ? null : undefined;
    const text = (v: string) => (v.trim() === '' ? blank : v.trim());
    const out: Record<string, unknown> = {
      testReportNumber: text(form.testReportNumber),
      testResultReceivedDate: form.testResultReceivedDate || blank,
      overallTestResult: form.overallTestResult,
      failureReason: isFailing ? text(form.failureReason) : blank,
      testReportUrl: text(form.testReportUrl),
      remarks: text(form.remarks),
    };
    for (const f of READINGS[kind]) {
      const raw = (form.readings[f.key] ?? '').trim();
      out[f.key] = raw === '' ? blank : f.numeric ? Number(raw) : raw;
    }
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
  };

  const saveResult = async () => {
    const results = buildResultPayload();
    if (mode === 'edit') {
      return kind === 'fabric'
        ? fabricPhysicalTestsService.update(existingTestId!, results as UpdateFabricPhysicalTestInput)
        : garmentPhysicalTestsService.update(existingTestId!, results as UpdateGarmentPhysicalTestInput);
    }
    if (mode === 'retest') {
      const trfId = round?.id ?? (form.roundId !== NO_ROUND ? form.roundId : undefined);
      const retest = {
        originalTestId: previousTest!.id,
        retestReason: form.retestReason.trim(),
        ...(trfId ? { trfId } : {}),
        ...results,
      };
      return kind === 'fabric'
        ? fabricPhysicalTestsService.createRetest(retest)
        : garmentPhysicalTestsService.createRetest(retest);
    }
    // A first result on a lab round. A sample's garment test has no work order: it hangs off the round.
    if (kind === 'fabric') {
      return fabricPhysicalTestsService.create({ trfId: round!.id, ...results } as CreateFabricPhysicalTestInput);
    }
    return garmentPhysicalTestsService.create({
      trfId: round!.id,
      styleId: round!.styleId,
      customerId: round!.customerId,
      ...results,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveResult();
      handleApiSuccess('Lab result saved', `${round ? `${round.trfNumber}: ` : ''}${kindLabel} result recorded.`);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      handleApiError(err, 'Could not save the lab result');
    } finally {
      setSaving(false);
    }
  };

  const setReading = (key: string, value: string) =>
    setForm((f) => ({ ...f, readings: { ...f.readings, [key]: value } }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            {mode === 'edit' ? 'Edit' : 'Record'} {kindLabel} result{round ? ` — ${round.trfNumber}` : ''}
          </DialogTitle>
          <DialogDescription>
            {mode === 'retest'
              ? `This is a retest of ${previousTest?.testNumber}${previousTest?.testReportNumber ? ` (report ${previousTest.testReportNumber})` : ''}.`
              : 'What the lab reported.'}
          </DialogDescription>
        </DialogHeader>

        {loadingExisting ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {pickRound && (
              <div className="space-y-2">
                <Label>Test requirement form for this retest</Label>
                <Select value={form.roundId} onValueChange={(v) => setForm({ ...form, roundId: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ROUND}>No form (tested in-house)</SelectItem>
                    {roundChoices.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.trfNumber}
                        {t.packageType === 'RETEST' ? ' — Retest' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A second test goes on a second form. Only forms for this style without a {kindLabel} result are
                  listed.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lab report no.</Label>
                <Input
                  value={form.testReportNumber}
                  onChange={(e) => setForm({ ...form, testReportNumber: e.target.value })}
                  placeholder="As printed on the lab's report"
                />
              </div>
              <div className="space-y-2">
                <Label>Result received on</Label>
                <Input
                  type="date"
                  value={form.testResultReceivedDate}
                  onChange={(e) => setForm({ ...form, testResultReceivedDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Result</Label>
              <Select
                value={form.overallTestResult}
                onValueChange={(v) => setForm({ ...form, overallTestResult: v as TestResult })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pass, fail…" />
                </SelectTrigger>
                <SelectContent>
                  {RESULT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {kind === 'fabric' && isFailing && (
                <p className="text-xs text-amber-700">
                  A failed fabric result blocks cutting for this style until a retest passes (when the buyer has
                  &ldquo;fabric test blocks production&rdquo; turned on).
                </p>
              )}
            </div>

            {isFailing && (
              <div className="space-y-2">
                <Label>Why it failed</Label>
                <Textarea
                  rows={2}
                  value={form.failureReason}
                  onChange={(e) => setForm({ ...form, failureReason: e.target.value })}
                  placeholder="e.g. pH out of range, colour fastness to washing grade 2"
                />
              </div>
            )}

            {mode === 'retest' && (
              <div className="space-y-2">
                <Label>Retest reason</Label>
                <Textarea
                  rows={2}
                  value={form.retestReason}
                  onChange={(e) => setForm({ ...form, retestReason: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Report link</Label>
              <Input
                value={form.testReportUrl}
                onChange={(e) => setForm({ ...form, testReportUrl: e.target.value })}
                placeholder="https://… (the lab's PDF or portal link)"
              />
            </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </div>

            <div className="border-t pt-3">
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setShowReadings((v) => !v)}
              >
                {showReadings ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Detailed readings (optional)
              </button>
              {showReadings && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {READINGS[kind].map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs">{f.label}</Label>
                      <Input
                        inputMode={f.numeric ? 'decimal' : undefined}
                        value={form.readings[f.key] ?? ''}
                        onChange={(e) => setReading(f.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
              {readingError && <p className="mt-2 text-xs text-destructive">{readingError}</p>}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={!canSave}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save result
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
