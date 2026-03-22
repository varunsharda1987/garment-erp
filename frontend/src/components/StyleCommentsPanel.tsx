/**
 * Style Comments Panel Component
 * Threaded comments panel for style collaboration
 */

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Edit2, Trash2, Reply, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { styleCommentService } from '@/services/styleComment.service';
import type { StyleComment } from '@/types/styleComment.types';
import { formatDistanceToNow } from 'date-fns';

interface StyleCommentsPanelProps {
  styleId: string;
  currentUserId?: string;
}

// Get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Generate color from string (for avatar)
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-red-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
  ];
  return colors[Math.abs(hash) % colors.length];
}

// Single comment component
function CommentItem({
  comment,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  isReply = false,
}: {
  comment: StyleComment;
  currentUserId?: string;
  onReply: (commentId: string) => void;
  onEdit: (comment: StyleComment) => void;
  onDelete: (comment: StyleComment) => void;
  isReply?: boolean;
}) {
  const isOwner = currentUserId === comment.userId;
  const avatarColor = stringToColor(comment.user.name);

  return (
    <div className={`flex gap-3 ${isReply ? 'ml-10 mt-3' : ''}`}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className={`${avatarColor} text-white text-xs`}>
          {getInitials(comment.user.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{comment.user.name}</span>
          <span className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
          {comment.updatedAt !== comment.createdAt && <span className="text-xs text-gray-400">(edited)</span>}
        </div>

        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{comment.comment}</p>

        <div className="flex items-center gap-2 mt-1">
          {!isReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
              onClick={() => onReply(comment.id)}
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
          )}

          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onEdit(comment)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(comment)} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-3 mt-3">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StyleCommentsPanel({ styleId, currentUserId }: StyleCommentsPanelProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<StyleComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [newComment, setNewComment] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<StyleComment | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteComment, setDeleteComment] = useState<StyleComment | null>(null);

  // Load comments
  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await styleCommentService.getComments(styleId);
      setComments(data);
    } catch (error) {
      console.error('Failed to load comments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load comments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [styleId, toast]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Submit new comment or reply
  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      await styleCommentService.createComment(styleId, {
        comment: newComment.trim(),
        parentId: replyToId || undefined,
      });
      toast({
        title: 'Success',
        description: replyToId ? 'Reply added' : 'Comment added',
      });
      setNewComment('');
      setReplyToId(null);
      loadComments();
    } catch (error) {
      console.error('Failed to submit comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle reply
  const handleReply = (commentId: string) => {
    setReplyToId(commentId);
    // Find the comment being replied to
    const parent = comments.find((c) => c.id === commentId);
    if (parent) {
      setNewComment(`@${parent.user.name} `);
    }
  };

  // Cancel reply
  const cancelReply = () => {
    setReplyToId(null);
    setNewComment('');
  };

  // Handle edit
  const handleEdit = (comment: StyleComment) => {
    setEditingComment(comment);
    setEditText(comment.comment);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingComment || !editText.trim()) return;

    try {
      await styleCommentService.updateComment(styleId, editingComment.id, {
        comment: editText.trim(),
      });
      toast({
        title: 'Success',
        description: 'Comment updated',
      });
      setEditingComment(null);
      setEditText('');
      loadComments();
    } catch (error) {
      console.error('Failed to update comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to update comment',
        variant: 'destructive',
      });
    }
  };

  // Handle delete
  const handleDelete = (comment: StyleComment) => {
    setDeleteComment(comment);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!deleteComment) return;

    try {
      await styleCommentService.deleteComment(styleId, deleteComment.id);
      toast({
        title: 'Success',
        description: 'Comment deleted',
      });
      setDeleteComment(null);
      loadComments();
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive',
      });
    }
  };

  // Find parent comment name for reply indicator
  const getParentCommentUser = () => {
    if (!replyToId) return null;
    const parent = comments.find((c) => c.id === replyToId);
    return parent?.user.name || null;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments
            <Badge variant="secondary">{comments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Comment input */}
          <div className="space-y-2">
            {replyToId && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Reply className="h-4 w-4" />
                <span>Replying to {getParentCommentUser()}</span>
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={cancelReply}>
                  Cancel
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={replyToId ? 'Write a reply...' : 'Add a comment...'}
                className="min-h-[80px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSubmit();
                  }
                }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Press Ctrl+Enter to submit</span>
              <Button onClick={handleSubmit} disabled={!newComment.trim() || submitting} size="sm">
                <Send className="h-4 w-4 mr-1" />
                {submitting ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>

          {/* Comments list */}
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
              <p>No comments yet</p>
              <p className="text-sm">Be the first to comment!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onReply={handleReply}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingComment && (
        <AlertDialog open={!!editingComment} onOpenChange={() => setEditingComment(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Edit Comment</AlertDialogTitle>
              <AlertDialogDescription>Make changes to your comment below.</AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="min-h-[100px]" />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSaveEdit}>Save Changes</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteComment} onOpenChange={() => setDeleteComment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your comment
              {deleteComment?.replies?.length ? ' and all its replies' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default StyleCommentsPanel;
