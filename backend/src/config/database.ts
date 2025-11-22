// Database configuration and Prisma client instance

// CRITICAL: Force local database URL for Indian setup
// This MUST be set before any imports or environment loading
const FORCED_LOCAL_DB_URL = 'postgresql://postgres:postgres@localhost:5432/garment_erp';

// Override any environment variables that might have been set
process.env.DATABASE_URL = FORCED_LOCAL_DB_URL;

import { PrismaClient } from '@prisma/client';
import { logInfo } from '../utils/logger';

logInfo('🔧 Database Configuration (FORCED LOCAL):');
logInfo('   Using DATABASE_URL:', FORCED_LOCAL_DB_URL.replace(/:[^:@]+@/, ':****@'));

// Create a single instance of Prisma Client
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: FORCED_LOCAL_DB_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Note: Graceful shutdown is handled in server.ts
// Do not disconnect here as it causes premature exit

export default prisma;
