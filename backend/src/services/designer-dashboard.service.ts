/**
 * Designer Dashboard Service
 * Provides aggregated data for the design team dashboard
 */
import prisma from '../config/database';
import { logError, logDebug } from '../utils/logger';

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

export interface StyleSummary {
  id: string;
  styleCode: string;
  buyerStyleRef: string | null;
  styleName: string;
  status: string;
  imageUrl: string | null;
  customerName: string | null;
  brandName: string | null;
  season: string | null;
  createdAt: Date;
}

export interface SeasonCount {
  season: string;
  count: number;
}

class DesignerDashboardService {
  /**
   * Get dashboard statistics for a user
   * If userId is provided, filters to user's styles only
   */
  async getDashboardStats(userId?: string): Promise<DashboardStats> {
    try {
      logDebug('Getting dashboard stats', { userId });

      const whereClause = userId ? { createdById: userId, isActive: true } : { isActive: true };

      // Get total count
      const totalStyles = await prisma.styles.count({ where: whereClause });

      // Get counts by status
      const statusCounts = await prisma.styles.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { id: true },
      });

      // Get counts by CAD status
      const cadStatusCounts = await prisma.styles.groupBy({
        by: ['cadStatus'],
        where: whereClause,
        _count: { id: true },
      });

      // Map to expected structure
      const byStatus = {
        DRAFT: 0,
        ACTIVE: 0,
        ARCHIVED: 0,
        IN_DEVELOPMENT: 0,
        APPROVED: 0,
      };

      statusCounts.forEach((item) => {
        if (item.status in byStatus) {
          byStatus[item.status as keyof typeof byStatus] = item._count.id;
        }
      });

      const byCADStatus = {
        PENDING: 0,
        IN_PROGRESS: 0,
        COMPLETED: 0,
        APPROVED: 0,
      };

      cadStatusCounts.forEach((item) => {
        if (item.cadStatus in byCADStatus) {
          byCADStatus[item.cadStatus as keyof typeof byCADStatus] = item._count.id;
        }
      });

      return {
        totalStyles,
        byStatus,
        byCADStatus,
      };
    } catch (error) {
      logError('Failed to get dashboard stats', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get recent styles for a user
   */
  async getRecentStyles(userId?: string, limit: number = 10): Promise<StyleSummary[]> {
    try {
      logDebug('Getting recent styles', { userId, limit });

      const whereClause = userId ? { createdById: userId, isActive: true } : { isActive: true };

      const styles = await prisma.styles.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          styleCode: true,
          buyerStyleRef: true,
          styleName: true,
          status: true,
          imageUrl: true,
          customerName: true,
          brandName: true,
          season: true,
          createdAt: true,
        },
      });

      return styles;
    } catch (error) {
      logError('Failed to get recent styles', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get team activity (recent comments)
   */
  async getTeamActivity(limit: number = 20): Promise<object[]> {
    try {
      logDebug('Getting team activity', { limit });

      const comments = await prisma.style_comments.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          style: {
            select: {
              id: true,
              styleCode: true,
              buyerStyleRef: true,
              styleName: true,
            },
          },
        },
      });

      return comments;
    } catch (error) {
      logError('Failed to get team activity', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get styles grouped by season
   */
  async getStylesBySeason(): Promise<SeasonCount[]> {
    try {
      logDebug('Getting styles by season');

      const seasonCounts = await prisma.styles.groupBy({
        by: ['season'],
        where: { isActive: true },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

      return seasonCounts.map((item) => ({
        season: item.season || 'No Season',
        count: item._count.id,
      }));
    } catch (error) {
      logError('Failed to get styles by season', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get styles by customer
   */
  async getStylesByCustomer(limit: number = 10): Promise<object[]> {
    try {
      logDebug('Getting styles by customer', { limit });

      const customerCounts = await prisma.styles.groupBy({
        by: ['customerName'],
        where: { isActive: true, customerName: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: limit,
      });

      return customerCounts.map((item) => ({
        customerName: item.customerName || 'Unknown',
        count: item._count.id,
      }));
    } catch (error) {
      logError('Failed to get styles by customer', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get user's styles with pagination
   */
  async getMyStyles(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: string
  ): Promise<{ data: StyleSummary[]; pagination: object }> {
    try {
      logDebug('Getting my styles', { userId, page, limit, status });

      const whereClause: Record<string, unknown> = {
        createdById: userId,
        isActive: true,
      };

      if (status) {
        whereClause.status = status;
      }

      const total = await prisma.styles.count({ where: whereClause });
      const skip = (page - 1) * limit;

      const styles = await prisma.styles.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          styleCode: true,
          buyerStyleRef: true,
          styleName: true,
          status: true,
          imageUrl: true,
          customerName: true,
          brandName: true,
          season: true,
          createdAt: true,
        },
      });

      return {
        data: styles,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logError('Failed to get my styles', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get mood boards summary for dashboard
   */
  async getMoodBoardsSummary(userId?: string, limit: number = 5): Promise<object[]> {
    try {
      logDebug('Getting mood boards summary', { userId, limit });

      const whereClause = userId ? { createdById: userId } : {};

      const moodBoards = await prisma.mood_boards.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
          season: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      });

      return moodBoards;
    } catch (error) {
      logError('Failed to get mood boards summary', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

export const designerDashboardService = new DesignerDashboardService();
