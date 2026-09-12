/**
 * AI Insights Service
 * Frontend wrappers for the ADMIN-only /ai-insights endpoints.
 */

import api from '@/lib/api';
import type {
  AiInsightsParams,
  AiInsightsSummary,
  UnansweredQuestion,
  WeakMatch,
  NegativeFeedbackItem,
  GuideUsage,
} from '@/types/aiInsights.types';

function toQuery(params: AiInsightsParams): string {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.includeData !== undefined) query.set('includeData', String(params.includeData));
  if (params.limit) query.set('limit', String(params.limit));
  const text = query.toString();
  return text ? `?${text}` : '';
}

export async function getAiInsightsSummary(params: AiInsightsParams = {}): Promise<AiInsightsSummary> {
  const response = await api.get<AiInsightsSummary>(`/ai-insights/summary${toQuery(params)}`);
  return response.data;
}

export async function getUnansweredQuestions(params: AiInsightsParams = {}): Promise<UnansweredQuestion[]> {
  const response = await api.get<{ data: UnansweredQuestion[] }>(`/ai-insights/unanswered${toQuery(params)}`);
  return response.data.data;
}

export async function getWeakMatches(params: AiInsightsParams = {}): Promise<WeakMatch[]> {
  const response = await api.get<{ data: WeakMatch[] }>(`/ai-insights/weak${toQuery(params)}`);
  return response.data.data;
}

export async function getNegativeFeedback(params: AiInsightsParams = {}): Promise<NegativeFeedbackItem[]> {
  const response = await api.get<{ data: NegativeFeedbackItem[] }>(`/ai-insights/negative-feedback${toQuery(params)}`);
  return response.data.data;
}

export async function getGuideUsage(params: AiInsightsParams = {}): Promise<GuideUsage[]> {
  const response = await api.get<{ data: GuideUsage[] }>(`/ai-insights/guide-usage${toQuery(params)}`);
  return response.data.data;
}
