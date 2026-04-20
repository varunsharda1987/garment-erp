/**
 * Notification Service
 * Handles in-app notification CRUD operations
 */

import { NotificationType, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logInfo, logDebug } from '../utils/logger';
import { randomUUID } from 'crypto';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceType?: string;
  referenceId?: string;
}

export interface NotificationQueryParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export interface PaginatedNotifications {
  data: Array<{
    id: string;
    userId: string;
    notificationType: NotificationType;
    title: string;
    message: string;
    referenceType: string | null;
    referenceId: string | null;
    isRead: boolean;
    sentAt: Date;
    readAt: Date | null;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}

class NotificationService {
  /**
   * Create a new notification
   */
  async create(input: CreateNotificationInput): Promise<string> {
    const id = randomUUID();

    await prisma.notifications.create({
      data: {
        id,
        userId: input.userId,
        notificationType: input.type,
        title: input.title,
        message: input.message,
        referenceType: input.referenceType || null,
        referenceId: input.referenceId || null,
        isRead: false,
        sentAt: new Date(),
      },
    });

    logDebug(`Created notification ${id} for user ${input.userId}`);
    return id;
  }

  /**
   * Create notifications for multiple users
   */
  async createBulk(userIds: string[], notification: Omit<CreateNotificationInput, 'userId'>): Promise<number> {
    const notifications = userIds.map((userId) => ({
      id: randomUUID(),
      userId,
      notificationType: notification.type,
      title: notification.title,
      message: notification.message,
      referenceType: notification.referenceType || null,
      referenceId: notification.referenceId || null,
      isRead: false,
      sentAt: new Date(),
    }));

    const result = await prisma.notifications.createMany({
      data: notifications,
    });

    logInfo(`Created ${result.count} notifications for ${userIds.length} users`);
    return result.count;
  }

  /**
   * Get notifications for a user with pagination
   */
  async getForUser(userId: string, params: NotificationQueryParams = {}): Promise<PaginatedNotifications> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.notificationsWhereInput = {
      userId,
      ...(params.unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notifications.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
      }),
      prisma.notifications.count({ where }),
      prisma.notifications.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notifications.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await prisma.notifications.updateMany({
      where: {
        id: notificationId,
        userId, // Ensure user owns this notification
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return result.count > 0;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notifications.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    logInfo(`Marked ${result.count} notifications as read for user ${userId}`);
    return result.count;
  }

  /**
   * Delete a notification
   */
  async delete(notificationId: string, userId: string): Promise<boolean> {
    const result = await prisma.notifications.deleteMany({
      where: {
        id: notificationId,
        userId, // Ensure user owns this notification
      },
    });

    return result.count > 0;
  }

  /**
   * Delete old notifications (cleanup job)
   */
  async deleteOldNotifications(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.notifications.deleteMany({
      where: {
        sentAt: { lt: cutoffDate },
        isRead: true, // Only delete read notifications
      },
    });

    logInfo(`Deleted ${result.count} old notifications (older than ${daysToKeep} days)`);
    return result.count;
  }

  /**
   * Helper: Send system notification to all admins
   */
  async notifyAdmins(
    title: string,
    message: string,
    type: NotificationType = 'INFO',
    reference?: { type: string; id: string }
  ): Promise<number> {
    const admins = await prisma.users.findMany({
      where: {
        role: 'ADMIN',
        isActive: true,
      },
      select: { id: true },
    });

    if (admins.length === 0) return 0;

    return this.createBulk(
      admins.map((a) => a.id),
      {
        type,
        title,
        message,
        referenceType: reference?.type,
        referenceId: reference?.id,
      }
    );
  }

  /**
   * Helper: Send notification to users with specific role
   */
  async notifyByRole(
    role: string,
    title: string,
    message: string,
    type: NotificationType = 'INFO',
    reference?: { type: string; id: string }
  ): Promise<number> {
    const users = await prisma.users.findMany({
      where: {
        role: role as any,
        isActive: true,
      },
      select: { id: true },
    });

    if (users.length === 0) return 0;

    return this.createBulk(
      users.map((u) => u.id),
      {
        type,
        title,
        message,
        referenceType: reference?.type,
        referenceId: reference?.id,
      }
    );
  }
}

export const notificationService = new NotificationService();
export default notificationService;
