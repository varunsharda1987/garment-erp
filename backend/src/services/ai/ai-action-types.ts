/**
 * AI Action types + shared helpers.
 *
 * Split from ai-actions.service.ts so action definitions can live in their own files
 * without an import cycle (the service imports the definition arrays, the definitions
 * import only these types and helpers).
 */

import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { logError } from '../../utils/logger';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type Payload = Record<string, unknown>;

/** A resolution/preparation step either produces a payload, or a question to ask back. */
export type StepResult = { ok: true; payload: Payload; displayLines: string[] } | { ok: false; question: string };

export interface ActionContext {
  authHeader: string;
  userRole: UserRole;
}

export interface ActionDefinition {
  actionType: string;
  actionEntity: string;
  /** Shown on the confirmation card and in the generated prompt. */
  label: string;
  method: 'POST';
  /** Static path, or built from the resolved payload (e.g. /api/orders/:id/work-orders). */
  path: string | ((payload: Payload) => string);
  allowedRoles: UserRole[];
  /** What the MODEL fills in — human-facing names. */
  toolSchema: z.ZodTypeAny;
  /** What the ENDPOINT receives — resolved ids. Re-validated at confirm. */
  executionSchema: z.ZodTypeAny;
  tool: ToolDefinition;
  /** Turn names into ids and build the display lines shown on the card. */
  resolve?: (payload: Payload, ctx: ActionContext) => Promise<StepResult>;
  /** Fetch anything else the endpoint needs (next code, pending lines…). */
  prepare?: (payload: Payload, ctx: ActionContext) => Promise<StepResult>;
  successMessage: (data: Record<string, unknown>) => string;
}

/**
 * Backend-resolved display strings ride inside actionPayload under this exact key.
 * The response serializer camelizes every key of a Json column, so an underscore-prefixed
 * key would arrive as `display` and an object value would render as "[object Object]".
 * An array of preformatted strings under an already-camelCase key survives untouched.
 */
export const DISPLAY_KEY = 'displayLines';

/** Internal HTTP calls must not hang: the chat request would block until the 120s timeout. */
const INTERNAL_TIMEOUT_MS = 10_000;

/**
 * Call one of this API's own endpoints with the caller's JWT, so every existing
 * validation, permission check, code generator and transaction is reused.
 */
export async function internalFetch(
  path: string,
  init: RequestInit,
  authHeader: string
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const port = process.env.PORT || 5000;
  const response = await fetch(`http://localhost:${port}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(INTERNAL_TIMEOUT_MS),
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, body };
}

interface ResolveEntityOptions {
  listPath: string; // e.g. '/api/customers'
  search: string; // what the user said
  entityLabel: string; // 'Customer' — used in questions and display lines
  codeField?: string; // 'code' | 'styleCode' | 'orderNumber'
  nameFields?: string[]; // fields tried for an exact name match / display
}

export interface ResolvedEntity {
  id: string;
  code: string | null;
  name: string;
  display: string;
}

/**
 * Resolve a user-spoken name to exactly one record, or produce a question to ask back.
 * Only ACTIVE records are considered — otherwise chat could quietly attach a new document
 * to a deactivated customer or supplier, which the UI would never allow.
 */
export async function resolveEntity(
  ctx: ActionContext,
  opts: ResolveEntityOptions
): Promise<{ ok: true; entity: ResolvedEntity } | { ok: false; question: string }> {
  const { listPath, search, entityLabel, codeField = 'code', nameFields = ['name'] } = opts;
  const lowerLabel = entityLabel.toLowerCase();

  let rows: Array<Record<string, unknown>> = [];
  try {
    const { ok, body } = await internalFetch(
      `${listPath}?search=${encodeURIComponent(search)}&limit=10`,
      { method: 'GET' },
      ctx.authHeader
    );
    if (!ok) {
      return { ok: false, question: `I could not look up the ${lowerLabel} "${search}" just now. Please try again.` };
    }
    const data = body.data;
    rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
  } catch (error) {
    logError(`[AIActions] resolveEntity(${entityLabel}) failed:`, error);
    return { ok: false, question: `The ${lowerLabel} lookup timed out. Please try again.` };
  }

  const active = rows.filter((row) => row.isActive !== false);

  const toEntity = (row: Record<string, unknown>): ResolvedEntity => {
    const code = (row[codeField] as string) || null;
    const name = nameFields.map((field) => row[field]).find((value) => typeof value === 'string' && value) as
      | string
      | undefined;
    const label = name || code || 'record';
    return {
      id: row.id as string,
      code,
      name: label,
      display: code ? `${label} (${code})` : label,
    };
  };

  if (active.length === 0) {
    return {
      ok: false,
      question: `I could not find a ${lowerLabel} matching "${search}". Please check the name, or create it first.`,
    };
  }

  const needle = search.trim().toLowerCase();

  // Exact code match wins — this is how a user answers a disambiguation question
  const byCode = active.find((row) => String(row[codeField] || '').toLowerCase() === needle);
  if (byCode) return { ok: true, entity: toEntity(byCode) };

  const byName = active.filter((row) => nameFields.some((f) => String(row[f] || '').toLowerCase() === needle));
  if (byName.length === 1) return { ok: true, entity: toEntity(byName[0]) };

  if (active.length === 1) return { ok: true, entity: toEntity(active[0]) };

  const candidates = active.slice(0, 5).map((row) => `- ${toEntity(row).display}`);
  return {
    ok: false,
    question:
      `I found ${active.length} ${lowerLabel}s matching "${search}":\n${candidates.join('\n')}\n\n` +
      `Which one? Reply with the code.`,
  };
}
