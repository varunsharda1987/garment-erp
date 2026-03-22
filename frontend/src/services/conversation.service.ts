/**
 * Conversation Service
 *
 * Frontend service for managing AI conversations.
 */

import { API_URL } from '../config/api.config';

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

// Helper to get auth header
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  };
};

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

  const response = await fetch(`${API_URL}/conversations?${queryParams.toString()}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch conversations');
  }

  return response.json();
}

/**
 * Create a new conversation
 */
export async function createConversation(title?: string): Promise<Conversation> {
  const response = await fetch(`${API_URL}/conversations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error('Failed to create conversation');
  }

  return response.json();
}

/**
 * Get a single conversation with messages
 */
export async function getConversation(id: string): Promise<ConversationWithMessages> {
  const response = await fetch(`${API_URL}/conversations/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch conversation');
  }

  return response.json();
}

/**
 * Update conversation (title, status)
 */
export async function updateConversation(
  id: string,
  data: { title?: string; status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED' }
): Promise<Conversation> {
  const response = await fetch(`${API_URL}/conversations/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update conversation');
  }

  return response.json();
}

/**
 * Delete conversation (soft delete)
 */
export async function deleteConversation(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/conversations/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete conversation');
  }
}

/**
 * Send a chat message with persistent storage
 */
export async function sendChatMessage(message: string, conversationId?: string): Promise<ChatResponse> {
  const response = await fetch(`${API_URL}/ai/chat/persistent`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message, conversationId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send message');
  }

  return response.json();
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
  const response = await fetch(`${API_URL}/ai/feedback`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ messageId, rating, issueType, comment }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit feedback');
  }

  return response.json();
}

/**
 * Get role-based suggested questions (requires authentication)
 * Returns empty suggestions if not authenticated
 */
export async function getSuggestions(): Promise<SuggestionsResponse> {
  const response = await fetch(`${API_URL}/ai/suggestions`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    // If not authenticated or error, return empty suggestions
    return { suggestions: [], role: 'GUEST' };
  }

  return response.json();
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
  const response = await fetch(`${API_URL}/ai/status`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch AI status');
  }

  return response.json();
}

/**
 * Get user's AI usage statistics
 */
export async function getUserStats(): Promise<{
  totalConversations: number;
  totalMessages: number;
  feedbackStats: Record<string, number>;
}> {
  const response = await fetch(`${API_URL}/conversations/stats/summary`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user stats');
  }

  return response.json();
}
