/**
 * Job Handlers
 *
 * Implements the actual processing logic for background jobs.
 */

import { registerJobHandler, JobData, JobResult } from './queue';
import prisma from '../config/database';
import { runAllCleanupTasks } from '../services/file-cleanup.service';
import { cleanupOldAuditLogs, getAuditLogStats } from '../services/audit.service';
import { notificationService } from '../services/notification.service';
import { reportGeneratorService, ReportType } from '../services/report-generator.service';
import { logInfo, logError } from '../utils/logger';

/**
 * Cleanup job handler
 * Handles temp files, orphaned files, and old audit logs
 */
async function handleCleanupJob(data: JobData): Promise<JobResult> {
  if (data.type !== 'cleanup') {
    return { success: false, error: 'Invalid job type' };
  }

  try {
    switch (data.task) {
      case 'temp-files':
      case 'orphaned-files': {
        const results = await runAllCleanupTasks();
        return {
          success: true,
          message: 'Cleanup completed',
          data: results,
        };
      }
      case 'old-audit-logs': {
        // Get stats before cleanup
        const statsBefore = await getAuditLogStats();

        // Default retention: 90 days, can be overridden via data.retentionDays
        const retentionDays = data.retentionDays || 90;
        const deletedCount = await cleanupOldAuditLogs(retentionDays);

        // Get stats after cleanup
        const statsAfter = await getAuditLogStats();

        logInfo(`Audit log cleanup completed: deleted ${deletedCount} records (retention: ${retentionDays} days)`);

        return {
          success: true,
          message: `Deleted ${deletedCount} audit logs older than ${retentionDays} days`,
          data: {
            deletedCount,
            retentionDays,
            beforeCount: statsBefore.totalCount,
            afterCount: statsAfter.totalCount,
            oldestLog: statsAfter.oldestLog,
          },
        };
      }
      default:
        return { success: false, error: 'Unknown cleanup task' };
    }
  } catch (error) {
    logError('Cleanup job failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Import job handler
 * Processes large file imports asynchronously
 */
async function handleImportJob(data: JobData): Promise<JobResult> {
  if (data.type !== 'import') {
    return { success: false, error: 'Invalid job type' };
  }

  try {
    logInfo(`Processing import for module: ${data.module}, file: ${data.filePath}`);

    // TODO: Implement async import processing
    // The import controller handles imports synchronously for now
    // This handler is a placeholder for future async implementation

    return {
      success: true,
      message: 'Import job queued (sync processing via controller)',
      data: {
        module: data.module,
        filePath: data.filePath,
      },
    };
  } catch (error) {
    logError('Import job failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Export job handler
 * Generates large exports asynchronously
 */
async function handleExportJob(data: JobData): Promise<JobResult> {
  if (data.type !== 'export') {
    return { success: false, error: 'Invalid job type' };
  }

  try {
    logInfo(`Processing export for module: ${data.module}, format: ${data.format}`);

    // TODO: Implement async export processing
    // The export controller handles exports synchronously for now
    // This handler is a placeholder for future async implementation

    return {
      success: true,
      message: 'Export job queued (sync processing via controller)',
      data: {
        module: data.module,
        format: data.format,
      },
    };
  } catch (error) {
    logError('Export job failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/*
 * Dead-code removal (2026-08-24, owner-approved): `handleBulkUpdateJob` was removed here.
 * It took a free-form field list from the caller and wrote it straight onto orders /
 * work-orders / POs / masters via updateMany — no validateTransition, no cascades, no
 * audit trail, no authorization. Doubly unreachable: nothing ever enqueued 'bulk-update',
 * and the job queue itself is never bootstrapped at startup (initializeJobQueue /
 * registerAllJobHandlers have no callers — /api/jobs/status always reports unavailable).
 * If the queue is ever bootstrapped for async reports, do NOT reintroduce a raw
 * mass-writer — route bulk changes through the owning services.
 */

/**
 * Report generation job handler
 * Generates PDF/Excel reports asynchronously and notifies user when complete
 */
async function handleReportJob(data: JobData): Promise<JobResult> {
  if (data.type !== 'report') {
    return { success: false, error: 'Invalid job type' };
  }

  try {
    logInfo(`Generating report: ${data.reportType}`, { params: data.params, userId: data.userId });

    const result = await reportGeneratorService.generateReport(
      data.reportType as ReportType,
      {
        format: (data.params.format as 'csv' | 'xlsx' | 'pdf') || 'xlsx',
        ...data.params,
      },
      data.userId
    );

    if (result.success) {
      return {
        success: true,
        message: `Report generated: ${result.fileName}`,
        data: {
          reportType: data.reportType,
          fileName: result.fileName,
          filePath: result.filePath,
          recordCount: result.recordCount,
        },
      };
    } else {
      return {
        success: false,
        error: result.error || 'Report generation failed',
      };
    }
  } catch (error) {
    logError('Report job failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Email job handler
 */
async function handleEmailJob(data: JobData): Promise<JobResult> {
  if (data.type !== 'email') {
    return { success: false, error: 'Invalid job type' };
  }

  try {
    logInfo(`Sending email to: ${Array.isArray(data.to) ? data.to.join(', ') : data.to}`);

    // TODO: Implement email sending via nodemailer or email service
    // This would send emails using templates

    return {
      success: true,
      message: 'Email sent',
    };
  } catch (error) {
    logError('Email job failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Notification job handler
 * Creates in-app notifications for users
 */
async function handleNotificationJob(data: JobData): Promise<JobResult> {
  if (data.type !== 'notification') {
    return { success: false, error: 'Invalid job type' };
  }

  try {
    logInfo(`Sending notification to user: ${data.userId}`);

    const notificationId = await notificationService.create({
      userId: data.userId,
      type: 'INFO',
      title: data.title,
      message: data.message,
      referenceType: data.data?.referenceType as string | undefined,
      referenceId: data.data?.referenceId as string | undefined,
    });

    return {
      success: true,
      message: 'Notification sent',
      data: { notificationId },
    };
  } catch (error) {
    logError('Notification job failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Register all job handlers
 * Call this at application startup after initializing the queue
 */
export function registerAllJobHandlers(): void {
  registerJobHandler('cleanup', handleCleanupJob);
  registerJobHandler('import', handleImportJob);
  registerJobHandler('export', handleExportJob);
  // 'bulk-update' handler deleted 2026-08-24 — see the removal note above
  registerJobHandler('report', handleReportJob);
  registerJobHandler('email', handleEmailJob);
  registerJobHandler('notification', handleNotificationJob);

  logInfo('All job handlers registered');
}

export default { registerAllJobHandlers };
