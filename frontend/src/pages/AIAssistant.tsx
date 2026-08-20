/**
 * AI Assistant Page
 *
 * Enhanced chat interface with persistent conversations, feedback, and role-based suggestions.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Send, Bot, User, Sparkles, AlertCircle, Loader2, PanelLeftClose, PanelLeft, Mic, MicOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import { ConversationSidebar } from '../components/ConversationSidebar';
import { AIFeedback } from '../components/AIFeedback';
import { MarkdownMessage } from '../components/MarkdownMessage';
import {
  type Conversation,
  type Message,
  getConversation,
  sendChatMessage,
  getAIStatus,
  getSuggestions,
  confirmAiAction,
  rejectAiAction,
} from '../services/conversation.service';
import { AIActionCard } from '../components/AIActionCard';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { logError } from '../lib/logger';
import { cn } from '../lib/utils';

interface AIStatus {
  enabled: boolean;
  available: boolean;
  provider: string | null;
  model: string | null;
}

export default function AIAssistant() {
  const queryClient = useQueryClient();
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Voice input (Web Speech API) — appends the spoken transcript to the input box
  const speechBaseRef = useRef('');
  const {
    supported: speechSupported,
    listening,
    lang: speechLang,
    toggle: toggleSpeech,
    toggleLang: toggleSpeechLang,
  } = useSpeechInput((text, isFinal) => {
    const base = speechBaseRef.current;
    const joined = base ? `${base} ${text}` : text;
    setInput(joined);
    if (isFinal) speechBaseRef.current = joined;
  });

  const handleMicClick = () => {
    if (!listening) speechBaseRef.current = input;
    toggleSpeech();
  };

  // Check AI status on mount
  useEffect(() => {
    checkAIStatus();
    fetchSuggestions();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when conversation changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeConversation]);

  const checkAIStatus = async () => {
    try {
      const status = await getAIStatus();
      setAiStatus(status);
    } catch (error) {
      logError('Failed to check AI status:', error);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const result = await getSuggestions();
      setSuggestions(result.suggestions);
    } catch (error) {
      logError('Failed to fetch suggestions:', error);
    }
  };

  const handleSelectConversation = useCallback(async (conversation: Conversation | null) => {
    if (!conversation) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    try {
      const fullConversation = await getConversation(conversation.id);
      setActiveConversation(fullConversation);
      setMessages(fullConversation.messages || []);
    } catch (error) {
      logError('Failed to load conversation:', error);
    }
  }, []);

  const handleNewConversation = useCallback(() => {
    setActiveConversation(null);
    setMessages([]);
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const currentInput = input;
    setInput('');
    setLoading(true);

    // Add user message to UI immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversation?.id || '',
      role: 'USER',
      content: currentInput,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await sendChatMessage(currentInput, activeConversation?.id);

      // Refresh the sidebar list so the new/updated conversation appears immediately
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });

      // Update conversation ID if this was a new conversation
      if (!activeConversation && response.conversationId) {
        setActiveConversation({
          id: response.conversationId,
          userId: '',
          title: currentInput.slice(0, 50) + (currentInput.length > 50 ? '...' : ''),
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastMessageAt: new Date().toISOString(),
        });
      }

      // Add assistant response. Use the real DB message id returned by the backend so feedback
      // (thumbs up/down) targets an existing ai_messages row; only fall back to a synthetic id if
      // the backend didn't provide one (finding B10-09).
      const assistantMessage: Message = {
        id: response.messageId || `msg-${Date.now()}`,
        conversationId: response.conversationId,
        role: 'ASSISTANT',
        content: response.response,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        createdAt: new Date().toISOString(),
        // Proposed action (create greige/lace) awaiting the user's Confirm
        ...(response.action && {
          actionType: response.action.actionType,
          actionEntity: response.action.actionEntity,
          actionLabel: response.action.label,
          actionPayload: response.action.payload,
          actionStatus: response.action.status,
        }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: unknown) {
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        conversationId: activeConversation?.id || '',
        role: 'ASSISTANT',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── AI action confirm / reject ──────────────────────────────────────────
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const setMessageActionStatus = (messageId: string, status: Message['actionStatus']) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, actionStatus: status } : m)));
  };

  const handleConfirmAction = async (messageId: string) => {
    setActionBusyId(messageId);
    try {
      const result = await confirmAiAction(messageId);
      if (result.success) {
        setMessageActionStatus(messageId, 'EXECUTED');
      }
      // Append the outcome (success link or the error reason) to the chat
      setMessages((prev) => [
        ...prev,
        {
          id: result.resultMessageId || `action-result-${Date.now()}`,
          conversationId: activeConversation?.id || '',
          role: 'ASSISTANT',
          content: result.message,
          provider: 'system',
          model: 'action-executor',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error: unknown) {
      const axiosMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessages((prev) => [
        ...prev,
        {
          id: `action-error-${Date.now()}`,
          conversationId: activeConversation?.id || '',
          role: 'ASSISTANT',
          content: `❌ ${axiosMessage || 'Action failed. Please try again.'}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRejectAction = async (messageId: string) => {
    setActionBusyId(messageId);
    try {
      await rejectAiAction(messageId);
      setMessageActionStatus(messageId, 'REJECTED');
    } catch (error) {
      logError('Failed to reject action:', error);
    } finally {
      setActionBusyId(null);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Loading state
  if (!aiStatus) {
    return (
      <div className="p-6 h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Checking AI availability...</span>
        </div>
      </div>
    );
  }

  // AI not available
  if (!aiStatus.enabled || !aiStatus.available) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="h-6 w-6" />
          <div>
            <h1 className="text-3xl font-display font-medium text-foreground">AI Assistant</h1>
            <p className="text-sm text-muted-foreground">AI-powered help for your ERP system</p>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>AI Not Available</AlertTitle>
          <AlertDescription>AI features are not enabled. Please configure AI in the backend settings.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-muted">
      {/* Conversation Sidebar */}
      {sidebarOpen && (
        <div className="w-72 flex-shrink-0">
          <ConversationSidebar
            activeConversationId={activeConversation?.id}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
          />
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-card border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 p-0">
              {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
            </Button>
            <div>
              <h1 className="font-display font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-info" />
                AI Assistant
              </h1>
              <p className="text-xs text-muted-foreground">
                Powered by {aiStatus.provider} ({aiStatus.model})
              </p>
            </div>
          </div>

          {activeConversation && (
            <div className="text-sm text-muted-foreground">{activeConversation.title || 'New Chat'}</div>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Bot className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">How can I help you today?</h3>
              <p className="text-muted-foreground mb-8 max-w-md">
                Ask me anything about the ERP system - styles, orders, materials, production, and more.
              </p>

              {suggestions.length > 0 && (
                <div className="space-y-2 w-full max-w-md">
                  <p className="text-sm text-muted-foreground font-medium">Try asking:</p>
                  <div className="grid gap-2">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => setInput(suggestion)}
                        className="text-left px-4 py-3 bg-card hover:bg-muted rounded-lg border text-sm text-foreground transition-colors shadow-sm"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn('flex gap-4', message.role === 'USER' ? 'flex-row-reverse' : 'flex-row')}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                      message.role === 'USER' ? 'bg-info' : 'bg-gray-200'
                    )}
                  >
                    {message.role === 'USER' ? (
                      <User className="h-4 w-4 text-white" />
                    ) : (
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className={cn('flex-1 max-w-[80%]', message.role === 'USER' ? 'flex flex-col items-end' : '')}>
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-3',
                        message.role === 'USER' ? 'bg-info text-white' : 'bg-card border shadow-sm'
                      )}
                    >
                      {message.role === 'ASSISTANT' ? (
                        <MarkdownMessage content={message.content} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>

                    {/* Proposed action confirmation card */}
                    {message.role === 'ASSISTANT' && message.actionType && message.actionPayload && (
                      <AIActionCard
                        actionType={message.actionType}
                        label={message.actionLabel}
                        payload={message.actionPayload}
                        status={message.actionStatus || 'PENDING'}
                        busy={actionBusyId === message.id}
                        onConfirm={() => handleConfirmAction(message.id)}
                        onReject={() => handleRejectAction(message.id)}
                      />
                    )}

                    {/* Message Meta */}
                    <div
                      className={cn(
                        'flex items-center gap-3 mt-1 px-1',
                        message.role === 'USER' ? 'flex-row-reverse' : ''
                      )}
                    >
                      <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>

                      {message.latencyMs && (
                        <span className="text-xs text-muted-foreground">{message.latencyMs}ms</span>
                      )}

                      {/* Feedback for assistant messages */}
                      {message.role === 'ASSISTANT' && !message.id.startsWith('error-') && (
                        <AIFeedback messageId={message.id} existingRating={message.feedback?.[0]?.rating} />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="bg-card border rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-card border-t p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about the ERP system..."
                className="flex-1 resize-none border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                disabled={loading}
              />
              {speechSupported && (
                <div className="flex flex-col items-center gap-1 self-end">
                  <Button
                    type="button"
                    variant={listening ? 'destructive' : 'outline'}
                    onClick={handleMicClick}
                    className="h-9 w-12 rounded-xl p-0"
                    title={listening ? 'Stop listening' : `Speak (${speechLang === 'hi-IN' ? 'Hindi' : 'English'})`}
                  >
                    {listening ? <MicOff className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <button
                    type="button"
                    onClick={toggleSpeechLang}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
                    title="Toggle speech language"
                  >
                    {speechLang === 'hi-IN' ? 'हिंदी' : 'ENG'}
                  </button>
                </div>
              )}
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="self-end h-12 px-6 rounded-xl"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
              {speechSupported && ' • Click the mic to speak'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
