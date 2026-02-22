// Database configuration and Prisma client instance
// Note: Environment variables are loaded via -r dotenv/config in package.json dev script

import { PrismaClient } from '@prisma/client';
import { logInfo, logError } from '../utils/logger';

// Validate DATABASE_URL is set
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  logError('DATABASE_URL environment variable is not set!');
  logError('Please set it in your .env file or environment variables.');
  process.exit(1);
}

logInfo('Database Configuration:');
const maskedUrl = DATABASE_URL.replace(/:[^:@]+@/, ':****@');
logInfo(`   Using DATABASE_URL: ${maskedUrl}`);

// Connection pooling configuration
// - connection_limit: Max connections in pool (default 10, we use 20 for concurrent requests)
// - pool_timeout: Seconds to wait for available connection (default 10, we use 30)
// - connect_timeout: Seconds to wait for initial connection (default 5, we use 10)
const poolParams = 'connection_limit=20&pool_timeout=30&connect_timeout=10';
const separator = DATABASE_URL.includes('?') ? '&' : '?';
const pooledUrl = `${DATABASE_URL}${separator}${poolParams}`;

// Create a single instance of Prisma Client with connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: pooledUrl,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

logInfo('✅ Prisma Client created');

// Note: Graceful shutdown is handled in server.ts
// Do not disconnect here as it causes premature exit

export default prisma;
