/**
 * AI Insights Types
 * Matches backend ai-insights.service.ts response shapes (already camelCase).
 */

export interface AiInsightsParams {
  /** YYYY-MM-DD */
  from?: string;
  /** YYYY-MM-DD */
  to?: string;
  includeData?: boolean;
  limit?: number;
}

export interface AiInsightsSummary {
  from: string;
  to: string;
  totalQuestions: number;
  zeroMatch: number;
  weak: number;
  negativeFeedback: number;
  positiveFeedback: number;
  withPageRoute: number;
  /** Assistant turns answered while the guide feature was switched off */
  knowledgeDisabled: number;
}

export interface UnansweredQuestion {
  question: string;
  count: number;
  lastAskedAt: string;
  samplePageRoute: string | null;
  sampleRole: string | null;
  messageIds: string[];
  dataLookup: boolean;
}

export interface WeakMatch extends UnansweredQuestion {
  guideSlugs: string[];
  topScore: number;
}

export interface NegativeFeedbackItem {
  messageId: string;
  createdAt: string;
  question: string;
  answerSnippet: string;
  guideSlugs: string[];
  issueType: string | null;
  comment: string | null;
  userRole: string | null;
  pageRoute: string | null;
}

export interface GuideUsage {
  slug: string;
  title: string;
  route: string | null;
  uses: number;
  helpful: number;
  notHelpful: number;
  /** helpful / (helpful + notHelpful), null when unrated */
  ratio: number | null;
}
