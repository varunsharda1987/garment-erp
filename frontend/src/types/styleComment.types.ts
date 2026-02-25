/**
 * Style Comment Types
 * TypeScript types for style comments/collaboration functionality
 */

export interface StyleCommentUser {
  id: string;
  name: string;
  email: string;
}

export interface StyleComment {
  id: string;
  styleId: string;
  userId: string;
  comment: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
  user: StyleCommentUser;
  replies?: StyleComment[];
}

export interface CreateStyleCommentDTO {
  comment: string;
  parentId?: string;
}

export interface UpdateStyleCommentDTO {
  comment: string;
}

// API Response types
export interface StyleCommentsResponse {
  data: StyleComment[];
}

export interface StyleCommentResponse {
  data: StyleComment;
  message?: string;
}

// Activity feed types (for dashboard)
export interface StyleCommentActivity {
  id: string;
  styleId: string;
  comment: string;
  createdAt: string;
  user: StyleCommentUser;
  style?: {
    id: string;
    styleCode: string;
    name: string;
  };
}

export interface StyleCommentActivityResponse {
  data: StyleCommentActivity[];
}
