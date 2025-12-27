#!/usr/bin/env node

/**
 * TypeScript LSP MCP Server
 *
 * Provides type-aware code analysis capabilities:
 * - Type inference and validation
 * - Find all references across frontend/backend
 * - Type improvement suggestions
 * - Detect type mismatches (especially camelCase issues)
 * - Auto-import suggestions
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

class TypeScriptLSPServer {
  constructor() {
    this.backendTypesPath = path.join(process.cwd(), 'backend', 'src', 'types');
    this.frontendTypesPath = path.join(process.cwd(), 'frontend', 'src', 'types');
    this.backendSrcPath = path.join(process.cwd(), 'backend', 'src');
    this.frontendSrcPath = path.join(process.cwd(), 'frontend', 'src');
  }

  /**
   * Find all TypeScript files
   */
  findAllTSFiles(dir) {
    const files = [];

    const walk = (currentDir) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules, dist, build
          if (!entry.name.match(/node_modules|dist|build|\.next/)) {
            walk(fullPath);
          }
        } else if (entry.name.match(/\.(ts|tsx)$/) && !entry.name.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    };

    walk(dir);
    return files;
  }

  /**
   * Extract type definitions from a file
   */
  extractTypes(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const types = [];

    // Extract interfaces
    const interfaceRegex = /export\s+interface\s+(\w+)/g;
    let match;

    while ((match = interfaceRegex.exec(content)) !== null) {
      types.push({
        name: match[1],
        kind: 'interface',
        file: filePath
      });
    }

    // Extract type aliases
    const typeRegex = /export\s+type\s+(\w+)\s*=/g;
    while ((match = typeRegex.exec(content)) !== null) {
      types.push({
        name: match[1],
        kind: 'type',
        file: filePath
      });
    }

    // Extract enums
    const enumRegex = /export\s+enum\s+(\w+)/g;
    while ((match = enumRegex.exec(content)) !== null) {
      types.push({
        name: match[1],
        kind: 'enum',
        file: filePath
      });
    }

    return types;
  }

  /**
   * Find all references to a type
   */
  findReferences(typeName) {
    const backendFiles = this.findAllTSFiles(this.backendSrcPath);
    const frontendFiles = this.findAllTSFiles(this.frontendSrcPath);
    const allFiles = [...backendFiles, ...frontendFiles];

    const references = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Look for type usage (imports, type annotations, etc.)
        if (line.includes(typeName)) {
          // Avoid false positives (part of another word)
          const typeRegex = new RegExp(`\\b${typeName}\\b`);
          if (typeRegex.test(line)) {
            references.push({
              file: file.replace(process.cwd(), ''),
              line: index + 1,
              content: line.trim(),
              location: file.includes('backend') ? 'backend' : 'frontend'
            });
          }
        }
      });
    }

    return references;
  }

  /**
   * Detect camelCase/snake_case mismatches
   */
  detectCaseMismatches() {
    const frontendFiles = this.findAllTSFiles(this.frontendSrcPath);
    const mismatches = [];

    for (const file of frontendFiles) {
      // Skip type definition files
      if (file.includes('/types/')) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Look for snake_case property access
        const snakeCaseMatch = line.match(/\.(\w+_\w+)/g);
        if (snakeCaseMatch) {
          for (const match of snakeCaseMatch) {
            const property = match.substring(1); // Remove the dot
            // Ignore if it's in a comment
            if (!line.trim().startsWith('//')) {
              mismatches.push({
                file: file.replace(process.cwd(), ''),
                line: index + 1,
                property,
                content: line.trim(),
                suggestion: this.toCamelCase(property)
              });
            }
          }
        }
      });
    }

    return mismatches;
  }

  /**
   * Convert snake_case to camelCase
   */
  toCamelCase(str) {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  /**
   * Find unused type definitions
   */
  findUnusedTypes() {
    const backendTypes = this.findAllTSFiles(this.backendTypesPath);
    const frontendTypes = this.findAllTSFiles(this.frontendTypesPath);
    const allTypeFiles = [...backendTypes, ...frontendTypes];

    const unusedTypes = [];

    for (const typeFile of allTypeFiles) {
      const types = this.extractTypes(typeFile);

      for (const type of types) {
        const references = this.findReferences(type.name);

        // Filter out self-references (the definition itself)
        const externalRefs = references.filter(ref =>
          !ref.file.includes(typeFile.replace(process.cwd(), ''))
        );

        if (externalRefs.length === 0) {
          unusedTypes.push({
            ...type,
            file: type.file.replace(process.cwd(), '')
          });
        }
      }
    }

    return unusedTypes;
  }

  /**
   * Suggest auto-imports for a type
   */
  suggestImports(typeName) {
    const backendTypes = this.findAllTSFiles(this.backendTypesPath);
    const frontendTypes = this.findAllTSFiles(this.frontendTypesPath);
    const allTypeFiles = [...backendTypes, ...frontendTypes];

    const suggestions = [];

    for (const typeFile of allTypeFiles) {
      const types = this.extractTypes(typeFile);
      const matchingType = types.find(t => t.name === typeName);

      if (matchingType) {
        const relativePath = typeFile.replace(process.cwd(), '');
        suggestions.push({
          typeName,
          kind: matchingType.kind,
          importPath: relativePath.replace(/\\/g, '/').replace(/\.ts$/, ''),
          location: typeFile.includes('backend') ? 'backend' : 'frontend'
        });
      }
    }

    return suggestions;
  }

  /**
   * Run TypeScript type checking
   */
  runTypeCheck(location = 'both') {
    const results = {
      backend: null,
      frontend: null
    };

    if (location === 'both' || location === 'backend') {
      try {
        execSync('cd backend && npx tsc --noEmit', { stdio: 'pipe' });
        results.backend = { success: true, errors: [] };
      } catch (error) {
        const output = error.stdout ? error.stdout.toString() : error.message;
        const errors = this.parseTypeScriptErrors(output);
        results.backend = { success: false, errors };
      }
    }

    if (location === 'both' || location === 'frontend') {
      try {
        execSync('cd frontend && npx tsc --noEmit', { stdio: 'pipe' });
        results.frontend = { success: true, errors: [] };
      } catch (error) {
        const output = error.stdout ? error.stdout.toString() : error.message;
        const errors = this.parseTypeScriptErrors(output);
        results.frontend = { success: false, errors };
      }
    }

    return results;
  }

  /**
   * Parse TypeScript error output
   */
  parseTypeScriptErrors(output) {
    const errors = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const errorMatch = line.match(/^(.+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/);
      if (errorMatch) {
        errors.push({
          file: errorMatch[1],
          line: parseInt(errorMatch[2]),
          column: parseInt(errorMatch[3]),
          code: errorMatch[4],
          message: errorMatch[5]
        });
      }
    }

    return errors.slice(0, 10); // Limit to first 10 errors
  }

  /**
   * Get type statistics
   */
  getTypeStats() {
    const backendTypes = this.findAllTSFiles(this.backendTypesPath);
    const frontendTypes = this.findAllTSFiles(this.frontendTypesPath);

    const stats = {
      backend: {
        files: backendTypes.length,
        types: 0,
        interfaces: 0,
        enums: 0
      },
      frontend: {
        files: frontendTypes.length,
        types: 0,
        interfaces: 0,
        enums: 0
      }
    };

    for (const file of backendTypes) {
      const types = this.extractTypes(file);
      stats.backend.types += types.length;
      stats.backend.interfaces += types.filter(t => t.kind === 'interface').length;
      stats.backend.enums += types.filter(t => t.kind === 'enum').length;
    }

    for (const file of frontendTypes) {
      const types = this.extractTypes(file);
      stats.frontend.types += types.length;
      stats.frontend.interfaces += types.filter(t => t.kind === 'interface').length;
      stats.frontend.enums += types.filter(t => t.kind === 'enum').length;
    }

    return stats;
  }

  /**
   * Handle MCP requests
   */
  handleRequest(request) {
    const { method, params } = request;

    switch (method) {
      case 'findReferences':
        return this.findReferences(params.typeName);

      case 'detectCaseMismatches':
        return this.detectCaseMismatches();

      case 'findUnusedTypes':
        return this.findUnusedTypes();

      case 'suggestImports':
        return this.suggestImports(params.typeName);

      case 'typeCheck':
        return this.runTypeCheck(params.location || 'both');

      case 'getStats':
        return this.getTypeStats();

      default:
        return { error: `Unknown method: ${method}` };
    }
  }
}

// CLI interface
if (require.main === module) {
  const server = new TypeScriptLSPServer();

  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log(`${colors.bright}${colors.blue}=== TypeScript LSP MCP Server ===${colors.reset}\n`);

  switch (command) {
    case 'stats':
      const stats = server.getTypeStats();
      console.log(`${colors.green}Type Statistics:${colors.reset}`);
      console.log(`\n${colors.bright}Backend:${colors.reset}`);
      console.log(`  Files: ${stats.backend.files}`);
      console.log(`  Total types: ${stats.backend.types}`);
      console.log(`  Interfaces: ${stats.backend.interfaces}`);
      console.log(`  Enums: ${stats.backend.enums}`);
      console.log(`\n${colors.bright}Frontend:${colors.reset}`);
      console.log(`  Files: ${stats.frontend.files}`);
      console.log(`  Total types: ${stats.frontend.types}`);
      console.log(`  Interfaces: ${stats.frontend.interfaces}`);
      console.log(`  Enums: ${stats.frontend.enums}`);
      break;

    case 'mismatches':
      const mismatches = server.detectCaseMismatches();
      console.log(`${colors.green}CamelCase/snake_case Mismatches:${colors.reset}`);
      console.log(`  Total found: ${mismatches.length}`);

      if (mismatches.length > 0) {
        console.log(`\n${colors.yellow}First 10 mismatches:${colors.reset}`);
        mismatches.slice(0, 10).forEach(m => {
          console.log(`\n  ${m.file}:${m.line}`);
          console.log(`    Property: ${colors.red}${m.property}${colors.reset}`);
          console.log(`    Suggestion: ${colors.green}${m.suggestion}${colors.reset}`);
          console.log(`    Line: ${m.content}`);
        });
      } else {
        console.log(`\n${colors.green}✓ No case mismatches found!${colors.reset}`);
      }
      break;

    case 'references':
      const typeName = args[1];
      if (!typeName) {
        console.log(`${colors.red}Usage: node index.js references <typeName>${colors.reset}`);
      } else {
        const refs = server.findReferences(typeName);
        console.log(`${colors.green}References for "${typeName}":${colors.reset}`);
        console.log(`  Total found: ${refs.length}`);

        if (refs.length > 0) {
          const byLocation = refs.reduce((acc, ref) => {
            acc[ref.location] = (acc[ref.location] || 0) + 1;
            return acc;
          }, {});

          console.log(`\n${colors.bright}By location:${colors.reset}`);
          Object.entries(byLocation).forEach(([loc, count]) => {
            console.log(`  ${loc}: ${count}`);
          });

          console.log(`\n${colors.bright}First 5 references:${colors.reset}`);
          refs.slice(0, 5).forEach(ref => {
            console.log(`  ${ref.file}:${ref.line}`);
            console.log(`    ${ref.content}`);
          });
        }
      }
      break;

    case 'unused':
      const unused = server.findUnusedTypes();
      console.log(`${colors.green}Unused Type Definitions:${colors.reset}`);
      console.log(`  Total found: ${unused.length}`);

      if (unused.length > 0) {
        console.log(`\n${colors.yellow}Unused types:${colors.reset}`);
        unused.forEach(type => {
          console.log(`  - ${type.name} (${type.kind}) in ${type.file}`);
        });
      } else {
        console.log(`\n${colors.green}✓ All types are in use!${colors.reset}`);
      }
      break;

    case 'imports':
      const importTypeName = args[1];
      if (!importTypeName) {
        console.log(`${colors.red}Usage: node index.js imports <typeName>${colors.reset}`);
      } else {
        const suggestions = server.suggestImports(importTypeName);
        console.log(`${colors.green}Import suggestions for "${importTypeName}":${colors.reset}`);

        if (suggestions.length > 0) {
          suggestions.forEach(s => {
            console.log(`\n  ${colors.bright}${s.location}:${colors.reset}`);
            console.log(`    import { ${importTypeName} } from '${s.importPath}';`);
            console.log(`    Type: ${s.kind}`);
          });
        } else {
          console.log(`\n${colors.yellow}No type definitions found for "${importTypeName}"${colors.reset}`);
        }
      }
      break;

    case 'help':
    default:
      console.log('Available commands:');
      console.log('  stats - Show type statistics');
      console.log('  mismatches - Detect camelCase/snake_case mismatches');
      console.log('  references <typeName> - Find all references to a type');
      console.log('  unused - Find unused type definitions');
      console.log('  imports <typeName> - Suggest auto-imports');
      console.log('  help - Show this help');
      break;
  }
}

module.exports = TypeScriptLSPServer;
