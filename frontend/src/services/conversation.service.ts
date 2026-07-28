/**
 * Conversation Service
 *
 * Frontend service for managing AI conversations.
 */

import api from '@/lib/api';

// Types
export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  _count?: {
    messages: number;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  latencyMs?: number;
  actionType?: string;
  actionEntity?: string;
  actionPayload?: Record<string, unknown>;
  actionStatus?: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXECUTED' | 'EXPIRED';
  metadata?: Record<string, unknown>;
  createdAt: string;
  feedback?: Feedback[];
}

export interface Feedback {
  id: string;
  messageId: string;
  userId: string;
  rating: 'HELPFUL' | 'NOT_HELPFUL';
  issueType?: string;
  comment?: string;
  createdAt: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface ChatResponse {
  response: string;
  // Real ai_messages id of the saved assistant reply — used to attach feedback to a freshly
  // streamed answer (backend now returns it; see finding B10-09).
  messageId?: string;
  conversationId: string;
  provider: string;
  model: string;
  latencyMs?: number;
  restricted?: boolean;
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
}

export interface SuggestionsResponse {
  suggestions: string[];
  role: string;
}

/**
 * Fetch user's conversations
 */
export async function getConversations(
  params: {
    status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
    limit?: number;
    offset?: number;
    search?: string;
  } = {}
): Promise<ConversationListResponse> {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.append('status', params.status);
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());
  if (params.search) queryParams.append('search', params.search);

  const response = await api.get<ConversationListResponse>(`/conversations?${queryParams.toString()}`);
  return response.data;
}

/**
 * Create a new conversation
 */
export async function createConversation(title?: string): Promise<Conversation> {
  const response = await api.post<Conversation>('/conversations', { title });
  return response.data;
}

/**
 * Get a single conversation with messages
 */
export async function getConversation(id: string): Promise<ConversationWithMessages> {
  const response = await api.get<ConversationWithMessages>(`/conversations/${id}`);
  return response.data;
}

/**
 * Update conversation (title, status)
 */
export async function updateConversation(
  id: string,
  data: { title?: string; status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED' }
): Promise<Conversation> {
  const response = await api.patch<Conversation>(`/conversations/${id}`, data);
  return response.data;
}

/**
 * Delete conversation (soft delete)
 */
export async function deleteConversation(id: string): Promise<void> {
  await api.delete(`/conversations/${id}`);
}

/**
 * Send a chat message with persistent storage
 */
export async function sendChatMessage(message: string, conversationId?: string): Promise<ChatResponse> {
  const response = await api.post<ChatResponse>('/ai/chat/persistent', { message, conversationId });
  return response.data;
}

/**
 * Send feedback for a message
 */
export async function sendFeedback(
  messageId: string,
  rating: 'HELPFUL' | 'NOT_HELPFUL',
  issueType?: string,
  comment?: string
): Promise<Feedback> {
  const response = await api.post<Feedback>('/ai/feedback', { messageId, rating, issueType, comment });
  return response.data;
}

/**
 * Get role-based suggested questions (requires authentication)
 * Returns empty suggestions if not authenticated
 */
export async function getSuggestions(): Promise<SuggestionsResponse> {
  try {
    const response = await api.get<SuggestionsResponse>('/ai/suggestions');
    return response.data;
  } catch {
    return { suggestions: [], role: 'GUEST' };
  }
}

/**
 * Get AI status (PUBLIC - no auth required)
 */
export async function getAIStatus(): Promise<{
  enabled: boolean;
  available: boolean;
  provider: string | null;
  model: string | null;
}> {
  const response = await api.get<{
    enabled: boolean;
    available: boolean;
    provider: string | null;
    model: string | null;
  }>('/ai/status');
  return response.data;
}

/**
 * Get user's AI usage statistics
 */
export async function getUserStats(): Promise<{
  totalConversations: number;
  totalMessages: number;
  feedbackStats: Record<string, number>;
}> {
  const response = await api.get<{
    totalConversations: number;
    totalMessages: number;
    feedbackStats: Record<string, number>;
  }>('/conversations/stats/summary');
  return response.data;
}
