/**
 * Background Job Queue
 *
 * Uses BullMQ for reliable job processing with Redis.
 * Handles long-running operations like:
 * - Large file imports/exports
 * - Report generation
 * - Bulk operations
 * - Email sending
 */

import { Queue, Worker, Job, QueueEvents, ConnectionOptions } from 'bullmq';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

// Redis connection config from environment
const getRedisConnection = (): ConnectionOptions => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
});

// Check if Redis is configured
const isRedisConfigured = (): boolean => {
  return process.env.REDIS_ENABLED === 'true' || !!process.env.REDIS_HOST || process.env.NODE_ENV === 'production';
};

// Job types
export type JobType = 'import' | 'export' | 'bulk-update' | 'report' | 'email' | 'cleanup' | 'notification';

// Job data interfaces
export interface ImportJobData {
  type: 'import';
  module: string;
  filePath: string;
  userId: string;
  options?: Record<string, unknown>;
}

export interface ExportJobData {
  type: 'export';
  module: string;
  filters?: Record<string, unknown>;
  format: 'csv' | 'xlsx' | 'json';
  userId: string;
}

export interface BulkUpdateJobData {
  type: 'bulk-update';
  module: string;
  ids: string[];
  updates: Record<string, unknown>;
  userId: string;
}

export interface ReportJobData {
  type: 'report';
  reportType: string;
  params: Record<string, unknown>;
  userId: string;
}

export interface EmailJobData {
  type: 'email';
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export interface CleanupJobData {
  type: 'cleanup';
  task: 'temp-files' | 'orphaned-files' | 'old-audit-logs';
}

export interface NotificationJobData {
  type: 'notification';
  userId: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export type JobData =
  | ImportJobData
  | ExportJobData
  | BulkUpdateJobData
  | ReportJobData
  | EmailJobData
  | CleanupJobData
  | NotificationJobData;

// Job result interface
export interface JobResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

// Job handlers map
const jobHandlers: Map<JobType, (data: JobData) => Promise<JobResult>> = new Map();

// Queue instance (singleton)
let mainQueue: Queue | null = null;
let mainWorker: Worker | null = null;
let queueEvents: QueueEvents | null = null;

/**
 * Initialize the job queue (call once at startup)
 */
export async function initializeJobQueue(): Promise<boolean> {
  if (!isRedisConfigured()) {
    logWarn('Redis not configured - background jobs disabled. Set REDIS_ENABLED=true to enable.');
    return false;
  }

  try {
    const connection = getRedisConnection();

    // Create main queue
    mainQueue = new Queue('garment-erp-jobs', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    // Create worker to process jobs
    mainWorker = new Worker(
      'garment-erp-jobs',
      async (job: Job<JobData>) => {
        logDebug(`Processing job ${job.id}: ${job.data.type}`);

        const handler = jobHandlers.get(job.data.type as JobType);
        if (!handler) {
          throw new Error(`No handler registered for job type: ${job.data.type}`);
        }

        try {
          const result = await handler(job.data);
          logDebug(`Job ${job.id} completed:`, result);
          return result;
        } catch (error) {
          logError(`Job ${job.id} failed:`, error);
          throw error;
        }
      },
      {
        connection,
        concurrency: parseInt(process.env.JOB_CONCURRENCY || '5', 10),
      }
    );

    // Set up event listeners
    queueEvents = new QueueEvents('garment-erp-jobs', { connection });

    mainWorker.on('completed', (job) => {
      logInfo(`Job ${job.id} completed`);
    });

    mainWorker.on('failed', (job, error) => {
      logError(`Job ${job?.id} failed:`, error);
    });

    mainWorker.on('error', (error) => {
      logError('Worker error:', error);
    });

    logInfo('Job queue initialized successfully');
    return true;
  } catch (error) {
    logError('Failed to initialize job queue:', error);
    return false;
  }
}

/**
 * Register a job handler
 */
export function registerJobHandler(type: JobType, handler: (data: JobData) => Promise<JobResult>): void {
  jobHandlers.set(type, handler);
  logDebug(`Registered handler for job type: ${type}`);
}

/**
 * Add a job to the queue
 */
export async function addJob(
  data: JobData,
  options?: {
    priority?: number;
    delay?: number;
    jobId?: string;
  }
): Promise<Job<JobData> | null> {
  if (!mainQueue) {
    logWarn('Job queue not initialized - running job synchronously');
    // Fall back to synchronous execution if queue not available
    const handler = jobHandlers.get(data.type as JobType);
    if (handler) {
      try {
        await handler(data);
      } catch (error) {
        logError('Synchronous job execution failed:', error);
      }
    }
    return null;
  }

  try {
    const job = await mainQueue.add(data.type, data, {
      priority: options?.priority,
      delay: options?.delay,
      jobId: options?.jobId,
    });
    logDebug(`Added job ${job.id} of type ${data.type}`);
    return job;
  } catch (error) {
    logError('Failed to add job:', error);
    return null;
  }
}

/**
 * Add a recurring/scheduled job
 */
export async function addRecurringJob(
  name: string,
  data: JobData,
  pattern: string // Cron pattern like '0 0 * * *' (daily at midnight)
): Promise<void> {
  if (!mainQueue) {
    logWarn('Job queue not initialized - cannot schedule recurring job');
    return;
  }

  try {
    await mainQueue.add(name, data, {
      repeat: {
        pattern,
      },
    });
    logInfo(`Scheduled recurring job: ${name} with pattern: ${pattern}`);
  } catch (error) {
    logError('Failed to add recurring job:', error);
  }
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job<JobData> | null> {
  if (!mainQueue) return null;
  const job = await mainQueue.getJob(jobId);
  return job || null;
}

/**
 * Get job status
 */
export async function getJobStatus(
  jobId: string
): Promise<{ state: string; progress: number; result?: JobResult } | null> {
  const job = await getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress as number;
  const result = job.returnvalue as JobResult | undefined;

  return { state, progress, result };
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
} | null> {
  if (!mainQueue) return null;

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    mainQueue.getWaitingCount(),
    mainQueue.getActiveCount(),
    mainQueue.getCompletedCount(),
    mainQueue.getFailedCount(),
    mainQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Clean up old jobs
 */
export async function cleanOldJobs(maxAge: number = 7 * 24 * 3600 * 1000): Promise<void> {
  if (!mainQueue) return;

  const timestamp = Date.now() - maxAge;
  await mainQueue.clean(timestamp, 1000, 'completed');
  await mainQueue.clean(timestamp, 1000, 'failed');
  logInfo('Cleaned old jobs from queue');
}

/**
 * Shutdown the queue gracefully
 */
export async function shutdownJobQueue(): Promise<void> {
  if (mainWorker) {
    await mainWorker.close();
    logInfo('Worker closed');
  }
  if (queueEvents) {
    await queueEvents.close();
  }
  if (mainQueue) {
    await mainQueue.close();
    logInfo('Queue closed');
  }
}

/**
 * Check if queue is available
 */
export function isQueueAvailable(): boolean {
  return mainQueue !== null;
}

export default {
  initializeJobQueue,
  registerJobHandler,
  addJob,
  addRecurringJob,
  getJob,
  getJobStatus,
  getQueueStats,
  cleanOldJobs,
  shutdownJobQueue,
  isQueueAvailable,
};
