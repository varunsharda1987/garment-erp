/**
 * Designer Dashboard Types
 * TypeScript types for the designer dashboard functionality
 * Matches backend API response structure
 */

export interface DashboardStats {
  totalStyles: number;
  byStatus: {
    DRAFT: number;
    ACTIVE: number;
    ARCHIVED: number;
    IN_DEVELOPMENT: number;
    APPROVED: number;
  };
  byCADStatus: {
    PENDING: number;
    IN_PROGRESS: number;
    COMPLETED: number;
    APPROVED: number;
  };
}

export interface SeasonCount {
  season: string;
  count: number;
}

export interface RecentStyle {
  id: string;
  styleCode: string;
  buyerStyleRef?: string | null;
  styleName: string;
  status: string;
  imageUrl?: string | null;
  customerName?: string | null;
  brandName?: string | null;
  season?: string | null;
  createdAt: string;
}

export interface TeamActivity {
  id: string;
  comment: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  style?: {
    id: string;
    styleCode: string;
    buyerStyleRef?: string | null;
    styleName: string;
  } | null;
}

export interface MoodBoardSummary {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  updatedAt: string;
  season?: {
    id: string;
    code: string;
    name: string;
  } | null;
  _count: {
    items: number;
  };
}

export interface DashboardData {
  stats: DashboardStats;
  recentStyles: RecentStyle[];
  activity: TeamActivity[];
  stylesBySeason: SeasonCount[];
  moodBoards: MoodBoardSummary[];
}

// API Response types
export interface DashboardResponse {
  data: DashboardData;
}

export interface RecentStylesResponse {
  data: RecentStyle[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ActivityResponse {
  data: TeamActivity[];
}
