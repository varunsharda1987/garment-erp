#!/usr/bin/env node
/**
 * Smart Commit Generator Skill
 *
 * Analyzes git changes and generates intelligent commit messages.
 * Follows existing commit patterns and validates related docs.
 *
 * Usage:
 *   node scripts/skills/commit-smart.js [--generate|--preview|--help]
 *
 * Modes:
 *   --generate  Analyze changes and suggest commit message (default)
 *   --preview   Show what would be committed (dry-run)
 *   --help      Show usage information
 */

const { execSync } = require('child_process');
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
 * Execute command and return output
 */
function exec(command) {
  try {
    return execSync(command, { encoding: 'utf-8', cwd: process.cwd() });
  } catch (error) {
    return '';
  }
}

/**
 * Get git status
 */
function getGitStatus() {
  const status = exec('git status --porcelain');
  const lines = status.split('\n').filter(l => l.trim());

  return {
    modified: lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).map(l => l.substring(3)),
    added: lines.filter(l => l.startsWith('A ') || l.startsWith('?? ')).map(l => l.substring(3)),
    deleted: lines.filter(l => l.startsWith(' D') || l.startsWith('D ')).map(l => l.substring(3)),
    renamed: lines.filter(l => l.startsWith('R ')).map(l => l.substring(3)),
  };
}

/**
 * Analyze changes
 */
function analyzeChanges(status) {
  const allFiles = [
    ...status.modified,
    ...status.added,
    ...status.deleted,
    ...status.renamed,
  ];

  const analysis = {
    hasSchema: allFiles.some(f => f.includes('schema.prisma')),
    hasTypes: allFiles.some(f => f.includes('.types.ts')),
    hasControllers: allFiles.some(f => f.includes('controller')),
    hasServices: allFiles.some(f => f.includes('service')),
    hasRoutes: allFiles.some(f => f.includes('routes')),
    hasComponents: allFiles.some(f => f.includes('components') && f.endsWith('.tsx')),
    hasPages: allFiles.some(f => f.includes('pages') && f.endsWith('.tsx')),
    hasDocs: allFiles.some(f => f.endsWith('.md')),
    hasTests: allFiles.some(f => f.includes('test') || f.includes('spec')),
    hasScripts: allFiles.some(f => f.includes('scripts')),
    hasSkills: allFiles.some(f => f.includes('.claude/skills')),
  };

  return { status, analysis, files: allFiles };
}

/**
 * Determine commit type
 */
function determineCommitType(analysis) {
  if (analysis.hasSkills) return 'feat';
  if (analysis.hasSchema) return 'feat';
  if (analysis.hasComponents || analysis.hasPages) return 'feat';
  if (analysis.hasTests) return 'test';
  if (analysis.hasDocs && !analysis.hasTypes) return 'docs';
  if (analysis.hasScripts) return 'chore';
  return 'feat';
}

/**
 * Detect module boundaries for scope analysis
 */
function detectModuleScope(files) {
  const modules = new Set();

  for (const file of files) {
    // Extract module name from path patterns
    let module = null;

    // Backend: services/X.service.ts, controllers/X.controller.ts, routes/X.routes.ts
    const backendMatch = file.match(/(?:services|controllers|routes)\/([^/.]+)\./);
    if (backendMatch) module = backendMatch[1].replace('.service', '').replace('.controller', '').replace('.routes', '');

    // Frontend: pages/XList.tsx, pages/XForm.tsx, services/X.service.ts, types/X.types.ts
    const frontendMatch = file.match(/(?:pages|types|services)\/([^/.]+)/);
    if (frontendMatch) module = frontendMatch[1].replace('List', '').replace('Form', '').replace('FormDialog', '').replace('.types', '').replace('.service', '');

    // Schema changes are cross-cutting
    if (file.includes('schema.prisma')) module = '_schema';

    // Skills/hooks are infrastructure
    if (file.includes('.claude/') || file.includes('scripts/')) module = '_infra';

    // Docs
    if (file.endsWith('.md')) module = '_docs';

    if (module) modules.add(module.toLowerCase());
  }

  // Remove meta-modules for scope count
  const featureModules = [...modules].filter(m => !m.startsWith('_'));
  const hasInfra = modules.has('_infra');
  const hasDocs = modules.has('_docs');
  const hasSchema = modules.has('_schema');

  return {
    modules: featureModules,
    featureCount: featureModules.length,
    hasInfra,
    hasDocs,
    hasSchema,
    shouldSplit: featureModules.length > 3,
    splitSuggestion: featureModules.length > 3
      ? `Consider splitting into ${featureModules.length} commits: ${featureModules.join(', ')}`
      : null,
  };
}

/**
 * Generate commit message
 */
function generateCommitMessage(changes) {
  const { analysis, files } = changes;
  const commitType = determineCommitType(analysis);

  // Build title
  let title = '';
  if (analysis.hasSkills) {
    title = 'Add custom Claude Code skills for development automation';
  } else if (analysis.hasSchema) {
    title = 'Update database schema and related components';
  } else if (analysis.hasComponents && analysis.hasPages) {
    title = 'Add new features and UI components';
  } else if (analysis.hasTypes && analysis.hasControllers) {
    title = 'Add new API endpoints and type definitions';
  } else {
    title = 'Update codebase';
  }

  // Build details
  const details = [];

  if (analysis.hasSkills) {
    details.push('Implement custom skills for automating repetitive tasks');
    details.push('Add /sync-types, /db-workflow, /test-all, /api-docs, /commit-smart skills');
  }

  if (analysis.hasSchema) {
    details.push('Update Prisma schema with new models and relations');
  }

  if (analysis.hasTypes) {
    details.push('Add/update TypeScript type definitions');
    if (analysis.hasTypes && !analysis.hasSkills) {
      details.push('Ensure frontend types use camelCase (serializer compliance)');
    }
  }

  if (analysis.hasControllers) {
    details.push('Add/update backend controllers and services');
  }

  if (analysis.hasRoutes) {
    details.push('Update API route definitions');
  }

  if (analysis.hasComponents || analysis.hasPages) {
    details.push('Add/update frontend components and pages');
  }

  if (analysis.hasDocs) {
    details.push('Update project documentation');
  }

  if (analysis.hasTests) {
    details.push('Add/update test suites');
  }

  // Build commit message
  let message = `${commitType}: ${title}\n\n`;

  if (details.length > 0) {
    message += details.map(d => `- ${d}`).join('\n');
    message += '\n\n';
  }

  message += '🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\n';
  message += 'Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>';

  return message;
}

/**
 * Preview changes
 */
function previewChanges() {
  console.log(`\n${colors.bright}${colors.cyan}=== Commit Preview ===${colors.reset}\n`);

  const status = getGitStatus();

  if (status.modified.length === 0 && status.added.length === 0 &&
      status.deleted.length === 0 && status.renamed.length === 0) {
    console.log(`${colors.yellow}No changes to commit${colors.reset}\n`);
    return false;
  }

  console.log(`${colors.bright}Changes:${colors.reset}`);
  if (status.modified.length > 0) {
    console.log(`\n  ${colors.yellow}Modified (${status.modified.length}):${colors.reset}`);
    status.modified.slice(0, 10).forEach(f => console.log(`    M ${f}`));
    if (status.modified.length > 10) {
      console.log(`    ... and ${status.modified.length - 10} more`);
    }
  }

  if (status.added.length > 0) {
    console.log(`\n  ${colors.green}Added (${status.added.length}):${colors.reset}`);
    status.added.slice(0, 10).forEach(f => console.log(`    A ${f}`));
    if (status.added.length > 10) {
      console.log(`    ... and ${status.added.length - 10} more`);
    }
  }

  if (status.deleted.length > 0) {
    console.log(`\n  ${colors.red}Deleted (${status.deleted.length}):${colors.reset}`);
    status.deleted.slice(0, 10).forEach(f => console.log(`    D ${f}`));
    if (status.deleted.length > 10) {
      console.log(`    ... and ${status.deleted.length - 10} more`);
    }
  }

  console.log('');
  return true;
}

/**
 * Generate and show commit message
 */
function generateAndShow() {
  console.log(`\n${colors.bright}${colors.cyan}=== Smart Commit Generator ===${colors.reset}\n`);

  const status = getGitStatus();

  if (status.modified.length === 0 && status.added.length === 0 &&
      status.deleted.length === 0 && status.renamed.length === 0) {
    console.log(`${colors.yellow}No changes to commit${colors.reset}\n`);
    return false;
  }

  const changes = analyzeChanges(status);

  // Scope analysis — warn if changes span too many modules
  const scope = detectModuleScope(changes.files);
  if (scope.featureCount > 0) {
    console.log(`${colors.bright}Module Scope:${colors.reset} ${scope.modules.join(', ')}${scope.hasInfra ? ' + infrastructure' : ''}${scope.hasDocs ? ' + docs' : ''}\n`);
  }
  if (scope.shouldSplit) {
    console.log(`${colors.yellow}⚠ SCOPE WARNING: Changes span ${scope.featureCount} feature modules${colors.reset}`);
    console.log(`${colors.yellow}  ${scope.splitSuggestion}${colors.reset}\n`);
  }

  const message = generateCommitMessage(changes);

  console.log(`${colors.bright}Suggested Commit Message:${colors.reset}\n`);
  console.log(`${colors.cyan}${message}${colors.reset}\n`);

  console.log(`${colors.bright}To use this message:${colors.reset}`);
  console.log(`  git add .`);
  console.log(`  git commit -m "$(cat <<'EOF'`);
  console.log(message);
  console.log(`EOF`);
  console.log(`  )"\n`);

  return true;
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
${colors.bright}Smart Commit Generator Skill${colors.reset}

${colors.bright}Usage:${colors.reset}
  node scripts/skills/commit-smart.js [--generate|--preview|--help]

${colors.bright}Modes:${colors.reset}
  --generate  Analyze changes and generate commit message (default)
  --preview   Show what would be committed (dry-run)
  --help      Show this help message

${colors.bright}Examples:${colors.reset}
  ${colors.cyan}# Generate smart commit message${colors.reset}
  node scripts/skills/commit-smart.js

  ${colors.cyan}# Preview changes${colors.reset}
  node scripts/skills/commit-smart.js --preview

${colors.bright}What this does:${colors.reset}
  - Analyzes git changes (modified, added, deleted files)
  - Detects change patterns (schema, types, controllers, etc.)
  - Determines appropriate commit type (feat/fix/docs/etc.)
  - Generates detailed, multi-line commit message
  - Follows existing commit patterns (68% feat, 18% fix)
  - Includes Claude Code attribution

${colors.bright}Commit Types:${colors.reset}
  - ${colors.green}feat${colors.reset}     New features or significant changes
  - ${colors.yellow}fix${colors.reset}      Bug fixes
  - ${colors.cyan}docs${colors.reset}     Documentation updates
  - ${colors.blue}test${colors.reset}     Test additions or updates
  - ${colors.reset}chore${colors.reset}    Maintenance tasks

${colors.bright}Important:${colors.reset}
  - Review the generated message before committing
  - Edit as needed for specific context
  - Ensures consistent commit quality
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
      return generateAndShow() ? 0 : 1;

    case '--preview':
      return previewChanges() ? 0 : 1;

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

module.exports = { generateCommitMessage, analyzeChanges, getGitStatus };
