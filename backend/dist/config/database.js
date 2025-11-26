"use strict";
// Database configuration and Prisma client instance
Object.defineProperty(exports, "__esModule", { value: true });
// CRITICAL: Force local database URL for Indian setup
// This MUST be set before any imports or environment loading
const FORCED_LOCAL_DB_URL = 'postgresql://postgres:postgres@localhost:5432/garment_erp';
// Override any environment variables that might have been set
process.env.DATABASE_URL = FORCED_LOCAL_DB_URL;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
(0, logger_1.logInfo)('🔧 Database Configuration (FORCED LOCAL):');
(0, logger_1.logInfo)('   Using DATABASE_URL:', FORCED_LOCAL_DB_URL.replace(/:[^:@]+@/, ':****@'));
// Create a single instance of Prisma Client
const prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: FORCED_LOCAL_DB_URL,
        },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
// Note: Graceful shutdown is handled in server.ts
// Do not disconnect here as it causes premature exit
exports.default = prisma;
// Force restart Mon, Nov 24, 2025  5:05:23 PM
