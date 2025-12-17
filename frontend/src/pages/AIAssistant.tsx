/**
 * AI Assistant Page
 *
 * Enhanced chat interface with persistent conversations, feedback, and role-based suggestions.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Sparkles, AlertCircle, Loader2, PanelLeftClose, PanelLeft } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import { ConversationSidebar } from '../components/ConversationSidebar';
import { AIFeedback } from '../components/AIFeedback';
import {
  type Conversation,
  type Message,
  getConversation,
  sendChatMessage,
  getAIStatus,
  getSuggestions,
} from '../services/conversation.service';
import { logError } from '../lib/logger';
import { cn } from '../lib/utils';

interface AIStatus {
  enabled: boolean;
  available: boolean;
  provider: string | null;
  model: string | null;
}

export default function AIAssistant() {
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

      // Add assistant response
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId: response.conversationId,
        role: 'ASSISTANT',
        content: response.response,
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
        createdAt: new Date().toISOString(),
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
        <div className="flex items-center gap-3 text-gray-500">
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
        <PageHeader
          title="AI Assistant"
          description="AI-powered help for your ERP system"
          icon={<Sparkles className="h-6 w-6" />}
        />

        <Alert className="mt-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>AI Not Available</AlertTitle>
          <AlertDescription>
            AI features are not enabled. Please configure AI in the backend settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
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
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8 p-0"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeft className="h-5 w-5" />
              )}
            </Button>
            <div>
              <h1 className="font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                AI Assistant
              </h1>
              <p className="text-xs text-gray-500">
                Powered by {aiStatus.provider} ({aiStatus.model})
              </p>
            </div>
          </div>

          {activeConversation && (
            <div className="text-sm text-gray-500">
              {activeConversation.title || 'New Chat'}
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Bot className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                How can I help you today?
              </h3>
              <p className="text-gray-500 mb-8 max-w-md">
                Ask me anything about the ERP system - styles, orders, materials, production, and more.
              </p>

              {suggestions.length > 0 && (
                <div className="space-y-2 w-full max-w-md">
                  <p className="text-sm text-gray-600 font-medium">Try asking:</p>
                  <div className="grid gap-2">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => setInput(suggestion)}
                        className="text-left px-4 py-3 bg-white hover:bg-gray-50 rounded-lg border text-sm text-gray-700 transition-colors shadow-sm"
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
                  className={cn(
                    'flex gap-4',
                    message.role === 'USER' ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                      message.role === 'USER' ? 'bg-blue-600' : 'bg-gray-200'
                    )}
                  >
                    {message.role === 'USER' ? (
                      <User className="h-4 w-4 text-white" />
                    ) : (
                      <Bot className="h-4 w-4 text-gray-600" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div
                    className={cn(
                      'flex-1 max-w-[80%]',
                      message.role === 'USER' ? 'flex flex-col items-end' : ''
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-2xl px-4 py-3',
                        message.role === 'USER'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border shadow-sm'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>

                    {/* Message Meta */}
                    <div
                      className={cn(
                        'flex items-center gap-3 mt-1 px-1',
                        message.role === 'USER' ? 'flex-row-reverse' : ''
                      )}
                    >
                      <span className="text-xs text-gray-400">
                        {formatTime(message.createdAt)}
                      </span>

                      {message.latencyMs && (
                        <span className="text-xs text-gray-400">
                          {message.latencyMs}ms
                        </span>
                      )}

                      {/* Feedback for assistant messages */}
                      {message.role === 'ASSISTANT' && !message.id.startsWith('error-') && (
                        <AIFeedback
                          messageId={message.id}
                          existingRating={message.feedback?.[0]?.rating}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="bg-white border rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t p-4">
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
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="self-end h-12 px-6 rounded-xl"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
