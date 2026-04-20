/**
 * Notification Controller
 * HTTP handlers for notification endpoints
 */

import { Request, Response } from 'express';
import { notificationService } from '../services/notification.service';
import { UnauthorizedError, NotFoundError } from '../errors';

/**
 * Get notifications for the current user
 * GET /api/notifications
 */
export async function getNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const unreadOnly = req.query.unreadOnly === 'true';

  const result = await notificationService.getForUser(userId, {
    page,
    limit,
    unreadOnly,
  });

  res.status(200).json(result);
}

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const count = await notificationService.getUnreadCount(userId);

  res.status(200).json({ unreadCount: count });
}

/**
 * Mark a notification as read
 * PATCH /api/notifications/:id/read
 */
export async function markAsRead(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { id } = req.params;
  const success = await notificationService.markAsRead(id, userId);

  if (!success) {
    throw new NotFoundError('Notification', id);
  }

  res.status(200).json({ success: true, message: 'Notification marked as read' });
}

/**
 * Mark all notifications as read
 * POST /api/notifications/mark-all-read
 */
export async function markAllAsRead(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const count = await notificationService.markAllAsRead(userId);

  res.status(200).json({
    success: true,
    message: `Marked ${count} notifications as read`,
    markedCount: count,
  });
}

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
export async function deleteNotification(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { id } = req.params;
  const success = await notificationService.delete(id, userId);

  if (!success) {
    throw new NotFoundError('Notification', id);
  }

  res.status(200).json({ success: true, message: 'Notification deleted' });
}
