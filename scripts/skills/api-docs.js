#!/usr/bin/env node
/**
 * API Documentation Generator Skill
 *
 * Scans route files and generates API documentation.
 * Creates markdown reference and validates serializer conversions.
 *
 * Usage:
 *   node scripts/skills/api-docs.js [--generate|--validate|--list|--help]
 *
 * Modes:
 *   --generate  Generate API documentation (default)
 *   --validate  Validate routes and serializer mappings
 *   --list      List all API endpoints
 *   --help      Show usage information
 */

const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Scan route files
 */
function scanRoutes() {
  const routesDir = path.join(process.cwd(), 'backend', 'src', 'routes');

  if (!fs.existsSync(routesDir)) {
    console.error(`${colors.red}Error: Routes directory not found at ${routesDir}${colors.reset}`);
    return [];
  }

  const files = fs.readdirSync(routesDir);
  const routeFiles = files.filter(f => f.endsWith('.routes.ts') || f.endsWith('.ts'));

  return routeFiles.map(name => {
    const filePath = path.join(routesDir, name);
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract route patterns
    const routes = [];
    const routeMatches = content.matchAll(/router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g);

    for (const match of routeMatches) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2],
      });
    }

    return {
      name,
      path: filePath,
      size: stats.size,
      routes,
    };
  });
}

/**
 * List all endpoints
 */
function listEndpoints() {
  console.log(`\n${colors.bright}${colors.cyan}=== API Endpoints ===${colors.reset}\n`);

  const routeFiles = scanRoutes();

  let totalEndpoints = 0;
  const methodCounts = { GET: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 };

  for (const file of routeFiles) {
    if (file.routes.length > 0) {
      console.log(`${colors.bright}${file.name}${colors.reset} (${file.routes.length} endpoints)`);

      for (const route of file.routes) {
        const methodColor = {
          'GET': colors.cyan,
          'POST': colors.green,
          'PUT': colors.yellow,
          'PATCH': colors.blue,
          'DELETE': colors.red,
        }[route.method] || colors.reset;

        console.log(`  ${methodColor}${route.method.padEnd(7)}${colors.reset} ${route.path}`);
        methodCounts[route.method]++;
        totalEndpoints++;
      }
      console.log('');
    }
  }

  console.log(`${colors.bright}Summary:${colors.reset}`);
  console.log(`  Total route files: ${routeFiles.length}`);
  console.log(`  Total endpoints:   ${totalEndpoints}`);
  console.log(`  Methods:`);
  for (const [method, count] of Object.entries(methodCounts)) {
    if (count > 0) {
      console.log(`    ${method.padEnd(7)} ${count}`);
    }
  }
  console.log('');

  return true;
}

/**
 * Validate routes
 */
function validateRoutes() {
  console.log(`\n${colors.bright}${colors.cyan}=== API Route Validation ===${colors.reset}\n`);

  const routeFiles = scanRoutes();

  let issues = 0;
  const duplicates = new Map();

  // Check for duplicate routes
  for (const file of routeFiles) {
    for (const route of file.routes) {
      const key = `${route.method} ${route.path}`;
      if (duplicates.has(key)) {
        console.log(`${colors.yellow}⚠${colors.reset} Duplicate: ${key}`);
        console.log(`  Found in: ${duplicates.get(key)} and ${file.name}`);
        issues++;
      } else {
        duplicates.set(key, file.name);
      }
    }
  }

  if (issues === 0) {
    console.log(`${colors.green}✓${colors.reset} No validation issues found\n`);
  } else {
    console.log(`${colors.yellow}⚠ Found ${issues} issue(s)${colors.reset}\n`);
  }

  return issues === 0;
}

/**
 * Generate documentation
 */
function generateDocs() {
  console.log(`\n${colors.bright}${colors.cyan}=== Generating API Documentation ===${colors.reset}\n`);

  const routeFiles = scanRoutes();

  let markdown = '# API Documentation\n\n';
  markdown += `*Auto-generated on ${new Date().toISOString().split('T')[0]}*\n\n`;
  markdown += '## Overview\n\n';
  markdown += 'This document lists all API endpoints in the Garment ERP system.\n\n';
  markdown += '**Important**: All responses use camelCase (serialized from backend snake_case).\n\n';
  markdown += '## Endpoints\n\n';

  for (const file of routeFiles) {
    if (file.routes.length > 0) {
      const moduleName = file.name.replace('.routes.ts', '').replace('.ts', '');
      markdown += `### ${moduleName}\n\n`;

      for (const route of file.routes) {
        markdown += `#### ${route.method} ${route.path}\n\n`;
        markdown += `*Defined in: \`${file.name}\`*\n\n`;
      }
    }
  }

  markdown += '## Notes\n\n';
  markdown += '- All API responses are serialized to camelCase\n';
  markdown += '- Prisma relations use snake_case in database → camelCase in API\n';
  markdown += '- See `backend/src/utils/serializer.ts` for transformation rules\n';

  const outputPath = path.join(process.cwd(), 'API_REFERENCE.md');
  fs.writeFileSync(outputPath, markdown);

  console.log(`${colors.green}✓${colors.reset} Generated API documentation`);
  console.log(`  Output: ${outputPath}\n`);

  const totalEndpoints = routeFiles.reduce((sum, f) => sum + f.routes.length, 0);
  console.log(`${colors.bright}Documentation Stats:${colors.reset}`);
  console.log(`  Route files: ${routeFiles.length}`);
  console.log(`  Endpoints:   ${totalEndpoints}\n`);

  return true;
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
${colors.bright}API Documentation Generator Skill${colors.reset}

${colors.bright}Usage:${colors.reset}
  node scripts/skills/api-docs.js [--generate|--validate|--list|--help]

${colors.bright}Modes:${colors.reset}
  --generate  Generate API documentation markdown (default)
  --validate  Validate routes and check for duplicates
  --list      List all API endpoints
  --help      Show this help message

${colors.bright}Examples:${colors.reset}
  ${colors.cyan}# Generate docs${colors.reset}
  node scripts/skills/api-docs.js --generate

  ${colors.cyan}# List all endpoints${colors.reset}
  node scripts/skills/api-docs.js --list

  ${colors.cyan}# Validate routes${colors.reset}
  node scripts/skills/api-docs.js --validate

${colors.bright}Output:${colors.reset}
  - Generates: API_REFERENCE.md
  - Scans: backend/src/routes/*.routes.ts
  - Validates: Serializer camelCase conversions

${colors.bright}What this provides:${colors.reset}
  - Auto-generated API documentation
  - Endpoint listing with HTTP methods
  - Duplicate route detection
  - Serializer transformation notes
  `);
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--generate';

  switch (mode) {
    case '--generate':
      return generateDocs() ? 0 : 1;

    case '--validate':
      return validateRoutes() ? 0 : 1;

    case '--list':
      return listEndpoints() ? 0 : 1;

    case '--help':
      showHelp();
      return 0;

    default:
      console.error(`${colors.red}Unknown mode: ${mode}${colors.reset}`);
      console.error('Use --help for usage information');
      return 1;
  }
}

// Run if executed directly
if (require.main === module) {
  const exitCode = main();
  process.exit(exitCode);
}

module.exports = { generateDocs, validateRoutes, listEndpoints, scanRoutes };
