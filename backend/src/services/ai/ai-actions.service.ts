/**
 * AI Actions Service
 *
 * Allowlist registry of actions the AI assistant may PROPOSE. Nothing outside this
 * registry can ever run. Flow:
 *   1. Chat passes the registry's tool definitions to the model (function calling).
 *   2. The model's arguments are validated against the action's TOOL schema (human-facing
 *      names: "customer Kasya"), RESOLVED into real ids, then stored on the assistant
 *      message with actionStatus PENDING — never executed.
 *   3. The user clicks Confirm → confirmAction() re-validates against the EXECUTION schema
 *      (resolved shape: customerId) and calls the EXISTING HTTP endpoint with the caller's
 *      own JWT — so every existing validation, code generator and transaction is reused.
 *
 * Two schemas per action is deliberate: the model speaks names, the API speaks UUIDs.
 * Validating a resolved payload against the tool schema would strip the ids (zod strips
 * unknown keys) and every resolution-based action would 400 at its endpoint.
 *
 * Action definitions live in ./actions/*.actions.ts — add new ones there.
 */

import { ActionStatus, UserRole } from '@prisma/client';
import prisma from '../../config/database';
import { logInfo, logError } from '../../utils/logger';
import {
  ActionContext,
  ActionDefinition,
  DISPLAY_KEY,
  Payload,
  ToolDefinition,
  internalFetch,
} from './ai-action-types';
import { MASTER_ACTIONS } from './actions/master.actions';
import { WORKFLOW_ACTIONS } from './actions/workflow.actions';

export type { ToolDefinition, ActionContext } from './ai-action-types';
export { DISPLAY_KEY } from './ai-action-types';

/** Proposals older than this are refused — their resolved ids may no longer be valid. */
const PROPOSAL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const REGISTRY: Record<string, ActionDefinition> = {};
for (const def of [...MASTER_ACTIONS, ...WORKFLOW_ACTIONS]) {
  if (REGISTRY[def.actionType]) {
    throw new Error(`Duplicate AI action registered: ${def.actionType}`);
  }
  REGISTRY[def.actionType] = def;
}

export interface ProposalResult {
  kind: 'action' | 'question' | 'none';
  actionType?: string;
  actionEntity?: string;
  label?: string;
  payload?: Payload;
  question?: string;
}

export interface ConfirmResult {
  success: boolean;
  message: string;
  createdData?: Record<string, unknown>;
}

class AIActionsService {
  /** Tool definitions this role may use (what the model is offered). */
  getToolsForRole(role: UserRole): ToolDefinition[] {
    return Object.values(REGISTRY)
      .filter((def) => def.allowedRoles.includes(role))
      .map((def) => def.tool);
  }

  /** Prompt block generated from the registry, so it can never drift from the tools. */
  getPromptLinesForRole(role: UserRole): string {
    const lines = Object.values(REGISTRY)
      .filter((def) => def.allowedRoles.includes(role))
      .map((def) => `- ${def.label} (${def.actionType})`);

    if (lines.length === 0) return '';

    return `ACTIONS YOU CAN PERFORM (via tools):
${lines.join('\n')}

RULES FOR ACTIONS:
- Before calling a tool, make sure you have every REQUIRED field from the user — ask for what is missing instead of guessing.
- Use ONLY values the user actually gave; never invent names, widths, quantities or prices.
- Propose ONE record per turn. If the user asks for several, do the first and offer the next after they confirm it.
- After you call a tool the user still has to press Confirm — tell them to check the details and confirm.
- When the user answers a disambiguation question, call the tool AGAIN with ALL the fields gathered so far.
- You cannot update or delete anything.`;
  }

  getAction(actionType: string): ActionDefinition | undefined {
    return REGISTRY[actionType];
  }

  /** All registered actions (used by the registry drift test). */
  getAllActions(): ActionDefinition[] {
    return Object.values(REGISTRY);
  }

  /**
   * Turn a model tool call into either a PENDING proposal, or a question to ask back.
   * Runs: tool-schema validation → resolve (names→ids) → prepare (extra fetches) →
   * execution-schema sanity check.
   */
  async buildProposal(actionType: string, args: unknown, ctx: ActionContext): Promise<ProposalResult> {
    const def = REGISTRY[actionType];
    if (!def) return { kind: 'none' };

    if (!def.allowedRoles.includes(ctx.userRole)) {
      return { kind: 'question', question: `Your role is not allowed to ${def.label.toLowerCase()}.` };
    }

    const parsed = def.toolSchema.safeParse(args);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join('.') || 'field').join(', ');
      return {
        kind: 'question',
        question: `I need a bit more information before I can do that — please provide: ${missing}.`,
      };
    }

    let payload = parsed.data as Payload;
    const displayLines: string[] = [];

    if (def.resolve) {
      const resolved = await def.resolve(payload, ctx);
      if (!resolved.ok) return { kind: 'question', question: resolved.question };
      payload = resolved.payload;
      displayLines.push(...resolved.displayLines);
    }

    if (def.prepare) {
      const prepared = await def.prepare(payload, ctx);
      if (!prepared.ok) return { kind: 'question', question: prepared.question };
      payload = prepared.payload;
      displayLines.push(...prepared.displayLines);
    }

    // Sanity-check the resolved shape now, so a broken registry entry surfaces at proposal
    // time rather than after the user has pressed Confirm.
    const executable = def.executionSchema.safeParse(payload);
    if (!executable.success) {
      logError(
        `[AIActions] ${actionType} resolved payload failed its execution schema: ${executable.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`
      );
      return {
        kind: 'question',
        question: 'I could not assemble that request correctly. Please try rephrasing, or create it from the page.',
      };
    }

    return {
      kind: 'action',
      actionType: def.actionType,
      actionEntity: def.actionEntity,
      label: def.label,
      payload: { ...payload, ...(displayLines.length > 0 && { [DISPLAY_KEY]: displayLines }) },
    };
  }

  /**
   * Confirm and execute a PENDING action message. Ownership, age, role and payload are all
   * re-checked server-side before anything is written.
   */
  async confirmAction(
    messageId: string,
    userId: string,
    userRole: UserRole,
    authHeader: string
  ): Promise<ConfirmResult> {
    const message = await prisma.ai_messages.findUnique({
      where: { id: messageId },
      include: { conversation: { select: { userId: true } } },
    });

    if (!message || message.conversation.userId !== userId) {
      return { success: false, message: 'Action not found' };
    }
    if (message.actionStatus !== 'PENDING') {
      return { success: false, message: `This action is already ${message.actionStatus?.toLowerCase() || 'resolved'}` };
    }
    if (Date.now() - message.createdAt.getTime() > PROPOSAL_MAX_AGE_MS) {
      return { success: false, message: 'This proposal is too old to run safely — please ask again.' };
    }

    const def = message.actionType ? REGISTRY[message.actionType] : undefined;
    if (!def) return { success: false, message: 'Unknown action type' };
    if (!def.allowedRoles.includes(userRole)) {
      return { success: false, message: 'Your role is not allowed to perform this action' };
    }

    // Validate against the EXECUTION schema — this also strips displayLines from the body.
    const validated = def.executionSchema.safeParse(message.actionPayload);
    if (!validated.success) {
      return {
        success: false,
        message: `Invalid action data: ${validated.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      };
    }

    const body = validated.data as Payload;
    const path = typeof def.path === 'function' ? def.path(message.actionPayload as Payload) : def.path;

    try {
      const {
        ok,
        status,
        body: response,
      } = await internalFetch(path, { method: def.method, body: JSON.stringify(body) }, authHeader);

      if (!ok) {
        const errMsg =
          (response.message as string) || (response.error as string) || `Request failed with status ${status}`;
        logError(`[AIActions] ${def.actionType} execution failed: ${errMsg}`);
        return { success: false, message: errMsg };
      }

      const createdData = (response.data as Record<string, unknown>) || response;

      await prisma.ai_messages.update({
        where: { id: messageId },
        data: { actionStatus: ActionStatus.EXECUTED },
      });

      logInfo(`[AIActions] ${def.actionType} executed by user ${userId}`);
      return { success: true, message: def.successMessage(createdData), createdData };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Execution failed';
      logError(`[AIActions] ${def.actionType} execution error: ${errMsg}`);
      return { success: false, message: `Execution failed: ${errMsg}` };
    }
  }

  /** Reject a PENDING action message. */
  async rejectAction(messageId: string, userId: string): Promise<ConfirmResult> {
    const message = await prisma.ai_messages.findUnique({
      where: { id: messageId },
      include: { conversation: { select: { userId: true } } },
    });

    if (!message || message.conversation.userId !== userId) {
      return { success: false, message: 'Action not found' };
    }
    if (message.actionStatus !== 'PENDING') {
      return { success: false, message: `This action is already ${message.actionStatus?.toLowerCase() || 'resolved'}` };
    }

    await prisma.ai_messages.update({
      where: { id: messageId },
      data: { actionStatus: ActionStatus.REJECTED },
    });

    return { success: true, message: 'Action cancelled' };
  }
}

export const aiActionsService = new AIActionsService();
