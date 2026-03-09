#!/usr/bin/env node

/**
 * Prisma MCP Server
 *
 * Provides deep schema analysis and query optimization capabilities:
 * - Live schema introspection
 * - Optimal include suggestions
 * - N+1 query detection
 * - Migration analysis
 * - Serializer relation mapping validation
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

class PrismaMCPServer {
  constructor() {
    this.schemaPath = path.join(process.cwd(), 'backend', 'prisma', 'schema.prisma');
    this.serializerPath = path.join(process.cwd(), 'backend', 'src', 'utils', 'serializer.ts');
  }

  /**
   * Introspect Prisma schema and extract all models
   */
  introspectSchema() {
    try {
      const schemaContent = fs.readFileSync(this.schemaPath, 'utf-8');

      // Extract models
      const modelRegex = /model\s+(\w+)\s*{([^}]+)}/g;
      const models = [];
      let match;

      while ((match = modelRegex.exec(schemaContent)) !== null) {
        const modelName = match[1];
        const modelBody = match[2];

        // Extract fields and relations
        const fields = this.extractFields(modelBody);
        const relations = this.extractRelations(modelBody);

        models.push({
          name: modelName,
          fields,
          relations
        });
      }

      return models;
    } catch (error) {
      console.error(`${colors.red}Error reading schema:${colors.reset}`, error.message);
      return [];
    }
  }

  /**
   * Extract fields from model body
   */
  extractFields(modelBody) {
    const fields = [];
    const lines = modelBody.split('\n').map(l => l.trim()).filter(l => l);

    for (const line of lines) {
      // Skip comments and relations
      if (line.startsWith('//') || line.startsWith('@@') || line.includes('@relation')) {
        continue;
      }

      const fieldMatch = line.match(/^(\w+)\s+(\w+)/);
      if (fieldMatch) {
        fields.push({
          name: fieldMatch[1],
          type: fieldMatch[2],
          isOptional: line.includes('?'),
          isArray: line.includes('[]')
        });
      }
    }

    return fields;
  }

  /**
   * Extract relations from model body
   */
  extractRelations(modelBody) {
    const relations = [];
    const lines = modelBody.split('\n').map(l => l.trim()).filter(l => l);

    for (const line of lines) {
      if (line.includes('@relation')) {
        const relationMatch = line.match(/^(\w+)\s+(\w+)/);
        if (relationMatch) {
          relations.push({
            name: relationMatch[1],
            type: relationMatch[2].replace('[]', ''),
            isArray: line.includes('[]'),
            isOptional: line.includes('?')
          });
        }
      }
    }

    return relations;
  }

  /**
   * Suggest optimal includes for a query
   */
  suggestIncludes(modelName, depth = 1) {
    const models = this.introspectSchema();
    const model = models.find(m => m.name === modelName);

    if (!model) {
      return { error: `Model ${modelName} not found` };
    }

    const includes = {};

    for (const relation of model.relations) {
      if (depth > 0) {
        includes[relation.name] = true;

        // Add nested includes for depth > 1
        if (depth > 1) {
          const nestedModel = models.find(m => m.name === relation.type);
          if (nestedModel && nestedModel.relations.length > 0) {
            includes[relation.name] = {
              include: this.suggestIncludes(relation.type, depth - 1)
            };
          }
        }
      }
    }

    return includes;
  }

  /**
   * Analyze serializer relation mappings
   */
  analyzeSerializerMappings() {
    try {
      const serializerContent = fs.readFileSync(this.serializerPath, 'utf-8');

      // Extract RELATION_MAPPINGS (handle multiline with brackets)
      const mappingsStart = serializerContent.indexOf('RELATION_MAPPINGS');
      if (mappingsStart === -1) {
        return { error: 'RELATION_MAPPINGS not found in serializer.ts' };
      }

      // Find the opening brace
      const openBrace = serializerContent.indexOf('{', mappingsStart);
      let braceCount = 1;
      let closeBrace = openBrace + 1;

      // Find matching closing brace
      while (braceCount > 0 && closeBrace < serializerContent.length) {
        if (serializerContent[closeBrace] === '{') braceCount++;
        if (serializerContent[closeBrace] === '}') braceCount--;
        closeBrace++;
      }

      const mappingsBody = serializerContent.substring(openBrace + 1, closeBrace - 1);
      const mappings = {};

      // Match both quoted and unquoted keys/values
      const mappingRegex = /(\w+)\s*:\s*['"](\w+)['"]/g;
      let match;

      while ((match = mappingRegex.exec(mappingsBody)) !== null) {
        mappings[match[1]] = match[2];
      }

      // Get all schema relations
      const models = this.introspectSchema();
      const allRelations = new Set();

      for (const model of models) {
        for (const relation of model.relations) {
          if (relation.name.includes('_')) {
            allRelations.add(relation.name);
          }
        }
      }

      // Find missing mappings
      const missing = [];
      for (const relation of allRelations) {
        if (!mappings[relation]) {
          missing.push(relation);
        }
      }

      return {
        totalMappings: Object.keys(mappings).length,
        mappings,
        totalSchemaRelations: allRelations.size,
        missingMappings: missing
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Detect potential N+1 query patterns
   */
  detectN1Patterns(queryCode) {
    const warnings = [];

    // Pattern 1: Loop with individual queries
    if (queryCode.match(/for\s*\(.*\)\s*{[\s\S]*?prisma\.\w+\.findUnique/)) {
      warnings.push({
        type: 'N+1 in loop',
        pattern: 'findUnique inside for loop',
        suggestion: 'Use findMany with whereIn or include relations'
      });
    }

    // Pattern 2: Map with queries
    if (queryCode.match(/\.map\(.*prisma\.\w+\./)) {
      warnings.push({
        type: 'N+1 in map',
        pattern: 'Prisma query inside map',
        suggestion: 'Fetch all data first, then map'
      });
    }

    // Pattern 3: Missing includes
    if (queryCode.match(/findMany\(\{[^}]*\}\)/) && !queryCode.includes('include')) {
      warnings.push({
        type: 'Missing includes',
        pattern: 'findMany without includes',
        suggestion: 'Consider adding includes for related data'
      });
    }

    return warnings;
  }

  /**
   * Validate migration safety
   */
  validateMigration(migrationSQL) {
    const issues = [];

    // Check for destructive operations
    const destructiveOps = [
      { pattern: /DROP\s+TABLE/i, type: 'DROP TABLE', severity: 'high' },
      { pattern: /DROP\s+COLUMN/i, type: 'DROP COLUMN', severity: 'high' },
      { pattern: /ALTER\s+TABLE.*DROP/i, type: 'ALTER DROP', severity: 'high' },
      { pattern: /TRUNCATE/i, type: 'TRUNCATE', severity: 'high' },
      { pattern: /ALTER\s+TABLE.*ALTER\s+COLUMN.*NOT\s+NULL/i, type: 'ADD NOT NULL', severity: 'medium' }
    ];

    for (const op of destructiveOps) {
      if (op.pattern.test(migrationSQL)) {
        issues.push({
          type: op.type,
          severity: op.severity,
          message: `Destructive operation detected: ${op.type}`
        });
      }
    }

    return {
      safe: issues.filter(i => i.severity === 'high').length === 0,
      issues
    };
  }

  /**
   * Get model statistics
   */
  getModelStats() {
    const models = this.introspectSchema();

    const stats = {
      totalModels: models.length,
      totalFields: 0,
      totalRelations: 0,
      modelsWithMostRelations: [],
      modelsWithMostFields: []
    };

    const modelRelationCounts = [];
    const modelFieldCounts = [];

    for (const model of models) {
      stats.totalFields += model.fields.length;
      stats.totalRelations += model.relations.length;

      modelRelationCounts.push({
        name: model.name,
        count: model.relations.length
      });

      modelFieldCounts.push({
        name: model.name,
        count: model.fields.length
      });
    }

    // Sort by count
    modelRelationCounts.sort((a, b) => b.count - a.count);
    modelFieldCounts.sort((a, b) => b.count - a.count);

    stats.modelsWithMostRelations = modelRelationCounts.slice(0, 5);
    stats.modelsWithMostFields = modelFieldCounts.slice(0, 5);

    return stats;
  }

  /**
   * Diff current schema against last committed version
   * Returns added/removed/modified models and fields + downstream impact
   */
  diffSchema() {
    try {
      const currentSchema = fs.readFileSync(this.schemaPath, 'utf-8');

      // Get last committed version
      let previousSchema;
      try {
        previousSchema = execSync('git show HEAD:backend/prisma/schema.prisma', {
          encoding: 'utf-8', cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe']
        });
      } catch {
        return { error: 'No previous schema in git (first commit?)' };
      }

      const currentModels = this._parseModelMap(currentSchema);
      const previousModels = this._parseModelMap(previousSchema);

      const added = [];
      const removed = [];
      const modified = [];

      // Find added/modified models
      for (const [name, fields] of Object.entries(currentModels)) {
        if (!previousModels[name]) {
          added.push({ model: name, fields: Object.keys(fields) });
        } else {
          const prevFields = previousModels[name];
          const addedFields = Object.keys(fields).filter(f => !prevFields[f]);
          const removedFields = Object.keys(prevFields).filter(f => !fields[f]);
          const changedFields = Object.keys(fields).filter(f =>
            prevFields[f] && fields[f] !== prevFields[f]
          );

          if (addedFields.length || removedFields.length || changedFields.length) {
            modified.push({ model: name, addedFields, removedFields, changedFields });
          }
        }
      }

      // Find removed models
      for (const name of Object.keys(previousModels)) {
        if (!currentModels[name]) {
          removed.push({ model: name });
        }
      }

      // Calculate downstream impact
      const impact = this._calculateImpact(added, removed, modified);

      return { added, removed, modified, impact, hasChanges: added.length + removed.length + modified.length > 0 };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Parse schema into { modelName: { fieldName: fieldLine } }
   */
  _parseModelMap(schema) {
    const models = {};
    const modelRegex = /model\s+(\w+)\s*{([^}]+)}/g;
    let match;

    while ((match = modelRegex.exec(schema)) !== null) {
      const name = match[1];
      const body = match[2];
      const fields = {};

      body.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) return;
        const fieldMatch = trimmed.match(/^(\w+)\s+/);
        if (fieldMatch) fields[fieldMatch[1]] = trimmed;
      });

      models[name] = fields;
    }

    return models;
  }

  /**
   * Calculate which downstream files are affected by schema changes
   */
  _calculateImpact(added, removed, modified) {
    const impact = {
      mustUpdate: [],
      shouldCheck: [],
      commands: [],
    };

    const allChangedModels = [
      ...added.map(a => a.model),
      ...modified.map(m => m.model),
    ];

    if (allChangedModels.length > 0) {
      // Always needed after schema change
      impact.commands.push('cd backend && npx prisma generate');

      for (const model of allChangedModels) {
        // Backend type files
        const possibleTypeFile = `backend/src/types/${model}.types.ts`;
        impact.shouldCheck.push(possibleTypeFile);

        // Frontend type files
        const camelName = model.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
        const singularName = camelName.replace(/s$/, '').replace(/ies$/, 'y');
        impact.shouldCheck.push(`frontend/src/types/${singularName}.types.ts`);
        impact.shouldCheck.push(`frontend/src/types/${camelName}.types.ts`);
      }

      // Check serializer mappings for new relations
      const hasNewRelations = modified.some(m =>
        m.addedFields.some(f => f.includes('_') || /[A-Z]/.test(f.charAt(0)))
      );

      if (hasNewRelations || added.length > 0) {
        impact.mustUpdate.push('backend/src/utils/serializer.ts (check RELATION_MAPPINGS)');
        impact.commands.push('node scripts/skills/sync-types.js --check');
      }
    }

    if (added.length > 0) {
      for (const a of added) {
        impact.mustUpdate.push(`backend/src/services/${a.model}.service.ts (create)`);
        impact.mustUpdate.push(`backend/src/controllers/${a.model}.controller.ts (create)`);
        impact.mustUpdate.push(`backend/src/routes/${a.model}.routes.ts (create)`);
        impact.mustUpdate.push('backend/src/routes/index.ts (register route)');
      }
      impact.commands.push(`node scripts/skills/generate-types.js --model <ModelName>`);
      impact.commands.push(`node scripts/skills/scaffold-module.js --name <module> --fields <fields>`);
    }

    if (removed.length > 0) {
      for (const r of removed) {
        impact.mustUpdate.push(`REMOVE: backend/src/services/${r.model}.service.ts`);
        impact.mustUpdate.push(`REMOVE: backend/src/controllers/${r.model}.controller.ts`);
        impact.mustUpdate.push(`REMOVE: backend/src/routes/${r.model}.routes.ts`);
        impact.mustUpdate.push(`REMOVE: frontend files referencing ${r.model}`);
      }
    }

    // Filter shouldCheck to only existing files
    impact.shouldCheck = impact.shouldCheck.filter(f => {
      try { return fs.existsSync(path.join(process.cwd(), f)); } catch { return false; }
    });

    return impact;
  }

  /**
   * Generate missing RELATION_MAPPINGS entries
   */
  generateMissingMappings() {
    const analysis = this.analyzeSerializerMappings();
    if (analysis.error) return analysis;

    const suggestions = analysis.missingMappings.map(rel => {
      const camelCase = rel.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
      return { relation: rel, suggested: camelCase, entry: `  ${rel}: '${camelCase}',` };
    });

    return {
      total: suggestions.length,
      suggestions,
      codeBlock: suggestions.map(s => s.entry).join('\n'),
    };
  }

  /**
   * Handle MCP requests
   */
  handleRequest(request) {
    const { method, params } = request;

    switch (method) {
      case 'introspect':
        return this.introspectSchema();

      case 'suggestIncludes':
        return this.suggestIncludes(params.model, params.depth || 1);

      case 'analyzeSerializerMappings':
        return this.analyzeSerializerMappings();

      case 'detectN1':
        return this.detectN1Patterns(params.code);

      case 'validateMigration':
        return this.validateMigration(params.sql);

      case 'getStats':
        return this.getModelStats();

      default:
        return { error: `Unknown method: ${method}` };
    }
  }
}

// CLI interface
if (require.main === module) {
  const server = new PrismaMCPServer();

  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log(`${colors.bright}${colors.blue}=== Prisma MCP Server ===${colors.reset}\n`);

  switch (command) {
    case 'introspect':
      const models = server.introspectSchema();
      console.log(`${colors.green}Found ${models.length} models:${colors.reset}`);
      models.forEach(model => {
        console.log(`\n${colors.bright}${model.name}${colors.reset}`);
        console.log(`  Fields: ${model.fields.length}`);
        console.log(`  Relations: ${model.relations.length}`);
        if (model.relations.length > 0) {
          model.relations.forEach(rel => {
            console.log(`    - ${rel.name}: ${rel.type}${rel.isArray ? '[]' : ''}`);
          });
        }
      });
      break;

    case 'stats':
      const stats = server.getModelStats();
      console.log(`${colors.green}Schema Statistics:${colors.reset}`);
      console.log(`  Total models: ${stats.totalModels}`);
      console.log(`  Total fields: ${stats.totalFields}`);
      console.log(`  Total relations: ${stats.totalRelations}`);
      console.log(`\n${colors.bright}Models with most relations:${colors.reset}`);
      stats.modelsWithMostRelations.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.name}: ${m.count} relations`);
      });
      break;

    case 'mappings':
      const mappings = server.analyzeSerializerMappings();
      if (mappings.error) {
        console.log(`${colors.red}Error: ${mappings.error}${colors.reset}`);
      } else {
        console.log(`${colors.green}Serializer Mappings Analysis:${colors.reset}`);
        console.log(`  Total mappings: ${mappings.totalMappings}`);
        console.log(`  Schema relations with underscore: ${mappings.totalSchemaRelations}`);

        if (mappings.missingMappings.length > 0) {
          console.log(`\n${colors.yellow}Missing mappings (${mappings.missingMappings.length}):${colors.reset}`);
          mappings.missingMappings.forEach(rel => {
            console.log(`  - ${rel}`);
          });
        } else {
          console.log(`\n${colors.green}✓ All schema relations are mapped${colors.reset}`);
        }
      }
      break;

    case 'includes':
      const model = args[1];
      const depth = parseInt(args[2]) || 1;
      if (!model) {
        console.log(`${colors.red}Usage: node index.js includes <model> [depth]${colors.reset}`);
      } else {
        const includes = server.suggestIncludes(model, depth);
        if (includes.error) {
          console.log(`${colors.red}Error: ${includes.error}${colors.reset}`);
        } else {
          console.log(`${colors.green}Suggested includes for ${model}:${colors.reset}`);
          console.log(JSON.stringify(includes, null, 2));
        }
      }
      break;

    case 'diff':
      const diff = server.diffSchema();
      if (diff.error) {
        console.log(`${colors.red}Error: ${diff.error}${colors.reset}`);
      } else if (!diff.hasChanges) {
        console.log(`${colors.green}✓ No schema changes since last commit${colors.reset}`);
      } else {
        if (diff.added.length > 0) {
          console.log(`${colors.green}Added models (${diff.added.length}):${colors.reset}`);
          diff.added.forEach(a => console.log(`  + ${a.model} (${a.fields.length} fields)`));
        }
        if (diff.removed.length > 0) {
          console.log(`\n${colors.red}Removed models (${diff.removed.length}):${colors.reset}`);
          diff.removed.forEach(r => console.log(`  - ${r.model}`));
        }
        if (diff.modified.length > 0) {
          console.log(`\n${colors.yellow}Modified models (${diff.modified.length}):${colors.reset}`);
          diff.modified.forEach(m => {
            const parts = [];
            if (m.addedFields.length) parts.push(`+${m.addedFields.length} fields`);
            if (m.removedFields.length) parts.push(`-${m.removedFields.length} fields`);
            if (m.changedFields.length) parts.push(`~${m.changedFields.length} changed`);
            console.log(`  ~ ${m.model} (${parts.join(', ')})`);
          });
        }
        if (diff.impact.mustUpdate.length > 0) {
          console.log(`\n${colors.bright}Files to update:${colors.reset}`);
          diff.impact.mustUpdate.forEach(f => console.log(`  ${colors.yellow}→${colors.reset} ${f}`));
        }
        if (diff.impact.shouldCheck.length > 0) {
          console.log(`\n${colors.bright}Files to check:${colors.reset}`);
          diff.impact.shouldCheck.forEach(f => console.log(`  ${colors.blue}?${colors.reset} ${f}`));
        }
        if (diff.impact.commands.length > 0) {
          console.log(`\n${colors.bright}Suggested commands:${colors.reset}`);
          diff.impact.commands.forEach(cmd => console.log(`  ${colors.cyan}$ ${cmd}${colors.reset}`));
        }
      }
      break;

    case 'generate-mappings':
      const genMappings = server.generateMissingMappings();
      if (genMappings.error) {
        console.log(`${colors.red}Error: ${genMappings.error}${colors.reset}`);
      } else if (genMappings.total === 0) {
        console.log(`${colors.green}✓ All relations have mappings${colors.reset}`);
      } else {
        console.log(`${colors.yellow}Missing ${genMappings.total} RELATION_MAPPINGS entries:${colors.reset}\n`);
        console.log(`${colors.bright}Add to backend/src/utils/serializer.ts:${colors.reset}\n`);
        console.log(genMappings.codeBlock);
      }
      break;

    case 'help':
    default:
      console.log('Available commands:');
      console.log('  introspect - List all models with fields and relations');
      console.log('  stats - Show schema statistics');
      console.log('  mappings - Analyze serializer relation mappings');
      console.log('  diff - Diff schema vs last commit, show downstream impact');
      console.log('  generate-mappings - Generate missing RELATION_MAPPINGS entries');
      console.log('  includes <model> [depth] - Suggest optimal includes');
      console.log('  help - Show this help');
      break;
  }
}

module.exports = PrismaMCPServer;
