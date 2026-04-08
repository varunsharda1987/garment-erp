/**
 * AI Feedback Component
 *
 * Allows users to rate AI responses and provide feedback.
 */

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, X } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { sendFeedback } from '../services/conversation.service';
import { logError } from '../lib/logger';
import { cn } from '../lib/utils';

interface AIFeedbackProps {
  messageId: string;
  existingRating?: 'HELPFUL' | 'NOT_HELPFUL';
  compact?: boolean;
}

const ISSUE_TYPES = [
  { value: 'wrong_info', label: 'Wrong information' },
  { value: 'incomplete', label: 'Incomplete answer' },
  { value: 'not_relevant', label: 'Not relevant' },
  { value: 'slow', label: 'Response was slow' },
  { value: 'confusing', label: 'Confusing explanation' },
  { value: 'other', label: 'Other' },
];

export function AIFeedback({ messageId, existingRating, compact = true }: AIFeedbackProps) {
  const [rating, setRating] = useState<'HELPFUL' | 'NOT_HELPFUL' | null>(existingRating || null);
  const [showDetails, setShowDetails] = useState(false);
  const [issueType, setIssueType] = useState<string>('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleRating = async (newRating: 'HELPFUL' | 'NOT_HELPFUL') => {
    if (rating === newRating) return;

    setRating(newRating);

    // If helpful, submit immediately
    if (newRating === 'HELPFUL') {
      await submitFeedback(newRating);
    } else {
      // If not helpful, show details form
      setShowDetails(true);
    }
  };

  const submitFeedback = async (
    feedbackRating: 'HELPFUL' | 'NOT_HELPFUL',
    feedbackIssueType?: string,
    feedbackComment?: string
  ) => {
    try {
      setSubmitting(true);
      await sendFeedback(messageId, feedbackRating, feedbackIssueType, feedbackComment);
      setSubmitted(true);
      setShowDetails(false);
    } catch (error) {
      logError('Failed to submit feedback:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDetails = async () => {
    if (rating) {
      await submitFeedback(rating, issueType || undefined, comment || undefined);
    }
  };

  if (submitted && compact) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Rating Buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Was this helpful?</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleRating('HELPFUL')}
          disabled={submitting}
          className={cn('h-7 px-2', rating === 'HELPFUL' && 'bg-success-muted text-success hover:bg-success-muted')}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleRating('NOT_HELPFUL')}
          disabled={submitting}
          className={cn(
            'h-7 px-2',
            rating === 'NOT_HELPFUL' && 'bg-destructive/10 text-destructive hover:bg-destructive/10'
          )}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Feedback Details Form */}
      {showDetails && !submitted && (
        <div className="bg-muted rounded-lg p-3 space-y-3 border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Tell us more</span>
            <Button variant="ghost" size="sm" onClick={() => setShowDetails(false)} className="h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Select value={issueType} onValueChange={setIssueType}>
            <SelectTrigger className="w-full bg-card">
              <SelectValue placeholder="What was the issue?" />
            </SelectTrigger>
            <SelectContent>
              {ISSUE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Additional comments (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="bg-card"
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDetails(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmitDetails} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </div>
      )}

      {submitted && !compact && (
        <div className="flex items-center gap-2 text-sm text-success bg-success-muted px-3 py-2 rounded-lg">
          <MessageSquare className="h-4 w-4" />
          <span>Thanks for your feedback! It helps us improve.</span>
        </div>
      )}
    </div>
  );
}
