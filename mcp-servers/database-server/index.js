#!/usr/bin/env node

/**
 * Database Query MCP Server
 *
 * Provides read-only database insights:
 * - Execute read-only queries for debugging
 * - Show table statistics (row counts, index usage)
 * - Validate seed data
 * - Performance analysis (slow queries)
 *
 * SECURITY: This server only executes READ-ONLY queries
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

class DatabaseQueryServer {
  constructor() {
    this.isReadOnly = true; // ENFORCE READ-ONLY MODE
  }

  /**
   * Execute a read-only query using Prisma
   */
  async executeQuery(query, params = []) {
    // SECURITY: Block any non-SELECT queries
    const sanitizedQuery = query.trim().toUpperCase();

    if (!sanitizedQuery.startsWith('SELECT')) {
      return {
        error: 'Only SELECT queries are allowed (read-only mode)',
        blocked: true
      };
    }

    // Block destructive keywords
    const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'TRUNCATE', 'ALTER', 'CREATE'];
    for (const keyword of dangerousKeywords) {
      if (sanitizedQuery.includes(keyword)) {
        return {
          error: `Dangerous keyword detected: ${keyword}. Read-only mode enforced.`,
          blocked: true
        };
      }
    }

    try {
      // Use Prisma raw query
      const command = `cd backend && npx ts-node -e "import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); prisma.\\$queryRawUnsafe('${query.replace(/'/g, "\\'")}').then(r => console.log(JSON.stringify(r))).catch(e => console.error('ERROR:', e.message)).finally(() => prisma.\\$disconnect());"`;

      const result = execSync(command, { encoding: 'utf-8' });
      const output = result.trim();

      // Parse JSON result
      if (output.startsWith('[') || output.startsWith('{')) {
        return {
          success: true,
          data: JSON.parse(output),
          rowCount: JSON.parse(output).length
        };
      } else if (output.includes('ERROR:')) {
        return {
          error: output.replace('ERROR:', '').trim(),
          success: false
        };
      }

      return { success: true, data: output };
    } catch (error) {
      return {
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Get table statistics
   */
  getTableStats(tableName = null) {
    try {
      let query;

      if (tableName) {
        // Stats for specific table
        query = `SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
          pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = '${tableName}'`;
      } else {
        // Stats for all tables
        query = `SELECT
          tablename,
          pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.tablename) AS column_count
        FROM pg_tables t
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size('public.'||tablename) DESC
        LIMIT 20`;
      }

      const command = `cd backend && npx prisma db execute --stdin < <(echo "${query}")`;
      const result = execSync(command, { encoding: 'utf-8', shell: '/bin/bash' });

      return {
        success: true,
        stats: result
      };
    } catch (error) {
      // Fallback: Get row counts using Prisma
      return this.getRowCounts();
    }
  }

  /**
   * Get row counts for all tables
   */
  getRowCounts() {
    try {
      const schemaPath = path.join(process.cwd(), 'backend', 'prisma', 'schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

      // Extract model names
      const modelRegex = /model\s+(\w+)\s*{/g;
      const models = [];
      let match;

      while ((match = modelRegex.exec(schemaContent)) !== null) {
        models.push(match[1]);
      }

      // Get counts using Prisma
      const counts = {};
      const modelCounts = [];

      for (const model of models.slice(0, 20)) { // Limit to first 20 for performance
        try {
          const command = `cd backend && npx ts-node -e "import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); prisma.${model}.count().then(c => console.log(c)).catch(() => console.log(0)).finally(() => prisma.\\$disconnect());"`;
          const count = parseInt(execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()) || 0;
          counts[model] = count;
          modelCounts.push({ model, count });
        } catch (error) {
          // Skip models that can't be counted
          counts[model] = 0;
        }
      }

      // Sort by count descending
      modelCounts.sort((a, b) => b.count - a.count);

      return {
        success: true,
        totalModels: models.length,
        counts,
        topTables: modelCounts.slice(0, 10)
      };
    } catch (error) {
      return {
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Validate seed data
   */
  validateSeedData() {
    const validation = {
      requiredData: [],
      missing: [],
      present: []
    };

    // Define required seed data
    const requiredModels = [
      { model: 'users', minCount: 1, description: 'Admin user should exist' },
      { model: 'roles', minCount: 1, description: 'At least one role' }
    ];

    try {
      for (const req of requiredModels) {
        const command = `cd backend && npx ts-node -e "import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); prisma.${req.model}.count().then(c => console.log(c)).catch(() => console.log(0)).finally(() => prisma.\\$disconnect());"`;
        const count = parseInt(execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()) || 0;

        if (count >= req.minCount) {
          validation.present.push({
            ...req,
            currentCount: count,
            status: 'OK'
          });
        } else {
          validation.missing.push({
            ...req,
            currentCount: count,
            status: 'MISSING'
          });
        }
      }

      return {
        success: true,
        validation,
        allPresent: validation.missing.length === 0
      };
    } catch (error) {
      return {
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Get database connection info
   */
  getConnectionInfo() {
    try {
      // Read DATABASE_URL from .env
      const envPath = path.join(process.cwd(), 'backend', '.env');
      if (!fs.existsSync(envPath)) {
        return { error: '.env file not found' };
      }

      const envContent = fs.readFileSync(envPath, 'utf-8');
      const dbUrlMatch = envContent.match(/DATABASE_URL\s*=\s*["']?([^"'\n]+)["']?/);

      if (!dbUrlMatch) {
        return { error: 'DATABASE_URL not found in .env' };
      }

      const dbUrl = dbUrlMatch[1];

      // Parse connection string (hide password)
      const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

      if (urlMatch) {
        return {
          success: true,
          connection: {
            user: urlMatch[1],
            password: '***hidden***',
            host: urlMatch[3],
            port: urlMatch[4],
            database: urlMatch[5]
          }
        };
      }

      return { error: 'Could not parse DATABASE_URL' };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Handle MCP requests
   */
  handleRequest(request) {
    const { method, params } = request;

    switch (method) {
      case 'executeQuery':
        return this.executeQuery(params.query, params.params);

      case 'tableStats':
        return this.getTableStats(params.tableName);

      case 'rowCounts':
        return this.getRowCounts();

      case 'validateSeed':
        return this.validateSeedData();

      case 'connectionInfo':
        return this.getConnectionInfo();

      default:
        return { error: `Unknown method: ${method}` };
    }
  }
}

// CLI interface
if (require.main === module) {
  const server = new DatabaseQueryServer();

  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log(`${colors.bright}${colors.blue}=== Database Query MCP Server ===${colors.reset}`);
  console.log(`${colors.yellow}⚠ READ-ONLY MODE ENFORCED${colors.reset}\n`);

  switch (command) {
    case 'counts':
      console.log(`${colors.green}Fetching row counts...${colors.reset}\n`);
      const counts = server.getRowCounts();

      if (counts.success) {
        console.log(`${colors.bright}Top 10 tables by row count:${colors.reset}`);
        counts.topTables.forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.model}: ${t.count.toLocaleString()} rows`);
        });
        console.log(`\n${colors.blue}Total models: ${counts.totalModels}${colors.reset}`);
      } else {
        console.log(`${colors.red}Error: ${counts.error}${colors.reset}`);
      }
      break;

    case 'validate':
      console.log(`${colors.green}Validating seed data...${colors.reset}\n`);
      const validation = server.validateSeedData();

      if (validation.success) {
        if (validation.allPresent) {
          console.log(`${colors.green}✓ All required seed data present${colors.reset}\n`);
        } else {
          console.log(`${colors.yellow}⚠ Missing seed data:${colors.reset}`);
          validation.validation.missing.forEach(m => {
            console.log(`  - ${m.model}: ${m.description}`);
            console.log(`    Current: ${m.currentCount}, Required: ${m.minCount}`);
          });
        }

        if (validation.validation.present.length > 0) {
          console.log(`\n${colors.green}Present seed data:${colors.reset}`);
          validation.validation.present.forEach(p => {
            console.log(`  ✓ ${p.model}: ${p.currentCount} rows`);
          });
        }
      } else {
        console.log(`${colors.red}Error: ${validation.error}${colors.reset}`);
      }
      break;

    case 'connection':
      console.log(`${colors.green}Database connection info:${colors.reset}\n`);
      const connInfo = server.getConnectionInfo();

      if (connInfo.success) {
        console.log(`  Host: ${connInfo.connection.host}`);
        console.log(`  Port: ${connInfo.connection.port}`);
        console.log(`  Database: ${connInfo.connection.database}`);
        console.log(`  User: ${connInfo.connection.user}`);
        console.log(`  Password: ${connInfo.connection.password}`);
      } else {
        console.log(`${colors.red}Error: ${connInfo.error}${colors.reset}`);
      }
      break;

    case 'help':
    default:
      console.log('Available commands:');
      console.log('  counts - Show row counts for all tables');
      console.log('  validate - Validate seed data presence');
      console.log('  connection - Show database connection info');
      console.log('  help - Show this help');
      console.log('\nNote: Direct SQL queries not available via CLI');
      console.log('Use MCP handleRequest with executeQuery method');
      break;
  }
}

module.exports = DatabaseQueryServer;
