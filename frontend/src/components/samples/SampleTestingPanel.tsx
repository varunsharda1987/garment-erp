/**
 * A sample's lab rounds — the Sample Tracker ↔ testing link (2026-09-23).
 *
 * One round = one Test Requirement Form (TRF), the sheet that travels to the lab with the sample.
 * The sample's test is the GARMENT test (GPT): the owner's process runs it on the PP sample before it
 * is sent, so it hangs off the round with no work order. A retest is a new round. The FABRIC test
 * (FPT) is done on the fabric lot after inward — it is recorded on the Fabric Physical Tests page and
 * only shown here, read-only, because a failed one blocks cutting for the style. Everything writes
 * through the existing testing endpoints (gated by the `testing` permission) — nothing
 * testing-related lives under /samples.
 *
 * Reads TRFs by STYLE, not by sample, so a TRF raised from the Testing menu for this style and buyer
 * shows up under "Not linked to a sample yet" with a Link button — that is how a form created before
 * this link existed (TRF-0001) gets attached.
 *
 * The round verdict (`labResult`) comes from the API (backend lab-round.helper.ts); it is never
 * re-derived here, so this panel, the approve warning and the Shipment Sample dispatch gate agree.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FlaskConical, Link2, Loader2, Pencil, Plus, Printer, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buyerTrfService } from '@/services/buyerTrf.service';
import { fabricPhysicalTestsService } from '@/services/testing.service';
import { openPDF } from '@/lib/document-utils';
import { formatDate } from '@/lib/date';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { usePermissions } from '@/hooks/usePermissions';
import type { BuyerTrf, LabRoundResult, LabRoundTest, TrfStatus } from '@/types/buyerTrf.types';
import type { Sample } from '@/types/sample.types';
import { LabResultDialog } from './LabResultDialog';

const TRF_STATUS_LABEL: Record<TrfStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  SENT_TO_LAB: 'Sent to lab',
  CLOSED: 'Closed',
};

const ROUND_BADGE: Record<LabRoundResult, { label: string; className: string }> = {
  PASS: { label: 'Passed', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  FAIL: { label: 'Failed', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
  NO_RESULT: { label: 'Awaiting result', className: 'bg-muted text-muted-foreground hover:bg-muted' },
};

const TEST_RESULT_LABEL: Record<LabRoundTest['overallTestResult'], string> = {
  PENDING: 'Pending',
  PASS: 'Pass',
  CONDITIONAL_PASS: 'Conditional pass',
  FAIL: 'Fail',
  RETEST_REQUIRED: 'Retest required',
};

/** Under the 'buyer-trfs' prefix, which the TRF form already invalidates after a save. */
const sampleLabRoundsKey = (styleId: string | null | undefined) => ['buyer-trfs', { styleId, purpose: 'sample-lab' }];

interface SampleTestingPanelProps {
  sample: Pick<Sample, 'id' | 'sampleNumber' | 'sampleType' | 'styleId' | 'customerId'>;
  onChanged?: () => void;
}

export function SampleTestingPanel({ sample, onChanged }: SampleTestingPanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canWrite = can('testing');

  const [dialog, setDialog] = useState<{ round: BuyerTrf; previous: LabRoundTest | null } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: sampleLabRoundsKey(sample.styleId),
    queryFn: () =>
      buyerTrfService.getAll({ styleId: sample.styleId!, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: !!sample.styleId,
  });

  // The style's latest fabric test (done on the inwarded lot) — context only, recorded elsewhere.
  const { data: fabricPage } = useQuery({
    queryKey: ['fabric-physical-tests', { styleId: sample.styleId, limit: 1 }],
    queryFn: () => fabricPhysicalTestsService.getAll({ styleId: sample.styleId!, limit: 1 }),
    enabled: !!sample.styleId,
  });
  const latestFabricTest = fabricPage?.data?.[0];

  const { rounds, unlinked } = useMemo(() => {
    const all = data?.data ?? [];
    return {
      rounds: all.filter((t) => t.sampleId === sample.id), // newest first
      unlinked: all.filter((t) => !t.sampleId && t.customerId === sample.customerId),
    };
  }, [data, sample.id, sample.customerId]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['buyer-trfs'] });
    onChanged?.();
  };

  const returnTo = encodeURIComponent(`/samples/${sample.id}?tab=lab`);
  const latest = rounds[0];

  const updateTrf = async (trf: BuyerTrf, patch: Parameters<typeof buyerTrfService.update>[1], done: string) => {
    setBusyId(trf.id);
    try {
      await buyerTrfService.update(trf.id, patch);
      handleApiSuccess(done);
      refresh();
    } catch (err) {
      handleApiError(err, 'Could not update the form');
    } finally {
      setBusyId(null);
    }
  };

  const print = async (trf: BuyerTrf) => {
    try {
      await openPDF(`/documents/buyer-trfs/${trf.id}/pdf`);
    } catch (err) {
      handleApiError(err, 'Could not open the form');
    }
  };

  if (!sample.styleId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Link a style to this sample first — a test requirement form is always for a style.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-lg">Lab Tests</CardTitle>
            <CardDescription>
              One test requirement form per lab round. A retest is a new round with its own form.
            </CardDescription>
          </div>
          {canWrite && rounds.length === 0 && (
            <Button
              size="sm"
              onClick={() => navigate(`/test-requirement-forms/new?sampleId=${sample.id}&returnTo=${returnTo}`)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Send for lab testing
            </Button>
          )}
          {canWrite && latest?.labResult === 'FAIL' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigate(`/test-requirement-forms/new?sampleId=${sample.id}&retestOf=${latest.id}&returnTo=${returnTo}`)
              }
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Start retest round
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rounds.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">This sample has not been sent to a lab yet.</p>
          ) : (
            rounds.map((round, index) => {
              const older = rounds[index + 1];
              const roundNo = rounds.length - index;
              const badge = ROUND_BADGE[round.labResult ?? 'NO_RESULT'];
              return (
                <div key={round.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Round {roundNo}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-medium">{round.trfNumber}</span>
                      <Badge variant="outline">{round.packageType === 'RETEST' ? 'Retest' : round.sampleStage}</Badge>
                      {round.previousReportNo && (
                        <span className="text-xs text-muted-foreground">of report {round.previousReportNo}</span>
                      )}
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canWrite ? (
                        <Select
                          value={round.status}
                          onValueChange={(v) =>
                            void updateTrf(
                              round,
                              { status: v as TrfStatus },
                              `${round.trfNumber} marked ${TRF_STATUS_LABEL[v as TrfStatus].toLowerCase()}`
                            )
                          }
                          disabled={busyId === round.id}
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(TRF_STATUS_LABEL) as TrfStatus[]).map((s) => (
                              <SelectItem key={s} value={s}>
                                {TRF_STATUS_LABEL[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{TRF_STATUS_LABEL[round.status]}</Badge>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => void print(round)}>
                        <Printer className="mr-1 h-4 w-4" />
                        Print
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/test-requirement-forms/${round.id}?returnTo=${returnTo}`)}
                      >
                        <Pencil className="mr-1 h-4 w-4" />
                        {canWrite ? 'Edit form' : 'View form'}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {round.testingLab?.labName ?? 'No lab chosen'} · Form dated {formatDate(round.trfDate)}
                    {round.saleOrder ? ` · ${round.saleOrder.saleOrderNumber}` : ''}
                  </p>

                  <div className="divide-y rounded-md border">
                    <ResultRow
                      label="Garment"
                      test={round.garmentTest ?? null}
                      canWrite={canWrite}
                      onRecord={() => setDialog({ round, previous: older?.garmentTest ?? null })}
                    />
                    {/* A fabric result linked to this form (possible through the API) is shown, not edited:
                        fabric tests are recorded on the Fabric Physical Tests page. */}
                    {round.fabricTest && <ResultRow label="Fabric" test={round.fabricTest} canWrite={false} />}
                  </div>
                </div>
              );
            })
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              Fabric test (done on the fabric lot after inward):{' '}
              {latestFabricTest ? (
                <span className="text-foreground">
                  {latestFabricTest.testNumber} — {TEST_RESULT_LABEL[latestFabricTest.overallTestResult]}
                  {latestFabricTest.testReportNumber ? `, report ${latestFabricTest.testReportNumber}` : ''}
                </span>
              ) : (
                'none recorded for this style'
              )}
              . A failed fabric test blocks cutting.
            </span>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/fabric-physical-tests')}>
              Fabric Physical Tests
            </Button>
          </div>

          {unlinked.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Not linked to a sample yet</p>
              <p className="text-xs text-muted-foreground">
                Test requirement forms for this style and buyer that were raised without a sample.
              </p>
              {unlinked.map((trf) => (
                <div key={trf.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{trf.trfNumber}</span>
                    <Badge variant="outline">{trf.sampleStage}</Badge>
                    <span className="text-muted-foreground">
                      {TRF_STATUS_LABEL[trf.status]} · {formatDate(trf.trfDate)}
                    </span>
                  </div>
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === trf.id}
                      onClick={() =>
                        void updateTrf(
                          trf,
                          { sampleId: sample.id },
                          `${trf.trfNumber} linked to ${sample.sampleNumber}`
                        )
                      }
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Link to this sample
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {dialog && (
        <LabResultDialog
          open={!!dialog}
          onOpenChange={(open) => !open && setDialog(null)}
          kind="garment"
          round={dialog.round}
          existingTestId={dialog.round.garmentTest?.id ?? null}
          previousTest={dialog.previous}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function ResultRow({
  label,
  test,
  canWrite,
  onRecord,
}: {
  label: string;
  test: LabRoundTest | null;
  canWrite: boolean;
  onRecord?: () => void;
}) {
  const failing = test && ['FAIL', 'RETEST_REQUIRED'].includes(test.overallTestResult) && !test.adminOverride;
  const passing = test && (['PASS', 'CONDITIONAL_PASS'].includes(test.overallTestResult) || test.adminOverride);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
        <span className="w-16 font-medium">{label}</span>
        {test ? (
          <>
            <Badge
              className={
                failing
                  ? 'bg-red-100 text-red-800 hover:bg-red-100'
                  : passing
                    ? 'bg-green-100 text-green-800 hover:bg-green-100'
                    : 'bg-muted text-muted-foreground hover:bg-muted'
              }
            >
              {test.adminOverride ? 'Overridden' : TEST_RESULT_LABEL[test.overallTestResult]}
            </Badge>
            <span className="text-muted-foreground">
              {test.testNumber}
              {test.testReportNumber ? ` · report ${test.testReportNumber}` : ''}
              {test.testResultReceivedDate ? ` · ${formatDate(test.testResultReceivedDate)}` : ''}
            </span>
            {failing && test.failureReason && <span className="text-red-700">— {test.failureReason}</span>}
            {test.testReportUrl && (
              <a
                href={test.testReportUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                report <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">Not recorded</span>
        )}
      </div>
      {canWrite && onRecord && (
        <Button size="sm" variant="outline" onClick={onRecord}>
          {test ? 'Edit result' : 'Record result'}
        </Button>
      )}
    </div>
  );
}
