/**
 * Conversation Sidebar
 *
 * Displays list of AI conversations with search and management options.
 */

import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Search, Trash2, Archive, MoreVertical, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  type Conversation,
  getConversations,
  deleteConversation,
  updateConversation,
} from '../services/conversation.service';
import { logError } from '../lib/logger';
import { cn } from '../lib/utils';

interface ConversationSidebarProps {
  activeConversationId?: string;
  onSelectConversation: (conversation: Conversation | null) => void;
  onNewConversation: () => void;
}

export function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch conversations
  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async (search?: string) => {
    try {
      setLoading(true);
      const result = await getConversations({
        status: 'ACTIVE',
        limit: 50,
        search,
      });
      setConversations(result.conversations);
    } catch (error) {
      logError('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConversations(searchQuery || undefined);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDelete = async (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation();
    try {
      await deleteConversation(conversation.id);
      setConversations((prev) => prev.filter((c) => c.id !== conversation.id));
      if (activeConversationId === conversation.id) {
        onSelectConversation(null);
      }
    } catch (error) {
      logError('Failed to delete conversation:', error);
    }
  };

  const handleArchive = async (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation();
    try {
      await updateConversation(conversation.id, { status: 'ARCHIVED' });
      setConversations((prev) => prev.filter((c) => c.id !== conversation.id));
      if (activeConversationId === conversation.id) {
        onSelectConversation(null);
      }
    } catch (error) {
      logError('Failed to archive conversation:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 border-r">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <Button onClick={onNewConversation} className="w-full" variant="default">
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            <div className="animate-pulse">Loading...</div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="py-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onSelectConversation(conversation)}
                className={cn(
                  'group flex items-center gap-3 px-3 py-3 mx-2 rounded-lg cursor-pointer transition-colors',
                  activeConversationId === conversation.id
                    ? 'bg-blue-100 border border-blue-200'
                    : 'hover:bg-gray-100'
                )}
              >
                <MessageSquare
                  className={cn(
                    'h-4 w-4 flex-shrink-0',
                    activeConversationId === conversation.id ? 'text-blue-600' : 'text-gray-400'
                  )}
                />

                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium truncate',
                      activeConversationId === conversation.id ? 'text-blue-900' : 'text-gray-700'
                    )}
                  >
                    {conversation.title || 'New Chat'}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(conversation.lastMessageAt)}</span>
                    {conversation._count && (
                      <span className="ml-2">{conversation._count.messages} msgs</span>
                    )}
                  </div>
                </div>

                {/* Actions Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => handleArchive(e as unknown as React.MouseEvent, conversation)}>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => handleDelete(e as unknown as React.MouseEvent, conversation)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t bg-white text-xs text-gray-500 text-center">
        {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
