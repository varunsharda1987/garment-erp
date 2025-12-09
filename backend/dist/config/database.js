"use strict";
// Database configuration and Prisma client instance
// Note: Environment variables are loaded via -r dotenv/config in package.json dev script
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
// Validate DATABASE_URL is set
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    (0, logger_1.logError)('DATABASE_URL environment variable is not set!');
    (0, logger_1.logError)('Please set it in your .env file or environment variables.');
    process.exit(1);
}
(0, logger_1.logInfo)('Database Configuration:');
(0, logger_1.logInfo)('   Using DATABASE_URL:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
// Create a single instance of Prisma Client
const prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
// Note: Graceful shutdown is handled in server.ts
// Do not disconnect here as it causes premature exit
exports.default = prisma;
