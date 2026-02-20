/**
 * Documentation Validator Script
 * Validates documentation coverage and accuracy
 *
 * Usage:
 *   npx ts-node backend/scripts/doc-validator.ts [--controllers|--endpoints|--links|--materials]
 *
 * Modes:
 *   --all          Run all validations (default)
 *   --controllers  Controller coverage only
 *   --endpoints    API endpoint coverage only
 *   --links        Link validation only
 *   --materials    Material types count validation
 *   --help         Show usage information
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Configuration
// ============================================

const CONFIG = {
  backend: {
    controllers: 'backend/src/controllers',
    routes: 'backend/src/routes',
    schema: 'backend/prisma/schema.prisma',
  },
  docs: {
    folder: 'docs',
    materialsGuide: 'docs/MATERIALS_MASTER_GUIDE.md',
  },
  thresholds: {
    controllerCoverage: 50, // 50% minimum
    endpointCoverage: 30,   // 30% minimum
  },
};

// ============================================
// Types
// ============================================

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
}

interface ControllerInfo {
  filename: string;
  path: string;
}

interface EndpointInfo {
  method: string;
  path: string;
  file: string;
}

interface LinkInfo {
  file: string;
  line: number;
  link: string;
  isBroken: boolean;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Read file synchronously
 */
function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    return '';
  }
}

/**
 * Check if file exists
 */
function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Get all files matching pattern (simple implementation)
 */
async function getFiles(pattern: string): Promise<string[]> {
  try {
    // Extract directory and file pattern from glob pattern
    // e.g., "backend/src/controllers/*.controller.ts" -> dir: "backend/src/controllers", pattern: "*.controller.ts"
    // Normalize path separators for Windows
    const normalizedPattern = pattern.replace(/\\/g, '/');
    const parts = normalizedPattern.split('/');
    const filePattern = parts.pop() || '';
    const dir = parts.join(path.sep);

    if (!fs.existsSync(dir)) {
      console.warn(`Directory not found: ${dir}`);
      return [];
    }

    const files = fs.readdirSync(dir);
    const regex = new RegExp('^' + filePattern.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$');

    return files
      .filter(file => {
        const stats = fs.statSync(path.join(dir, file));
        return stats.isFile() && regex.test(file);
      })
      .map(file => path.join(dir, file).replace(/\\/g, '/'));
  } catch (error) {
    console.error(`Error finding files: ${error}`);
    return [];
  }
}

/**
 * Recursively get all markdown files from directory
 */
async function getMarkdownFiles(dir: string): Promise<string[]> {
  try {
    if (!fs.existsSync(dir)) {
      return [];
    }

    const results: string[] = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const subFiles = await getMarkdownFiles(fullPath);
        results.push(...subFiles);
      } else if (item.endsWith('.md')) {
        results.push(fullPath);
      }
    }

    return results;
  } catch (error) {
    console.error(`Error finding markdown files: ${error}`);
    return [];
  }
}

/**
 * Extract markdown links from content
 */
function extractMarkdownLinks(content: string, filePath: string): LinkInfo[] {
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: LinkInfo[] = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    let match;
    while ((match = linkPattern.exec(line)) !== null) {
      const linkPath = match[2];

      // Skip external links (http://, https://, mailto:)
      if (linkPath.startsWith('http://') || linkPath.startsWith('https://') || linkPath.startsWith('mailto:')) {
        continue;
      }

      // Skip anchor-only links (#section)
      if (linkPath.startsWith('#')) {
        continue;
      }

      links.push({
        file: filePath,
        line: index + 1,
        link: linkPath,
        isBroken: false, // Will be determined later
      });
    }
  });

  return links;
}

/**
 * Resolve relative link path
 */
function resolveLinkPath(fromFile: string, linkPath: string): string {
  const fromDir = path.dirname(fromFile);

  // Remove anchor if present
  const pathWithoutAnchor = linkPath.split('#')[0];

  // Resolve relative path
  const resolved = path.join(fromDir, pathWithoutAnchor);
  return resolved;
}

// ============================================
// Validator Class
// ============================================

class DocValidator {

  // ============================================
  // 1. Controller Coverage Validation
  // ============================================

  async validateControllerCoverage(): Promise<ValidationResult> {
    console.log('\n📊 Validating Controller Coverage...\n');

    // Get all controller files
    const controllerFiles = await getFiles(`${CONFIG.backend.controllers}/*.controller.ts`);
    const controllers: ControllerInfo[] = controllerFiles.map(file => ({
      filename: path.basename(file),
      path: file,
    }));

    // Get all documentation files
    const docFiles = await getMarkdownFiles(CONFIG.docs.folder);

    // Check which controllers are mentioned in docs
    const documented: string[] = [];
    const undocumented: string[] = [];

    for (const controller of controllers) {
      let isDocumented = false;

      for (const docFile of docFiles) {
        const content = readFile(docFile);
        if (content.includes(controller.filename)) {
          isDocumented = true;
          break;
        }
      }

      if (isDocumented) {
        documented.push(controller.filename);
      } else {
        undocumented.push(controller.filename);
      }
    }

    const coverage = (documented.length / controllers.length) * 100;
    const passed = coverage >= CONFIG.thresholds.controllerCoverage;

    console.log(`📁 Total Controllers: ${controllers.length}`);
    console.log(`✅ Documented: ${documented.length} (${coverage.toFixed(1)}%)`);
    console.log(`❌ Undocumented: ${undocumented.length}\n`);

    if (undocumented.length > 0 && undocumented.length <= 20) {
      console.log('Undocumented Controllers:');
      undocumented.forEach(name => console.log(`  - ${name}`));
      console.log('');
    } else if (undocumented.length > 20) {
      console.log(`First 20 Undocumented Controllers:`);
      undocumented.slice(0, 20).forEach(name => console.log(`  - ${name}`));
      console.log(`  ... and ${undocumented.length - 20} more\n`);
    }

    return {
      passed,
      message: `Controller Coverage: ${coverage.toFixed(1)}% (Threshold: ${CONFIG.thresholds.controllerCoverage}%)`,
      details: {
        total: controllers.length,
        documented: documented.length,
        undocumented: undocumented.length,
        coverage: coverage.toFixed(1),
        undocumentedList: undocumented,
      },
    };
  }

  // ============================================
  // 2. API Endpoint Inventory
  // ============================================

  async validateAPIEndpoints(): Promise<ValidationResult> {
    console.log('\n🌐 Validating API Endpoint Coverage...\n');

    // Get all route files
    const routeFiles = await getFiles(`${CONFIG.backend.routes}/*.routes.ts`);
    const endpoints: EndpointInfo[] = [];

    // Parse route files for endpoints
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];

    for (const routeFile of routeFiles) {
      const content = readFile(routeFile);
      const lines = content.split('\n');

      for (const line of lines) {
        // Match: router.get('/path', ...)
        for (const method of httpMethods) {
          const regex = new RegExp(`router\\.${method}\\(['"]([^'"]+)['"]`, 'i');
          const match = line.match(regex);

          if (match) {
            endpoints.push({
              method: method.toUpperCase(),
              path: match[1],
              file: path.basename(routeFile),
            });
          }
        }
      }
    }

    // Check which endpoints are documented
    const docFiles = await getFiles(`${CONFIG.docs.folder}/**/*.md`);
    let documentedEndpoints = 0;

    for (const endpoint of endpoints) {
      for (const docFile of docFiles) {
        const content = readFile(docFile);
        // Check if endpoint path is mentioned
        if (content.includes(endpoint.path)) {
          documentedEndpoints++;
          break;
        }
      }
    }

    const coverage = endpoints.length > 0 ? (documentedEndpoints / endpoints.length) * 100 : 0;
    const passed = coverage >= CONFIG.thresholds.endpointCoverage;

    console.log(`🔗 Total API Endpoints: ${endpoints.length}`);
    console.log(`✅ Documented: ${documentedEndpoints} (${coverage.toFixed(1)}%)`);
    console.log(`❌ Undocumented: ${endpoints.length - documentedEndpoints}\n`);

    return {
      passed,
      message: `API Endpoint Coverage: ${coverage.toFixed(1)}% (Threshold: ${CONFIG.thresholds.endpointCoverage}%)`,
      details: {
        total: endpoints.length,
        documented: documentedEndpoints,
        undocumented: endpoints.length - documentedEndpoints,
        coverage: coverage.toFixed(1),
      },
    };
  }

  // ============================================
  // 3. Link Validation
  // ============================================

  async validateLinks(): Promise<ValidationResult> {
    console.log('\n🔗 Validating Internal Links...\n');

    // Get all documentation files
    const docFiles = await getMarkdownFiles(CONFIG.docs.folder);
    const allLinks: LinkInfo[] = [];

    // Extract all internal links
    for (const docFile of docFiles) {
      const content = readFile(docFile);
      const links = extractMarkdownLinks(content, docFile);
      allLinks.push(...links);
    }

    // Check each link
    const brokenLinks: LinkInfo[] = [];

    for (const linkInfo of allLinks) {
      const resolvedPath = resolveLinkPath(linkInfo.file, linkInfo.link);

      // Check if file exists
      if (!fileExists(resolvedPath)) {
        linkInfo.isBroken = true;
        brokenLinks.push(linkInfo);
      }
    }

    const passed = brokenLinks.length === 0;

    console.log(`🔗 Total Internal Links: ${allLinks.length}`);
    console.log(`✅ Valid Links: ${allLinks.length - brokenLinks.length}`);
    console.log(`❌ Broken Links: ${brokenLinks.length}\n`);

    if (brokenLinks.length > 0) {
      console.log('Broken Links:');
      brokenLinks.slice(0, 10).forEach(link => {
        console.log(`  ${link.file}:${link.line} → ${link.link}`);
      });
      if (brokenLinks.length > 10) {
        console.log(`  ... and ${brokenLinks.length - 10} more\n`);
      }
    }

    return {
      passed,
      message: `Broken Links: ${brokenLinks.length}`,
      details: {
        total: allLinks.length,
        valid: allLinks.length - brokenLinks.length,
        broken: brokenLinks.length,
        brokenLinks: brokenLinks.map(l => `${l.file}:${l.line} → ${l.link}`),
      },
    };
  }

  // ============================================
  // 4. Material Type Count Validation
  // ============================================

  async validateMaterialTypes(): Promise<ValidationResult> {
    console.log('\n📦 Validating Material Types Count...\n');

    // Read Prisma schema
    const schemaContent = readFile(CONFIG.backend.schema);

    // Count material master models (ending with _master, excluding specific ones)
    const materialMasterPattern = /^model\s+(\w+_master)\s+{/gm;
    const materialMasters: string[] = [];
    let match;

    while ((match = materialMasterPattern.exec(schemaContent)) !== null) {
      const modelName = match[1];
      // Exclude non-material masters
      if (!['season_master', 'color_master', 'size_master', 'users'].includes(modelName)) {
        materialMasters.push(modelName);
      }
    }

    const schemaCount = materialMasters.length;

    // Read materials guide
    const guideContent = readFile(CONFIG.docs.materialsGuide);

    // Extract claimed count from guide header
    const countMatch = guideContent.match(/(\d+)\s+Material Types/i);
    const guideCount = countMatch ? parseInt(countMatch[1]) : 0;

    const passed = schemaCount === guideCount;

    console.log(`📊 Prisma Schema: ${schemaCount} material types`);
    console.log(`📖 Materials Guide Claims: ${guideCount} material types`);
    console.log(`${passed ? '✅' : '❌'} Match: ${passed ? 'Yes' : 'No'}\n`);

    if (!passed) {
      console.log('Material Masters in Schema:');
      materialMasters.forEach(name => console.log(`  - ${name}`));
      console.log('');
    }

    return {
      passed,
      message: `Material Types: ${schemaCount} (Schema) vs ${guideCount} (Guide) - ${passed ? 'MATCH' : 'MISMATCH'}`,
      details: {
        schemaCount,
        guideCount,
        match: passed,
        materialMasters,
      },
    };
  }

  // ============================================
  // Run All Validations
  // ============================================

  async runAll(): Promise<void> {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║    Documentation Validation Report            ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    const results: ValidationResult[] = [];

    // Run all validations
    results.push(await this.validateControllerCoverage());
    results.push(await this.validateAPIEndpoints());
    results.push(await this.validateLinks());
    results.push(await this.validateMaterialTypes());

    // Summary
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║    Summary                                     ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} - ${result.message}`);
    });

    const allPassed = results.every(r => r.passed);
    const failCount = results.filter(r => !r.passed).length;

    console.log('\n─────────────────────────────────────────────────');
    if (allPassed) {
      console.log('✅ All validations passed!\n');
      process.exit(0);
    } else {
      console.log(`❌ ${failCount} validation(s) failed!\n`);
      process.exit(1);
    }
  }
}

// ============================================
// CLI Handler
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--all';

  const validator = new DocValidator();

  switch (mode) {
    case '--help':
      console.log(`
Documentation Validator

Usage:
  npx ts-node backend/scripts/doc-validator.ts [mode]

Modes:
  --all          Run all validations (default)
  --controllers  Controller coverage only
  --endpoints    API endpoint coverage only
  --links        Link validation only
  --materials    Material types count validation
  --help         Show this help message

Examples:
  npx ts-node backend/scripts/doc-validator.ts
  npx ts-node backend/scripts/doc-validator.ts --controllers
  npx ts-node backend/scripts/doc-validator.ts --links
      `);
      process.exit(0);
      break;

    case '--controllers':
      const controllerResult = await validator.validateControllerCoverage();
      process.exit(controllerResult.passed ? 0 : 1);
      break;

    case '--endpoints':
      const endpointResult = await validator.validateAPIEndpoints();
      process.exit(endpointResult.passed ? 0 : 1);
      break;

    case '--links':
      const linkResult = await validator.validateLinks();
      process.exit(linkResult.passed ? 0 : 1);
      break;

    case '--materials':
      const materialResult = await validator.validateMaterialTypes();
      process.exit(materialResult.passed ? 0 : 1);
      break;

    case '--all':
    default:
      await validator.runAll();
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error running validator:', error);
    process.exit(1);
  });
}

export { DocValidator };
