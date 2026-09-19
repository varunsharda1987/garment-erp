import { Prisma, SampleStatus, SampleType } from '@prisma/client';
import { BusinessError } from '../../errors';
import { resolveAdminOverride, AdminOverrideBody, ResolvedAdminOverride } from '../../utils/admin-override';
import { productionBlockingValidationService } from '../productionBlockingValidation.service';

/**
 * A sample's VERDICT — approved, approved with comments, rejected, revision needed — is the buyer's
 * answer, so it can only be recorded once the sample has gone to the buyer (SENT) or come back
 * from them (FEEDBACK_PENDING). The screen has always enforced this (Record Feedback appears only
 * in those two states); until 2026-09-18 the API did not, so anyone with sample write access could
 * mark a freshly REQUESTED sample APPROVED and unlock cutting (order-system plan T4-C; the first
 * end-to-end walk did exactly that). Three write paths share this gate: PATCH /:id/status,
 * PUT /:id (with a status) and POST /:id/feedback. An ADMIN may override with a written reason,
 * logged to stage_transition_overrides as SAMPLE_STATUS.
 */
export const SAMPLE_VERDICT_STATUSES: SampleStatus[] = [
  'APPROVED',
  'APPROVED_WITH_COMMENTS',
  'REJECTED',
  'REVISION_NEEDED',
];
export const SAMPLE_VERDICT_FROM: SampleStatus[] = ['SENT', 'FEEDBACK_PENDING'];

interface GateInput {
  existing: { id: string; sampleNumber: string; status: SampleStatus; sampleType: SampleType };
  newStatus: SampleStatus;
  user: { role?: string } | undefined;
  body: AdminOverrideBody;
}

/**
 * Throws (422) when `newStatus` is a verdict the sample is not ready for. Returns the resolved
 * override so the caller can log it on the same transaction as the write — an override that
 * was needed is the only case that returns `adminOverride: true`.
 */
export function gateSampleVerdict({ existing, newStatus, user, body }: GateInput): ResolvedAdminOverride {
  const isVerdict = SAMPLE_VERDICT_STATUSES.includes(newStatus);
  const noTransition = newStatus === existing.status;
  if (!isVerdict || noTransition || SAMPLE_VERDICT_FROM.includes(existing.status)) {
    return { adminOverride: false };
  }
  // Role + reason are checked here (403 / 400) before the 422, so an admin's malformed override
  // is told what is wrong with the override rather than with the sample.
  const override = resolveAdminOverride(user, body);
  if (override.adminOverride) {
    return override;
  }
  throw new BusinessError(
    `Sample ${existing.sampleNumber} is ${existing.status} — mark it Sent and record the buyer's feedback before it can be ${newStatus.replace(/_/g, ' ').toLowerCase()}.`
  );
}

/** Audit row for a verdict recorded out of sequence; a no-op when no override was used. */
export async function logSampleVerdictOverride(
  tx: Prisma.TransactionClient,
  existing: GateInput['existing'],
  newStatus: SampleStatus,
  override: ResolvedAdminOverride,
  userId: string
): Promise<void> {
  if (!override.adminOverride) return;
  await productionBlockingValidationService.logOverride(
    {
      blockType: 'SAMPLE_STATUS',
      sampleId: existing.id,
      blockedSampleType: existing.sampleType,
      overrideReason: `${newStatus} from ${existing.status}: ${override.overrideReason ?? '(no reason given)'}`,
      overriddenById: userId,
    },
    tx
  );
}
