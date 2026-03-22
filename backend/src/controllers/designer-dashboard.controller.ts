/**
 * Designer Dashboard Controller
 * Handles HTTP requests for design team dashboard
 */
import { Request, Response } from 'express';
import { designerDashboardService } from '../services/designer-dashboard.service';
import { ValidationError } from '../errors';

/**
 * Get dashboard data (combined endpoint)
 * GET /api/designer/dashboard
 */
export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const includeTeam = req.query.includeTeam === 'true';

  // Get stats for the user (or all if includeTeam)
  const stats = await designerDashboardService.getDashboardStats(includeTeam ? undefined : userId);

  // Get recent styles
  const recentStyles = await designerDashboardService.getRecentStyles(includeTeam ? undefined : userId, 10);

  // Get team activity
  const activity = await designerDashboardService.getTeamActivity(10);

  // Get styles by season
  const stylesBySeason = await designerDashboardService.getStylesBySeason();

  // Get mood boards summary
  const moodBoards = await designerDashboardService.getMoodBoardsSummary(includeTeam ? undefined : userId, 5);

  res.status(200).json({
    data: {
      stats,
      recentStyles,
      activity,
      stylesBySeason,
      moodBoards,
    },
  });
};

/**
 * Get team activity feed
 * GET /api/designer/activity
 */
export const getActivity = async (req: Request, res: Response): Promise<void> => {
  const limit = parseInt(req.query.limit as string) || 20;
  const activity = await designerDashboardService.getTeamActivity(limit);

  res.status(200).json({
    data: activity,
  });
};

/**
 * Get user's styles with pagination
 * GET /api/designer/my-styles
 */
export const getMyStyles = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User authentication required');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as string;

  const result = await designerDashboardService.getMyStyles(userId, page, limit, status);

  res.status(200).json({
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * Get styles by season
 * GET /api/designer/styles-by-season
 */
export const getStylesBySeason = async (_req: Request, res: Response): Promise<void> => {
  const data = await designerDashboardService.getStylesBySeason();

  res.status(200).json({
    data,
  });
};

/**
 * Get styles by customer
 * GET /api/designer/styles-by-customer
 */
export const getStylesByCustomer = async (req: Request, res: Response): Promise<void> => {
  const limit = parseInt(req.query.limit as string) || 10;
  const data = await designerDashboardService.getStylesByCustomer(limit);

  res.status(200).json({
    data,
  });
};
