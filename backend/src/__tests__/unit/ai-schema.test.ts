/**
 * AI schema tests — the session trail must survive validateBody (Zod strips unknown keys)
 * and the issue-report multipart string form must parse without ever producing a 400.
 */

import { chatPersistentSchema } from '../../schemas/ai.schema';
import { createIssueReportSchema } from '../../schemas/issueReport.schema';

const trailError = { at: '2026-09-12T10:00:00.000Z', method: 'POST', url: '/grn', status: 400, message: 'Invalid' };

describe('chatPersistentSchema.context', () => {
  it('accepts a session trail', () => {
    const parsed = chatPersistentSchema.parse({
      message: 'why did this fail',
      context: {
        pageRoute: '/grn/new',
        recentErrors: [trailError],
        recentPages: [{ at: '2026-09-12T09:59:00.000Z', path: '/grn/new' }],
      },
    });
    expect(parsed.context?.pageRoute).toBe('/grn/new');
    expect(parsed.context?.recentErrors?.[0].status).toBe(400);
  });

  it('still accepts a message with no context', () => {
    expect(chatPersistentSchema.parse({ message: 'hi' }).context).toBeUndefined();
  });

  it('rejects more than 10 errors', () => {
    const result = chatPersistentSchema.safeParse({
      message: 'hi',
      context: { recentErrors: Array.from({ length: 11 }, () => trailError) },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an over-long error message', () => {
    const result = chatPersistentSchema.safeParse({
      message: 'hi',
      context: { recentErrors: [{ ...trailError, message: 'x'.repeat(201) }] },
    });
    expect(result.success).toBe(false);
  });

  it('strips unknown keys so request bodies can never ride along', () => {
    const parsed = chatPersistentSchema.parse({
      message: 'hi',
      context: { pageRoute: '/grn/new', requestBody: { secret: 1 } },
    });
    expect((parsed.context as Record<string, unknown>).requestBody).toBeUndefined();
  });
});

describe('createIssueReportSchema.contextJson', () => {
  it('parses the stringified trail that multipart forms send', () => {
    const parsed = createIssueReportSchema.parse({
      title: 'Save fails',
      contextJson: JSON.stringify({ pageRoute: '/grn/new', recentErrors: [trailError] }),
    });
    expect(parsed.contextJson?.pageRoute).toBe('/grn/new');
    expect(parsed.contextJson?.recentErrors?.[0].url).toBe('/grn');
  });

  it('drops malformed JSON instead of rejecting the report', () => {
    const parsed = createIssueReportSchema.parse({ title: 'Save fails', contextJson: '{not json' });
    expect(parsed.contextJson).toBeUndefined();
  });

  it('is optional', () => {
    expect(createIssueReportSchema.parse({ title: 'Save fails' }).contextJson).toBeUndefined();
  });
});
