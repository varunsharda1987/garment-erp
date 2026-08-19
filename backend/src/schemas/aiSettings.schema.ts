/**
 * AI Settings Schemas
 *
 * Zod validation schemas for AI settings endpoints.
 */

import { z } from 'zod';

export const updateAISettingsSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(['deepseek', 'kimi', 'ollama', 'openai', 'anthropic', 'google']).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  baseUrl: z.string().url().optional().or(z.literal('')),
});

export const testAIConnectionSchema = z.object({
  provider: z.enum(['deepseek', 'kimi', 'ollama', 'openai', 'anthropic', 'google']).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  baseUrl: z.string().url().optional().or(z.literal('')),
});

export type UpdateAISettingsInput = z.infer<typeof updateAISettingsSchema>;
export type TestAIConnectionInput = z.infer<typeof testAIConnectionSchema>;
