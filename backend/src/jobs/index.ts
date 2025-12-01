/**
 * Job Queue Module
 *
 * Exports job queue functionality for use throughout the application.
 */

export {
  initializeJobQueue,
  addJob,
  addRecurringJob,
  getJob,
  getJobStatus,
  getQueueStats,
  cleanOldJobs,
  shutdownJobQueue,
  isQueueAvailable,
  registerJobHandler,
} from './queue';

export type {
  JobType,
  JobData,
  JobResult,
  ImportJobData,
  ExportJobData,
  BulkUpdateJobData,
  ReportJobData,
  EmailJobData,
  CleanupJobData,
  NotificationJobData,
} from './queue';

export { registerAllJobHandlers } from './handlers';
