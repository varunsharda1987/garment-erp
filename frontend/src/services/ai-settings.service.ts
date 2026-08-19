/**
 * AI Settings Service
 *
 * Frontend service for managing AI provider configuration.
 */

import api from '@/lib/api';

export interface AISettings {
  enabled: boolean;
  provider: string | null;
  apiKeySet: boolean;
  apiKeyMasked: string | null;
  model: string | null;
  baseUrl: string | null;
}

export interface AISettingsInput {
  enabled?: boolean;
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface AIProvider {
  value: string;
  label: string;
  description: string;
}

export interface AIModel {
  value: string;
  label: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  provider?: string;
  model?: string;
}

/**
 * Get current AI settings
 */
export async function getAISettings(): Promise<AISettings> {
  const response = await api.get<AISettings>('/ai-settings');
  return response.data;
}

/**
 * Update AI settings
 */
export async function updateAISettings(settings: AISettingsInput): Promise<AISettings> {
  const response = await api.put<AISettings>('/ai-settings', settings);
  return response.data;
}

/**
 * Test AI connection
 */
export async function testAIConnection(settings?: AISettingsInput): Promise<TestConnectionResult> {
  const response = await api.post<TestConnectionResult>('/ai-settings/test', settings || {});
  return response.data;
}

/**
 * Clear API key
 */
export async function clearAPIKey(): Promise<{ success: boolean; message: string }> {
  const response = await api.delete<{ success: boolean; message: string }>('/ai-settings/api-key');
  return response.data;
}

/**
 * Get available AI providers
 */
export async function getAIProviders(): Promise<AIProvider[]> {
  const response = await api.get<AIProvider[]>('/ai-settings/providers');
  return response.data;
}

/**
 * Get available models for a provider
 */
export async function getAIModels(provider: string): Promise<AIModel[]> {
  const response = await api.get<AIModel[]>(`/ai-settings/models/${provider}`);
  return response.data;
}
