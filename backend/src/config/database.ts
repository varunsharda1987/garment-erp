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
logInfo('   Using DATABASE_URL:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

// Create a single instance of Prisma Client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Note: Graceful shutdown is handled in server.ts
// Do not disconnect here as it causes premature exit

export default prisma;
