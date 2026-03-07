#!/usr/bin/env node
/**
 * TypeScript Error Checker
 *
 * Unified TypeScript error checking for frontend and backend.
 * Catches pre-existing errors that weren't caught during development.
 *
 * Usage:
 *   node scripts/skills/type-check.js [--all|--frontend|--backend|--report|--ci|--help]
 *
 * Modes:
 *   --all       Check both frontend + backend (default)
 *   --frontend  Check frontend only
 *   --backend   Check backend only
 *   --report    Detailed error report with file grouping
 *   --ci        CI-optimized output (no colors, machine-readable)
 *   --help      Show usage information
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// CI mode flag (disable colors)
let ciMode = false;

function c(color, text) {
  if (ciMode) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Run TypeScript type checking for a project
 */
function runTypeCheck(project) {
  const projectPath = path.join(process.cwd(), project);
  const packageJsonPath = path.join(projectPath, 'package.json');

  // Check if project exists
  if (!fs.existsSync(packageJsonPath)) {
    return {
      project,
      success: false,
      errors: [],
      errorCount: 0,
      fileCount: 0,
      raw: `Project ${project} not found`,
      configError: true,
    };
  }

  // Use direct tsc command for better output capture
  const tscCommand = project === 'frontend' ? 'npx tsc -b --noEmit' : 'npx tsc --noEmit';

  try {
    execSync(tscCommand, {
      cwd: projectPath,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return {
      project,
      success: true,
      errors: [],
      errorCount: 0,
      fileCount: 0,
      raw: '',
    };
  } catch (error) {
    // Combine stdout and stderr - handle Buffer or string
    let stdout = '';
    let stderr = '';

    if (error.stdout) {
      stdout = Buffer.isBuffer(error.stdout) ? error.stdout.toString('utf8') : String(error.stdout);
    }
    if (error.stderr) {
      stderr = Buffer.isBuffer(error.stderr) ? error.stderr.toString('utf8') : String(error.stderr);
    }

    const output = stdout + '\n' + stderr;
    const parsed = parseErrors(output, project);

    // Debug: show raw output length
    if (parsed.errorCount === 0 && output.trim().length > 0) {
      // There's output but no parsed errors - might be parsing issue
      // Count errors by looking for "error TS" pattern
      const errorMatches = output.match(/error TS\d+/g);
      if (errorMatches) {
        parsed.errorCount = errorMatches.length;
        // Get unique files
        const fileMatches = output.match(/^[^\s(]+\(\d+,\d+\):/gm);
        if (fileMatches) {
          const files = new Set(fileMatches.map(f => f.replace(/\(\d+,\d+\):$/, '')));
          parsed.fileCount = files.size;
        }
      }
    }

    return {
      project,
      success: false,
      ...parsed,
      raw: output,
    };
  }
}

/**
 * Parse TypeScript compiler output into structured errors
 */
function parseErrors(output, project) {
  const errors = [];
  const lines = output.split('\n');

  // TypeScript error format: file(line,col): error TSxxxx: message
  // Also handles: file:line:col - error TSxxxx: message (newer format)
  // Note: file paths may contain spaces and special characters
  const errorRegex1 = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/;
  const errorRegex2 = /^(.+?):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let match = trimmed.match(errorRegex1) || trimmed.match(errorRegex2);
    if (match) {
      errors.push({
        file: match[1].trim(),
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        code: match[4],
        message: match[5].trim(),
        project,
      });
    }
  }

  // Get unique files
  const files = new Set(errors.map(e => e.file));

  return {
    errors,
    errorCount: errors.length,
    fileCount: files.size,
  };
}

/**
 * Group errors by file
 */
function groupByFile(errors) {
  const grouped = {};
  for (const error of errors) {
    if (!grouped[error.file]) {
      grouped[error.file] = [];
    }
    grouped[error.file].push(error);
  }
  // Sort by file name
  return Object.keys(grouped)
    .sort()
    .reduce((acc, key) => {
      acc[key] = grouped[key].sort((a, b) => a.line - b.line);
      return acc;
    }, {});
}

/**
 * Print summary of results
 */
function printSummary(results) {
  console.log(`\n${c('bright', c('cyan', '═'.repeat(50)))}`);
  console.log(`${c('bright', 'SUMMARY')}`);
  console.log(`${c('cyan', '═'.repeat(50))}\n`);

  let totalErrors = 0;
  let totalFiles = 0;

  for (const result of results) {
    const status = result.success
      ? c('green', '✓ No errors')
      : c('red', `✗ ${result.errorCount} errors in ${result.fileCount} files`);

    console.log(`  ${c('bright', result.project.padEnd(10))} ${status}`);
    totalErrors += result.errorCount;
    totalFiles += result.fileCount;
  }

  console.log(`${c('cyan', '─'.repeat(50))}`);

  if (totalErrors === 0) {
    console.log(`  ${c('green', '✓')} ${c('bright', 'All checks passed!')}`);
  } else {
    console.log(`  ${c('bright', 'Total:')}      ${c('red', `${totalErrors} errors`)} in ${totalFiles} files`);
  }

  console.log();
  return totalErrors === 0;
}

/**
 * Print detailed report with errors grouped by file
 */
function printReport(results) {
  console.log(`\n${c('bright', c('cyan', '=== TypeScript Error Report ==='))}\n`);

  let totalErrors = 0;

  for (const result of results) {
    if (result.configError) {
      console.log(`${c('yellow', '⚠')} ${c('bright', result.project.toUpperCase())}: ${result.raw}\n`);
      continue;
    }

    const header = result.success
      ? `${c('green', '✓')} ${c('bright', result.project.toUpperCase())} - No errors`
      : `${c('red', '✗')} ${c('bright', result.project.toUpperCase())} (${result.errorCount} errors in ${result.fileCount} files)`;

    console.log(`${c('blue', '▶')} ${header}\n`);

    if (!result.success && result.errors.length > 0) {
      const grouped = groupByFile(result.errors);

      for (const [file, errors] of Object.entries(grouped)) {
        // Shorten file path for display
        const shortFile = file.replace(process.cwd(), '').replace(/^[\\\/]/, '');
        console.log(`  ${c('cyan', '📁')} ${c('bright', shortFile)} (${errors.length} errors)`);

        for (const error of errors) {
          const location = `L${error.line}:${error.column}`.padEnd(10);
          const code = c('yellow', error.code);
          console.log(`     ${c('dim', location)} ${code}  ${error.message}`);
        }
        console.log();
      }

      totalErrors += result.errorCount;
    }
  }

  return totalErrors === 0;
}

/**
 * Print CI-friendly output
 */
function printCI(results) {
  let totalErrors = 0;

  for (const result of results) {
    if (result.errors.length > 0) {
      for (const error of result.errors) {
        // Format: file:line:col: error CODE: message
        console.log(`${error.file}:${error.line}:${error.column}: error ${error.code}: ${error.message}`);
      }
    }
    totalErrors += result.errorCount;
  }

  console.log(`\nTotal errors: ${totalErrors}`);
  return totalErrors === 0;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
${c('bright', c('cyan', 'TypeScript Error Checker'))}

Unified TypeScript error checking for frontend and backend.

${c('bright', 'Usage:')}
  node scripts/skills/type-check.js [mode]

${c('bright', 'Modes:')}
  ${c('cyan', '--all')}       Check both frontend + backend (default)
  ${c('cyan', '--frontend')}  Check frontend only
  ${c('cyan', '--backend')}   Check backend only
  ${c('cyan', '--report')}    Detailed error report with file grouping
  ${c('cyan', '--ci')}        CI-optimized output (no colors)
  ${c('cyan', '--help')}      Show this help message

${c('bright', 'Examples:')}
  node scripts/skills/type-check.js              # Check all
  node scripts/skills/type-check.js --frontend   # Frontend only
  node scripts/skills/type-check.js --report     # Detailed report

${c('bright', 'Exit Codes:')}
  0  No errors found
  1  TypeScript errors found
  2  Configuration error
`);
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);
  let mode = '--all';
  let reportMode = false;

  // Parse arguments
  for (const arg of args) {
    if (arg === '--ci') {
      ciMode = true;
    } else if (arg === '--report') {
      reportMode = true;
    } else if (arg === '--help') {
      showHelp();
      return 0;
    } else if (['--all', '--frontend', '--backend'].includes(arg)) {
      mode = arg;
    }
  }

  console.log(`\n${c('bright', c('cyan', '=== TypeScript Error Check ==='))}\n`);

  const results = [];

  // Determine which projects to check
  const projects = [];
  if (mode === '--all' || mode === '--frontend') {
    projects.push('frontend');
  }
  if (mode === '--all' || mode === '--backend') {
    projects.push('backend');
  }

  // Run checks
  for (const project of projects) {
    console.log(`${c('cyan', '→')} Checking ${c('bright', project)}...`);
    const result = runTypeCheck(project);
    results.push(result);

    if (result.configError) {
      console.log(`  ${c('yellow', '⚠')} ${result.raw}\n`);
    } else if (result.success) {
      console.log(`  ${c('green', '✓')} No errors found\n`);
    } else {
      console.log(`  ${c('red', '✗')} ${result.errorCount} errors in ${result.fileCount} files\n`);
    }
  }

  // Print output based on mode
  let success;
  if (ciMode) {
    success = printCI(results);
  } else if (reportMode) {
    success = printReport(results);
  } else {
    success = printSummary(results);
  }

  return success ? 0 : 1;
}

// Run if executed directly
if (require.main === module) {
  const exitCode = main();
  process.exit(exitCode);
}

// Export for testing
module.exports = {
  runTypeCheck,
  parseErrors,
  groupByFile,
  printSummary,
  printReport,
};
